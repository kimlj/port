#!/usr/bin/env bash
# The droplet's own reading of itself, for panel 6 of the hub.
#
# Runs on the droplet, writes one JSON file, and does nothing else. Every
# command in it is a read: no service is started, stopped or restarted, no file
# outside the output path is written, and nothing here takes an argument from
# outside the machine. It is meant to be safe to run as a timer for years.
#
# api/hub-status.js fetches the result server-side with a token and allowlists
# the fields before they reach a browser. THE BROWSER NEVER REACHES THIS FILE
# DIRECTLY, and the Vercel function never opens a shell here - see the comment
# above fetchVpsStats(). A key that can run commands on a production box does
# not belong in a serverless environment; a token that fetches a document does.
#
# INSTALL (as root, on the droplet):
#
#   install -m 755 hub-agent.sh /usr/local/bin/hub-agent
#   install -d -o caddy -g caddy /var/lib/hub-agent
#   /usr/local/bin/hub-agent                       # once, to check the output
#
#   cat >/etc/systemd/system/hub-agent.service <<'EOF'
#   [Unit]
#   Description=Collect host figures for the kimlj.dev hub
#   [Service]
#   Type=oneshot
#   ExecStart=/usr/local/bin/hub-agent
#   EOF
#
#   cat >/etc/systemd/system/hub-agent.timer <<'EOF'
#   [Unit]
#   Description=Refresh hub host figures every minute
#   [Timer]
#   OnBootSec=30s
#   OnUnitActiveSec=60s
#   [Install]
#   WantedBy=timers.target
#   EOF
#
#   systemctl daemon-reload && systemctl enable --now hub-agent.timer
#
# THEN SERVE IT, token-gated, on a host Caddy already answers for. Add to the
# Caddyfile inside an existing site block (mdspro.kimlj.dev is fine - it is
# already TLS and already ours), then `caddy reload`:
#
#   @hub {
#     path /__hub/status.json
#     header X-Hub-Token "REPLACE_WITH_THE_TOKEN"
#   }
#   handle @hub {
#     root * /var/lib/hub-agent
#     rewrite * /status.json
#     file_server
#   }
#   handle /__hub/* {
#     respond 404
#   }
#
# The trailing 404 handler matters: without it a request with no token falls
# through to the reverse_proxy behind it, and the app sees a path it has no
# route for. With it, a stranger and a wrong token get the same answer as a
# path that does not exist, which is what the game's stats route does too.
#
# Finally, in this repo:
#
#   printf %s "https://mdspro.kimlj.dev/__hub/status.json" | vercel env add HUB_VPS_URL production
#   printf %s "<the token>" | vercel env add HUB_VPS_TOKEN production
#   vercel redeploy <url> --target production
#
set -euo pipefail

OUT=/var/lib/hub-agent/status.json
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

# Every helper swallows its own failure and yields null. A box missing lscpu or
# fail2ban should publish a gap, not an empty file.
try() { "$@" 2>/dev/null || true; }
jnum() { [ -n "${1:-}" ] && [ "$1" -eq "$1" ] 2>/dev/null && printf '%s' "$1" || printf 'null'; }
jstr() { [ -n "${1:-}" ] && printf '"%s"' "$(printf '%s' "$1" | sed 's/[\\"]/\\&/g')" || printf 'null'; }

HOSTNAME_=$(try hostname)
OS=$(try lsb_release -ds)
UPTIME_DAYS=$(( $(cut -d. -f1 /proc/uptime) / 86400 ))
VCPU=$(try nproc)
CPU_MODEL=$(try lscpu | awk -F: '/Model name/{print $2; exit}' | xargs || true)
VIRT=$(try systemd-detect-virt)
read -r RAM_USED RAM_TOTAL <<<"$(free -m | awk 'NR==2{print $3, $2}')"
read -r DISK_USED DISK_TOTAL <<<"$(df -BG --output=used,size / | tail -1 | tr -dc '0-9 ')"

F2B_ACTIVE=$(systemctl is-active fail2ban 2>/dev/null || true)
F2B_STATUS=$(try fail2ban-client status sshd)
F2B_FAILED=$(printf '%s' "$F2B_STATUS" | awk -F'\t' '/Total failed/{gsub(/[^0-9]/,"",$2); print $2; exit}')
F2B_BANNED=$(printf '%s' "$F2B_STATUS" | awk -F'\t' '/Total banned/{gsub(/[^0-9]/,"",$2); print $2; exit}')

# Password auth off AND root login key-only is what "key-only SSH" claims, so
# both have to hold before it is asserted. sshd_config.d wins over the main
# file, so the effective value is the last one set.
SSH_PASS=$(try sshd -T | awk '/^passwordauthentication /{print $2; exit}')
SSH_ROOT=$(try sshd -T | awk '/^permitrootlogin /{print $2; exit}')
if [ "$SSH_PASS" = "no" ] && { [ "$SSH_ROOT" = "prohibit-password" ] || [ "$SSH_ROOT" = "without-password" ] || [ "$SSH_ROOT" = "no" ]; }; then
  SSH_KEY_ONLY=true
elif [ -n "$SSH_PASS" ]; then
  SSH_KEY_ONLY=false
else
  SSH_KEY_ONLY=null
fi

# Services are named here rather than discovered. A list built from `systemctl
# list-units` would publish whatever happened to be running next, including
# things that are nobody's business; this one changes when a person changes it.
SERVICES=""
add_service() { # name, port, systemd-unit-or-docker-name, kind
  local state
  if [ "$4" = "docker" ]; then
    case "$(try docker inspect -f '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$3")" in
      running\|none|running\|healthy) state=running ;;
      running\|starting) state=degraded ;;
      running\|unhealthy) state=degraded ;;
      *) state=down ;;
    esac
  elif [ "$4" = "port" ]; then
    # Not everything on this box is a unit. The :8787 service is a bare node
    # process, and something listening on its port is the only claim available
    # without guessing at a PID.
    if [ -n "$(try ss -lntH "sport = :$3")" ]; then state=running; else state=down; fi
  else
    case "$(systemctl is-active "$3" 2>/dev/null || true)" in
      active) state=running ;;
      activating|reloading) state=degraded ;;
      *) state=down ;;
    esac
  fi
  [ -n "$SERVICES" ] && SERVICES="$SERVICES,"
  SERVICES="$SERVICES{\"name\":$(jstr "$1"),\"port\":$(jstr "$2"),\"state\":\"$state\"}"
}

add_service "caddy.service"     ":80/:443" caddy.service       systemd
add_service "api.casinore.io"   ":3001"    ore-backend         docker
add_service "api.wordwarz.io"   ":3002"    server-multiwordle-1 docker
add_service "wordle.casinore.io" ":3002"   server-multiwordle-1 docker
add_service "mdspro.kimlj.dev"  ":8787"    8787                port
add_service "sendit.service"    "-"        sendit.service      systemd
add_service "jobsift.service"   "-"        jobsift.service     systemd

cat >"$TMP" <<JSON
{
  "generatedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "host": {
    "name": $(jstr "$HOSTNAME_"),
    "os": $(jstr "$OS"),
    "virt": $(jstr "${VIRT^^}"),
    "uptimeDays": $(jnum "$UPTIME_DAYS"),
    "cpu": { "vcpu": $(jnum "$VCPU"), "model": $(jstr "$CPU_MODEL") },
    "ram": { "usedMb": $(jnum "$RAM_USED"), "totalMb": $(jnum "$RAM_TOTAL") },
    "disk": { "usedGb": $(jnum "$DISK_USED"), "totalGb": $(jnum "$DISK_TOTAL") }
  },
  "security": {
    "fail2ban": $([ "$F2B_ACTIVE" = "active" ] && echo true || echo false),
    "sshKeyOnly": $SSH_KEY_ONLY,
    "blocked": $(jnum "$F2B_FAILED"),
    "banned": $(jnum "$F2B_BANNED")
  },
  "services": [$SERVICES]
}
JSON

# Validate before publishing. A half-written file served to the function is a
# parse error on the page; the old one is always a better answer than that.
python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "$TMP"
install -m 644 "$TMP" "$OUT"

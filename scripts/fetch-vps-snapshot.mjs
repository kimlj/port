/**
 * Renders panel 6 of the hub from assets/vps-snapshot.json.
 *
 *     node scripts/fetch-vps-snapshot.mjs [--from <collected.json>] [--check]
 *
 * The panel states figures about a machine this repository cannot reach, so
 * they arrive the way every other figure on this site does: as a dated
 * snapshot, written into the markup AND into the JSON in the same pass. The
 * markup is what a reader sees with the script blocked; the JSON is what
 * hub-infra.js re-reads so a refreshed snapshot reaches a cached page.
 *
 * Nothing here invents a value. A field the collector did not return is
 * written as an em dash and carries data-vps-missing, which the panel styles
 * as absent rather than as zero - the difference between "not measured" and
 * "measured and it was nothing" is the whole argument of this panel.
 *
 * To collect on the droplet, over SSH, read-only:
 *
 *   node -e 'const{execSync:x}=require("child_process");const s=c=>{try{return x(c,{encoding:"utf8"}).trim()}catch{return null}};
 *   const mem=s("free -m|awk \"NR==2{print \\$3,\\$2}\"")?.split(" ")||[];
 *   const dsk=s("df -BG --output=used,size / |tail -1")?.match(/\d+/g)||[];
 *   console.log(JSON.stringify({generatedAt:new Date().toISOString(),host:{
 *     name:s("hostname"),os:s("lsb_release -ds"),
 *     uptimeDays:Math.floor(Number(s("cut -d. -f1 /proc/uptime"))/86400),
 *     cpu:{vcpu:Number(s("nproc")),model:s("lscpu|awk -F: \"/Model name/{print \\$2}\"|xargs")},
 *     ram:{usedMb:+mem[0],totalMb:+mem[1]},disk:{usedGb:+dsk[0],totalGb:+dsk[1]}},
 *     security:{fail2ban:s("systemctl is-active fail2ban")==="active",
 *       blocked:Number(s("fail2ban-client status sshd|grep Total|grep -o \"[0-9]*\"|head -1"))||null}},null,2))'
 *
 * Save what it prints and pass it with --from. The topology, the schedule and
 * the service list are declared in the snapshot by hand: they come from the
 * Caddyfile and the crontab, they change when somebody changes them, and a
 * collector guessing at them would be a worse source than the person who
 * wrote them.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SNAPSHOT = join(ROOT, "assets", "vps-snapshot.json");
const HUB = join(ROOT, "hub.html");
const START = "<!-- vps:start -->";
const END = "<!-- vps:end -->";

const args = process.argv.slice(2);
const check = args.includes("--check");
const fromIndex = args.indexOf("--from");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const num = (v) => (Number.isFinite(v) ? v.toLocaleString("en-US") : null);

// A value the snapshot does not carry renders as an em dash the panel dims,
// never as 0 and never as a guess.
function field(path, value, extra = "") {
  const missing = value === null || value === undefined || value === "";
  return `<span data-vps="${path}"${missing ? ' data-vps-missing="true"' : ""}${extra}>${missing ? "&#8212;" : esc(value)}</span>`;
}

function pct(used, total) {
  if (!Number.isFinite(used) || !Number.isFinite(total) || total <= 0) return null;
  return Math.round((used / total) * 100);
}

function meter(used, total, tone) {
  const p = pct(used, total);
  if (p === null) return `<div class="meter"><i><em style="--pct:0%"></em></i><b data-vps-missing="true">&#8212;</b></div>`;
  return `<div class="meter"${tone ? ` data-tone="${tone}"` : ""}><i><em style="--pct:${p}%"></em></i><b>${p}%</b></div>`;
}

const ICON = {
  server: '<path d="M3 5h18v5H3zM3 14h18v5H3z"/><circle cx="7" cy="7.5" r=".6"/><circle cx="7" cy="16.5" r=".6"/>',
  cpu: '<rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/>',
  ram: '<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 11v2M11 11v2M15 11v2"/>',
  disk: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8h8M8 12h8"/><circle cx="12" cy="16.5" r="1"/>',
  share: '<circle cx="6" cy="12" r="2.4"/><circle cx="18" cy="6.5" r="2.4"/><circle cx="18" cy="17.5" r="2.4"/><path d="M8.2 10.9l7.6-3.3M8.2 13.1l7.6 3.3"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  shield: '<path d="M12 3l7.5 3v6c0 4.4-3.1 7.9-7.5 9-4.4-1.1-7.5-4.6-7.5-9V6z"/>',
  box: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'
};
const icon = (name, cls) => `<span class="${cls}"><svg viewBox="0 0 24 24">${ICON[name]}</svg></span>`;

function render(d) {
  const h = d.host || {};
  const proxy = d.proxy || [];
  const flowIndex = proxy.findIndex((p) => p.flow);
  // The trunk spans first node centre to last node centre, so those are its 0%
  // and 100% and the live segment needs no measuring - it runs from the lit
  // node's centre to Caddy's lead-in, which meets the trunk at its midpoint.
  const flowAt = proxy.length > 1 && flowIndex >= 0 ? (flowIndex / (proxy.length - 1)) * 100 : 0;
  const flowA = Math.min(flowAt, 50).toFixed(2) + "%";
  const flowB = Math.max(flowAt, 50).toFixed(2) + "%";
  const trunkTop = proxy.length ? (50 / proxy.length).toFixed(2) + "%" : "12.5%";

  // The strip is the nightly backups, not host uptime. A box that has not
  // rebooted in 289 days has no daily shape to draw, and the host card already
  // states the 289 - a thirty-square strip of the same fact would be a chart of
  // one number. The backups genuinely have a per-day answer: the artifact for
  // that night is on disk or it is not.
  const strip = (d.backups && d.backups.strip) || null;
  const up = (strip && strip.days) || [];
  const healthy = up.filter((s) => s === "up").length;
  const scheduled = up.filter((s) => s !== "unknown").length;
  const uptimePct = scheduled ? ((healthy / scheduled) * 100).toFixed(1) : null;
  const sets = (d.backups && d.backups.sets) || [];
  const sec = d.security || {};
  const spark = (sec.blockedDays || []);
  const sparkMax = Math.max(1, ...spark);

  const stamp = Number.isFinite(Date.parse(d.generatedAt))
    ? new Date(d.generatedAt).toISOString().slice(0, 16).replace("T", " ") + " UTC"
    : "date unavailable";

  const uptimeCard = up.length
    ? `<div class="card uptime-strip">
<div class="card-head" style="margin:0">${icon("chart", "card-ico")}<h3>Nightly backups</h3><span class="card-note strip-sets">${sets.map((x) => esc(x.name) + " " + x.hit + "/" + x.scheduled).join(" &#183; ")}</span></div>
<div>
<div class="uptime-days">
${up.map((s) => `<i data-state="${esc(s)}"></i>`).join("")}
</div>
<div class="uptime-scale"><span>${esc(strip.firstDay)}</span><span>${esc(strip.lastDay)}</span></div>
</div>
<div class="uptime-total">
<b>${healthy} / ${scheduled} nights</b>
<span>${uptimePct === null ? "&#8212;" : uptimePct + "% landed"}</span>
</div>
</div>`
    : `<div class="card uptime-strip is-empty">
<div class="card-head" style="margin:0">${icon("chart", "card-ico")}<h3>Nightly backups</h3></div>
<p class="infra-note">No dated backup artifacts found, so there is no per-night series to draw.</p>
</div>`;

  return `${START}
<div class="infra-grid">
<div class="infra-main">

<div class="card host-card">
<div class="host-head">
${icon("server", "host-badge")}
<div class="host-id">
<h2>${field("host.name", h.name)}</h2>
<p>${field("host.ip", h.ip)} <span>&#183;</span> ${field("host.region", h.region)}</p>
</div>
<div class="host-chips">
<span class="mono-chip">${field("host.os", h.os)}</span>
<span class="mono-chip">${field("host.virt", h.virt)}</span>
<span class="mono-chip">uptime <b>${field("host.uptimeDays", Number.isFinite(h.uptimeDays) ? h.uptimeDays + " days" : null)}</b></span>
</div>
</div>
<div class="host-stats">
<div class="stat">
<div class="stat-head">${icon("cpu", "card-ico")}<span>CPU</span></div>
<p class="stat-value">${field("host.cpu.vcpu", Number.isFinite(h.cpu && h.cpu.vcpu) ? h.cpu.vcpu + " vCPU" : null)}</p>
<p class="stat-sub">${field("host.cpu.model", h.cpu && h.cpu.model)}</p>
</div>
<div class="stat">
<div class="stat-head">${icon("ram", "card-ico")}<span>RAM</span></div>
<p class="stat-value">${field("host.ram", h.ram && Number.isFinite(h.ram.usedMb) ? `${num(h.ram.usedMb)} / ${num(h.ram.totalMb)} MB` : null)}</p>
${meter(h.ram && h.ram.usedMb, h.ram && h.ram.totalMb, "warn")}
</div>
<div class="stat">
<div class="stat-head">${icon("disk", "card-ico")}<span>DISK</span></div>
<p class="stat-value">${field("host.disk", h.disk && Number.isFinite(h.disk.usedGb) ? `${num(h.disk.usedGb)} / ${num(h.disk.totalGb)} GB` : null)}</p>
${meter(h.disk && h.disk.usedGb, h.disk && h.disk.totalGb)}
</div>
</div>
</div>

<div class="card proxy-card">
<div class="card-head">${icon("share", "card-ico")}<h3>Reverse proxy &amp; services</h3><span class="card-note">Caddy terminates TLS and routes to the services on loopback.</span></div>
<div class="proxy-grid">
<div class="proxy-source">
${icon("lock", "proxy-lock")}
<strong>Caddy</strong>
<span class="mono">:80 / :443</span>
<small>TLS &#183; HTTP/3<br>Reverse proxy</small>
</div>
<div class="proxy-wires"><i class="proxy-trunk" style="--trunk-top:${trunkTop};--flow-a:${flowA};--flow-b:${flowB}"></i></div>
<div class="proxy-targets">
${proxy.map((p) => `<div class="proxy-node"${p.flow ? ' data-flow="true"' : ""}><span class="state-dot" data-state="up"></span><b>${esc(p.host)}</b><span>${esc(p.backing)}</span></div>`).join("\n")}
</div>
</div>
<div class="proxy-split"><span>Standalone services</span><i></i></div>
<div class="proxy-grid">
<div></div>
<div></div>
<div class="proxy-targets">
${(d.standalone || []).map((p) => `<div class="proxy-node is-plain"><span class="state-dot" data-state="up"></span><b>${esc(p.host)}</b><span>${esc(p.backing)}</span></div>`).join("\n")}
</div>
</div>
</div>

${uptimeCard}

</div>
<aside class="infra-rail">

<div class="card">
<div class="card-head">${icon("calendar", "card-ico")}<h3>Scheduled</h3><span class="card-note">${(d.cron || []).length} jobs</span></div>
<div class="rail-rows">
${(d.cron || []).map((c) => `<div class="rail-row"><span>${esc(c.when)}</span><span>${esc(c.what)}</span><span class="tick">&#10003;</span></div>`).join("\n")}
</div>
</div>

<div class="card">
<div class="card-head">${icon("shield", "card-ico")}<h3>Security</h3></div>
${sec.fail2ban === null || sec.fail2ban === undefined ? "" : `<div class="rail-check"><span class="tick">${sec.fail2ban ? "&#10003;" : "&#183;"}</span>fail2ban ${sec.fail2ban ? "active" : "not running"}</div>
`}${sec.sshKeyOnly === null || sec.sshKeyOnly === undefined ? "" : `<div class="rail-check"><span class="tick">${sec.sshKeyOnly ? "&#10003;" : "&#183;"}</span>${sec.sshKeyOnly ? "key-only SSH" : "password SSH enabled"}</div>
`}<p class="rail-figure">${field("security.blocked", num(sec.blocked))} failed auth attempts<em>${Number.isFinite(sec.banned) ? num(sec.banned) + " addresses banned" : "ban count unavailable"}</em></p>
${spark.length ? `<div class="spark">${spark.map((v) => `<i style="--h:${Math.max(8, Math.round((v / sparkMax) * 100))}%"></i>`).join("")}</div>
<div class="spark-foot">${spark.length} days</div>` : ""}
</div>

<div class="card">
<div class="card-head">${icon("box", "card-ico")}<h3>Services</h3><span class="card-note">${(d.services || []).length} services</span></div>
<div class="rail-rows">
${(d.services || []).map((s) => `<div class="rail-row"><span>${esc(s.name)}</span><span>${esc(s.port)}</span><span class="rail-state" data-state="${esc(s.state)}"><i class="state-dot" data-state="${s.state === "running" ? "up" : s.state === "degraded" ? "degraded" : "down"}"></i>${esc(s.state)}</span></div>`).join("\n")}
</div>
</div>

</aside>
</div>

<p class="infra-note" data-vps-stamp>Snapshot taken ${stamp}. Host figures, the service states and the nightly-backup series are a dated reading, not a live feed &#183; the four figures in the header strip are the live probe.${d.verified === false ? " <b>Unverified seed.</b>" : ""}</p>
${END}`;
}

const data = JSON.parse(readFileSync(fromIndex >= 0 ? args[fromIndex + 1] : SNAPSHOT, "utf8"));
const markup = render(data);
const hub = readFileSync(HUB, "utf8");
const start = hub.indexOf(START);
const end = hub.indexOf(END);
if (start < 0 || end < 0) {
  console.error(`Could not find ${START} / ${END} in hub.html.`);
  process.exit(1);
}
const next = hub.slice(0, start) + markup + hub.slice(end + END.length);

if (check) {
  const same = next === hub;
  console.log(same ? "hub.html matches the snapshot." : "hub.html is out of date with the snapshot.");
  process.exit(same ? 0 : 1);
}

if (fromIndex >= 0) writeFileSync(SNAPSHOT, JSON.stringify(data, null, 2) + "\n");
writeFileSync(HUB, next);
console.log(`Wrote panel 6 from ${data.generatedAt}${data.verified === false ? " (unverified seed)" : ""}.`);

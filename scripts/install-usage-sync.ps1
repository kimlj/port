<#
    Registers the scheduled task that keeps the Claude Code half of Build
    Activity current. Run it once, from anywhere:

        powershell -ExecutionPolicy Bypass -File scripts\install-usage-sync.ps1

    It is idempotent - running it again replaces the task definition.
    To undo:

        schtasks /Delete /TN "kimlj.dev build activity" /F

    No elevation needed. Register-ScheduledTask is the obvious cmdlet for this
    and it fails with "Access is denied" writing to the root task folder as a
    standard user; schtasks /XML registers the same task without a prompt.

    The task runs as the signed-in user with no stored password, so it only
    fires while someone is logged on. That is the honest trade: these figures
    come from this machine's own session transcripts, so they cannot be more
    current than the machine is awake. The dateline on the page says when they
    were last taken.

    The task points at the copy of the sync script inside the clone that script
    maintains for itself, NOT at any working tree - a checkout can be sitting on
    a branch where the file does not exist, and that is exactly the kind of
    assumption an unattended task should not carry. The clone resets to
    origin/main every run, so the task always runs what is released.
#>

$ErrorActionPreference = 'Stop'

$TaskName = 'kimlj.dev build activity'
$SyncDir  = Join-Path $env:LOCALAPPDATA 'kimlj-port-usage-sync'
$Script   = Join-Path $SyncDir 'repo\scripts\sync-claude-usage.mjs'

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { throw "node is not on PATH - install Node.js first." }

# First run seeds the clone the task will then use. Done here rather than inside
# the task so a failure is seen now, by a person, instead of in three weeks in a
# log file nobody opened.
if (-not (Test-Path $Script)) {
    Write-Host "Seeding the sync clone (first run)..."
    $seed = Join-Path $PSScriptRoot 'sync-claude-usage.mjs'
    if (-not (Test-Path $seed)) { throw "Cannot find $seed" }
    & $node $seed --dry-run
    if (-not (Test-Path $Script)) {
        throw "Clone did not appear at $Script - is sync-claude-usage.mjs pushed to main?"
    }
}

# 22:00 local. The GitHub half runs 16:10 UTC from a runner; this is 14:00 UTC,
# so the two are never pushing at the same moment.
$xml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Refreshes assets/claude-usage.json on kimlj.dev from this machine's Claude Code transcripts, and pushes it.</Description>
    <URI>\$TaskName</URI>
  </RegistrationInfo>
  <Triggers>
    <CalendarTrigger>
      <StartBoundary>2026-01-01T22:00:00</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay>
    </CalendarTrigger>
    <LogonTrigger>
      <Enabled>true</Enabled>
      <UserId>$env:USERNAME</UserId>
      <Delay>PT2M</Delay>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>true</RunOnlyIfNetworkAvailable>
    <Enabled>true</Enabled>
    <ExecutionTimeLimit>PT15M</ExecutionTimeLimit>
    <Priority>7</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>$node</Command>
      <Arguments>"$Script"</Arguments>
      <WorkingDirectory>$SyncDir</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
"@

# Task Scheduler wants UTF-16 for /XML, which is what the declaration above says.
$xmlPath = Join-Path $env:TEMP 'kimlj-usage-sync-task.xml'
[System.IO.File]::WriteAllText($xmlPath, $xml, [System.Text.Encoding]::Unicode)

try {
    $out = & schtasks.exe /Create /TN $TaskName /XML $xmlPath /F 2>&1
    if ($LASTEXITCODE -ne 0) { throw "schtasks failed: $out" }
} finally {
    Remove-Item $xmlPath -ErrorAction SilentlyContinue
}

# Verify rather than announce. An earlier version of this script printed a
# success banner after a registration that had actually been denied.
$check = & schtasks.exe /Query /TN $TaskName 2>&1
if ($LASTEXITCODE -ne 0) { throw "Task did not register: $check" }

Write-Host ""
Write-Host "Registered '$TaskName'"
Write-Host "  runs   : $node `"$Script`""
Write-Host "  when   : daily 22:00, and 2 min after logon (catches days the machine was off)"
Write-Host "  log    : $(Join-Path $SyncDir 'sync.log')"
Write-Host ""
Write-Host "Run it now with:  schtasks /Run /TN `"$TaskName`""
Write-Host "Remove it with :  schtasks /Delete /TN `"$TaskName`" /F"

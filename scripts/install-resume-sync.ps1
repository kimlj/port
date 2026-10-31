<#
    Registers the weekly task that keeps the AI resume's Claude Code line in
    step with kimlj.dev (scripts\sync-resume-usage.ps1). Run it once:

        powershell -ExecutionPolicy Bypass -File scripts\install-resume-sync.ps1

    Idempotent. To undo:

        schtasks /Delete /TN "\Cockpit\kimlj.dev AI resume figures" /F

    It lives in Task Scheduler's \Cockpit\ folder, where Cockpit's Automations
    reads the jobs it can run, and is declared in ~/.dsh/cordis.patch.yml.

    Sunday 22:30: half an hour after the daily usage sync, so it reads that
    day's figure. StartWhenAvailable catches a Sunday the machine was off.
    Like the usage sync it runs as the signed-in user with no stored password
    (Word needs a desktop session anyway), and it runs the copy of the script
    inside its own clone, which resets to origin/main every run.

    conhost --headless keeps PowerShell from flashing a window over whatever
    is on screen at 22:30.
#>

$ErrorActionPreference = 'Stop'

$TaskName = '\Cockpit\kimlj.dev AI resume figures'
$SyncDir  = Join-Path $env:LOCALAPPDATA 'kimlj-port-resume-sync'
$Script   = Join-Path $SyncDir 'repo\scripts\sync-resume-usage.ps1'

# First run seeds the clone, so a failure is seen now rather than on Sunday.
if (-not (Test-Path $Script)) {
    Write-Host 'Seeding the sync clone (first run)...'
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'sync-resume-usage.ps1') -DryRun
    if (-not (Test-Path $Script)) {
        throw "Clone did not appear at $Script - is sync-resume-usage.ps1 pushed to main?"
    }
}

$args_ = "--headless powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$Script`""

$xml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Rewrites the Claude Code line in kimlj.dev's AI resume from assets/claude-usage.json, re-exports the PDF and pushes both.</Description>
    <URI>$TaskName</URI>
  </RegistrationInfo>
  <Triggers>
    <CalendarTrigger>
      <StartBoundary>2026-01-04T22:30:00</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByWeek><DaysOfWeek><Sunday /></DaysOfWeek><WeeksInterval>1</WeeksInterval></ScheduleByWeek>
    </CalendarTrigger>
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
    <ExecutionTimeLimit>PT20M</ExecutionTimeLimit>
    <Priority>7</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>conhost.exe</Command>
      <Arguments>$args_</Arguments>
      <WorkingDirectory>$SyncDir</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
"@

$xmlPath = Join-Path $env:TEMP 'kimlj-resume-sync-task.xml'
[System.IO.File]::WriteAllText($xmlPath, $xml, [System.Text.Encoding]::Unicode)
try {
    $out = & schtasks.exe /Create /TN $TaskName /XML $xmlPath /F 2>&1
    if ($LASTEXITCODE -ne 0) { throw "schtasks failed: $out" }
} finally {
    Remove-Item $xmlPath -ErrorAction SilentlyContinue
}

# Verify rather than announce.
$check = & schtasks.exe /Query /TN $TaskName 2>&1
if ($LASTEXITCODE -ne 0) { throw "Task did not register: $check" }

Write-Host ""
Write-Host "Registered '$TaskName'"
Write-Host "  runs : $Script"
Write-Host "  when : Sundays 22:30 (or at the next logon after a missed one)"
Write-Host "  log  : $(Join-Path $SyncDir 'sync.log')"
Write-Host "Run it now with:  schtasks /Run /TN `"$TaskName`""

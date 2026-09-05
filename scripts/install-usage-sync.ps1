<#
    Registers the scheduled task that keeps the Claude Code half of Build
    Activity current. Run it once, from anywhere:

        powershell -ExecutionPolicy Bypass -File scripts\install-usage-sync.ps1

    It is idempotent - running it again just replaces the task definition.
    To undo:

        Unregister-ScheduledTask -TaskName 'kimlj.dev build activity' -Confirm:$false

    The task runs as the logged-on user with no elevation and no stored
    password, so it only fires while someone is signed in. That is the honest
    trade: these figures come from this machine's own session transcripts, so
    they cannot be more current than the machine is awake. The dateline on the
    page says when they were last taken.

    The task points at the copy of the sync script inside the clone the script
    maintains for itself, NOT at any working tree - a checkout can be on a
    branch where the file does not exist, and that is exactly the kind of thing
    a task nobody watches should not depend on. The clone resets to origin/main
    every run, so the task always runs the released version of the script.
#>

$ErrorActionPreference = 'Stop'

$TaskName = 'kimlj.dev build activity'
$SyncDir  = Join-Path $env:LOCALAPPDATA 'kimlj-port-usage-sync'
$Script   = Join-Path $SyncDir 'repo\scripts\sync-claude-usage.mjs'

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { throw "node is not on PATH - install Node.js first." }

# First run seeds the clone the task will then use. Done here rather than in the
# task, so a failure is seen now by a person rather than in three weeks in a log.
if (-not (Test-Path $Script)) {
    Write-Host "Seeding the sync clone (first run)..."
    $seed = Join-Path $PSScriptRoot 'sync-claude-usage.mjs'
    if (-not (Test-Path $seed)) { throw "Cannot find $seed" }
    & $node $seed --dry-run
    if (-not (Test-Path $Script)) { throw "Clone did not appear at $Script" }
}

$action = New-ScheduledTaskAction -Execute $node -Argument "`"$Script`"" -WorkingDirectory $SyncDir

$triggers = @(
    # Late enough to have the day's work in it. The GitHub half runs at 16:10
    # UTC from a runner; this is 14:00 UTC, so the two are not pushing at once.
    (New-ScheduledTaskTrigger -Daily -At 10:00PM),
    # Catches the days the machine was off at 10pm.
    (New-ScheduledTaskTrigger -AtLogOn)
)

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -DontStopIfGoingOnBatteries `
    -AllowStartIfOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 15) `
    -MultipleInstances IgnoreNew

# Interactive: runs as the signed-in user, needs no password and no elevation.
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $triggers `
    -Settings $settings -Principal $principal `
    -Description 'Refreshes assets/claude-usage.json on kimlj.dev from this machine''s Claude Code transcripts, and pushes it.' | Out-Null

Write-Host ""
Write-Host "Registered '$TaskName'"
Write-Host "  runs   : $node `"$Script`""
Write-Host "  when   : daily 22:00, and at logon if a run was missed"
Write-Host "  log    : $(Join-Path $SyncDir 'sync.log')"
Write-Host ""
Write-Host "Run it now with:  Start-ScheduledTask -TaskName '$TaskName'"
Write-Host "Remove it with :  Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false"

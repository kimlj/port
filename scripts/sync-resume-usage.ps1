<#
    Keep the AI resume's Claude Code line in step with kimlj.dev.

    The site's figure is refreshed daily by sync-claude-usage.mjs (the
    "kimlj.dev build activity" task). The resume carries the same figure as a
    sentence inside a .docx, and it went stale: it said 772 hours for six weeks
    while the site said 898. This rewrites that one sentence from the same
    assets/claude-usage.json the site renders, re-exports the PDF through Word,
    and pushes both files.

        powershell -NoProfile -ExecutionPolicy Bypass -File scripts\sync-resume-usage.ps1
        ... -DryRun     # everything but the push

    Like the usage sync, it works in a clone of its own under LOCALAPPDATA and
    hard-resets it to origin/main every run, so it never touches a checkout
    someone is using. It is a separate clone from the usage sync's, so the two
    tasks can never be inside the same working tree at once.

    Weekly, not daily: each run commits a new .docx and .pdf, and a binary pair
    a day would bloat the repo for a figure nobody reads to the hour.

    Refuses to save if the sentence is missing (someone reworded it) or if the
    replacement pushes the resume onto a second page.

    Register it with scripts\install-resume-sync.ps1.
#>
param([switch]$DryRun)

$ErrorActionPreference = 'Stop'

$Remote = 'https://github.com/kimlj/port'
$Branch = 'main'
$Dir    = Join-Path $env:LOCALAPPDATA 'kimlj-port-resume-sync'
$Repo   = Join-Path $Dir 'repo'
$Log    = Join-Path $Dir 'sync.log'
$Docx   = 'Kim_Julongbayan_Resume_AI.docx'
$Pdf    = 'Kim_Julongbayan_Resume_AI.pdf'

# Word wildcard syntax, not regex: @ is "one or more of the previous".
$Pattern = '[0-9,]@ hours and [0-9,]@ prompts in Claude Code across [0-9]@ projects \([0-9]@ active days, as of [A-Za-z]@ [0-9]@\)'

function Say([string]$msg) {
    $line = '{0}  {1}' -f (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'), $msg
    Write-Host $line
    try {
        New-Item -ItemType Directory -Force -Path $Dir | Out-Null
        Add-Content -Path $Log -Value $line -Encoding utf8
    } catch { }   # the log is a convenience; losing it is not a reason to fail
}

# Windows PowerShell turns every stderr line of a native command into an error
# record, and git reports progress on stderr, so under 'Stop' a successful
# clone or fetch would throw. Judge git by its exit code instead.
function Invoke-Git {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $out = & git.exe @args 2>&1 | ForEach-Object { "$_" }
        $code = $LASTEXITCODE
    } finally { $ErrorActionPreference = $prev }
    if ($code -ne 0) { throw "git $($args -join ' ') exited $code`: $($out -join ' ')" }
    $out
}
function Git { Invoke-Git -C $Repo @args }

$env:GIT_TERMINAL_PROMPT = '0'
$env:GCM_INTERACTIVE = 'never'

try {
    if (-not (Test-Path (Join-Path $Repo '.git'))) {
        Say "cloning $Remote into $Repo"
        New-Item -ItemType Directory -Force -Path $Dir | Out-Null
        Invoke-Git clone -q --depth 50 --branch $Branch $Remote $Repo | Out-Null
    }
    Git fetch --depth 50 origin $Branch | Out-Null
    Git checkout -q $Branch | Out-Null
    Git reset -q --hard "origin/$Branch" | Out-Null

    $usage = Get-Content -Raw (Join-Path $Repo 'assets\claude-usage.json') | ConvertFrom-Json
    $asOf  = [datetime]::Parse($usage.generatedAt, [Globalization.CultureInfo]::InvariantCulture)
    $inv   = [Globalization.CultureInfo]::InvariantCulture
    $new   = '{0} hours and {1} prompts in Claude Code across {2} projects ({3} active days, as of {4})' -f `
        $usage.hours.total.ToString('N0', $inv), $usage.prompts.total.ToString('N0', $inv),
        $usage.prompts.projects, $usage.prompts.activeDays, $asOf.ToString('MMM yyyy', $inv)

    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $changed = $false
    try {
        $doc = $word.Documents.Open((Join-Path $Repo $Docx))
        $range = $doc.Content
        $found = $range.Find.Execute($Pattern, $false, $false, $true)
        if (-not $found) { throw 'the Claude Code sentence is not in the resume - was it reworded? Update $Pattern.' }
        $old = $range.Text
        if ($old -ne $new) {
            $range.Text = $new
            $pages = $doc.ComputeStatistics(2)
            if ($pages -ne 1) { throw "the new figure makes the resume $pages pages; not saving" }
            $doc.Save()
            $doc.ExportAsFixedFormat((Join-Path $Repo $Pdf), 17)
            $changed = $true
        }
        $doc.Close(0)
    } finally {
        $word.Quit()
        [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word)
    }

    if (-not $changed) { Say "no change - resume already says: $new"; exit 0 }

    Git add -- $Docx $Pdf | Out-Null
    Git -c user.name=kimlj -c user.email=kljulongbayan@gmail.com commit -q -m "Refresh the AI resume's Claude Code figures`n`n$new.`nWritten by scripts/sync-resume-usage.ps1 from assets/claude-usage.json." | Out-Null

    if ($DryRun) { Say "dry run - would push: $new"; exit 0 }

    try { Git push -q origin "HEAD:$Branch" | Out-Null }
    catch {
        Say 'push rejected, rebasing on origin and retrying'
        Git pull -q --rebase origin $Branch | Out-Null
        Git push -q origin "HEAD:$Branch" | Out-Null
    }
    Say "pushed: $new"
} catch {
    Say ("FAILED: " + ($_.Exception.Message -split "`n")[0])
    exit 1
}

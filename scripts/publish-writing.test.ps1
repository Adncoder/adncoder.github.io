param([string]$Publisher = (Join-Path $PSScriptRoot 'publish-writing.ps1'))
$ErrorActionPreference = 'Stop'
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('writing-sync-test-' + [guid]::NewGuid())
$source = Join-Path $testRoot 'source'
$repo = Join-Path $testRoot 'repo'
$destination = Join-Path $repo 'content\writing\poetry\Example.md'
$manifest = Join-Path $repo 'scripts\.publish-writing-manifest.json'
New-Item -ItemType Directory -Path (Join-Path $source 'Poetry'), (Split-Path $destination), (Split-Path $manifest) -Force | Out-Null
$encoding = New-Object Text.UTF8Encoding($false)
function Write-Text([string]$Path, [string]$Text) { [IO.File]::WriteAllText($Path, $Text, $encoding) }
function Assert([bool]$Condition, [string]$Message) { if (-not $Condition) { throw $Message } }
$note = "---`r`ntitle: Example`r`ntype: writing`r`npublish: true`r`norigin: private`r`n---`r`n`r`nOriginal poem.`r`n"
$sourceFile = Join-Path $source 'Poetry\Example.md'
Write-Text $sourceFile $note
Write-Text $destination 'Legacy public poem.'
Write-Text $manifest '["content/writing/poetry/Example.md"]'
& $Publisher -SourceRoot $source -RepoRoot $repo
$output = [IO.File]::ReadAllText($destination)
Assert ($output.Contains('Original poem.')) 'Manifest-owned file was not synced.'
Assert (-not $output.Contains('origin: private')) 'Private metadata leaked.'
Write-Output 'PASS: Windows manifest ownership and CRLF source metadata.'

# Empty manifest forces ownership recognition through the CRLF marker.
Write-Text $manifest '[]'
Write-Text $sourceFile $note.Replace('Original poem.', 'Revised poem.')
& $Publisher -SourceRoot $source -RepoRoot $repo
Assert ([IO.File]::ReadAllText($destination).Contains('Revised poem.')) 'CRLF marker was not recognized.'
Write-Output 'PASS: Generated marker permits subsequent updates.'

# Multiple tracked entries must be flattened for removal as well as overwrite.
$retired = Join-Path $repo 'content\writing\poetry\Retired.md'
Write-Text $retired 'Previously exported poem.'
Write-Text $manifest '["content/writing/poetry/Example.md", "content/writing/poetry/Retired.md"]'
& $Publisher -SourceRoot $source -RepoRoot $repo
Assert (-not (Test-Path -LiteralPath $retired)) 'Retired managed file was not removed.'
Write-Text $sourceFile $note.Replace('publish: true', 'publish: false')
& $Publisher -SourceRoot $source -RepoRoot $repo
Assert (-not (Test-Path -LiteralPath $destination)) 'Unpublished managed file remained.'
Write-Output 'PASS: Multiple manifest entries and unpublishing.'

Write-Text $sourceFile $note
Write-Text $destination 'Unmanaged writing must survive.'
$refused = $false
try { & $Publisher -SourceRoot $source -RepoRoot $repo } catch {
    if ($_.Exception.Message -notlike '*Refusing to overwrite an unmanaged website file*') { throw }
    $refused = $true
}
Assert $refused 'Unmanaged destination was not rejected.'
Assert ([IO.File]::ReadAllText($destination) -eq 'Unmanaged writing must survive.') 'Unmanaged file changed.'
Write-Output 'PASS: Unmanaged files remain protected.'
Write-Output ('All writing sync tests passed. Fixtures: ' + $testRoot)

param(
    [string]$SourceRoot = "G:\My Drive\Obsidian Vault\Andrew\Life\Writing",
    [string]$RepoRoot   = "C:\GitHub\Adncoder.github.io"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$DestinationRoot = Join-Path $RepoRoot "content\writing"
$ManifestPath    = Join-Path $RepoRoot "scripts\.publish-writing-manifest.json"

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)


function Write-Utf8NoBom {
    param(
        [string]$Path,
        [string]$Text
    )

    [System.IO.File]::WriteAllText($Path, $Text, $Utf8NoBom)
}


function Get-MarkdownParts {
    param([string]$Text)

    # Require YAML frontmatter at the very beginning of the file.
    $pattern = '\A---[ \t]*\r?\n(?<fm>.*?)(?:\r?\n)---[ \t]*(?:\r?\n|$)'

    $match = [regex]::Match(
        $Text,
        $pattern,
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )

    if (-not $match.Success) {
        return $null
    }

    return [pscustomobject]@{
        Frontmatter = $match.Groups["fm"].Value
        Body        = $Text.Substring($match.Length)
    }
}


function Test-IsPublishableWriting {
    param([string]$Frontmatter)

    $isWriting = [regex]::IsMatch(
        $Frontmatter,
        '(?im)^type:[ \t]*writing[ \t]*$'
    )

    $isPublished = [regex]::IsMatch(
        $Frontmatter,
        '(?im)^publish:[ \t]*true[ \t]*$'
    )

    return ($isWriting -and $isPublished)
}


function Get-PublicFrontmatter {
    param(
        [string]$Frontmatter,
        [string]$FallbackTitle
    )

    # Only these properties are allowed to cross from the
    # private Obsidian vault into the public GitHub repository.
    $AllowedKeys = @(
        "title",
        "description",
        "date",
        "tags",
        "aliases",
        "permalink",
        "cssclasses",
        "publish",
        "type",
        "genre",
        "form",
        "written"
    )

    $lines = [regex]::Split($Frontmatter, '\r?\n')

    $result = New-Object System.Collections.Generic.List[string]

    $keepCurrentBlock = $false
    $sawTitle = $false
    $sawPublish = $false

    foreach ($line in $lines) {

        # Top-level YAML property
        if ($line -match '^([A-Za-z0-9_-]+):') {

            $key = $Matches[1].ToLowerInvariant()

            $keepCurrentBlock = $AllowedKeys -contains $key

            if ($key -eq "title") {
                $sawTitle = $true
            }

            if ($key -eq "publish") {
                $sawPublish = $true
            }
        }

        if ($keepCurrentBlock) {
            $result.Add($line)
        }
    }

    if (-not $sawTitle) {
        $safeTitle = $FallbackTitle.Replace("'", "''")
        $result.Insert(0, "title: '$safeTitle'")
    }

    if (-not $sawPublish) {
        $result.Add("publish: true")
    }

    return ($result -join "`r`n")
}


# ------------------------------------------------------------
# Validate paths
# ------------------------------------------------------------

if (-not (Test-Path $SourceRoot)) {
    throw "Obsidian Writing folder not found: $SourceRoot"
}

if (-not (Test-Path $RepoRoot)) {
    throw "Quartz repository not found: $RepoRoot"
}

if (-not (Test-Path $DestinationRoot)) {
    New-Item -ItemType Directory -Force -Path $DestinationRoot | Out-Null
}


# ------------------------------------------------------------
# Load previous manifest
# ------------------------------------------------------------

$PreviousFiles = @()

if (Test-Path $ManifestPath) {

    $manifestText = [System.IO.File]::ReadAllText($ManifestPath)

    if (-not [string]::IsNullOrWhiteSpace($manifestText)) {
        $PreviousFiles = @(
            ConvertFrom-Json -InputObject $manifestText
        )
    }
}


# ------------------------------------------------------------
# Find publishable writing
# ------------------------------------------------------------

$CurrentFiles = @()

$MarkdownFiles = Get-ChildItem `
    -Path $SourceRoot `
    -Recurse `
    -File `
    -Filter "*.md"


Write-Host ""
Write-Host "Scanning Obsidian writing..." -ForegroundColor Cyan
Write-Host ""


foreach ($file in $MarkdownFiles) {

    $text = [System.IO.File]::ReadAllText($file.FullName)

    $parts = Get-MarkdownParts -Text $text

    if ($null -eq $parts) {
        continue
    }

    if (-not (Test-IsPublishableWriting -Frontmatter $parts.Frontmatter)) {
        continue
    }


    # Relative path inside Writing/
    $relativePath = $file.FullName.Substring($SourceRoot.Length)
    $relativePath = $relativePath.TrimStart([char[]]"\/")

    $relativeDirectory = Split-Path $relativePath -Parent
    $fileName = Split-Path $relativePath -Leaf


    # Convert genre folders to lowercase for cleaner URLs:
    #
    # Poetry/Foo.md  -> writing/poetry/Foo.md
    # Fiction/X.md   -> writing/fiction/X.md

    if (
        [string]::IsNullOrWhiteSpace($relativeDirectory) -or
        $relativeDirectory -eq "."
    ) {
        $publicRelativePath = $fileName
    }
    else {
        $directoryParts = $relativeDirectory -split '[\\/]'

        $lowerDirectory = (
            $directoryParts |
            ForEach-Object { $_.ToLowerInvariant() }
        ) -join "\"

        $publicRelativePath = Join-Path $lowerDirectory $fileName
    }


    $destinationRelative = Join-Path "content\writing" $publicRelativePath
    $destinationPortable = $destinationRelative.Replace("\", "/")
    $destinationFull = Join-Path $RepoRoot $destinationRelative


    # Safety:
    # Never overwrite a manually-created public file unless this script
    # already owns it through the manifest.
    if (
        (Test-Path $destinationFull) -and
        ($PreviousFiles -notcontains $destinationPortable)
    ) {
        throw @"
Refusing to overwrite an unmanaged website file:

$destinationFull

This file already exists but was not created by publish-writing.ps1.
Move/delete it manually if you want the publishing script to own this path.
"@
    }


    $destinationDirectory = Split-Path $destinationFull -Parent

    if (-not (Test-Path $destinationDirectory)) {
        New-Item `
            -ItemType Directory `
            -Force `
            -Path $destinationDirectory |
            Out-Null
    }


    # Strip private-only metadata from the public copy.
    $fallbackTitle = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)

    $publicFrontmatter = Get-PublicFrontmatter `
        -Frontmatter $parts.Frontmatter `
        -FallbackTitle $fallbackTitle


    $body = $parts.Body.TrimStart([char[]]"`r`n")

    $publicText = @"
---
$publicFrontmatter
---

$body
"@


    Write-Utf8NoBom `
        -Path $destinationFull `
        -Text $publicText


    $CurrentFiles += $destinationPortable

    Write-Host "PUBLIC  $relativePath" -ForegroundColor Green


    # Warnings worth manually reviewing.
    if ($parts.Body -match '\[\[') {
        Write-Warning "$relativePath contains Obsidian wikilinks. Check them in the preview."
    }

    if ($parts.Body -match '!\[\[') {
        Write-Warning "$relativePath contains an embedded Obsidian asset. Assets are NOT automatically copied."
    }
}


# ------------------------------------------------------------
# Remove files that USED TO be published
# ------------------------------------------------------------

foreach ($oldFile in $PreviousFiles) {

    if ($CurrentFiles -notcontains $oldFile) {

        $windowsRelative = $oldFile.Replace("/", "\")
        $oldFullPath = Join-Path $RepoRoot $windowsRelative

        if (Test-Path $oldFullPath) {
            Remove-Item $oldFullPath -Force

            Write-Host "REMOVE  $oldFile" -ForegroundColor Yellow
        }
    }
}


# ------------------------------------------------------------
# Write new manifest
# ------------------------------------------------------------

$CurrentFiles = @(
    $CurrentFiles |
    Sort-Object -Unique
)

$manifestJson = ConvertTo-Json -InputObject $CurrentFiles

Write-Utf8NoBom `
    -Path $ManifestPath `
    -Text $manifestJson


# ------------------------------------------------------------
# Summary
# ------------------------------------------------------------

Write-Host ""
Write-Host "Writing sync complete." -ForegroundColor Cyan
Write-Host "Published writing files: $($CurrentFiles.Count)"
Write-Host ""
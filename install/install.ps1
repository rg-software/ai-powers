# Installs ai-powers skills and commands into the global agent directories.
#
# This repo is installed by this script ONLY. Do not also add it with
# `npx skills`: the forked skills keep upstream names, so `npx skills update`
# would re-fetch the upstream copies and clobber ours.
[CmdletBinding()]
param(
    # Where skills are installed. Defaults to the universal agent skills dir,
    # which opencode, Cline, Copilot, Gemini, Codex and others all read.
    [string]$SkillsDir = (Join-Path $HOME ".agents/skills"),
    # Global opencode commands directory.
    [string]$CommandsDir = (Join-Path $HOME ".config/opencode/commands"),
    # Install from a published repo instead of this working copy: "owner/repo".
    [string]$FromGit = "",
    # Ref (branch/tag/SHA) to check out when -FromGit is used. Defaults to the repo default branch.
    [string]$Ref = "",
    # Where a -FromGit checkout is cached.
    [string]$CacheDir = (Join-Path $HOME ".local/share/ai-powers")
)

$ErrorActionPreference = "Stop"

function Resolve-Source {
    if (-not $FromGit) { return (Split-Path -Parent $PSScriptRoot) }

    if (Test-Path (Join-Path $CacheDir ".git")) {
        Write-Host "updating cache: $CacheDir"
        git -C $CacheDir fetch --depth 1 origin | Out-Null
    } else {
        Write-Host "cloning $FromGit -> $CacheDir"
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $CacheDir) | Out-Null
        git clone --depth 1 "https://github.com/$FromGit.git" $CacheDir | Out-Null
    }
    $target = if ($Ref) { $Ref } else { "origin/HEAD" }
    git -C $CacheDir checkout --detach --force $target | Out-Null
    git -C $CacheDir submodule update --init --recursive | Out-Null
    return $CacheDir
}

$root = Resolve-Source
$srcSkills = Join-Path $root "skills"
$srcCommands = Join-Path $root "commands"

if (-not (Test-Path -LiteralPath $srcSkills)) { throw "skills not found at $srcSkills" }
if (-not (Test-Path -LiteralPath $srcCommands)) { throw "commands not found at $srcCommands" }

New-Item -ItemType Directory -Force -Path $SkillsDir, $CommandsDir | Out-Null

# Skills: replace each directory wholesale so removed files do not linger.
$skillCount = 0
foreach ($skill in Get-ChildItem -LiteralPath $srcSkills -Directory) {
    if (-not (Test-Path (Join-Path $skill.FullName "SKILL.md"))) { continue }
    $dest = Join-Path $SkillsDir $skill.Name
    if (Test-Path -LiteralPath $dest) { Remove-Item -LiteralPath $dest -Recurse -Force }
    Copy-Item -LiteralPath $skill.FullName -Destination $dest -Recurse -Force
    Write-Host ("installed skill:   {0}" -f $skill.Name)
    $skillCount++
}

# Commands.
$commandCount = 0
foreach ($file in Get-ChildItem -LiteralPath $srcCommands -Filter *.md -File) {
    Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $CommandsDir $file.Name) -Force
    Write-Host ("installed command: {0}" -f $file.Name)
    $commandCount++
}

Write-Host ""
Write-Host ("skills:   {0} -> {1}" -f $skillCount, $SkillsDir)
Write-Host ("commands: {0} -> {1}" -f $commandCount, $CommandsDir)
Write-Host ""
Write-Host "Restart opencode for changes to take effect."

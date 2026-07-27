param(
  [string]$Release = (Get-Date -Format 'yyyyMMddHHmmss')
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$deployRoot = Join-Path $root '.deploy'
$stageName = "campus-growth-$Release"
$stageRoot = Join-Path $deployRoot $stageName
$archivePath = Join-Path $deployRoot "$stageName.tar.gz"

if ($Release -notmatch '^\d{14}$') {
  throw 'Release must be a 14-digit timestamp.'
}

New-Item -ItemType Directory -Force -Path $deployRoot | Out-Null
if (Test-Path -LiteralPath $stageRoot) {
  $resolvedStage = (Resolve-Path -LiteralPath $stageRoot).Path
  if (-not $resolvedStage.StartsWith($deployRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove stage outside .deploy: $resolvedStage"
  }
  Remove-Item -LiteralPath $resolvedStage -Recurse -Force
}
if (Test-Path -LiteralPath $archivePath) {
  throw "Release archive already exists: $archivePath"
}
New-Item -ItemType Directory -Force -Path $stageRoot | Out-Null

function Copy-ReleasePath([string]$RelativePath) {
  $source = Join-Path $root $RelativePath
  if (-not (Test-Path -LiteralPath $source)) {
    throw "Required release path is missing: $RelativePath"
  }
  $destination = Join-Path $stageRoot $RelativePath
  New-Item -ItemType Directory -Force -Path (Split-Path $destination -Parent) | Out-Null
  Copy-Item -LiteralPath $source -Destination $destination -Recurse -Force
}

foreach ($path in @('package.json', 'package-lock.json', 'tsconfig.json', 'frontend/dist')) {
  Copy-ReleasePath $path
}

Get-ChildItem -LiteralPath (Join-Path $root 'server') -File | Where-Object {
  $_.Extension -in @('.ts', '.json') -and $_.Name -notmatch '^\.'
} | ForEach-Object {
  Copy-ReleasePath (Join-Path 'server' $_.Name)
}

Copy-ReleasePath 'frontend/src/data/mock.ts'
Copy-ReleasePath 'frontend/src/data/team-templates.ts'
Copy-ReleasePath 'frontend/src/types'
Copy-ReleasePath 'frontend/src/app/lib/admin-types.ts'
Copy-ReleasePath 'scripts/enrich-official-content.ts'
Copy-ReleasePath 'scripts/configure-team-showcase.ts'
Copy-ReleasePath 'scripts/sync-official-competition-sources.ts'
Copy-ReleasePath 'scripts/sync-competition-news.ts'
Copy-ReleasePath 'scripts/data'
Copy-ReleasePath 'content/resources'

tar -czf $archivePath -C $deployRoot $stageName
if ($LASTEXITCODE -ne 0) {
  throw "tar failed with exit code $LASTEXITCODE"
}

$entries = @(tar -tzf $archivePath)
if ($LASTEXITCODE -ne 0 -or $entries.Count -lt 20) {
  throw 'Release archive verification failed.'
}
$sensitiveEntries = @($entries | Where-Object {
  $_ -match '(^|/)(\.env($|\.)|[^/]*\.(pem|key|p12|sqlite|db)$)' -or $_ -match 'school_ssh'
})
if ($sensitiveEntries.Count -gt 0) {
  throw "Sensitive entries found in release archive: $($sensitiveEntries -join ', ')"
}

$hash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash
$size = (Get-Item -LiteralPath $archivePath).Length

$resolvedStage = (Resolve-Path -LiteralPath $stageRoot).Path
if (-not $resolvedStage.StartsWith($deployRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to remove stage outside .deploy: $resolvedStage"
}
Remove-Item -LiteralPath $resolvedStage -Recurse -Force

[pscustomobject]@{
  release = $Release
  archive = $archivePath
  bytes = $size
  entries = $entries.Count
  sensitiveEntries = $sensitiveEntries.Count
  sha256 = $hash
} | ConvertTo-Json

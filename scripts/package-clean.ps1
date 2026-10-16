$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$artifactDirectory = Join-Path $projectRoot 'artifacts'
$archivePath = Join-Path $artifactDirectory 'optical-crm-clean.zip'
New-Item -ItemType Directory -Path $artifactDirectory -Force | Out-Null

# Package current source, including new files, rather than the previous commit.
# Explicit exclusions also protect against accidentally tracked local files.
$files = & rtk proxy git -C $projectRoot ls-files --cached --others --exclude-standard
if ($LASTEXITCODE -ne 0) { throw 'Could not list project source files.' }
$sourceFiles = @($files | Sort-Object -Unique | Where-Object {
    ($_ -match '^(client/|server/|scripts/|docs/|README\.md$|\.gitignore$|\.gitattributes$|package(?:-lock)?\.json$|\.editorconfig$|\.prettierignore$|\.prettierrc\.json$)') -and
    ($_ -notmatch '(^|/)(node_modules|dist|generated|\.agents|\.claude|\.windsurf|\.git)(/|$)') -and
    ($_ -notmatch '(^|/)\.env($|\.(?!example$))') -and
    ($_ -notmatch '(\.bak|\.log|\.tsbuildinfo|skills-lock\.json)$') -and
    (Test-Path -LiteralPath (Join-Path $projectRoot $_) -PathType Leaf)
})

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$stream = [IO.File]::Open($archivePath, [IO.FileMode]::Create)
$zip = New-Object IO.Compression.ZipArchive($stream, [IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($relativePath in $sourceFiles) {
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $zip, (Join-Path $projectRoot $relativePath), $relativePath,
            [IO.Compression.CompressionLevel]::Optimal
        ) | Out-Null
    }
} finally {
    $zip.Dispose()
    $stream.Dispose()
}
Write-Output "Created $archivePath ($($sourceFiles.Count) source files)."

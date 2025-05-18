# Migration Verification Script (Simple Version)
# This script checks the status of the repository restructuring

# Base directory
$baseDir = "d:\Cam-Protocol\Old Cam\CAM-PROTOCOL"

Write-Host "CAM Protocol Migration Verification" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Define key directories to check
$dirs = @(
    "core\src\routing",
    "core\src\providers",
    "core\src\caching",
    "core\src\observability",
    "core\src\authentication",
    "core\src\config",
    "professional\src",
    "enterprise\src",
    "documentation\protocol",
    "documentation\architecture",
    "documentation\guides",
    "documentation\api-reference",
    "sdk\javascript",
    "sdk\python",
    "examples"
)

# Check directories
Write-Host "Checking directories..." -ForegroundColor Yellow
$dirExists = 0
foreach ($dir in $dirs) {
    $fullPath = Join-Path -Path $baseDir -ChildPath $dir
    $exists = Test-Path -Path $fullPath -PathType Container
    
    if ($exists) {
        Write-Host "$dir : ✅" -ForegroundColor Green
        $dirExists++
    } else {
        Write-Host "$dir : ❌" -ForegroundColor Red
    }
}

# Define key files to check
$files = @(
    "core\src\routing\scheduler.py",
    "core\src\authentication\licensing.py",
    "core\src\providers\app.py",
    "documentation\protocol\protocol_overview.md",
    "documentation\architecture\architecture_overview.md",
    "documentation\guides\quickstart.md",
    "documentation\api-reference\api_reference.md",
    "sdk\javascript\index.js",
    "sdk\python\cam_sdk.py",
    "sdk\python\__init__.py",
    "MIGRATION_STATUS.md",
    "GITHUB_STRUCTURE_GUIDE.md",
    "CONTRIBUTING.md",
    "CHANGELOG.md"
)

# Check files
Write-Host "`nChecking files..." -ForegroundColor Yellow
$fileExists = 0
foreach ($file in $files) {
    $fullPath = Join-Path -Path $baseDir -ChildPath $file
    $exists = Test-Path -Path $fullPath -PathType Leaf
    
    if ($exists) {
        Write-Host "$file : ✅" -ForegroundColor Green
        $fileExists++
    } else {
        Write-Host "$file : ❌" -ForegroundColor Red
    }
}

# Show results
Write-Host "`nResults:" -ForegroundColor Cyan
Write-Host "--------" -ForegroundColor Cyan
Write-Host "Directories: $dirExists / $($dirs.Count) ($(($dirExists / $dirs.Count).ToString("P0")))"
Write-Host "Files: $fileExists / $($files.Count) ($(($fileExists / $files.Count).ToString("P0")))"

$totalItems = $dirs.Count + $files.Count
$existingItems = $dirExists + $fileExists
$percentComplete = [math]::Round(($existingItems / $totalItems) * 100)

Write-Host "`nMigration Progress: $percentComplete%" -ForegroundColor Magenta

# Show next steps
Write-Host "`nNext Steps:" -ForegroundColor Yellow
Write-Host "1. Complete any missing components"
Write-Host "2. Update and test all code references"
Write-Host "3. Run full test suite"
Write-Host "4. Update CI/CD pipelines"
Write-Host "5. Push changes to GitHub"

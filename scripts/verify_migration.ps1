# CAM Protocol Migration Verification Script
# This PowerShell script checks the status of the migration from the old structure to the new structure

# Color definitions
$Green = @{ ForegroundColor = 'Green' }
$Yellow = @{ ForegroundColor = 'Yellow' }
$Red = @{ ForegroundColor = 'Red' }

Write-Host "CAM Protocol Migration Verification" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Define the base directories
$OldRepo = "d:\Cam-Protocol\Old Cam\CAM-PROTOCOL"
$NewStructureRepo = $OldRepo

# Check if directory exists
function Check-Directory {
    param (
        [string]$Directory
    )
    
    if (Test-Path -Path "$NewStructureRepo\$Directory" -PathType Container) {
        Write-Host "✓" -NoNewline @Green
        Write-Host " Directory $Directory exists"
        return $true
    } else {
        Write-Host "✗" -NoNewline @Red
        Write-Host " Directory $Directory does not exist"
        return $false
    }
}

# Check if file exists
function Check-File {
    param (
        [string]$File
    )
    
    if (Test-Path -Path "$NewStructureRepo\$File" -PathType Leaf) {
        Write-Host "✓" -NoNewline @Green
        Write-Host " File $File exists"
        return $true
    } else {
        Write-Host "✗" -NoNewline @Red
        Write-Host " File $File does not exist"
        return $false
    }
}

# Print section header
function Print-Section {
    param (
        [string]$Title
    )
    
    Write-Host ""
    Write-Host "## $Title" -ForegroundColor Cyan
    Write-Host "------------------------" -ForegroundColor Cyan
}

# Directory Checks
Print-Section "Checking Core Directory Structure"
$directories = @(
    "core\src\routing",
    "core\src\providers",
    "core\src\caching",
    "core\src\observability",
    "core\src\authentication",
    "core\src\config",
    "professional\src\semantic-caching",
    "professional\src\request-transformation",
    "enterprise\src\cognitive-fingerprinting",
    "enterprise\src\arbitration",
    "enterprise\src\policy-evolution",
    "documentation\protocol",
    "documentation\architecture",
    "documentation\guides",
    "documentation\api-reference",
    "examples"
)

$successCount = 0
$totalDirs = $directories.Count

foreach ($dir in $directories) {
    if (Check-Directory $dir) {
        $successCount++
    }
}

Write-Host ""
Write-Host "Directory structure check: $successCount/$totalDirs directories exist" -ForegroundColor Cyan

# File Checks
Print-Section "Checking Core Files"
$files = @(
    "core\src\routing\scheduler.py",
    "core\src\authentication\licensing.py",
    "core\src\providers\app.py",
    "core\src\providers\client.py",
    "documentation\protocol\protocol_overview.md",
    "documentation\architecture\architecture_overview.md",
    "documentation\guides\quickstart.md",
    "documentation\guides\monitoring.md",
    "documentation\guides\policies.md",
    "documentation\guides\faq.md",
    "documentation\api-reference\api_reference.md",
    "examples\provider_integration.md",
    "GITHUB_STRUCTURE_GUIDE.md",
    "REPOSITORY_RESTRUCTURING.md",
    "MIGRATION_STATUS.md",
    "README.md"
)

$fileSuccessCount = 0
$totalFiles = $files.Count

foreach ($file in $files) {
    if (Check-File $file) {
        $fileSuccessCount++
    }
}

Write-Host ""
Write-Host "File check: $fileSuccessCount/$totalFiles files exist" -ForegroundColor Cyan

# GitHub Actions Check
Print-Section "Checking GitHub Actions"
if (Test-Path -Path "$NewStructureRepo\.github\workflows" -PathType Container) {
    Write-Host "✓" -NoNewline @Green
    Write-Host " GitHub Actions workflows directory exists"
    $workflowCount = (Get-ChildItem -Path "$NewStructureRepo\.github\workflows" -Filter "*.yml").Count
    Write-Host "✓" -NoNewline @Green
    Write-Host " Found $workflowCount workflow files"
} else {
    Write-Host "✗" -NoNewline @Red
    Write-Host " GitHub Actions workflows directory does not exist"
}

# Documentation Check
Print-Section "Checking Documentation Completeness"
$docTypes = @("protocol", "architecture", "guides", "api-reference")
$totalDocs = 0
$existingDocs = 0

foreach ($docType in $docTypes) {
    $fileCount = (Get-ChildItem -Path "$NewStructureRepo\documentation\$docType" -File).Count
    $totalDocs++
    if ($fileCount -gt 0) {
        $existingDocs++
        Write-Host "✓" -NoNewline @Green
        Write-Host " Found $fileCount files in documentation\$docType"
    } else {
        Write-Host "!" -NoNewline @Yellow
        Write-Host " No files found in documentation\$docType"
    }
}

Write-Host ""
Write-Host "Documentation check: $existingDocs/$totalDocs documentation sections have files" -ForegroundColor Cyan

# Overall Status
Print-Section "Overall Migration Status"
$dirPercent = [math]::Round(($successCount * 100 / $totalDirs))
$filePercent = [math]::Round(($fileSuccessCount * 100 / $totalFiles))
$docPercent = [math]::Round(($existingDocs * 100 / $totalDocs))

$overallPercent = [math]::Round((($dirPercent + $filePercent + $docPercent) / 3))

Write-Host "Directory structure: $dirPercent% complete" -ForegroundColor $(if ($dirPercent -eq 100) { "Green" } elseif ($dirPercent -ge 80) { "Yellow" } else { "Red" })
Write-Host "Core files: $filePercent% complete" -ForegroundColor $(if ($filePercent -eq 100) { "Green" } elseif ($filePercent -ge 80) { "Yellow" } else { "Red" })
Write-Host "Documentation: $docPercent% complete" -ForegroundColor $(if ($docPercent -eq 100) { "Green" } elseif ($docPercent -ge 80) { "Yellow" } else { "Red" })
Write-Host ""
Write-Host "Overall migration status: $overallPercent% complete" -ForegroundColor $(if ($overallPercent -eq 100) { "Green" } elseif ($overallPercent -ge 80) { "Yellow" } else { "Red" })

# Next steps
Print-Section "Next Steps"
Write-Host "1. Complete remaining migrations in MIGRATION_STATUS.md"
Write-Host "2. Update imports and fix code references"
Write-Host "3. Run tests to verify functionality"
Write-Host "4. Push changes to GitHub"

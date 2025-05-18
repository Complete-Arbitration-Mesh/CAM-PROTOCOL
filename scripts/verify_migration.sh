# CAM Protocol Migration Verification Script
# This script checks the status of the migration from the old structure to the new structure

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "CAM Protocol Migration Verification"
echo "=================================="
echo ""

# Define the base directories
OLD_REPO="d:/Cam-Protocol/Old Cam/CAM-PROTOCOL"
NEW_STRUCTURE_REPO="$OLD_REPO"

# Check if core directories exist
check_directory() {
    local dir="$1"
    if [ -d "$NEW_STRUCTURE_REPO/$dir" ]; then
        echo -e "${GREEN}✓${NC} Directory $dir exists"
        return 0
    else
        echo -e "${RED}✗${NC} Directory $dir does not exist"
        return 1
    fi
}

# Check if a file exists
check_file() {
    local file="$1"
    if [ -f "$NEW_STRUCTURE_REPO/$file" ]; then
        echo -e "${GREEN}✓${NC} File $file exists"
        return 0
    else
        echo -e "${RED}✗${NC} File $file does not exist"
        return 1
    fi
}

# Print section header
print_section() {
    echo ""
    echo "## $1"
    echo "------------------------"
}

# Directory Checks
print_section "Checking Core Directory Structure"
directories=(
    "core/src/routing"
    "core/src/providers"
    "core/src/caching"
    "core/src/observability"
    "core/src/authentication"
    "core/src/config"
    "professional/src/semantic-caching"
    "professional/src/request-transformation"
    "enterprise/src/cognitive-fingerprinting"
    "enterprise/src/arbitration"
    "enterprise/src/policy-evolution"
    "documentation/protocol"
    "documentation/architecture"
    "documentation/guides"
    "documentation/api-reference"
    "examples"
)

success_count=0
total_dirs=${#directories[@]}

for dir in "${directories[@]}"; do
    if check_directory "$dir"; then
        ((success_count++))
    fi
done

echo ""
echo -e "Directory structure check: ${success_count}/${total_dirs} directories exist"

# File Checks
print_section "Checking Core Files"
files=(
    "core/src/routing/scheduler.py"
    "core/src/authentication/licensing.py"
    "core/src/providers/app.py"
    "core/src/providers/client.py"
    "documentation/protocol/protocol_overview.md"
    "documentation/architecture/architecture_overview.md"
    "documentation/guides/quickstart.md"
    "documentation/guides/monitoring.md"
    "documentation/guides/policies.md"
    "documentation/guides/faq.md"
    "documentation/api-reference/api_reference.md"
    "examples/provider_integration.md"
    "GITHUB_STRUCTURE_GUIDE.md"
    "REPOSITORY_RESTRUCTURING.md"
    "MIGRATION_STATUS.md"
    "README.md"
)

file_success_count=0
total_files=${#files[@]}

for file in "${files[@]}"; do
    if check_file "$file"; then
        ((file_success_count++))
    fi
done

echo ""
echo -e "File check: ${file_success_count}/${total_files} files exist"

# GitHub Actions Check
print_section "Checking GitHub Actions"
if [ -d "$NEW_STRUCTURE_REPO/.github/workflows" ]; then
    echo -e "${GREEN}✓${NC} GitHub Actions workflows directory exists"
    workflow_count=$(find "$NEW_STRUCTURE_REPO/.github/workflows" -name "*.yml" | wc -l)
    echo -e "${GREEN}✓${NC} Found $workflow_count workflow files"
else
    echo -e "${RED}✗${NC} GitHub Actions workflows directory does not exist"
fi

# Documentation Check
print_section "Checking Documentation Completeness"
doc_types=("protocol" "architecture" "guides" "api-reference")
total_docs=0
existing_docs=0

for doc_type in "${doc_types[@]}"; do
    file_count=$(find "$NEW_STRUCTURE_REPO/documentation/$doc_type" -type f | wc -l)
    total_docs=$((total_docs + 1))
    if [ $file_count -gt 0 ]; then
        existing_docs=$((existing_docs + 1))
        echo -e "${GREEN}✓${NC} Found $file_count files in documentation/$doc_type"
    else
        echo -e "${YELLOW}!${NC} No files found in documentation/$doc_type"
    fi
done

echo ""
echo -e "Documentation check: ${existing_docs}/${total_docs} documentation sections have files"

# Overall Status
print_section "Overall Migration Status"
dir_percent=$((success_count * 100 / total_dirs))
file_percent=$((file_success_count * 100 / total_files))
doc_percent=$((existing_docs * 100 / total_docs))

overall_percent=$(( (dir_percent + file_percent + doc_percent) / 3 ))

echo "Directory structure: $dir_percent% complete"
echo "Core files: $file_percent% complete"
echo "Documentation: $doc_percent% complete"
echo ""
echo "Overall migration status: $overall_percent% complete"

# Next steps
print_section "Next Steps"
echo "1. Complete remaining migrations in MIGRATION_STATUS.md"
echo "2. Update imports and fix code references"
echo "3. Run tests to verify functionality"
echo "4. Push changes to GitHub"

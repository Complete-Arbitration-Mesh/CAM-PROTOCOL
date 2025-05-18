#!/usr/bin/env python3
"""
Import Verification Script

This script verifies that imports in migrated files have been properly updated
to reflect the new directory structure.
"""

import os
import re
import sys
from pathlib import Path
from typing import List, Dict, Tuple

# Define old and new import patterns
OLD_IMPORT_PATTERNS = [
    r"from src\.core",
    r"from src\.client",
    r"from src\.server",
    r"import src\.core",
    r"import src\.client",
    r"import src\.server"
]

NEW_IMPORT_PATTERNS = {
    r"from src\.core": r"from core.src",
    r"from src\.client": r"from core.src.providers",
    r"from src\.server": r"from core.src.providers",
    r"import src\.core": r"import core.src",
    r"import src\.client": r"import core.src.providers",
    r"import src\.server": r"import core.src.providers"
}

def find_py_files(dir_path: str) -> List[str]:
    """Find all Python files in the given directory and its subdirectories."""
    py_files = []
    for root, _, files in os.walk(dir_path):
        for file in files:
            if file.endswith(".py"):
                py_files.append(os.path.join(root, file))
    return py_files

def check_imports(file_path: str) -> Tuple[bool, List[str]]:
    """Check if a file contains old import patterns."""
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    issues = []
    has_issues = False
    
    for pattern in OLD_IMPORT_PATTERNS:
        if re.search(pattern, content):
            has_issues = True
            issues.append(f"Found old import pattern: {pattern}")
            
    return has_issues, issues

def fix_imports(file_path: str) -> Tuple[bool, int]:
    """Fix old import patterns in a file."""
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    fixed = False
    replacements = 0
    
    for old_pattern, new_pattern in NEW_IMPORT_PATTERNS.items():
        new_content = re.sub(old_pattern, new_pattern, content)
        if new_content != content:
            content = new_content
            fixed = True
            replacements += 1
            
    if fixed:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
            
    return fixed, replacements

def main():
    """Main function."""
    if len(sys.argv) > 1 and sys.argv[1] == "--fix":
        fix_mode = True
        print("Running in fix mode - will automatically update old imports")
    else:
        fix_mode = False
        print("Running in check mode - use --fix to automatically update imports")
    
    dirs_to_check = ["core", "professional", "enterprise", "sdk", "tests", "examples"]
    
    issues_found = False
    files_checked = 0
    files_with_issues = 0
    files_fixed = 0
    total_replacements = 0
    
    for dir_name in dirs_to_check:
        if not os.path.isdir(dir_name):
            print(f"Warning: Directory {dir_name} not found, skipping")
            continue
            
        print(f"\nChecking {dir_name}:")
        py_files = find_py_files(dir_name)
        
        for file_path in py_files:
            files_checked += 1
            has_issues, issues = check_imports(file_path)
            
            if has_issues:
                files_with_issues += 1
                issues_found = True
                
                rel_path = os.path.relpath(file_path)
                print(f"  ❌ {rel_path}")
                for issue in issues:
                    print(f"     - {issue}")
                
                if fix_mode:
                    fixed, replacements = fix_imports(file_path)
                    if fixed:
                        files_fixed += 1
                        total_replacements += replacements
                        print(f"     ✅ Fixed ({replacements} replacements)")
            else:
                rel_path = os.path.relpath(file_path)
                print(f"  ✓ {rel_path}")
    
    print("\nSummary:")
    print(f"Files checked: {files_checked}")
    print(f"Files with issues: {files_with_issues}")
    
    if fix_mode:
        print(f"Files fixed: {files_fixed}")
        print(f"Total replacements made: {total_replacements}")
    
    if issues_found and not fix_mode:
        print("\nRun with --fix to automatically update imports")
        sys.exit(1)
    elif issues_found and fix_mode:
        print("\nImports have been updated. Please test the changes.")
    else:
        print("\nNo import issues found. All good!")

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Example Update Script

This script updates example files to use the new SDK structure.
It also ensures consistency across example files.
"""

import os
import re
import sys
import json
from pathlib import Path
from typing import List, Dict, Tuple, Set

# Define SDK import patterns to update
OLD_SDK_PATTERNS = {
    "javascript": {
        r"import \{ CAM \} from ['\"](.*\/src\/client)['\"]": r"import { CAMClient } from 'cam-protocol'",
        r"import \* as cam from ['\"](.*\/src\/client)['\"]": r"import * as cam from 'cam-protocol'",
        r"const CAM = require\(['\"](.*\/src\/client)['\"]": r"const { CAMClient } = require('cam-protocol')",
    },
    "python": {
        r"from src\.client import CAM": r"from cam_sdk import CAMClient",
        r"from src\.client\.cam import CAM": r"from cam_sdk import CAMClient",
        r"import src\.client\.cam as cam": r"import cam_sdk",
    }
}

# Define new SDK usage patterns to replace old usage
OLD_SDK_USAGE = {
    "javascript": {
        r"new CAM\(": r"new CAMClient(",
        r"CAM\.createClient\(": r"new CAMClient(",
    },
    "python": {
        r"CAM\(": r"CAMClient(",
        r"cam\.CAM\(": r"cam_sdk.CAMClient(",
    }
}

def find_example_files(base_path: str) -> Dict[str, List[str]]:
    """Find all example files in the repository by language."""
    example_files = {
        "javascript": [],
        "python": [],
        "other": []
    }
    
    for root, _, files in os.walk(os.path.join(base_path, "examples")):
        for file in files:
            file_path = os.path.join(root, file)
            if file.endswith(".js"):
                example_files["javascript"].append(file_path)
            elif file.endswith(".py"):
                example_files["python"].append(file_path)
            elif file.endswith(".md") or file.endswith(".txt"):
                # Skip documentation and text files
                continue
            else:
                example_files["other"].append(file_path)
                
    return example_files

def update_example_file(file_path: str, language: str) -> Tuple[bool, int]:
    """Update a single example file to use the new SDK structure."""
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    original_content = content
    replacements = 0
    
    # Update imports
    if language in OLD_SDK_PATTERNS:
        for pattern, replacement in OLD_SDK_PATTERNS[language].items():
            updated_content = re.sub(pattern, replacement, content)
            if updated_content != content:
                replacements += 1
                content = updated_content
    
    # Update SDK usage
    if language in OLD_SDK_USAGE:
        for pattern, replacement in OLD_SDK_USAGE[language].items():
            updated_content = re.sub(pattern, replacement, content)
            if updated_content != content:
                replacements += 1
                content = updated_content
    
    # Handle JavaScript and TypeScript-specific changes
    if language == "javascript":
        # Update configuration to match new SDK structure
        updated_content = re.sub(
            r"(\w+)\.configure\(\{([^}]*)\}\)",
            r"\1 = new CAMClient({\2})",
            content
        )
        if updated_content != content:
            replacements += 1
            content = updated_content
    
    # Handle Python-specific changes
    if language == "python":
        # Update configuration to match new SDK structure
        updated_content = re.sub(
            r"(\w+)\.configure\(\{([^}]*)\}\)",
            r"\1 = CAMClient({\2})",
            content
        )
        if updated_content != content:
            replacements += 1
            content = updated_content
    
    if content != original_content:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
            
    return content != original_content, replacements

def main():
    """Main function."""
    if len(sys.argv) > 1 and sys.argv[1] == "--apply":
        apply_changes = True
        print("Running in apply mode - will update example files")
    else:
        apply_changes = False
        print("Running in check mode - use --apply to update example files")
    
    repo_path = os.getcwd()
    example_files = find_example_files(repo_path)
    
    total_files = sum(len(files) for files in example_files.values())
    print(f"Found {total_files} example files to analyze")
    
    files_with_issues = 0
    files_updated = 0
    total_replacements = 0
    
    # Process JavaScript examples
    if example_files["javascript"]:
        print(f"\nChecking {len(example_files['javascript'])} JavaScript examples:")
        for file_path in example_files["javascript"]:
            rel_path = os.path.relpath(file_path, repo_path)
            
            if apply_changes:
                updated, replacements = update_example_file(file_path, "javascript")
                if updated:
                    files_updated += 1
                    total_replacements += replacements
                    print(f"  ✅ Updated: {rel_path} ({replacements} replacements)")
                else:
                    print(f"  ✓ No changes needed: {rel_path}")
            else:
                # Just check without applying changes
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
                
                needs_update = False
                for pattern in OLD_SDK_PATTERNS["javascript"].keys():
                    if re.search(pattern, content):
                        needs_update = True
                        break
                
                if not needs_update:
                    for pattern in OLD_SDK_USAGE["javascript"].keys():
                        if re.search(pattern, content):
                            needs_update = True
                            break
                
                if needs_update:
                    files_with_issues += 1
                    print(f"  ❌ Needs update: {rel_path}")
                else:
                    print(f"  ✓ No changes needed: {rel_path}")
    
    # Process Python examples
    if example_files["python"]:
        print(f"\nChecking {len(example_files['python'])} Python examples:")
        for file_path in example_files["python"]:
            rel_path = os.path.relpath(file_path, repo_path)
            
            if apply_changes:
                updated, replacements = update_example_file(file_path, "python")
                if updated:
                    files_updated += 1
                    total_replacements += replacements
                    print(f"  ✅ Updated: {rel_path} ({replacements} replacements)")
                else:
                    print(f"  ✓ No changes needed: {rel_path}")
            else:
                # Just check without applying changes
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
                
                needs_update = False
                for pattern in OLD_SDK_PATTERNS["python"].keys():
                    if re.search(pattern, content):
                        needs_update = True
                        break
                
                if not needs_update:
                    for pattern in OLD_SDK_USAGE["python"].keys():
                        if re.search(pattern, content):
                            needs_update = True
                            break
                
                if needs_update:
                    files_with_issues += 1
                    print(f"  ❌ Needs update: {rel_path}")
                else:
                    print(f"  ✓ No changes needed: {rel_path}")
    
    # Process other examples
    if example_files["other"]:
        print(f"\nFound {len(example_files['other'])} other example files (not processed automatically):")
        for file_path in example_files["other"]:
            rel_path = os.path.relpath(file_path, repo_path)
            print(f"  ⚠️ Manual review required: {rel_path}")
    
    print("\nSummary:")
    if apply_changes:
        print(f"Files updated: {files_updated}")
        print(f"Total replacements made: {total_replacements}")
    else:
        print(f"Files needing updates: {files_with_issues}")
        print(f"Run with --apply to perform these updates")

if __name__ == "__main__":
    main()

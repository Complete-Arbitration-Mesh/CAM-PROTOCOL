#!/usr/bin/env python3
"""
Test Update Script

This script updates test files to work with the new repository structure.
It fixes imports, test paths, and fixture references.
"""

import os
import re
import sys
import shutil
from pathlib import Path
from typing import List, Dict, Tuple, Set

# Define import mapping patterns
IMPORT_MAPPING = {
    r"from src\.core\.scheduler import (.+)": r"from core.src.routing import \1",
    r"from src\.core\.licensing import (.+)": r"from core.src.authentication import \1",
    r"from src\.client\.(.+) import (.+)": r"from core.src.providers.\1 import \2",
    r"from src\.server\.(.+) import (.+)": r"from core.src.providers.\1 import \2",
    r"from src\.core\.(.+) import (.+)": r"from core.src.\1 import \2",
    r"import src\.core\.scheduler": r"import core.src.routing",
    r"import src\.core\.licensing": r"import core.src.authentication",
    r"import src\.client\.(.+)": r"import core.src.providers.\1",
    r"import src\.server\.(.+)": r"import core.src.providers.\1",
    r"import src\.core\.(.+)": r"import core.src.\1"
}

# Define test path mappings
TEST_PATH_MAPPING = {
    "tests/unit/core": "core/test/unit",
    "tests/integration/core": "core/test/integration",
    "tests/e2e/core": "core/test/e2e",
    "tests/unit/professional": "professional/test/unit",
    "tests/integration/professional": "professional/test/integration",
    "tests/e2e/professional": "professional/test/e2e", 
    "tests/unit/enterprise": "enterprise/test/unit",
    "tests/integration/enterprise": "enterprise/test/integration",
    "tests/e2e/enterprise": "enterprise/test/e2e"
}

def find_test_files(base_path: str) -> List[str]:
    """Find all test files in the repository."""
    test_files = []
    for root, _, files in os.walk(base_path):
        for file in files:
            if (file.startswith("test_") and file.endswith(".py")) or \
               (file.endswith("_test.py")):
                test_files.append(os.path.join(root, file))
    return test_files

def update_imports(file_path: str) -> int:
    """Update imports in a test file to reflect new structure."""
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    original_content = content
    replacements = 0
    
    for pattern, replacement in IMPORT_MAPPING.items():
        updated_content = re.sub(pattern, replacement, content)
        if updated_content != content:
            replacements += 1
            content = updated_content
    
    if content != original_content:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
    
    return replacements

def should_move_file(file_path: str) -> Tuple[bool, str]:
    """Determine if a file should be moved and to where."""
    for old_path_prefix, new_path_prefix in TEST_PATH_MAPPING.items():
        if old_path_prefix in file_path:
            rel_path = file_path.split(old_path_prefix)[1]
            new_path = os.path.join(new_path_prefix, rel_path.lstrip("/\\"))
            return True, new_path
    return False, ""

def update_fixture_references(file_path: str) -> int:
    """Update fixture references in test files."""
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    original_content = content
    replacements = 0
    
    # Update fixture paths that reference 'tests/'
    fixture_patterns = [
        (r"os\.path\.join\(['\"](tests\/[^'\"]+)['\"]", r"os.path.join('core/test/\1"),
        (r"['\"](tests\/fixtures\/[^'\"]+)['\"]", r"'core/test/fixtures/\1'"),
        (r"['\"](\.\.\/tests\/fixtures\/[^'\"]+)['\"]", r"'../core/test/fixtures/\1'")
    ]
    
    for pattern, replacement in fixture_patterns:
        updated_content = re.sub(pattern, replacement, content)
        if updated_content != content:
            replacements += 1
            content = updated_content
    
    if content != original_content:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
    
    return replacements

def main():
    """Main function."""
    if len(sys.argv) > 1 and sys.argv[1] == "--apply":
        apply_changes = True
        print("Running in apply mode - will update test files")
    else:
        apply_changes = False
        print("Running in check mode - use --apply to update test files")
    
    repo_path = os.getcwd()
    test_files = find_test_files(repo_path)
    
    print(f"Found {len(test_files)} test files to analyze")
    
    moved_files = 0
    updated_files = 0
    updated_imports = 0
    updated_fixtures = 0
    files_to_move = {}
    
    for file_path in test_files:
        should_move, new_path = should_move_file(file_path)
        
        if should_move:
            rel_path = os.path.relpath(file_path, repo_path)
            new_rel_path = os.path.relpath(new_path, repo_path)
            
            if apply_changes:
                # Create directory if it doesn't exist
                os.makedirs(os.path.dirname(new_path), exist_ok=True)
                
                # Handle imports first so we're updating the content before moving
                import_changes = update_imports(file_path)
                fixture_changes = update_fixture_references(file_path)
                
                if import_changes > 0 or fixture_changes > 0:
                    updated_files += 1
                    updated_imports += import_changes
                    updated_fixtures += fixture_changes
                
                # Move the file
                shutil.move(file_path, new_path)
                moved_files += 1
                
                print(f"✅ Moved and updated: {rel_path} -> {new_rel_path}")
            else:
                files_to_move[rel_path] = new_rel_path
                print(f"Would move: {rel_path} -> {new_rel_path}")
        elif apply_changes:
            # If not moving but still updating
            import_changes = update_imports(file_path)
            fixture_changes = update_fixture_references(file_path)
            
            if import_changes > 0 or fixture_changes > 0:
                updated_files += 1
                updated_imports += import_changes
                updated_fixtures += fixture_changes
                
                rel_path = os.path.relpath(file_path, repo_path)
                print(f"✅ Updated: {rel_path}")
    
    print("\nSummary:")
    if apply_changes:
        print(f"Files moved: {moved_files}")
        print(f"Files updated: {updated_files}")
        print(f"Import updates made: {updated_imports}")
        print(f"Fixture reference updates made: {updated_fixtures}")
    else:
        print(f"Files that would be moved: {len(files_to_move)}")
        print(f"Run with --apply to perform these updates")
        
        # Create a manifest file
        if files_to_move:
            manifest = {
                "files_to_move": files_to_move,
                "explanation": "These test files need to be moved to match the new repository structure"
            }
            
            with open("test_migration_manifest.json", "w") as f:
                import json
                json.dump(manifest, f, indent=2)
                
            print("Created test_migration_manifest.json with details")

if __name__ == "__main__":
    main()

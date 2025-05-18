#!/usr/bin/env python3
"""
Folder Structure Verification Script

This script verifies that the repository structure follows the standardized format
and identifies any inconsistencies or missing components.
"""

import os
import sys
import json
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

# Define expected structure
EXPECTED_STRUCTURE = {
    "core": {
        "src": [
            "routing",
            "providers",
            "caching",
            "observability",
            "authentication",
            "config"
        ],
        "test": []
    },
    "professional": {
        "src": [
            "semantic-caching",
            "request-transformation",
            "advanced-routing",
            "policy-builder",
            "monitoring",
            "hybrid"
        ],
        "test": []
    },
    "enterprise": {
        "src": [
            "cognitive-fingerprinting",
            "arbitration",
            "policy-evolution",
            "governance",
            "security",
            "integration"
        ],
        "test": []
    },
    "documentation": {
        "protocol": [],
        "architecture": [],
        "guides": [],
        "api-reference": [],
        "features": []
    },
    "deployment": {
        "kubernetes": [],
        "docker": [],
        "terraform": [],
        "serverless": []
    },
    "sdk": {
        "javascript": [],
        "python": [],
        "go": [],
        "java": [],
        "csharp": []
    },
    "examples": []
}

def check_directory_exists(path: str) -> bool:
    """Check if a directory exists."""
    return os.path.isdir(path)

def check_structure(base_path: str, structure: Dict, path: str = "") -> Tuple[List[str], List[str]]:
    """
    Recursively check if the directory structure matches the expected structure.
    
    Args:
        base_path: The base path of the repository
        structure: The expected structure dictionary
        path: The current relative path within the structure
        
    Returns:
        missing: List of missing directories
        extra: List of unexpected directories
    """
    missing = []
    extra = []
    
    current_path = os.path.join(base_path, path) if path else base_path
    
    # Check if expected directories exist
    for key, substructure in structure.items():
        dir_path = os.path.join(current_path, key)
        if not check_directory_exists(dir_path):
            missing.append(os.path.join(path, key) if path else key)
        elif isinstance(substructure, list) and substructure:
            # Check subdirectories if specified
            for subdir in substructure:
                subdir_path = os.path.join(dir_path, subdir)
                if not check_directory_exists(subdir_path):
                    missing.append(os.path.join(path, key, subdir) if path else os.path.join(key, subdir))
        elif isinstance(substructure, dict):
            # Recurse into substructure
            sub_missing, sub_extra = check_structure(base_path, substructure, os.path.join(path, key) if path else key)
            missing.extend(sub_missing)
            extra.extend(sub_extra)
    
    # Check for unexpected directories at this level
    if path:  # Skip the root level
        expected_dirs = set(structure.keys())
        actual_dirs = set()
        
        try:
            for item in os.listdir(current_path):
                item_path = os.path.join(current_path, item)
                if os.path.isdir(item_path) and not item.startswith('.'):
                    actual_dirs.add(item)
        except FileNotFoundError:
            pass  # Directory doesn't exist, will be caught by missing check
        
        unexpected_dirs = actual_dirs - expected_dirs
        for dir_name in unexpected_dirs:
            extra.append(os.path.join(path, dir_name))
    
    return missing, extra

def main():
    """Main function."""
    repo_path = os.getcwd()
    
    print(f"Verifying repository structure at: {repo_path}")
    print("Checking against standardized structure...")
    
    missing_dirs, extra_dirs = check_structure(repo_path, EXPECTED_STRUCTURE)
    
    # Summarize results
    if not missing_dirs and not extra_dirs:
        print("\n✅ Repository structure matches the expected format.")
        return 0
    
    if missing_dirs:
        print("\n❌ Missing directories:")
        for dir_path in sorted(missing_dirs):
            print(f"  - {dir_path}")
    
    if extra_dirs:
        print("\n⚠️  Unexpected directories (may be intentional):")
        for dir_path in sorted(extra_dirs):
            print(f"  - {dir_path}")
    
    if missing_dirs:
        print("\nConsider creating the missing directories to complete the structure.")
    
    # Export findings to a JSON file for potential automation
    findings = {
        "timestamp": __import__("datetime").datetime.now().isoformat(),
        "repository_path": repo_path,
        "missing_directories": missing_dirs,
        "unexpected_directories": extra_dirs
    }
    
    with open("structure_verification_results.json", "w") as f:
        json.dump(findings, f, indent=2)
    
    print("\nResults saved to structure_verification_results.json")
    
    # Return non-zero exit code if there are missing directories
    return 1 if missing_dirs else 0

if __name__ == "__main__":
    sys.exit(main())

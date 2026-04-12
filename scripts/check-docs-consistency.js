#!/usr/bin/env node
/**
 * Documentation Consistency Checker
 *
 * Validates that README and documentation files contain correct:
 * - Package names
 * - Repository URLs
 * - Install commands
 *
 * Exit codes:
 * - 0: All checks passed
 * - 1: Consistency errors found
 */

const fs = require("fs");
const path = require("path");

const CORRECT_PACKAGE_NAME = "@cam-protocol/complete-arbitration-mesh";
const CORRECT_REPO_URL = "https://github.com/Complete-Arbitration-Mesh/CAM-PROTOCOL";
const CORRECT_REPO_CLONE = "git clone https://github.com/Complete-Arbitration-Mesh/CAM-PROTOCOL.git";

// Patterns that should NOT appear (incorrect values)
const FORBIDDEN_PATTERNS = [
  {
    pattern: /@anthropic-ai\/cam-protocol/g,
    message: "Incorrect package name: @anthropic-ai/cam-protocol",
    suggestion: `Use: ${CORRECT_PACKAGE_NAME}`,
  },
  {
    pattern: /npm install @anthropic-ai/g,
    message: "Incorrect npm install command with @anthropic-ai scope",
    suggestion: `Use: npm install ${CORRECT_PACKAGE_NAME}`,
  },
  {
    pattern: /github\.com\/anthropic-ai\/cam-protocol/gi,
    message: "Incorrect repository URL",
    suggestion: `Use: ${CORRECT_REPO_URL}`,
  },
  {
    pattern: /git clone.*anthropic-ai.*cam-protocol/gi,
    message: "Incorrect git clone URL",
    suggestion: `Use: ${CORRECT_REPO_CLONE}`,
  },
];

// Files to check
const FILES_TO_CHECK = [
  "README.md",
  "EDITIONS.md",
  "LICENSES.md",
  "docs/guides/quick-start.md",
];

let errors = [];
let warnings = [];

function checkFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);

  if (!fs.existsSync(fullPath)) {
    warnings.push(`File not found: ${filePath}`);
    return;
  }

  const content = fs.readFileSync(fullPath, "utf-8");
  const lines = content.split("\n");

  for (const check of FORBIDDEN_PATTERNS) {
    let match;
    const regex = new RegExp(check.pattern.source, check.pattern.flags);

    while ((match = regex.exec(content)) !== null) {
      // Find line number
      let lineNum = 1;
      let pos = 0;
      for (const line of lines) {
        if (pos + line.length >= match.index) {
          break;
        }
        pos += line.length + 1;
        lineNum++;
      }

      errors.push({
        file: filePath,
        line: lineNum,
        message: check.message,
        suggestion: check.suggestion,
        found: match[0],
      });
    }
  }
}

function checkPackageJsonAlignment() {
  const pkgPath = path.join(process.cwd(), "package.json");
  if (!fs.existsSync(pkgPath)) {
    errors.push({
      file: "package.json",
      line: 0,
      message: "package.json not found",
      suggestion: "Ensure package.json exists",
    });
    return;
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

  // Check README mentions correct package name
  const readmePath = path.join(process.cwd(), "README.md");
  if (fs.existsSync(readmePath)) {
    const readme = fs.readFileSync(readmePath, "utf-8");
    if (!readme.includes(pkg.name)) {
      warnings.push(
        `README.md does not mention the package name from package.json: ${pkg.name}`
      );
    }
  }
}

function main() {
  console.log("Checking documentation consistency...\n");

  // Check individual files
  for (const file of FILES_TO_CHECK) {
    console.log(`  Checking ${file}...`);
    checkFile(file);
  }

  // Check package.json alignment
  console.log("  Checking package.json alignment...");
  checkPackageJsonAlignment();

  console.log("");

  // Report warnings
  if (warnings.length > 0) {
    console.log("Warnings:");
    for (const warning of warnings) {
      console.log(`  ⚠️  ${warning}`);
    }
    console.log("");
  }

  // Report errors
  if (errors.length > 0) {
    console.log("Errors found:");
    for (const error of errors) {
      console.log(`  ❌ ${error.file}:${error.line}`);
      console.log(`     ${error.message}`);
      console.log(`     Found: "${error.found}"`);
      console.log(`     ${error.suggestion}`);
      console.log("");
    }
    console.log(`Total: ${errors.length} error(s) found`);
    process.exit(1);
  }

  console.log("✅ All documentation consistency checks passed!");
  process.exit(0);
}

main();

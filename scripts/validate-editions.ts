#!/usr/bin/env npx ts-node
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025 Andrew "Dru" Edwards. All rights reserved.

/**
 * Edition Validation Script
 *
 * This script validates all three editions work correctly:
 * - Community (default, no license)
 * - Pro (with license key)
 * - Enterprise (with license key)
 *
 * Run: npx ts-node scripts/validate-editions.ts
 */

import {
  LicenseManager,
  LicenseError,
  checkFeature,
  requireFeature,
  type Edition,
  type EditionFeatures,
} from "../src/licensing/index.js";

// ANSI colors for terminal output
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

const CHECK = `${GREEN}✓${RESET}`;
const CROSS = `${RED}✗${RESET}`;
const INFO = `${BLUE}ℹ${RESET}`;

interface ValidationResult {
  edition: Edition;
  passed: number;
  failed: number;
  tests: { name: string; passed: boolean; message?: string }[];
}

function log(message: string): void {
  console.log(message);
}

function header(title: string): void {
  log(`\n${BOLD}${BLUE}═══════════════════════════════════════════════════════════${RESET}`);
  log(`${BOLD}${BLUE}  ${title}${RESET}`);
  log(`${BOLD}${BLUE}═══════════════════════════════════════════════════════════${RESET}\n`);
}

function section(title: string): void {
  log(`\n${BOLD}${YELLOW}▶ ${title}${RESET}`);
  log(`${YELLOW}${"─".repeat(50)}${RESET}`);
}

function validateCommunityEdition(): ValidationResult {
  const result: ValidationResult = { edition: "community", passed: 0, failed: 0, tests: [] };
  const lm = LicenseManager.getInstance();
  lm.deactivateLicense();

  // Test 1: Default edition
  const editionTest = lm.getEdition() === "community";
  result.tests.push({
    name: "Default edition is community",
    passed: editionTest,
    message: `Edition: ${lm.getEdition()}`,
  });
  editionTest ? result.passed++ : result.failed++;

  // Test 2: Community features enabled
  const features = lm.getFeatures();
  const communityFeatures: (keyof EditionFeatures)[] = [
    "coreRouting",
    "basicMcpGateway",
    "basicPolicies",
    "consoleLogging",
    "singleTenant",
  ];

  for (const feat of communityFeatures) {
    const enabled = features[feat] === true;
    result.tests.push({
      name: `Community feature: ${feat}`,
      passed: enabled,
      message: enabled ? "enabled" : "DISABLED",
    });
    enabled ? result.passed++ : result.failed++;
  }

  // Test 3: Pro features disabled
  const proFeatures: (keyof EditionFeatures)[] = [
    "redisCaching",
    "rateLimiting",
    "jsonlAudit",
    "openTelemetry",
    "multiTenant",
  ];

  for (const feat of proFeatures) {
    const disabled = features[feat] === false;
    result.tests.push({
      name: `Pro feature ${feat} disabled`,
      passed: disabled,
      message: disabled ? "correctly disabled" : "INCORRECTLY ENABLED",
    });
    disabled ? result.passed++ : result.failed++;
  }

  // Test 4: Enterprise features disabled
  const enterpriseFeatures: (keyof EditionFeatures)[] = [
    "ssoSaml",
    "rbac",
    "signedAudit",
    "cloudExport",
  ];

  for (const feat of enterpriseFeatures) {
    const disabled = features[feat] === false;
    result.tests.push({
      name: `Enterprise feature ${feat} disabled`,
      passed: disabled,
      message: disabled ? "correctly disabled" : "INCORRECTLY ENABLED",
    });
    disabled ? result.passed++ : result.failed++;
  }

  // Test 5: requireFeature throws for Pro features
  let throwsCorrectly = false;
  try {
    requireFeature("redisCaching");
  } catch (e) {
    throwsCorrectly = e instanceof LicenseError;
  }
  result.tests.push({
    name: "requireFeature throws LicenseError for Pro features",
    passed: throwsCorrectly,
  });
  throwsCorrectly ? result.passed++ : result.failed++;

  return result;
}

function validateProEdition(): ValidationResult {
  const result: ValidationResult = { edition: "pro", passed: 0, failed: 0, tests: [] };
  const lm = LicenseManager.getInstance();
  lm.deactivateLicense();

  // Generate and activate Pro license
  const licenseKey = lm.generateLicenseKey(
    "pro",
    "Test Organization",
    "test@example.com",
    new Date("2030-12-31"),
    100
  );

  let activationPassed = false;
  try {
    const license = lm.activateLicense(licenseKey);
    activationPassed = license.edition === "pro";
  } catch {
    activationPassed = false;
  }

  result.tests.push({
    name: "Pro license activation",
    passed: activationPassed,
    message: activationPassed ? `Edition: ${lm.getEdition()}` : "Activation failed",
  });
  activationPassed ? result.passed++ : result.failed++;

  if (!activationPassed) return result;

  // Test Pro features enabled
  const proFeatures: (keyof EditionFeatures)[] = [
    "redisCaching",
    "rateLimiting",
    "jsonlAudit",
    "openTelemetry",
    "multiTenant",
    "advancedPolicies",
    "emailSupport",
  ];

  const features = lm.getFeatures();
  for (const feat of proFeatures) {
    const enabled = features[feat] === true;
    result.tests.push({
      name: `Pro feature: ${feat}`,
      passed: enabled,
      message: enabled ? "enabled" : "DISABLED",
    });
    enabled ? result.passed++ : result.failed++;
  }

  // Test Enterprise features still disabled
  const enterpriseFeatures: (keyof EditionFeatures)[] = [
    "ssoSaml",
    "rbac",
    "signedAudit",
    "cloudExport",
  ];

  for (const feat of enterpriseFeatures) {
    const disabled = features[feat] === false;
    result.tests.push({
      name: `Enterprise feature ${feat} disabled in Pro`,
      passed: disabled,
      message: disabled ? "correctly disabled" : "INCORRECTLY ENABLED",
    });
    disabled ? result.passed++ : result.failed++;
  }

  // Test checkFeature works
  const checkWorks = checkFeature("redisCaching") === true;
  result.tests.push({
    name: "checkFeature returns true for Pro features",
    passed: checkWorks,
  });
  checkWorks ? result.passed++ : result.failed++;

  lm.deactivateLicense();
  return result;
}

function validateEnterpriseEdition(): ValidationResult {
  const result: ValidationResult = { edition: "enterprise", passed: 0, failed: 0, tests: [] };
  const lm = LicenseManager.getInstance();
  lm.deactivateLicense();

  // Generate and activate Enterprise license
  const licenseKey = lm.generateLicenseKey(
    "enterprise",
    "Enterprise Corp",
    "admin@enterprise.com",
    null, // perpetual
    null // unlimited users
  );

  let activationPassed = false;
  try {
    const license = lm.activateLicense(licenseKey);
    activationPassed = license.edition === "enterprise";
  } catch {
    activationPassed = false;
  }

  result.tests.push({
    name: "Enterprise license activation",
    passed: activationPassed,
    message: activationPassed ? `Edition: ${lm.getEdition()}` : "Activation failed",
  });
  activationPassed ? result.passed++ : result.failed++;

  if (!activationPassed) return result;

  // Test ALL features enabled
  const allFeatures: (keyof EditionFeatures)[] = [
    "coreRouting",
    "basicMcpGateway",
    "basicPolicies",
    "consoleLogging",
    "singleTenant",
    "redisCaching",
    "rateLimiting",
    "jsonlAudit",
    "openTelemetry",
    "multiTenant",
    "advancedPolicies",
    "emailSupport",
    "ssoSaml",
    "rbac",
    "signedAudit",
    "cloudExport",
    "slaDashboard",
    "dedicatedSupport",
    "onPremDeployment",
    "customIntegrations",
  ];

  const features = lm.getFeatures();
  for (const feat of allFeatures) {
    const enabled = features[feat] === true;
    result.tests.push({
      name: `Enterprise feature: ${feat}`,
      passed: enabled,
      message: enabled ? "enabled" : "DISABLED",
    });
    enabled ? result.passed++ : result.failed++;
  }

  // Test license info
  const info = lm.getLicenseInfo();
  const infoCorrect = info !== null && info.licensee === "Enterprise Corp" && info.maxUsers === null;
  result.tests.push({
    name: "License info correct",
    passed: infoCorrect,
    message: infoCorrect ? `Licensee: ${info?.licensee}, Users: unlimited` : "Info incorrect",
  });
  infoCorrect ? result.passed++ : result.failed++;

  lm.deactivateLicense();
  return result;
}

function validateSecurityFeatures(): ValidationResult {
  const result: ValidationResult = { edition: "community", passed: 0, failed: 0, tests: [] };
  const lm = LicenseManager.getInstance();
  lm.deactivateLicense();

  // Test 1: Reject invalid license
  let rejectsInvalid = false;
  try {
    lm.activateLicense("invalid-base64-garbage-key");
  } catch (e) {
    rejectsInvalid = e instanceof LicenseError;
  }
  result.tests.push({
    name: "Rejects invalid license keys",
    passed: rejectsInvalid,
  });
  rejectsInvalid ? result.passed++ : result.failed++;

  // Test 2: Reject tampered license
  const validKey = lm.generateLicenseKey("pro", "Test", "test@test.com");
  const tamperedKey = validKey.slice(0, -10) + "XXXXXXXXXX";
  let rejectsTampered = false;
  try {
    lm.activateLicense(tamperedKey);
  } catch (e) {
    rejectsTampered = e instanceof LicenseError;
  }
  result.tests.push({
    name: "Rejects tampered license keys",
    passed: rejectsTampered,
  });
  rejectsTampered ? result.passed++ : result.failed++;

  // Test 3: Reject expired license
  const expiredKey = lm.generateLicenseKey(
    "pro",
    "Expired Co",
    "expired@test.com",
    new Date("2020-01-01")
  );
  let rejectsExpired = false;
  try {
    lm.activateLicense(expiredKey);
  } catch (e) {
    rejectsExpired = e instanceof LicenseError && (e as LicenseError).message.includes("expired");
  }
  result.tests.push({
    name: "Rejects expired license keys",
    passed: rejectsExpired,
  });
  rejectsExpired ? result.passed++ : result.failed++;

  // Test 4: HMAC signature verification
  const key1 = lm.generateLicenseKey("pro", "Test1", "a@b.com");
  const key2 = lm.generateLicenseKey("pro", "Test1", "a@b.com");
  // Same inputs should produce same signature (deterministic)
  const signaturesMatch = key1 === key2;
  result.tests.push({
    name: "HMAC signatures are deterministic",
    passed: signaturesMatch,
  });
  signaturesMatch ? result.passed++ : result.failed++;

  return result;
}

function printResults(results: ValidationResult[]): void {
  header("VALIDATION SUMMARY");

  let totalPassed = 0;
  let totalFailed = 0;

  for (const r of results) {
    section(`${r.edition.toUpperCase()} Edition`);
    for (const t of r.tests) {
      const icon = t.passed ? CHECK : CROSS;
      const msg = t.message ? ` (${t.message})` : "";
      log(`  ${icon} ${t.name}${msg}`);
    }
    log(`\n  ${BOLD}Results:${RESET} ${GREEN}${r.passed} passed${RESET}, ${r.failed > 0 ? RED : ""}${r.failed} failed${RESET}`);
    totalPassed += r.passed;
    totalFailed += r.failed;
  }

  header("FINAL RESULTS");
  log(`${BOLD}Total Tests:${RESET} ${totalPassed + totalFailed}`);
  log(`${BOLD}Passed:${RESET} ${GREEN}${totalPassed}${RESET}`);
  log(`${BOLD}Failed:${RESET} ${totalFailed > 0 ? RED : GREEN}${totalFailed}${RESET}`);
  log("");

  if (totalFailed === 0) {
    log(`${GREEN}${BOLD}✅ ALL EDITION VALIDATIONS PASSED${RESET}`);
    log(`${INFO} Community, Pro, and Enterprise editions are working correctly.`);
    log(`${INFO} License security features are enforced.`);
    log(`${INFO} Feature gating is functioning as designed.\n`);
  } else {
    log(`${RED}${BOLD}❌ SOME VALIDATIONS FAILED${RESET}`);
    log(`${INFO} Review failed tests above.\n`);
    process.exit(1);
  }
}

function main(): void {
  header("CAM PROTOCOL EDITION VALIDATION");
  log(`${INFO} This script validates all three editions work correctly.\n`);
  log(`${INFO} Testing date: ${new Date().toISOString()}`);
  log(`${INFO} Node version: ${process.version}`);

  const results: ValidationResult[] = [];

  section("Validating Community Edition (Default)");
  results.push(validateCommunityEdition());

  section("Validating Pro Edition");
  results.push(validateProEdition());

  section("Validating Enterprise Edition");
  results.push(validateEnterpriseEdition());

  section("Validating Security Features");
  results.push(validateSecurityFeatures());

  printResults(results);
}

main();

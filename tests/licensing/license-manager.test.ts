// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  LicenseManager,
  LicenseError,
  checkFeature,
  requireFeature,
} from "../../src/licensing/license-manager.js";

describe("LicenseManager", () => {
  let licenseManager: LicenseManager;

  beforeEach(() => {
    // Get fresh instance
    licenseManager = LicenseManager.getInstance();
    licenseManager.deactivateLicense();
  });

  afterEach(() => {
    licenseManager.deactivateLicense();
  });

  describe("Community Edition (Default)", () => {
    it("should default to community edition", () => {
      expect(licenseManager.getEdition()).toBe("community");
    });

    it("should have community features enabled", () => {
      const features = licenseManager.getFeatures();
      expect(features.coreRouting).toBe(true);
      expect(features.basicMcpGateway).toBe(true);
      expect(features.basicPolicies).toBe(true);
      expect(features.consoleLogging).toBe(true);
      expect(features.singleTenant).toBe(true);
    });

    it("should have pro features disabled", () => {
      const features = licenseManager.getFeatures();
      expect(features.redisCaching).toBe(false);
      expect(features.rateLimiting).toBe(false);
      expect(features.jsonlAudit).toBe(false);
      expect(features.openTelemetry).toBe(false);
      expect(features.multiTenant).toBe(false);
    });

    it("should have enterprise features disabled", () => {
      const features = licenseManager.getFeatures();
      expect(features.ssoSaml).toBe(false);
      expect(features.rbac).toBe(false);
      expect(features.signedAudit).toBe(false);
      expect(features.cloudExport).toBe(false);
    });
  });

  describe("Feature Checking", () => {
    it("should return true for enabled community features", () => {
      expect(licenseManager.hasFeature("coreRouting")).toBe(true);
      expect(licenseManager.hasFeature("basicMcpGateway")).toBe(true);
    });

    it("should return false for disabled pro features", () => {
      expect(licenseManager.hasFeature("redisCaching")).toBe(false);
      expect(licenseManager.hasFeature("rateLimiting")).toBe(false);
    });

    it("should throw LicenseError when requiring unavailable feature", () => {
      expect(() => {
        licenseManager.requireFeature("redisCaching");
      }).toThrow(LicenseError);
    });

    it("should not throw when requiring available feature", () => {
      expect(() => {
        licenseManager.requireFeature("coreRouting");
      }).not.toThrow();
    });
  });

  describe("License Activation", () => {
    it("should generate and activate a pro license", () => {
      const licenseKey = licenseManager.generateLicenseKey(
        "pro",
        "Test Company",
        "test@example.com"
      );

      const license = licenseManager.activateLicense(licenseKey);

      expect(license.edition).toBe("pro");
      expect(license.licensee).toBe("Test Company");
      expect(licenseManager.getEdition()).toBe("pro");
    });

    it("should enable pro features after activation", () => {
      const licenseKey = licenseManager.generateLicenseKey(
        "pro",
        "Test Company",
        "test@example.com"
      );
      licenseManager.activateLicense(licenseKey);

      expect(licenseManager.hasFeature("redisCaching")).toBe(true);
      expect(licenseManager.hasFeature("rateLimiting")).toBe(true);
      expect(licenseManager.hasFeature("jsonlAudit")).toBe(true);
    });

    it("should generate and activate an enterprise license", () => {
      const licenseKey = licenseManager.generateLicenseKey(
        "enterprise",
        "Big Corp",
        "admin@bigcorp.com"
      );

      const license = licenseManager.activateLicense(licenseKey);

      expect(license.edition).toBe("enterprise");
      expect(licenseManager.getEdition()).toBe("enterprise");
    });

    it("should enable all features with enterprise license", () => {
      const licenseKey = licenseManager.generateLicenseKey(
        "enterprise",
        "Big Corp",
        "admin@bigcorp.com"
      );
      licenseManager.activateLicense(licenseKey);

      expect(licenseManager.hasFeature("redisCaching")).toBe(true);
      expect(licenseManager.hasFeature("ssoSaml")).toBe(true);
      expect(licenseManager.hasFeature("rbac")).toBe(true);
      expect(licenseManager.hasFeature("signedAudit")).toBe(true);
    });

    it("should reject invalid license keys", () => {
      expect(() => {
        licenseManager.activateLicense("invalid-license-key");
      }).toThrow(LicenseError);
    });

    it("should reject tampered license keys", () => {
      const validKey = licenseManager.generateLicenseKey(
        "pro",
        "Test",
        "test@example.com"
      );
      // Tamper with the key by modifying base64
      const tamperedKey = validKey.slice(0, -5) + "XXXXX";

      expect(() => {
        licenseManager.activateLicense(tamperedKey);
      }).toThrow(LicenseError);
    });
  });

  describe("License Expiration", () => {
    it("should reject expired licenses", () => {
      const pastDate = new Date("2020-01-01");
      const licenseKey = licenseManager.generateLicenseKey(
        "pro",
        "Test",
        "test@example.com",
        pastDate
      );

      expect(() => {
        licenseManager.activateLicense(licenseKey);
      }).toThrow("License has expired");
    });

    it("should accept non-expired licenses", () => {
      const futureDate = new Date("2030-01-01");
      const licenseKey = licenseManager.generateLicenseKey(
        "pro",
        "Test",
        "test@example.com",
        futureDate
      );

      expect(() => {
        licenseManager.activateLicense(licenseKey);
      }).not.toThrow();
    });

    it("should accept perpetual licenses (null expiry)", () => {
      const licenseKey = licenseManager.generateLicenseKey(
        "pro",
        "Test",
        "test@example.com",
        null
      );

      expect(() => {
        licenseManager.activateLicense(licenseKey);
      }).not.toThrow();
    });
  });

  describe("License Deactivation", () => {
    it("should revert to community edition after deactivation", () => {
      const licenseKey = licenseManager.generateLicenseKey(
        "pro",
        "Test",
        "test@example.com"
      );
      licenseManager.activateLicense(licenseKey);
      expect(licenseManager.getEdition()).toBe("pro");

      licenseManager.deactivateLicense();
      expect(licenseManager.getEdition()).toBe("community");
    });

    it("should disable pro features after deactivation", () => {
      const licenseKey = licenseManager.generateLicenseKey(
        "pro",
        "Test",
        "test@example.com"
      );
      licenseManager.activateLicense(licenseKey);
      expect(licenseManager.hasFeature("redisCaching")).toBe(true);

      licenseManager.deactivateLicense();
      expect(licenseManager.hasFeature("redisCaching")).toBe(false);
    });
  });

  describe("Helper Functions", () => {
    it("checkFeature should work correctly", () => {
      expect(checkFeature("coreRouting")).toBe(true);
      expect(checkFeature("redisCaching")).toBe(false);
    });

    it("requireFeature should throw for unavailable features", () => {
      expect(() => {
        requireFeature("ssoSaml", "Single Sign-On");
      }).toThrow(/Single Sign-On/);
    });
  });

  describe("Edition Comparison", () => {
    it("should return correct comparison table", () => {
      const comparison = LicenseManager.getEditionComparison();

      expect(comparison["Core Routing"]).toEqual({
        community: true,
        pro: true,
        enterprise: true,
      });

      expect(comparison["Redis Caching"]).toEqual({
        community: false,
        pro: true,
        enterprise: true,
      });

      expect(comparison["SSO/SAML"]).toEqual({
        community: false,
        pro: false,
        enterprise: true,
      });
    });
  });
});

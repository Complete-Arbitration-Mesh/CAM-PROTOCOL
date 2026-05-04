// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025 Andrew "Dru" Edwards. All rights reserved.

import { createHash, createHmac } from "crypto";

/**
 * CAM Protocol Edition Types
 */
export type Edition = "community" | "pro" | "enterprise";

/**
 * Feature flags for each edition
 */
export interface EditionFeatures {
  // Community Features (always available)
  coreRouting: boolean;
  basicMcpGateway: boolean;
  basicPolicies: boolean;
  consoleLogging: boolean;
  singleTenant: boolean;

  // Pro Features
  redisCaching: boolean;
  rateLimiting: boolean;
  jsonlAudit: boolean;
  openTelemetry: boolean;
  multiTenant: boolean;
  advancedPolicies: boolean;
  emailSupport: boolean;

  // Enterprise Features
  ssoSaml: boolean;
  rbac: boolean;
  signedAudit: boolean;
  cloudExport: boolean;
  slaDashboard: boolean;
  dedicatedSupport: boolean;
  onPremDeployment: boolean;
  customIntegrations: boolean;
}

/**
 * License information
 */
export interface LicenseInfo {
  edition: Edition;
  licensee: string;
  email: string;
  expiresAt: Date | null; // null = perpetual
  maxUsers: number | null; // null = unlimited
  features: EditionFeatures;
  signature: string;
}

/**
 * Community edition features (always available, no license required)
 */
const COMMUNITY_FEATURES: EditionFeatures = {
  // Community - Always ON
  coreRouting: true,
  basicMcpGateway: true,
  basicPolicies: true,
  consoleLogging: true,
  singleTenant: true,

  // Pro - OFF
  redisCaching: false,
  rateLimiting: false,
  jsonlAudit: false,
  openTelemetry: false,
  multiTenant: false,
  advancedPolicies: false,
  emailSupport: false,

  // Enterprise - OFF
  ssoSaml: false,
  rbac: false,
  signedAudit: false,
  cloudExport: false,
  slaDashboard: false,
  dedicatedSupport: false,
  onPremDeployment: false,
  customIntegrations: false,
};

/**
 * Pro edition features
 */
const PRO_FEATURES: EditionFeatures = {
  ...COMMUNITY_FEATURES,
  // Pro - ON
  redisCaching: true,
  rateLimiting: true,
  jsonlAudit: true,
  openTelemetry: true,
  multiTenant: true,
  advancedPolicies: true,
  emailSupport: true,
};

/**
 * Enterprise edition features
 */
const ENTERPRISE_FEATURES: EditionFeatures = {
  ...PRO_FEATURES,
  // Enterprise - ON
  ssoSaml: true,
  rbac: true,
  signedAudit: true,
  cloudExport: true,
  slaDashboard: true,
  dedicatedSupport: true,
  onPremDeployment: true,
  customIntegrations: true,
};

/**
 * License Manager - Handles edition detection and feature gating
 */
export class LicenseManager {
  private static instance: LicenseManager;
  private currentLicense: LicenseInfo | null = null;
  private readonly secretKey: string;

  private constructor() {
    // In production, this would be an environment variable or secure config
    this.secretKey =
      process.env["CAM_LICENSE_SECRET"] ||
      (() => { throw new Error("CAM_LICENSE_SECRET environment variable is required"); })();
  }

  static getInstance(): LicenseManager {
    if (!LicenseManager.instance) {
      LicenseManager.instance = new LicenseManager();
    }
    return LicenseManager.instance;
  }

  /**
   * Get current edition
   */
  getEdition(): Edition {
    if (!this.currentLicense) {
      return "community";
    }
    return this.currentLicense.edition;
  }

  /**
   * Get features for current edition
   */
  getFeatures(): EditionFeatures {
    const edition = this.getEdition();
    switch (edition) {
      case "enterprise":
        return { ...ENTERPRISE_FEATURES };
      case "pro":
        return { ...PRO_FEATURES };
      default:
        return { ...COMMUNITY_FEATURES };
    }
  }

  /**
   * Check if a specific feature is enabled
   */
  hasFeature(feature: keyof EditionFeatures): boolean {
    const features = this.getFeatures();
    return features[feature] === true;
  }

  /**
   * Require a feature - throws if not available
   */
  requireFeature(feature: keyof EditionFeatures, featureName?: string): void {
    if (!this.hasFeature(feature)) {
      const name = featureName || feature;
      const edition = this.getEdition();
      const requiredEdition = this.getRequiredEdition(feature);
      throw new LicenseError(
        `Feature "${name}" requires ${requiredEdition} edition. ` +
          `Current edition: ${edition}. ` +
          `Upgrade at https://cam-protocol.dev/pricing`
      );
    }
  }

  /**
   * Get the minimum edition required for a feature
   */
  private getRequiredEdition(feature: keyof EditionFeatures): Edition {
    if (COMMUNITY_FEATURES[feature]) return "community";
    if (PRO_FEATURES[feature]) return "pro";
    return "enterprise";
  }

  /**
   * Activate a license key
   */
  activateLicense(licenseKey: string): LicenseInfo {
    try {
      const decoded = this.decodeLicenseKey(licenseKey);
      if (!this.validateLicense(decoded)) {
        throw new LicenseError("Invalid license signature");
      }
      if (decoded.expiresAt && new Date(decoded.expiresAt) < new Date()) {
        throw new LicenseError("License has expired");
      }
      this.currentLicense = decoded;
      return decoded;
    } catch (error) {
      if (error instanceof LicenseError) throw error;
      throw new LicenseError("Invalid license key format");
    }
  }

  /**
   * Deactivate current license (revert to community)
   */
  deactivateLicense(): void {
    this.currentLicense = null;
  }

  /**
   * Get license info (without signature)
   */
  getLicenseInfo(): Omit<LicenseInfo, "signature"> | null {
    if (!this.currentLicense) return null;
    const { signature, ...info } = this.currentLicense;
    return info;
  }

  /**
   * Generate a license key (for internal use / license server)
   */
  generateLicenseKey(
    edition: Edition,
    licensee: string,
    email: string,
    expiresAt: Date | null = null,
    maxUsers: number | null = null
  ): string {
    const features =
      edition === "enterprise"
        ? ENTERPRISE_FEATURES
        : edition === "pro"
          ? PRO_FEATURES
          : COMMUNITY_FEATURES;

    const licenseData: Omit<LicenseInfo, "signature"> = {
      edition,
      licensee,
      email,
      expiresAt,
      maxUsers,
      features,
    };

    const signature = this.signLicense(licenseData);
    const fullLicense: LicenseInfo = { ...licenseData, signature };

    return Buffer.from(JSON.stringify(fullLicense)).toString("base64");
  }

  /**
   * Decode a license key
   */
  private decodeLicenseKey(licenseKey: string): LicenseInfo {
    const decoded = Buffer.from(licenseKey, "base64").toString("utf-8");
    return JSON.parse(decoded) as LicenseInfo;
  }

  /**
   * Sign license data
   */
  private signLicense(data: Omit<LicenseInfo, "signature">): string {
    const payload = JSON.stringify(data);
    return createHmac("sha256", this.secretKey).update(payload).digest("hex");
  }

  /**
   * Validate license signature
   */
  private validateLicense(license: LicenseInfo): boolean {
    const { signature, ...data } = license;
    const expectedSignature = this.signLicense(data);
    return signature === expectedSignature;
  }

  /**
   * Get edition comparison for display
   */
  static getEditionComparison(): Record<
    string,
    { community: boolean; pro: boolean; enterprise: boolean }
  > {
    return {
      "Core Routing": { community: true, pro: true, enterprise: true },
      "Basic MCP Gateway": { community: true, pro: true, enterprise: true },
      "Basic Policies": { community: true, pro: true, enterprise: true },
      "Console Logging": { community: true, pro: true, enterprise: true },
      "Redis Caching": { community: false, pro: true, enterprise: true },
      "Rate Limiting": { community: false, pro: true, enterprise: true },
      "JSONL Audit Export": { community: false, pro: true, enterprise: true },
      OpenTelemetry: { community: false, pro: true, enterprise: true },
      "Multi-Tenant": { community: false, pro: true, enterprise: true },
      "Advanced Policies": { community: false, pro: true, enterprise: true },
      "SSO/SAML": { community: false, pro: false, enterprise: true },
      RBAC: { community: false, pro: false, enterprise: true },
      "Signed Audit Records": { community: false, pro: false, enterprise: true },
      "Cloud Export (S3/Azure)": {
        community: false,
        pro: false,
        enterprise: true,
      },
      "SLA Dashboard": { community: false, pro: false, enterprise: true },
      "Dedicated Support": { community: false, pro: false, enterprise: true },
    };
  }
}

/**
 * License-related errors
 */
export class LicenseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LicenseError";
  }
}

/**
 * Decorator for feature-gated methods
 */
export function requiresFeature(feature: keyof EditionFeatures) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    descriptor.value = function (...args: unknown[]) {
      LicenseManager.getInstance().requireFeature(feature, propertyKey);
      return originalMethod.apply(this, args);
    };
    return descriptor;
  };
}

/**
 * Helper to check feature in functional code
 */
export function checkFeature(feature: keyof EditionFeatures): boolean {
  return LicenseManager.getInstance().hasFeature(feature);
}

/**
 * Helper to require feature in functional code
 */
export function requireFeature(
  feature: keyof EditionFeatures,
  featureName?: string
): void {
  LicenseManager.getInstance().requireFeature(feature, featureName);
}

// Export singleton instance
export const licenseManager = LicenseManager.getInstance();

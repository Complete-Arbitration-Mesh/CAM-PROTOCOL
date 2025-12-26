# CAM Protocol Editions

CAM Protocol is available in three editions to meet different needs:

## Edition Comparison

| Feature | Community | Pro | Enterprise |
|---------|:---------:|:---:|:----------:|
| **Core Features** |
| Core Routing Engine | ✅ | ✅ | ✅ |
| Basic MCP Gateway | ✅ | ✅ | ✅ |
| Basic Policies (allow/deny) | ✅ | ✅ | ✅ |
| Console Logging | ✅ | ✅ | ✅ |
| Single-Tenant Mode | ✅ | ✅ | ✅ |
| **Pro Features** |
| Redis Caching | ❌ | ✅ | ✅ |
| Rate Limiting | ❌ | ✅ | ✅ |
| JSONL Audit Export | ❌ | ✅ | ✅ |
| OpenTelemetry Integration | ❌ | ✅ | ✅ |
| Multi-Tenant Support | ❌ | ✅ | ✅ |
| Advanced Policy Engine | ❌ | ✅ | ✅ |
| Email Support | ❌ | ✅ | ✅ |
| **Enterprise Features** |
| SSO/SAML Authentication | ❌ | ❌ | ✅ |
| Role-Based Access Control | ❌ | ❌ | ✅ |
| Signed Audit Records | ❌ | ❌ | ✅ |
| Cloud Export (S3/Azure) | ❌ | ❌ | ✅ |
| SLA Dashboard | ❌ | ❌ | ✅ |
| Dedicated Support | ❌ | ❌ | ✅ |
| On-Premise Deployment | ❌ | ❌ | ✅ |
| Custom Integrations | ❌ | ❌ | ✅ |

## Pricing

### Community Edition - Free
**Best for:** Individual developers, open source projects, learning

- Full access to core routing and MCP gateway
- Apache 2.0 license
- Community support via GitHub Issues
- No license key required

```bash
npm install @cam-protocol/complete-arbitration-mesh
```

### Pro Edition - $99/month
**Best for:** Growing teams, startups, production workloads

- Everything in Community
- Redis caching for high performance
- Rate limiting per user/tenant
- Audit logs in JSONL format
- OpenTelemetry for observability
- Multi-tenant architecture
- Email support (business hours)

**Get Pro:** [cam-protocol.dev/pro](https://cam-protocol.dev/pro) or email EdwardsTechPros@Outlook.com

### Enterprise Edition - Custom Pricing
**Best for:** Large organizations, compliance requirements, mission-critical systems

- Everything in Pro
- SSO/SAML for enterprise authentication
- RBAC for granular access control
- Tamper-proof signed audit records
- Export to S3, Azure Blob, or custom sinks
- SLA dashboard and uptime guarantees
- Dedicated support engineer
- On-premise deployment option
- Custom integrations and features

**Get Enterprise:** [cam-protocol.dev/enterprise](https://cam-protocol.dev/enterprise) or email EdwardsTechPros@Outlook.com

## Activating a License

### Community (Default)
No activation required. The Community edition works out of the box.

### Pro / Enterprise
After purchasing, you'll receive a license key. Activate it in your code:

```typescript
import { licenseManager } from '@cam-protocol/complete-arbitration-mesh';

// Activate your license
licenseManager.activateLicense('your-license-key-here');

// Check current edition
console.log(licenseManager.getEdition()); // 'pro' or 'enterprise'

// Check specific features
if (licenseManager.hasFeature('redisCaching')) {
  // Use Redis caching
}
```

Or via environment variable:
```bash
export CAM_LICENSE_KEY="your-license-key-here"
```

## Feature Gating

The library automatically gates features based on your edition:

```typescript
import { requireFeature, checkFeature } from '@cam-protocol/complete-arbitration-mesh';

// Check if feature is available (returns boolean)
if (checkFeature('rateLimiting')) {
  // Enable rate limiting
}

// Require feature (throws LicenseError if not available)
try {
  requireFeature('ssoSaml');
  // Use SSO
} catch (error) {
  console.log('SSO requires Enterprise edition');
}
```

## Upgrading

Upgrading is seamless:
1. Purchase your new edition
2. Replace your license key
3. New features are immediately available

No code changes required - the same codebase works with all editions.

## FAQ

**Q: Can I try Pro/Enterprise features before buying?**
A: Contact us for a 14-day trial license.

**Q: What happens if my license expires?**
A: Pro/Enterprise features will stop working, but Community features continue.

**Q: Can I downgrade?**
A: Yes. Remove your license key to revert to Community edition.

**Q: Is the Community edition production-ready?**
A: Yes! Many production systems run on Community edition.

**Q: How do I get support?**
- Community: GitHub Issues
- Pro: Email support (business hours)
- Enterprise: Dedicated support engineer + priority response

## Contact

- **Sales:** EdwardsTechPros@Outlook.com
- **Support:** https://github.com/Complete-Arbitration-Mesh/CAM-PROTOCOL/issues
- **Website:** https://cam-protocol.dev

---

*CAM Protocol Community Edition is open source under the Apache 2.0 license.*
*Pro and Enterprise editions are proprietary and require a valid license.*

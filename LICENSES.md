# CAM Protocol Licensing

## Overview

CAM Protocol is an **open-core** project:

| Component | License | Cost |
|-----------|---------|------|
| **Community Edition** | Apache-2.0 (Open Source) | Free |
| **Pro Edition** | Commercial | $99/month |
| **Enterprise Edition** | Commercial | Custom pricing |

## Community Edition (Apache-2.0)

The Community Edition is **fully open source** under the Apache License 2.0.

```
SPDX-License-Identifier: Apache-2.0
```

### What's Included

- Core AI model routing engine
- Basic MCP gateway
- Basic policies (allow/deny)
- Console logging
- Single-tenant mode
- All source code in this repository

### Your Rights

Under Apache-2.0, you may:
- Use commercially without restriction
- Modify and create derivative works
- Distribute copies
- Patent use grant included

### Requirements

- Include copyright notice and license
- State changes if you modify
- Include NOTICE file if present

See [LICENSE](./LICENSE) for the complete Apache-2.0 text.

## Pro Edition (Commercial)

The Pro Edition adds advanced features for production workloads.

### Additional Features

- Redis caching for high performance
- Rate limiting per user/tenant
- JSONL audit log export
- OpenTelemetry observability
- Multi-tenant architecture
- Advanced policy engine
- Email support (business hours)

### Pricing

**$99/month** per deployment

### How to Purchase

1. Email [EdwardsTechPros@Outlook.com](mailto:EdwardsTechPros@Outlook.com)
2. Receive your license key
3. Activate: `licenseManager.activateLicense('your-key')`

## Enterprise Edition (Commercial)

The Enterprise Edition provides full capabilities for large organizations.

### Additional Features (beyond Pro)

- SSO/SAML authentication
- Role-Based Access Control (RBAC)
- Cryptographically signed audit records
- Cloud export (S3, Azure Blob)
- SLA dashboard
- Dedicated support engineer
- On-premise deployment option
- Custom integrations

### Pricing

Custom pricing based on:
- Number of users
- Deployment requirements
- Support SLA needs
- Custom feature requests

### How to Purchase

Contact [EdwardsTechPros@Outlook.com](mailto:EdwardsTechPros@Outlook.com) to discuss your requirements.

## Open Source Dependencies

CAM uses open-source packages under their respective licenses:

### Production Dependencies

| Package | License | Purpose |
|---------|---------|---------|
| @anthropic-ai/sdk | MIT | Anthropic Claude API client |
| @google/generative-ai | Apache-2.0 | Google Gemini API client |
| @modelcontextprotocol/sdk | MIT | MCP integration |
| @opentelemetry/* | Apache-2.0 | Observability/tracing |
| fastify, @fastify/* | MIT | HTTP server framework |
| openai | Apache-2.0 | OpenAI API client |
| stripe | MIT | Payment processing |
| ioredis | MIT | Redis client |
| pino | MIT | Logging |
| zod | MIT | Schema validation |
| chalk, cli-table3, ora | MIT | CLI formatting |

### Development Dependencies

| Package | License | Purpose |
|---------|---------|---------|
| typescript | Apache-2.0 | TypeScript compiler |
| vitest, @vitest/* | MIT | Testing framework |
| eslint, prettier | MIT | Code quality |
| @playwright/test | Apache-2.0 | E2E testing |

All dependencies are used in compliance with their licenses.

## Source File Headers

All CAM source files include:

```typescript
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025 Andrew "Dru" Edwards. All rights reserved.
```

## Feature Gating

Features are automatically gated based on your license:

```typescript
import { licenseManager, checkFeature, requireFeature } from '@cam-protocol/complete-arbitration-mesh';

// Check edition
console.log(licenseManager.getEdition()); // 'community', 'pro', or 'enterprise'

// Check specific feature
if (checkFeature('redisCaching')) {
  // Redis caching is available
}

// Require feature (throws LicenseError if unavailable)
requireFeature('ssoSaml'); // Throws if not Enterprise
```

## FAQ

**Q: Can I use Community Edition in production?**
A: Yes! Many production systems run on Community Edition.

**Q: What happens when my Pro/Enterprise license expires?**
A: Pro/Enterprise features stop working. Community features continue.

**Q: Can I contribute to the project?**
A: Yes! Community contributions are welcome under Apache-2.0.

**Q: Is there a trial for Pro/Enterprise?**
A: Contact us for a 14-day trial license.

## Contact

- **Sales:** [EdwardsTechPros@Outlook.com](mailto:EdwardsTechPros@Outlook.com)
- **Support:** [GitHub Issues](https://github.com/Complete-Arbitration-Mesh/CAM-PROTOCOL/issues)
- **Website:** https://cam-protocol.dev

---

*CAM Protocol Community Edition: Apache-2.0*
*CAM Protocol Pro/Enterprise Editions: Commercial License Required*

Copyright (c) 2025 Andrew "Dru" Edwards. All rights reserved.

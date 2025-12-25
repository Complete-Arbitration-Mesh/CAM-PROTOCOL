# CAM Protocol Licensing

## Overview

The Complete Arbitration Mesh (CAM) Protocol consists of:

1. **CAM Core** (proprietary) - The main software in this repository
2. **Open Source Dependencies** - Third-party packages used by CAM

## CAM Core License

**License:** CAM-Attribution License (proprietary)
**SPDX Identifier:** `LicenseRef-CAM-Attribution`
**Files:** [LICENSE](./LICENSE), [LICENSE-ENTERPRISE](./LICENSE-ENTERPRISE)

CAM is **not open source**. All usage requires explicit written permission from the author.

### Why GitHub Shows "Unknown License"

GitHub's license detection only recognizes standard open-source licenses (MIT, Apache-2.0, GPL, etc.). CAM uses a custom proprietary license, which GitHub cannot automatically categorize. This is intentional - CAM is proprietary software.

### Summary of Requirements

| Requirement | Details |
|-------------|---------|
| **Permission** | Written approval required before any use |
| **Attribution** | "Built by Andrew 'Dru' Edwards" in all materials |
| **Commercial Use** | Requires separate signed agreement |
| **Source Headers** | Must include SPDX identifier |

### License Tiers

| Use Case | License File | Requirements |
|----------|--------------|--------------|
| Evaluation/Testing | [LICENSE](./LICENSE) | Written permission + attribution |
| Internal/Commercial | [LICENSE-ENTERPRISE](./LICENSE-ENTERPRISE) | Signed agreement + attribution |

## Requesting Permission

Contact: [EdwardsTechPros@Outlook.com](mailto:EdwardsTechPros@Outlook.com)

Include:
- Organization and contacts
- Intended use case
- Distribution model
- Any planned modifications

## Open Source Dependencies

CAM uses open-source packages under their respective licenses. These licenses apply **only** to those packages, not to CAM itself.

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

### License Compliance

The open-source dependencies are used in compliance with their licenses:
- MIT: Permissive, allows commercial use with attribution
- Apache-2.0: Permissive, allows commercial use with attribution and patent grant

Full license texts for dependencies can be found in their respective `node_modules/*/LICENSE` files.

## Source File Headers

All CAM source files should include:

```typescript
// SPDX-License-Identifier: LicenseRef-CAM-Attribution
// Copyright (c) 2025 Andrew "Dru" Edwards. All rights reserved.
```

## Attribution Guidelines

When permission is granted, include visible attribution:

- **README files**: "Built by Andrew 'Dru' Edwards"
- **UI/About pages**: Creator credit visible to end users
- **Documentation**: Clear authorship statement
- **Marketing materials**: Appropriate creator acknowledgment

## Questions

For licensing questions: [EdwardsTechPros@Outlook.com](mailto:EdwardsTechPros@Outlook.com)

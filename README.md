# Complete Arbitration Mesh (CAM)

<div align="center">
  <img src="docs/assets/cam1.png" alt="Complete Arbitration Mesh Logo" width="200"/>
  <h3>Complete Arbitration Mesh (CAM) Protocol</h3>

  [![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
  [![Version](https://img.shields.io/badge/Version-2.1.2-brightgreen.svg)](CHANGELOG.md)
  [![Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen.svg)](CHANGELOG.md)
  [![Compliance](https://img.shields.io/badge/Compliance-GDPR%20|%20CCPA-green.svg)](docs/legal/COMPLIANCE_CHECKLIST.md)
  [![Build Status](https://img.shields.io/github/workflow/status/Complete-Arbitration-Mesh/CAM-PROTOCOL/Continuous%20Integration?branch=main)](https://github.com/Complete-Arbitration-Mesh/CAM-PROTOCOL/actions/workflows/ci.yml)
  [![Coverage](https://img.shields.io/badge/coverage-70%25-yellow.svg)](CHANGELOG.md) [![MCP Coverage](https://img.shields.io/badge/mcp--coverage-88%25-brightgreen.svg)](CHANGELOG.md)
  [![SBOM](https://img.shields.io/badge/SBOM-CycloneDX-orange)](https://github.com/Complete-Arbitration-Mesh/CAM-PROTOCOL/actions/workflows/ci.yml)

  **Intelligent Orchestration and Collaboration for Modern AI Ecosystems**
  
  <strong>Built by Andrew "Dru" Edwards</strong>
</div>


**Production Status:** CAM Protocol is **production ready** as of the [v2.0.0 release](CHANGELOG.md) on May 28, 2025. The [v2.1.2 release](CHANGELOG.md) adds official SDK integrations, response caching, streaming support, rate limiting, a production-ready **MCP Gateway** with policy enforcement, retry logic, health checks, and OpenTelemetry instrumentation.

**Security Status:** Core security hardening complete. See [Security Checklist](docs/security/SECURITY_CHECKLIST.md) for current status. Report vulnerabilities to [edwardstechpros@outlook.com](mailto:edwardstechpros@outlook.com).


## 🌟 Overview

The Complete Arbitration Mesh (CAM) is a comprehensive platform that combines intelligent orchestration with advanced inter-agent collaboration capabilities. CAM serves as both the central nervous system for your AI integrations and the coordination layer for complex multi-agent collaborations.

### 🔍 Problem We Solve

Organizations face evolving challenges in the AI space:
- **Managing multiple AI providers** and their varying capabilities
- **Orchestrating collaboration** between specialized AI agents
- **Optimizing costs** while maintaining performance
- **Enforcing governance policies** across AI usage
- **Ensuring reliability** through intelligent failover
- **Maintaining compliance** with regulatory requirements
- **Scaling agent ecosystems** for complex tasks

## 🚀 Key Features

### Core Orchestration (CAM Classic)
- **FastPath Routing System** - Route requests to optimal AI providers
- **Official SDK Integrations** - OpenAI, Anthropic, Google, and Azure SDKs
- **Streaming Responses** - Real-time streaming via async generators
- **Response Caching** - In-memory LRU + Redis distributed caching
- **Rate Limiting** - Sliding window per-user and per-provider limits
- **Advanced Arbitration Engine** - Make decisions based on comprehensive criteria
- **Secure Authentication** - Protect access to your CAM instance
- **Comprehensive Monitoring** - Track detailed performance metrics
- **Policy Enforcement** - Apply governance rules consistently

### Inter-Agent Collaboration (IACP)
- **Agent Discovery** - Find and leverage specialized agents
- **Task Decomposition** - Break complex tasks into manageable components
- **Role-Based Collaboration** - Assign specialized roles to agents
- **Secure Inter-Agent Messaging** - Enable protected agent communication
- **Collaboration Marketplace** - Access specialized agent capabilities

## 🔌 MCP Gateway

CAM integrates with [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) as a **governance layer** that sits above MCP servers, providing policy enforcement, intelligent routing, and audit capabilities.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Your AI Application                      │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CAM MCP Gateway                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   Policies   │  │  Arbitration │  │    Audit     │           │
│  │  Trust Tiers │  │   Scoring    │  │   Logging    │           │
│  │  Rate Limits │  │  Cost/Latency│  │   Tracing    │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└───────────────────────────────┬─────────────────────────────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         ▼                      ▼                      ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  MCP Server A   │   │  MCP Server B   │   │  MCP Server C   │
│  (File System)  │   │   (Database)    │   │  (Web Search)   │
└─────────────────┘   └─────────────────┘   └─────────────────┘
```

### What CAM Adds to MCP

| MCP Provides | CAM Adds |
|--------------|----------|
| Tool discovery | **Policy-based tool selection** |
| Server connections | **Trust tier enforcement** |
| Tool execution | **Cost/latency arbitration** |
| — | **Audit logging with trace IDs** |
| — | **Rate limiting per tenant** |
| — | **Data classification filtering** |

### Quick Example

```typescript
import { MCPGateway } from '@cam-protocol/complete-arbitration-mesh/mcp';

const gateway = new MCPGateway({
  servers: [
    { id: 'fs', name: 'filesystem', transport: 'stdio', command: 'mcp-fs', trustTier: 'trusted', enabled: true },
    { id: 'web', name: 'websearch', transport: 'sse', endpoint: 'http://localhost:3001', trustTier: 'standard', enabled: true },
  ],
  policies: [{
    id: 'no-pii-external',
    name: 'Block PII to external tools',
    description: 'Deny tool calls that handle PII data',
    priority: 100,
    enabled: true,
    conditions: [{ field: 'tool.dataClassifications', operator: 'contains', value: 'pii' }],
    actions: ['deny'],
  }],
  defaults: {
    timeout: 30000,
    maxRetries: 2,
    retryDelayMs: 500,
    defaultTrustTier: 'standard',
    protocolVersion: '2025-11-25',
  },
  rateLimit: { enabled: true, requestsPerMinute: 100 },
  audit: { enabled: true, retentionDays: 30, includeArguments: true, includeResults: false },
});

await gateway.initialize();

// CAM selects best tool, enforces policies, logs decision
const result = await gateway.callTool({
  toolName: 'search',
  arguments: { query: 'latest news' },
  tenantId: 'tenant-123',
});

console.log(result.traceId);  // Audit trace
console.log(result.serverId); // Which MCP server was used
```

See [docs/architecture/MCP-ENHANCEMENT-PLAN.md](docs/architecture/MCP-ENHANCEMENT-PLAN.md) for the full integration roadmap.

## 📚 Quick Start

```bash
# Install the Complete Arbitration Mesh
npm install @cam-protocol/complete-arbitration-mesh

# Or using Docker
docker run -p 8080:8080 cam-protocol/complete-arbitration-mesh:latest
```

### Complete Environment with Docker Compose

For a full-featured environment including CAM Protocol, a toy LLM, and monitoring:

```bash
# Clone the repository
git clone https://github.com/Complete-Arbitration-Mesh/CAM-PROTOCOL.git

# Start the quickstart environment
cd CAM-PROTOCOL/examples/quickstart
docker-compose up -d

# Test it with a simple request
curl localhost:8080/mesh/chat -d '{"message":"Hello CAM!"}' -H "Content-Type: application/json" -H "Authorization: Bearer demo-key-for-quickstart"
```

See [examples/quickstart](examples/quickstart) for more details.

### Try it in 30 Seconds

```bash
# Try our value demonstration script
npm run demo:value
```

### SDK Examples

CAM Protocol provides SDKs for multiple languages. Here are examples in TypeScript, Python, and Go:

#### TypeScript/JavaScript ([SDK Documentation](sdk/js/README.md))

```typescript
import { CompleteArbitrationMesh } from '@cam-protocol/complete-arbitration-mesh';

const cam = new CompleteArbitrationMesh({
  apiKey: process.env.CAM_API_KEY,
  endpoint: 'https://api.complete-cam.com'
});

// Intelligent routing (original CAM functionality)
const routingResult = await cam.routeRequest({
  prompt: "Analyze this dataset",
  requirements: { cost: "optimize", performance: "balanced" }
});

// Agent collaboration (new IACP functionality)
const collaboration = await cam.initiateCollaboration({
  task: "Complex data analysis and visualization",
  requirements: ["data-analyst", "visualization-expert"],
  decomposition: "auto"
});
```

#### Python ([SDK Documentation](sdk/python/README.md))

```python
from cam_protocol import CompleteArbitrationMesh

# Initialize the CAM client
cam = CompleteArbitrationMesh(
    api_key=os.environ.get("CAM_API_KEY"),
    endpoint="https://api.complete-cam.com"
)

# Intelligent routing
routing_result = cam.route_request(
    prompt="Analyze this dataset",
    requirements={"cost": "optimize", "performance": "balanced"}
)

# Agent collaboration
collaboration = cam.initiate_collaboration(
    task="Complex data analysis and visualization",
    requirements=["data-analyst", "visualization-expert"],
    decomposition="auto"
)
```

#### Go ([SDK Documentation](sdk/go/README.md))

```go
package main

import (
	"os"
	"github.com/complete-arbitration-mesh/cam-protocol-go"
)

func main() {
	// Initialize the CAM client
	cam, err := camprotocol.NewClient(
		camprotocol.WithAPIKey(os.Getenv("CAM_API_KEY")),
		camprotocol.WithEndpoint("https://api.complete-cam.com"),
	)
	if err != nil {
		panic(err)
	}

	// Intelligent routing
	routingResult, err := cam.RouteRequest(camprotocol.RouteRequest{
		Prompt: "Analyze this dataset",
		Requirements: map[string]string{
			"cost":        "optimize",
			"performance": "balanced",
		},
	})

	// Agent collaboration
	collaboration, err := cam.InitiateCollaboration(camprotocol.CollaborationRequest{
		Task:         "Complex data analysis and visualization",
		Requirements: []string{"data-analyst", "visualization-expert"},
		Decomposition: "auto",
	})
}
```

## 🏗️ Architecture

The Complete Arbitration Mesh integrates three systems:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      Complete Arbitration Mesh                          │
├─────────────────────┬─────────────────────┬─────────────────────────────┤
│   Routing System    │   MCP Gateway       │  Inter-Agent Collaboration  │
│    (CAM Core)       │    (Preview)        │   Protocol (IACP)           │
├─────────────────────┼─────────────────────┼─────────────────────────────┤
│ • FastPath Routing  │ • MCP Server Mgmt   │ • Agent Discovery           │
│ • Provider Selection│ • Policy Arbitration│ • Task Decomposition        │
│ • Cost Optimization │ • Trust Tiers       │ • Role-Based Collaboration  │
│ • Rate Limiting     │ • Audit Logging     │ • Secure Messaging          │
└─────────────────────┴─────────────────────┴─────────────────────────────┘
                                  │
┌─────────────────────────────────┴───────────────────────────────────────┐
│                         Shared Infrastructure                           │
├─────────────────────────────────────────────────────────────────────────┤
│ • Authentication & Authorization  • Provider/MCP Connectors             │
│ • State Management               • Metrics & Telemetry (OTel)           │
│ • Configuration                  • Security Layer                       │
└─────────────────────────────────────────────────────────────────────────┘
```

## 📖 Documentation

For a complete overview of all documentation, see our [Documentation Index](docs/index.md).

### Guides
- [Quick Start Guide](docs/guides/quick-start.md)
- [Deployment Readiness](docs/DEPLOYMENT_READINESS.md)
- [Proof of Value](docs/PROOF_OF_VALUE.md)

### Technical Documentation
- [API Reference](docs/api/README.md)
- [Architecture Overview](docs/architecture/README.md)

### Legal & Compliance
- [Compliance Checklist](docs/legal/COMPLIANCE_CHECKLIST.md)
- [Privacy Policy](docs/legal/PRIVACY_POLICY.md)
- [Terms of Service](docs/legal/TERMS_OF_SERVICE.md)
- [GDPR Compliance](docs/legal/GDPR_COMPLIANCE.md)
- [CCPA Compliance](docs/legal/CCPA_COMPLIANCE.md)
- [Security Policy](docs/legal/SECURITY_POLICY.md)
- [Security Pre-Launch Checklist](docs/security/SECURITY_CHECKLIST.md)
- [Data Processing Agreement](docs/legal/DATA_PROCESSING_AGREEMENT.md)

## 🔧 Development

```bash
# Clone the repository
git clone https://github.com/Complete-Arbitration-Mesh/CAM-PROTOCOL.git
cd CAM-PROTOCOL

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Run benchmarks
npm run benchmark:cost
npm run benchmark:collaboration

# Build for production
npm run build
```

## 🛡️ Security

The Complete Arbitration Mesh takes security seriously:

- **Enterprise Authentication** - SAML, LDAP, OAuth 2.0
- **Zero-Trust Architecture** - Every request is authenticated and authorized
- **End-to-End Encryption** - All communications are encrypted
- **Audit Logging** - Comprehensive audit trails for compliance
- **FIPS Compliance** - Available in Enterprise tier

See [Security Checklist](docs/security/SECURITY_CHECKLIST.md) for detailed security controls and deployment guidance.

## 📋 Editions

CAM Protocol is available in three editions. See [EDITIONS.md](EDITIONS.md) for complete details.

| Feature | Community | Pro | Enterprise |
|---------|:---------:|:---:|:----------:|
| **Core Routing Engine** | ✅ | ✅ | ✅ |
| **Basic MCP Gateway** | ✅ | ✅ | ✅ |
| **Basic Policies** | ✅ | ✅ | ✅ |
| **Redis Caching** | ❌ | ✅ | ✅ |
| **Rate Limiting** | ❌ | ✅ | ✅ |
| **OpenTelemetry** | ❌ | ✅ | ✅ |
| **Multi-Tenant** | ❌ | ✅ | ✅ |
| **SSO/SAML** | ❌ | ❌ | ✅ |
| **RBAC** | ❌ | ❌ | ✅ |
| **Signed Audit** | ❌ | ❌ | ✅ |
| **Support** | GitHub Issues | Email | Dedicated |
| **Price** | Free | $99/mo | Custom |

**Get Started:** `npm install @cam-protocol/complete-arbitration-mesh` — Community edition works out of the box!

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

**CAM Protocol Community Edition is open source under the [Apache License 2.0](LICENSE).**

| Edition | License | Usage |
|---------|---------|-------|
| Community | Apache-2.0 | Free for any use |
| Pro | Commercial | Requires license key |
| Enterprise | Commercial | Requires license agreement |

```typescript
import { licenseManager, checkFeature } from '@cam-protocol/complete-arbitration-mesh';

// Community features work immediately
console.log(licenseManager.getEdition()); // 'community'

// Activate Pro/Enterprise with your license key
licenseManager.activateLicense('your-license-key');

// Check feature availability
if (checkFeature('redisCaching')) {
  // Use Pro/Enterprise feature
}
```

**Purchase Pro/Enterprise:** [EdwardsTechPros@Outlook.com](mailto:EdwardsTechPros@Outlook.com) | [EDITIONS.md](EDITIONS.md)

For complete licensing details including open source dependencies, see [LICENSES.md](LICENSES.md).

## 🆘 Support

- **Community**: [GitHub Discussions](https://github.com/orgs/Complete-Arbitration-Mesh/discussions)
- **Professional**: Email support (business hours)
- **Enterprise**: 24/7 premium support

## 🗺️ Roadmap

See our [public roadmap](https://github.com/Complete-Arbitration-Mesh/CAM-PROTOCOL/projects/1) for upcoming features and improvements.

## 📊 Value Demonstration

Run the benchmarks yourself to measure CAM's impact in your environment:

### Cost Optimization

Intelligent routing can reduce API costs by selecting optimal providers per request.

```bash
# Run cost benchmark (compares routing strategies)
npm run benchmark:cost
# Output: costs.json with per-provider breakdown
```

### Multi-Agent Collaboration

Task decomposition + role-based routing improves complex task completion.

```bash
# Run collaboration benchmark
npm run benchmark:collaboration
# Output: collaboration-results.json
```

### Reliability

Automatic failover and health-based routing maintain availability.

```bash
# Run reliability simulation
npm run demo:value
# Output: failover timing + recovery metrics
```

**Claims & Methodology:** Performance claims are based on controlled benchmarks using mock providers. Actual results vary significantly based on your provider latency, pricing, workload patterns, and configuration. Run the benchmarks in your environment for accurate measurements.

See [docs/benchmarks/methodology.md](docs/benchmarks/methodology.md) for complete methodology including environment assumptions, scripts, and how metrics are computed.

## 🔒 Legal & Compliance

The CAM Protocol is designed with security and compliance at its core:

- **[Privacy Policy](docs/legal/PRIVACY_POLICY.md)** - How we handle user data
- **[Terms of Service](docs/legal/TERMS_OF_SERVICE.md)** - Rules for using our service
- **[GDPR Compliance](docs/legal/GDPR_COMPLIANCE.md)** - EU data protection compliance
- **[CCPA Compliance](docs/legal/CCPA_COMPLIANCE.md)** - California privacy compliance
- **[Security Policy](docs/legal/SECURITY_POLICY.md)** - Our security practices
- **[Data Processing Agreement](docs/legal/DATA_PROCESSING_AGREEMENT.md)** - For processing customer data
- **[Acceptable Use Policy](docs/legal/ACCEPTABLE_USE_POLICY.md)** - Guidelines for acceptable use
- **[Service Level Agreement](docs/legal/SERVICE_LEVEL_AGREEMENT.md)** - Our uptime and performance guarantees

---

**Complete Arbitration Mesh** - Intelligent orchestration and collaboration for the AI-powered future.

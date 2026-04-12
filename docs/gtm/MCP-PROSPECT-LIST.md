# CAM-PROTOCOL Cold Outreach — MCP Ecosystem Prospect List

**Generated**: 2026-04-12
**For**: `@cam-protocol/complete-arbitration-mesh` v2.1.2 GTM launch

## Positioning Wedge

Every competing solution (MintMCP, TrueFoundry, Pomerium, Lasso, Kong, Lunar.dev) is a **gateway/proxy** requiring infrastructure changes. CAM-PROTOCOL as an **npm-embeddable package** is the only option for maintainers who want to ship governance as part of their server, not require customers to run a sidecar.

**Urgency**: Cisco announced MCP security tooling at RSA 2026. When enterprise security vendors present at RSA, procurement teams immediately add the category to their vendor questionnaires. The window to establish as the developer-native standard is 6-12 months.

## Top 20 Prospects (Ranked by Governance Fit)

| # | Name / Org | Why They'd Care | Outreach Angle |
|---|-----------|-----------------|----------------|
| 1 | **Pipedream** (`PipedreamHQ`) | 2,500+ API integrations, OAuth tokens at scale; one poisoned tool call = customer data breach | "Your 8,000 prebuilt tools are production attack surface — CAM-PROTOCOL gives your enterprise users audit trails and policy enforcement without changing a single integration" |
| 2 | **Supabase** (community MCP) | Already had a real breach (Cursor agent prompt injection, leaked integration tokens) | "You've already seen this attack in the wild. CAM-PROTOCOL makes governance a first-class feature of your official MCP server" |
| 3 | **Composio** (`ComposioHQ`) | Aggregates OAuth tokens for 500+ apps — highest blast radius in the ecosystem | "You're the single point of trust for 500+ OAuth tokens. CAM-PROTOCOL's policy layer lets enterprise customers define tool-call rules with a full audit trail" |
| 4 | **GitHub** (`github` org) | Official MCP server exploited via malicious issues leaking private repo data | "github/github-mcp-server is already a confirmed attack vector. CAM-PROTOCOL embeds in 24 hours to add tool-level RBAC and tamper-evident audit logs" |
| 5 | **Browserbase** (`browserbase`) | Cloud browser automation — phishing, credential harvesting, session hijacking all possible via prompt injection | "Headless browsers are the highest-risk MCP category. CAM-PROTOCOL's prompt injection detection protects your users from weaponized cloud browsers" |
| 6 | **E2B** (`e2b-dev`) | Code execution sandboxes — enterprise customers require audit trails for every execution event | "Code execution is the highest-risk MCP tool class. CAM-PROTOCOL gives E2B enterprise customers policy gates with SIEM-ready audit logs" |
| 7 | **MindsDB** (`mindsdb`) | 39K stars, SQL execution across 100+ data sources including production databases | "When your MCP server executes SQL against production data, 'who ran what query and why' is a compliance requirement" |
| 8 | **wonderwhy-er** (DesktopCommanderMCP) | ~6K stars, full terminal access — the most dangerous MCP server category for enterprises | "DesktopCommander is the most capable MCP server in the ecosystem — and the one IT departments most want to govern" |
| 9 | **JetBrains** | 950-star official IDE MCP; sells to enterprises requiring IT-auditable tool usage | "JetBrains enterprise licenses require IT-auditable tool usage. CAM-PROTOCOL provides per-developer, per-project policy enforcement" |
| 10 | **Cloudflare** | First-party MCP for Workers/KV/R2/D1/DNS — misconfigured tool call can delete production Workers | "Cloudflare's MCP server controls production infrastructure. CAM-PROTOCOL prevents destructive tool calls without explicit approval" |
| 11 | **Vercel** | Deployment management MCP — compromised tool call can push malicious code to production | "Vercel MCP can deploy to production. CAM-PROTOCOL adds human-in-the-loop gates for destructive operations" |
| 12 | **Red Hat** (`containers` org) | kubernetes-mcp-server gives LLMs full kubectl access to OpenShift clusters | "OpenShift customers already have K8s RBAC — but MCP bypasses it. CAM-PROTOCOL enforces namespace-level policies on every kubectl tool call" |
| 13 | **awslabs** | First-party MCP for Aurora, Lambda, S3 — enterprise customers demand CloudTrail-equivalent audit trails | "AWS customers expect every API call in CloudTrail. CAM-PROTOCOL bridges that expectation to MCP" |
| 14 | **Salesforce/Slack** | Slack MCP gives agents access to private channels; HIPAA/GDPR-regulated enterprises | "Slack contains the most sensitive unstructured data in any enterprise. CAM-PROTOCOL restricts what MCP agents can read from regulated workspaces" |
| 15 | **Semgrep** | Publicly worried about MCP security (two major blog posts); natural co-marketing partner | "Semgrep + CAM-PROTOCOL is the full stack: Semgrep catches vulnerabilities in MCP server code, CAM-PROTOCOL enforces runtime policy" |
| 16 | **Pomerium** | Zero Trust MCP gateway; publishes monthly MCP security roundups | "Pomerium handles network-layer, CAM-PROTOCOL handles in-process — complementary, not competitive. Joint packaging unlocks enterprise deals" |
| 17 | **Lasso Security** | Gartner Cool Vendor 2024 for AI Security; real-time MCP threat detection | "Lasso's network-layer detection + CAM-PROTOCOL's SDK-level audit trail = complete enterprise offer" |
| 18 | **Block (Square)** | Confirmed early adopter with financial data flowing through MCP; PCI-DSS compliance required | "Block's MCP deployment touches payment infrastructure. CAM-PROTOCOL provides PCI-DSS-compatible audit trails" |
| 19 | **Replit** | AI-native code platform with MCP; enterprise tier needs agent activity visibility | "Replit Teams customers ask: 'what did the AI agent do?' CAM-PROTOCOL gives full tool-call audit logs and per-workspace policy enforcement" |
| 20 | **executeautomation** (mcp-playwright) | 5,400-star Playwright MCP in CI/CD pipelines with sensitive credentials | "Playwright MCP runs next to your secrets. CAM-PROTOCOL's allowlist ensures the browser agent can only reach approved domains" |

## Top 5 Warmest Prospects (by signal strength)

1. **Supabase** — already breached, public about it, shipping official server
2. **GitHub** — already exploited, Microsoft enterprise pressure
3. **Composio** — highest token aggregation risk, actively selling to enterprise
4. **Pipedream** — largest integration surface, enterprise tier in market
5. **Semgrep** — already writing about the problem, natural co-marketing partner

## Competing Solutions

| Solution | Type | CAM-PROTOCOL Differentiation |
|----------|------|------------------------------|
| MintMCP | Commercial gateway (SOC 2) | Monolithic gateway vs. npm-embeddable |
| Lasso Security | Commercial (Gartner Cool Vendor) | Agent/MSSP-oriented vs. developer-native |
| TrueFoundry MCP Gateway | Commercial (350+ req/s) | Platform-level, not package-level |
| Pomerium | Open core / commercial | Network-layer proxy vs. in-process governance |
| Lunar.dev MCPX | Commercial | Gateway-only, not embeddable |
| Kong AI Gateway | Commercial | Heavy infra requirement |
| Trail of Bits MCP Context Protector | Research/OSS | Point tool, not full governance stack |
| Snyk + OWASP LLMSVS | Standards body | Framework/checklist, not enforcement |

## Cold Email Templates

### Template A — MCP Server Maintainers (Open-Source Angle)

**Subject:** Governance layer for [PROJECT NAME] — your users are asking for it

Hi [Name],

I've been following [PROJECT NAME] — [X]K stars and growing fast, especially in enterprise environments.

One gap keeps appearing in team feedback about MCP servers handling [sensitive operation]: **there's no standard way to enforce policy or produce audit logs.** Enterprise procurement teams are blocking MCP adoption specifically because of this.

We built CAM-PROTOCOL (`@cam-protocol/complete-arbitration-mesh`) — an npm-embeddable TypeScript package that adds to any MCP server:

- Tool-level policy enforcement (allowlists, data classification gates, RBAC)
- Tamper-evident audit trails (structured JSON, SIEM-ready)
- Prompt injection detection and tool-call anomaly alerting
- Human-in-the-loop gates for destructive operations

It drops into an existing MCP server in hours, not days. No infrastructure changes, no proxy.

**Your enterprise users already want this — offering it as an optional integration removes the procurement blocker without changing your server's core behavior.**

15-minute technical walkthrough? [day] or [day] work?

Best,
Dru Edwards
CAM-PROTOCOL | @cam-protocol/complete-arbitration-mesh

### Template B — Enterprise AI Platform Teams (Security/Compliance Angle)

**Subject:** MCP governance before production — what CISOs are requiring in 2026

Hi [Name],

[Company]'s MCP adoption is moving fast — you're already running [relevant integration] in production or near it.

Security teams catching up consistently raise three requirements:

1. **Audit trail** — "What did the AI agent do, to what resource, and why?" (SOC 2, HIPAA, PCI-DSS)
2. **Policy enforcement** — Tool-level RBAC the MCP spec doesn't mandate and most servers don't implement
3. **Prompt injection protection** — GitHub MCP and Supabase's Cursor agent have both been publicly exploited

We built CAM-PROTOCOL for teams shipping MCP to enterprise. It's a TypeScript npm package that embeds directly — no sidecar, no proxy:

- Structured audit logs (CloudTrail-compatible, Splunk/Datadog-ready)
- OPA-compatible policy rules for tool-level access control
- Runtime prompt injection detection
- HITL gates for irreversible operations

Pro and Enterprise tiers available with SSO, SLA, and compliance documentation.

20-minute technical call with your security or platform team? I can show exactly how it integrates with your current MCP setup.

Best,
Dru Edwards
CAM-PROTOCOL | @cam-protocol/complete-arbitration-mesh

## Key Security Voices (for content marketing / backlink outreach)

- **Simon Willison** — "MCP has prompt injection security problems" (Apr 2025)
- **Semgrep** — "A Security Engineer's Guide to MCP" + "MCP: Model Context Propaganda?"
- **Palo Alto Unit 42** — "New Prompt Injection Attack Vectors Through MCP Sampling"
- **Checkmarx Zero** — "11 Emerging AI Security Risks with MCP"
- **eSentire** — "Critical Vulnerabilities Every CISO Must Address"
- **authzed.com** — "A Timeline of Model Context Protocol Security Breaches"
- **vulnerablemcp.info** — Comprehensive MCP security database
- **Microsoft** — "Protecting against indirect prompt injection attacks in MCP"
- **Snyk Labs** — OWASP LLMSVS MCP security controls contribution

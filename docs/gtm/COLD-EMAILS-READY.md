# Cold Emails — Ready to Send

Customized from Template A (MCP-PROSPECT-LIST.md) for the 5 warmest prospects. Copy-paste into your email client. Send from EdwardsTechPros@Outlook.com.

---

## Email 1: Supabase

**To**: Find via supabase.com/about or GitHub `supabase-community` org contributors
**Subject**: Governance layer for supabase-mcp — your users saw the Cursor breach

Hi,

I've been following the Supabase MCP server work — especially after the Cursor agent incident where prompt injection in support tickets leaked integration tokens.

That breach is exactly the gap CAM-PROTOCOL fills. It's an npm-embeddable TypeScript package that adds to any MCP server:

- Tool-level policy enforcement (allowlists, data classification gates, RBAC)
- Tamper-evident audit trails (structured JSON, SIEM-ready)
- Prompt injection detection and tool-call anomaly alerting
- Human-in-the-loop gates for destructive operations (like SQL execution against prod)

It drops into an existing MCP server in hours, not days. No proxy, no infrastructure change. Your enterprise users get governance without you changing the server's core behavior.

I'd love a 15-minute technical walkthrough where I show exactly how it integrates with supabase-mcp. Would any time this or next week work?

Best,
Dru Edwards
CAM-PROTOCOL | @cam-protocol/complete-arbitration-mesh
https://github.com/Complete-Arbitration-Mesh/CAM-PROTOCOL

---

## Email 2: GitHub MCP team

**To**: Find via github.com/github/github-mcp-server contributors or GitHub DevRel
**Subject**: Governance for github-mcp-server — before the next exploit

Hi,

The github-mcp-server exploit via malicious public issues (exfiltrating private repo data) is exactly the kind of attack CAM-PROTOCOL was built to prevent.

We're an npm-embeddable governance layer for MCP servers — tool-level RBAC, tamper-evident audit logs, prompt injection detection, and human-in-the-loop gates. It integrates in hours, no sidecar required.

GitHub's enterprise customers will ask "how do you audit AI agent tool calls?" when the MCP server ships to their environments. CAM-PROTOCOL is that answer — embedded in the server itself, producing CloudTrail-compatible audit events.

Would 15 minutes work to walk through how it plugs into github-mcp-server? I can show the integration against your actual tool schema.

Best,
Dru Edwards
CAM-PROTOCOL | @cam-protocol/complete-arbitration-mesh

---

## Email 3: Composio

**To**: Find via composio.dev/about or GitHub `ComposioHQ` org
**Subject**: Governance for Composio's 500+ OAuth tokens — the highest blast radius in MCP

Hi,

Composio aggregates OAuth tokens for 500+ apps through a single MCP endpoint. That's an incredible product — and also the highest blast radius in the MCP ecosystem if a single tool call is compromised.

We built CAM-PROTOCOL specifically for this scenario. It's an npm package that embeds directly in your MCP server to add:

- Per-token, per-tool policy enforcement (which models can call which OAuth-scoped tools)
- Full audit trail for every token usage (SIEM-ready for your enterprise customers' compliance teams)
- Prompt injection detection with configurable response policies
- Human approval gates for sensitive token operations

Your enterprise customers are going to ask "how do you govern what AI agents do with my Slack/Gmail/GitHub tokens?" This is the answer — embedded in Composio itself, not a third-party proxy.

15-minute technical walkthrough? I'll show it against your actual tool registry.

Best,
Dru Edwards
CAM-PROTOCOL | @cam-protocol/complete-arbitration-mesh

---

## Email 4: Pipedream

**To**: Find via pipedream.com/about or GitHub `PipedreamHQ` org
**Subject**: Governance for 8,000 MCP tools — your enterprise tier needs this

Hi,

Pipedream's 8,000 prebuilt MCP tools across 2,500+ API integrations is the largest tool surface in the ecosystem. For your enterprise customers, that surface is also the largest governance gap.

CAM-PROTOCOL is an npm-embeddable governance layer that adds:

- Tool-level allowlists and RBAC (which users/models can invoke which of your 8,000 tools)
- Structured audit trails for every tool execution (Splunk/Datadog-ready)
- Prompt injection detection at the tool-call boundary
- Rate limiting and anomaly alerting per-tool

It embeds directly — no proxy, no infrastructure change for your customers. The angle for Pipedream: your enterprise users already want to restrict which tools their AI agents can call. Offering CAM-PROTOCOL as a built-in governance layer differentiates Pipedream Enterprise from every other integration platform.

Would 15 minutes work for a technical walkthrough?

Best,
Dru Edwards
CAM-PROTOCOL | @cam-protocol/complete-arbitration-mesh

---

## Email 5: Semgrep (Partnership angle)

**To**: Find via semgrep.dev/about or the blog post authors
**Subject**: Semgrep + CAM-PROTOCOL = full-stack MCP security

Hi,

Your "Security Engineer's Guide to MCP" and the "Model Context Propaganda?" post are the two best pieces of MCP security analysis in the ecosystem. You clearly understand the governance gap.

Semgrep catches vulnerabilities in MCP server *code*. CAM-PROTOCOL enforces policy at MCP server *runtime*. Together, that's the full stack:

- **Semgrep**: static analysis finds insecure tool implementations before deployment
- **CAM-PROTOCOL**: runtime governance enforces tool-level RBAC, audit trails, and prompt injection detection after deployment

We'd love to explore a joint blog post, co-marketing arrangement, or even a formal integration (Semgrep rule pack for CAM-PROTOCOL policy files). The audience overlap is exact — security-conscious teams shipping MCP to production.

Would a 20-minute call to explore the fit make sense?

Best,
Dru Edwards
CAM-PROTOCOL | @cam-protocol/complete-arbitration-mesh
https://github.com/Complete-Arbitration-Mesh/CAM-PROTOCOL

---

## Sending Checklist

- [ ] Find contact emails for each prospect (GitHub profiles, company about pages, LinkedIn)
- [ ] Send all 5 within a 2-day window (not all same day — looks spammy)
- [ ] Set 48-hour follow-up reminders for non-replies
- [ ] Log each send in a tracking sheet (date, recipient, template, status)
- [ ] After 48h no-reply: send one follow-up ("Bumping this — happy to do async if a call doesn't work")
- [ ] After 7 days no-reply: move to nurture list, don't burn the contact

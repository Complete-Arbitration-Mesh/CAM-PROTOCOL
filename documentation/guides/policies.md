# CAM Platform: Policy Configuration Guide

This guide explains how to configure and manage policies for routing decisions in the CAM platform.

## Understanding Policies

Policies in CAM are rules that determine how requests are routed to AI providers. They enable you to:

- Control costs by routing to different providers based on request characteristics
- Ensure compliance with regulations by enforcing data residency or model selection rules
- Optimize performance by selecting the fastest provider based on real-time metrics
- Implement failover strategies when providers are unavailable or return errors
- Balance load across multiple providers to maximize throughput

## Policy Hierarchy

CAM implements a hierarchical policy system:

1. **Global Policies**: Apply to all requests across the organization
2. **Project Policies**: Apply to all requests within a specific project
3. **User Policies**: Apply to all requests from a specific user
4. **Request-level Policies**: Apply to individual requests

Policies are evaluated from most specific to least specific, with request-level policies taking precedence over user policies, and so on.

## Policy Definition Format

Policies are defined in YAML or JSON format. Here's a basic example:

```yaml
name: cost-optimized-policy
description: "Route to the cheapest provider that meets requirements"
priority: 100
conditions:
  request:
    type: 
      equals: "text-generation"
  context:
    sensitivity:
      not_equals: "high"
actions:
  route:
    strategy: lowest-cost
    providers:
      - openai
      - anthropic
      - google
    models:
      - gpt-3.5-turbo
      - claude-instant
      - gemini-pro
    fallback:
      provider: openai
      model: gpt-3.5-turbo
```

## Creating and Managing Policies

### Using the Web Interface

1. Log in to the CAM Dashboard
2. Navigate to Policies > Create Policy
3. Fill in the policy details:
   - Name and description
   - Priority (higher numbers take precedence)
   - Conditions for when the policy applies
   - Actions to take when the policy matches
4. Click "Save Policy"

### Using the API

```bash
curl -X POST https://your-cam-instance.com/api/v1/policies \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "cost-optimized-policy",
    "description": "Route to the cheapest provider that meets requirements",
    "priority": 100,
    "conditions": {
      "request": {
        "type": {
          "equals": "text-generation"
        }
      },
      "context": {
        "sensitivity": {
          "not_equals": "high"
        }
      }
    },
    "actions": {
      "route": {
        "strategy": "lowest-cost",
        "providers": ["openai", "anthropic", "google"],
        "models": ["gpt-3.5-turbo", "claude-instant", "gemini-pro"],
        "fallback": {
          "provider": "openai",
          "model": "gpt-3.5-turbo"
        }
      }
    }
  }'
```

### Using Configuration Files

For GitOps-style management, you can define policies in YAML files:

1. Create a policy file:

```yaml
# policies/cost-optimized.yaml
name: cost-optimized-policy
description: "Route to the cheapest provider that meets requirements"
priority: 100
conditions:
  request:
    type: 
      equals: "text-generation"
  context:
    sensitivity:
      not_equals: "high"
actions:
  route:
    strategy: lowest-cost
    providers:
      - openai
      - anthropic
      - google
    models:
      - gpt-3.5-turbo
      - claude-instant
      - gemini-pro
    fallback:
      provider: openai
      model: gpt-3.5-turbo
```

2. Apply the policy using the CAM CLI:

```bash
cam policy apply -f policies/cost-optimized.yaml
```

## Policy Conditions

Conditions determine when a policy is applied. You can specify conditions on:

### Request Properties

```yaml
conditions:
  request:
    type:
      equals: "text-generation"  # or "embedding" or "image-generation", etc.
    content:
      contains: "confidential"
    tokens:
      greater_than: 100
    user_id:
      equals: "user123"
```

### Context Properties

```yaml
conditions:
  context:
    sensitivity:
      equals: "high"  # or "medium" or "low"
    region:
      in: ["us-east", "us-west"]
    project:
      equals: "customer-service"
```

### System State

```yaml
conditions:
  system:
    time:
      after: "17:00"
      before: "09:00"
    provider_health:
      openai:
        status:
          not_equals: "healthy"
    load:
      greater_than: 0.8
```

### Combining Conditions

You can use logical operators to combine conditions:

```yaml
conditions:
  and:
    - request:
        type:
          equals: "text-generation"
    - or:
        - context:
            sensitivity:
              equals: "high"
        - request:
            content:
              contains: "confidential"
```

## Policy Actions

Actions define what happens when a policy condition is met. The most common action is routing:

### Basic Routing

```yaml
actions:
  route:
    provider: openai
    model: gpt-4
```

### Strategy-Based Routing

```yaml
actions:
  route:
    strategy: lowest-cost  # or "fastest" or "highest-quality" or "random"
    providers:
      - openai
      - anthropic
    models:
      - gpt-3.5-turbo
      - claude-instant
```

### Content Transformation

```yaml
actions:
  transform:
    input:
      - type: "filter"
        pattern: "credit card number: \\d{16}"
        replacement: "credit card number: [REDACTED]"
  route:
    provider: openai
    model: gpt-3.5-turbo
```

### Response Modification

```yaml
actions:
  route:
    provider: openai
    model: gpt-4
  transform:
    output:
      - type: "append"
        content: "\n\nThis response was generated by an AI model and may contain errors."
```

## Advanced Policy Features

### Cost Control

```yaml
actions:
  route:
    strategy: lowest-cost
    max_cost_per_request: 0.05
    providers:
      - openai
      - anthropic
    models:
      - gpt-3.5-turbo
      - claude-instant
```

### Failover Handling

```yaml
actions:
  route:
    provider: openai
    model: gpt-4
    failover:
      - provider: anthropic
        model: claude-2
      - provider: google
        model: gemini-pro
    max_failovers: 2
    failover_reasons:
      - timeout
      - error
      - rate_limit
```

### Caching

```yaml
actions:
  cache:
    enabled: true
    ttl_seconds: 3600
    semantic_similarity_threshold: 0.95  # Professional Edition only
  route:
    provider: openai
    model: gpt-4
```

### Metrics and Logging

```yaml
actions:
  metrics:
    tags:
      team: "customer-service"
      environment: "production"
  log:
    level: "info"
    include_request: true
    include_response: false
  route:
    provider: openai
    model: gpt-3.5-turbo
```

## Policy Templates

The CAM platform includes several pre-defined policy templates:

### Cost-Optimized Template

```yaml
name: cost-optimized-policy
description: "Route to the cheapest provider that meets requirements"
priority: 100
conditions:
  request:
    type: 
      equals: "text-generation"
actions:
  route:
    strategy: lowest-cost
    providers:
      - openai
      - anthropic
      - google
    models:
      - gpt-3.5-turbo
      - claude-instant
      - gemini-pro
```

### High-Performance Template

```yaml
name: high-performance-policy
description: "Route to the fastest provider based on recent metrics"
priority: 100
conditions:
  request:
    type:
      equals: "text-generation"
    priority:
      equals: "high"
actions:
  route:
    strategy: fastest
    providers:
      - openai
      - anthropic
      - google
    models:
      - gpt-3.5-turbo
      - claude-instant
      - gemini-pro
```

### Compliance Template

```yaml
name: compliance-policy
description: "Ensure data stays in specific regions for compliance"
priority: 200  # Higher priority than other policies
conditions:
  context:
    sensitivity:
      equals: "high"
actions:
  route:
    providers:
      - azure-openai  # Only allow Azure OpenAI for sensitive data
    region:
      in: ["eu-west", "eu-central"]  # Only allow EU regions
```

## Testing Policies

Before applying a policy in production, you can test it:

### Using the Policy Simulator

1. Log in to the CAM Dashboard
2. Navigate to Policies > Policy Simulator
3. Enter a sample request and context
4. Click "Simulate" to see which policies would apply and how the request would be routed

### Using the API

```bash
curl -X POST https://your-cam-instance.com/api/v1/policies/simulate \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "policy": {
      "name": "test-policy",
      "conditions": {
        "request": {
          "type": {
            "equals": "text-generation"
          }
        }
      },
      "actions": {
        "route": {
          "provider": "openai",
          "model": "gpt-4"
        }
      }
    },
    "request": {
      "type": "text-generation",
      "content": "What is the capital of France?"
    },
    "context": {
      "sensitivity": "low"
    }
  }'
```

## Troubleshooting

### Policy Not Being Applied

If a policy isn't being applied as expected:

1. Check the policy priority - higher priority policies might be overriding it
2. Verify that the conditions match your request and context
3. Check the policy logs in the CAM Dashboard
4. Use the Policy Simulator to debug the issue

### Common Issues

- **Typos in condition fields**: Ensure property names match exactly
- **Incorrect priority ordering**: Higher numbers take precedence
- **Conflicting policies**: Multiple policies might be applying contrary actions
- **Syntax errors in YAML/JSON**: Validate your policy definitions

## Next Steps

- [Create custom policy strategies](/documentation/guides/custom-policy-strategies)
- [Integrate with organizational compliance rules](/documentation/guides/compliance-integration)
- [Set up policy auditing](/documentation/guides/policy-auditing)
- [Implement A/B testing for policies](/documentation/guides/policy-ab-testing)

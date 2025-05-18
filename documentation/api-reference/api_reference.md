# CAM API Reference

This document provides a comprehensive reference for the CAM API endpoints and client SDKs.

## Core API Endpoints

The CAM API follows RESTful principles and uses JSON for request and response bodies.

### Authentication

All API endpoints require authentication using either API keys (via the `X-API-Key` header) or JWT tokens (via the `Authorization` header with the `Bearer` scheme).

```
Authorization: Bearer eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...
```

or

```
X-API-Key: cam_xxxxxxxxxxxxxxxxxxxx
```

### Base URL

The base URL for all API endpoints is:

```
https://api.your-cam-instance.com/v1
```

For self-hosted deployments, replace `api.your-cam-instance.com` with your domain.

### Endpoints

#### Submit Intent

Submit an intent for processing by the CAM arbitration engine.

```
POST /intents
```

**Request Body:**

```json
{
  "content": "What is the capital of France?",
  "intent": {
    "priority": 1,
    "maxCost": 0.01,
    "maxLatency": 500,
    "preferences": {
      "providers": ["openai", "anthropic"],
      "models": ["gpt-3.5-turbo", "claude-instant"]
    },
    "requirements": {
      "compliance": ["GDPR"],
      "capabilities": ["text-generation"]
    }
  }
}
```

**Response:**

```json
{
  "id": "intent_xxxxxxxxxxxxxxxxxxxx",
  "content": "The capital of France is Paris.",
  "metadata": {
    "provider": "anthropic",
    "model": "claude-instant",
    "cost": 0.00023,
    "latency": 320,
    "routingDecision": {
      "policyApplied": "cost-optimized",
      "timestamp": "2023-05-15T12:34:56Z"
    }
  }
}
```

#### Get Intent

Retrieve the status and result of a previously submitted intent.

```
GET /intents/{intent_id}
```

**Response:**

```json
{
  "id": "intent_xxxxxxxxxxxxxxxxxxxx",
  "status": "completed",
  "content": "The capital of France is Paris.",
  "metadata": {
    "provider": "anthropic",
    "model": "claude-instant",
    "cost": 0.00023,
    "latency": 320,
    "routingDecision": {
      "policyApplied": "cost-optimized",
      "timestamp": "2023-05-15T12:34:56Z"
    }
  }
}
```

#### List Intents

List all intents for the authenticated user or organization.

```
GET /intents
```

**Query Parameters:**

- `limit`: Maximum number of intents to return (default: 10, max: 100)
- `offset`: Offset for pagination (default: 0)
- `status`: Filter by status (e.g., `pending`, `completed`, `failed`)

**Response:**

```json
{
  "intents": [
    {
      "id": "intent_xxxxxxxxxxxxxxxxxxxx",
      "status": "completed",
      "content": "The capital of France is Paris.",
      "metadata": {
        "provider": "anthropic",
        "model": "claude-instant",
        "cost": 0.00023,
        "latency": 320
      }
    },
    {
      "id": "intent_yyyyyyyyyyyyyyyyyyyy",
      "status": "pending",
      "content": null,
      "metadata": null
    }
  ],
  "pagination": {
    "total": 42,
    "limit": 10,
    "offset": 0
  }
}
```

## Client SDKs

The CAM platform provides official client SDKs for multiple languages:

### JavaScript/TypeScript SDK

```typescript
import { CAMClient } from '@cam/sdk';

const cam = new CAMClient({
  apiKey: 'your-api-key',
  endpoint: 'https://your-cam-instance.com',
});

const response = await cam.submitIntent({
  content: "What is the capital of France?",
  intent: {
    priority: 1,
    maxCost: 0.01,
    maxLatency: 500
  }
});
```

### Python SDK

```python
from cam_sdk import CAMClient

cam = CAMClient(
    api_key='your-api-key',
    endpoint='https://your-cam-instance.com'
)

response = cam.submit_intent(
    content="What is the capital of France?",
    intent={
        "priority": 1,
        "max_cost": 0.01,
        "max_latency": 500
    }
)
```

### Go SDK

```go
package main

import (
    "fmt"
    "github.com/cam-protocol/cam-go"
)

func main() {
    client := cam.NewClient(cam.ClientOptions{
        APIKey:   "your-api-key",
        Endpoint: "https://your-cam-instance.com",
    })

    response, err := client.SubmitIntent(cam.IntentRequest{
        Content: "What is the capital of France?",
        Intent: cam.Intent{
            Priority:   1,
            MaxCost:    0.01,
            MaxLatency: 500,
        },
    })

    if err != nil {
        fmt.Println("Error:", err)
        return
    }

    fmt.Println(response.Content)
}
```

## WebSocket API

For real-time updates on intent processing, you can connect to the WebSocket API:

```javascript
const ws = new WebSocket('wss://api.your-cam-instance.com/v1/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'authenticate',
    token: 'your-jwt-token'
  }));

  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'intents'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Intent update:', data);
};
```

## Error Handling

The API uses standard HTTP status codes to indicate success or failure. In case of an error, the response will include an error object:

```json
{
  "error": {
    "type": "validation_error",
    "message": "Maximum cost must be greater than 0",
    "details": {
      "field": "intent.maxCost"
    }
  }
}
```

Common error types:

- `validation_error`: Invalid request parameters
- `authentication_error`: Invalid or missing authentication
- `authorization_error`: Insufficient permissions
- `rate_limit_error`: Rate limit exceeded
- `provider_error`: Error from the underlying provider
- `internal_error`: Internal server error

For more detailed information on the API, see the [OpenAPI specification](/documentation/api-reference/openapi.yaml).

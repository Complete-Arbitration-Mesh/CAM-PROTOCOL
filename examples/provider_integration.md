# CAM Provider Integration Examples

This directory contains examples of how to integrate different AI providers with the CAM platform.

## Supported Providers

The CAM platform currently supports the following providers in the Core tier:

- OpenAI
- Anthropic
- Google AI (Gemini/Vertex AI)
- Azure OpenAI
- Ollama (local models)

Professional and Enterprise tiers support additional providers and advanced features.

## Basic Provider Integration Example

Here's a basic example of how to use the CAM SDK to route requests to AI providers:

```typescript
import { CAMClient } from '@cam/sdk';

// Initialize the CAM client
const cam = new CAMClient({
  apiKey: 'your-api-key',
  endpoint: 'https://your-cam-instance.com',
});

// Define a request with intent
const response = await cam.submitIntent({
  content: "What is the capital of France?",
  intent: {
    priority: 1,
    maxCost: 0.01,
    maxLatency: 500,
    preferences: {
      providers: ['openai', 'anthropic'],
      models: ['gpt-3.5-turbo', 'claude-instant'],
    },
    requirements: {
      compliance: ['GDPR'],
      capabilities: ['text-generation'],
    }
  }
});

console.log(response.content);
console.log(`Provider used: ${response.metadata.provider}`);
console.log(`Model used: ${response.metadata.model}`);
console.log(`Cost: ${response.metadata.cost}`);
console.log(`Latency: ${response.metadata.latency}ms`);
```

## Provider-specific Configurations

Each provider can be configured with specific options:

### OpenAI

```typescript
// In your CAM configuration
const cam = new CAMClient({
  providers: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      organization: process.env.OPENAI_ORGANIZATION,
      defaultModel: 'gpt-4',
      maxTokens: 1000,
    }
  }
});
```

### Anthropic

```typescript
// In your CAM configuration
const cam = new CAMClient({
  providers: {
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      defaultModel: 'claude-2',
      maxTokens: 1000,
    }
  }
});
```

### Google AI

```typescript
// In your CAM configuration
const cam = new CAMClient({
  providers: {
    google: {
      apiKey: process.env.GOOGLE_API_KEY,
      projectId: process.env.GOOGLE_PROJECT_ID,
      defaultModel: 'gemini-pro',
    }
  }
});
```

## Advanced Provider Configuration

For more advanced use cases, you can specify provider-specific settings:

```typescript
// Configure cost weights for each provider
const cam = new CAMClient({
  costConfiguration: {
    openai: {
      'gpt-3.5-turbo': 0.002, // per 1K tokens
      'gpt-4': 0.06,          // per 1K tokens
    },
    anthropic: {
      'claude-instant': 0.0025, // per 1K tokens
      'claude-2': 0.11,         // per 1K tokens
    }
  },
  
  // Configure latency expectations
  latencyConfiguration: {
    openai: {
      'gpt-3.5-turbo': 500, // expected ms
      'gpt-4': 2000,        // expected ms
    },
    anthropic: {
      'claude-instant': 300, // expected ms
      'claude-2': 1800,      // expected ms
    }
  }
});
```

## Custom Provider Integration

You can also create and register custom providers:

```typescript
import { CAMClient, Provider } from '@cam/sdk';

// Create a custom provider
class MyCustomProvider implements Provider {
  constructor(private apiKey: string) {}
  
  async generate(prompt: string, options: any) {
    // Custom implementation to call your own model
    const response = await fetch('https://my-custom-ai.com/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, ...options }),
    });
    
    const data = await response.json();
    return {
      content: data.response,
      metadata: {
        model: 'custom-model',
        cost: data.usage.cost,
        latency: data.performance.latency,
      }
    };
  }
}

// Register the custom provider
const cam = new CAMClient();
cam.registerProvider('my-custom-ai', new MyCustomProvider('my-api-key'));

// Use it in requests
const response = await cam.submitIntent({
  content: "What is the capital of France?",
  intent: {
    preferences: {
      providers: ['my-custom-ai'],
    }
  }
});
```

For more detailed examples and documentation, see the [Provider Integration Guide](/documentation/guides/provider-integration.md).

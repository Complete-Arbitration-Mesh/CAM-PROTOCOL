# CAM JavaScript SDK

This package provides a JavaScript/TypeScript client for interacting with the Cognitive Arbitration Mesh (CAM) API.

## Installation

```bash
# npm
npm install @cam/sdk

# yarn
yarn add @cam/sdk

# pnpm
pnpm add @cam/sdk
```

## Quick Start

```javascript
import { CAMClient } from '@cam/sdk';

// Initialize client
const cam = new CAMClient({ apiKey: 'your-api-key' });

// Submit an intent
const response = await cam.submitIntent({
  content: 'What is the capital of France?',
  intent: {
    priority: 1,
    maxCost: 0.01,
    maxLatency: 500,
    preferences: {
      providers: ['openai', 'anthropic'],
      models: ['gpt-3.5-turbo', 'claude-instant']
    },
    requirements: {
      compliance: ['GDPR'],
      capabilities: ['text-generation']
    }
  }
});

console.log(response.content);
console.log(`Provider used: ${response.metadata.provider}`);
console.log(`Model used: ${response.metadata.model}`);
console.log(`Cost: ${response.metadata.cost}`);
console.log(`Latency: ${response.metadata.latency}ms`);
```

## TypeScript Support

This package includes TypeScript type definitions:

```typescript
import { CAMClient, Intent, IntentResponse } from '@cam/sdk';

const cam = new CAMClient({ apiKey: 'your-api-key' });

const intent: Intent = {
  priority: 1,
  maxCost: 0.01,
  maxLatency: 500
};

const response: IntentResponse = await cam.submitIntent({
  content: 'What is the capital of France?',
  intent
});
```

## Authentication

You can provide your API key in several ways:

1. Directly in the client constructor:
   ```javascript
   const cam = new CAMClient({ apiKey: 'your-api-key' });
   ```

2. Via the environment variable:
   ```bash
   export CAM_API_KEY="your-api-key"
   ```
   ```javascript
   const cam = new CAMClient(); // Will use CAM_API_KEY from environment
   ```

## Provider Integration

### Using Built-in Providers

```javascript
import { CAMClient, OpenAIProvider } from '@cam/sdk';

// Initialize client with a provider
const cam = new CAMClient({
  apiKey: 'your-cam-api-key',
  providers: {
    openai: new OpenAIProvider({
      apiKey: 'your-openai-api-key',
      defaultModel: 'gpt-4'
    })
  }
});
```

### Creating Custom Providers

You can create custom providers by extending the `Provider` class:

```javascript
import { CAMClient, Provider } from '@cam/sdk';

class MyCustomProvider extends Provider {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey;
  }
  
  async generate(prompt, options = {}) {
    // Implement your provider logic here
    // ...
    
    return {
      content: 'Generated response',
      metadata: {
        model: 'my-custom-model',
        provider: 'custom-provider',
        cost: 0.001,
        latency: 100
      }
    };
  }
}

// Register the custom provider
const cam = new CAMClient({ apiKey: 'your-cam-api-key' });
cam.registerProvider('my-custom-provider', new MyCustomProvider('provider-api-key'));
```

## API Reference

### `CAMClient`

#### Constructor

```javascript
new CAMClient(options)
```

- `options` (object, optional): Configuration options
  - `apiKey` (string, optional): API key for authentication
  - `endpoint` (string, optional): CAM API endpoint
  - `providers` (object, optional): Provider-specific configuration
  - `costConfiguration` (object, optional): Cost weights for providers and models
  - `latencyConfiguration` (object, optional): Expected latency for providers and models

#### Methods

##### `submitIntent`

```javascript
submitIntent(params)
```

Submit an intent to the CAM arbitration engine.

- `params` (object): Request parameters
  - `content` (string): The content to process
  - `intent` (object, optional): Intent specification
    - `priority` (number, optional): Priority level (1-10)
    - `maxCost` (number, optional): Maximum cost in USD
    - `maxLatency` (number, optional): Maximum latency in milliseconds
    - `preferences` (object, optional): Provider and model preferences
      - `providers` (string[], optional): Preferred providers
      - `models` (string[], optional): Preferred models
    - `requirements` (object, optional): Compliance and capability requirements
      - `compliance` (string[], optional): Required compliance standards
      - `capabilities` (string[], optional): Required capabilities

Returns a Promise that resolves to an object with content and metadata.

##### `getIntent`

```javascript
getIntent(intentId)
```

Get the status of a previously submitted intent.

- `intentId` (string): The ID of the intent to retrieve

Returns a Promise that resolves to an object with intent status and result.

##### `listIntents`

```javascript
listIntents(options)
```

List all intents for the authenticated user or organization.

- `options` (object, optional): List options
  - `limit` (number, optional): Maximum number of intents to return
  - `offset` (number, optional): Offset for pagination
  - `status` (string, optional): Filter by status

Returns a Promise that resolves to an object with list of intents and pagination info.

##### `registerProvider`

```javascript
registerProvider(name, provider)
```

Register a custom provider.

- `name` (string): Provider name
- `provider` (Provider): Provider implementation

### `Provider`

Base class for CAM providers.

#### Methods

##### `generate`

```javascript
generate(prompt, options)
```

Generate a response from the provider.

- `prompt` (string): Input prompt
- `options` (object, optional): Provider-specific options

Returns a Promise that resolves to an object with content and metadata.

### `OpenAIProvider`

OpenAI provider implementation.

#### Constructor

```javascript
new OpenAIProvider(options)
```

- `options` (object): Configuration options
  - `apiKey` (string): OpenAI API key
  - `defaultModel` (string, optional): Default model to use
  - `organization` (string, optional): OpenAI organization

### `CAMError`

Error class for CAM-specific errors.

#### Constructor

```javascript
new CAMError(message, type, details)
```

- `message` (string): Error message
- `type` (string): Error type
- `details` (object, optional): Additional error details

## License

Apache License 2.0

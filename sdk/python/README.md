# CAM Python SDK

This package provides a Python client for interacting with the Cognitive Arbitration Mesh (CAM) API.

## Installation

```bash
pip install cam-sdk
```

## Quick Start

```python
from cam_sdk import CAMClient

# Initialize client
cam = CAMClient(api_key="your-api-key")

# Submit an intent
response = cam.submit_intent(
    content="What is the capital of France?",
    intent={
        "priority": 1,
        "max_cost": 0.01,
        "max_latency": 500,
        "preferences": {
            "providers": ["openai", "anthropic"],
            "models": ["gpt-3.5-turbo", "claude-instant"]
        },
        "requirements": {
            "compliance": ["GDPR"],
            "capabilities": ["text-generation"]
        }
    }
)

print(response["content"])
print(f"Provider used: {response['metadata']['provider']}")
print(f"Model used: {response['metadata']['model']}")
print(f"Cost: {response['metadata']['cost']}")
print(f"Latency: {response['metadata']['latency']}ms")
```

## Authentication

You can provide your API key in several ways:

1. Directly in the client constructor:
   ```python
   cam = CAMClient(api_key="your-api-key")
   ```

2. Via the environment variable:
   ```bash
   export CAM_API_KEY="your-api-key"
   ```
   ```python
   cam = CAMClient()  # Will use CAM_API_KEY from environment
   ```

## Provider Integration

### Using Built-in Providers

```python
from cam_sdk import CAMClient, OpenAIProvider

# Initialize client with a provider
cam = CAMClient(
    api_key="your-cam-api-key",
    providers={
        "openai": OpenAIProvider(
            api_key="your-openai-api-key",
            default_model="gpt-4"
        )
    }
)
```

### Creating Custom Providers

You can create custom providers by extending the `Provider` class:

```python
from cam_sdk import Provider, CAMClient

class MyCustomProvider(Provider):
    def __init__(self, api_key):
        self.api_key = api_key
        
    def generate(self, prompt, options=None):
        options = options or {}
        
        # Implement your provider logic here
        # ...
        
        return {
            "content": "Generated response",
            "metadata": {
                "model": "my-custom-model",
                "provider": "custom-provider",
                "cost": 0.001,
                "latency": 100
            }
        }

# Register the custom provider
cam = CAMClient(api_key="your-cam-api-key")
cam.register_provider("my-custom-provider", MyCustomProvider("provider-api-key"))
```

## API Reference

### `CAMClient`

#### Constructor

```python
CAMClient(
    api_key=None,
    endpoint=None,
    providers=None,
    cost_configuration=None,
    latency_configuration=None
)
```

- `api_key` (str, optional): API key for authentication
- `endpoint` (str, optional): CAM API endpoint
- `providers` (dict, optional): Provider-specific configuration
- `cost_configuration` (dict, optional): Cost weights for providers and models
- `latency_configuration` (dict, optional): Expected latency for providers and models

#### Methods

##### `submit_intent`

```python
submit_intent(content, intent=None, **kwargs)
```

Submit an intent to the CAM arbitration engine.

- `content` (str): The content to process
- `intent` (dict, optional): Intent specification
- `**kwargs`: Additional parameters to include in the intent

Returns a dictionary with content and metadata.

##### `get_intent`

```python
get_intent(intent_id)
```

Get the status of a previously submitted intent.

- `intent_id` (str): The ID of the intent to retrieve

Returns a dictionary with intent status and result.

##### `list_intents`

```python
list_intents(limit=None, offset=None, status=None)
```

List all intents for the authenticated user or organization.

- `limit` (int, optional): Maximum number of intents to return
- `offset` (int, optional): Offset for pagination
- `status` (str, optional): Filter by status

Returns a dictionary with list of intents and pagination info.

##### `register_provider`

```python
register_provider(name, provider)
```

Register a custom provider.

- `name` (str): Provider name
- `provider` (Provider): Provider implementation

### `Provider`

Base class for CAM providers.

#### Methods

##### `generate`

```python
generate(prompt, options=None)
```

Generate a response from the provider.

- `prompt` (str): Input prompt
- `options` (dict, optional): Provider-specific options

Returns a dictionary with content and metadata.

### `OpenAIProvider`

OpenAI provider implementation.

#### Constructor

```python
OpenAIProvider(api_key, default_model="gpt-3.5-turbo", organization=None)
```

- `api_key` (str): OpenAI API key
- `default_model` (str, optional): Default model to use
- `organization` (str, optional): OpenAI organization ID

### `CAMError`

Exception raised for CAM API errors.

#### Constructor

```python
CAMError(message, error_type, details=None)
```

- `message` (str): Error message
- `error_type` (str): Error type
- `details` (dict, optional): Additional error details

## License

Apache License 2.0

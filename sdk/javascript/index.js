// CAM JavaScript/TypeScript SDK

/**
 * CAM Client for JavaScript/TypeScript applications
 */
export class CAMClient {
  /**
   * Create a new CAM client
   * @param {Object} options - Configuration options
   * @param {string} options.apiKey - API key for authentication
   * @param {string} options.endpoint - CAM API endpoint
   * @param {Object} options.providers - Provider-specific configuration
   * @param {Object} options.costConfiguration - Cost weights for providers and models
   * @param {Object} options.latencyConfiguration - Expected latency for providers and models
   */
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.CAM_API_KEY;
    this.endpoint = options.endpoint || process.env.CAM_ENDPOINT || 'https://api.cam-protocol.org';
    this.providers = options.providers || {};
    this.costConfiguration = options.costConfiguration || {};
    this.latencyConfiguration = options.latencyConfiguration || {};
    
    if (!this.apiKey) {
      console.warn('CAM client initialized without an API key. Set options.apiKey or CAM_API_KEY environment variable.');
    }
  }

  /**
   * Submit an intent to the CAM arbitration engine
   * @param {Object} params - Request parameters
   * @param {string} params.content - The content to process
   * @param {Object} params.intent - Intent specification
   * @param {number} params.intent.priority - Priority level (1-10)
   * @param {number} params.intent.maxCost - Maximum cost in USD
   * @param {number} params.intent.maxLatency - Maximum latency in milliseconds
   * @param {Object} params.intent.preferences - Provider and model preferences
   * @param {string[]} params.intent.preferences.providers - Preferred providers
   * @param {string[]} params.intent.preferences.models - Preferred models
   * @param {Object} params.intent.requirements - Compliance and capability requirements
   * @param {string[]} params.intent.requirements.compliance - Required compliance standards
   * @param {string[]} params.intent.requirements.capabilities - Required capabilities
   * @returns {Promise<Object>} - Response with content and metadata
   */
  async submitIntent(params) {
    const { content, intent } = params;
    
    if (!content) {
      throw new Error('Content is required');
    }
    
    const response = await fetch(`${this.endpoint}/v1/intents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'X-CAM-SDK-Version': '1.0.0',
        'X-CAM-SDK-Language': 'javascript',
      },
      body: JSON.stringify({ content, intent }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new CAMError(error.error.message, error.error.type, error.error.details);
    }
    
    return await response.json();
  }
  
  /**
   * Get the status of a previously submitted intent
   * @param {string} intentId - The ID of the intent to retrieve
   * @returns {Promise<Object>} - Intent status and result
   */
  async getIntent(intentId) {
    if (!intentId) {
      throw new Error('Intent ID is required');
    }
    
    const response = await fetch(`${this.endpoint}/v1/intents/${intentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'X-CAM-SDK-Version': '1.0.0',
        'X-CAM-SDK-Language': 'javascript',
      },
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new CAMError(error.error.message, error.error.type, error.error.details);
    }
    
    return await response.json();
  }
  
  /**
   * List all intents for the authenticated user or organization
   * @param {Object} options - List options
   * @param {number} options.limit - Maximum number of intents to return
   * @param {number} options.offset - Offset for pagination
   * @param {string} options.status - Filter by status
   * @returns {Promise<Object>} - List of intents with pagination info
   */
  async listIntents(options = {}) {
    const queryParams = new URLSearchParams();
    if (options.limit) queryParams.append('limit', options.limit);
    if (options.offset) queryParams.append('offset', options.offset);
    if (options.status) queryParams.append('status', options.status);
    
    const url = `${this.endpoint}/v1/intents${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'X-CAM-SDK-Version': '1.0.0',
        'X-CAM-SDK-Language': 'javascript',
      },
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new CAMError(error.error.message, error.error.type, error.error.details);
    }
    
    return await response.json();
  }
  
  /**
   * Register a custom provider
   * @param {string} name - Provider name
   * @param {Object} provider - Provider implementation
   */
  registerProvider(name, provider) {
    if (!name) {
      throw new Error('Provider name is required');
    }
    
    if (!provider || typeof provider.generate !== 'function') {
      throw new Error('Provider must implement generate() method');
    }
    
    this.providers[name] = provider;
  }
}

/**
 * Error class for CAM-specific errors
 */
export class CAMError extends Error {
  /**
   * Create a CAM error
   * @param {string} message - Error message
   * @param {string} type - Error type
   * @param {Object} details - Additional error details
   */
  constructor(message, type, details) {
    super(message);
    this.name = 'CAMError';
    this.type = type;
    this.details = details;
  }
}

/**
 * Provider interface
 * @interface Provider
 */
export class Provider {
  /**
   * Generate a response from the provider
   * @param {string} prompt - Input prompt
   * @param {Object} options - Provider-specific options
   * @returns {Promise<Object>} - Provider response
   */
  async generate(prompt, options) {
    throw new Error('Method not implemented');
  }
}

/**
 * Example OpenAI provider implementation
 */
export class OpenAIProvider extends Provider {
  /**
   * Create an OpenAI provider
   * @param {Object} options - Configuration options
   * @param {string} options.apiKey - OpenAI API key
   * @param {string} options.defaultModel - Default model to use
   */
  constructor(options) {
    super();
    this.apiKey = options.apiKey;
    this.defaultModel = options.defaultModel || 'gpt-3.5-turbo';
    this.organization = options.organization;
  }
  
  /**
   * Generate a response using OpenAI
   * @param {string} prompt - Input prompt
   * @param {Object} options - Provider-specific options
   * @returns {Promise<Object>} - Provider response
   */
  async generate(prompt, options = {}) {
    const model = options.model || this.defaultModel;
    const maxTokens = options.maxTokens || 1000;
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        ...(this.organization && { 'OpenAI-Organization': this.organization }),
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error.message}`);
    }
    
    const data = await response.json();
    
    return {
      content: data.choices[0].message.content,
      metadata: {
        model,
        provider: 'openai',
        cost: this._calculateCost(data.usage, model),
        latency: performance.now(), // Simplified; actual implementation would measure real latency
      },
    };
  }
  
  /**
   * Calculate the cost of an OpenAI request
   * @param {Object} usage - Token usage information
   * @param {string} model - Model used
   * @returns {number} - Cost in USD
   * @private
   */
  _calculateCost(usage, model) {
    // Simplified cost calculation
    const rates = {
      'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
    };
    
    const rate = rates[model] || rates['gpt-3.5-turbo'];
    const inputCost = (usage.prompt_tokens / 1000) * rate.input;
    const outputCost = (usage.completion_tokens / 1000) * rate.output;
    
    return inputCost + outputCost;
  }
}

// Node.js CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CAMClient,
    CAMError,
    Provider,
    OpenAIProvider,
  };
}

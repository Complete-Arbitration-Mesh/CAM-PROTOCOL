// TypeScript declaration file for CAM JavaScript SDK

/**
 * Options for CAM client initialization
 */
export interface CAMClientOptions {
  /** API key for authentication */
  apiKey?: string;
  
  /** CAM API endpoint */
  endpoint?: string;
  
  /** Provider-specific configuration */
  providers?: Record<string, Provider>;
  
  /** Cost weights for providers and models */
  costConfiguration?: Record<string, Record<string, number>>;
  
  /** Expected latency for providers and models */
  latencyConfiguration?: Record<string, Record<string, number>>;
}

/**
 * Intent specification
 */
export interface Intent {
  /** Priority level (1-10) */
  priority?: number;
  
  /** Maximum cost in USD */
  maxCost?: number;
  
  /** Maximum latency in milliseconds */
  maxLatency?: number;
  
  /** Provider and model preferences */
  preferences?: {
    /** Preferred providers */
    providers?: string[];
    
    /** Preferred models */
    models?: string[];
  };
  
  /** Compliance and capability requirements */
  requirements?: {
    /** Required compliance standards */
    compliance?: string[];
    
    /** Required capabilities */
    capabilities?: string[];
  };
}

/**
 * Parameters for submitIntent method
 */
export interface SubmitIntentParams {
  /** The content to process */
  content: string;
  
  /** Intent specification */
  intent?: Intent;
}

/**
 * Response metadata
 */
export interface ResponseMetadata {
  /** Provider used */
  provider: string;
  
  /** Model used */
  model: string;
  
  /** Cost in USD */
  cost: number;
  
  /** Latency in milliseconds */
  latency: number;
  
  /** Routing decision information */
  routingDecision?: {
    /** Policy applied */
    policyApplied: string;
    
    /** Timestamp of the decision */
    timestamp: string;
  };
}

/**
 * Response from submitIntent
 */
export interface IntentResponse {
  /** Intent ID */
  id: string;
  
  /** Response content */
  content: string;
  
  /** Response metadata */
  metadata: ResponseMetadata;
}

/**
 * Intent status response
 */
export interface IntentStatusResponse extends IntentResponse {
  /** Intent status */
  status: 'pending' | 'completed' | 'failed';
}

/**
 * List intents options
 */
export interface ListIntentsOptions {
  /** Maximum number of intents to return */
  limit?: number;
  
  /** Offset for pagination */
  offset?: number;
  
  /** Filter by status */
  status?: 'pending' | 'completed' | 'failed';
}

/**
 * List intents response
 */
export interface ListIntentsResponse {
  /** Array of intents */
  intents: IntentStatusResponse[];
  
  /** Pagination information */
  pagination: {
    /** Total number of intents */
    total: number;
    
    /** Limit used */
    limit: number;
    
    /** Offset used */
    offset: number;
  };
}

/**
 * Provider implementation
 */
export interface Provider {
  /**
   * Generate a response from the provider
   * @param prompt - Input prompt
   * @param options - Provider-specific options
   * @returns Provider response
   */
  generate(prompt: string, options?: Record<string, any>): Promise<{
    content: string;
    metadata: Record<string, any>;
  }>;
}

/**
 * Error class for CAM-specific errors
 */
export class CAMError extends Error {
  /** Error type */
  type: string;
  
  /** Additional error details */
  details?: Record<string, any>;
  
  /**
   * Create a CAM error
   * @param message - Error message
   * @param type - Error type
   * @param details - Additional error details
   */
  constructor(message: string, type: string, details?: Record<string, any>);
}

/**
 * Base provider class
 */
export class Provider {
  /**
   * Generate a response from the provider
   * @param prompt - Input prompt
   * @param options - Provider-specific options
   */
  generate(prompt: string, options?: Record<string, any>): Promise<{
    content: string;
    metadata: Record<string, any>;
  }>;
}

/**
 * OpenAI provider implementation
 */
export class OpenAIProvider extends Provider {
  /**
   * Create an OpenAI provider
   * @param options - Configuration options
   */
  constructor(options: {
    /** OpenAI API key */
    apiKey: string;
    
    /** Default model to use */
    defaultModel?: string;
    
    /** OpenAI organization */
    organization?: string;
  });
}

/**
 * CAM Client for JavaScript/TypeScript applications
 */
export class CAMClient {
  /**
   * Create a new CAM client
   * @param options - Configuration options
   */
  constructor(options?: CAMClientOptions);
  
  /**
   * Submit an intent to the CAM arbitration engine
   * @param params - Request parameters
   * @returns Response with content and metadata
   */
  submitIntent(params: SubmitIntentParams): Promise<IntentResponse>;
  
  /**
   * Get the status of a previously submitted intent
   * @param intentId - The ID of the intent to retrieve
   * @returns Intent status and result
   */
  getIntent(intentId: string): Promise<IntentStatusResponse>;
  
  /**
   * List all intents for the authenticated user or organization
   * @param options - List options
   * @returns List of intents with pagination info
   */
  listIntents(options?: ListIntentsOptions): Promise<ListIntentsResponse>;
  
  /**
   * Register a custom provider
   * @param name - Provider name
   * @param provider - Provider implementation
   */
  registerProvider(name: string, provider: Provider): void;
}

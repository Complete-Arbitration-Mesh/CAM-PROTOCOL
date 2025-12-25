/**
 * Subscription Manager
 *
 * Manages subscription tiers, features, and access control
 * based on subscription status.
 */

import { Logger } from '../shared/logger.js';
import { CAMError } from '../shared/errors.js';
import { StripeService } from './stripe-service.js';
import { StateManager } from '../core/state-manager.js';

export type SubscriptionTier = 'community' | 'professional' | 'enterprise';

export interface SubscriptionFeatures {
  maxRequests: number;
  maxAgents: number;
  advancedRouting: boolean;
  customPolicies: boolean;
  enterpriseAuth: boolean;
  advancedCollaboration: boolean;
  dedicatedSupport: boolean;
  sla: string;
}

export interface SubscriptionInfo {
  id: string;
  customerId: string;
  tier: SubscriptionTier;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid';
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  features: SubscriptionFeatures;
}

export interface SubscriptionManagerOptions {
  stripeService: StripeService;
  stateManager?: StateManager;
}

export class SubscriptionManager {
  private logger: Logger;
  private stripeService: StripeService;
  private stateManager: StateManager | undefined;
  
  // Feature definitions for each tier
  private readonly tierFeatures: Record<SubscriptionTier, SubscriptionFeatures> = {
    community: {
      maxRequests: 1000,
      maxAgents: 5,
      advancedRouting: false,
      customPolicies: false,
      enterpriseAuth: false,
      advancedCollaboration: false,
      dedicatedSupport: false,
      sla: 'best-effort'
    },
    professional: {
      maxRequests: 10000,
      maxAgents: 25,
      advancedRouting: true,
      customPolicies: true,
      enterpriseAuth: false,
      advancedCollaboration: true,
      dedicatedSupport: false,
      sla: '8x5'
    },
    enterprise: {
      maxRequests: 100000,
      maxAgents: 100,
      advancedRouting: true,
      customPolicies: true,
      enterpriseAuth: true,
      advancedCollaboration: true,
      dedicatedSupport: true,
      sla: '24x7'
    }
  };

  constructor(options: SubscriptionManagerOptions) {
    this.logger = new Logger('info'); // Initialize with a valid LogLevel
    this.stripeService = options.stripeService;
    this.stateManager = options.stateManager;

    this.logger.info('Subscription manager initialized', {
      hasUsageTracking: !!this.stateManager
    });
  }

  /**
   * Get subscription information for a customer
   */
  async getSubscriptionInfo(customerId: string): Promise<SubscriptionInfo | null> {
    try {
      // Retrieve customer from Stripe
      const customer = await this.stripeService.getCustomer(customerId);
      
      if (!customer.subscriptions || customer.subscriptions.data.length === 0) {
        this.logger.info('No active subscription found for customer', { customerId });
        return null;
      }
      
      // Get the most recent subscription
      const subscription = customer.subscriptions.data[0];
      
      // Determine the tier based on metadata or product
      const tier = this.determineTier(subscription);
      
      // Make sure subscription exists before accessing its properties
      if (!subscription) {
        throw new CAMError('Subscription not found for customer: ' + customerId, 'SUBSCRIPTION_NOT_FOUND', { details: { customerId } });
      }
      
      // Access subscription properties safely
      return {
        id: subscription.id,
        customerId,
        tier,
        status: subscription.status as any,
        // Handle Unix timestamp conversion safely
        currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        features: this.tierFeatures[tier]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to get subscription info', { errorMessage, customerId });
      throw new CAMError('Subscription error: Failed to retrieve subscription information', 'SUBSCRIPTION_RETRIEVAL_ERROR', { details: { customerId, errorMessage } });
    }
  }

  /**
   * Check if a feature is available for a given subscription
   */
  async hasFeature(customerId: string, feature: keyof SubscriptionFeatures): Promise<boolean> {
    const subscription = await this.getSubscriptionInfo(customerId);
    
    if (!subscription) {
      // Default to community tier features if no subscription exists
      return this.tierFeatures.community[feature] as any;
    }
    
    if (subscription.status !== 'active' && subscription.status !== 'trialing') {
      // If subscription is not active, default to community tier
      return this.tierFeatures.community[feature] as any;
    }
    
    return subscription.features[feature] as any;
  }

  /**
   * Upgrade a subscription to a higher tier
   */
  async upgradeSubscription(subscriptionId: string, newTier: SubscriptionTier): Promise<SubscriptionInfo> {
    try {
      const updatedSubscription = await this.stripeService.updateSubscription(subscriptionId, { planType: newTier });
      
      const customerId = updatedSubscription.customer as string;
      return await this.getSubscriptionInfo(customerId) as SubscriptionInfo;
    } catch (error) {
      this.logger.error('Failed to upgrade subscription', { error, subscriptionId, newTier });
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new CAMError('Subscription error: Failed to upgrade subscription', 'SUBSCRIPTION_UPGRADE_ERROR', { details: { subscriptionId, newTier, errorMessage } });
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string): Promise<void> {
    try {
      await this.stripeService.cancelSubscription(subscriptionId);
      this.logger.info('Subscription canceled successfully', { subscriptionId });
    } catch (error) {
      this.logger.error('Failed to cancel subscription', { error, subscriptionId });
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new CAMError('Subscription error: Failed to cancel subscription', 'SUBSCRIPTION_CANCEL_ERROR', { details: { subscriptionId, errorMessage } });
    }
  }

  /**
   * Create a checkout session for a subscription
   */
  async createCheckoutSession(customerId: string, tier: SubscriptionTier, successUrl: string, cancelUrl: string): Promise<string> {
    try {
      const session = await this.stripeService.createCheckoutSession({
        customerId,
        planType: tier,
        successUrl,
        cancelUrl,
        trialDays: tier === 'community' ? 0 : 14,
        metadata: {
          tier
        }
      });
      
      return session.url as string;
    } catch (error) {
      this.logger.error('Failed to create checkout session', { error, customerId, tier });
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new CAMError('Subscription error: Failed to create checkout session', 'CHECKOUT_SESSION_ERROR', { details: { customerId, tier, errorMessage } });
    }
  }

  /**
   * Get usage statistics for a subscription
   * Uses real usage data from StateManager when available
   */
  async getUsageStats(customerId: string): Promise<{
    requests: { used: number, limit: number },
    agents: { used: number, limit: number },
    tokens?: { used: number },
    cost?: { used: number },
    period?: { start: string, end: string }
  }> {
    const subscription = await this.getSubscriptionInfo(customerId);
    const features = subscription?.features || this.tierFeatures.community;

    // Get real usage data from StateManager if available
    if (this.stateManager) {
      const usage = this.stateManager.getCustomerUsage(customerId);

      return {
        requests: {
          used: usage.requests,
          limit: features.maxRequests
        },
        agents: {
          used: usage.agents,
          limit: features.maxAgents
        },
        tokens: {
          used: usage.tokens
        },
        cost: {
          used: Math.round(usage.cost * 10000) / 10000  // 4 decimal places
        },
        period: {
          start: usage.periodStart,
          end: usage.periodEnd
        }
      };
    }

    // Fallback: return zeros if no StateManager configured
    this.logger.warn('StateManager not configured, returning zero usage', { customerId });
    return {
      requests: { used: 0, limit: features.maxRequests },
      agents: { used: 0, limit: features.maxAgents }
    };
  }

  /**
   * Determine the subscription tier from a Stripe subscription
   */
  private determineTier(subscription: any): SubscriptionTier {
    // First try to get tier from metadata
    if (subscription.metadata && subscription.metadata.tier) {
      return subscription.metadata.tier as SubscriptionTier;
    }
    
    // If not in metadata, try to determine from the product ID
    const item = subscription.items.data[0];
    if (item && item.price && item.price.product) {
      const productId = typeof item.price.product === 'string' 
        ? item.price.product 
        : item.price.product.id;
      
      // This would need to be configured with actual product IDs
      if (productId === 'prod_enterprise') {
        return 'enterprise';
      } else if (productId === 'prod_professional') {
        return 'professional';
      }
    }
    
    // Default to community tier
    return 'community';
  }
}

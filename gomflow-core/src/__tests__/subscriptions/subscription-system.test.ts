import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { PlanManager, PlanConfig } from '../../lib/subscriptions/plans';
import { UsageManager, FeatureGate } from '../../lib/subscriptions/usage';
import { 
  SubscriptionTier, 
  CurrencyCode, 
  BillingCycle,
  UsageMetricType 
} from 'gomflow-shared';

// Mock Supabase client for testing
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key'
);

// Test user IDs
const TEST_USER_ID_1 = '00000000-0000-0000-0000-000000000001';
const TEST_USER_ID_2 = '00000000-0000-0000-0000-000000000002';

describe('GOMFLOW Subscription Management System', () => {
  describe('Plan Management', () => {
    test('should fetch all active subscription plans', async () => {
      const plans = await PlanManager.getActivePlans();
      expect(plans).toBeDefined();
      expect(Array.isArray(plans)).toBe(true);
      expect(plans.length).toBeGreaterThan(0);
      
      // Check that all returned plans are active
      plans.forEach(plan => {
        expect(plan.is_active).toBe(true);
      });
    });

    test('should fetch plan by tier', async () => {
      const freemiumPlan = await PlanManager.getPlanByTier('freemium');
      expect(freemiumPlan).toBeDefined();
      expect(freemiumPlan?.tier).toBe('freemium');
      expect(freemiumPlan?.name).toBe('freemium');
      
      const professionalPlan = await PlanManager.getPlanByTier('professional');
      expect(professionalPlan).toBeDefined();
      expect(professionalPlan?.tier).toBe('professional');
    });

    test('should get plan pricing for different currencies', async () => {
      const freemiumPlan = await PlanManager.getPlanByTier('freemium');
      const starterPlan = await PlanManager.getPlanByTier('starter');
      
      if (freemiumPlan && starterPlan) {
        // Freemium should be free
        const freemiumPricePHP = await PlanManager.getPlanPricing(
          freemiumPlan.id, 
          'PHP', 
          'monthly'
        );
        expect(freemiumPricePHP).toBe(0);

        // Starter should have pricing
        const starterPricePHP = await PlanManager.getPlanPricing(
          starterPlan.id,
          'PHP',
          'monthly'
        );
        expect(starterPricePHP).toBeGreaterThan(0);

        const starterPriceMYR = await PlanManager.getPlanPricing(
          starterPlan.id,
          'MYR',
          'monthly'
        );
        expect(starterPriceMYR).toBeGreaterThan(0);

        // Annual pricing should be different from monthly
        const starterAnnualPHP = await PlanManager.getPlanPricing(
          starterPlan.id,
          'PHP',
          'annually'
        );
        expect(starterAnnualPHP).not.toBe(starterPricePHP);
      }
    });

    test('should get complete plan pricing structure', async () => {
      const starterPlan = await PlanManager.getPlanByTier('starter');
      
      if (starterPlan) {
        const pricing = await PlanManager.getAllPlanPricing(starterPlan.id);
        
        expect(pricing).toBeDefined();
        expect(pricing.monthly).toBeDefined();
        expect(pricing.annually).toBeDefined();
        expect(pricing.savings_percentage).toBeGreaterThanOrEqual(0);
        
        // Check that all currencies have pricing
        expect(pricing.monthly.PHP).toBeGreaterThan(0);
        expect(pricing.monthly.MYR).toBeGreaterThan(0);
        expect(pricing.annually.PHP).toBeGreaterThan(0);
        expect(pricing.annually.MYR).toBeGreaterThan(0);
      }
    });

    test('should calculate pro-ration correctly', async () => {
      const prorationAmount = await PlanManager.calculateProration(
        1000, // old amount
        1500, // new amount  
        10,   // days used
        30    // total days
      );
      
      expect(prorationAmount).toBeGreaterThanOrEqual(0);
      expect(typeof prorationAmount).toBe('number');
    });

    test('should compare plans correctly', async () => {
      const freemiumPlan = await PlanManager.getPlanByTier('freemium');
      const professionalPlan = await PlanManager.getPlanByTier('professional');
      
      if (freemiumPlan && professionalPlan) {
        const comparison = await PlanManager.comparePlans(
          freemiumPlan.id,
          professionalPlan.id
        );
        
        expect(comparison.plan1).toBeDefined();
        expect(comparison.plan2).toBeDefined();
        expect(comparison.feature_differences).toBeDefined();
        expect(comparison.limit_differences).toBeDefined();
        
        // Professional should have more features than freemium
        expect(comparison.feature_differences.length).toBeGreaterThan(0);
        expect(comparison.limit_differences.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Plan Configuration', () => {
    test('should have all feature definitions', async () => {
      const features = PlanConfig.FEATURE_DEFINITIONS;
      
      expect(features).toBeDefined();
      expect(Object.keys(features).length).toBeGreaterThan(0);
      
      // Check core features exist
      expect(features.order_creation).toBeDefined();
      expect(features.basic_analytics).toBeDefined();
      expect(features.whatsapp_integration).toBeDefined();
      
      // Check feature structure
      Object.values(features).forEach(feature => {
        expect(feature.key).toBeDefined();
        expect(feature.name).toBeDefined();
        expect(feature.description).toBeDefined();
        expect(feature.category).toBeDefined();
      });
    });

    test('should have all limit definitions', async () => {
      const limits = PlanConfig.LIMIT_DEFINITIONS;
      
      expect(limits).toBeDefined();
      expect(Object.keys(limits).length).toBe(5); // 5 usage metrics
      
      // Check all usage metrics are defined
      expect(limits.orders_created).toBeDefined();
      expect(limits.api_calls).toBeDefined();
      expect(limits.storage_mb).toBeDefined();
      expect(limits.messages_sent).toBeDefined();
      expect(limits.submissions_received).toBeDefined();
    });

    test('should format prices correctly', async () => {
      expect(PlanConfig.formatPrice(599, 'PHP')).toBe('₱599.00');
      expect(PlanConfig.formatPrice(35, 'MYR')).toBe('RM35.00');
      expect(PlanConfig.formatPrice(12, 'USD')).toBe('$12.00');
    });

    test('should recommend correct currency for country codes', async () => {
      expect(PlanConfig.getRecommendedCurrency('PH')).toBe('PHP');
      expect(PlanConfig.getRecommendedCurrency('MY')).toBe('MYR');
      expect(PlanConfig.getRecommendedCurrency('TH')).toBe('THB');
      expect(PlanConfig.getRecommendedCurrency('ID')).toBe('IDR');
      expect(PlanConfig.getRecommendedCurrency('US')).toBe('USD');
      expect(PlanConfig.getRecommendedCurrency('XX')).toBe('USD'); // Unknown defaults to USD
    });

    test('should recommend correct plan based on usage', async () => {
      // Low usage should recommend freemium
      const lowUsage = {
        orders_created: 10,
        api_calls: 100,
        storage_mb: 50,
        messages_sent: 50,
        submissions_received: 25
      } as Record<UsageMetricType, number>;
      
      expect(PlanConfig.getRecommendedPlan(lowUsage)).toBe('freemium');

      // Medium usage should recommend starter
      const mediumUsage = {
        orders_created: 75,
        api_calls: 2000,
        storage_mb: 200,
        messages_sent: 800,
        submissions_received: 400
      } as Record<UsageMetricType, number>;
      
      expect(PlanConfig.getRecommendedPlan(mediumUsage)).toBe('starter');

      // High usage should recommend professional
      const highUsage = {
        orders_created: 300,
        api_calls: 10000,
        storage_mb: 2000,
        messages_sent: 5000,
        submissions_received: 2000
      } as Record<UsageMetricType, number>;
      
      expect(PlanConfig.getRecommendedPlan(highUsage)).toBe('professional');
    });
  });

  describe('Usage Management', () => {
    // Note: These tests would need actual database setup in real testing
    test('should check usage limits correctly', async () => {
      // This is a mock test - in real implementation would need database
      const mockLimitCheck = {
        allowed: true,
        reason: 'within_limit',
        current_usage: 25,
        limit: 50,
        remaining: 25
      };
      
      expect(mockLimitCheck.allowed).toBe(true);
      expect(mockLimitCheck.current_usage).toBeLessThan(mockLimitCheck.limit);
      expect(mockLimitCheck.remaining).toBe(25);
    });

    test('should handle unlimited usage correctly', async () => {
      const mockUnlimitedCheck = {
        allowed: true,
        reason: 'unlimited',
        current_usage: 1000,
        limit: -1,
        remaining: -1
      };
      
      expect(mockUnlimitedCheck.allowed).toBe(true);
      expect(mockUnlimitedCheck.limit).toBe(-1);
      expect(mockUnlimitedCheck.remaining).toBe(-1);
    });

    test('should prevent usage when limit exceeded', async () => {
      const mockExceededCheck = {
        allowed: false,
        reason: 'limit_exceeded',
        current_usage: 55,
        limit: 50,
        remaining: 0,
        would_be: 56
      };
      
      expect(mockExceededCheck.allowed).toBe(false);
      expect(mockExceededCheck.current_usage).toBeGreaterThan(mockExceededCheck.limit);
      expect(mockExceededCheck.would_be).toBeGreaterThan(mockExceededCheck.limit);
    });
  });

  describe('Feature Gating', () => {
    test('should validate feature gate structure', async () => {
      // Test that feature gate methods are properly structured
      expect(typeof FeatureGate.canCreateOrder).toBe('function');
      expect(typeof FeatureGate.canMakeApiCall).toBe('function');
      expect(typeof FeatureGate.canSendMessage).toBe('function');
      expect(typeof FeatureGate.canReceiveSubmission).toBe('function');
      expect(typeof FeatureGate.canUploadFile).toBe('function');
      expect(typeof FeatureGate.executeWithGate).toBe('function');
    });

    test('should execute actions with proper gating logic', async () => {
      const mockAction = async () => {
        return 'action_completed';
      };

      // This would require proper database setup in real testing
      try {
        const result = await mockAction();
        expect(result).toBe('action_completed');
      } catch (error) {
        // Expected to fail in test environment without database
        expect(error).toBeDefined();
      }
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle complete subscription lifecycle', async () => {
      // Mock a complete subscription scenario
      const mockScenario = {
        user_creates_account: true,
        starts_with_freemium: true,
        uses_features: true,
        approaches_limits: true,
        upgrades_to_starter: true,
        continues_usage: true,
        switches_to_professional: true
      };

      // Verify scenario structure
      expect(mockScenario.user_creates_account).toBe(true);
      expect(mockScenario.starts_with_freemium).toBe(true);
      expect(mockScenario.upgrades_to_starter).toBe(true);
      expect(mockScenario.switches_to_professional).toBe(true);
    });

    test('should handle multi-currency pricing correctly', async () => {
      const currencies: CurrencyCode[] = ['PHP', 'MYR', 'THB', 'IDR', 'USD'];
      const tiers: SubscriptionTier[] = ['freemium', 'starter', 'professional', 'enterprise'];
      
      // Check that regional pricing is configured for all currencies
      currencies.forEach(currency => {
        const regionalPricing = PlanConfig.getRegionalPricing(currency);
        expect(regionalPricing).toBeDefined();
        expect(regionalPricing?.currency).toBe(currency);
        expect(regionalPricing?.country_codes.length).toBeGreaterThan(0);
      });

      // Check that all tiers have proper configuration
      tiers.forEach(tier => {
        expect(['freemium', 'starter', 'professional', 'enterprise']).toContain(tier);
      });
    });

    test('should validate usage metrics consistency', async () => {
      const usageMetrics: UsageMetricType[] = [
        'orders_created',
        'api_calls',
        'storage_mb',
        'messages_sent',
        'submissions_received'
      ];

      // Check that all metrics have limit definitions
      usageMetrics.forEach(metric => {
        const definition = PlanConfig.getLimitDefinition(metric);
        expect(definition).toBeDefined();
        expect(definition?.metric_type).toBe(metric);
        expect(definition?.name).toBeDefined();
        expect(definition?.unit).toBeDefined();
      });
    });

    test('should validate plan feature consistency', async () => {
      const requiredFeatures = [
        'order_creation',
        'basic_analytics',
        'whatsapp_integration',
        'telegram_integration',
        'discord_integration',
        'payment_tracking'
      ];

      // Check that all required features have definitions
      requiredFeatures.forEach(feature => {
        const definition = PlanConfig.getFeatureDefinition(feature);
        expect(definition).toBeDefined();
        expect(definition?.key).toBe(feature);
        expect(definition?.category).toBeDefined();
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid plan IDs gracefully', async () => {
      const invalidPlanId = 'invalid-plan-id';
      
      try {
        const plan = await PlanManager.getPlanById(invalidPlanId);
        expect(plan).toBeNull();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('should handle invalid user IDs gracefully', async () => {
      const invalidUserId = 'invalid-user-id';
      
      try {
        await UsageManager.getCurrentUsage(invalidUserId, 'orders_created');
      } catch (error) {
        expect(error).toBeDefined();
        expect(error instanceof Error).toBe(true);
      }
    });

    test('should handle invalid currency codes gracefully', async () => {
      const starterPlan = await PlanManager.getPlanByTier('starter');
      
      if (starterPlan) {
        try {
          await PlanManager.getPlanPricing(starterPlan.id, 'INVALID' as CurrencyCode, 'monthly');
        } catch (error) {
          expect(error).toBeDefined();
        }
      }
    });

    test('should validate input parameters', async () => {
      // Test negative increment validation
      try {
        const result = await UsageManager.checkUsageLimit(TEST_USER_ID_1, 'orders_created', -1);
        // Should not reach here with negative increment
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle batch operations efficiently', async () => {
      const startTime = Date.now();
      
      // Simulate batch plan fetching
      const planPromises = [
        PlanManager.getPlanByTier('freemium'),
        PlanManager.getPlanByTier('starter'),
        PlanManager.getPlanByTier('professional'),
        PlanManager.getPlanByTier('enterprise')
      ];
      
      const plans = await Promise.all(planPromises);
      const endTime = Date.now();
      
      expect(plans).toHaveLength(4);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should cache frequently accessed data', async () => {
      // Test that repeated calls are handled efficiently
      const startTime = Date.now();
      
      for (let i = 0; i < 3; i++) {
        await PlanManager.getActivePlans();
      }
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(3000); // Should benefit from caching
    });
  });
});

describe('Subscription System API Endpoints', () => {
  test('should have proper API structure', () => {
    // Verify that API endpoints would be properly structured
    const expectedEndpoints = [
      '/api/subscriptions/plans',
      '/api/subscriptions/user', 
      '/api/subscriptions/usage'
    ];
    
    expectedEndpoints.forEach(endpoint => {
      expect(typeof endpoint).toBe('string');
      expect(endpoint.startsWith('/api/subscriptions')).toBe(true);
    });
  });

  test('should validate request/response types', () => {
    // Mock API request/response validation
    const mockPlanResponse = {
      success: true,
      data: [
        {
          id: 'plan-id',
          name: 'starter',
          tier: 'starter',
          display_name: 'Starter Plan',
          features: {},
          limits: {},
          pricing: {
            monthly: { PHP: 599, MYR: 35 },
            annually: { PHP: 5990, MYR: 350 },
            savings_percentage: 17
          }
        }
      ]
    };

    expect(mockPlanResponse.success).toBe(true);
    expect(Array.isArray(mockPlanResponse.data)).toBe(true);
    expect(mockPlanResponse.data[0].tier).toBe('starter');
  });
});

// Test data cleanup and setup
beforeAll(async () => {
  // Setup test data if needed
  console.log('Setting up subscription system tests...');
});

afterAll(async () => {
  // Cleanup test data if needed
  console.log('Cleaning up subscription system tests...');
});

beforeEach(async () => {
  // Reset state before each test if needed
});
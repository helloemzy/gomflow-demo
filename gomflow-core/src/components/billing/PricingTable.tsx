'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Star, Zap, Crown, Building } from 'lucide-react';
import { PlanDefinition, SubscriptionPlan, BillingInterval } from 'gomflow-shared/types';

// Plan definitions with regional pricing
const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    plan: 'free',
    name: 'Free',
    description: 'Perfect for trying out GOMFLOW',
    tagline: 'Get started for free',
    features: {
      max_orders: 50,
      max_submissions: 200,
      max_team_members: 1,
      advanced_analytics: false,
      api_access: false,
      priority_support: false,
      custom_branding: false,
      bulk_messaging: false,
      ai_assistant: false,
      inventory_management: false,
      custom_domain: false,
      sms_credits: 0,
      whatsapp_credits: 50,
    },
    pricing: {
      PH: { monthly_price: 0, yearly_price: 0, currency: 'PHP' },
      MY: { monthly_price: 0, yearly_price: 0, currency: 'MYR' },
      TH: { monthly_price: 0, yearly_price: 0, currency: 'THB' },
      ID: { monthly_price: 0, yearly_price: 0, currency: 'IDR' },
      US: { monthly_price: 0, yearly_price: 0, currency: 'USD' },
    },
  },
  {
    plan: 'starter',
    name: 'Starter',
    description: 'For growing GOMs ready to scale',
    tagline: 'Most popular choice',
    popular: true,
    features: {
      max_orders: 200,
      max_submissions: 1000,
      max_team_members: 2,
      advanced_analytics: true,
      api_access: false,
      priority_support: false,
      custom_branding: true,
      bulk_messaging: true,
      ai_assistant: true,
      inventory_management: false,
      custom_domain: false,
      sms_credits: 100,
      whatsapp_credits: 500,
    },
    pricing: {
      PH: { monthly_price: 599, yearly_price: 5990, currency: 'PHP' },
      MY: { monthly_price: 39, yearly_price: 390, currency: 'MYR' },
      TH: { monthly_price: 450, yearly_price: 4500, currency: 'THB' },
      ID: { monthly_price: 199000, yearly_price: 1990000, currency: 'IDR' },
      US: { monthly_price: 12, yearly_price: 120, currency: 'USD' },
    },
  },
  {
    plan: 'professional',
    name: 'Professional',
    description: 'For serious GOMs and small teams',
    tagline: 'Everything you need to succeed',
    features: {
      max_orders: null, // unlimited
      max_submissions: null,
      max_team_members: 5,
      advanced_analytics: true,
      api_access: true,
      priority_support: true,
      custom_branding: true,
      bulk_messaging: true,
      ai_assistant: true,
      inventory_management: true,
      custom_domain: true,
      sms_credits: 500,
      whatsapp_credits: 2000,
    },
    pricing: {
      PH: { monthly_price: 1299, yearly_price: 12990, currency: 'PHP' },
      MY: { monthly_price: 79, yearly_price: 790, currency: 'MYR' },
      TH: { monthly_price: 900, yearly_price: 9000, currency: 'THB' },
      ID: { monthly_price: 399000, yearly_price: 3990000, currency: 'IDR' },
      US: { monthly_price: 25, yearly_price: 250, currency: 'USD' },
    },
  },
  {
    plan: 'enterprise',
    name: 'Enterprise',
    description: 'For agencies and large teams',
    tagline: 'Custom solutions',
    features: {
      max_orders: null,
      max_submissions: null,
      max_team_members: 25,
      advanced_analytics: true,
      api_access: true,
      priority_support: true,
      custom_branding: true,
      bulk_messaging: true,
      ai_assistant: true,
      inventory_management: true,
      custom_domain: true,
      sms_credits: 2000,
      whatsapp_credits: 10000,
    },
    pricing: {
      PH: { monthly_price: 4999, yearly_price: 49990, currency: 'PHP' },
      MY: { monthly_price: 299, yearly_price: 2990, currency: 'MYR' },
      TH: { monthly_price: 3500, yearly_price: 35000, currency: 'THB' },
      ID: { monthly_price: 1499000, yearly_price: 14990000, currency: 'IDR' },
      US: { monthly_price: 99, yearly_price: 990, currency: 'USD' },
    },
  },
];

const PLAN_ICONS = {
  free: Zap,
  starter: Star,
  professional: Crown,
  enterprise: Building,
};

const FEATURE_LABELS = {
  max_orders: 'Orders per month',
  max_submissions: 'Submissions per month',
  max_team_members: 'Team members',
  advanced_analytics: 'Advanced analytics',
  api_access: 'API access',
  priority_support: 'Priority support',
  custom_branding: 'Custom branding',
  bulk_messaging: 'Bulk messaging',
  ai_assistant: 'AI assistant',
  inventory_management: 'Inventory management',
  custom_domain: 'Custom domain',
  sms_credits: 'SMS credits per month',
  whatsapp_credits: 'WhatsApp credits per month',
};

interface PricingTableProps {
  currentPlan?: SubscriptionPlan;
  userCountry?: 'PH' | 'MY' | 'TH' | 'ID' | 'US';
  onSelectPlan: (plan: SubscriptionPlan, interval: BillingInterval) => void;
  className?: string;
}

export function PricingTable({ 
  currentPlan, 
  userCountry = 'PH', 
  onSelectPlan,
  className = '' 
}: PricingTableProps) {
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('month');

  const formatPrice = (amount: number, currency: string) => {
    const formatters = {
      PHP: (amt: number) => `₱${amt.toLocaleString()}`,
      MYR: (amt: number) => `RM${amt}`,
      THB: (amt: number) => `฿${amt.toLocaleString()}`,
      IDR: (amt: number) => `Rp${amt.toLocaleString()}`,
      USD: (amt: number) => `$${amt}`,
    };
    
    return formatters[currency as keyof typeof formatters]?.(amount) || `${currency} ${amount}`;
  };

  const getYearlySavings = (monthly: number, yearly: number) => {
    if (monthly === 0) return 0;
    const yearlyTotal = monthly * 12;
    const savings = yearlyTotal - yearly;
    return Math.round((savings / yearlyTotal) * 100);
  };

  const renderFeatureValue = (feature: keyof typeof FEATURE_LABELS, value: any) => {
    if (typeof value === 'boolean') {
      return value ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <X className="h-4 w-4 text-gray-300" />
      );
    }
    
    if (value === null) {
      return <span className="text-green-600 font-medium">Unlimited</span>;
    }
    
    if (typeof value === 'number') {
      return <span className="font-medium">{value.toLocaleString()}</span>;
    }
    
    return value;
  };

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Billing Toggle */}
      <div className="flex justify-center">
        <div className="flex items-center bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setBillingInterval('month')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              billingInterval === 'month'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingInterval('year')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors relative ${
              billingInterval === 'year'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Yearly
            <Badge className="absolute -top-2 -right-2 text-xs bg-green-500">
              Save up to 20%
            </Badge>
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {PLAN_DEFINITIONS.map((plan) => {
          const Icon = PLAN_ICONS[plan.plan];
          const pricing = plan.pricing[userCountry];
          const price = billingInterval === 'month' ? pricing.monthly_price : pricing.yearly_price;
          const monthlyPrice = billingInterval === 'year' ? pricing.yearly_price / 12 : pricing.monthly_price;
          const savings = getYearlySavings(pricing.monthly_price, pricing.yearly_price);
          
          return (
            <Card 
              key={plan.plan}
              className={`relative p-6 ${
                plan.popular 
                  ? 'border-2 border-orange-500 shadow-lg scale-105' 
                  : 'border border-gray-200'
              } ${
                currentPlan === plan.plan 
                  ? 'bg-blue-50 border-blue-500' 
                  : 'bg-white'
              }`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-orange-500">
                  Most Popular
                </Badge>
              )}
              
              {currentPlan === plan.plan && (
                <Badge className="absolute -top-3 right-4 bg-blue-500">
                  Current Plan
                </Badge>
              )}

              <div className="text-center space-y-4">
                {/* Plan Header */}
                <div className="space-y-2">
                  <Icon className="h-8 w-8 mx-auto text-orange-500" />
                  <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                  <p className="text-sm text-gray-600">{plan.description}</p>
                </div>

                {/* Pricing */}
                <div className="space-y-1">
                  <div className="flex items-baseline justify-center space-x-1">
                    <span className="text-3xl font-bold text-gray-900">
                      {formatPrice(Math.round(monthlyPrice), pricing.currency)}
                    </span>
                    <span className="text-gray-600">/month</span>
                  </div>
                  
                  {billingInterval === 'year' && savings > 0 && (
                    <div className="space-y-1">
                      <p className="text-sm text-green-600 font-medium">
                        Save {savings}% with yearly billing
                      </p>
                      <p className="text-xs text-gray-500">
                        Billed {formatPrice(price, pricing.currency)} annually
                      </p>
                    </div>
                  )}
                  
                  {plan.tagline && (
                    <p className="text-sm text-orange-600 font-medium">{plan.tagline}</p>
                  )}
                </div>

                {/* CTA Button */}
                <Button
                  onClick={() => onSelectPlan(plan.plan, billingInterval)}
                  className={`w-full ${
                    plan.popular
                      ? 'bg-orange-500 hover:bg-orange-600'
                      : currentPlan === plan.plan
                      ? 'bg-blue-500 hover:bg-blue-600'
                      : 'bg-gray-900 hover:bg-gray-800'
                  }`}
                  disabled={currentPlan === plan.plan}
                >
                  {currentPlan === plan.plan 
                    ? 'Current Plan' 
                    : plan.plan === 'free' 
                    ? 'Get Started Free' 
                    : plan.plan === 'enterprise'
                    ? 'Contact Sales'
                    : 'Start Free Trial'
                  }
                </Button>

                {plan.plan !== 'free' && currentPlan !== plan.plan && (
                  <p className="text-xs text-gray-500">
                    14-day free trial • No credit card required
                  </p>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Feature Comparison */}
      <div className="mt-12">
        <h3 className="text-2xl font-bold text-center text-gray-900 mb-8">
          Compare All Features
        </h3>
        
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-4 px-4 font-medium text-gray-900">Features</th>
                {PLAN_DEFINITIONS.map((plan) => (
                  <th key={plan.plan} className="text-center py-4 px-4 font-medium text-gray-900">
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(FEATURE_LABELS).map(([feature, label]) => (
                <tr key={feature} className="border-b border-gray-100">
                  <td className="py-4 px-4 text-gray-700">{label}</td>
                  {PLAN_DEFINITIONS.map((plan) => (
                    <td key={plan.plan} className="text-center py-4 px-4">
                      {renderFeatureValue(
                        feature as keyof typeof FEATURE_LABELS,
                        plan.features[feature as keyof typeof plan.features]
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="mt-12 text-center space-y-4">
        <h3 className="text-xl font-bold text-gray-900">Frequently Asked Questions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left max-w-4xl mx-auto">
          <div className="space-y-2">
            <h4 className="font-medium text-gray-900">Can I change plans anytime?</h4>
            <p className="text-sm text-gray-600">
              Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately with prorated billing.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-gray-900">What happens if I exceed my limits?</h4>
            <p className="text-sm text-gray-600">
              We'll notify you when approaching limits. Free plans are soft-limited, paid plans can temporarily exceed with overage fees.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-gray-900">Do you offer refunds?</h4>
            <p className="text-sm text-gray-600">
              Yes, we offer a 30-day money-back guarantee for all paid plans. Contact support for assistance.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-gray-900">Is there a setup fee?</h4>
            <p className="text-sm text-gray-600">
              No setup fees for any plan. Start your free trial immediately and only pay when you're ready to upgrade.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
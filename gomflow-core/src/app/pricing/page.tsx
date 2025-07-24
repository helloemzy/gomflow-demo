'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PricingTable } from '@/components/billing/PricingTable';
import { PlanSelector } from '@/components/billing/PlanSelector';
import { useSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Check, 
  Star, 
  Users, 
  Zap, 
  Shield, 
  Headphones, 
  Globe,
  TrendingUp,
  MessageSquare,
  BarChart3,
  Smartphone,
  Crown,
  Building
} from 'lucide-react';
import { SubscriptionPlan, BillingInterval } from 'gomflow-shared/types';

export default function PricingPage() {
  const router = useRouter();
  const { 
    subscription, 
    isLoading, 
    changePlan, 
    getUpgradePreview, 
    upgradePreview,
    isUpgrading,
    error 
  } = useSubscription();

  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [selectedInterval, setSelectedInterval] = useState<BillingInterval>('month');
  const [showPlanSelector, setShowPlanSelector] = useState(false);
  const [userCountry, setUserCountry] = useState<'PH' | 'MY' | 'TH' | 'ID' | 'US'>('PH');

  // Detect user country (in real app, this would come from user profile or geolocation)
  useEffect(() => {
    // Mock country detection - in real app this would be from user profile or API
    const country = localStorage.getItem('userCountry') as 'PH' | 'MY' | 'TH' | 'ID' | 'US' || 'PH';
    setUserCountry(country);
  }, []);

  const handleSelectPlan = async (plan: SubscriptionPlan, interval: BillingInterval) => {
    if (plan === 'enterprise') {
      // Redirect to contact sales for enterprise
      window.open('mailto:sales@gomflow.com?subject=Enterprise Plan Inquiry', '_blank');
      return;
    }

    if (plan === 'free') {
      // Handle free plan signup
      router.push('/auth/signup?plan=free');
      return;
    }

    setSelectedPlan(plan);
    setSelectedInterval(interval);

    // Get upgrade preview if user is logged in
    if (subscription) {
      try {
        await getUpgradePreview(plan, interval);
        setShowPlanSelector(true);
      } catch (error) {
        console.error('Failed to get upgrade preview:', error);
        // Still show plan selector even if preview fails
        setShowPlanSelector(true);
      }
    } else {
      // Redirect to signup with selected plan
      router.push(`/auth/signup?plan=${plan}&interval=${interval}`);
    }
  };

  const handleConfirmPlan = async () => {
    if (!selectedPlan) return;

    try {
      await changePlan(selectedPlan, selectedInterval);
      setShowPlanSelector(false);
      router.push('/gom/billing?upgraded=true');
    } catch (error) {
      console.error('Failed to change plan:', error);
      // Error is handled by the hook
    }
  };

  const handleCancel = () => {
    setShowPlanSelector(false);
    setSelectedPlan(null);
  };

  if (showPlanSelector && selectedPlan && subscription) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto py-8">
          <Button
            onClick={handleCancel}
            variant="ghost"
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Pricing
          </Button>

          <PlanSelector
            currentPlan={subscription.plan}
            targetPlan={selectedPlan}
            billingInterval={selectedInterval}
            userCountry={userCountry}
            upgradePreview={upgradePreview}
            isLoading={isUpgrading}
            onConfirm={handleConfirmPlan}
            onCancel={handleCancel}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold text-gray-900">
              Choose Your Plan
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Scale your group order business with GOMFLOW. From free trials to enterprise solutions, 
              we have the perfect plan for every GOM.
            </p>
            
            {subscription && (
              <Badge className="bg-blue-100 text-blue-800">
                Current Plan: {subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {error && (
          <Card className="p-4 mb-8 border-red-200 bg-red-50">
            <p className="text-red-800">Error: {error}</p>
          </Card>
        )}

        <PricingTable
          currentPlan={subscription?.plan}
          userCountry={userCountry}
          onSelectPlan={handleSelectPlan}
        />

        {/* Success Stories */}
        <div className="mt-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Trusted by 1,000+ GOMs Across Southeast Asia
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              See how GOMFLOW has transformed group order management for GOMs like you
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="p-6 text-center">
              <div className="space-y-4">
                <div className="flex justify-center space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <blockquote className="text-gray-700 italic">
                  "GOMFLOW saved me 15 hours per week. I went from 200 to 800 orders per month!"
                </blockquote>
                <div className="space-y-1">
                  <p className="font-semibold text-gray-900">Sarah Chen</p>
                  <p className="text-sm text-gray-600">K-pop GOM, Philippines</p>
                  <Badge className="bg-green-100 text-green-800">Professional Plan</Badge>
                </div>
              </div>
            </Card>

            <Card className="p-6 text-center">
              <div className="space-y-4">
                <div className="flex justify-center space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <blockquote className="text-gray-700 italic">
                  "The automation is incredible. Payment tracking used to take all weekend, now it's instant."
                </blockquote>
                <div className="space-y-1">
                  <p className="font-semibold text-gray-900">Ahmad Rahman</p>
                  <p className="text-sm text-gray-600">Merchandise GOM, Malaysia</p>
                  <Badge className="bg-purple-100 text-purple-800">Starter Plan</Badge>
                </div>
              </div>
            </Card>

            <Card className="p-6 text-center">
              <div className="space-y-4">
                <div className="flex justify-center space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <blockquote className="text-gray-700 italic">
                  "Our team manages 50+ orders simultaneously now. The collaboration features are amazing."
                </blockquote>
                <div className="space-y-1">
                  <p className="font-semibold text-gray-900">Lisa Tanaka</p>
                  <p className="text-sm text-gray-600">Agency Owner, Thailand</p>
                  <Badge className="bg-orange-100 text-orange-800">Enterprise Plan</Badge>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Why Choose GOMFLOW */}
        <div className="mt-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Why GOMs Choose GOMFLOW
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Built specifically for Southeast Asian group order management
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mx-auto">
                <Zap className="h-6 w-6 text-orange-600" />
              </div>
              <h3 className="font-semibold text-gray-900">95% Time Savings</h3>
              <p className="text-sm text-gray-600">
                From 20 hours to 10 minutes per order cycle
              </p>
            </div>

            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto">
                <MessageSquare className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Multi-Platform</h3>
              <p className="text-sm text-gray-600">
                WhatsApp, Telegram, Discord integration
              </p>
            </div>

            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto">
                <Shield className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Secure Payments</h3>
              <p className="text-sm text-gray-600">
                Bank-level security for all transactions
              </p>
            </div>

            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto">
                <BarChart3 className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Smart Analytics</h3>
              <p className="text-sm text-gray-600">
                Insights to grow your business
              </p>
            </div>
          </div>
        </div>

        {/* Regional Support */}
        <div className="mt-20">
          <Card className="p-8 bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <Globe className="h-12 w-12 text-orange-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-gray-900">
                  Built for Southeast Asia
                </h3>
                <p className="text-gray-700 max-w-2xl mx-auto">
                  Local payment methods, multi-currency support, and customer service 
                  in your timezone. We understand the unique needs of Southeast Asian GOMs.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Badge className="bg-white text-gray-800">Philippines (PHP)</Badge>
                <Badge className="bg-white text-gray-800">Malaysia (MYR)</Badge>
                <Badge className="bg-white text-gray-800">Thailand (THB)</Badge>
                <Badge className="bg-white text-gray-800">Indonesia (IDR)</Badge>
                <Badge className="bg-white text-gray-800">Global (USD)</Badge>
              </div>
            </div>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="mt-20 text-center">
          <Card className="p-8 bg-gray-900 text-white">
            <div className="space-y-6">
              <h2 className="text-3xl font-bold">
                Ready to Transform Your Group Orders?
              </h2>
              <p className="text-gray-300 max-w-2xl mx-auto">
                Join thousands of GOMs who have already streamlined their operations with GOMFLOW. 
                Start your free trial today - no credit card required.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  onClick={() => handleSelectPlan('starter', 'month')}
                  size="lg"
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  <Crown className="h-4 w-4 mr-2" />
                  Start Free Trial
                </Button>
                <Button
                  onClick={() => window.open('mailto:sales@gomflow.com?subject=Enterprise Demo Request', '_blank')}
                  size="lg"
                  variant="outline"
                  className="border-white text-white hover:bg-white hover:text-gray-900"
                >
                  <Building className="h-4 w-4 mr-2" />
                  Contact Sales
                </Button>
              </div>
              <p className="text-sm text-gray-400">
                14-day free trial • Cancel anytime • No setup fees
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
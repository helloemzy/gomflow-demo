'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Check, 
  Star, 
  Users, 
  Zap, 
  Shield, 
  Crown,
  Building
} from 'lucide-react';

const plans = [
  {
    name: 'Freemium',
    price: 'Free',
    currency: '',
    description: 'Perfect for trying out GOMFLOW',
    features: [
      'Up to 50 orders/month',
      'Basic order forms',
      'Payment proof upload',
      'GOMFLOW branding',
      'Community support'
    ],
    limitations: [
      '3-day payment tracking delay',
      'Basic features only'
    ],
    popular: false,
    cta: 'Start Free',
    icon: Users
  },
  {
    name: 'Starter',
    price: '$12',
    currency: 'USD',
    description: 'Great for new GOMs getting started',
    features: [
      'Up to 200 orders/month',
      'Remove GOMFLOW branding',
      'Real-time payment tracking',
      'Email support',
      'Basic analytics',
      'WhatsApp integration'
    ],
    popular: false,
    cta: '14-Day Free Trial',
    icon: Zap
  },
  {
    name: 'Professional',
    price: '$25',
    currency: 'USD',
    description: 'Best for established GOMs',
    features: [
      'Unlimited orders',
      'Advanced analytics',
      'API access',
      'Priority support',
      'Custom branding',
      'Bulk messaging tools',
      'Discord & Telegram bots',
      'AI payment verification'
    ],
    popular: true,
    cta: '14-Day Free Trial',
    icon: Crown
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    currency: '',
    description: 'For large-scale operations',
    features: [
      'Everything in Professional',
      'Multi-GOM management',
      'Dedicated account manager',
      'Custom integrations',
      'SLA guarantees',
      'Training and onboarding',
      'White-label options'
    ],
    popular: false,
    cta: 'Contact Sales',
    icon: Building
  }
];

export default function PricingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-sm border-b border-purple-100">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                onClick={() => router.push("/")}
                className="text-purple-600 hover:text-purple-700"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">G</span>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  GOMFLOW
                </h1>
                <p className="text-xs text-gray-500">Subscription Plans</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 mb-6">
            Choose Your 
            <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              {" "}Perfect Plan
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            From free exploration to enterprise scale - find the perfect plan for your group order management needs.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <Check className="h-4 w-4 text-green-500" />
            <span>14-day free trial on all paid plans</span>
            <span className="mx-2">•</span>
            <Check className="h-4 w-4 text-green-500" />
            <span>No setup fees</span>
            <span className="mx-2">•</span>
            <Check className="h-4 w-4 text-green-500" />
            <span>Cancel anytime</span>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
          {plans.map((plan, index) => (
            <Card key={index} className={`relative border-2 ${
              plan.popular 
                ? 'border-purple-500 shadow-xl scale-105' 
                : 'border-purple-100 hover:border-purple-300'
            } transition-all hover:shadow-lg`}>
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-500 to-pink-500">
                  Most Popular
                </Badge>
              )}
              
              <CardHeader className="text-center pb-8">
                <div className={`w-12 h-12 mx-auto mb-4 rounded-lg flex items-center justify-center ${
                  plan.popular 
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500' 
                    : 'bg-gradient-to-r from-purple-100 to-pink-100'
                }`}>
                  <plan.icon className={`h-6 w-6 ${
                    plan.popular ? 'text-white' : 'text-purple-600'
                  }`} />
                </div>
                <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  {plan.currency && <span className="text-gray-500">/month</span>}
                </div>
                <CardDescription className="mt-2">{plan.description}</CardDescription>
              </CardHeader>

              <CardContent className="pt-0">
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center gap-3">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm text-gray-600">{feature}</span>
                    </li>
                  ))}
                  {plan.limitations?.map((limitation, limitIndex) => (
                    <li key={limitIndex} className="flex items-center gap-3 opacity-60">
                      <div className="h-4 w-4 flex-shrink-0" />
                      <span className="text-sm text-gray-500">• {limitation}</span>
                    </li>
                  ))}
                </ul>

                <Button 
                  className={`w-full ${
                    plan.popular 
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600' 
                      : plan.name === 'Freemium'
                      ? 'bg-gray-900 hover:bg-gray-800'
                      : 'border-purple-300 text-purple-600 hover:bg-purple-50'
                  }`}
                  variant={plan.popular || plan.name === 'Freemium' ? 'default' : 'outline'}
                  onClick={() => {
                    if (plan.name === 'Enterprise') {
                      window.location.href = 'mailto:sales@gomflow.com?subject=Enterprise Plan Inquiry';
                    } else {
                      router.push('/auth/signup');
                    }
                  }}
                >
                  {plan.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Success Stories */}
        <section className="mt-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Trusted by GOMs Across Southeast Asia
            </h2>
            <p className="text-lg text-gray-600">
              See how different plans work for different types of GOMs
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border-green-200 bg-green-50/50">
              <CardHeader>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">👩🏻‍💼</span>
                  <div>
                    <p className="font-semibold">Lisa - New GOM</p>
                    <p className="text-sm text-gray-600">Starter Plan</p>
                  </div>
                </div>
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 mb-4">
                  "Started my first GO last month with 50 orders. The Starter plan is perfect - removed the GOMFLOW branding and looks super professional!"
                </p>
                <div className="text-sm">
                  <p className="font-semibold text-green-700">Monthly Revenue: $450</p>
                  <p className="text-gray-600">Time Saved: 15 hours/month</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-purple-200 bg-purple-50/50">
              <CardHeader>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">👩🏻‍🎤</span>
                  <div>
                    <p className="font-semibold">Sarah - Professional GOM</p>
                    <p className="text-sm text-gray-600">Professional Plan</p>
                  </div>
                </div>
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 mb-4">
                  "Handle 800+ orders monthly across multiple groups. The AI verification and analytics are game-changers. Worth every penny!"
                </p>
                <div className="text-sm">
                  <p className="font-semibold text-purple-700">Monthly Revenue: $2,150</p>
                  <p className="text-gray-600">Time Saved: 25 hours/month</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50/50">
              <CardHeader>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">👨🏻‍💼</span>
                  <div>
                    <p className="font-semibold">Marcus - Enterprise</p>
                    <p className="text-sm text-gray-600">Enterprise Plan</p>
                  </div>
                </div>
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 mb-4">
                  "Manage a network of 20 GOMs with 5,000+ monthly orders. The multi-GOM dashboard and dedicated support are essential."
                </p>
                <div className="text-sm">
                  <p className="font-semibold text-blue-700">Monthly Revenue: $12,000+</p>
                  <p className="text-gray-600">Team of 5 managed efficiently</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="mt-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Can I change plans anytime?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Yes! You can upgrade or downgrade anytime. Changes take effect immediately with pro-rated billing.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">What payment methods do you accept?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  We accept all major credit cards, PayPal, and popular Southeast Asian payment methods like GCash and GrabPay.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Is there a setup fee?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  No setup fees ever! All plans include full onboarding support and account setup at no extra cost.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Can I cancel my subscription?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Yes, you can cancel anytime. Your account remains active until the end of your billing period.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mt-20 text-center">
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-12 text-white">
            <h2 className="text-3xl font-bold mb-4">
              Ready to Transform Your Group Orders?
            </h2>
            <p className="text-xl text-purple-100 mb-8 max-w-2xl mx-auto">
              Join 500+ GOMs who chose GOMFLOW to scale their operations and reclaim their time.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="text-lg px-8 py-4 bg-white text-purple-600 hover:bg-gray-100"
                onClick={() => router.push('/auth/signup')}
              >
                Start 14-Day Free Trial
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="text-lg px-8 py-4 border-white text-white hover:bg-white/10"
                onClick={() => router.push('/browse')}
              >
                See Demo First
              </Button>
            </div>
            <p className="text-sm text-purple-200 mt-4">
              💜 No credit card required for trial • Cancel anytime
            </p>
          </div>
        </section>
      </section>
    </div>
  );
}
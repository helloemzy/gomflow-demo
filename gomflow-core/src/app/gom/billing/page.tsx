'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CreditCard, Settings, BarChart3 } from 'lucide-react';

export default function BillingPage() {
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
                onClick={() => router.push("/dashboard")}
                className="text-purple-600 hover:text-purple-700"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
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
                <p className="text-xs text-gray-500">Billing Dashboard</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-6">
            Subscription 
            <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              {" "}Management
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Manage your GOMFLOW subscription, billing, and payment methods.
          </p>
        </div>

        {/* Current Plan */}
        <div className="max-w-4xl mx-auto">
          <Card className="border-purple-200 mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">Current Plan</CardTitle>
                  <CardDescription>Professional Plan - Active</CardDescription>
                </div>
                <Badge className="bg-gradient-to-r from-purple-500 to-pink-500">
                  Active
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-purple-600">$25</p>
                  <p className="text-gray-600">per month</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-600">850</p>
                  <p className="text-gray-600">orders this month</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-600">Unlimited</p>
                  <p className="text-gray-600">orders allowed</p>
                </div>
              </div>
              <div className="mt-6 flex gap-4">
                <Button 
                  onClick={() => router.push("/pricing")}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                >
                  Change Plan
                </Button>
                <Button variant="outline">
                  Download Invoice
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push("/pricing")}>
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg flex items-center justify-center mb-4">
                  <BarChart3 className="h-6 w-6 text-purple-600" />
                </div>
                <CardTitle>View All Plans</CardTitle>
                <CardDescription>Compare features and upgrade your plan</CardDescription>
              </CardHeader>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-r from-blue-100 to-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <CreditCard className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle>Payment Methods</CardTitle>
                <CardDescription>Manage your payment methods and billing</CardDescription>
              </CardHeader>
            </Card>

            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-r from-green-100 to-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <Settings className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle>Billing Settings</CardTitle>
                <CardDescription>Configure billing preferences and notifications</CardDescription>
              </CardHeader>
            </Card>
          </div>

          {/* Coming Soon Notice */}
          <Card className="mt-8 border-yellow-200 bg-yellow-50/50">
            <CardHeader>
              <CardTitle className="text-yellow-800">🚧 Full Billing Dashboard Coming Soon</CardTitle>
              <CardDescription className="text-yellow-700">
                The complete subscription billing system is ready and will be deployed soon. 
                For now, you can view pricing plans and contact support for billing assistance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Button 
                  onClick={() => router.push("/pricing")}
                  className="bg-yellow-600 hover:bg-yellow-700"
                >
                  View Pricing Plans
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.href = 'mailto:support@gomflow.com?subject=Billing Support'}
                >
                  Contact Support
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
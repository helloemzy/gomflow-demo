"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import PaymentSetup from '@/components/onboarding/PaymentSetup';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  CreditCard, 
  Shield, 
  Star, 
  Users,
  TrendingUp,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

interface PaymentMethod {
  id?: string;
  type: string;
  name: string;
  accountDetails: Record<string, any>;
  instructions: string;
  isEnabled: boolean;
  isCustom: boolean;
  displayOrder: number;
}

export default function PaymentSetupPage() {
  const [user, setUser] = useState<any>(null);
  const [existingMethods, setExistingMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFirstTime, setIsFirstTime] = useState(true);
  const [country, setCountry] = useState<'PH' | 'MY'>('PH');
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const checkExistingSetup = async () => {
      try {
        const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
        
        if (isDemoMode) {
          setUser({ 
            id: 'demo-user-gom-1', 
            email: 'demo@gomflow.com',
            user_metadata: { user_type: 'gom', full_name: 'Demo GOM' }
          });
          setCountry('PH');
          setIsFirstTime(false);
          setExistingMethods([
            {
              id: 'demo-method-1',
              type: 'gcash',
              name: 'GCash',
              accountDetails: { number: '09171234567', name: 'Demo GOM' },
              instructions: 'Send payment to GCash number 09171234567 (Demo GOM). Include reference number.',
              isEnabled: true,
              isCustom: false,
              displayOrder: 0
            },
            {
              id: 'demo-method-2',
              type: 'paymaya',
              name: 'PayMaya',
              accountDetails: { number: '09171234567', name: 'Demo GOM' },
              instructions: 'Send payment to PayMaya number 09171234567 (Demo GOM).',
              isEnabled: true,
              isCustom: false,
              displayOrder: 1
            }
          ]);
          setLoading(false);
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);

        if (!user) {
          router.push('/auth/login');
          return;
        }

        // Get user's country from profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('country')
          .eq('user_id', user.id)
          .single();

        if (profile) {
          setCountry(profile.country);
        }

        // Check for existing payment methods
        const { data: methods, error } = await supabase
          .from('payment_methods')
          .select('*')
          .eq('user_id', user.id)
          .order('display_order');

        if (error) {
          console.error('Error fetching payment methods:', error);
        } else {
          setExistingMethods(methods || []);
          setIsFirstTime(methods?.length === 0);
        }
      } catch (error) {
        console.error('Error checking existing setup:', error);
      } finally {
        setLoading(false);
      }
    };

    checkExistingSetup();
  }, [supabase, router]);

  const handleSetupComplete = async (methods: PaymentMethod[]) => {
    // Redirect to dashboard or next onboarding step
    router.push('/dashboard?setup=payment_complete');
  };

  const handleSkipSetup = () => {
    // Redirect to dashboard with a notification about setting up payments later
    router.push('/dashboard?setup=payment_skipped');
  };

  const getMethodStats = () => {
    const totalMethods = existingMethods.length;
    const enabledMethods = existingMethods.filter(m => m.isEnabled).length;
    const customMethods = existingMethods.filter(m => m.isCustom).length;
    
    return { totalMethods, enabledMethods, customMethods };
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  // First-time setup flow
  if (isFirstTime) {
    return (
      <PaymentSetup
        onComplete={handleSetupComplete}
        onSkip={handleSkipSetup}
        showSkip={true}
        country={country}
      />
    );
  }

  // Existing methods management
  const stats = getMethodStats();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Payment Methods</h1>
              <p className="text-gray-600">
                Manage how your buyers can pay for their orders
              </p>
            </div>
          </div>
          <Button onClick={() => setIsFirstTime(true)}>
            <CreditCard className="h-4 w-4 mr-2" />
            Add Payment Method
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Methods</p>
                  <p className="text-2xl font-bold">{stats.totalMethods}</p>
                </div>
                <CreditCard className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Methods</p>
                  <p className="text-2xl font-bold text-green-600">{stats.enabledMethods}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Custom Methods</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.customMethods}</p>
                </div>
                <Star className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Success Rate</p>
                  <p className="text-2xl font-bold text-green-600">94.7%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment Methods List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Your Payment Methods</span>
              <Badge variant="outline">{stats.enabledMethods} active</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {existingMethods.length > 0 ? (
              <div className="space-y-4">
                {existingMethods.map((method, index) => (
                  <div 
                    key={method.id || index}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <CreditCard className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium">{method.name}</div>
                          <div className="text-sm text-gray-500">
                            {Object.entries(method.accountDetails)
                              .map(([key, value]) => `${key}: ${value}`)
                              .join(' • ')}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      {method.isEnabled ? (
                        <Badge variant="outline" className="text-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-500">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Inactive
                        </Badge>
                      )}
                      
                      {method.isCustom && (
                        <Badge variant="secondary">Custom</Badge>
                      )}
                      
                      <Button variant="outline" size="sm">
                        Edit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No payment methods configured
                </h3>
                <p className="text-gray-500 mb-4">
                  Add your first payment method to start accepting orders.
                </p>
                <Button onClick={() => setIsFirstTime(true)}>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Add Payment Method
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Benefits Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="h-5 w-5 mr-2" />
              Why Multiple Payment Methods Matter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="p-3 bg-green-100 rounded-full w-12 h-12 mx-auto mb-3 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="font-medium text-gray-900 mb-2">Higher Conversion</h3>
                <p className="text-sm text-gray-600">
                  GOMs with 3+ payment methods see 40% higher order completion rates
                </p>
              </div>
              
              <div className="text-center">
                <div className="p-3 bg-blue-100 rounded-full w-12 h-12 mx-auto mb-3 flex items-center justify-center">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="font-medium text-gray-900 mb-2">Wider Reach</h3>
                <p className="text-sm text-gray-600">
                  Different buyers prefer different payment methods based on their location
                </p>
              </div>
              
              <div className="text-center">
                <div className="p-3 bg-purple-100 rounded-full w-12 h-12 mx-auto mb-3 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="font-medium text-gray-900 mb-2">Reduced Risk</h3>
                <p className="text-sm text-gray-600">
                  Backup options prevent lost sales when primary methods have issues
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => router.push('/orders/create')}>
                Create New Order
              </Button>
              <Button variant="outline" onClick={() => router.push('/dashboard')}>
                View Analytics
              </Button>
              <Button variant="outline" onClick={() => router.push('/orders?filter=pending_payment')}>
                Pending Payments
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
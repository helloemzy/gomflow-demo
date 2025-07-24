"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  CreditCard, 
  Smartphone, 
  Building2, 
  Banknote,
  CheckCircle,
  Shield,
  Clock,
  Users
} from "lucide-react";

// Philippines payment methods
const PHILIPPINES_METHODS = [
  {
    id: 'gcash',
    name: 'GCash',
    description: 'Mobile wallet',
    icon: '📱',
    processingTime: 'Instant',
    fees: 'Free',
    trustScore: 95,
    popularityBadge: 'Most Popular',
    features: ['QR Code', 'Mobile Number', 'Instant Transfer']
  },
  {
    id: 'paymaya',
    name: 'PayMaya',
    description: 'Digital wallet',
    icon: '💳',
    processingTime: 'Instant',
    fees: 'Free',
    trustScore: 90,
    features: ['QR Code', 'Mobile Number', 'Card Loading']
  },
  {
    id: 'grabpay',
    name: 'GrabPay',
    description: 'Super app wallet',
    icon: '🚗',
    processingTime: 'Instant',
    fees: 'Free',
    trustScore: 85,
    features: ['QR Code', 'In-app Payment']
  },
  {
    id: 'shopeepay',
    name: 'ShopeePay',
    description: 'E-commerce wallet',
    icon: '🛒',
    processingTime: 'Instant',
    fees: 'Free',
    trustScore: 85,
    features: ['QR Code', 'Coins Cashback']
  },
  {
    id: 'bpi',
    name: 'BPI Online',
    description: 'Bank of the Philippine Islands',
    icon: '🏦',
    processingTime: '2-4 hours',
    fees: '₱10-25',
    trustScore: 98,
    features: ['InstaPay', 'PESONet', 'Mobile Banking']
  },
  {
    id: 'bdo',
    name: 'BDO Online',
    description: 'Banco de Oro',
    icon: '🏦',
    processingTime: '2-4 hours',
    fees: '₱10-25',
    trustScore: 97,
    features: ['InstaPay', 'PESONet', 'Mobile Banking']
  },
  {
    id: 'unionbank',
    name: 'UnionBank',
    description: 'UnionBank of the Philippines',
    icon: '🏦',
    processingTime: '2-4 hours',
    fees: '₱5-15',
    trustScore: 95,
    features: ['InstaPay', 'UBP App', 'Digital Banking']
  },
  {
    id: 'metrobank',
    name: 'MetroBank',
    description: 'Metropolitan Bank',
    icon: '🏦',
    processingTime: '2-4 hours',
    fees: '₱10-20',
    trustScore: 96,
    features: ['InstaPay', 'PESONet', 'Online Banking']
  },
  {
    id: 'landbank',
    name: 'LandBank',
    description: 'Land Bank of the Philippines',
    icon: '🏦',
    processingTime: '4-8 hours',
    fees: '₱5-15',
    trustScore: 94,
    features: ['WeRemit', 'iAccess', 'Government Bank']
  },
  {
    id: 'coins_ph',
    name: 'Coins.ph',
    description: 'Cryptocurrency wallet',
    icon: '₿',
    processingTime: 'Instant',
    fees: '1-2%',
    trustScore: 88,
    features: ['Crypto', 'Bills Payment', 'Mobile Loading']
  }
];

// Malaysia payment methods
const MALAYSIA_METHODS = [
  {
    id: 'touchngo',
    name: "Touch 'n Go eWallet",
    description: 'Leading e-wallet',
    icon: '💰',
    processingTime: 'Instant',
    fees: 'Free',
    trustScore: 95,
    popularityBadge: 'Most Popular',
    features: ['QR Code', 'DuitNow', 'Rewards Points']
  },
  {
    id: 'grabpay_my',
    name: 'GrabPay',
    description: 'Super app wallet',
    icon: '🚗',
    processingTime: 'Instant',
    fees: 'Free',
    trustScore: 90,
    features: ['QR Code', 'GrabRewards', 'Multi-service']
  },
  {
    id: 'boost',
    name: 'Boost',
    description: 'Mobile e-wallet',
    icon: '🚀',
    processingTime: 'Instant',
    fees: 'Free',
    trustScore: 88,
    features: ['QR Code', 'Cashback', 'Bill Payments']
  },
  {
    id: 'maybank2u',
    name: 'Maybank2u',
    description: 'Maybank online banking',
    icon: '🏦',
    processingTime: 'Instant',
    fees: 'RM0.50',
    trustScore: 98,
    features: ['DuitNow', 'Instant Transfer', 'Mobile Banking']
  },
  {
    id: 'cimb_clicks',
    name: 'CIMB Clicks',
    description: 'CIMB Bank online',
    icon: '🏦',
    processingTime: 'Instant',
    fees: 'RM0.50',
    trustScore: 96,
    features: ['DuitNow', 'CIMB Pay', 'Digital Banking']
  },
  {
    id: 'public_bank',
    name: 'Public Bank',
    description: 'PBe (Public Bank e-Banking)',
    icon: '🏦',
    processingTime: '1-2 hours',
    fees: 'RM1.00',
    trustScore: 97,
    features: ['IBG', 'GIRO', 'Online Transfer']
  },
  {
    id: 'hong_leong',
    name: 'Hong Leong Bank',
    description: 'Hong Leong Connect',
    icon: '🏦',
    processingTime: 'Instant',
    fees: 'RM0.50',
    trustScore: 95,
    features: ['DuitNow', 'HLB Connect', 'Mobile Banking']
  },
  {
    id: 'rhb',
    name: 'RHB Bank',
    description: 'RHB Now',
    icon: '🏦',
    processingTime: 'Instant',
    fees: 'RM0.50',
    trustScore: 94,
    features: ['DuitNow', 'RHB Mobile', 'Instant Transfer']
  },
  {
    id: 'bigpay',
    name: 'BigPay',
    description: 'AirAsia digital wallet',
    icon: '✈️',
    processingTime: 'Instant',
    fees: 'Free',
    trustScore: 87,
    features: ['Travel Card', 'Bill Split', 'International Transfer']
  },
  {
    id: 'shopee_pay_my',
    name: 'ShopeePay',
    description: 'E-commerce wallet',
    icon: '🛒',
    processingTime: 'Instant',
    fees: 'Free',
    trustScore: 85,
    features: ['QR Code', 'Coins Cashback', 'Shopping Integration']
  }
];

interface PaymentMethodSelectorProps {
  country: 'PH' | 'MY';
  selectedMethod: string | null;
  onMethodSelect: (methodId: string) => void;
  orderAmount: number;
  currency: 'PHP' | 'MYR';
}

export function PaymentMethodSelector({
  country,
  selectedMethod,
  onMethodSelect,
  orderAmount,
  currency
}: PaymentMethodSelectorProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterType, setFilterType] = useState<'all' | 'wallet' | 'bank'>('all');

  const methods = country === 'PH' ? PHILIPPINES_METHODS : MALAYSIA_METHODS;
  const currencySymbol = currency === 'PHP' ? '₱' : 'RM';

  const filteredMethods = methods.filter(method => {
    if (filterType === 'all') return true;
    if (filterType === 'wallet') return ['gcash', 'paymaya', 'grabpay', 'shopeepay', 'touchngo', 'grabpay_my', 'boost', 'bigpay', 'shopee_pay_my', 'coins_ph'].includes(method.id);
    if (filterType === 'bank') return ['bpi', 'bdo', 'unionbank', 'metrobank', 'landbank', 'maybank2u', 'cimb_clicks', 'public_bank', 'hong_leong', 'rhb'].includes(method.id);
    return true;
  });

  const getTrustColor = (score: number) => {
    if (score >= 95) return 'text-green-600 bg-green-50';
    if (score >= 90) return 'text-blue-600 bg-blue-50';
    if (score >= 85) return 'text-yellow-600 bg-yellow-50';
    return 'text-gray-600 bg-gray-50';
  };

  const getMethodIcon = (methodId: string) => {
    if (['gcash', 'paymaya', 'grabpay', 'shopeepay', 'touchngo', 'grabpay_my', 'boost', 'bigpay', 'shopee_pay_my'].includes(methodId)) {
      return <Smartphone className="h-5 w-5" />;
    }
    if (['bpi', 'bdo', 'unionbank', 'metrobank', 'landbank', 'maybank2u', 'cimb_clicks', 'public_bank', 'hong_leong', 'rhb'].includes(methodId)) {
      return <Building2 className="h-5 w-5" />;
    }
    if (methodId === 'coins_ph') {
      return <Banknote className="h-5 w-5" />;
    }
    return <CreditCard className="h-5 w-5" />;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Choose Payment Method
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-lg font-bold text-primary">
              {currencySymbol}{orderAmount.toFixed(2)}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <Shield className="h-4 w-4" />
            Secure payments
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            {filteredMethods.length} methods available
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Filter Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant={filterType === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('all')}
            >
              All Methods
            </Button>
            <Button
              variant={filterType === 'wallet' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('wallet')}
            >
              <Smartphone className="h-4 w-4 mr-1" />
              E-Wallets
            </Button>
            <Button
              variant={filterType === 'bank' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('bank')}
            >
              <Building2 className="h-4 w-4 mr-1" />
              Banks
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              Grid
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              List
            </Button>
          </div>
        </div>

        {/* Payment Methods Grid/List */}
        <div className={viewMode === 'grid' 
          ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" 
          : "space-y-3"
        }>
          {filteredMethods.map((method) => (
            <div
              key={method.id}
              className={`
                relative border rounded-lg cursor-pointer transition-all duration-200
                ${selectedMethod === method.id 
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                  : 'border-gray-200 hover:border-primary/50 hover:bg-gray-50'
                }
                ${viewMode === 'list' ? 'p-4' : 'p-3'}
              `}
              onClick={() => onMethodSelect(method.id)}
            >
              {/* Selected indicator */}
              {selectedMethod === method.id && (
                <div className="absolute top-2 right-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                </div>
              )}

              {/* Method content */}
              <div className={`flex items-start gap-3 ${viewMode === 'list' ? 'flex-row' : 'flex-col'}`}>
                {/* Icon and basic info */}
                <div className={`flex items-center gap-3 ${viewMode === 'list' ? 'flex-row' : 'flex-col'}`}>
                  <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-lg">
                    <span className="text-2xl">{method.icon}</span>
                  </div>
                  
                  <div className={viewMode === 'list' ? 'flex-1' : 'text-center'}>
                    <div className="font-semibold text-gray-900 flex items-center gap-2">
                      {method.name}
                      {method.popularityBadge && (
                        <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800">
                          {method.popularityBadge}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">{method.description}</div>
                  </div>
                </div>

                {/* Method details */}
                <div className={`space-y-2 ${viewMode === 'list' ? 'flex-none w-64' : 'w-full'}`}>
                  {/* Trust score and processing time */}
                  <div className="flex items-center justify-between text-xs">
                    <div className={`px-2 py-1 rounded-full ${getTrustColor(method.trustScore)}`}>
                      <Shield className="h-3 w-3 inline mr-1" />
                      {method.trustScore}% trust
                    </div>
                    <div className="flex items-center text-gray-600">
                      <Clock className="h-3 w-3 mr-1" />
                      {method.processingTime}
                    </div>
                  </div>

                  {/* Fees */}
                  <div className="text-xs text-gray-600">
                    <span className="font-medium">Fees:</span> {method.fees}
                  </div>

                  {/* Features */}
                  <div className="flex flex-wrap gap-1">
                    {method.features.slice(0, viewMode === 'list' ? 3 : 2).map((feature, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                    {method.features.length > (viewMode === 'list' ? 3 : 2) && (
                      <Badge variant="outline" className="text-xs text-gray-500">
                        +{method.features.length - (viewMode === 'list' ? 3 : 2)} more
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* No methods message */}
        {filteredMethods.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No payment methods found for the selected filter.</p>
          </div>
        )}

        {/* Helper text */}
        <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded-lg">
          <div className="font-medium mb-1">💡 Quick tips:</div>
          <ul className="space-y-0.5 list-disc list-inside">
            <li><strong>E-wallets</strong> offer instant transfers and are perfect for quick payments</li>
            <li><strong>Bank transfers</strong> may take longer but often have higher trust scores</li>
            <li>Check processing times if you need immediate confirmation</li>
            <li>Popular methods are widely accepted and trusted by the community</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
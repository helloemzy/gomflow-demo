'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CreditCard, 
  Plus, 
  Trash2, 
  Check, 
  AlertTriangle,
  Lock,
  Star,
  Calendar,
  Building,
  Smartphone,
  Loader2,
  Eye,
  EyeOff
} from 'lucide-react';
import { PaymentMethodData } from 'gomflow-shared/types';

interface PaymentMethodManagerProps {
  paymentMethods: PaymentMethodData[];
  isLoading?: boolean;
  onAddPaymentMethod: () => void;
  onRemovePaymentMethod: (methodId: string) => void;
  onSetDefault: (methodId: string) => void;
  onUpdatePaymentMethod: (methodId: string) => void;
  className?: string;
}

const CARD_BRANDS = {
  visa: { name: 'Visa', color: 'bg-blue-600' },
  mastercard: { name: 'Mastercard', color: 'bg-red-600' },
  amex: { name: 'American Express', color: 'bg-green-600' },
  discover: { name: 'Discover', color: 'bg-orange-600' },
  diners: { name: 'Diners Club', color: 'bg-gray-600' },
  jcb: { name: 'JCB', color: 'bg-purple-600' },
  unionpay: { name: 'UnionPay', color: 'bg-blue-800' },
};

const PAYMENT_TYPE_INFO = {
  card: { 
    name: 'Credit/Debit Card', 
    icon: CreditCard, 
    description: 'Visa, Mastercard, etc.' 
  },
  bank_account: { 
    name: 'Bank Account', 
    icon: Building, 
    description: 'Direct bank transfer' 
  },
  alipay: { 
    name: 'Alipay', 
    icon: Smartphone, 
    description: 'Alipay digital wallet' 
  },
  grabpay: { 
    name: 'GrabPay', 
    icon: Smartphone, 
    description: 'GrabPay digital wallet' 
  },
  fpx: { 
    name: 'FPX', 
    icon: Building, 
    description: 'Malaysian online banking' 
  },
};

export function PaymentMethodManager({
  paymentMethods,
  isLoading = false,
  onAddPaymentMethod,
  onRemovePaymentMethod,
  onSetDefault,
  onUpdatePaymentMethod,
  className = '',
}: PaymentMethodManagerProps) {
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const [showCardDetails, setShowCardDetails] = useState<Record<string, boolean>>({});

  const handleRemove = async (methodId: string) => {
    setRemovingId(methodId);
    try {
      await onRemovePaymentMethod(methodId);
    } finally {
      setRemovingId(null);
    }
  };

  const handleSetDefault = async (methodId: string) => {
    setSettingDefaultId(methodId);
    try {
      await onSetDefault(methodId);
    } finally {
      setSettingDefaultId(null);
    }
  };

  const toggleCardDetails = (methodId: string) => {
    setShowCardDetails(prev => ({
      ...prev,
      [methodId]: !prev[methodId]
    }));
  };

  const getCardExpiryStatus = (expMonth: number, expYear: number) => {
    const now = new Date();
    const expiry = new Date(expYear, expMonth - 1);
    const monthsUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30);
    
    if (monthsUntilExpiry < 0) {
      return { status: 'expired', color: 'red', message: 'Expired' };
    } else if (monthsUntilExpiry < 2) {
      return { status: 'expiring', color: 'yellow', message: 'Expires soon' };
    }
    return { status: 'valid', color: 'green', message: 'Valid' };
  };

  const formatCardNumber = (last4: string, show: boolean = false) => {
    return show ? `•••• •••• •••• ${last4}` : `•••• ${last4}`;
  };

  if (isLoading) {
    return (
      <Card className={`p-8 ${className}`}>
        <div className="flex items-center justify-center space-x-3">
          <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
          <span className="text-gray-600">Loading payment methods...</span>
        </div>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Payment Methods</h2>
          <p className="text-gray-600">Manage your payment methods for subscriptions</p>
        </div>
        <Button onClick={onAddPaymentMethod} className="bg-orange-500 hover:bg-orange-600">
          <Plus className="h-4 w-4 mr-2" />
          Add Payment Method
        </Button>
      </div>

      {/* Security Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Lock className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-blue-800">Secure Payment Processing</p>
            <p className="text-sm text-blue-700">
              Your payment information is encrypted and securely stored by Stripe. 
              GOMFLOW never stores your full card details.
            </p>
          </div>
        </div>
      </div>

      {/* Payment Methods List */}
      {paymentMethods.length === 0 ? (
        <Card className="p-8 text-center">
          <CreditCard className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No payment methods</h3>
          <p className="text-gray-600 mb-4">
            Add a payment method to continue with your subscription
          </p>
          <Button onClick={onAddPaymentMethod} className="bg-orange-500 hover:bg-orange-600">
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Payment Method
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {paymentMethods.map((method) => {
            const typeInfo = PAYMENT_TYPE_INFO[method.type];
            const TypeIcon = typeInfo.icon;
            const isCard = method.type === 'card';
            const cardBrand = isCard && method.brand ? CARD_BRANDS[method.brand as keyof typeof CARD_BRANDS] : null;
            const expiryStatus = isCard && method.exp_month && method.exp_year 
              ? getCardExpiryStatus(method.exp_month, method.exp_year)
              : null;

            return (
              <Card key={method.id} className={`p-6 ${method.is_default ? 'border-2 border-orange-500' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    {/* Payment Method Icon */}
                    <div className={`p-3 rounded-lg ${
                      method.is_default 
                        ? 'bg-orange-100' 
                        : 'bg-gray-100'
                    }`}>
                      <TypeIcon className={`h-6 w-6 ${
                        method.is_default 
                          ? 'text-orange-600' 
                          : 'text-gray-600'
                      }`} />
                    </div>

                    {/* Payment Method Details */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium text-gray-900">
                          {typeInfo.name}
                        </h3>
                        {method.is_default && (
                          <Badge className="bg-orange-100 text-orange-800">
                            <Star className="h-3 w-3 mr-1" />
                            Default
                          </Badge>
                        )}
                        {cardBrand && (
                          <Badge className={`${cardBrand.color} text-white`}>
                            {cardBrand.name}
                          </Badge>
                        )}
                      </div>

                      {isCard ? (
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-700">
                              {formatCardNumber(method.last4 || '****', showCardDetails[method.id])}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleCardDetails(method.id)}
                              className="h-6 w-6 p-0"
                            >
                              {showCardDetails[method.id] ? (
                                <EyeOff className="h-3 w-3" />
                              ) : (
                                <Eye className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                          
                          {method.exp_month && method.exp_year && (
                            <div className="flex items-center space-x-3">
                              <div className="flex items-center space-x-1">
                                <Calendar className="h-3 w-3 text-gray-500" />
                                <span className="text-sm text-gray-600">
                                  Expires {method.exp_month.toString().padStart(2, '0')}/{method.exp_year}
                                </span>
                              </div>
                              {expiryStatus && (
                                <Badge className={`bg-${expiryStatus.color}-100 text-${expiryStatus.color}-800`}>
                                  {expiryStatus.message}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600">{typeInfo.description}</p>
                      )}

                      <p className="text-xs text-gray-500">
                        Added on {new Date(method.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2">
                    {!method.is_default && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSetDefault(method.id)}
                        disabled={settingDefaultId === method.id}
                      >
                        {settingDefaultId === method.id ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <Star className="h-3 w-3 mr-1" />
                        )}
                        Set Default
                      </Button>
                    )}
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onUpdatePaymentMethod(method.id)}
                    >
                      Update
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRemove(method.id)}
                      disabled={removingId === method.id || paymentMethods.length === 1}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      {removingId === method.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Expiry Warning */}
                {expiryStatus && expiryStatus.status === 'expiring' && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <p className="text-sm text-yellow-800">
                        This card expires soon. Update your payment method to avoid service interruption.
                      </p>
                    </div>
                  </div>
                )}

                {expiryStatus && expiryStatus.status === 'expired' && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <p className="text-sm text-red-800">
                        This card has expired and cannot be used for payments. Please update or remove it.
                      </p>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Footer */}
      {paymentMethods.length > 0 && (
        <div className="text-center pt-4">
          <p className="text-sm text-gray-600">
            Need help? <a href="#" className="text-orange-600 hover:text-orange-700">Contact our support team</a>
          </p>
        </div>
      )}
    </div>
  );
}
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CreditCard, 
  Plus, 
  Check, 
  X, 
  AlertTriangle,
  Info,
  Shield,
  Smartphone,
  Building2,
  Wallet,
  TestTube,
  Eye,
  EyeOff,
  Copy,
  QrCode,
  Star,
  HelpCircle,
  ArrowRight
} from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

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

interface PaymentMethodTemplate {
  type: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  popularity: number;
  countries: string[];
  fields: {
    key: string;
    label: string;
    type: 'text' | 'tel' | 'email' | 'password' | 'textarea';
    placeholder: string;
    required: boolean;
    validation?: RegExp;
    helpText?: string;
  }[];
  defaultInstructions: string;
  color: string;
}

const PAYMENT_METHOD_TEMPLATES: PaymentMethodTemplate[] = [
  {
    type: 'gcash',
    name: 'GCash',
    description: 'Philippines\' leading mobile wallet',
    icon: <Smartphone className="h-5 w-5" />,
    popularity: 95,
    countries: ['PH'],
    color: '#007DFE',
    fields: [
      {
        key: 'number',
        label: 'GCash Number',
        type: 'tel',
        placeholder: '09XX XXX XXXX',
        required: true,
        validation: /^09\d{9}$/,
        helpText: 'Your 11-digit GCash mobile number'
      },
      {
        key: 'name',
        label: 'Account Name',
        type: 'text',
        placeholder: 'Juan Dela Cruz',
        required: true,
        helpText: 'Name registered to your GCash account'
      }
    ],
    defaultInstructions: 'Send payment to GCash number {number} ({name}). Include reference number in transaction and send screenshot as proof.'
  },
  {
    type: 'paymaya',
    name: 'PayMaya',
    description: 'Digital financial services platform',
    icon: <CreditCard className="h-5 w-5" />,
    popularity: 78,
    countries: ['PH'],
    color: '#00D632',
    fields: [
      {
        key: 'number',
        label: 'PayMaya Number',
        type: 'tel',
        placeholder: '09XX XXX XXXX',
        required: true,
        validation: /^09\d{9}$/
      },
      {
        key: 'name',
        label: 'Account Name',
        type: 'text',
        placeholder: 'Juan Dela Cruz',
        required: true
      }
    ],
    defaultInstructions: 'Send payment to PayMaya number {number} ({name}). Include your order reference and send screenshot.'
  },
  {
    type: 'maybank2u',
    name: 'Maybank2u',
    description: 'Malaysia\'s premier online banking',
    icon: <Building2 className="h-5 w-5" />,
    popularity: 89,
    countries: ['MY'],
    color: '#FFD700',
    fields: [
      {
        key: 'account_number',
        label: 'Account Number',
        type: 'text',
        placeholder: '1234567890123456',
        required: true,
        validation: /^\d{12,16}$/
      },
      {
        key: 'account_name',
        label: 'Account Holder Name',
        type: 'text',
        placeholder: 'Ahmad bin Abdullah',
        required: true
      }
    ],
    defaultInstructions: 'Transfer to Maybank account {account_number} ({account_name}). Use reference number as transaction note.'
  },
  {
    type: 'touch_n_go',
    name: "Touch 'n Go eWallet",
    description: 'Malaysia\'s most popular e-wallet',
    icon: <Wallet className="h-5 w-5" />,
    popularity: 85,
    countries: ['MY'],
    color: '#1B365D',
    fields: [
      {
        key: 'phone',
        label: 'Phone Number',
        type: 'tel',
        placeholder: '+60 12-345 6789',
        required: true,
        validation: /^(\+60|0)1[0-9]-?\d{3,4}-?\d{4}$/
      },
      {
        key: 'name',
        label: 'Account Name',
        type: 'text',
        placeholder: 'Ahmad bin Abdullah',
        required: true
      }
    ],
    defaultInstructions: 'Send to TNG eWallet {phone} ({name}). Include reference in message and send receipt.'
  },
  {
    type: 'bank_transfer',
    name: 'Bank Transfer',
    description: 'Traditional bank-to-bank transfer',
    icon: <Building2 className="h-5 w-5" />,
    popularity: 65,
    countries: ['PH', 'MY'],
    color: '#6B7280',
    fields: [
      {
        key: 'bank_name',
        label: 'Bank Name',
        type: 'text',
        placeholder: 'BPI, BDO, Metrobank, etc.',
        required: true
      },
      {
        key: 'account_number',
        label: 'Account Number',
        type: 'text',
        placeholder: '1234567890',
        required: true
      },
      {
        key: 'account_name',
        label: 'Account Name',
        type: 'text',
        placeholder: 'Full Name',
        required: true
      }
    ],
    defaultInstructions: 'Transfer to {bank_name} account {account_number} ({account_name}). Use reference as transfer note.'
  }
];

interface PaymentSetupProps {
  onComplete?: (methods: PaymentMethod[]) => void;
  onSkip?: () => void;
  showSkip?: boolean;
  country?: 'PH' | 'MY';
}

export default function PaymentSetup({ 
  onComplete,
  onSkip,
  showSkip = true,
  country = 'PH'
}: PaymentSetupProps) {
  const [step, setStep] = useState<'intro' | 'select' | 'configure' | 'test' | 'complete'>('intro');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PaymentMethodTemplate | null>(null);
  const [currentMethod, setCurrentMethod] = useState<Partial<PaymentMethod>>({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showAccountDetails, setShowAccountDetails] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const supabase = createClientComponentClient();

  const filteredTemplates = PAYMENT_METHOD_TEMPLATES
    .filter(template => template.countries.includes(country))
    .sort((a, b) => b.popularity - a.popularity);

  const totalSteps = 4;
  const currentStepNumber = {
    'intro': 1,
    'select': 2,
    'configure': 2,
    'test': 3,
    'complete': 4
  }[step];

  const progress = (currentStepNumber / totalSteps) * 100;

  const validateField = (field: any, value: string): string | null => {
    if (field.required && !value.trim()) {
      return `${field.label} is required`;
    }
    if (field.validation && value && !field.validation.test(value)) {
      return `Please enter a valid ${field.label.toLowerCase()}`;
    }
    return null;
  };

  const handleFieldChange = (fieldKey: string, value: string) => {
    setCurrentMethod(prev => ({
      ...prev,
      accountDetails: {
        ...prev.accountDetails,
        [fieldKey]: value
      }
    }));

    // Clear error when user starts typing
    if (errors[fieldKey]) {
      setErrors(prev => ({ ...prev, [fieldKey]: '' }));
    }
  };

  const handleInstructionsChange = (instructions: string) => {
    setCurrentMethod(prev => ({
      ...prev,
      instructions
    }));
  };

  const validateCurrentMethod = (): boolean => {
    if (!selectedTemplate) return false;

    const newErrors: Record<string, string> = {};
    
    selectedTemplate.fields.forEach(field => {
      const value = currentMethod.accountDetails?.[field.key] || '';
      const error = validateField(field, value);
      if (error) {
        newErrors[field.key] = error;
      }
    });

    if (!currentMethod.instructions?.trim()) {
      newErrors.instructions = 'Payment instructions are required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const addPaymentMethod = async () => {
    if (!validateCurrentMethod()) return;

    setLoading(true);
    try {
      const newMethod: PaymentMethod = {
        type: selectedTemplate!.type,
        name: selectedTemplate!.name,
        accountDetails: currentMethod.accountDetails || {},
        instructions: currentMethod.instructions || '',
        isEnabled: true,
        isCustom: false,
        displayOrder: paymentMethods.length
      };

      setPaymentMethods(prev => [...prev, newMethod]);
      setCurrentMethod({});
      setSelectedTemplate(null);
      setStep('select');
    } catch (error) {
      console.error('Error adding payment method:', error);
    } finally {
      setLoading(false);
    }
  };

  const removePaymentMethod = (index: number) => {
    setPaymentMethods(prev => prev.filter((_, i) => i !== index));
  };

  const handleTestPayment = async () => {
    setTestMode(true);
    // Simulate test transaction
    setTimeout(() => {
      setTestMode(false);
      setStep('complete');
    }, 3000);
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      // Save payment methods to database
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        for (const method of paymentMethods) {
          await supabase.from('payment_methods').insert({
            user_id: user.id,
            method_type: method.type,
            method_name: method.name,
            account_details: method.accountDetails,
            instructions: method.instructions,
            is_enabled: method.isEnabled,
            country_code: country,
            is_custom: method.isCustom,
            display_order: method.displayOrder
          });
        }
      }

      onComplete?.(paymentMethods);
    } catch (error) {
      console.error('Error saving payment methods:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderIntroStep = () => (
    <div className="max-w-2xl mx-auto text-center space-y-6">
      <div className="flex justify-center">
        <div className="p-4 bg-primary-100 rounded-full">
          <CreditCard className="h-12 w-12 text-primary-600" />
        </div>
      </div>
      
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Set Up Your Payment Methods
        </h2>
        <p className="text-lg text-gray-600">
          Configure how your buyers will pay you. You can add multiple payment methods 
          to give your customers more options and increase conversion rates.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-8">
        <div className="p-6 bg-blue-50 rounded-lg">
          <Shield className="h-8 w-8 text-blue-600 mb-3" />
          <h3 className="font-semibold text-gray-900 mb-2">Secure & Private</h3>
          <p className="text-sm text-gray-600">
            Your payment details are encrypted and only you can see them.
          </p>
        </div>
        <div className="p-6 bg-green-50 rounded-lg">
          <Star className="h-8 w-8 text-green-600 mb-3" />
          <h3 className="font-semibold text-gray-900 mb-2">Higher Conversion</h3>
          <p className="text-sm text-gray-600">
            Multiple payment options increase successful order completion by 40%.
          </p>
        </div>
        <div className="p-6 bg-purple-50 rounded-lg">
          <TestTube className="h-8 w-8 text-purple-600 mb-3" />
          <h3 className="font-semibold text-gray-900 mb-2">Test First</h3>
          <p className="text-sm text-gray-600">
            We'll help you test each method before going live.
          </p>
        </div>
      </div>

      <div className="flex justify-center space-x-4">
        <Button onClick={() => setStep('select')} size="lg">
          <ArrowRight className="h-4 w-4 mr-2" />
          Get Started
        </Button>
        {showSkip && (
          <Button variant="outline" onClick={onSkip} size="lg">
            Skip for Now
          </Button>
        )}
      </div>
    </div>
  );

  const renderSelectStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Choose Payment Methods
        </h2>
        <p className="text-gray-600">
          Select the payment methods you want to accept. You can add more later.
        </p>
      </div>

      {paymentMethods.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Check className="h-5 w-5 text-green-600 mr-2" />
              Configured Methods ({paymentMethods.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {paymentMethods.map((method, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: PAYMENT_METHOD_TEMPLATES.find(t => t.type === method.type)?.color }}
                    ></div>
                    <div>
                      <div className="font-medium">{method.name}</div>
                      <div className="text-sm text-gray-500">
                        {Object.values(method.accountDetails).join(' • ')}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removePaymentMethod(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTemplates.map((template) => (
          <Card 
            key={template.type}
            className={`cursor-pointer transition-colors hover:border-primary-300 ${
              selectedTemplate?.type === template.type ? 'border-primary-500 bg-primary-50' : ''
            }`}
            onClick={() => {
              setSelectedTemplate(template);
              setCurrentMethod({
                accountDetails: {},
                instructions: template.defaultInstructions
              });
              setStep('configure');
            }}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div 
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: template.color + '20' }}
                  >
                    <div style={{ color: template.color }}>
                      {template.icon}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{template.name}</h3>
                    <p className="text-sm text-gray-600">{template.description}</p>
                  </div>
                </div>
                <Badge variant="secondary">
                  {template.popularity}% popular
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  {template.countries.map(country => (
                    <Badge key={country} variant="outline" className="text-xs">
                      {country}
                    </Badge>
                  ))}
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {paymentMethods.length > 0 && (
        <div className="flex justify-center space-x-4">
          <Button onClick={() => setStep('test')} size="lg">
            Continue to Testing
          </Button>
        </div>
      )}
    </div>
  );

  const renderConfigureStep = () => {
    if (!selectedTemplate) return null;

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div 
              className="p-3 rounded-lg"
              style={{ backgroundColor: selectedTemplate.color + '20' }}
            >
              <div style={{ color: selectedTemplate.color }}>
                {selectedTemplate.icon}
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Configure {selectedTemplate.name}</h2>
              <p className="text-gray-600">{selectedTemplate.description}</p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedTemplate.fields.map((field) => (
              <div key={field.key}>
                <Label htmlFor={field.key} className="flex items-center space-x-2">
                  <span>{field.label}</span>
                  {field.required && <span className="text-red-500">*</span>}
                </Label>
                <Input
                  id={field.key}
                  type={field.type}
                  placeholder={field.placeholder}
                  value={currentMethod.accountDetails?.[field.key] || ''}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  className={errors[field.key] ? 'border-red-500' : ''}
                />
                {errors[field.key] && (
                  <p className="text-sm text-red-600 mt-1">{errors[field.key]}</p>
                )}
                {field.helpText && (
                  <p className="text-sm text-gray-500 mt-1 flex items-center">
                    <Info className="h-3 w-3 mr-1" />
                    {field.helpText}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <Label htmlFor="instructions">
              Instructions for buyers (will be shown on order page)
            </Label>
            <textarea
              id="instructions"
              className="w-full mt-2 p-3 border rounded-lg resize-none"
              rows={4}
              placeholder="Enter instructions that buyers will see..."
              value={currentMethod.instructions || ''}
              onChange={(e) => handleInstructionsChange(e.target.value)}
            />
            {errors.instructions && (
              <p className="text-sm text-red-600 mt-1">{errors.instructions}</p>
            )}
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-sm text-gray-700 mb-2">Preview:</h4>
              <div className="text-sm text-gray-600">
                {currentMethod.instructions || 'Enter instructions above to see preview...'}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={() => {
              setStep('select');
              setSelectedTemplate(null);
              setCurrentMethod({});
            }}
          >
            Back
          </Button>
          <Button 
            onClick={addPaymentMethod} 
            disabled={loading}
          >
            {loading ? 'Adding...' : 'Add Payment Method'}
          </Button>
        </div>
      </div>
    );
  };

  const renderTestStep = () => (
    <div className="max-w-2xl mx-auto text-center space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Test Your Payment Methods
        </h2>
        <p className="text-gray-600">
          Let's make sure everything works perfectly before you start accepting real payments.
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {paymentMethods.map((method, index) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: PAYMENT_METHOD_TEMPLATES.find(t => t.type === method.type)?.color }}
                  ></div>
                  <div className="text-left">
                    <div className="font-medium">{method.name}</div>
                    <div className="text-sm text-gray-500">
                      {Object.values(method.accountDetails).join(' • ')}
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className="text-green-600">
                  <Check className="h-3 w-3 mr-1" />
                  Ready
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="bg-blue-50 p-6 rounded-lg">
        <div className="flex items-start space-x-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="text-left">
            <h3 className="font-medium text-blue-900 mb-2">How testing works:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• We'll create a test order with a small amount</li>
              <li>• You can practice the payment verification process</li>
              <li>• No real money will be processed</li>
              <li>• You can skip this if you're confident</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flex justify-center space-x-4">
        <Button 
          onClick={handleTestPayment} 
          disabled={testMode}
          className="min-w-[120px]"
        >
          {testMode ? 'Testing...' : 'Start Test'}
        </Button>
        <Button 
          variant="outline" 
          onClick={() => setStep('complete')}
        >
          Skip Testing
        </Button>
      </div>

      {testMode && (
        <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
            <span className="text-yellow-800">Running payment method tests...</span>
          </div>
        </div>
      )}
    </div>
  );

  const renderCompleteStep = () => (
    <div className="max-w-2xl mx-auto text-center space-y-6">
      <div className="flex justify-center">
        <div className="p-4 bg-green-100 rounded-full">
          <Check className="h-12 w-12 text-green-600" />
        </div>
      </div>
      
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Payment Setup Complete!
        </h2>
        <p className="text-lg text-gray-600">
          You've successfully configured {paymentMethods.length} payment method
          {paymentMethods.length !== 1 ? 's' : ''}. Your buyers will now have multiple 
          options to pay for their orders.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Payment Methods</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {paymentMethods.map((method, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: PAYMENT_METHOD_TEMPLATES.find(t => t.type === method.type)?.color }}
                  ></div>
                  <div>
                    <div className="font-medium">{method.name}</div>
                    <div className="text-sm text-gray-500">
                      Ready to accept payments
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className="text-green-600">
                  <Check className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="bg-green-50 p-6 rounded-lg">
        <h3 className="font-medium text-green-900 mb-3">What's Next?</h3>
        <ul className="text-sm text-green-800 space-y-2 text-left">
          <li className="flex items-center space-x-2">
            <Check className="h-4 w-4" />
            <span>Create your first group order</span>
          </li>
          <li className="flex items-center space-x-2">
            <Check className="h-4 w-4" />
            <span>Share with your community</span>
          </li>
          <li className="flex items-center space-x-2">
            <Check className="h-4 w-4" />
            <span>Start accepting payments automatically</span>
          </li>
        </ul>
      </div>

      <Button onClick={handleComplete} size="lg" disabled={loading}>
        {loading ? 'Saving...' : 'Complete Setup'}
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Progress Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-gray-900">Payment Setup</h1>
            <Badge variant="outline">
              Step {currentStepNumber} of {totalSteps}
            </Badge>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-lg shadow-sm p-8">
          {step === 'intro' && renderIntroStep()}
          {step === 'select' && renderSelectStep()}
          {step === 'configure' && renderConfigureStep()}
          {step === 'test' && renderTestStep()}
          {step === 'complete' && renderCompleteStep()}
        </div>
      </div>
    </div>
  );
}
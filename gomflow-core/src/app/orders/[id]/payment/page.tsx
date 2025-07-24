"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PaymentMethodSelector } from "@/components/payments/PaymentMethodSelector";
import { PaymentProofUpload } from "@/components/payments/PaymentProofUpload";
import { 
  ArrowLeft,
  Copy,
  Upload,
  CheckCircle,
  Clock,
  AlertCircle,
  CreditCard,
  QrCode,
  Smartphone,
  FileImage,
  DollarSign
} from "lucide-react";

export default function PaymentPage() {
  const [order, setOrder] = useState<any>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [paymentSent, setPaymentSent] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<'method' | 'upload' | 'instructions'>('method');
  
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const supabase = createClientComponentClient();
  
  const orderId = params.id;
  const paymentRef = searchParams.get('ref');

  useEffect(() => {
    const fetchPaymentDetails = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);

        if (!user || !orderId || !paymentRef) return;

        // Fetch order details
        const orderResponse = await fetch(`/api/orders/${orderId}`, {
          headers: {
            'Authorization': `Bearer ${user.access_token}`
          }
        });
        
        if (orderResponse.ok) {
          const orderData = await orderResponse.json();
          setOrder(orderData.data);
        }

        // Fetch submission details
        const submissionResponse = await fetch(`/api/submissions/${paymentRef}`, {
          headers: {
            'Authorization': `Bearer ${user.access_token}`
          }
        });
        
        if (submissionResponse.ok) {
          const submissionData = await submissionResponse.json();
          setSubmission(submissionData.data);
        }
      } catch (error) {
        console.error('Error fetching payment details:', error);
        setError('Failed to load payment details');
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentDetails();
  }, [supabase, orderId, paymentRef]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast notification here
  };

  const handleFilesChange = (files: any[]) => {
    setUploadedFiles(files);
    setError('');
  };

  const handlePaymentMethodSelect = (methodId: string) => {
    setSelectedPaymentMethod(methodId);
    // Update submission with selected payment method
    if (submission) {
      setSubmission(prev => ({ ...prev, payment_method: methodId }));
    }
  };

  const handleSubmitProof = async () => {
    if (uploadedFiles.length === 0) {
      setError('Please upload at least one payment screenshot');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      
      // Add all uploaded files
      uploadedFiles.forEach((uploadedFile, index) => {
        formData.append(`image_${index}`, uploadedFile.file);
      });
      
      formData.append('submission_id', submission.id);
      formData.append('order_id', orderId as string);
      formData.append('payment_method', selectedPaymentMethod || submission.payment_method);

      const response = await fetch('/api/payments/upload-proof', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.access_token}`
        },
        body: formData
      });

      if (response.ok) {
        setPaymentSent(true);
        // Update submission status
        setSubmission(prev => ({ ...prev, payment_status: 'pending_verification' }));
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to upload payment proof');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!order || !submission) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Payment details not found</h3>
          <p className="text-gray-500 mb-4">Unable to load payment information.</p>
          <Button onClick={() => router.push('/dashboard')}>Return to Dashboard</Button>
        </div>
      </DashboardLayout>
    );
  }

  const totalAmount = submission.quantity * order.price;
  
  const getPaymentInstructions = () => {
    switch (submission.payment_method) {
      case 'gcash':
        return {
          name: 'GCash',
          account: '09XX XXX XXXX',
          accountName: order.gom_name || 'Group Order Manager',
          steps: [
            'Open your GCash app',
            'Tap "Send Money"',
            'Enter the mobile number above',
            'Enter the exact amount',
            'Add payment reference in message',
            'Complete the transaction',
            'Screenshot the confirmation'
          ],
          qrAvailable: true
        };
      case 'paymaya':
        return {
          name: 'PayMaya',
          account: '09XX XXX XXXX',
          accountName: order.gom_name || 'Group Order Manager',
          steps: [
            'Open your PayMaya app',
            'Tap "Send Money"',
            'Enter the mobile number above',
            'Enter the exact amount',
            'Add payment reference in notes',
            'Complete the transaction',
            'Screenshot the confirmation'
          ],
          qrAvailable: true
        };
      case 'bank_transfer':
        return {
          name: 'Bank Transfer',
          account: '1234567890',
          accountName: order.gom_name || 'Group Order Manager',
          bank: 'BPI / BDO / MetroBank',
          steps: [
            'Log in to your online banking',
            'Select "Transfer to Other Bank"',
            'Enter account details above',
            'Enter the exact amount',
            'Add payment reference in remarks',
            'Complete the transaction',
            'Screenshot the confirmation'
          ],
          qrAvailable: false
        };
      case 'maybank':
        return {
          name: 'Maybank2u',
          account: '1234567890',
          accountName: order.gom_name || 'Group Order Manager',
          steps: [
            'Log in to Maybank2u',
            'Go to Transfer > To Other Bank',
            'Enter account details above',
            'Enter the exact amount',
            'Add payment reference in notes',
            'Complete the transaction',
            'Screenshot the confirmation'
          ],
          qrAvailable: false
        };
      case 'touch_n_go':
        return {
          name: "Touch 'n Go eWallet",
          account: '01X-XXX XXXX',
          accountName: order.gom_name || 'Group Order Manager',
          steps: [
            'Open Touch n Go eWallet',
            'Tap "Send Money"',
            'Enter the phone number above',
            'Enter the exact amount',
            'Add payment reference in message',
            'Complete the transaction',
            'Screenshot the confirmation'
          ],
          qrAvailable: true
        };
      case 'cimb':
        return {
          name: 'CIMB Bank',
          account: '1234567890',
          accountName: order.gom_name || 'Group Order Manager',
          steps: [
            'Log in to CIMB Clicks',
            'Go to Transfer > To Other Bank',
            'Enter account details above',
            'Enter the exact amount',
            'Add payment reference in remarks',
            'Complete the transaction',
            'Screenshot the confirmation'
          ],
          qrAvailable: false
        };
      default:
        return null;
    }
  };

  const paymentInstructions = getPaymentInstructions();

  if (paymentSent) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="text-center py-12">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Payment Proof Submitted!
              </h3>
              <p className="text-gray-500 mb-6">
                Your payment screenshot has been received and will be verified by the GOM. 
                You'll receive a notification once your payment is confirmed.
              </p>
              <div className="space-y-2">
                <Button onClick={() => router.push('/dashboard')}>
                  Return to Dashboard
                </Button>
                <div className="text-xs text-gray-500">
                  Reference: {submission.payment_reference}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">Payment Process</h1>
            <p className="text-gray-600">Complete your payment to secure your order</p>
          </div>
          
          {/* Step indicator */}
          <div className="flex items-center gap-2 text-sm">
            <div className={`px-3 py-1 rounded-full ${
              currentStep === 'method' ? 'bg-primary text-white' : 
              selectedPaymentMethod ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
            }`}>
              1. Method
            </div>
            <div className={`px-3 py-1 rounded-full ${
              currentStep === 'upload' ? 'bg-primary text-white' : 
              uploadedFiles.length > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
            }`}>
              2. Upload
            </div>
            <div className={`px-3 py-1 rounded-full ${
              currentStep === 'instructions' || paymentSent ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
            }`}>
              3. Done
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Payment Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-4 border-b">
                <div>
                  <div className="font-medium">{order.title}</div>
                  <div className="text-sm text-gray-600">Quantity: {submission.quantity}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">
                    {order.currency === 'PHP' ? '₱' : 'RM'}{totalAmount.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-600">
                    {submission.quantity} × {order.currency === 'PHP' ? '₱' : 'RM'}{order.price}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Payment Reference:</span>
                  <div className="font-mono font-medium">{submission.payment_reference}</div>
                </div>
                <div>
                  <span className="text-gray-600">Status:</span>
                  <div>
                    <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                      <Clock className="h-3 w-3 mr-1" />
                      Awaiting Payment
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 1: Payment Method Selection */}
        {currentStep === 'method' && (
          <>
            <PaymentMethodSelector
              country={order.currency === 'PHP' ? 'PH' : 'MY'}
              selectedMethod={selectedPaymentMethod}
              onMethodSelect={handlePaymentMethodSelect}
              orderAmount={totalAmount}
              currency={order.currency}
            />
            
            {selectedPaymentMethod && (
              <div className="flex justify-end">
                <Button onClick={() => setCurrentStep('upload')}>
                  Continue to Upload
                  <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                </Button>
              </div>
            )}
          </>
        )}

        {/* Step 2: Payment Proof Upload */}
        {currentStep === 'upload' && (
          <>
            <PaymentProofUpload
              onFilesChange={handleFilesChange}
              maxFiles={3}
              maxFileSize={10}
              requiredAmount={totalAmount}
              currency={order.currency}
              paymentMethod={selectedPaymentMethod || submission.payment_method}
              submissionId={submission.id}
            />
            
            <div className="flex justify-between">
              <Button 
                variant="outline" 
                onClick={() => setCurrentStep('method')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Method
              </Button>
              
              <Button
                onClick={handleSubmitProof}
                disabled={uploadedFiles.length === 0 || uploading}
              >
                {uploading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Processing...
                  </div>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Submit Payment Proof
                  </>
                )}
              </Button>
            </div>
          </>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        )}

        {/* Important Notes */}
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-6">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800">
                <div className="font-medium mb-2">Important Reminders:</div>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Pay the exact amount: {order.currency === 'PHP' ? '₱' : 'RM'}{totalAmount.toFixed(2)}</li>
                  <li>Include payment reference: {submission.payment_reference}</li>
                  <li>Upload clear screenshots showing transaction details</li>
                  <li>Payment must be completed within 24 hours</li>
                  <li>Our AI will automatically verify your payment proof</li>
                  <li>Contact support if you encounter any issues</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
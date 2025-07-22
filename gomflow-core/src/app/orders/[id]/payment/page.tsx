"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [paymentSent, setPaymentSent] = useState(false);
  const [user, setUser] = useState<any>(null);
  
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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }
      
      setUploadedFile(file);
      setError('');
    }
  };

  const handleSubmitProof = async () => {
    if (!uploadedFile) {
      setError('Please select a payment screenshot');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('image', uploadedFile);
      formData.append('submission_id', submission.id);
      formData.append('order_id', orderId as string);

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
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payment Instructions</h1>
            <p className="text-gray-600">Complete your payment to secure your order</p>
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

        {/* Payment Instructions */}
        {paymentInstructions && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                {paymentInstructions.name} Payment
              </CardTitle>
              <CardDescription>
                Follow these steps to complete your payment
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Account Details */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-3">Account Details</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Account Number:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono">{paymentInstructions.account}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(paymentInstructions.account)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Account Name:</span>
                    <span className="font-medium">{paymentInstructions.accountName}</span>
                  </div>
                  {paymentInstructions.bank && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Bank:</span>
                      <span>{paymentInstructions.bank}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Amount:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg text-primary">
                        {order.currency === 'PHP' ? '₱' : 'RM'}{totalAmount.toFixed(2)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(totalAmount.toFixed(2))}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Reference:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">{submission.payment_reference}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(submission.payment_reference)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Steps */}
              <div>
                <h4 className="font-medium mb-3">Payment Steps</h4>
                <ol className="space-y-2">
                  {paymentInstructions.steps.map((step, index) => (
                    <li key={index} className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-primary text-white rounded-full text-xs flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span className="text-sm">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* QR Code placeholder */}
              {paymentInstructions.qrAvailable && (
                <div className="text-center p-6 border-2 border-dashed border-gray-300 rounded-lg">
                  <QrCode className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">QR Code coming soon</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Upload Payment Proof */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Payment Proof
            </CardTitle>
            <CardDescription>
              Take a screenshot of your payment confirmation and upload it here
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              {uploadedFile ? (
                <div className="space-y-2">
                  <FileImage className="h-8 w-8 text-green-600 mx-auto" />
                  <p className="text-sm font-medium text-green-600">{uploadedFile.name}</p>
                  <p className="text-xs text-gray-500">
                    {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setUploadedFile(null)}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Smartphone className="h-8 w-8 text-gray-400 mx-auto" />
                  <p className="text-sm text-gray-600">Upload your payment screenshot</p>
                  <p className="text-xs text-gray-500">PNG, JPG up to 5MB</p>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <Button
              onClick={handleSubmitProof}
              disabled={!uploadedFile || uploading}
              className="w-full"
            >
              {uploading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Uploading...
                </div>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Submit Payment Proof
                </>
              )}
            </Button>
          </CardContent>
        </Card>

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
                  <li>Upload clear screenshot showing transaction details</li>
                  <li>Payment must be completed within 24 hours</li>
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
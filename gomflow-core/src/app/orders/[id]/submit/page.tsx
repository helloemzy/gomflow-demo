"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft,
  Package,
  User,
  MapPin,
  CreditCard,
  Upload,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  Phone,
  Mail
} from "lucide-react";

export default function SubmitOrderPage() {
  const [order, setOrder] = useState<any>(null);
  const [formData, setFormData] = useState({
    quantity: "1",
    buyer_name: "",
    buyer_phone: "",
    buyer_email: "",
    delivery_address: "",
    payment_method: "gcash",
    special_instructions: ""
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  const router = useRouter();
  const params = useParams();
  const supabase = createClientComponentClient();
  const orderId = params.id;

  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);

        if (!user || !orderId) return;

        // Fetch order details
        const orderResponse = await fetch(`/api/orders/${orderId}`, {
          headers: {
            'Authorization': `Bearer ${user.access_token}`
          }
        });
        
        if (orderResponse.ok) {
          const orderData = await orderResponse.json();
          setOrder(orderData.data);
          
          // Pre-fill user data if available
          if (user.user_metadata) {
            setFormData(prev => ({
              ...prev,
              buyer_name: user.user_metadata.full_name || "",
              buyer_email: user.email || "",
              buyer_phone: user.user_metadata.phone || ""
            }));
          }
        }
      } catch (error) {
        console.error('Error fetching order details:', error);
        setError('Failed to load order details');
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetails();
  }, [supabase, orderId]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      // Validate required fields
      if (!formData.buyer_name || !formData.buyer_phone || !formData.buyer_email || 
          !formData.delivery_address || !formData.quantity) {
        setError("Please fill in all required fields");
        return;
      }

      // Validate quantity
      const quantity = parseInt(formData.quantity);
      if (isNaN(quantity) || quantity <= 0) {
        setError("Please enter a valid quantity");
        return;
      }

      // Validate email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.buyer_email)) {
        setError("Please enter a valid email address");
        return;
      }

      // Submit order
      const response = await fetch(`/api/orders/${orderId}/submissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.access_token}`
        },
        body: JSON.stringify({
          ...formData,
          quantity: quantity
        })
      });

      if (response.ok) {
        const result = await response.json();
        setSuccess(true);
        // Redirect to payment instructions after 2 seconds
        setTimeout(() => {
          router.push(`/orders/${orderId}/payment?ref=${result.data.payment_reference}`);
        }, 2000);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to submit order");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setSubmitting(false);
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

  if (!order) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Order not found</h3>
          <p className="text-gray-500 mb-4">This order may have been deleted or you don't have access to it.</p>
          <Button onClick={() => router.back()}>Go Back</Button>
        </div>
      </DashboardLayout>
    );
  }

  const now = new Date();
  const deadline = new Date(order.deadline);
  const isExpired = deadline <= now;
  const isActive = order.is_active && !isExpired;
  const totalPrice = parseFloat(formData.quantity || "1") * order.price;

  // Check if order is still accepting submissions
  if (!isActive) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">Order Submission</h1>
          </div>
          
          <Card>
            <CardContent className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Order No Longer Available
              </h3>
              <p className="text-gray-500 mb-4">
                This order has {isExpired ? 'expired' : 'been closed'} and is no longer accepting submissions.
              </p>
              <Button onClick={() => router.push('/browse')}>
                Browse Other Orders
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (success) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="text-center py-12">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Submission Successful!
              </h3>
              <p className="text-gray-500 mb-4">
                Your order has been submitted successfully. You'll be redirected to payment instructions shortly.
              </p>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
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
            <h1 className="text-2xl font-bold text-gray-900">Join Group Order</h1>
            <p className="text-gray-600">Submit your order for: {order.title}</p>
          </div>
        </div>

        {/* Order Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Order Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="font-medium text-gray-900">Price per Item</div>
                <div className="text-lg font-bold text-primary">
                  {order.currency === 'PHP' ? '₱' : 'RM'}{order.price.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="font-medium text-gray-900">Category</div>
                <div className="text-gray-600 capitalize">{order.category}</div>
              </div>
              <div>
                <div className="font-medium text-gray-900">Deadline</div>
                <div className="text-gray-600">
                  {new Date(order.deadline).toLocaleDateString()}
                </div>
              </div>
              <div>
                <div className="font-medium text-gray-900">Progress</div>
                <div className="text-gray-600">
                  {order.submission_count}/{order.min_orders} orders
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Buyer Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Your Information
              </CardTitle>
              <CardDescription>
                Please provide your contact and delivery information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="buyer_name">Full Name *</Label>
                  <Input
                    id="buyer_name"
                    placeholder="Your full name"
                    value={formData.buyer_name}
                    onChange={(e) => handleInputChange("buyer_name", e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="buyer_phone">Phone Number *</Label>
                  <Input
                    id="buyer_phone"
                    type="tel"
                    placeholder="+63 9XX XXX XXXX"
                    value={formData.buyer_phone}
                    onChange={(e) => handleInputChange("buyer_phone", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="buyer_email">Email Address *</Label>
                <Input
                  id="buyer_email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={formData.buyer_email}
                  onChange={(e) => handleInputChange("buyer_email", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="delivery_address">Delivery Address *</Label>
                <textarea
                  id="delivery_address"
                  className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px]"
                  placeholder="Complete delivery address including city and postal code"
                  value={formData.delivery_address}
                  onChange={(e) => handleInputChange("delivery_address", e.target.value)}
                  required
                />
              </div>
            </CardContent>
          </Card>

          {/* Order Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Order Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    placeholder="1"
                    value={formData.quantity}
                    onChange={(e) => handleInputChange("quantity", e.target.value)}
                    required
                  />
                  <p className="text-xs text-gray-500">
                    Number of items you want to order
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Total Amount</Label>
                  <div className="px-3 py-2 border border-input bg-gray-50 rounded-md text-lg font-bold text-primary">
                    {order.currency === 'PHP' ? '₱' : 'RM'}{totalPrice.toFixed(2)}
                  </div>
                  <p className="text-xs text-gray-500">
                    {formData.quantity || 1} × {order.currency === 'PHP' ? '₱' : 'RM'}{order.price}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="special_instructions">Special Instructions (Optional)</Label>
                <textarea
                  id="special_instructions"
                  className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[60px]"
                  placeholder="Any special requests or notes for the GOM"
                  value={formData.special_instructions}
                  onChange={(e) => handleInputChange("special_instructions", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Payment Method Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Method
              </CardTitle>
              <CardDescription>
                Choose your preferred payment method. More options available after order submission.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {order.currency === 'PHP' ? (
                  <>
                    <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="payment_method"
                        value="gcash"
                        checked={formData.payment_method === "gcash"}
                        onChange={(e) => handleInputChange("payment_method", e.target.value)}
                        className="text-primary"
                      />
                      <div>
                        <div className="font-medium">GCash</div>
                        <div className="text-sm text-gray-500">Mobile wallet</div>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="payment_method"
                        value="paymaya"
                        checked={formData.payment_method === "paymaya"}
                        onChange={(e) => handleInputChange("payment_method", e.target.value)}
                        className="text-primary"
                      />
                      <div>
                        <div className="font-medium">PayMaya</div>
                        <div className="text-sm text-gray-500">Digital wallet</div>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="payment_method"
                        value="bank_transfer"
                        checked={formData.payment_method === "bank_transfer"}
                        onChange={(e) => handleInputChange("payment_method", e.target.value)}
                        className="text-primary"
                      />
                      <div>
                        <div className="font-medium">Bank Transfer</div>
                        <div className="text-sm text-gray-500">InstaPay/PESONet</div>
                      </div>
                    </label>
                  </>
                ) : (
                  <>
                    <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="payment_method"
                        value="maybank"
                        checked={formData.payment_method === "maybank"}
                        onChange={(e) => handleInputChange("payment_method", e.target.value)}
                        className="text-primary"
                      />
                      <div>
                        <div className="font-medium">Maybank2u</div>
                        <div className="text-sm text-gray-500">Online banking</div>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="payment_method"
                        value="touch_n_go"
                        checked={formData.payment_method === "touch_n_go"}
                        onChange={(e) => handleInputChange("payment_method", e.target.value)}
                        className="text-primary"
                      />
                      <div>
                        <div className="font-medium">Touch 'n Go</div>
                        <div className="text-sm text-gray-500">eWallet</div>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="payment_method"
                        value="cimb"
                        checked={formData.payment_method === "cimb"}
                        onChange={(e) => handleInputChange("payment_method", e.target.value)}
                        className="text-primary"
                      />
                      <div>
                        <div className="font-medium">CIMB Bank</div>
                        <div className="text-sm text-gray-500">Online banking</div>
                      </div>
                    </label>
                  </>
                )}
              </div>
              
              <div className="mt-4 text-xs text-blue-600 bg-blue-50 p-3 rounded-lg">
                <div className="font-medium mb-1">💡 More payment options available</div>
                <p>After submitting your order, you'll access our full payment system with 20+ Southeast Asian payment methods, AI verification, and instant confirmation.</p>
              </div>
            </CardContent>
          </Card>

          {/* Important Notes */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-6">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <div className="font-medium mb-2">Important:</div>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>You'll receive payment instructions after submitting this form</li>
                    <li>Please complete payment within 24 hours to secure your spot</li>
                    <li>Orders are confirmed only after payment verification</li>
                    <li>Delivery will begin once the minimum order quantity is reached</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="min-w-[120px]"
            >
              {submitting ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Submitting...
                </div>
              ) : (
                `Submit Order • ${order.currency === 'PHP' ? '₱' : 'RM'}${totalPrice.toFixed(2)}`
              )}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
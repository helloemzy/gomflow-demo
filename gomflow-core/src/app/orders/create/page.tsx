"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Calendar, DollarSign, Package, Users } from "lucide-react";

export default function CreateOrderPage() {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    currency: "PHP",
    deadline: "",
    minOrders: "",
    maxOrders: "",
    category: "album",
    shippingFrom: "Philippines"
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const router = useRouter();
  const supabase = createClientComponentClient();

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("You must be logged in to create orders");
        return;
      }

      // Validate required fields
      if (!formData.title || !formData.price || !formData.deadline || !formData.minOrders) {
        setError("Please fill in all required fields");
        return;
      }

      // Validate deadline is in the future
      if (new Date(formData.deadline) <= new Date()) {
        setError("Deadline must be in the future");
        return;
      }

      // Validate price
      const price = parseFloat(formData.price);
      if (isNaN(price) || price <= 0) {
        setError("Please enter a valid price");
        return;
      }

      // Validate order quantities
      const minOrders = parseInt(formData.minOrders);
      const maxOrders = formData.maxOrders ? parseInt(formData.maxOrders) : null;
      
      if (isNaN(minOrders) || minOrders <= 0) {
        setError("Minimum orders must be a positive number");
        return;
      }

      if (maxOrders && (isNaN(maxOrders) || maxOrders < minOrders)) {
        setError("Maximum orders must be greater than minimum orders");
        return;
      }

      // Create order
      const orderData = {
        title: formData.title,
        description: formData.description || null,
        price: price,
        currency: formData.currency,
        deadline: formData.deadline,
        min_orders: minOrders,
        max_orders: maxOrders,
        category: formData.category,
        shipping_from: formData.shippingFrom,
        is_active: true
      };

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.access_token}`
        },
        body: JSON.stringify(orderData)
      });

      if (response.ok) {
        const result = await response.json();
        router.push(`/orders/${result.data.id}`);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to create order");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout requiredRole="gom">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create New Order</h1>
            <p className="text-gray-600">Set up a new group order for your community</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Order Details
              </CardTitle>
              <CardDescription>
                Basic information about your group order
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Order Title *</Label>
                <Input
                  id="title"
                  placeholder="SEVENTEEN God of Music Album - Limited Edition"
                  value={formData.title}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[100px]"
                  placeholder="Limited edition album with exclusive photocards, photobook, and special packaging..."
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <select
                    id="category"
                    className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={formData.category}
                    onChange={(e) => handleInputChange("category", e.target.value)}
                  >
                    <option value="album">Album</option>
                    <option value="merchandise">Merchandise</option>
                    <option value="photocard">Photocard</option>
                    <option value="fashion">Fashion</option>
                    <option value="collectible">Collectible</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="shippingFrom">Shipping From</Label>
                  <select
                    id="shippingFrom"
                    className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={formData.shippingFrom}
                    onChange={(e) => handleInputChange("shippingFrom", e.target.value)}
                  >
                    <option value="Philippines">Philippines</option>
                    <option value="Malaysia">Malaysia</option>
                    <option value="South Korea">South Korea</option>
                    <option value="Japan">Japan</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Pricing
              </CardTitle>
              <CardDescription>
                Set the price per item for your group order
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price per Item *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="25.00"
                    value={formData.price}
                    onChange={(e) => handleInputChange("price", e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <select
                    id="currency"
                    className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={formData.currency}
                    onChange={(e) => handleInputChange("currency", e.target.value)}
                  >
                    <option value="PHP">Philippine Peso (₱)</option>
                    <option value="MYR">Malaysian Ringgit (RM)</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order Quantities */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Order Quantities
              </CardTitle>
              <CardDescription>
                Set minimum and maximum order quantities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minOrders">Minimum Orders *</Label>
                  <Input
                    id="minOrders"
                    type="number"
                    min="1"
                    placeholder="50"
                    value={formData.minOrders}
                    onChange={(e) => handleInputChange("minOrders", e.target.value)}
                    required
                  />
                  <p className="text-xs text-gray-500">
                    Order will only proceed if this many orders are received
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="maxOrders">Maximum Orders (Optional)</Label>
                  <Input
                    id="maxOrders"
                    type="number"
                    min="1"
                    placeholder="200"
                    value={formData.maxOrders}
                    onChange={(e) => handleInputChange("maxOrders", e.target.value)}
                  />
                  <p className="text-xs text-gray-500">
                    Leave empty for no maximum limit
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Deadline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Deadline
              </CardTitle>
              <CardDescription>
                When should orders close?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="deadline">Order Deadline *</Label>
                <Input
                  id="deadline"
                  type="datetime-local"
                  value={formData.deadline}
                  onChange={(e) => handleInputChange("deadline", e.target.value)}
                  required
                  min={new Date().toISOString().slice(0, 16)}
                />
                <p className="text-xs text-gray-500">
                  Orders will automatically close at this date and time
                </p>
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
              disabled={loading}
            >
              {loading ? "Creating Order..." : "Create Order"}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
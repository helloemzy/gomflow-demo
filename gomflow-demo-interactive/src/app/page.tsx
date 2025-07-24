"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Package, 
  Users, 
  CreditCard, 
  TrendingUp,
  Plus,
  Eye,
  MessageCircle,
  Clock,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Globe,
  Zap,
  Shield
} from 'lucide-react';

export default function InteractiveDemoPage() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [orders, setOrders] = useState([
    {
      id: 'demo-order-1',
      title: 'SEVENTEEN "God of Music" Album',
      description: 'Limited edition album with photocard set',
      price: 1800,
      currency: 'PHP',
      progress: 80,
      current: 24,
      target: 30,
      deadline: '5 days left',
      status: 'active'
    },
    {
      id: 'demo-order-2', 
      title: 'BLACKPINK Limited Photobook',
      description: 'Rare Japan tour photobook',
      price: 3500,
      currency: 'PHP', 
      progress: 100,
      current: 85,
      target: 85,
      deadline: 'Completed',
      status: 'completed'
    },
    {
      id: 'demo-order-3',
      title: 'STRAY KIDS Concert Goods',
      description: 'Official merchandise bundle',
      price: 180,
      currency: 'MYR',
      progress: 60,
      current: 18,
      target: 30,
      deadline: '8 days left', 
      status: 'active'
    }
  ]);

  const [stats, setStats] = useState({
    totalOrders: 147,
    totalRevenue: 285600,
    activeOrders: 8,
    completionRate: 94.2
  });

  const [showPaymentDemo, setShowPaymentDemo] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  const simulatePaymentProcessing = () => {
    setPaymentProcessing(true);
    setTimeout(() => {
      setPaymentProcessing(false);
      alert('✅ Payment verified successfully! AI detected GCash payment of ₱1,800 for SEVENTEEN album order.');
    }, 3000);
  };

  const createDemoOrder = () => {
    const newOrder = {
      id: `demo-order-${Date.now()}`,
      title: 'NewJeans "Get Up" Special Edition',
      description: 'Limited release with exclusive photocards',
      price: 2200,
      currency: 'PHP',
      progress: 0,
      current: 0,
      target: 25,
      deadline: '14 days left',
      status: 'active'
    };
    setOrders([newOrder, ...orders]);
    alert('🎉 New demo order created successfully!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-purple-600 rounded-lg"></div>
                <span className="text-2xl font-bold text-gray-900">GOMFLOW</span>
              </div>
              <span className="px-3 py-1 bg-orange-100 text-orange-800 text-sm font-medium rounded-full">
                Interactive Demo
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <Button 
                variant={currentView === 'dashboard' ? 'default' : 'outline'}
                onClick={() => setCurrentView('dashboard')}
              >
                Dashboard
              </Button>
              <Button 
                variant={currentView === 'orders' ? 'default' : 'outline'}
                onClick={() => setCurrentView('orders')}
              >
                Orders
              </Button>
              <Button 
                variant={currentView === 'create' ? 'default' : 'outline'}
                onClick={() => setCurrentView('create')}
              >
                Create Order
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard View */}
        {currentView === 'dashboard' && (
          <div className="space-y-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
              <p className="text-gray-600">Welcome to your GOMFLOW demo dashboard</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalOrders}</div>
                  <p className="text-xs text-muted-foreground">+12% from last month</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">₱{stats.totalRevenue.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">+8.2% from last month</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.activeOrders}</div>
                  <p className="text-xs text-muted-foreground">Currently running</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.completionRate}%</div>
                  <p className="text-xs text-muted-foreground">Orders completed</p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Orders */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Orders</CardTitle>
                <CardDescription>Your latest group orders</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {orders.slice(0, 3).map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <h3 className="font-semibold">{order.title}</h3>
                        <p className="text-sm text-gray-600">{order.description}</p>
                        <div className="flex items-center space-x-4 mt-2">
                          <span className="text-sm">{order.currency} {order.price}</span>
                          <span className="text-sm text-gray-500">{order.current}/{order.target} orders</span>
                          <span className="text-sm text-orange-600">{order.deadline}</span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <Progress value={order.progress} className="w-20" />
                        <span className="text-xs text-gray-500 mt-1">{order.progress}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Demo AI Payment Processing */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Zap className="h-5 w-5 text-orange-500" />
                  <span>AI Payment Processing Demo</span>
                </CardTitle>
                <CardDescription>
                  See how GOMFLOW's AI automatically processes payment screenshots
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-2">
                      🤖 Upload a payment screenshot and watch our AI:
                    </p>
                    <ul className="text-sm text-gray-600 space-y-1 ml-4">
                      <li>• Extract payment amount automatically</li>
                      <li>• Identify payment method (GCash, PayMaya, etc.)</li>
                      <li>• Match to correct order</li>
                      <li>• Verify authenticity</li>
                      <li>• Update order status instantly</li>
                    </ul>
                  </div>
                  <Button 
                    onClick={simulatePaymentProcessing}
                    disabled={paymentProcessing}
                    className="w-full"
                  >
                    {paymentProcessing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Processing Payment...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 mr-2" />
                        Demo AI Payment Processing
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Orders View */}
        {currentView === 'orders' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold text-gray-900">All Orders</h1>
              <Button onClick={createDemoOrder}>
                <Plus className="h-4 w-4 mr-2" />
                Create Demo Order
              </Button>
            </div>

            <div className="grid gap-6">
              {orders.map((order) => (
                <Card key={order.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{order.title}</CardTitle>
                        <CardDescription>{order.description}</CardDescription>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          order.status === 'completed' 
                            ? 'bg-green-100 text-green-800'
                            : 'bg-orange-100 text-orange-800'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between text-sm">
                        <span>Progress: {order.current}/{order.target} orders</span>
                        <span className="text-orange-600">{order.deadline}</span>
                      </div>
                      <Progress value={order.progress} />
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-semibold">{order.currency} {order.price}</span>
                        <div className="flex space-x-2">
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          <Button variant="outline" size="sm">
                            <MessageCircle className="h-4 w-4 mr-1" />
                            Message
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Create Order View */}
        {currentView === 'create' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <h1 className="text-3xl font-bold text-gray-900">Create New Order</h1>
            
            <Card>
              <CardHeader>
                <CardTitle>Order Details</CardTitle>
                <CardDescription>Set up your new group order</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Product Title</label>
                  <input 
                    type="text" 
                    className="w-full p-3 border rounded-lg"
                    placeholder="e.g., SEVENTEEN 'God of Music' Album"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea 
                    className="w-full p-3 border rounded-lg h-24"
                    placeholder="Detailed product description..."
                  ></textarea>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Price</label>
                    <input 
                      type="number" 
                      className="w-full p-3 border rounded-lg"
                      placeholder="1800"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Currency</label>
                    <select className="w-full p-3 border rounded-lg">
                      <option>PHP</option>
                      <option>MYR</option>
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Minimum Orders</label>
                    <input 
                      type="number" 
                      className="w-full p-3 border rounded-lg"
                      placeholder="20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Maximum Orders</label>
                    <input 
                      type="number" 
                      className="w-full p-3 border rounded-lg"
                      placeholder="50"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Deadline</label>
                  <input 
                    type="date" 
                    className="w-full p-3 border rounded-lg"
                  />
                </div>
                
                <Button onClick={createDemoOrder} className="w-full">
                  Create Demo Order
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Demo Features Banner */}
      <div className="fixed bottom-4 left-4 right-4 bg-white border border-orange-200 rounded-lg shadow-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">🎭 Interactive Demo Features</h3>
            <p className="text-sm text-gray-600">
              Try creating orders, processing payments, and exploring the dashboard!
            </p>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Shield className="h-4 w-4" />
            <span>All data is simulated</span>
          </div>
        </div>
      </div>
    </div>
  );
}
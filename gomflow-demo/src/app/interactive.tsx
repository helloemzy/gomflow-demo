"use client";

import { useState } from 'react';

interface Order {
  id: string;
  title: string;
  progress: number;
  current: number;
  target: number;
  timeLeft: string;
  price: number;
  currency: string;
  status: 'active' | 'completed';
}

interface DemoState {
  view: 'landing' | 'dashboard' | 'orders' | 'create';
  orders: Order[];
  stats: {
    totalOrders: number;
    totalRevenue: number;
    activeOrders: number;
    successRate: number;
  };
}

export function InteractiveDemo() {
  const [demoState, setDemoState] = useState<DemoState>({
    view: 'landing',
    orders: [
      {
        id: '1',
        title: 'SEVENTEEN "God of Music" Album',
        progress: 80,
        current: 24,
        target: 30,
        timeLeft: '5 days left',
        price: 1800,
        currency: 'PHP',
        status: 'active'
      },
      {
        id: '2', 
        title: 'BLACKPINK Limited Photobook',
        progress: 100,
        current: 85,
        target: 85,
        timeLeft: 'Completed',
        price: 3500,
        currency: 'PHP',
        status: 'completed'
      },
      {
        id: '3',
        title: 'STRAY KIDS Concert Goods',
        progress: 60,
        current: 18,
        target: 30,
        timeLeft: '8 days left',
        price: 180,
        currency: 'MYR',
        status: 'active'
      }
    ],
    stats: {
      totalOrders: 147,
      totalRevenue: 285600,
      activeOrders: 8,
      successRate: 94.2
    }
  });

  const [paymentProcessing, setPaymentProcessing] = useState(false);

  const simulatePaymentProcessing = () => {
    setPaymentProcessing(true);
    setTimeout(() => {
      setPaymentProcessing(false);
      alert('✅ Payment verified successfully!\n\nAI detected:\n• GCash payment of ₱1,800\n• For SEVENTEEN album order\n• 95% confidence score\n• Auto-approved and updated order status');
    }, 3000);
  };

  const createDemoOrder = () => {
    const newOrder: Order = {
      id: Date.now().toString(),
      title: 'NewJeans "Get Up" Special Edition',
      progress: 0,
      current: 0,
      target: 25,
      timeLeft: '14 days left',
      price: 2200,
      currency: 'PHP',
      status: 'active'
    };
    
    setDemoState(prev => ({
      ...prev,
      orders: [newOrder, ...prev.orders],
      stats: {
        ...prev.stats,
        activeOrders: prev.stats.activeOrders + 1
      }
    }));
    
    alert('🎉 New demo order created successfully!\n\nFeatures activated:\n• Automatic payment tracking\n• Multi-platform notifications\n• Real-time analytics\n• AI payment processing');
  };

  if (demoState.view === 'landing') {
    return (
      <div className="fixed inset-0 z-50 bg-white">
        {/* Interactive Demo Header */}
        <div className="bg-gradient-to-r from-orange-500 to-purple-600 text-white p-4 text-center">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-2">🎭 GOMFLOW Interactive Demo</h2>
            <p className="text-orange-100 mb-4">
              Experience the complete platform - Create orders, process payments, and manage your group orders!
            </p>
            <div className="flex justify-center space-x-4">
              <button 
                onClick={() => setDemoState(prev => ({...prev, view: 'dashboard'}))}
                className="bg-white text-orange-600 px-6 py-2 rounded-lg font-semibold hover:bg-orange-50"
              >
                View Dashboard
              </button>
              <button 
                onClick={() => setDemoState(prev => ({...prev, view: 'orders'}))}
                className="bg-white text-purple-600 px-6 py-2 rounded-lg font-semibold hover:bg-purple-50"
              >
                Browse Orders
              </button>
              <button 
                onClick={() => setDemoState(prev => ({...prev, view: 'create'}))}
                className="bg-orange-200 text-orange-800 px-6 py-2 rounded-lg font-semibold hover:bg-orange-300"
              >
                Create Order
              </button>
            </div>
          </div>
        </div>

        {/* Demo Features Grid */}
        <div className="max-w-6xl mx-auto p-8">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-200">
              <div className="text-3xl mb-4">🤖</div>
              <h3 className="font-bold text-lg mb-2">AI Payment Processing</h3>
              <p className="text-gray-600 mb-4">Upload payment screenshots and watch our AI automatically extract amounts, detect payment methods, and update orders.</p>
              <button 
                onClick={simulatePaymentProcessing}
                disabled={paymentProcessing}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {paymentProcessing ? (
                  <span className="flex items-center justify-center">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                    Processing...
                  </span>
                ) : (
                  'Demo AI Processing'
                )}
              </button>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg border border-green-200">
              <div className="text-3xl mb-4">📊</div>
              <h3 className="font-bold text-lg mb-2">Real-time Dashboard</h3>
              <p className="text-gray-600 mb-4">Track your orders, revenue, and performance with live analytics and beautiful charts.</p>
              <button 
                onClick={() => setDemoState(prev => ({...prev, view: 'dashboard'}))}
                className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              >
                View Dashboard
              </button>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg border border-purple-200">
              <div className="text-3xl mb-4">⚡</div>
              <h3 className="font-bold text-lg mb-2">Order Management</h3>
              <p className="text-gray-600 mb-4">Create orders in minutes, track submissions, and manage your entire group order workflow.</p>
              <button 
                onClick={createDemoOrder}
                className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
              >
                Create Demo Order
              </button>
            </div>
          </div>

          {/* Current Stats Preview */}
          <div className="mt-8 bg-gray-50 rounded-lg p-6">
            <h3 className="font-bold text-xl mb-4 text-center">Live Demo Statistics</h3>
            <div className="grid md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{demoState.stats.totalOrders}</div>
                <div className="text-sm text-gray-600">Total Orders</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">₱{demoState.stats.totalRevenue.toLocaleString()}</div>
                <div className="text-sm text-gray-600">Revenue</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{demoState.stats.activeOrders}</div>
                <div className="text-sm text-gray-600">Active Orders</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{demoState.stats.successRate}%</div>
                <div className="text-sm text-gray-600">Success Rate</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (demoState.view === 'dashboard') {
    return (
      <div className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto">
        {/* Header */}
        <div className="bg-white shadow-sm border-b p-4">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold">GOMFLOW Dashboard</h1>
              <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-sm">Demo Mode</span>
            </div>
            <button 
              onClick={() => setDemoState(prev => ({...prev, view: 'landing'}))}
              className="text-gray-600 hover:text-gray-800"
            >
              ← Back to Landing
            </button>
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="max-w-6xl mx-auto p-6 space-y-6">
          {/* Stats Cards */}
          <div className="grid md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-600">Total Orders</p>
                  <p className="text-2xl font-bold">{demoState.stats.totalOrders}</p>
                </div>
                <div className="text-orange-500">📦</div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-600">Revenue</p>
                  <p className="text-2xl font-bold">₱{demoState.stats.totalRevenue.toLocaleString()}</p>
                </div>
                <div className="text-green-500">💰</div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-600">Active Orders</p>
                  <p className="text-2xl font-bold">{demoState.stats.activeOrders}</p>
                </div>
                <div className="text-blue-500">⚡</div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-600">Success Rate</p>
                  <p className="text-2xl font-bold">{demoState.stats.successRate}%</p>
                </div>
                <div className="text-purple-500">✅</div>
              </div>
            </div>
          </div>

          {/* Recent Orders */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold">Recent Orders</h2>
            </div>
            <div className="p-6 space-y-4">
              {demoState.orders.slice(0, 3).map((order) => (
                <div key={order.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <h3 className="font-semibold">{order.title}</h3>
                    <p className="text-sm text-gray-600">
                      {order.currency} {order.price} • {order.current}/{order.target} orders • {order.timeLeft}
                    </p>
                  </div>
                  <div className="ml-4 text-right">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-orange-500 h-2 rounded-full" 
                        style={{width: `${order.progress}%`}}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-500">{order.progress}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Demo Section */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2">🤖 AI Payment Processing</h3>
            <p className="text-blue-100 mb-4">Upload a payment screenshot and watch our AI work its magic!</p>
            <button 
              onClick={simulatePaymentProcessing}
              disabled={paymentProcessing}
              className="bg-white text-blue-600 px-6 py-2 rounded-lg font-semibold hover:bg-blue-50 disabled:opacity-50"
            >
              {paymentProcessing ? 'Processing Payment...' : 'Demo AI Processing'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Similar views for 'orders' and 'create' would go here
  // For brevity, I'll just show a placeholder
  return (
    <div className="fixed inset-0 z-50 bg-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">GOMFLOW {demoState.view.toUpperCase()}</h1>
          <button 
            onClick={() => setDemoState(prev => ({...prev, view: 'landing'}))}
            className="text-gray-600 hover:text-gray-800"
          >
            ← Back to Landing
          </button>
        </div>
        
        <div className="text-center py-20">
          <h2 className="text-2xl font-semibold mb-4">🚧 {demoState.view.charAt(0).toUpperCase() + demoState.view.slice(1)} View</h2>
          <p className="text-gray-600 mb-8">This section is part of the interactive demo experience.</p>
          
          <div className="space-x-4">
            <button 
              onClick={() => setDemoState(prev => ({...prev, view: 'dashboard'}))}
              className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600"
            >
              View Dashboard
            </button>
            <button 
              onClick={createDemoOrder}
              className="bg-purple-500 text-white px-6 py-2 rounded-lg hover:bg-purple-600"
            >
              Create Demo Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
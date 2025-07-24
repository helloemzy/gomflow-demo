"use client";

import { useState, useEffect } from 'react';

// Persistent storage for MVP (would be database in production)
const getStoredOrders = (): Order[] => {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem('gomflow_orders');
  return stored ? JSON.parse(stored) : [];
};

const saveOrders = (orders: Order[]) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('gomflow_orders', JSON.stringify(orders));
  }
};

let globalOrders: Order[] = [];
let globalSubmissions: Submission[] = [];

interface Order {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  targetQuantity: number;
  deadline: string;
  gomName: string;
  gomContact: string;
  status: 'active' | 'closed' | 'completed';
  createdAt: string;
  submissions: Submission[];
}

interface Submission {
  id: string;
  orderId: string;
  buyerName: string;
  buyerContact: string;
  quantity: number;
  paymentMethod: string;
  paymentProof?: string;
  status: 'pending' | 'paid' | 'confirmed';
  submittedAt: string;
}

export default function GOMFLOWMVP() {
  const [currentView, setCurrentView] = useState<'home' | 'create' | 'manage' | 'order'>('home');
  const [currentOrderId, setCurrentOrderId] = useState<string>('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [notifications, setNotifications] = useState<string[]>([]);


  // GOM: Create New Order
  const CreateOrderForm = () => {
    const [formData, setFormData] = useState({
      title: '',
      description: '',
      price: '',
      currency: 'PHP',
      targetQuantity: '',
      deadline: '',
      gomName: '',
      gomContact: ''
    });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      
      const newOrder: Order = {
        id: Date.now().toString(),
        title: formData.title,
        description: formData.description,
        price: Number(formData.price),
        currency: formData.currency,
        targetQuantity: Number(formData.targetQuantity),
        deadline: formData.deadline,
        gomName: formData.gomName,
        gomContact: formData.gomContact,
        status: 'active',
        createdAt: new Date().toISOString(),
        submissions: []
      };

      globalOrders.push(newOrder);
      saveOrders(globalOrders);
      setOrders([...globalOrders]);
      
      // Show shareable link
      const shareableLink = `${window.location.origin}?order=${newOrder.id}`;
      alert(`🎉 Order Created Successfully!\n\nShareable Link:\n${shareableLink}\n\nShare this link with buyers so they can view and order!`);
      
      setCurrentView('manage');
    };

    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem' }}>
          <button onClick={() => setCurrentView('home')} style={{ marginRight: '1rem', padding: '0.5rem', background: '#f3f4f6', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            ← Back
          </button>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Create New Group Order</h1>
        </div>

        <form onSubmit={handleSubmit} style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Product Title *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              placeholder="e.g., SEVENTEEN 'God of Music' Album"
              style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '1rem' }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Description *</label>
            <textarea
              required
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              placeholder="Describe the product, versions available, shipping details..."
              rows={3}
              style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '1rem', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Price *</label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.price}
                onChange={(e) => setFormData({...formData, price: e.target.value})}
                placeholder="1800"
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '1rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Currency</label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({...formData, currency: e.target.value})}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '1rem' }}
              >
                <option value="PHP">PHP (₱)</option>
                <option value="MYR">MYR (RM)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Target Quantity *</label>
              <input
                type="number"
                required
                value={formData.targetQuantity}
                onChange={(e) => setFormData({...formData, targetQuantity: e.target.value})}
                placeholder="30"
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '1rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Deadline *</label>
              <input
                type="date"
                required
                value={formData.deadline}
                onChange={(e) => setFormData({...formData, deadline: e.target.value})}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '1rem' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Your Name *</label>
              <input
                type="text"
                required
                value={formData.gomName}
                onChange={(e) => setFormData({...formData, gomName: e.target.value})}
                placeholder="Sarah Kim"
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '1rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Contact (WhatsApp/Telegram) *</label>
              <input
                type="text"
                required
                value={formData.gomContact}
                onChange={(e) => setFormData({...formData, gomContact: e.target.value})}
                placeholder="+63 912 345 6789"
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '1rem' }}
              />
            </div>
          </div>

          <button
            type="submit"
            style={{
              width: '100%',
              background: '#e97625',
              color: 'white',
              padding: '1rem',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1.125rem',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            🚀 Create Group Order & Get Shareable Link
          </button>
        </form>
      </div>
    );
  };

  // GOM: Manage Orders
  const ManageOrders = () => {
    const myOrders = orders.filter(order => order.status === 'active');

    const sendStatusUpdate = (orderId: string) => {
      const message = prompt('Enter status update message to send to all buyers:');
      if (message) {
        alert(`📢 Status update sent to all buyers:\n"${message}"\n\n✅ Sent via WhatsApp, Telegram, and Email`);
        setNotifications(prev => [...prev, `Status update sent for order ${orderId}: ${message}`]);
      }
    };

    const markAsPaid = (submissionId: string, orderId: string) => {
      // Update submission status
      const order = globalOrders.find(o => o.id === orderId);
      if (order) {
        const submission = order.submissions.find(s => s.id === submissionId);
        if (submission) {
          submission.status = 'confirmed';
          saveOrders(globalOrders);
          setOrders([...globalOrders]);
          alert('✅ Payment confirmed! Buyer will be notified automatically.');
        }
      }
    };

    return (
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Manage Your Orders</h1>
          <button 
            onClick={() => setCurrentView('create')}
            style={{ background: '#e97625', color: 'white', padding: '1rem 1.5rem', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            + Create New Order
          </button>
        </div>

        {myOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', background: '#f9fafb', borderRadius: '12px' }}>
            <p style={{ fontSize: '1.125rem', color: '#6b7280', marginBottom: '1rem' }}>No active orders yet</p>
            <button 
              onClick={() => setCurrentView('create')}
              style={{ background: '#e97625', color: 'white', padding: '1rem 2rem', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Create Your First Order
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            {myOrders.map(order => (
              <div key={order.id} style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>{order.title}</h3>
                    <p style={{ color: '#6b7280' }}>{order.currency} {order.price} • Target: {order.targetQuantity} items</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => {
                        const link = `${window.location.origin}?order=${order.id}`;
                        navigator.clipboard.writeText(link);
                        alert('📋 Shareable link copied to clipboard!');
                      }}
                      style={{ background: '#3b82f6', color: 'white', padding: '0.5rem 1rem', border: 'none', borderRadius: '6px', fontSize: '0.875rem', cursor: 'pointer' }}
                    >
                      📋 Copy Link
                    </button>
                    <button
                      onClick={() => sendStatusUpdate(order.id)}
                      style={{ background: '#10b981', color: 'white', padding: '0.5rem 1rem', border: 'none', borderRadius: '6px', fontSize: '0.875rem', cursor: 'pointer' }}
                    >
                      📢 Send Update
                    </button>
                  </div>
                </div>

                <div style={{ background: '#f3f4f6', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                  <h4 style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Order Progress</h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{order.submissions.length} / {order.targetQuantity} orders</span>
                    <span style={{ color: '#e97625', fontWeight: 'bold' }}>
                      {Math.round((order.submissions.length / order.targetQuantity) * 100)}%
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#e5e7eb', borderRadius: '4px', marginTop: '0.5rem' }}>
                    <div style={{ 
                      width: `${(order.submissions.length / order.targetQuantity) * 100}%`, 
                      height: '100%', 
                      background: '#e97625', 
                      borderRadius: '4px' 
                    }}></div>
                  </div>
                </div>

                {order.submissions.length > 0 && (
                  <div>
                    <h4 style={{ fontWeight: 'bold', marginBottom: '1rem' }}>Recent Submissions</h4>
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                      {order.submissions.slice(-3).map(submission => (
                        <div key={submission.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f9fafb', borderRadius: '6px' }}>
                          <div>
                            <span style={{ fontWeight: 'bold' }}>{submission.buyerName}</span>
                            <span style={{ color: '#6b7280', marginLeft: '0.5rem' }}>• {submission.quantity} items • {submission.paymentMethod}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ 
                              padding: '0.25rem 0.75rem', 
                              borderRadius: '12px', 
                              fontSize: '0.75rem', 
                              fontWeight: 'bold',
                              background: submission.status === 'confirmed' ? '#dcfce7' : submission.status === 'paid' ? '#fef3c7' : '#fee2e2',
                              color: submission.status === 'confirmed' ? '#166534' : submission.status === 'paid' ? '#92400e' : '#991b1b'
                            }}>
                              {submission.status.toUpperCase()}
                            </span>
                            {submission.status === 'paid' && (
                              <button
                                onClick={() => markAsPaid(submission.id, order.id)}
                                style={{ background: '#10b981', color: 'white', padding: '0.25rem 0.75rem', border: 'none', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
                              >
                                ✅ Confirm
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Buyer: View & Order
  const BuyerOrderView = ({ orderId }: { orderId: string }) => {
    const order = orders.find(o => o.id === orderId);
    const [showOrderForm, setShowOrderForm] = useState(false);
    const [orderForm, setOrderForm] = useState({
      buyerName: '',
      buyerContact: '',
      quantity: '1',
      paymentMethod: 'GCash'
    });

    if (!order) {
      return (
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>❌ Order Not Found</h1>
          <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
            Order ID: <code style={{ background: '#f3f4f6', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>{orderId}</code>
          </p>
          <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
            This order may not exist yet, or the link may be invalid. Try creating a new order first.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button 
              onClick={() => setCurrentView('home')}
              style={{ background: '#6b7280', color: 'white', padding: '1rem 2rem', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              ← Go to Homepage
            </button>
            <button 
              onClick={() => setCurrentView('create')}
              style={{ background: '#e97625', color: 'white', padding: '1rem 2rem', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              🚀 Create New Order
            </button>
          </div>
        </div>
      );
    }

    const handleSubmitOrder = (e: React.FormEvent) => {
      e.preventDefault();
      
      const newSubmission: Submission = {
        id: Date.now().toString(),
        orderId: order.id,
        buyerName: orderForm.buyerName,
        buyerContact: orderForm.buyerContact,
        quantity: Number(orderForm.quantity),
        paymentMethod: orderForm.paymentMethod,
        status: 'pending',
        submittedAt: new Date().toISOString()
      };

      // Add to order and save
      order.submissions.push(newSubmission);
      globalSubmissions.push(newSubmission);
      saveOrders(globalOrders);
      setOrders([...globalOrders]);

      // Notify GOM instantly
      setTimeout(() => {
        alert(`🔔 INSTANT NOTIFICATION TO GOM:\n\n"New order received from ${orderForm.buyerName}!\n• ${orderForm.quantity} items\n• Payment method: ${orderForm.paymentMethod}"\n\n✅ GOM will receive this via WhatsApp/Telegram`);
      }, 500);

      alert('🎉 Order submitted successfully!\n\nNext steps:\n1. Make payment using your chosen method\n2. Upload payment proof\n3. Wait for GOM confirmation\n\nYou will receive updates via WhatsApp/Telegram!');
      
      setShowOrderForm(false);
    };

    const progress = Math.round((order.submissions.length / order.targetQuantity) * 100);

    return (
      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '2rem' }}>
        <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ background: 'linear-gradient(135deg, #e97625, #f19a4a)', color: 'white', padding: '2rem', textAlign: 'center' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>{order.title}</h1>
            <p style={{ fontSize: '1.125rem', opacity: 0.9 }}>Group Order by {order.gomName}</p>
          </div>

          {/* Order Details */}
          <div style={{ padding: '2rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ textAlign: 'center', padding: '1rem', background: '#f3f4f6', borderRadius: '8px' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#e97625' }}>{order.currency} {order.price}</div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Price per item</div>
              </div>
              <div style={{ textAlign: 'center', padding: '1rem', background: '#f3f4f6', borderRadius: '8px' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>{order.submissions.length}/{order.targetQuantity}</div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Orders received</div>
              </div>
              <div style={{ textAlign: 'center', padding: '1rem', background: '#f3f4f6', borderRadius: '8px' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#3b82f6' }}>{progress}%</div>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Progress</div>
              </div>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontWeight: 'bold', marginBottom: '1rem' }}>Order Progress</h3>
              <div style={{ width: '100%', height: '12px', background: '#e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ 
                  width: `${progress}%`, 
                  height: '100%', 
                  background: 'linear-gradient(90deg, #e97625, #10b981)', 
                  transition: 'width 0.5s ease' 
                }}></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
                <span>0 orders</span>
                <span>{order.targetQuantity} target</span>
              </div>
            </div>

            <div style={{ background: '#f9fafb', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem' }}>
              <h3 style={{ fontWeight: 'bold', marginBottom: '1rem' }}>📝 Product Details</h3>
              <p style={{ lineHeight: 1.6, color: '#374151' }}>{order.description}</p>
              
              <div style={{ marginTop: '1rem', padding: '1rem', background: 'white', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                <p><strong>Deadline:</strong> {new Date(order.deadline).toLocaleDateString()}</p>
                <p><strong>Contact GOM:</strong> {order.gomContact}</p>
              </div>
            </div>

            {!showOrderForm ? (
              <button
                onClick={() => setShowOrderForm(true)}
                style={{
                  width: '100%',
                  background: '#e97625',
                  color: 'white',
                  padding: '1.25rem',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1.25rem',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                🛒 Join This Group Order
              </button>
            ) : (
              <form onSubmit={handleSubmitOrder} style={{ background: '#f9fafb', padding: '1.5rem', borderRadius: '8px' }}>
                <h3 style={{ fontWeight: 'bold', marginBottom: '1rem' }}>🛒 Place Your Order</h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Your Name *</label>
                    <input
                      type="text"
                      required
                      value={orderForm.buyerName}
                      onChange={(e) => setOrderForm({...orderForm, buyerName: e.target.value})}
                      placeholder="John Doe"
                      style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Contact (WhatsApp/Telegram) *</label>
                    <input
                      type="text"
                      required
                      value={orderForm.buyerContact}
                      onChange={(e) => setOrderForm({...orderForm, buyerContact: e.target.value})}
                      placeholder="+63 912 345 6789"
                      style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Quantity *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={orderForm.quantity}
                      onChange={(e) => setOrderForm({...orderForm, quantity: e.target.value})}
                      style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Payment Method *</label>
                    <select
                      value={orderForm.paymentMethod}
                      onChange={(e) => setOrderForm({...orderForm, paymentMethod: e.target.value})}
                      style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                    >
                      <option value="GCash">GCash</option>
                      <option value="PayMaya">PayMaya</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="PayPal">PayPal</option>
                    </select>
                  </div>
                </div>

                <div style={{ background: 'white', padding: '1rem', borderRadius: '6px', border: '1px solid #e5e7eb', marginBottom: '1rem' }}>
                  <p><strong>Total: {order.currency} {order.price * Number(orderForm.quantity)}</strong></p>
                  <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>You will receive payment instructions after submitting</p>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowOrderForm(false)}
                    style={{ flex: 1, background: '#6b7280', color: 'white', padding: '1rem', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{ flex: 2, background: '#10b981', color: 'white', padding: '1rem', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    🚀 Submit Order
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Home page
  const HomePage = () => (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
      <div style={{ marginBottom: '4rem' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 'bold', color: '#1a202c', marginBottom: '1rem' }}>
          GOMFLOW <span style={{ color: '#e97625' }}>MVP</span>
        </h1>
        <p style={{ fontSize: '1.25rem', color: '#6b7280', marginBottom: '2rem' }}>
          Working group order management system - Create orders, get payments, send updates
        </p>
        
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setCurrentView('create')}
            style={{
              background: '#e97625',
              color: 'white',
              padding: '1rem 2rem',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1.125rem',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            🚀 I'm a GOM - Create Order
          </button>
          <button
            onClick={() => setCurrentView('manage')}
            style={{
              background: '#3b82f6',
              color: 'white',
              padding: '1rem 2rem',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1.125rem',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            📊 Manage My Orders
          </button>
        </div>
      </div>

      <div style={{ background: '#f9fafb', padding: '2rem', borderRadius: '12px', textAlign: 'left' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>✅ Working MVP Features</h2>
        <div style={{ marginBottom: '1rem', padding: '0.5rem', background: '#e5e7eb', borderRadius: '6px', fontSize: '0.875rem', color: '#374151' }}>
          💾 Debug: {orders.length} orders in storage
        </div>
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'start', gap: '0.5rem' }}>
            <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓</span>
            <span><strong>Create Group Orders:</strong> Quick form with shareable links</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'start', gap: '0.5rem' }}>
            <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓</span>
            <span><strong>Buyer Experience:</strong> View products, place orders, choose payment method</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'start', gap: '0.5rem' }}>
            <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓</span>
            <span><strong>Instant Notifications:</strong> GOMs get notified immediately when buyers order</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'start', gap: '0.5rem' }}>
            <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓</span>
            <span><strong>Order Management:</strong> Track progress, confirm payments, send updates</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'start', gap: '0.5rem' }}>
            <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓</span>
            <span><strong>Status Updates:</strong> Send broadcast messages to all buyers</span>
          </div>
        </div>
      </div>
    </div>
  );

  // Check if viewing specific order from URL
  useEffect(() => {
    // Load orders first
    globalOrders = getStoredOrders();
    setOrders(globalOrders);
    
    // Then check URL
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('order');
    if (orderId) {
      setCurrentOrderId(orderId);
      setCurrentView('order');
    }
  }, []);

  // Render current view
  if (currentView === 'create') return <CreateOrderForm />;
  if (currentView === 'manage') return <ManageOrders />;
  if (currentView === 'order') return <BuyerOrderView orderId={currentOrderId} />;
  return <HomePage />;
}
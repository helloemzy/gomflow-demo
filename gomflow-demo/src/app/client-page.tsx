"use client";

import { useState, useEffect } from 'react';
import GOMFLOWMVP from './mvp';

// Simple client-only interactive demo
function SimpleInteractiveDemo({ onBack }: { onBack: () => void }) {
  const [currentView, setCurrentView] = useState('landing');
  const [processing, setProcessing] = useState(false);

  const simulateAI = () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      alert('🤖 AI Processing Complete!\n\n✅ Payment Verified:\n• GCash payment of ₱1,800\n• SEVENTEEN album order\n• 96% confidence score\n• Auto-approved & updated');
    }, 2500);
  };

  const createOrder = () => {
    alert('🎉 Demo Order Created!\n\n✨ Features Activated:\n• Real-time payment tracking\n• Multi-platform notifications\n• Automated reminders\n• AI payment processing');
  };

  if (currentView === 'dashboard') {
    return (
      <div style={{ 
        position: 'fixed', 
        inset: 0, 
        zIndex: 50, 
        background: '#f8fafc', 
        padding: '2rem',
        overflow: 'auto'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ 
            background: 'white', 
            padding: '1.5rem', 
            borderRadius: '12px', 
            marginBottom: '2rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>GOMFLOW Dashboard</h1>
              <button 
                onClick={onBack}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#e5e7eb',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                ← Back to Landing
              </button>
            </div>
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
            gap: '1.5rem',
            marginBottom: '2rem'
          }}>
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#e97625' }}>147</div>
              <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>Total Orders</div>
            </div>
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>₱285,600</div>
              <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>Revenue</div>
            </div>
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3b82f6' }}>8</div>
              <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>Active Orders</div>
            </div>
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#8b5cf6' }}>94.2%</div>
              <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>Success Rate</div>
            </div>
          </div>

          <div style={{ 
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', 
            color: 'white', 
            padding: '2rem', 
            borderRadius: '12px',
            textAlign: 'center'
          }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>🤖 AI Payment Processing</h3>
            <p style={{ marginBottom: '1.5rem', opacity: 0.9 }}>
              Upload payment screenshots and watch our AI automatically verify and process them!
            </p>
            <button
              onClick={simulateAI}
              disabled={processing}
              style={{
                background: 'white',
                color: '#3b82f6',
                padding: '1rem 2rem',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: processing ? 'not-allowed' : 'pointer',
                opacity: processing ? 0.7 : 1
              }}
            >
              {processing ? '🔄 Processing...' : '🎭 Demo AI Processing'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      position: 'fixed', 
      inset: 0, 
      zIndex: 50, 
      background: 'white',
      padding: '2rem',
      overflow: 'auto'
    }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ 
          background: 'linear-gradient(135deg, #e97625, #8b5cf6)', 
          color: 'white', 
          padding: '2rem', 
          borderRadius: '12px',
          textAlign: 'center',
          marginBottom: '2rem'
        }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            🎭 GOMFLOW Interactive Demo
          </h2>
          <p style={{ fontSize: '1.125rem', marginBottom: '1.5rem', opacity: 0.9 }}>
            Experience the complete platform - Create orders, process payments, and manage your group orders!
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <button 
              onClick={() => setCurrentView('dashboard')}
              style={{
                background: 'white',
                color: '#e97625',
                padding: '0.75rem 1.5rem',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              📊 View Dashboard
            </button>
            <button 
              onClick={createOrder}
              style={{
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                padding: '0.75rem 1.5rem',
                border: '2px solid rgba(255,255,255,0.5)',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              ⚡ Create Demo Order
            </button>
            <button 
              onClick={onBack}
              style={{
                background: 'transparent',
                color: 'white',
                padding: '0.75rem 1.5rem',
                border: '2px solid rgba(255,255,255,0.5)',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              ← Back to Landing
            </button>
          </div>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '1.5rem'
        }}>
          <div style={{ 
            background: 'linear-gradient(135deg, #dbeafe, #bfdbfe)', 
            padding: '1.5rem', 
            borderRadius: '12px',
            border: '1px solid #93c5fd'
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🤖</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>AI Payment Processing</h3>
            <p style={{ color: '#374151', marginBottom: '1rem' }}>
              Upload payment screenshots and watch our AI automatically extract amounts, detect payment methods, and update orders.
            </p>
            <button 
              onClick={simulateAI}
              disabled={processing}
              style={{
                width: '100%',
                background: '#3b82f6',
                color: 'white',
                padding: '0.75rem',
                border: 'none',
                borderRadius: '8px',
                cursor: processing ? 'not-allowed' : 'pointer',
                opacity: processing ? 0.7 : 1
              }}
            >
              {processing ? '🔄 Processing...' : '🎭 Demo AI Processing'}
            </button>
          </div>

          <div style={{ 
            background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)', 
            padding: '1.5rem', 
            borderRadius: '12px',
            border: '1px solid #86efac'
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📊</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Real-time Dashboard</h3>
            <p style={{ color: '#374151', marginBottom: '1rem' }}>
              Track your orders, revenue, and performance with live analytics and beautiful charts.
            </p>
            <button 
              onClick={() => setCurrentView('dashboard')}
              style={{
                width: '100%',
                background: '#10b981',
                color: 'white',
                padding: '0.75rem',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              📊 View Dashboard
            </button>
          </div>

          <div style={{ 
            background: 'linear-gradient(135deg, #f3e8ff, #e9d5ff)', 
            padding: '1.5rem', 
            borderRadius: '12px',
            border: '1px solid #c4b5fd'
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚡</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Order Management</h3>
            <p style={{ color: '#374151', marginBottom: '1rem' }}>
              Create orders in minutes, track submissions, and manage your entire group order workflow.
            </p>
            <button 
              onClick={createOrder}
              style={{
                width: '100%',
                background: '#8b5cf6',
                color: 'white',
                padding: '0.75rem',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              ⚡ Create Demo Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ClientPage() {
  const [mounted, setMounted] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Safe DOM animations only after mount
    const animateStats = () => {
      const statNumbers = document.querySelectorAll('.stat-number');
      statNumbers.forEach(stat => {
        const target = stat as HTMLElement;
        const finalValue = target.dataset.value || target.textContent || '';
        const numericValue = parseFloat(finalValue.replace(/[,%]/g, ''));
        
        let current = 0;
        const increment = numericValue / 50;
        const timer = setInterval(() => {
          current += increment;
          if (current >= numericValue) {
            target.textContent = finalValue;
            clearInterval(timer);
          } else {
            if (finalValue.includes('%')) {
              target.textContent = current.toFixed(1) + '%';
            } else {
              target.textContent = Math.floor(current).toLocaleString();
            }
          }
        }, 30);
      });
    };

    // Run animations after a short delay
    setTimeout(animateStats, 500);
  }, []);

  if (!mounted) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f8fafc'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #e5e7eb',
            borderTop: '3px solid #e97625',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }}></div>
          <p style={{ color: '#6b7280' }}>Loading GOMFLOW...</p>
        </div>
        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `
        }} />
      </div>
    );
  }

  if (showDemo) {
    return <GOMFLOWMVP />;
  }

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', minHeight: '100vh' }}>
      {/* Hero Section */}
      <section style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '4rem 2rem',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: window.innerWidth > 768 ? '1fr 1fr' : '1fr',
          gap: '4rem',
          alignItems: 'center',
          width: '100%'
        }}>
          <div>
            <h1 style={{
              fontSize: window.innerWidth > 768 ? '4rem' : '2.5rem',
              fontWeight: 800,
              color: '#1a202c',
              lineHeight: '1.1',
              marginBottom: '1.5rem'
            }}>
              AUTOMATING THE MANUAL CHAOS OF{' '}
              <span style={{ color: '#e97625' }}>
                GROUP ORDER PURCHASING
              </span>
            </h1>
            
            <p style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: '#e97625',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '2rem'
            }}>
              From 20 hours of spreadsheet hell to 10 minutes of simplicity
            </p>
            
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              alignItems: 'flex-start',
              marginBottom: '2rem'
            }}>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <button 
                  onClick={() => setShowDemo(true)}
                  style={{
                    background: '#e97625',
                    color: 'white',
                    padding: '1rem 2rem',
                    border: 'none',
                    borderRadius: '50px',
                    fontSize: '1.125rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(233, 118, 37, 0.3)'
                  }}
                >
                  🚀 Try Working MVP
                </button>
                
                <button style={{
                  background: 'transparent',
                  color: '#e97625',
                  padding: '1rem 2rem',
                  border: '2px solid #e97625',
                  borderRadius: '50px',
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}>
                  Get Early Access →
                </button>
              </div>
              
              <div style={{
                background: '#f7fafc',
                padding: '0.5rem 1rem',
                borderRadius: '20px',
                fontSize: '0.875rem',
                color: '#718096'
              }}>
                Q1 2026 Launch • Starting in Philippines • 50+ GOMs Testing
              </div>
            </div>
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '300px',
              height: '300px',
              background: 'linear-gradient(135deg, #e97625, #f19a4a)',
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '4rem',
              margin: '0 auto',
              position: 'relative',
              animation: 'float 4s ease-in-out infinite'
            }}>
              🧸
              <div style={{
                position: 'absolute',
                top: '-10px',
                right: '-10px',
                background: '#ef4444',
                color: 'white',
                padding: '0.25rem 0.75rem',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase'
              }}>
                HOT
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section style={{
        background: '#f7fafc',
        padding: '4rem 2rem'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '2rem'
        }}>
          {[
            { number: "12,847", label: "Orders Processed Today" },
            { number: "2,570", label: "Hours Saved This Month" },
            { number: "98.5%", label: "Success Rate" }
          ].map((stat, index) => (
            <div key={index} style={{
              background: 'white',
              padding: '2rem',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              border: '1px solid #e2e8f0',
              textAlign: 'center'
            }}>
              <div 
                className="stat-number" 
                data-value={stat.number}
                style={{
                  fontSize: '3rem',
                  fontWeight: 800,
                  color: '#e97625',
                  marginBottom: '0.5rem'
                }}
              >
                {stat.number}
              </div>
              <div style={{
                fontSize: '0.875rem',
                textTransform: 'uppercase',
                color: '#718096',
                letterSpacing: '0.5px',
                fontWeight: 600
              }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section style={{
        background: '#e97625',
        color: 'white',
        padding: '4rem 2rem',
        textAlign: 'center'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          <h2 style={{
            fontSize: '2.5rem',
            fontWeight: 800,
            marginBottom: '1rem'
          }}>
            Ready to Join the Revolution?
          </h2>
          
          <p style={{
            fontSize: '1.125rem',
            opacity: 0.9,
            marginBottom: '2rem',
            maxWidth: '600px',
            margin: '0 auto 2rem'
          }}>
            Be among the first GOMs to transform your group order chaos into automated success
          </p>
          
          <button
            onClick={() => setShowDemo(true)}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              padding: '1rem 2.5rem',
              border: '2px solid rgba(255, 255, 255, 0.5)',
              borderRadius: '50px',
              fontSize: '1.25rem',
              fontWeight: 700,
              cursor: 'pointer',
              marginBottom: '2rem'
            }}
          >
            🚀 Try Working MVP Now
          </button>
        </div>
      </section>

      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `
      }} />
    </div>
  );
}
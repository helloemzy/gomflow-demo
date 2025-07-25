"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function Home() {
  const [showDemo, setShowDemo] = useState(false);

  if (showDemo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <Button 
              onClick={() => setShowDemo(false)}
              className="mb-4"
              variant="outline"
            >
              ← Back to Landing
            </Button>
            <h1 className="text-4xl font-bold mb-4">GOMFLOW Demo Dashboard</h1>
            <p className="text-gray-600">This is a simplified demo of the GOMFLOW platform</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="text-3xl font-bold text-orange-600 mb-2">147</div>
              <div className="text-gray-600">Total Orders</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="text-3xl font-bold text-green-600 mb-2">₱285,600</div>
              <div className="text-gray-600">Revenue</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="text-3xl font-bold text-blue-600 mb-2">8</div>
              <div className="text-gray-600">Active Orders</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="text-3xl font-bold text-purple-600 mb-2">94.2%</div>
              <div className="text-gray-600">Success Rate</div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-8 rounded-lg text-center">
            <h3 className="text-2xl font-bold mb-4">🤖 AI Payment Processing</h3>
            <p className="mb-6 opacity-90">
              Upload payment screenshots and watch our AI automatically verify and process them!
            </p>
            <Button 
              className="bg-white text-purple-600 hover:bg-gray-100"
              onClick={() => alert('🤖 AI Processing Complete!\\n\\n✅ Payment Verified:\\n• GCash payment of ₱1,800\\n• SEVENTEEN album order\\n• 96% confidence score\\n• Auto-approved & updated')}
            >
              Try AI Demo
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-sm border-b border-purple-100 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">G</span>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  GOMFLOW
                </h1>
                <p className="text-xs text-gray-500">For K-pop Group Orders</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                onClick={() => window.location.href = '/pricing'}
                className="text-purple-600 hover:text-purple-700"
              >
                Pricing
              </Button>
              <Button 
                onClick={() => setShowDemo(true)}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                Try Demo
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 lg:py-24">
        <div className="text-center">
          <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Stop Drowning in 
            <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              {" "}Payment Screenshots
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            The group order platform that actually gets it. 
            Built by GOMs, for GOMs who are tired of spreadsheet hell.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              className="text-lg px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              onClick={() => setShowDemo(true)}
            >
              See It In Action
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="text-lg px-8 py-4 border-purple-300 text-purple-600 hover:bg-purple-50"
              onClick={() => window.location.href = '/pricing'}
            >
              View Pricing Plans
            </Button>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            ✨ Free tier available • 14-day trial • Plans from $12/month
          </p>
        </div>
      </section>

      {/* Problem Section */}
      <section className="bg-white/80 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              We Know Exactly How This Feels...
            </h2>
            <p className="text-xl text-gray-600">
              Every comeback season, the same chaos repeats
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center p-6 bg-white rounded-lg shadow-md">
              <div className="text-6xl mb-4">😵‍💫</div>
              <h3 className="text-lg font-semibold mb-2">It&apos;s Friday night, SEVENTEEN drops a new album...</h3>
              <p className="text-gray-600">Within minutes, your DMs explode with &quot;Can I join the GO?&quot; messages</p>
            </div>
            <div className="text-center p-6 bg-white rounded-lg shadow-md">
              <div className="text-6xl mb-4">📱💸</div>
              <h3 className="text-lg font-semibold mb-2">200 payment screenshots flood your phone...</h3>
              <p className="text-gray-600">GCash, PayMaya, bank transfers - all mixed together with no names attached</p>
            </div>
            <div className="text-center p-6 bg-white rounded-lg shadow-md">
              <div className="text-6xl mb-4">😴🔢</div>
              <h3 className="text-lg font-semibold mb-2">There goes your entire weekend...</h3>
              <p className="text-gray-600">Manually matching payments to names while fans ask &quot;Did you get mine?&quot; every 10 minutes</p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              What if group orders could be 
              <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                {" "}this simple?
              </span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Stop fighting with spreadsheets. Start focusing on what matters - building your community and getting fans their favorite merch.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            <div className="p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-purple-600 text-2xl">⚡</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Create orders in 2 minutes</h3>
              <p className="text-gray-600 mb-4">Album templates, automatic pricing, instant form generation</p>
              <Button variant="ghost" className="text-purple-600 hover:text-purple-700 p-0 h-auto" onClick={() => setShowDemo(true)}>
                Try creating a SEVENTEEN album order →
              </Button>
            </div>
            <div className="p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-purple-600 text-2xl">✅</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Payments track themselves</h3>
              <p className="text-gray-600 mb-4">AI matches payments to buyers automatically - no more screenshots chaos</p>
              <Button variant="ghost" className="text-purple-600 hover:text-purple-700 p-0 h-auto" onClick={() => setShowDemo(true)}>
                Upload any image to test →
              </Button>
            </div>
            <div className="p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-purple-600 text-2xl">💬</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Buyers get instant updates</h3>
              <p className="text-gray-600 mb-4">WhatsApp, Telegram, Discord bots keep everyone informed</p>
              <Button variant="ghost" className="text-purple-600 hover:text-purple-700 p-0 h-auto" onClick={() => setShowDemo(true)}>
                See bot responses →
              </Button>
            </div>
            <div className="p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-purple-600 text-2xl">🕒</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Get your weekends back</h3>
              <p className="text-gray-600 mb-4">From 20 hours of manual work to 10 minutes of oversight</p>
              <Button variant="ghost" className="text-purple-600 hover:text-purple-700 p-0 h-auto" onClick={() => setShowDemo(true)}>
                Calculate your time savings →
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6">
            Ready to reclaim your weekends?
          </h2>
          <p className="text-xl text-purple-100 mb-8 max-w-3xl mx-auto">
            Join the community of GOMs who chose automation over exhaustion. 
            Your fans deserve better, and so do you.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              className="text-lg px-8 py-4 bg-white text-purple-600 hover:bg-gray-100"
              onClick={() => setShowDemo(true)}
            >
              Explore Live Demo
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="text-lg px-8 py-4 border-white text-white hover:bg-white/10"
              onClick={() => window.location.href = '/pricing'}
            >
              View Pricing Plans
            </Button>
          </div>
          <p className="text-sm text-purple-200 mt-6">
            💜 Trusted by K-pop communities across Southeast Asia • Free tier available
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center gap-3 mb-4 md:mb-0">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">G</span>
              </div>
              <div>
                <span className="text-xl font-bold">GOMFLOW</span>
                <p className="text-xs text-gray-400">Built for K-pop communities</p>
              </div>
            </div>
            <div className="text-center md:text-right">
              <p className="text-gray-400 text-sm">
                © 2025 GOMFLOW. Made with 💜 for Southeast Asian GOMs.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
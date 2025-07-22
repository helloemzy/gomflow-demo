export default function DemoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-amber-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-amber-500 rounded-lg"></div>
                <span className="text-2xl font-bold text-gray-900">GOMFLOW</span>
              </div>
              <span className="ml-4 px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                DEMO
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <button className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                Login
              </button>
              <button className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700">
                Get Started
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Revolutionize Your
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-amber-500">
              {" "}Group Orders
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            GOMFLOW automates the chaotic 15-20 hour manual workflow that Group Order Managers endure, 
            reducing order processing time to just 10 minutes while enabling unlimited scale.
          </p>
          <div className="flex justify-center space-x-4">
            <button className="px-8 py-3 bg-gradient-to-r from-purple-600 to-amber-500 text-white rounded-lg font-medium hover:from-purple-700 hover:to-amber-600">
              Try Live Demo
            </button>
            <button className="px-8 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">
              Watch Video
            </button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">95%</div>
              <div className="text-gray-600">Time Reduction</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-500">3x</div>
              <div className="text-gray-600">Revenue Potential</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-500">$13.3B</div>
              <div className="text-gray-600">Market Size</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-500">9</div>
              <div className="text-gray-600">Microservices</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Complete Platform Features
            </h2>
            <p className="text-xl text-gray-600">
              Everything you need to manage group orders at scale
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* AI-Powered Processing */}
            <div className="bg-white p-6 rounded-lg shadow-sm border-2 border-purple-100 hover:border-purple-300 transition-colors">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-purple-600 font-bold">AI</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">AI-Powered Processing</h3>
              <p className="text-gray-600">
                Smart payment verification with OCR + GPT-4 Vision for 95% time reduction
              </p>
            </div>

            {/* Multi-Platform Integration */}
            <div className="bg-white p-6 rounded-lg shadow-sm border-2 border-amber-100 hover:border-amber-300 transition-colors">
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-amber-600 font-bold">📱</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Multi-Platform Integration</h3>
              <p className="text-gray-600">
                WhatsApp, Telegram, Discord bots with automated buyer communications
              </p>
            </div>

            {/* Advanced Analytics */}
            <div className="bg-white p-6 rounded-lg shadow-sm border-2 border-green-100 hover:border-green-300 transition-colors">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-green-600 font-bold">📊</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Advanced Analytics</h3>
              <p className="text-gray-600">
                Interactive Chart.js visualizations with real-time performance tracking
              </p>
            </div>

            {/* Auto-Scaling Infrastructure */}
            <div className="bg-white p-6 rounded-lg shadow-sm border-2 border-blue-100 hover:border-blue-300 transition-colors">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-blue-600 font-bold">⚡</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Auto-Scaling Infrastructure</h3>
              <p className="text-gray-600">
                Dynamic scaling policies with 99.9% uptime and load balancing
              </p>
            </div>

            {/* Global Payment Support */}
            <div className="bg-white p-6 rounded-lg shadow-sm border-2 border-indigo-100 hover:border-indigo-300 transition-colors">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-indigo-600 font-bold">🌍</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Global Payment Support</h3>
              <p className="text-gray-600">
                PayMongo (Philippines) + Billplz (Malaysia) with multi-currency support
              </p>
            </div>

            {/* Enterprise Security */}
            <div className="bg-white p-6 rounded-lg shadow-sm border-2 border-red-100 hover:border-red-300 transition-colors">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-red-600 font-bold">🛡️</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">Enterprise Security</h3>
              <p className="text-gray-600">
                PCI DSS compliance with comprehensive security auditing and monitoring
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Production-Ready Architecture
            </h2>
            <p className="text-xl text-gray-600">
              9 microservices with enterprise-grade scalability
            </p>
          </div>

          <div className="bg-white rounded-lg p-8 shadow-sm">
            <h3 className="text-2xl font-bold text-center mb-8">GOMFLOW Platform Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="text-3xl mb-2">✅</div>
                <h4 className="font-semibold mb-2">Frontend & Mobile</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>Next.js 14 Web Dashboard</li>
                  <li>React Native Mobile App</li>
                  <li>Advanced Chart.js Analytics</li>
                  <li>Real-time Notifications</li>
                </ul>
              </div>
              
              <div className="text-center">
                <div className="text-3xl mb-2">⚡</div>
                <h4 className="font-semibold mb-2">Core Services</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>Payment Gateway Service</li>
                  <li>Smart AI Payment Agent</li>
                  <li>Analytics & Monitoring</li>
                  <li>Security & Compliance</li>
                </ul>
              </div>

              <div className="text-center">
                <div className="text-3xl mb-2">📱</div>
                <h4 className="font-semibold mb-2">Messaging Bots</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>WhatsApp Business API</li>
                  <li>Telegram Bot (Telegraf.js)</li>
                  <li>Discord Bot (Discord.js v14)</li>
                  <li>Multi-language Support</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-purple-600 to-amber-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Scale Your Group Orders?
          </h2>
          <p className="text-xl text-purple-100 mb-8 max-w-2xl mx-auto">
            Join thousands of GOMs who have reduced their order processing time by 95% 
            and scaled beyond their capacity limits.
          </p>
          <div className="flex justify-center space-x-4">
            <button className="px-8 py-3 bg-white text-purple-600 rounded-lg font-medium hover:bg-gray-100">
              Start Free Trial
            </button>
            <button className="px-8 py-3 border-2 border-white text-white rounded-lg font-medium hover:bg-white hover:text-purple-600">
              Schedule Demo
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-amber-500 rounded-lg"></div>
              <span className="text-2xl font-bold text-white">GOMFLOW</span>
            </div>
            <div className="text-gray-400">
              © 2025 GOMFLOW. Production-ready group order management platform.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
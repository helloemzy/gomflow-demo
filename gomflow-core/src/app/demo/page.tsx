import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp,
  Users,
  DollarSign,
  Clock,
  BarChart3,
  Smartphone,
  Globe,
  Shield,
  Zap,
  CheckCircle
} from "lucide-react";

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
              <Button variant="outline">Login</Button>
              <Button>Get Started</Button>
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
            <Button size="lg" className="bg-gradient-to-r from-purple-600 to-amber-500 hover:from-purple-700 hover:to-amber-600">
              Try Live Demo
            </Button>
            <Button size="lg" variant="outline">
              Watch Video
            </Button>
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
            <Card className="border-2 border-purple-100 hover:border-purple-300 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <Zap className="h-6 w-6 text-purple-600" />
                </div>
                <CardTitle>AI-Powered Processing</CardTitle>
                <CardDescription>
                  Smart payment verification with OCR + GPT-4 Vision for 95% time reduction
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Multi-Platform Integration */}
            <Card className="border-2 border-amber-100 hover:border-amber-300 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mb-4">
                  <Smartphone className="h-6 w-6 text-amber-600" />
                </div>
                <CardTitle>Multi-Platform Integration</CardTitle>
                <CardDescription>
                  WhatsApp, Telegram, Discord bots with automated buyer communications
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Advanced Analytics */}
            <Card className="border-2 border-green-100 hover:border-green-300 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <BarChart3 className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle>Advanced Analytics</CardTitle>
                <CardDescription>
                  Interactive Chart.js visualizations with real-time performance tracking
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Auto-Scaling Infrastructure */}
            <Card className="border-2 border-blue-100 hover:border-blue-300 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <TrendingUp className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle>Auto-Scaling Infrastructure</CardTitle>
                <CardDescription>
                  Dynamic scaling policies with 99.9% uptime and load balancing
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Global Payment Support */}
            <Card className="border-2 border-indigo-100 hover:border-indigo-300 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                  <Globe className="h-6 w-6 text-indigo-600" />
                </div>
                <CardTitle>Global Payment Support</CardTitle>
                <CardDescription>
                  PayMongo (Philippines) + Billplz (Malaysia) with multi-currency support
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Enterprise Security */}
            <Card className="border-2 border-red-100 hover:border-red-300 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-red-600" />
                </div>
                <CardTitle>Enterprise Security</CardTitle>
                <CardDescription>
                  PCI DSS compliance with comprehensive security auditing and monitoring
                </CardDescription>
              </CardHeader>
            </Card>
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2 text-blue-600" />
                  Frontend & Mobile
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                    Next.js 14 Web Dashboard
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                    React Native Mobile App
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                    Advanced Chart.js Analytics
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                    Real-time Notifications
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Zap className="h-5 w-5 mr-2 text-purple-600" />
                  Core Services
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                    Payment Gateway Service
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                    Smart AI Payment Agent
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                    Analytics & Monitoring
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                    Security & Compliance
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Smartphone className="h-5 w-5 mr-2 text-amber-600" />
                  Messaging Bots
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                    WhatsApp Business API
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                    Telegram Bot (Telegraf.js)
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                    Discord Bot (Discord.js v14)
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                    Multi-language Support
                  </li>
                </ul>
              </CardContent>
            </Card>
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
            <Button size="lg" variant="secondary">
              Start Free Trial
            </Button>
            <Button size="lg" variant="outline" className="text-white border-white hover:bg-white hover:text-purple-600">
              Schedule Demo
            </Button>
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
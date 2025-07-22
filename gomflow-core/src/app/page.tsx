"use client";

import { useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Package, 
  Users, 
  CreditCard, 
  Smartphone,
  Globe,
  TrendingUp,
  Shield,
  Clock
} from "lucide-react";

export default function Home() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        router.push("/dashboard");
      }
    };
    
    checkAuth();
  }, [router, supabase]);

  const features = [
    {
      icon: Package,
      title: "Smart Order Management",
      description: "Create and manage group orders with automated tracking and real-time updates."
    },
    {
      icon: CreditCard,
      title: "Payment Automation",
      description: "AI-powered payment processing with PayMongo and Billplz integration."
    },
    {
      icon: Smartphone,
      title: "Multi-Platform Bots",
      description: "WhatsApp, Telegram, and Discord bots for seamless buyer communication."
    },
    {
      icon: Users,
      title: "Buyer Community",
      description: "Connect with thousands of K-pop fans across Southeast Asia."
    },
    {
      icon: Globe,
      title: "Regional Support",
      description: "Built for Philippines and Malaysia with local payment methods."
    },
    {
      icon: TrendingUp,
      title: "Analytics & Insights",
      description: "Track performance with detailed analytics and business intelligence."
    }
  ];

  const stats = [
    { label: "Group Order Managers", value: "1,000+", icon: Users },
    { label: "Orders Processed", value: "10,000+", icon: Package },
    { label: "Countries Supported", value: "2", icon: Globe },
    { label: "Time Saved", value: "95%", icon: Clock }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">G</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">GOMFLOW</h1>
            </div>
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                onClick={() => router.push("/auth/login")}
              >
                Sign In
              </Button>
              <Button onClick={() => router.push("/auth/signup")}>
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Group Order Management
            <span className="text-primary-600"> Made Simple</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            The all-in-one platform for managing K-pop merchandise group orders across Southeast Asia. 
            Automate payments, streamline communications, and scale your business.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              className="text-lg px-8 py-3"
              onClick={() => router.push("/auth/signup")}
            >
              Start Free Trial
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="text-lg px-8 py-3"
              onClick={() => router.push("/auth/login")}
            >
              Sign In
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <stat.icon className="h-8 w-8 text-primary-600" />
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-2">{stat.value}</div>
              <div className="text-gray-600">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Everything you need to scale your group orders
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            From order creation to payment confirmation, GOMFLOW automates every step 
            of the group order process so you can focus on growing your business.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="text-center">
              <CardHeader>
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="h-6 w-6 text-primary-600" />
                </div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary-600 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-4">
            Ready to transform your group orders?
          </h2>
          <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
            Join thousands of GOMs across Southeast Asia who have automated their 
            group order management with GOMFLOW.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              variant="secondary"
              className="text-lg px-8 py-3"
              onClick={() => router.push("/auth/signup")}
            >
              Start Your Free Trial
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="text-lg px-8 py-3 border-white text-white hover:bg-white hover:text-primary-600"
              onClick={() => router.push("/demo")}
            >
              Watch Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">G</span>
              </div>
              <span className="text-xl font-bold">GOMFLOW</span>
            </div>
            <div className="text-gray-400">
              © 2025 GOMFLOW. Built for Southeast Asian group order communities.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  MessageCircle, 
  Clock, 
  Heart,
  Users,
  Zap,
  Shield,
  PlayCircle,
  CheckCircle,
  ArrowRight,
  Star
} from "lucide-react";

export default function Home() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        router.push("/dashboard");
      }
    };
    
    // Check if in demo mode
    setIsDemo(process.env.NEXT_PUBLIC_DEMO_MODE === 'true');
    
    if (!isDemo) {
      checkAuth();
    }
  }, [router, supabase, isDemo]);

  const testimonials = [
    {
      name: "Sarah M.",
      location: "Manila, Philippines",
      role: "SEVENTEEN GO Manager",
      quote: "I used to spend 20+ hours every weekend matching payments. Now I get to actually enjoy the music instead of drowning in spreadsheets.",
      orders: "500+ orders managed",
      avatar: "👩🏻‍💼"
    },
    {
      name: "Minjung L.", 
      location: "Kuala Lumpur, Malaysia",
      role: "Multi-Group GO Organizer",
      quote: "Finally launched during BLACKPINK comeback without missing a single pre-order deadline. My community trusts me because everything is transparent.",
      orders: "200+ successful GOs",
      avatar: "👩🏻‍🎤"
    },
    {
      name: "Lisa T.",
      location: "Bangkok, Thailand", 
      role: "NewJeans Community Lead",
      quote: "Started my first group order last month. The templates and guides made it so easy - I felt like a pro from day one!",
      orders: "First-time GOM success",
      avatar: "👩🏻‍🎨"
    }
  ];

  const painPoints = [
    {
      emoji: "😵‍💫",
      title: "It's Friday night, SEVENTEEN drops a new album...",
      description: "Within minutes, your DMs explode with 'Can I join the GO?' messages"
    },
    {
      emoji: "📱💸",
      title: "200 payment screenshots flood your phone...",
      description: "GCash, PayMaya, bank transfers - all mixed together with no names attached"
    },
    {
      emoji: "😴🔢",
      title: "There goes your entire weekend...",
      description: "Manually matching payments to names while fans ask 'Did you get mine?' every 10 minutes"
    }
  ];

  const solutions = [
    {
      icon: Zap,
      title: "Create orders in 2 minutes",
      description: "Album templates, automatic pricing, instant form generation",
      demo: "Try creating a SEVENTEEN album order →"
    },
    {
      icon: CheckCircle,
      title: "Payments track themselves", 
      description: "AI matches payments to buyers automatically - no more screenshots chaos",
      demo: "Upload any image to test →"
    },
    {
      icon: MessageCircle,
      title: "Buyers get instant updates",
      description: "WhatsApp, Telegram, Discord bots keep everyone informed",
      demo: "See bot responses →"
    },
    {
      icon: Clock,
      title: "Get your weekends back",
      description: "From 20 hours of manual work to 10 minutes of oversight",
      demo: "Calculate your time savings →"
    }
  ];

  const demoFeatures = [
    { name: "NewJeans 'ISTJ' Special Edition", status: "89% filled", location: "Philippines", price: "₱1,250" },
    { name: "SEVENTEEN 'God of Music' Album", status: "Complete!", location: "Malaysia", price: "RM 68" },
    { name: "BLACKPINK Limited Photobook", status: "62% filled", location: "Thailand", price: "฿890" },
    { name: "ITZY 'KILL MY DOUBT' Set", status: "Just opened", location: "Philippines", price: "₱2,100" }
  ];

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
              {isDemo && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                  Demo Mode
                </span>
              )}
              <Button 
                variant="ghost" 
                onClick={() => router.push("/pricing")}
                className="text-purple-600 hover:text-purple-700"
              >
                Pricing
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => router.push("/auth/login")}
                className="text-purple-600 hover:text-purple-700"
              >
                Sign In
              </Button>
              <Button 
                onClick={() => router.push("/browse")}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                See Demo
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-left">
            <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              Stop Drowning in 
              <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                {" "}Payment Screenshots
              </span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-lg">
              The group order platform that actually gets it. 
              Built by GOMs, for GOMs who are tired of spreadsheet hell.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                size="lg" 
                className="text-lg px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                onClick={() => router.push("/browse")}
              >
                <PlayCircle className="mr-2 h-5 w-5" />
                See It In Action
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="text-lg px-8 py-4 border-purple-300 text-purple-600 hover:bg-purple-50"
                onClick={() => router.push("/pricing")}
              >
                View Pricing Plans
              </Button>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              ✨ Free tier available • 14-day trial • Plans from $9/month
            </p>
            {/* Force deployment refresh */}
          </div>
          
          <div className="relative">
            <div className="bg-white rounded-2xl shadow-2xl p-6 border border-purple-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg"></div>
                <div>
                  <p className="font-semibold">Live Group Orders</p>
                  <p className="text-xs text-gray-500">Updated in real-time</p>
                </div>
              </div>
              <div className="space-y-3">
                {demoFeatures.map((order, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{order.name}</p>
                      <p className="text-xs text-gray-600">{order.location} • {order.price}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        order.status.includes('Complete') 
                          ? 'bg-green-100 text-green-800' 
                          : order.status.includes('Just opened')
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
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
            {painPoints.map((point, index) => (
              <Card key={index} className="text-center border-purple-100 hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="text-6xl mb-4">{point.emoji}</div>
                  <CardTitle className="text-lg">{point.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {point.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
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
            {solutions.map((solution, index) => (
              <Card key={index} className="border-purple-100 hover:shadow-lg transition-all hover:scale-105">
                <CardHeader>
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg flex items-center justify-center mb-4">
                    <solution.icon className="h-6 w-6 text-purple-600" />
                  </div>
                  <CardTitle className="text-xl">{solution.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base mb-4">
                    {solution.description}
                  </CardDescription>
                  <Button 
                    variant="ghost" 
                    className="text-purple-600 hover:text-purple-700 p-0 h-auto"
                    onClick={() => router.push("/browse")}
                  >
                    {solution.demo} <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">
              Real GOMs, Real Success Stories
            </h2>
            <p className="text-xl text-purple-100">
              Join hundreds of Group Order Managers who got their weekends back
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="bg-white/10 backdrop-blur border-white/20 text-white">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl">{testimonial.avatar}</span>
                    <div>
                      <p className="font-semibold">{testimonial.name}</p>
                      <p className="text-sm text-purple-100">{testimonial.location}</p>
                    </div>
                  </div>
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-purple-50 mb-4">"{testimonial.quote}"</p>
                  <div className="text-sm">
                    <p className="font-semibold text-purple-200">{testimonial.role}</p>
                    <p className="text-purple-300">{testimonial.orders}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* For New GOMs Section */}
      <section className="py-20 bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl font-bold text-gray-900 mb-6">
              Always wanted to start your own group orders?
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              You don't need to be a spreadsheet wizard. You just need to love K-pop and want to help your community get their favorite merch.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Zap className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="font-semibold mb-2">Quick Setup</h3>
                <p className="text-gray-600">Album templates and step-by-step guides get you started in minutes</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="font-semibold mb-2">Community Support</h3>
                <p className="text-gray-600">Connect with experienced GOMs who'll help you succeed</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-pink-100 to-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="h-8 w-8 text-pink-600" />
                </div>
                <h3 className="font-semibold mb-2">Risk-Free Start</h3>
                <p className="text-gray-600">Built-in safety features protect you and your buyers</p>
              </div>
            </div>
            <Button 
              size="lg" 
              className="text-lg px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
              onClick={() => router.push("/orders/create")}
            >
              Start Your First Group Order (It's Free!)
            </Button>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-gray-900 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6">
            Ready to reclaim your weekends?
          </h2>
          <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
            Join the community of GOMs who chose automation over exhaustion. 
            Your fans deserve better, and so do you.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              className="text-lg px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              onClick={() => router.push("/browse")}
            >
              Explore Live Demo
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="text-lg px-8 py-4 border-gray-600 text-white hover:bg-gray-800"
              onClick={() => router.push("/orders/create")}
            >
              Start Your First GO
            </Button>
          </div>
          <p className="text-sm text-gray-400 mt-6">
            💜 Trusted by K-pop communities across Southeast Asia • No credit card required
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black text-white py-12">
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
              {isDemo && (
                <p className="text-purple-400 text-xs mt-1">
                  Demo Mode - All data is simulated for testing
                </p>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
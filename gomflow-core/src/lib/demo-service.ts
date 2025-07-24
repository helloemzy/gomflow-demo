// Demo Service - Handles demo mode functionality
import { createClient } from '@/lib/supabase'

export interface DemoData {
  users: any[]
  orders: any[]
  submissions: any[]
  messages: any[]
}

class DemoService {
  private static instance: DemoService
  private demoData: DemoData | null = null

  static getInstance(): DemoService {
    if (!DemoService.instance) {
      DemoService.instance = new DemoService()
    }
    return DemoService.instance
  }

  isDemoMode(): boolean {
    return process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
  }

  async initializeDemoData(): Promise<DemoData> {
    if (this.demoData) {
      return this.demoData
    }

    // Create demo data if in demo mode
    if (this.isDemoMode()) {
      this.demoData = {
        users: [
          {
            id: 'demo-user-gom-1',
            email: 'emily.gom@demo.gomflow.com',
            name: 'Emily (Demo GOM)',
            username: 'emily_demo',
            phone: '+639123456789',
            country: 'PH',
            plan: 'pro',
            created_at: new Date().toISOString(),
          },
          {
            id: 'demo-user-gom-2', 
            email: 'sarah.gom@demo.gomflow.com',
            name: 'Sarah (Demo GOM)',
            username: 'sarah_demo',
            phone: '+60123456789',
            country: 'MY',
            plan: 'gateway',
            created_at: new Date().toISOString(),
          }
        ],
        orders: [
          {
            id: 'demo-order-1',
            gom_id: 'demo-user-gom-1',
            title: 'SEVENTEEN "God of Music" Album',
            description: 'Limited edition album with special photocard set. Includes: CD, photobook (80 pages), 13 photocards, poster, stickers.',
            price: 1800,
            currency: 'PHP',
            minimum_orders: 20,
            maximum_orders: 50,
            deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'active',
            country: 'PH',
            category: 'kpop',
            product_type: 'album',
            current_orders: 24,
            created_at: new Date().toISOString(),
          },
          {
            id: 'demo-order-2',
            gom_id: 'demo-user-gom-1', 
            title: 'BLACKPINK Limited Photobook',
            description: 'Rare photobook from Japan tour. High quality prints, exclusive behind-the-scenes photos.',
            price: 3500,
            currency: 'PHP',
            minimum_orders: 30,
            maximum_orders: 100,
            deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'completed',
            country: 'PH', 
            category: 'kpop',
            product_type: 'photobook',
            current_orders: 85,
            created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: 'demo-order-3',
            gom_id: 'demo-user-gom-2',
            title: 'STRAY KIDS Concert Goods',
            description: 'Official concert merchandise bundle: t-shirt, lightstick, bag, keychain.',
            price: 180,
            currency: 'MYR',
            minimum_orders: 15,
            maximum_orders: 40,
            deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'active',
            country: 'MY',
            category: 'kpop', 
            product_type: 'merchandise',
            current_orders: 18,
            created_at: new Date().toISOString(),
          }
        ],
        submissions: [
          {
            id: 'demo-sub-1',
            order_id: 'demo-order-1',
            buyer_name: 'Demo Buyer 1',
            buyer_email: 'buyer1@demo.gomflow.com',
            quantity: 1,
            total_amount: 1800,
            currency: 'PHP',
            payment_method: 'gcash',
            status: 'paid',
            payment_reference: 'GC-DEMO-001',
            created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: 'demo-sub-2', 
            order_id: 'demo-order-1',
            buyer_name: 'Demo Buyer 2',
            buyer_email: 'buyer2@demo.gomflow.com',
            quantity: 2,
            total_amount: 3600,
            currency: 'PHP',
            payment_method: 'paymaya',
            status: 'pending',
            created_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
          }
        ],
        messages: [
          {
            id: 'demo-msg-1',
            order_id: 'demo-order-1',
            content: 'Payment received! Your SEVENTEEN album order is confirmed.',
            platform: 'whatsapp',
            status: 'delivered',
            sent_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          }
        ]
      }
    }

    return this.demoData || { users: [], orders: [], submissions: [], messages: [] }
  }

  async getDemoOrders() {
    const data = await this.initializeDemoData()
    return data.orders
  }

  async getDemoOrderById(id: string) {
    const data = await this.initializeDemoData()
    return data.orders.find(order => order.id === id)
  }

  async getDemoSubmissions(orderId?: string) {
    const data = await this.initializeDemoData()
    if (orderId) {
      return data.submissions.filter(sub => sub.order_id === orderId)
    }
    return data.submissions
  }

  async getDemoUser(id: string) {
    const data = await this.initializeDemoData()
    return data.users.find(user => user.id === id)
  }

  async createDemoOrder(orderData: any) {
    // In demo mode, just simulate order creation
    if (this.isDemoMode()) {
      const newOrder = {
        id: `demo-order-${Date.now()}`,
        ...orderData,
        created_at: new Date().toISOString(),
        current_orders: 0,
        status: 'active'
      }
      
      if (this.demoData) {
        this.demoData.orders.push(newOrder)
      }
      
      return newOrder
    }
    return null
  }

  async createDemoSubmission(submissionData: any) {
    // In demo mode, simulate submission creation
    if (this.isDemoMode()) {
      const newSubmission = {
        id: `demo-sub-${Date.now()}`,
        ...submissionData,
        created_at: new Date().toISOString(),
        status: 'pending'
      }
      
      if (this.demoData) {
        this.demoData.submissions.push(newSubmission)
      }
      
      return newSubmission
    }
    return null
  }

  async mockPaymentProcessing(submissionId: string) {
    // Simulate AI payment processing with random delay and success rate
    return new Promise((resolve) => {
      setTimeout(() => {
        const success = Math.random() > 0.1 // 90% success rate
        resolve({
          success,
          confidence: success ? Math.random() * 0.3 + 0.7 : Math.random() * 0.5 + 0.1,
          payment_method: success ? 'gcash' : 'unknown',
          amount: success ? Math.floor(Math.random() * 5000) + 1000 : null,
          message: success ? 'Payment verified successfully' : 'Could not verify payment'
        })
      }, 2000 + Math.random() * 3000) // 2-5 second delay
    })
  }

  getAnalyticsMockData() {
    return {
      totalOrders: 147,
      totalRevenue: 285600,
      activeOrders: 8,
      completionRate: 94.2,
      averageOrderValue: 2890,
      topPaymentMethods: [
        { name: 'GCash', percentage: 45, count: 66 },
        { name: 'PayMaya', percentage: 30, count: 44 },
        { name: 'Card', percentage: 25, count: 37 }
      ],
      recentOrders: [
        { id: 'demo-order-1', title: 'SEVENTEEN Album', status: 'active', progress: 80 },
        { id: 'demo-order-2', title: 'BLACKPINK Photobook', status: 'completed', progress: 100 },
        { id: 'demo-order-3', title: 'STRAY KIDS Merch', status: 'active', progress: 45 }
      ]
    }
  }
}

export const demoService = DemoService.getInstance()
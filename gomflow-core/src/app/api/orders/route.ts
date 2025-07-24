import { createSupabaseServerClient, supabaseUtils } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import type { ApiResponse } from '@gomflow/shared'
import { demoService } from '@/lib/demo-service'

// GET /api/orders - Fetch user's orders
export async function GET(request: NextRequest) {
  try {
    // Check if in demo mode
    if (demoService.isDemoMode()) {
      const orders = await demoService.getDemoOrders()
      return NextResponse.json<ApiResponse>({
        success: true,
        data: {
          orders,
          pagination: {
            page: 1,
            limit: 10,
            total: orders.length,
            totalPages: 1
          }
        }
      })
    }

    const supabase = createSupabaseServerClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 })
    }

    // Get search params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const active_only = searchParams.get('active_only') === 'true'

    // Build query
    let query = supabase
      .from('order_summaries')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (active_only) {
      query = query.eq('is_active', true)
    }

    // Apply pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data: orders, error, count } = await query

    if (error) {
      console.error('Error fetching orders:', error)
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Failed to fetch orders'
      }, { status: 500 })
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        orders,
        pagination: {
          page,
          limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit)
        }
      }
    })

  } catch (error) {
    console.error('Orders API error:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// POST /api/orders - Create new order
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 })
    }

    const body = await request.json()
    
    // Validate required fields
    const {
      title,
      description,
      price,
      currency,
      deadline,
      payment_methods,
      min_orders,
      max_orders,
      auto_close_on_deadline = true
    } = body

    if (!title || !price || !currency || !deadline || !payment_methods || !min_orders) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Missing required fields'
      }, { status: 400 })
    }

    // Generate unique slug
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 80)
    
    let slug = baseSlug
    let slugExists = true
    let counter = 1

    while (slugExists) {
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('slug', slug)
        .single()

      if (!existingOrder) {
        slugExists = false
      } else {
        slug = `${baseSlug}-${counter}`
        counter++
      }
    }

    // Create order
    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        user_id: user.id,
        title,
        description,
        price: parseFloat(price),
        currency,
        deadline: new Date(deadline).toISOString(),
        slug,
        payment_methods,
        min_orders: parseInt(min_orders),
        max_orders: max_orders ? parseInt(max_orders) : null,
        auto_close_on_deadline,
        is_active: true
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating order:', error)
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Failed to create order'
      }, { status: 500 })
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: order,
      message: 'Order created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Create order API error:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
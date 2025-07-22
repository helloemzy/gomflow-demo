import { createSupabaseServerClient, createSupabaseAdminClient, supabaseUtils } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import type { ApiResponse } from '@gomflow/shared'
import { COUNTRY_CONFIGS } from '@gomflow/shared'

// GET /api/submissions - Fetch submissions for user's orders  
export async function GET(request: NextRequest) {
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

    // Get query params
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('order_id')
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Build query
    let query = supabase
      .from('submissions')
      .select(`
        *,
        order:orders!inner(
          id,
          title,
          user_id
        )
      `)
      .eq('order.user_id', user.id)
      .order('created_at', { ascending: false })

    if (orderId) {
      query = query.eq('order_id', orderId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    // Apply pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data: submissions, error, count } = await query

    if (error) {
      console.error('Error fetching submissions:', error)
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Failed to fetch submissions'
      }, { status: 500 })
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        submissions,
        pagination: {
          page,
          limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit)
        }
      }
    })

  } catch (error) {
    console.error('Submissions API error:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// POST /api/submissions - Create new submission (public endpoint for buyers)
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseAdminClient() // Use admin client for public access
    
    const body = await request.json()
    
    // Validate required fields
    const {
      order_id,
      buyer_name,
      buyer_phone,
      buyer_email,
      buyer_platform = 'web',
      buyer_platform_id,
      quantity,
      source_platform,
      utm_source
    } = body

    if (!order_id || !buyer_name || !buyer_phone || !quantity) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Missing required fields'
      }, { status: 400 })
    }

    // Get the order to validate and calculate total
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .eq('is_active', true)
      .single()

    if (orderError || !order) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Order not found or inactive'
      }, { status: 404 })
    }

    // Check if order deadline has passed
    if (new Date(order.deadline) < new Date()) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Order deadline has passed'
      }, { status: 400 })
    }

    // Check max orders limit
    if (order.max_orders) {
      const { data: existingSubmissions } = await supabase
        .from('submissions')
        .select('quantity')
        .eq('order_id', order_id)
        .not('status', 'eq', 'cancelled')

      const totalQuantity = existingSubmissions?.reduce((sum, sub) => sum + sub.quantity, 0) || 0
      
      if (totalQuantity + quantity > order.max_orders) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: `Only ${order.max_orders - totalQuantity} spots remaining`
        }, { status: 400 })
      }
    }

    // Calculate total amount
    const total_amount = order.price * quantity

    // Generate payment reference
    const country = order.currency === 'PHP' ? 'PH' : 'MY'
    const payment_reference = await supabaseUtils.generatePaymentReference(country)

    // Create submission
    const { data: submission, error: submitError } = await supabase
      .from('submissions')
      .insert({
        order_id,
        buyer_name: buyer_name.trim(),
        buyer_phone: buyer_phone.trim(),
        buyer_email: buyer_email?.trim(),
        buyer_platform,
        buyer_platform_id,
        quantity: parseInt(quantity),
        total_amount,
        currency: order.currency,
        payment_reference,
        status: 'pending',
        source_platform,
        utm_source,
        reminder_count: 0
      })
      .select(`
        *,
        order:orders(
          title,
          deadline,
          payment_methods,
          user:users(
            name,
            country
          )
        )
      `)
      .single()

    if (submitError) {
      console.error('Error creating submission:', submitError)
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Failed to create submission'
      }, { status: 500 })
    }

    // TODO: Trigger notification to messaging services
    // This will be implemented when we build the messaging services

    return NextResponse.json<ApiResponse>({
      success: true,
      data: submission,
      message: 'Order submitted successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Create submission API error:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// PATCH /api/submissions - Update submission status (for GOMs)
export async function PATCH(request: NextRequest) {
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
    const { submission_id, status, notes } = body

    if (!submission_id || !status) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Missing required fields'
      }, { status: 400 })
    }

    // Verify the submission belongs to the user's order
    const { data: submission, error: fetchError } = await supabase
      .from('submissions')
      .select(`
        *,
        order:orders!inner(
          user_id
        )
      `)
      .eq('id', submission_id)
      .eq('order.user_id', user.id)
      .single()

    if (fetchError || !submission) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Submission not found'
      }, { status: 404 })
    }

    // Update submission
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    }

    // If marking as paid, record the timestamp
    if (status === 'paid' && submission.status !== 'paid') {
      // TODO: Create payment transaction record
      // This will be implemented with the payment gateway integration
    }

    const { data: updatedSubmission, error: updateError } = await supabase
      .from('submissions')
      .update(updateData)
      .eq('id', submission_id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating submission:', updateError)
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Failed to update submission'
      }, { status: 500 })
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: updatedSubmission,
      message: 'Submission updated successfully'
    })

  } catch (error) {
    console.error('Update submission API error:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
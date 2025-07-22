import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const orderId = params.id;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Verify user has access to this order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('gom_id, is_active')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Only order owner can see submissions
    if (order.gom_id !== user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Fetch submissions for this order
    const { data: submissions, error: submissionsError } = await supabase
      .from('submissions')
      .select(`
        id,
        quantity,
        buyer_name,
        buyer_phone,
        buyer_email,
        delivery_address,
        payment_method,
        payment_status,
        payment_reference,
        special_instructions,
        created_at,
        updated_at
      `)
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (submissionsError) {
      console.error('Error fetching submissions:', submissionsError);
      return NextResponse.json(
        { error: 'Failed to fetch submissions' },
        { status: 500 }
      );
    }

    // Get total count for pagination
    const { count, error: countError } = await supabase
      .from('submissions')
      .select('*', { count: 'exact', head: true })
      .eq('order_id', orderId);

    if (countError) {
      console.error('Error counting submissions:', countError);
    }

    return NextResponse.json({
      success: true,
      data: submissions || [],
      pagination: {
        limit,
        offset,
        total: count || 0
      }
    });

  } catch (error) {
    console.error('Error in submissions API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const orderId = params.id;
    const body = await request.json();

    // Validate required fields
    const { 
      quantity, 
      buyer_name, 
      buyer_phone, 
      buyer_email, 
      delivery_address, 
      payment_method 
    } = body;

    if (!quantity || !buyer_name || !buyer_phone || !buyer_email || !delivery_address || !payment_method) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify order exists and is active
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    if (!order.is_active || new Date(order.deadline) <= new Date()) {
      return NextResponse.json(
        { error: 'Order is no longer accepting submissions' },
        { status: 400 }
      );
    }

    // Check if order has reached maximum capacity
    if (order.max_orders) {
      const { count } = await supabase
        .from('submissions')
        .select('*', { count: 'exact', head: true })
        .eq('order_id', orderId);

      if (count && count >= order.max_orders) {
        return NextResponse.json(
          { error: 'Order has reached maximum capacity' },
          { status: 400 }
        );
      }
    }

    // Generate payment reference
    const { data: paymentRef, error: refError } = await supabase
      .rpc('generate_payment_reference', { order_id: orderId });

    if (refError) {
      console.error('Error generating payment reference:', refError);
      return NextResponse.json(
        { error: 'Failed to generate payment reference' },
        { status: 500 }
      );
    }

    // Create submission
    const { data: submission, error: submissionError } = await supabase
      .from('submissions')
      .insert({
        order_id: orderId,
        buyer_id: user.id,
        quantity: parseInt(quantity),
        buyer_name,
        buyer_phone,
        buyer_email,
        delivery_address,
        payment_method,
        payment_reference: paymentRef,
        payment_status: 'pending',
        special_instructions: body.special_instructions || null
      })
      .select()
      .single();

    if (submissionError) {
      console.error('Error creating submission:', submissionError);
      return NextResponse.json(
        { error: 'Failed to create submission' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: submission,
      message: 'Submission created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Error in submission creation API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
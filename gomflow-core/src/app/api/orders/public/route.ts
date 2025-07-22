import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const category = searchParams.get('category');
    const country = searchParams.get('country');
    
    // Build query for public orders (no authentication required)
    let query = supabase
      .from('orders')
      .select(`
        id,
        title,
        description,
        price,
        currency,
        deadline,
        min_orders,
        max_orders,
        category,
        shipping_from,
        is_active,
        status,
        created_at,
        gom_id,
        submission_count:submissions(count)
      `)
      .eq('is_active', true)
      .gt('deadline', new Date().toISOString())
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (category) {
      query = query.eq('category', category);
    }
    
    if (country) {
      query = query.eq('shipping_from', country);
    }

    const { data: orders, error } = await query;

    if (error) {
      console.error('Error fetching public orders:', error);
      return NextResponse.json(
        { error: 'Failed to fetch orders' },
        { status: 500 }
      );
    }

    // Transform data to include submission count
    const transformedOrders = orders?.map(order => ({
      ...order,
      submission_count: Array.isArray(order.submission_count) ? order.submission_count.length : 0
    })) || [];

    return NextResponse.json({
      success: true,
      data: transformedOrders,
      pagination: {
        limit,
        offset,
        total: transformedOrders.length
      }
    });

  } catch (error) {
    console.error('Error in public orders API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
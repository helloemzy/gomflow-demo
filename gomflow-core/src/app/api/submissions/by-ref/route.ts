import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  { params }: { params: { ref: string } }
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

    const paymentRef = params.ref;

    // Fetch submission by payment reference
    const { data: submission, error } = await supabase
      .from('submissions')
      .select(`
        *,
        order:orders(
          title,
          price,
          currency,
          gom_name:users!orders_gom_id_fkey(full_name)
        )
      `)
      .eq('payment_reference', paymentRef)
      .single();

    if (error) {
      console.error('Error fetching submission:', error);
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    if (!submission) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    // Check if user has access to this submission
    if (submission.buyer_id !== user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: submission
    });

  } catch (error) {
    console.error('Error in submission API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { ref: string } }
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

    const paymentRef = params.ref;
    const body = await request.json();

    // Verify user owns this submission
    const { data: existingSubmission, error: fetchError } = await supabase
      .from('submissions')
      .select('buyer_id')
      .eq('payment_reference', paymentRef)
      .single();

    if (fetchError || !existingSubmission) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    if (existingSubmission.buyer_id !== user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Update submission
    const { data: updatedSubmission, error: updateError } = await supabase
      .from('submissions')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('payment_reference', paymentRef)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating submission:', updateError);
      return NextResponse.json(
        { error: 'Failed to update submission' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedSubmission
    });

  } catch (error) {
    console.error('Error in submission update API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
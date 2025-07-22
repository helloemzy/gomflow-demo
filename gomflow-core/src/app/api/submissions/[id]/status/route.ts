import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function PATCH(
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

    const submissionId = params.id;
    const body = await request.json();
    const { payment_status } = body;

    // Validate payment status
    const validStatuses = ['pending', 'pending_verification', 'confirmed', 'rejected'];
    if (!validStatuses.includes(payment_status)) {
      return NextResponse.json(
        { error: 'Invalid payment status' },
        { status: 400 }
      );
    }

    // Fetch submission and verify user has permission to update it
    const { data: submission, error: fetchError } = await supabase
      .from('submissions')
      .select(`
        *,
        order:orders!submissions_order_id_fkey(gom_id)
      `)
      .eq('id', submissionId)
      .single();

    if (fetchError || !submission) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    // Check if user is the order owner
    if (submission.order.gom_id !== user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Update submission status
    const { data: updatedSubmission, error: updateError } = await supabase
      .from('submissions')
      .update({
        payment_status,
        updated_at: new Date().toISOString()
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating submission status:', updateError);
      return NextResponse.json(
        { error: 'Failed to update submission status' },
        { status: 500 }
      );
    }

    // TODO: Trigger notifications
    // - Send notification to buyer about status change
    // - Update order statistics if needed
    // - Log the status change for audit trail

    return NextResponse.json({
      success: true,
      data: updatedSubmission,
      message: `Payment status updated to ${payment_status}`
    });

  } catch (error) {
    console.error('Error in submission status update API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
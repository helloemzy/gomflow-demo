import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const image = formData.get('image') as File;
    const submissionId = formData.get('submission_id') as string;
    const orderId = formData.get('order_id') as string;

    if (!image || !submissionId || !orderId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!image.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload an image.' },
        { status: 400 }
      );
    }

    // Validate file size (5MB max)
    if (image.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }

    // Verify user owns this submission
    const { data: submission, error: submissionError } = await supabase
      .from('submissions')
      .select('buyer_id, payment_reference')
      .eq('id', submissionId)
      .single();

    if (submissionError || !submission) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    if (submission.buyer_id !== user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Generate file path
    const timestamp = Date.now();
    const fileExtension = image.name.split('.').pop() || 'jpg';
    const fileName = `payment-proof-${submission.payment_reference}-${timestamp}.${fileExtension}`;
    const filePath = `payment-proofs/${orderId}/${fileName}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('payment-proofs')
      .upload(filePath, image, {
        contentType: image.type,
        upsert: false
      });

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('payment-proofs')
      .getPublicUrl(filePath);

    // Update submission with payment proof
    const { data: updatedSubmission, error: updateError } = await supabase
      .from('submissions')
      .update({
        payment_proof_url: publicUrl,
        payment_status: 'pending_verification',
        updated_at: new Date().toISOString()
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating submission:', updateError);
      return NextResponse.json(
        { error: 'Failed to update submission' },
        { status: 500 }
      );
    }

    // TODO: Trigger Smart Payment Agent processing
    // This would be a queue job to process the uploaded image
    try {
      await fetch(`${process.env.SMART_AGENT_URL}/api/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SMART_AGENT_SECRET}`
        },
        body: JSON.stringify({
          image_url: publicUrl,
          submission_id: submissionId,
          order_id: orderId,
          expected_amount: submission.quantity * submission.price,
          currency: submission.currency,
          payment_method: submission.payment_method
        })
      });
    } catch (agentError) {
      console.warn('Smart Agent processing failed, will require manual review:', agentError);
      // Continue with manual review process
    }

    return NextResponse.json({
      success: true,
      data: {
        submission: updatedSubmission,
        file_url: publicUrl,
        message: 'Payment proof uploaded successfully'
      }
    });

  } catch (error) {
    console.error('Error in payment proof upload API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
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
    const submissionId = formData.get('submission_id') as string;
    const orderId = formData.get('order_id') as string;
    const paymentMethod = formData.get('payment_method') as string;

    if (!submissionId || !orderId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Collect all image files
    const images: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('image_') && value instanceof File) {
        images.push(value);
      }
    }

    if (images.length === 0) {
      return NextResponse.json(
        { error: 'No images uploaded' },
        { status: 400 }
      );
    }

    // Validate all files
    for (const image of images) {
      if (!image.type.startsWith('image/') && image.type !== 'application/pdf') {
        return NextResponse.json(
          { error: 'Invalid file type. Please upload images or PDF files.' },
          { status: 400 }
        );
      }

      if (image.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'File too large. Maximum size is 10MB per file.' },
          { status: 400 }
        );
      }
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

    // Upload all files
    const uploadedFiles: { url: string; filename: string }[] = [];
    const timestamp = Date.now();

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const fileExtension = image.name.split('.').pop() || 'jpg';
      const fileName = `payment-proof-${submission.payment_reference}-${timestamp}-${i + 1}.${fileExtension}`;
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
          { error: `Failed to upload file: ${image.name}` },
          { status: 500 }
        );
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('payment-proofs')
        .getPublicUrl(filePath);

      uploadedFiles.push({
        url: publicUrl,
        filename: image.name
      });
    }

    // Update submission with payment proof URLs
    const { data: updatedSubmission, error: updateError } = await supabase
      .from('submissions')
      .update({
        payment_proof_urls: uploadedFiles.map(f => f.url),
        payment_method: paymentMethod,
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

    // TODO: Trigger Smart Payment Agent processing for each file
    // This would be queue jobs to process the uploaded images
    try {
      for (const file of uploadedFiles) {
        await fetch(`${process.env.SMART_AGENT_URL}/api/process`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SMART_AGENT_SECRET}`
          },
          body: JSON.stringify({
            image_url: file.url,
            filename: file.filename,
            submission_id: submissionId,
            order_id: orderId,
            expected_amount: updatedSubmission.total_amount,
            currency: updatedSubmission.currency,
            payment_method: paymentMethod || updatedSubmission.payment_method
          })
        });
      }
    } catch (agentError) {
      console.warn('Smart Agent processing failed, will require manual review:', agentError);
      // Continue with manual review process
    }

    return NextResponse.json({
      success: true,
      data: {
        submission: updatedSubmission,
        uploaded_files: uploadedFiles,
        file_count: uploadedFiles.length,
        message: `${uploadedFiles.length} payment proof file(s) uploaded successfully`
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
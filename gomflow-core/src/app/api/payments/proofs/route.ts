import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-production'
import { PaymentProof, ApiResponse } from 'gomflow-shared'

/**
 * GET /api/payments/proofs
 * Get payment proofs for a user's orders or specific submission
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('order_id')
    const submissionId = searchParams.get('submission_id')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as ApiResponse,
        { status: 401 }
      )
    }

    let query = supabase
      .from('payment_proofs')
      .select(`
        *,
        submission:submissions!inner(
          id,
          order_id,
          buyer_name,
          buyer_phone,
          quantity,
          total_amount,
          currency,
          payment_reference,
          status,
          created_at,
          order:orders!inner(
            id,
            user_id,
            title,
            currency
          )
        ),
        payment_method:payment_methods(
          id,
          method_type,
          display_name,
          account_name
        )
      `)
      .eq('submission.order.user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Filter by specific submission
    if (submissionId) {
      query = query.eq('submission_id', submissionId)
    }

    // Filter by order
    if (orderId) {
      query = query.eq('submission.order_id', orderId)
    }

    // Filter by verification status
    if (status) {
      query = query.eq('verification_status', status)
    }

    const { data: paymentProofs, error } = await query

    if (error) {
      console.error('Error fetching payment proofs:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch payment proofs' } as ApiResponse,
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: paymentProofs
    } as ApiResponse<PaymentProof[]>)

  } catch (error) {
    console.error('Payment proofs GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' } as ApiResponse,
      { status: 500 }
    )
  }
}

/**
 * POST /api/payments/proofs
 * Upload a new payment proof
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // For file uploads, we don't require authentication here
    // as buyers might not be registered users
    const formData = await request.formData()
    
    const file = formData.get('file') as File
    const submissionId = formData.get('submission_id') as string
    const paymentMethodId = formData.get('payment_method_id') as string
    const uploadedByName = formData.get('uploaded_by_name') as string
    const uploadedByPhone = formData.get('uploaded_by_phone') as string

    if (!file || !submissionId) {
      return NextResponse.json(
        { success: false, error: 'File and submission ID are required' } as ApiResponse,
        { status: 400 }
      )
    }

    // Validate file type and size
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
    const maxSize = 10 * 1024 * 1024 // 10MB

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Only images and PDFs are allowed.' } as ApiResponse,
        { status: 400 }
      )
    }

    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum size is 10MB.' } as ApiResponse,
        { status: 400 }
      )
    }

    // Verify submission exists and is in valid state
    const { data: submission, error: submissionError } = await supabase
      .from('submissions')
      .select(`
        id,
        order_id,
        buyer_name,
        buyer_phone,
        total_amount,
        currency,
        status,
        order:orders!inner(
          id,
          user_id,
          title,
          is_active,
          deadline
        )
      `)
      .eq('id', submissionId)
      .single()

    if (submissionError || !submission) {
      return NextResponse.json(
        { success: false, error: 'Invalid submission ID' } as ApiResponse,
        { status: 400 }
      )
    }

    // Check if submission is still accepting payments
    if (!submission.order.is_active || new Date(submission.order.deadline) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'This order is no longer accepting payments' } as ApiResponse,
        { status: 400 }
      )
    }

    // Check if payment proof already exists for this submission
    const { data: existingProof } = await supabase
      .from('payment_proofs')
      .select('id')
      .eq('submission_id', submissionId)
      .single()

    if (existingProof) {
      return NextResponse.json(
        { success: false, error: 'Payment proof already uploaded for this submission' } as ApiResponse,
        { status: 400 }
      )
    }

    // Generate unique file name
    const timestamp = Date.now()
    const fileExtension = file.name.split('.').pop()
    const fileName = `${submission.order.user_id}/${submissionId}/${timestamp}.${fileExtension}`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('payment-proofs')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('Error uploading file:', uploadError)
      return NextResponse.json(
        { success: false, error: 'Failed to upload file' } as ApiResponse,
        { status: 500 }
      )
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('payment-proofs')
      .getPublicUrl(fileName)

    // Create payment proof record
    const { data: paymentProof, error: insertError } = await supabase
      .from('payment_proofs')
      .insert({
        submission_id: submissionId,
        payment_method_id: paymentMethodId || null,
        file_url: publicUrl,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        uploaded_by_name: uploadedByName || submission.buyer_name,
        uploaded_by_phone: uploadedByPhone || submission.buyer_phone,
        verification_status: 'pending'
      })
      .select(`
        *,
        submission:submissions!inner(
          id,
          buyer_name,
          total_amount,
          currency,
          payment_reference,
          order:orders!inner(
            id,
            title,
            user_id
          )
        )
      `)
      .single()

    if (insertError) {
      console.error('Error creating payment proof record:', insertError)
      
      // Clean up uploaded file if database insert fails
      await supabase.storage
        .from('payment-proofs')
        .remove([fileName])

      return NextResponse.json(
        { success: false, error: 'Failed to create payment proof record' } as ApiResponse,
        { status: 500 }
      )
    }

    // Trigger Smart Agent processing asynchronously
    triggerSmartAgentProcessing(paymentProof.id, publicUrl).catch(error => {
      console.error('Error triggering Smart Agent processing:', error)
    })

    // Send notification to GOM
    sendPaymentProofNotification(paymentProof).catch(error => {
      console.error('Error sending payment proof notification:', error)
    })

    return NextResponse.json({
      success: true,
      data: paymentProof,
      message: 'Payment proof uploaded successfully. It will be processed shortly.'
    } as ApiResponse<PaymentProof>)

  } catch (error) {
    console.error('Payment proofs POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' } as ApiResponse,
      { status: 500 }
    )
  }
}

/**
 * PUT /api/payments/proofs
 * Update payment proof verification status (for GOMs)
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as ApiResponse,
        { status: 401 }
      )
    }

    const body = await request.json()
    const { 
      id, 
      verification_status, 
      rejection_reason, 
      manual_review_notes 
    } = body

    if (!id || !verification_status) {
      return NextResponse.json(
        { success: false, error: 'Payment proof ID and verification status are required' } as ApiResponse,
        { status: 400 }
      )
    }

    // Verify user owns the order for this payment proof
    const { data: proofCheck, error: checkError } = await supabase
      .from('payment_proofs')
      .select(`
        id,
        submission:submissions!inner(
          id,
          order:orders!inner(
            id,
            user_id
          )
        )
      `)
      .eq('id', id)
      .single()

    if (checkError || !proofCheck || proofCheck.submission.order.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Payment proof not found or access denied' } as ApiResponse,
        { status: 404 }
      )
    }

    // Update payment proof
    const updateData: any = {
      verification_status,
      verified_by: user.id,
      verified_at: new Date().toISOString(),
      manual_review_notes
    }

    if (verification_status === 'rejected' && rejection_reason) {
      updateData.rejection_reason = rejection_reason
    }

    const { data: updatedProof, error: updateError } = await supabase
      .from('payment_proofs')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        submission:submissions!inner(
          id,
          buyer_name,
          total_amount,
          payment_reference,
          order:orders!inner(
            id,
            title
          )
        )
      `)
      .single()

    if (updateError) {
      console.error('Error updating payment proof:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update payment proof' } as ApiResponse,
        { status: 500 }
      )
    }

    // Update submission status if approved
    if (verification_status === 'approved') {
      await supabase
        .from('submissions')
        .update({ status: 'paid' })
        .eq('id', updatedProof.submission_id)
    }

    // Send notification to buyer
    sendVerificationNotification(updatedProof).catch(error => {
      console.error('Error sending verification notification:', error)
    })

    return NextResponse.json({
      success: true,
      data: updatedProof,
      message: `Payment proof ${verification_status} successfully`
    } as ApiResponse<PaymentProof>)

  } catch (error) {
    console.error('Payment proofs PUT error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' } as ApiResponse,
      { status: 500 }
    )
  }
}

/**
 * Trigger Smart Agent processing for uploaded payment proof
 */
async function triggerSmartAgentProcessing(proofId: string, fileUrl: string) {
  try {
    const smartAgentUrl = process.env.SMART_AGENT_URL || 'http://localhost:3005'
    
    const response = await fetch(`${smartAgentUrl}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.INTERNAL_API_KEY}`
      },
      body: JSON.stringify({
        payment_proof_id: proofId,
        file_url: fileUrl,
        analysis_type: 'payment_verification'
      })
    })

    if (!response.ok) {
      console.error('Smart Agent processing failed:', response.statusText)
    }
  } catch (error) {
    console.error('Error triggering Smart Agent processing:', error)
  }
}

/**
 * Send notification to GOM about new payment proof upload
 */
async function sendPaymentProofNotification(paymentProof: PaymentProof) {
  try {
    const notificationUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3006'
    
    await fetch(`${notificationUrl}/api/notifications/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.INTERNAL_API_KEY}`
      },
      body: JSON.stringify({
        type: 'payment_proof_uploaded',
        user_id: paymentProof.submission?.order?.user_id,
        title: 'New Payment Proof Uploaded',
        message: `${paymentProof.uploaded_by_name} uploaded payment proof for ${paymentProof.submission?.order?.title}`,
        data: {
          payment_proof_id: paymentProof.id,
          submission_id: paymentProof.submission_id,
          order_id: paymentProof.submission?.order_id,
          amount: paymentProof.submission?.total_amount,
          currency: paymentProof.submission?.currency
        }
      })
    })
  } catch (error) {
    console.error('Error sending payment proof notification:', error)
  }
}

/**
 * Send verification notification to buyer
 */
async function sendVerificationNotification(paymentProof: PaymentProof) {
  try {
    const notificationUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3006'
    
    await fetch(`${notificationUrl}/api/notifications/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.INTERNAL_API_KEY}`
      },
      body: JSON.stringify({
        type: 'payment_verified',
        phone: paymentProof.uploaded_by_phone,
        title: paymentProof.verification_status === 'approved' 
          ? 'Payment Approved ✅' 
          : 'Payment Needs Review ⚠️',
        message: paymentProof.verification_status === 'approved'
          ? `Your payment for ${paymentProof.submission?.order?.title} has been approved!`
          : `Your payment for ${paymentProof.submission?.order?.title} needs review. ${paymentProof.rejection_reason || 'Please contact the organizer.'}`,
        data: {
          payment_proof_id: paymentProof.id,
          verification_status: paymentProof.verification_status,
          order_title: paymentProof.submission?.order?.title,
          payment_reference: paymentProof.submission?.payment_reference
        }
      })
    })
  } catch (error) {
    console.error('Error sending verification notification:', error)
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-production'
import { PaymentProof, BulkVerificationJob, VerificationQueueStats, ApiResponse } from 'gomflow-shared'

/**
 * GET /api/payments/verify
 * Get verification queue or verification statistics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') // 'queue', 'stats', 'job'
    const jobId = searchParams.get('job_id')
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

    // Get specific bulk verification job
    if (action === 'job' && jobId) {
      const { data: job, error } = await supabase
        .from('bulk_verification_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('user_id', user.id)
        .single()

      if (error) {
        return NextResponse.json(
          { success: false, error: 'Bulk verification job not found' } as ApiResponse,
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        data: job
      } as ApiResponse<BulkVerificationJob>)
    }

    // Get verification queue statistics
    if (action === 'stats') {
      const { data: stats, error } = await supabase
        .rpc('get_verification_queue_stats', { user_uuid: user.id })

      if (error) {
        console.error('Error fetching verification stats:', error)
        return NextResponse.json(
          { success: false, error: 'Failed to fetch verification statistics' } as ApiResponse,
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        data: stats
      } as ApiResponse<VerificationQueueStats>)
    }

    // Get verification queue (default action)
    let query = supabase
      .from('payment_proofs')
      .select(`
        *,
        submission:submissions!inner(
          id,
          buyer_name,
          buyer_phone,
          quantity,
          total_amount,
          currency,
          payment_reference,
          created_at,
          order:orders!inner(
            id,
            user_id,
            title,
            deadline
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
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1)

    // Filter by verification status
    if (status) {
      query = query.eq('verification_status', status)
    } else {
      // Default to pending verification statuses
      query = query.in('verification_status', ['pending', 'flagged', 'requires_review'])
    }

    const { data: verificationQueue, error } = await query

    if (error) {
      console.error('Error fetching verification queue:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch verification queue' } as ApiResponse,
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: verificationQueue
    } as ApiResponse<PaymentProof[]>)

  } catch (error) {
    console.error('Payment verification GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' } as ApiResponse,
      { status: 500 }
    )
  }
}

/**
 * POST /api/payments/verify
 * Perform bulk verification actions
 */
export async function POST(request: NextRequest) {
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
      action, // 'bulk_approve', 'bulk_reject', 'auto_verify', 'flag_suspicious'
      proof_ids,
      order_id,
      rejection_reason,
      notes
    } = body

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Action is required' } as ApiResponse,
        { status: 400 }
      )
    }

    // Handle auto-verification and suspicious flagging
    if (action === 'auto_verify') {
      const { data, error } = await supabase
        .rpc('auto_verify_payment_proofs')

      if (error) {
        console.error('Error auto-verifying payments:', error)
        return NextResponse.json(
          { success: false, error: 'Failed to auto-verify payments' } as ApiResponse,
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        data: { auto_verified_count: data },
        message: `Auto-verified ${data} payment proofs`
      } as ApiResponse)
    }

    if (action === 'flag_suspicious') {
      const { data, error } = await supabase
        .rpc('flag_suspicious_payment_proofs')

      if (error) {
        console.error('Error flagging suspicious payments:', error)
        return NextResponse.json(
          { success: false, error: 'Failed to flag suspicious payments' } as ApiResponse,
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        data: { flagged_count: data },
        message: `Flagged ${data} suspicious payment proofs`
      } as ApiResponse)
    }

    // Handle bulk actions
    if (action === 'bulk_approve' || action === 'bulk_reject') {
      if (!proof_ids || !Array.isArray(proof_ids) || proof_ids.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Payment proof IDs are required for bulk actions' } as ApiResponse,
          { status: 400 }
        )
      }

      // Verify all payment proofs belong to user's orders
      const { data: verifyProofs, error: verifyError } = await supabase
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
        .in('id', proof_ids)

      if (verifyError) {
        console.error('Error verifying proof ownership:', verifyError)
        return NextResponse.json(
          { success: false, error: 'Failed to verify payment proof ownership' } as ApiResponse,
          { status: 500 }
        )
      }

      const unauthorizedProofs = verifyProofs?.filter(
        proof => proof.submission.order.user_id !== user.id
      )

      if (unauthorizedProofs && unauthorizedProofs.length > 0) {
        return NextResponse.json(
          { success: false, error: 'Access denied to some payment proofs' } as ApiResponse,
          { status: 403 }
        )
      }

      // Create bulk verification job
      const { data: job, error: jobError } = await supabase
        .from('bulk_verification_jobs')
        .insert({
          user_id: user.id,
          order_id: order_id || null,
          action: action === 'bulk_approve' ? 'bulk_approved' : 'bulk_rejected',
          total_proofs: proof_ids.length,
          proof_ids: proof_ids,
          status: 'processing',
          started_at: new Date().toISOString()
        })
        .select()
        .single()

      if (jobError) {
        console.error('Error creating bulk verification job:', jobError)
        return NextResponse.json(
          { success: false, error: 'Failed to create bulk verification job' } as ApiResponse,
          { status: 500 }
        )
      }

      // Process bulk verification
      processBulkVerification(
        job.id, 
        user.id, 
        proof_ids, 
        action === 'bulk_approve' ? 'approved' : 'rejected',
        rejection_reason,
        notes
      ).catch(error => {
        console.error('Error processing bulk verification:', error)
      })

      return NextResponse.json({
        success: true,
        data: job,
        message: `Bulk ${action === 'bulk_approve' ? 'approval' : 'rejection'} started. Processing ${proof_ids.length} payment proofs.`
      } as ApiResponse<BulkVerificationJob>)
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' } as ApiResponse,
      { status: 400 }
    )

  } catch (error) {
    console.error('Payment verification POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' } as ApiResponse,
      { status: 500 }
    )
  }
}

/**
 * PUT /api/payments/verify
 * Update verification queue settings or reprocess failed verifications
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
    const { action, proof_ids } = body

    if (action === 'reprocess') {
      if (!proof_ids || !Array.isArray(proof_ids)) {
        return NextResponse.json(
          { success: false, error: 'Payment proof IDs are required for reprocessing' } as ApiResponse,
          { status: 400 }
        )
      }

      // Verify ownership and update processing attempts
      const { data: updatedProofs, error: updateError } = await supabase
        .from('payment_proofs')
        .update({
          verification_status: 'pending',
          processing_attempts: 0,
          last_processed_at: null,
          ai_analysis_result: null,
          ai_confidence_score: null
        })
        .in('id', proof_ids)
        .eq('submission.order.user_id', user.id)
        .select(`
          id,
          file_url,
          submission:submissions!inner(
            order:orders!inner(
              user_id
            )
          )
        `)
        .returns<PaymentProof[]>()

      if (updateError) {
        console.error('Error reprocessing payment proofs:', updateError)
        return NextResponse.json(
          { success: false, error: 'Failed to reprocess payment proofs' } as ApiResponse,
          { status: 500 }
        )
      }

      // Trigger Smart Agent reprocessing
      for (const proof of updatedProofs || []) {
        triggerSmartAgentProcessing(proof.id, proof.file_url).catch(error => {
          console.error('Error triggering Smart Agent reprocessing:', error)
        })
      }

      return NextResponse.json({
        success: true,
        data: { reprocessed_count: updatedProofs?.length || 0 },
        message: `Reprocessing ${updatedProofs?.length || 0} payment proofs`
      } as ApiResponse)
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' } as ApiResponse,
      { status: 400 }
    )

  } catch (error) {
    console.error('Payment verification PUT error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' } as ApiResponse,
      { status: 500 }
    )
  }
}

/**
 * Process bulk verification operations
 */
async function processBulkVerification(
  jobId: string,
  userId: string,
  proofIds: string[],
  status: 'approved' | 'rejected',
  rejectionReason?: string,
  notes?: string
) {
  const supabase = createClient()
  
  let successfulProofs = 0
  let failedProofs = 0

  try {
    for (const proofId of proofIds) {
      try {
        // Update payment proof
        const updateData: any = {
          verification_status: status,
          verified_by: userId,
          verified_at: new Date().toISOString(),
          manual_review_notes: notes
        }

        if (status === 'rejected' && rejectionReason) {
          updateData.rejection_reason = rejectionReason
        }

        const { data: updatedProof, error: updateError } = await supabase
          .from('payment_proofs')
          .update(updateData)
          .eq('id', proofId)
          .select(`
            *,
            submission:submissions!inner(
              id,
              buyer_phone,
              order:orders!inner(
                title
              )
            )
          `)
          .single()

        if (updateError) {
          console.error(`Error updating proof ${proofId}:`, updateError)
          failedProofs++
          continue
        }

        // Update submission status if approved
        if (status === 'approved') {
          await supabase
            .from('submissions')
            .update({ status: 'paid' })
            .eq('id', updatedProof.submission_id)
        }

        // Send notification to buyer
        sendVerificationNotification(updatedProof).catch(error => {
          console.error('Error sending verification notification:', error)
        })

        successfulProofs++

      } catch (proofError) {
        console.error(`Error processing proof ${proofId}:`, proofError)
        failedProofs++
      }
    }

    // Update bulk verification job
    await supabase
      .from('bulk_verification_jobs')
      .update({
        processed_proofs: proofIds.length,
        successful_proofs: successfulProofs,
        failed_proofs: failedProofs,
        status: failedProofs > 0 ? 'completed' : 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId)

  } catch (error) {
    console.error('Error in bulk verification processing:', error)
    
    // Update job as failed
    await supabase
      .from('bulk_verification_jobs')
      .update({
        processed_proofs: successfulProofs + failedProofs,
        successful_proofs: successfulProofs,
        failed_proofs: failedProofs,
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId)
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
          order_title: paymentProof.submission?.order?.title
        }
      })
    })
  } catch (error) {
    console.error('Error sending verification notification:', error)
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-production'
import { ManualPaymentMethod, PaymentMethodType, PaymentMethodConfig, ApiResponse, StripePaymentMethod } from 'gomflow-shared'
import StripeBillingService from '@/services/billing/stripeService'

// Payment method configurations for UI
const PAYMENT_METHOD_CONFIGS: Record<PaymentMethodType, PaymentMethodConfig> = {
  // Philippines E-wallets
  gcash: {
    type: 'gcash',
    name: 'GCash',
    icon: '💰',
    color: '#004CFF',
    country: 'PH',
    category: 'ewallet',
    supports_qr: true,
    requires_account_number: true,
    requires_account_name: true,
    requires_bank_name: false,
    placeholder_account: '09XXXXXXXXX',
    validation_pattern: '^09\\d{9}$'
  },
  paymaya: {
    type: 'paymaya',
    name: 'PayMaya',
    icon: '💳',
    color: '#00D4AA',
    country: 'PH',
    category: 'ewallet',
    supports_qr: true,
    requires_account_number: true,
    requires_account_name: true,
    requires_bank_name: false,
    placeholder_account: '09XXXXXXXXX',
    validation_pattern: '^09\\d{9}$'
  },
  maya: {
    type: 'maya',
    name: 'Maya',
    icon: '🏦',
    color: '#FF6B35',
    country: 'PH',
    category: 'ewallet',
    supports_qr: true,
    requires_account_number: true,
    requires_account_name: true,
    requires_bank_name: false,
    placeholder_account: '09XXXXXXXXX',
    validation_pattern: '^09\\d{9}$'
  },
  grabpay_ph: {
    type: 'grabpay_ph',
    name: 'GrabPay Philippines',
    icon: '🚗',
    color: '#00B14F',
    country: 'PH',
    category: 'ewallet',
    supports_qr: true,
    requires_account_number: true,
    requires_account_name: false,
    requires_bank_name: false,
    placeholder_account: '09XXXXXXXXX',
    validation_pattern: '^09\\d{9}$'
  },
  shopeepay_ph: {
    type: 'shopeepay_ph',
    name: 'ShopeePay Philippines',
    icon: '🛒',
    color: '#FF5722',
    country: 'PH',
    category: 'ewallet',
    supports_qr: true,
    requires_account_number: true,
    requires_account_name: false,
    requires_bank_name: false,
    placeholder_account: '09XXXXXXXXX',
    validation_pattern: '^09\\d{9}$'
  },

  // Philippines Banks
  bpi: {
    type: 'bpi',
    name: 'BPI (Bank of the Philippine Islands)',
    icon: '🏦',
    color: '#C41E3A',
    country: 'PH',
    category: 'bank',
    supports_qr: false,
    requires_account_number: true,
    requires_account_name: true,
    requires_bank_name: false,
    placeholder_account: 'XXXXXXXXXXXX',
    validation_pattern: '^\\d{10,16}$'
  },
  bdo: {
    type: 'bdo',
    name: 'BDO (Banco de Oro)',
    icon: '🏦',
    color: '#003366',
    country: 'PH',
    category: 'bank',
    supports_qr: false,
    requires_account_number: true,
    requires_account_name: true,
    requires_bank_name: false,
    placeholder_account: 'XXXXXXXXXXXX',
    validation_pattern: '^\\d{10,16}$'
  },
  metrobank: {
    type: 'metrobank',
    name: 'Metrobank',
    icon: '🏦',
    color: '#FFA500',
    country: 'PH',
    category: 'bank',
    supports_qr: false,
    requires_account_number: true,
    requires_account_name: true,
    requires_bank_name: false,
    placeholder_account: 'XXXXXXXXXXXX',
    validation_pattern: '^\\d{10,16}$'
  },
  unionbank: {
    type: 'unionbank',
    name: 'UnionBank',
    icon: '🏦',
    color: '#004225',
    country: 'PH',
    category: 'bank',
    supports_qr: false,
    requires_account_number: true,
    requires_account_name: true,
    requires_bank_name: false,
    placeholder_account: 'XXXXXXXXXXXX',
    validation_pattern: '^\\d{10,16}$'
  },
  rcbc: {
    type: 'rcbc',
    name: 'RCBC (Rizal Commercial Banking Corporation)',
    icon: '🏦',
    color: '#0066CC',
    country: 'PH',
    category: 'bank',
    supports_qr: false,
    requires_account_number: true,
    requires_account_name: true,
    requires_bank_name: false,
    placeholder_account: 'XXXXXXXXXXXX',
    validation_pattern: '^\\d{10,16}$'
  },
  pnb: {
    type: 'pnb',
    name: 'PNB (Philippine National Bank)',
    icon: '🏦',
    color: '#FFD700',
    country: 'PH',
    category: 'bank',
    supports_qr: false,
    requires_account_number: true,
    requires_account_name: true,
    requires_bank_name: false,
    placeholder_account: 'XXXXXXXXXXXX',
    validation_pattern: '^\\d{10,16}$'
  },

  // Malaysia E-wallets
  maybank2u: {
    type: 'maybank2u',
    name: 'Maybank2u',
    icon: '🏦',
    color: '#FFD320',
    country: 'MY',
    category: 'ewallet',
    supports_qr: true,
    requires_account_number: true,
    requires_account_name: true,
    requires_bank_name: false,
    placeholder_account: '01XXXXXXXX',
    validation_pattern: '^01\\d{8,9}$'
  },
  cimb: {
    type: 'cimb',
    name: 'CIMB Bank',
    icon: '🏦',
    color: '#DC143C',
    country: 'MY',
    category: 'bank',
    supports_qr: true,
    requires_account_number: true,
    requires_account_name: true,
    requires_bank_name: false,
    placeholder_account: 'XXXXXXXXXXXX',
    validation_pattern: '^\\d{10,16}$'
  },
  public_bank: {
    type: 'public_bank',
    name: 'Public Bank',
    icon: '🏦',
    color: '#FF6B35',
    country: 'MY',
    category: 'bank',
    supports_qr: false,
    requires_account_number: true,
    requires_account_name: true,
    requires_bank_name: false,
    placeholder_account: 'XXXXXXXXXXXX',
    validation_pattern: '^\\d{10,16}$'
  },
  hong_leong: {
    type: 'hong_leong',
    name: 'Hong Leong Bank',
    icon: '🏦',
    color: '#1E88E5',
    country: 'MY',
    category: 'bank',
    supports_qr: false,
    requires_account_number: true,
    requires_account_name: true,
    requires_bank_name: false,
    placeholder_account: 'XXXXXXXXXXXX',
    validation_pattern: '^\\d{10,16}$'
  },
  ambank: {
    type: 'ambank',
    name: 'AmBank',
    icon: '🏦',
    color: '#FF5722',
    country: 'MY',
    category: 'bank',
    supports_qr: false,
    requires_account_number: true,
    requires_account_name: true,
    requires_bank_name: false,
    placeholder_account: 'XXXXXXXXXXXX',
    validation_pattern: '^\\d{10,16}$'
  },
  rhb: {
    type: 'rhb',
    name: 'RHB Bank',
    icon: '🏦',
    color: '#004D9F',
    country: 'MY',
    category: 'bank',
    supports_qr: false,
    requires_account_number: true,
    requires_account_name: true,
    requires_bank_name: false,
    placeholder_account: 'XXXXXXXXXXXX',
    validation_pattern: '^\\d{10,16}$'
  },
  tng: {
    type: 'tng',
    name: 'Touch \'n Go eWallet',
    icon: '💳',
    color: '#1976D2',
    country: 'MY',
    category: 'ewallet',
    supports_qr: true,
    requires_account_number: true,
    requires_account_name: false,
    requires_bank_name: false,
    placeholder_account: '01XXXXXXXX',
    validation_pattern: '^01\\d{8,9}$'
  },
  boost: {
    type: 'boost',
    name: 'Boost',
    icon: '🚀',
    color: '#FF9800',
    country: 'MY',
    category: 'ewallet',
    supports_qr: true,
    requires_account_number: true,
    requires_account_name: false,
    requires_bank_name: false,
    placeholder_account: '01XXXXXXXX',
    validation_pattern: '^01\\d{8,9}$'
  },
  grabpay_my: {
    type: 'grabpay_my',
    name: 'GrabPay Malaysia',
    icon: '🚗',
    color: '#00B14F',
    country: 'MY',
    category: 'ewallet',
    supports_qr: true,
    requires_account_number: true,
    requires_account_name: false,
    requires_bank_name: false,
    placeholder_account: '01XXXXXXXX',
    validation_pattern: '^01\\d{8,9}$'
  },
  shopeepay_my: {
    type: 'shopeepay_my',
    name: 'ShopeePay Malaysia',
    icon: '🛒',
    color: '#FF5722',
    country: 'MY',
    category: 'ewallet',
    supports_qr: true,
    requires_account_number: true,
    requires_account_name: false,
    requires_bank_name: false,
    placeholder_account: '01XXXXXXXX',
    validation_pattern: '^01\\d{8,9}$'
  },
  touch_n_go: {
    type: 'touch_n_go',
    name: 'Touch \'n Go Card',
    icon: '💳',
    color: '#1976D2',
    country: 'MY',
    category: 'ewallet',
    supports_qr: false,
    requires_account_number: true,
    requires_account_name: false,
    requires_bank_name: false,
    placeholder_account: 'Card Number',
    validation_pattern: '^\\d{10,16}$'
  },

  // Generic options
  bank_transfer_ph: {
    type: 'bank_transfer_ph',
    name: 'Bank Transfer (Philippines)',
    icon: '🏦',
    color: '#757575',
    country: 'PH',
    category: 'bank',
    supports_qr: false,
    requires_account_number: true,
    requires_account_name: true,
    requires_bank_name: true,
    placeholder_account: 'Account Number',
    validation_pattern: '^\\d{8,20}$'
  },
  bank_transfer_my: {
    type: 'bank_transfer_my',
    name: 'Bank Transfer (Malaysia)',
    icon: '🏦',
    color: '#757575',
    country: 'MY',
    category: 'bank',
    supports_qr: false,
    requires_account_number: true,
    requires_account_name: true,
    requires_bank_name: true,
    placeholder_account: 'Account Number',
    validation_pattern: '^\\d{8,20}$'
  },
  crypto: {
    type: 'crypto',
    name: 'Cryptocurrency',
    icon: '₿',
    color: '#F7931A',
    country: 'PH',
    category: 'crypto',
    supports_qr: true,
    requires_account_number: true,
    requires_account_name: false,
    requires_bank_name: false,
    placeholder_account: 'Wallet Address',
    validation_pattern: '^[a-zA-Z0-9]{26,62}$'
  },
  other: {
    type: 'other',
    name: 'Other Payment Method',
    icon: '💳',
    color: '#9E9E9E',
    country: 'PH',
    category: 'other',
    supports_qr: false,
    requires_account_number: false,
    requires_account_name: false,
    requires_bank_name: false,
    placeholder_account: 'Details',
    validation_pattern: undefined
  }
}

/**
 * GET /api/payments/methods
 * Get user's payment methods or available configurations
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') // 'list', 'configs', 'stripe', or 'setup'
    const country = searchParams.get('country') as 'PH' | 'MY' | null
    const type = searchParams.get('type') // 'manual' or 'stripe'

    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as ApiResponse,
        { status: 401 }
      )
    }

    // Return payment method configurations for UI
    if (action === 'configs') {
      const configs = Object.values(PAYMENT_METHOD_CONFIGS)
      const filteredConfigs = country 
        ? configs.filter(config => config.country === country)
        : configs

      return NextResponse.json({
        success: true,
        data: filteredConfigs
      } as ApiResponse<PaymentMethodConfig[]>)
    }

    // Return setup intent for Stripe payment methods
    if (action === 'setup') {
      try {
        const setup = await StripeBillingService.createPaymentMethodSetup(user.id)
        return NextResponse.json({
          success: true,
          data: setup
        })
      } catch (error: any) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        )
      }
    }

    // Return Stripe payment methods
    if (action === 'stripe' || type === 'stripe') {
      try {
        const stripePaymentMethods = await StripeBillingService.listPaymentMethods(user.id)
        return NextResponse.json({
          success: true,
          data: stripePaymentMethods
        } as ApiResponse<StripePaymentMethod[]>)
      } catch (error: any) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        )
      }
    }

    // Return user's configured manual payment methods
    const { data: paymentMethods, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('Error fetching payment methods:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch payment methods' } as ApiResponse,
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: paymentMethods
    } as ApiResponse<ManualPaymentMethod[]>)

  } catch (error) {
    console.error('Payment methods GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' } as ApiResponse,
      { status: 500 }
    )
  }
}

/**
 * POST /api/payments/methods
 * Create a new payment method
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
      method_type,
      display_name,
      account_number,
      account_name,
      bank_name,
      qr_code_url,
      instructions,
      minimum_amount = 0,
      maximum_amount,
      processing_fee = 0,
      processing_fee_percentage = 0,
      requires_proof = true,
      auto_verify_threshold
    } = body

    // Validate required fields
    if (!method_type || !display_name) {
      return NextResponse.json(
        { success: false, error: 'Method type and display name are required' } as ApiResponse,
        { status: 400 }
      )
    }

    // Get the next sort order
    const { data: existingMethods } = await supabase
      .from('payment_methods')
      .select('sort_order')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: false })
      .limit(1)

    const nextSortOrder = (existingMethods?.[0]?.sort_order || 0) + 1

    // Create payment method
    const { data: paymentMethod, error } = await supabase
      .from('payment_methods')
      .insert({
        user_id: user.id,
        method_type,
        display_name,
        account_number,
        account_name,
        bank_name,
        qr_code_url,
        instructions,
        minimum_amount,
        maximum_amount,
        processing_fee,
        processing_fee_percentage,
        requires_proof,
        auto_verify_threshold,
        sort_order: nextSortOrder
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating payment method:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to create payment method' } as ApiResponse,
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: paymentMethod,
      message: 'Payment method created successfully'
    } as ApiResponse<ManualPaymentMethod>)

  } catch (error) {
    console.error('Payment methods POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' } as ApiResponse,
      { status: 500 }
    )
  }
}

/**
 * PUT /api/payments/methods
 * Update a payment method (manual or Stripe)
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
    const { id, type, action, payment_method_id, set_as_default, ...updateData } = body

    // Handle Stripe payment method operations
    if (type === 'stripe') {
      try {
        if (action === 'set_default' && payment_method_id) {
          await StripeBillingService.setDefaultPaymentMethod(user.id, payment_method_id)
          return NextResponse.json({
            success: true,
            message: 'Default payment method updated successfully'
          })
        }

        if (action === 'detach' && payment_method_id) {
          await StripeBillingService.setDefaultPaymentMethod(user.id, payment_method_id)
          return NextResponse.json({
            success: true,
            message: 'Payment method removed successfully'
          })
        }

        return NextResponse.json(
          { success: false, error: 'Invalid action for Stripe payment method' },
          { status: 400 }
        )
      } catch (error: any) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        )
      }
    }

    // Handle manual payment method updates
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Payment method ID is required' } as ApiResponse,
        { status: 400 }
      )
    }

    // Update payment method (RLS ensures only owner can update)
    const { data: paymentMethod, error } = await supabase
      .from('payment_methods')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating payment method:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to update payment method' } as ApiResponse,
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: paymentMethod,
      message: 'Payment method updated successfully'
    } as ApiResponse<ManualPaymentMethod>)

  } catch (error) {
    console.error('Payment methods PUT error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' } as ApiResponse,
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/payments/methods
 * Delete a payment method
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Payment method ID is required' } as ApiResponse,
        { status: 400 }
      )
    }

    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as ApiResponse,
        { status: 401 }
      )
    }

    // Check if payment method has active payment proofs
    const { data: activeProofs, error: proofsError } = await supabase
      .from('payment_proofs')
      .select('id')
      .eq('payment_method_id', id)
      .in('verification_status', ['pending', 'flagged', 'requires_review'])
      .limit(1)

    if (proofsError) {
      console.error('Error checking active proofs:', proofsError)
      return NextResponse.json(
        { success: false, error: 'Failed to check payment method usage' } as ApiResponse,
        { status: 500 }
      )
    }

    if (activeProofs && activeProofs.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Cannot delete payment method with pending verifications. Please process all pending payments first.' 
        } as ApiResponse,
        { status: 400 }
      )
    }

    // Delete payment method (RLS ensures only owner can delete)
    const { error } = await supabase
      .from('payment_methods')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting payment method:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to delete payment method' } as ApiResponse,
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Payment method deleted successfully'
    } as ApiResponse)

  } catch (error) {
    console.error('Payment methods DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' } as ApiResponse,
      { status: 500 }
    )
  }
}
-- ============================================================================
-- MANUAL PAYMENT SYSTEM DATABASE SCHEMA
-- Comprehensive payment method configuration and verification system
-- ============================================================================

-- ============================================================================
-- CUSTOM TYPES FOR MANUAL PAYMENT SYSTEM
-- ============================================================================

-- Payment method types supported in Southeast Asia
CREATE TYPE payment_method_type AS ENUM (
  'gcash', 'paymaya', 'maya', 'grabpay_ph', 'shopeepay_ph',
  'bpi', 'bdo', 'metrobank', 'unionbank', 'rcbc', 'pnb',
  'maybank2u', 'cimb', 'public_bank', 'hong_leong', 'ambank', 'rhb',
  'tng', 'boost', 'grabpay_my', 'shopeepay_my', 'touch_n_go',
  'bank_transfer_ph', 'bank_transfer_my', 'crypto', 'other'
);

-- Verification status for payment proofs
CREATE TYPE verification_status AS ENUM ('pending', 'approved', 'rejected', 'flagged', 'requires_review');

-- Action types for verification logs
CREATE TYPE verification_action AS ENUM ('submitted', 'reviewed', 'approved', 'rejected', 'flagged', 'bulk_approved', 'bulk_rejected');

-- ============================================================================
-- PAYMENT_METHODS TABLE
-- Configuration of payment methods for each GOM
-- ============================================================================
CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    method_type payment_method_type NOT NULL,
    display_name VARCHAR(100) NOT NULL, -- e.g., "GCash - Sarah M."
    account_number VARCHAR(50), -- Phone number or account number
    account_name VARCHAR(100), -- Account holder name
    bank_name VARCHAR(100), -- For bank transfers
    qr_code_url TEXT, -- Supabase Storage URL for QR code
    instructions TEXT, -- Custom payment instructions
    minimum_amount DECIMAL(10,2) DEFAULT 0,
    maximum_amount DECIMAL(10,2),
    processing_fee DECIMAL(10,2) DEFAULT 0, -- Fee to add to amount
    processing_fee_percentage DECIMAL(5,2) DEFAULT 0, -- Percentage fee
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0, -- Display order
    requires_proof BOOLEAN DEFAULT true, -- Whether proof upload is required
    auto_verify_threshold DECIMAL(10,2), -- Amount below which auto-approve
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for payment_methods
CREATE INDEX idx_payment_methods_user_id ON payment_methods(user_id);
CREATE INDEX idx_payment_methods_type ON payment_methods(method_type);
CREATE INDEX idx_payment_methods_active ON payment_methods(is_active);
CREATE INDEX idx_payment_methods_sort ON payment_methods(sort_order);

-- ============================================================================
-- PAYMENT_PROOFS TABLE
-- Storage and tracking of payment proof uploads
-- ============================================================================
CREATE TABLE payment_proofs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    payment_method_id UUID REFERENCES payment_methods(id) ON DELETE SET NULL,
    file_url TEXT NOT NULL, -- Supabase Storage URL
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL, -- File size in bytes
    file_type VARCHAR(50) NOT NULL, -- MIME type
    uploaded_by_name VARCHAR(255), -- Buyer name from form
    uploaded_by_phone VARCHAR(20), -- Buyer phone from form
    verification_status verification_status DEFAULT 'pending',
    verified_by UUID REFERENCES profiles(user_id) ON DELETE SET NULL, -- GOM who verified
    verified_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT, -- Reason if rejected
    ai_analysis_result JSONB, -- Smart Agent analysis results
    ai_confidence_score DECIMAL(3,2), -- AI confidence (0.00 to 1.00)
    extracted_amount DECIMAL(10,2), -- Amount extracted by AI
    extracted_reference VARCHAR(100), -- Reference extracted by AI
    extracted_method VARCHAR(50), -- Payment method detected by AI
    manual_review_notes TEXT, -- GOM's manual review notes
    flagged_reasons TEXT[], -- Array of flag reasons
    processing_attempts INTEGER DEFAULT 0, -- Number of AI processing attempts
    last_processed_at TIMESTAMP WITH TIME ZONE, -- Last AI processing time
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for payment_proofs
CREATE INDEX idx_payment_proofs_submission_id ON payment_proofs(submission_id);
CREATE INDEX idx_payment_proofs_payment_method_id ON payment_proofs(payment_method_id);
CREATE INDEX idx_payment_proofs_status ON payment_proofs(verification_status);
CREATE INDEX idx_payment_proofs_verified_by ON payment_proofs(verified_by);
CREATE INDEX idx_payment_proofs_created_at ON payment_proofs(created_at);
CREATE INDEX idx_payment_proofs_ai_confidence ON payment_proofs(ai_confidence_score);
CREATE INDEX idx_payment_proofs_extracted_amount ON payment_proofs(extracted_amount);

-- ============================================================================
-- VERIFICATION_LOGS TABLE
-- Audit trail for all payment verification actions
-- ============================================================================
CREATE TABLE verification_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_proof_id UUID NOT NULL REFERENCES payment_proofs(id) ON DELETE CASCADE,
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL, -- GOM who took action
    action verification_action NOT NULL,
    previous_status verification_status,
    new_status verification_status,
    notes TEXT, -- Action notes/reason
    metadata JSONB DEFAULT '{}'::jsonb, -- Additional action metadata
    ip_address INET, -- IP address of action taker
    user_agent TEXT, -- Browser/app info
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for verification_logs
CREATE INDEX idx_verification_logs_payment_proof_id ON verification_logs(payment_proof_id);
CREATE INDEX idx_verification_logs_submission_id ON verification_logs(submission_id);
CREATE INDEX idx_verification_logs_order_id ON verification_logs(order_id);
CREATE INDEX idx_verification_logs_user_id ON verification_logs(user_id);
CREATE INDEX idx_verification_logs_action ON verification_logs(action);
CREATE INDEX idx_verification_logs_created_at ON verification_logs(created_at);

-- ============================================================================
-- BULK_VERIFICATION_JOBS TABLE
-- Track bulk verification operations
-- ============================================================================
CREATE TABLE bulk_verification_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE, -- NULL for cross-order operations
    action verification_action NOT NULL,
    total_proofs INTEGER NOT NULL,
    processed_proofs INTEGER DEFAULT 0,
    successful_proofs INTEGER DEFAULT 0,
    failed_proofs INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    proof_ids UUID[] NOT NULL, -- Array of payment_proof IDs
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for bulk_verification_jobs
CREATE INDEX idx_bulk_verification_jobs_user_id ON bulk_verification_jobs(user_id);
CREATE INDEX idx_bulk_verification_jobs_order_id ON bulk_verification_jobs(order_id);
CREATE INDEX idx_bulk_verification_jobs_status ON bulk_verification_jobs(status);
CREATE INDEX idx_bulk_verification_jobs_created_at ON bulk_verification_jobs(created_at);

-- ============================================================================
-- DATABASE FUNCTIONS FOR MANUAL PAYMENT SYSTEM
-- ============================================================================

-- Function to get payment method stats for a user
CREATE OR REPLACE FUNCTION get_payment_method_stats(user_uuid UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_methods', COUNT(*),
        'active_methods', COUNT(*) FILTER (WHERE is_active = true),
        'methods_by_type', json_object_agg(method_type, method_count)
    ) INTO result
    FROM (
        SELECT 
            method_type,
            COUNT(*) as method_count
        FROM payment_methods 
        WHERE user_id = user_uuid
        GROUP BY method_type
    ) method_counts,
    (
        SELECT COUNT(*) as total_count
        FROM payment_methods 
        WHERE user_id = user_uuid
    ) totals;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to get verification queue stats for a user
CREATE OR REPLACE FUNCTION get_verification_queue_stats(user_uuid UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'pending_verifications', COUNT(*) FILTER (WHERE pp.verification_status = 'pending'),
        'flagged_verifications', COUNT(*) FILTER (WHERE pp.verification_status = 'flagged'),
        'requires_review', COUNT(*) FILTER (WHERE pp.verification_status = 'requires_review'),
        'high_confidence_pending', COUNT(*) FILTER (
            WHERE pp.verification_status = 'pending' 
            AND pp.ai_confidence_score >= 0.8
        ),
        'low_confidence_pending', COUNT(*) FILTER (
            WHERE pp.verification_status = 'pending' 
            AND pp.ai_confidence_score < 0.5
        ),
        'oldest_pending', MIN(pp.created_at) FILTER (WHERE pp.verification_status = 'pending'),
        'avg_processing_time', AVG(
            EXTRACT(EPOCH FROM (pp.verified_at - pp.created_at)) / 60
        ) FILTER (WHERE pp.verified_at IS NOT NULL)
    ) INTO result
    FROM payment_proofs pp
    JOIN submissions s ON s.id = pp.submission_id
    JOIN orders o ON o.id = s.order_id
    WHERE o.user_id = user_uuid;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-verify payment proofs based on confidence and amount
CREATE OR REPLACE FUNCTION auto_verify_payment_proofs()
RETURNS INTEGER AS $$
DECLARE
    auto_verified_count INTEGER := 0;
    proof_record RECORD;
BEGIN
    -- Auto-approve high-confidence, low-amount payments
    FOR proof_record IN
        SELECT pp.*, pm.auto_verify_threshold, s.total_amount
        FROM payment_proofs pp
        JOIN submissions s ON s.id = pp.submission_id
        LEFT JOIN payment_methods pm ON pm.id = pp.payment_method_id
        WHERE pp.verification_status = 'pending'
        AND pp.ai_confidence_score >= 0.9
        AND (
            pm.auto_verify_threshold IS NULL 
            OR s.total_amount <= pm.auto_verify_threshold
        )
        AND pp.extracted_amount IS NOT NULL
        AND ABS(pp.extracted_amount - s.total_amount) <= 1.00 -- Allow 1 peso/ringgit difference
    LOOP
        -- Update payment proof status
        UPDATE payment_proofs 
        SET 
            verification_status = 'approved',
            verified_at = NOW(),
            updated_at = NOW()
        WHERE id = proof_record.id;
        
        -- Update submission status
        UPDATE submissions 
        SET 
            status = 'paid',
            updated_at = NOW()
        WHERE id = proof_record.submission_id;
        
        -- Log the auto-verification
        INSERT INTO verification_logs (
            payment_proof_id,
            submission_id,
            order_id,
            action,
            previous_status,
            new_status,
            notes,
            metadata
        ) VALUES (
            proof_record.id,
            proof_record.submission_id,
            (SELECT order_id FROM submissions WHERE id = proof_record.submission_id),
            'approved',
            'pending',
            'approved',
            'Auto-verified by system',
            json_build_object(
                'auto_verified', true,
                'ai_confidence', proof_record.ai_confidence_score,
                'amount_match', true
            )
        );
        
        auto_verified_count := auto_verified_count + 1;
    END LOOP;
    
    RETURN auto_verified_count;
END;
$$ LANGUAGE plpgsql;

-- Function to flag suspicious payment proofs
CREATE OR REPLACE FUNCTION flag_suspicious_payment_proofs()
RETURNS INTEGER AS $$
DECLARE
    flagged_count INTEGER := 0;
    proof_record RECORD;
    flag_reasons TEXT[];
BEGIN
    FOR proof_record IN
        SELECT pp.*, s.total_amount, s.payment_reference
        FROM payment_proofs pp
        JOIN submissions s ON s.id = pp.submission_id
        WHERE pp.verification_status = 'pending'
        AND pp.ai_confidence_score IS NOT NULL
    LOOP
        flag_reasons := ARRAY[]::TEXT[];
        
        -- Flag if amount mismatch is significant
        IF proof_record.extracted_amount IS NOT NULL 
           AND ABS(proof_record.extracted_amount - proof_record.total_amount) > 10.00 THEN
            flag_reasons := array_append(flag_reasons, 'significant_amount_mismatch');
        END IF;
        
        -- Flag if AI confidence is very low
        IF proof_record.ai_confidence_score < 0.3 THEN
            flag_reasons := array_append(flag_reasons, 'low_ai_confidence');
        END IF;
        
        -- Flag if processing failed multiple times
        IF proof_record.processing_attempts > 3 THEN
            flag_reasons := array_append(flag_reasons, 'multiple_processing_failures');
        END IF;
        
        -- Flag if duplicate reference detected
        IF EXISTS (
            SELECT 1 FROM payment_proofs pp2 
            WHERE pp2.extracted_reference = proof_record.extracted_reference
            AND pp2.id != proof_record.id
            AND pp2.extracted_reference IS NOT NULL
            AND pp2.verification_status = 'approved'
        ) THEN
            flag_reasons := array_append(flag_reasons, 'duplicate_reference');
        END IF;
        
        -- Apply flags if any found
        IF array_length(flag_reasons, 1) > 0 THEN
            UPDATE payment_proofs 
            SET 
                verification_status = 'flagged',
                flagged_reasons = flag_reasons,
                updated_at = NOW()
            WHERE id = proof_record.id;
            
            -- Log the flagging
            INSERT INTO verification_logs (
                payment_proof_id,
                submission_id,
                order_id,
                action,
                previous_status,
                new_status,
                notes,
                metadata
            ) VALUES (
                proof_record.id,
                proof_record.submission_id,
                (SELECT order_id FROM submissions WHERE id = proof_record.submission_id),
                'flagged',
                'pending',
                'flagged',
                'Auto-flagged by system: ' || array_to_string(flag_reasons, ', '),
                json_build_object(
                    'auto_flagged', true,
                    'flag_reasons', flag_reasons,
                    'ai_confidence', proof_record.ai_confidence_score
                )
            );
            
            flagged_count := flagged_count + 1;
        END IF;
    END LOOP;
    
    RETURN flagged_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS FOR MANUAL PAYMENT SYSTEM
-- ============================================================================

-- Trigger to update updated_at on payment_methods
CREATE TRIGGER trigger_payment_methods_updated_at
    BEFORE UPDATE ON payment_methods
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at on payment_proofs
CREATE TRIGGER trigger_payment_proofs_updated_at
    BEFORE UPDATE ON payment_proofs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to log verification status changes
CREATE OR REPLACE FUNCTION log_verification_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if verification_status actually changed
    IF OLD.verification_status IS DISTINCT FROM NEW.verification_status THEN
        INSERT INTO verification_logs (
            payment_proof_id,
            submission_id,
            order_id,
            action,
            previous_status,
            new_status,
            notes
        ) VALUES (
            NEW.id,
            NEW.submission_id,
            (SELECT order_id FROM submissions WHERE id = NEW.submission_id),
            CASE NEW.verification_status
                WHEN 'approved' THEN 'approved'
                WHEN 'rejected' THEN 'rejected'
                WHEN 'flagged' THEN 'flagged'
                ELSE 'reviewed'
            END,
            OLD.verification_status,
            NEW.verification_status,
            COALESCE(NEW.manual_review_notes, NEW.rejection_reason, 'Status changed')
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_payment_proofs_status_change
    AFTER UPDATE ON payment_proofs
    FOR EACH ROW
    EXECUTE FUNCTION log_verification_status_change();

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES FOR MANUAL PAYMENT SYSTEM
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_verification_jobs ENABLE ROW LEVEL SECURITY;

-- Payment methods policies
CREATE POLICY "Users can manage own payment methods" ON payment_methods
    FOR ALL USING (auth.uid() = user_id);

-- Payment proofs policies
CREATE POLICY "Order owners can view payment proofs" ON payment_proofs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM submissions s
            JOIN orders o ON o.id = s.order_id
            WHERE s.id = payment_proofs.submission_id 
            AND o.user_id = auth.uid()
        )
    );

CREATE POLICY "Anyone can upload payment proofs" ON payment_proofs
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM submissions s
            JOIN orders o ON o.id = s.order_id
            WHERE s.id = submission_id 
            AND o.is_active = true 
            AND o.deadline > NOW()
        )
    );

CREATE POLICY "Order owners can update payment proofs" ON payment_proofs
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM submissions s
            JOIN orders o ON o.id = s.order_id
            WHERE s.id = payment_proofs.submission_id 
            AND o.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage payment proofs" ON payment_proofs
    FOR ALL USING (auth.role() = 'service_role');

-- Verification logs policies
CREATE POLICY "Order owners can view verification logs" ON verification_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders o
            WHERE o.id = verification_logs.order_id 
            AND o.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage verification logs" ON verification_logs
    FOR ALL USING (auth.role() = 'service_role');

-- Bulk verification jobs policies
CREATE POLICY "Users can manage own bulk jobs" ON bulk_verification_jobs
    FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- STORAGE SETUP FOR PAYMENT PROOFS (Enhanced)
-- ============================================================================

-- Update storage policies for payment proofs with better security
DROP POLICY IF EXISTS "Order owners can view payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage payment proofs" ON storage.objects;

-- Enhanced storage policies
CREATE POLICY "Authenticated users can upload payment proofs" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'payment-proofs' 
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "Order owners can view payment proofs" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'payment-proofs' 
        AND (
            auth.role() = 'service_role'
            OR EXISTS (
                SELECT 1 FROM payment_proofs pp
                JOIN submissions s ON s.id = pp.submission_id
                JOIN orders o ON o.id = s.order_id
                WHERE pp.file_url LIKE '%' || name || '%'
                AND o.user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Service role can manage all payment proofs" ON storage.objects
    FOR ALL USING (bucket_id = 'payment-proofs' AND auth.role() = 'service_role');

-- ============================================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- ============================================================================

-- Composite indexes for common queries
CREATE INDEX idx_payment_proofs_verification_queue 
    ON payment_proofs(verification_status, created_at DESC) 
    WHERE verification_status IN ('pending', 'flagged', 'requires_review');

CREATE INDEX idx_payment_proofs_ai_analysis 
    ON payment_proofs(ai_confidence_score DESC, verification_status) 
    WHERE verification_status = 'pending';

CREATE INDEX idx_verification_logs_audit_trail 
    ON verification_logs(order_id, created_at DESC);

-- Partial indexes for active payment methods
CREATE INDEX idx_payment_methods_active_by_user 
    ON payment_methods(user_id, sort_order) 
    WHERE is_active = true;

-- ============================================================================
-- MANUAL PAYMENT SYSTEM SETUP COMPLETE
-- ============================================================================

-- Insert default payment method configurations for common Southeast Asian methods
-- This helps GOMs get started quickly with pre-configured options

-- Default configurations will be inserted via API when users first access payment methods
-- to ensure proper user association and customization

-- End of manual payment system schema
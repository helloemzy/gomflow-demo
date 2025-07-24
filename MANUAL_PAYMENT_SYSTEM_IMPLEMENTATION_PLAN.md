# GOMFLOW Manual Payment System - Complete Implementation Plan

## Executive Summary

This document outlines the complete implementation of GOMFLOW's manual payment verification system, designed to replace automated payment gateway integration with a user-friendly manual process. The system enables Group Order Managers (GOMs) to accept multiple Southeast Asian payment methods while maintaining the core value proposition of 95% time reduction through automated workflow management.

## System Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   GOM Creates   │    │   Buyer Submits  │    │ Smart Agent AI  │
│   Order with    │───►│   Order & Pays   │───►│ Processes       │
│ Payment Methods │    │   Manually       │    │ Screenshot      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Payment Methods │    │ Screenshot       │    │ GOM Gets        │
│ UI Component    │    │ Upload System    │    │ Notification    │
│ (Cards/Toggle)  │    │ (File Storage)   │    │ & Verifies      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Core Features to Implement

### 1. Payment Methods Selection Interface
- **Visual card-based selection** for 20+ Southeast Asian payment methods
- **Custom payment method addition** with flexible configuration
- **Country-specific filtering** and popular methods prioritization
- **Account details management** per payment method

### 2. Manual Payment Flow
- **Buyer selects payment method** from GOM's accepted options
- **Dynamic payment instructions** generation based on selected method
- **Screenshot upload system** with file validation and storage
- **Smart Agent processing** for automatic payment detail extraction

### 3. GOM Verification System
- **Real-time notifications** when payment proof uploaded
- **Smart Agent analysis results** with confidence scoring
- **One-click verification interface** with approve/reject options
- **Automated buyer confirmation** after GOM verification

---

# IMPLEMENTATION TASKS

## TASK 1: Database Schema Extensions
**Duration:** 2-3 hours  
**Agent Requirements:** 1 Database Agent  
**Priority:** HIGH (Foundation for all other tasks)

### Subtask 1.1: Payment Methods Table Creation
**Agent:** Database Agent  
**Estimated Time:** 45 minutes

**Requirements:**
- Create `payment_methods` table to store GOM's accepted payment methods
- Create `custom_payment_methods` table for user-defined methods
- Add foreign key relationships to existing schema
- Implement RLS policies for data security

**Deliverables:**
```sql
-- payment_methods table
CREATE TABLE payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    method_type TEXT NOT NULL, -- 'gcash', 'paymaya', 'bpi_transfer', 'custom'
    method_name TEXT NOT NULL, -- Display name
    account_details JSONB NOT NULL DEFAULT '{}', -- Account number, name, etc.
    instructions TEXT, -- Payment instructions for buyers
    is_enabled BOOLEAN DEFAULT true,
    country_code country_code NOT NULL,
    is_custom BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, method_type)
);
```

**Database Indexes:**
- `idx_payment_methods_user_enabled` ON (user_id, is_enabled)
- `idx_payment_methods_country` ON (country_code, method_type)

**RLS Policies:**
- Users can manage own payment methods
- Service role full access
- Public read access for active methods

### Subtask 1.2: Order Payment Methods Junction Table
**Agent:** Database Agent  
**Estimated Time:** 30 minutes

**Requirements:**
- Create junction table linking orders to accepted payment methods
- Enable multiple payment methods per order
- Store method-specific instructions per order

**Deliverables:**
```sql
CREATE TABLE order_payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    payment_method_id UUID NOT NULL REFERENCES payment_methods(id) ON DELETE CASCADE,
    custom_instructions TEXT, -- Order-specific instructions
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(order_id, payment_method_id)
);
```

### Subtask 1.3: Payment Verification Workflow Tables
**Agent:** Database Agent  
**Estimated Time:** 60 minutes

**Requirements:**
- Extend `submissions` table with payment verification fields
- Create `payment_verifications` table for GOM approval tracking
- Add Smart Agent analysis results storage

**Deliverables:**
```sql
-- Add columns to existing submissions table
ALTER TABLE submissions ADD COLUMN selected_payment_method_id UUID REFERENCES payment_methods(id);
ALTER TABLE submissions ADD COLUMN payment_instructions_sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE submissions ADD COLUMN verification_status TEXT DEFAULT 'pending'; -- 'pending', 'approved', 'rejected', 'requires_review'
ALTER TABLE submissions ADD COLUMN verified_by UUID REFERENCES profiles(user_id);
ALTER TABLE submissions ADD COLUMN verified_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE submissions ADD COLUMN verification_notes TEXT;

-- Smart Agent processing results
CREATE TABLE payment_analysis_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    analysis_data JSONB NOT NULL DEFAULT '{}', -- AI analysis results
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00
    extracted_amount DECIMAL(10,2),
    extracted_reference TEXT,
    extracted_date TIMESTAMP WITH TIME ZONE,
    processing_status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    processing_error TEXT,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Subtask 1.4: Database Functions for Payment Workflow
**Agent:** Database Agent  
**Estimated Time:** 45 minutes

**Requirements:**
- Create functions for payment method management
- Create functions for verification workflow
- Add analytics functions for payment success rates

**Deliverables:**
```sql
-- Function to get payment methods for an order
CREATE OR REPLACE FUNCTION get_order_payment_methods(order_uuid UUID)
RETURNS JSON AS $$
-- Implementation details

-- Function to update verification status
CREATE OR REPLACE FUNCTION update_payment_verification(submission_uuid UUID, status TEXT, notes TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
-- Implementation details

-- Function to get verification queue for GOM
CREATE OR REPLACE FUNCTION get_verification_queue(user_uuid UUID)
RETURNS JSON AS $$
-- Implementation details
```

---

## TASK 2: Payment Methods Selection Interface
**Duration:** 4-5 hours  
**Agent Requirements:** 2 Agents (Frontend + Backend API)  
**Priority:** HIGH  
**Can Run Parallel With:** Task 3 (Smart Agent enhancements)

### Subtask 2.1: Payment Methods Constants and Types
**Agent:** Shared Types Agent  
**Estimated Time:** 30 minutes

**Requirements:**
- Define TypeScript interfaces for all payment method types
- Create constants for Southeast Asian payment methods
- Add validation schemas for account details

**Deliverables:**
```typescript
// gomflow-shared/src/types/paymentMethods.ts
export interface PaymentMethod {
    id: string;
    userId: string;
    methodType: PaymentMethodType;
    methodName: string;
    accountDetails: PaymentAccountDetails;
    instructions: string;
    isEnabled: boolean;
    countryCode: CountryCode;
    isCustom: boolean;
    displayOrder: number;
}

export type PaymentMethodType = 
    // Philippines
    | 'gcash' | 'paymaya' | 'bpi_transfer' | 'bdo_transfer' 
    | 'metrobank' | 'unionbank' | 'seven_eleven' | 'cebuana'
    // Malaysia  
    | 'touch_n_go' | 'grabpay' | 'boost' | 'shopee_pay'
    | 'maybank' | 'cimb' | 'public_bank' | 'hong_leong'
    // Regional
    | 'international_transfer' | 'western_union' | 'wise' | 'remitly'
    // Traditional
    | 'cash_on_delivery' | 'bank_deposit' | 'money_transfer'
    // Custom
    | 'custom';

export interface PaymentAccountDetails {
    accountNumber?: string;
    accountName?: string;
    phoneNumber?: string;
    emailAddress?: string;
    bankCode?: string;
    branchCode?: string;
    swiftCode?: string;
    customFields?: Record<string, string>;
}
```

### Subtask 2.2: Backend API for Payment Methods Management
**Agent:** Backend API Agent  
**Estimated Time:** 2 hours

**Requirements:**
- Create CRUD API endpoints for payment methods management
- Implement payment method templates and validation
- Add endpoints for order payment method association

**Deliverables:**
```typescript
// gomflow-core/src/app/api/payment-methods/route.ts
// GET /api/payment-methods - Get user's payment methods
// POST /api/payment-methods - Create new payment method
// PUT /api/payment-methods/[id] - Update payment method
// DELETE /api/payment-methods/[id] - Delete payment method

// gomflow-core/src/app/api/payment-methods/templates/route.ts
// GET /api/payment-methods/templates - Get payment method templates by country

// gomflow-core/src/app/api/orders/[id]/payment-methods/route.ts
// GET /api/orders/[id]/payment-methods - Get order's accepted payment methods
// POST /api/orders/[id]/payment-methods - Set order's accepted payment methods
```

**Key Functions:**
- `validatePaymentMethodData(method: PaymentMethod): ValidationResult`
- `generatePaymentInstructions(method: PaymentMethod, order: Order): string`
- `getPaymentMethodsByCountry(country: CountryCode): PaymentMethodTemplate[]`

### Subtask 2.3: Payment Methods Selection UI Component
**Agent:** Frontend UI Agent  
**Estimated Time:** 2.5 hours

**Requirements:**
- Create responsive card-based payment method selector
- Implement country-specific filtering
- Add custom payment method creation modal
- Include account details forms with validation

**Deliverables:**
```typescript
// gomflow-core/src/components/PaymentMethodsSelector.tsx
interface PaymentMethodsSelectorProps {
    countryCode: CountryCode;
    selectedMethods: string[];
    onMethodsChange: (methods: string[]) => void;
    onCustomMethodAdd: (method: CustomPaymentMethod) => void;
}

// gomflow-core/src/components/PaymentMethodCard.tsx
interface PaymentMethodCardProps {
    method: PaymentMethodTemplate;
    isSelected: boolean;
    onToggle: (methodId: string) => void;
    onConfigure: (methodId: string, config: PaymentAccountDetails) => void;
}

// gomflow-core/src/components/CustomPaymentMethodModal.tsx
interface CustomPaymentMethodModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (method: CustomPaymentMethod) => void;
    countryCode: CountryCode;
}
```

**UI Features:**
- **Visual payment method cards** with logos and descriptions
- **Toggle switches** for enable/disable per method
- **Configuration modals** for account details input
- **Drag & drop reordering** for display priority
- **Search/filter functionality** for large payment method lists
- **Validation feedback** for account details
- **Preview of buyer instructions** for each method

---

## TASK 3: Smart Agent Payment Processing Enhancement
**Duration:** 3-4 hours  
**Agent Requirements:** 1 AI/ML Agent  
**Priority:** HIGH  
**Can Run Parallel With:** Task 2

### Subtask 3.1: Payment Screenshot Analysis Enhancement
**Agent:** AI/ML Agent  
**Estimated Time:** 2 hours

**Requirements:**
- Enhance GPT-4 Vision prompts for Southeast Asian payment apps
- Add OCR preprocessing for common payment app UI elements
- Implement confidence scoring for analysis results
- Add support for multiple languages (English, Filipino, Malay)

**Deliverables:**
```typescript
// gomflow-smart-agent/src/services/paymentAnalysisService.ts
interface PaymentAnalysisResult {
    confidence: number; // 0.0 to 1.0
    extractedData: {
        amount: number | null;
        currency: string | null;
        referenceNumber: string | null;
        transactionDate: Date | null;
        paymentMethod: string | null;
        recipientName: string | null;
        recipientAccount: string | null;
    };
    rawAnalysis: string;
    processingTime: number;
    errors: string[];
}

class PaymentAnalysisService {
    async analyzePaymentScreenshot(
        imageBuffer: Buffer,
        expectedPaymentMethod: PaymentMethodType,
        expectedAmount: number,
        orderContext: OrderContext
    ): Promise<PaymentAnalysisResult> {
        // Implementation
    }

    private generateAnalysisPrompt(
        paymentMethod: PaymentMethodType,
        expectedAmount: number,
        currency: string
    ): string {
        // Specialized prompts for different payment apps
    }

    private preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
        // Image enhancement for better OCR results
    }
}
```

**GPT-4 Vision Prompts by Payment Method:**
- **GCash:** "Analyze this GCash payment screenshot. Extract transaction amount, reference number, recipient details, and timestamp. Look for the blue GCash interface..."
- **PayMaya:** "Analyze this PayMaya payment confirmation. Look for the purple interface with Maya branding..."
- **Bank Transfers:** "Analyze this online banking screenshot for transfer confirmation..."

### Subtask 3.2: Analysis Results Processing Pipeline
**Agent:** AI/ML Agent  
**Estimated Time:** 1.5 hours

**Requirements:**
- Create processing queue for payment screenshot analysis
- Implement retry logic for failed analyses
- Add analysis results caching to avoid reprocessing
- Create webhook system for notifying GOM of analysis completion

**Deliverables:**
```typescript
// gomflow-smart-agent/src/processors/paymentAnalysisQueue.ts
class PaymentAnalysisQueue {
    async processSubmission(submissionId: string): Promise<void> {
        // Queue management for screenshot processing
    }

    async retryFailedAnalysis(submissionId: string): Promise<void> {
        // Retry logic with exponential backoff
    }

    private async notifyGOMOfResults(
        submissionId: string, 
        results: PaymentAnalysisResult
    ): Promise<void> {
        // Send notification to GOM via preferred channel
    }
}
```

### Subtask 3.3: Analysis Confidence Scoring System
**Agent:** AI/ML Agent  
**Estimated Time:** 30 minutes

**Requirements:**
- Implement confidence scoring algorithm
- Define thresholds for auto-approval vs manual review
- Add machine learning feedback loop for improving accuracy

**Deliverables:**
```typescript
interface ConfidenceThresholds {
    autoApprove: 0.95; // Auto-approve if confidence >= 95%
    requiresReview: 0.70; // Manual review if 70% <= confidence < 95%
    autoReject: 0.30; // Auto-reject if confidence < 30%
}

class ConfidenceScorer {
    calculateConfidence(
        extractedData: ExtractedPaymentData,
        expectedData: ExpectedPaymentData
    ): number {
        // Scoring algorithm based on data match accuracy
    }

    shouldAutoApprove(confidence: number): boolean {
        return confidence >= 0.95;
    }

    requiresManualReview(confidence: number): boolean {
        return confidence >= 0.70 && confidence < 0.95;
    }
}
```

---

## TASK 4: Buyer Payment Flow Implementation
**Duration:** 4-5 hours  
**Agent Requirements:** 2 Agents (Frontend + Backend)  
**Priority:** HIGH  
**Dependencies:** Task 1 (Database), Task 2 (Payment Methods)

### Subtask 4.1: Order Submission API Enhancement
**Agent:** Backend API Agent  
**Estimated Time:** 1.5 hours

**Requirements:**
- Extend order submission API to include payment method selection
- Generate dynamic payment instructions based on selected method
- Create file upload endpoint for payment screenshots
- Implement submission status tracking

**Deliverables:**
```typescript
// gomflow-core/src/app/api/orders/[id]/submit/route.ts
interface OrderSubmissionData {
    buyerDetails: BuyerDetails;
    quantity: number;
    selectedPaymentMethodId: string;
    paymentScreenshot?: File;
    specialInstructions?: string;
}

interface SubmissionResponse {
    submissionId: string;
    paymentInstructions: {
        method: PaymentMethod;
        instructions: string;
        accountDetails: PaymentAccountDetails;
        deadline: Date;
    };
    uploadInstructions: {
        uploadUrl: string;
        maxFileSize: number;
        acceptedFormats: string[];
    };
}

// POST /api/orders/[id]/submit
async function submitOrder(orderData: OrderSubmissionData): Promise<SubmissionResponse>

// POST /api/submissions/[id]/payment-proof
async function uploadPaymentProof(submissionId: string, file: File): Promise<UploadResponse>
```

### Subtask 4.2: Payment Instructions Generation
**Agent:** Backend API Agent  
**Estimated Time:** 1 hour

**Requirements:**
- Create dynamic payment instruction templates
- Include GOM account details and order-specific information
- Add QR code generation for mobile wallets
- Generate unique reference numbers for tracking

**Deliverables:**
```typescript
// gomflow-core/src/lib/paymentInstructionsGenerator.ts
class PaymentInstructionsGenerator {
    generateInstructions(
        paymentMethod: PaymentMethod,
        order: Order,
        submission: OrderSubmission
    ): PaymentInstructions {
        // Generate method-specific instructions
    }

    private generateGCashInstructions(method: PaymentMethod, amount: number): string {
        return `
        💰 GCash Payment Instructions
        
        1. Open your GCash app
        2. Send Money to: ${method.accountDetails.phoneNumber}
        3. Account Name: ${method.accountDetails.accountName}
        4. Amount: ₱${amount.toFixed(2)}
        5. Reference: ${this.generateReferenceNumber()}
        6. Take a screenshot of the confirmation
        7. Upload the screenshot below
        
        ⚠️ Important: Do not close the confirmation screen until you upload the screenshot!
        `;
    }

    private generateReferenceNumber(): string {
        // Generate unique reference for tracking
    }
}
```

### Subtask 4.3: Buyer Payment Flow UI
**Agent:** Frontend UI Agent  
**Estimated Time:** 2.5 hours

**Requirements:**
- Create multi-step payment flow interface
- Display payment method selection with visual cards
- Show dynamic payment instructions with copy-to-clipboard
- Implement drag-and-drop screenshot upload with preview
- Add progress tracking and status updates

**Deliverables:**
```typescript
// gomflow-core/src/app/order/[id]/pay/page.tsx
interface PaymentFlowProps {
    orderId: string;
    submissionId: string;
}

// Components:
// 1. PaymentMethodSelector - Choose from GOM's accepted methods
// 2. PaymentInstructions - Dynamic instructions with account details  
// 3. PaymentProofUpload - Screenshot upload with validation
// 4. PaymentConfirmation - Success page with tracking info

// gomflow-core/src/components/PaymentProofUpload.tsx
interface PaymentProofUploadProps {
    submissionId: string;
    onUploadComplete: (result: UploadResult) => void;
    maxFileSize: number;
    acceptedFormats: string[];
}
```

**UI Flow:**
1. **Step 1:** Select payment method from available options
2. **Step 2:** View payment instructions with account details
3. **Step 3:** Complete payment outside the platform
4. **Step 4:** Upload payment screenshot
5. **Step 5:** Confirmation and tracking information

---

## TASK 5: GOM Verification Dashboard
**Duration:** 3-4 hours  
**Agent Requirements:** 2 Agents (Frontend + Backend)  
**Priority:** HIGH  
**Dependencies:** Task 1, Task 3, Task 4

### Subtask 5.1: Verification Queue API
**Agent:** Backend API Agent  
**Estimated Time:** 1.5 hours

**Requirements:**
- Create API endpoints for GOM verification workflow
- Implement bulk verification actions
- Add verification statistics and analytics
- Create notification system for new payment proofs

**Deliverables:**
```typescript
// gomflow-core/src/app/api/verifications/queue/route.ts
interface VerificationQueueItem {
    submissionId: string;
    orderId: string;
    orderTitle: string;
    buyerName: string;
    buyerEmail: string;
    amount: number;
    currency: string;
    paymentMethod: PaymentMethod;
    paymentProofUrl: string;
    submittedAt: Date;
    analysisResults?: PaymentAnalysisResult;
    priority: 'high' | 'medium' | 'low';
}

// GET /api/verifications/queue - Get pending verifications
// POST /api/verifications/[id]/approve - Approve payment
// POST /api/verifications/[id]/reject - Reject payment with reason
// POST /api/verifications/bulk - Bulk verification actions
// GET /api/verifications/stats - Verification statistics
```

### Subtask 5.2: Smart Agent Integration for Verification
**Agent:** Backend API Agent  
**Estimated Time:** 1 hour

**Requirements:**
- Integrate Smart Agent analysis results into verification queue
- Display confidence scores and extracted payment data
- Add manual override options for AI recommendations
- Implement feedback system to improve AI accuracy

**Deliverables:**
```typescript
// gomflow-core/src/lib/verificationService.ts
class VerificationService {
    async getAnalysisResults(submissionId: string): Promise<PaymentAnalysisResult> {
        // Fetch AI analysis results
    }

    async approvePayment(
        submissionId: string, 
        gomId: string, 
        notes?: string
    ): Promise<VerificationResult> {
        // Approve payment and trigger notifications
    }

    async rejectPayment(
        submissionId: string, 
        gomId: string, 
        reason: string
    ): Promise<VerificationResult> {
        // Reject payment and notify buyer
    }

    async provideFeedback(
        submissionId: string,
        aiWasCorrect: boolean,
        actualData: ExtractedPaymentData
    ): Promise<void> {
        // Send feedback to Smart Agent for ML improvement
    }
}
```

### Subtask 5.3: GOM Verification Dashboard UI
**Agent:** Frontend UI Agent  
**Estimated Time:** 2 hours

**Requirements:**
- Create verification queue dashboard with filters and sorting
- Display payment screenshots with analysis overlay
- Implement one-click approve/reject actions
- Add bulk actions for multiple verifications
- Show verification statistics and performance metrics

**Deliverables:**
```typescript
// gomflow-core/src/app/dashboard/verifications/page.tsx
interface VerificationDashboardProps {
    gomId: string;
}

// Components:
// 1. VerificationQueue - List of pending verifications
// 2. PaymentAnalysisCard - Display AI analysis results
// 3. PaymentScreenshotViewer - Image viewer with analysis overlay
// 4. VerificationActions - Approve/reject buttons with notes
// 5. VerificationStats - Analytics and performance metrics

// gomflow-core/src/components/PaymentAnalysisCard.tsx
interface PaymentAnalysisCardProps {
    analysisResults: PaymentAnalysisResult;
    expectedAmount: number;
    expectedMethod: PaymentMethod;
    onApprove: () => void;
    onReject: (reason: string) => void;
}
```

**Dashboard Features:**
- **Real-time updates** when new payment proofs uploaded
- **Filter options** by date, amount, payment method, confidence score
- **Bulk selection** for mass approve/reject actions
- **AI analysis overlay** on payment screenshots
- **Quick actions** with keyboard shortcuts
- **Statistics widgets** showing approval rates, average processing time

---

## TASK 6: Notification System Integration
**Duration:** 2-3 hours  
**Agent Requirements:** 2 Agents (Backend + Messaging)  
**Priority:** MEDIUM  
**Can Run Parallel With:** Tasks 4 and 5

### Subtask 6.1: Payment Workflow Notifications
**Agent:** Backend API Agent  
**Estimated Time:** 1.5 hours

**Requirements:**
- Create notification triggers for each payment workflow step
- Implement multi-channel notification delivery (WhatsApp, Telegram, Discord, Email)
- Add notification preferences management
- Create notification templates for payment-related events

**Deliverables:**
```typescript
// gomflow-core/src/lib/paymentNotifications.ts
interface PaymentNotificationEvents {
    PAYMENT_PROOF_UPLOADED: 'payment_proof_uploaded';
    PAYMENT_APPROVED: 'payment_approved';
    PAYMENT_REJECTED: 'payment_rejected';
    PAYMENT_REQUIRES_REVIEW: 'payment_requires_review';
    PAYMENT_DEADLINE_REMINDER: 'payment_deadline_reminder';
}

class PaymentNotificationService {
    async notifyPaymentProofUploaded(
        gomId: string, 
        submission: OrderSubmission
    ): Promise<void> {
        // Notify GOM that new payment proof needs verification
    }

    async notifyPaymentApproved(
        buyerEmail: string, 
        orderDetails: Order
    ): Promise<void> {
        // Notify buyer that payment was approved
    }

    async notifyPaymentRejected(
        buyerEmail: string, 
        orderDetails: Order, 
        reason: string
    ): Promise<void> {
        // Notify buyer that payment was rejected with reason
    }
}
```

### Subtask 6.2: Bot Integration for Payment Notifications
**Agent:** Messaging Bot Agent  
**Estimated Time:** 1 hour

**Requirements:**
- Extend existing bots (WhatsApp, Telegram, Discord) with payment notifications
- Add payment verification commands for GOMs
- Create buyer payment status check commands
- Implement notification delivery confirmation

**Deliverables:**
```typescript
// gomflow-telegram/src/commands/paymentCommands.ts
class PaymentCommands {
    async handleVerificationQueue(ctx: Context): Promise<void> {
        // Show GOM their pending payment verifications
    }

    async handleQuickApprove(ctx: Context, submissionId: string): Promise<void> {
        // Quick approve payment from Telegram
    }

    async handlePaymentStatus(ctx: Context, orderId: string): Promise<void> {
        // Show buyer their payment status
    }
}

// gomflow-discord/src/commands/paymentSlashCommands.ts
// Similar implementation for Discord slash commands

// gomflow-whatsapp/src/handlers/paymentHandlers.ts  
// WhatsApp Business API integration for payment notifications
```

### Subtask 6.3: Email Notification Templates
**Agent:** Backend API Agent  
**Estimated Time:** 30 minutes

**Requirements:**
- Create professional email templates for payment workflow
- Add email templates for different notification types
- Implement email template personalization
- Add unsubscribe management

**Deliverables:**
```html
<!-- Payment Proof Uploaded Template -->
<div class="email-template">
    <h2>💰 New Payment Proof - Action Required</h2>
    <p>Hi {{gom_name}},</p>
    <p>{{buyer_name}} has uploaded payment proof for order "{{order_title}}".</p>
    
    <div class="order-details">
        <p><strong>Amount:</strong> {{amount}} {{currency}}</p>
        <p><strong>Payment Method:</strong> {{payment_method}}</p>
        <p><strong>AI Confidence:</strong> {{confidence_score}}%</p>
    </div>
    
    <div class="action-buttons">
        <a href="{{verification_url}}" class="btn btn-primary">Review & Verify</a>
    </div>
</div>

<!-- Payment Approved Template -->
<!-- Payment Rejected Template -->
<!-- Payment Deadline Reminder Template -->
```

---

## TASK 7: Testing and Quality Assurance
**Duration:** 3-4 hours  
**Agent Requirements:** 2 Agents (Testing + Integration)  
**Priority:** HIGH  
**Dependencies:** All previous tasks

### Subtask 7.1: Unit Testing for Payment Components
**Agent:** Testing Agent  
**Estimated Time:** 2 hours

**Requirements:**
- Create unit tests for all payment-related functions
- Test payment method validation and configuration
- Test Smart Agent analysis processing
- Test notification delivery systems

**Deliverables:**
```typescript
// __tests__/paymentMethods.test.ts
describe('Payment Methods Management', () => {
    test('should validate GCash account details', () => {
        // Test GCash validation logic
    });
    
    test('should generate correct payment instructions', () => {
        // Test instruction generation
    });
    
    test('should handle custom payment methods', () => {
        // Test custom method creation and validation
    });
});

// __tests__/smartAgent.test.ts
describe('Smart Agent Payment Analysis', () => {
    test('should extract payment data from GCash screenshot', () => {
        // Test AI analysis with mock data
    });
    
    test('should assign correct confidence scores', () => {
        // Test confidence scoring algorithm
    });
});

// __tests__/verificationWorkflow.test.ts
describe('Payment Verification Workflow', () => {
    test('should approve payment and send notifications', () => {
        // Test approval workflow
    });
    
    test('should handle payment rejection correctly', () => {
        // Test rejection workflow with reason
    });
});
```

### Subtask 7.2: End-to-End Testing
**Agent:** Integration Testing Agent  
**Estimated Time:** 2 hours

**Requirements:**
- Test complete buyer payment flow from order to verification
- Test GOM verification workflow with different scenarios
- Test notification delivery across all channels
- Test error handling and edge cases

**Deliverables:**
```typescript
// __tests__/e2e/paymentFlow.test.ts
describe('Complete Payment Flow', () => {
    test('Buyer can select payment method and upload proof', async () => {
        // 1. Create order with payment methods
        // 2. Submit order as buyer
        // 3. Select payment method
        // 4. Upload payment screenshot
        // 5. Verify submission status
    });
    
    test('GOM receives notification and can verify payment', async () => {
        // 1. Receive notification about new payment proof
        // 2. View verification queue
        // 3. Review AI analysis results
        // 4. Approve/reject payment
        // 5. Verify buyer receives confirmation
    });
    
    test('Smart Agent processes payment screenshot correctly', async () => {
        // 1. Upload payment screenshot
        // 2. Wait for AI processing
        // 3. Verify analysis results
        // 4. Check confidence scoring
    });
});
```

---

## TASK 8: Documentation and Deployment
**Duration:** 2-3 hours  
**Agent Requirements:** 1 Documentation Agent  
**Priority:** MEDIUM  
**Can Run Parallel With:** Task 7

### Subtask 8.1: User Documentation
**Agent:** Documentation Agent  
**Estimated Time:** 1.5 hours

**Requirements:**
- Create GOM guide for setting up payment methods
- Create buyer guide for payment process
- Create troubleshooting guide for common issues
- Create video tutorials for key workflows

**Deliverables:**
- `GOM_PAYMENT_SETUP_GUIDE.md` - Complete guide for GOMs
- `BUYER_PAYMENT_GUIDE.md` - Step-by-step buyer instructions
- `PAYMENT_TROUBLESHOOTING.md` - Common issues and solutions
- Video tutorials (5-10 minutes each):
  - "Setting Up Payment Methods as a GOM"
  - "How to Pay for Group Orders"
  - "Verifying Payments as a GOM"

### Subtask 8.2: Technical Documentation
**Agent:** Documentation Agent  
**Estimated Time:** 1 hour

**Requirements:**
- Update API documentation with payment endpoints
- Document database schema changes
- Create deployment guide for manual payment system
- Update system architecture documentation

**Deliverables:**
- `API_DOCUMENTATION_PAYMENT.md` - Complete API reference
- `DATABASE_SCHEMA_PAYMENT.md` - Schema documentation
- `DEPLOYMENT_GUIDE_MANUAL_PAYMENT.md` - Deployment instructions
- Updated system architecture diagrams

---

## PARALLEL EXECUTION PLAN

### Phase 1: Foundation (Can Run in Parallel)
**Duration:** 2-3 hours
- **Agent 1:** Database Schema Extensions (Task 1)
- **Agent 2:** Payment Methods Constants and Types (Task 2.1)
- **Agent 3:** Smart Agent Enhancement Planning (Task 3.1 preparation)

### Phase 2: Core Development (Can Run in Parallel)
**Duration:** 4-5 hours
- **Agent 1:** Backend API Development (Task 2.2 + Task 4.1)
- **Agent 2:** Frontend UI Development (Task 2.3 + Task 4.3)
- **Agent 3:** Smart Agent Processing (Task 3.1 + Task 3.2)

### Phase 3: Integration and Verification (Sequential)
**Duration:** 3-4 hours
- **Task 5:** GOM Verification Dashboard (depends on previous tasks)
- **Task 6:** Notification System Integration
- **Task 7:** Testing and Quality Assurance

### Phase 4: Documentation and Deployment (Can Run Parallel with Phase 3)
**Duration:** 2-3 hours
- **Agent 1:** User Documentation (Task 8.1)
- **Agent 2:** Technical Documentation (Task 8.2)

## TOTAL IMPLEMENTATION TIMELINE

### Optimal Scenario (All Agents Working in Parallel):
- **Phase 1-2:** 4-5 hours (parallel execution)
- **Phase 3:** 3-4 hours (sequential)
- **Phase 4:** Running parallel with Phase 3
- **Total:** 7-9 hours

### Sequential Scenario (Single Developer):
- **Total:** 18-22 hours

## SUCCESS METRICS

### Technical Metrics:
- **Payment Method Setup Time:** < 2 minutes per method
- **Screenshot Analysis Accuracy:** > 85% confidence
- **Verification Time:** < 30 seconds per payment
- **System Response Time:** < 2 seconds for all operations

### Business Metrics:
- **GOM Time Savings:** From 2 hours to 10 minutes per payment batch
- **Payment Success Rate:** > 95% (with proper screenshots)
- **User Satisfaction:** > 4.5/5 stars for payment flow
- **Support Ticket Reduction:** 70% fewer payment-related issues

## RISK MITIGATION

### Technical Risks:
1. **AI Analysis Accuracy:** Implement manual override and feedback system
2. **File Upload Failures:** Add retry logic and multiple upload methods
3. **Notification Delivery:** Multiple channel fallbacks and delivery confirmation

### User Experience Risks:
1. **Complex Payment Setup:** Provide templates and one-click configurations
2. **Buyer Confusion:** Clear visual guides and progress indicators
3. **GOM Verification Overload:** Smart sorting and bulk actions

### Business Risks:
1. **Payment Disputes:** Clear audit trail and screenshot evidence
2. **Fraud Prevention:** Multi-layer verification and suspicious activity detection
3. **Compliance Issues:** Ensure no PCI requirements for manual system

---

This implementation plan provides a comprehensive roadmap for building GOMFLOW's manual payment verification system while maintaining the platform's core value proposition of automation and efficiency. The system balances automation (Smart Agent processing) with human oversight (GOM verification) to create a reliable and user-friendly payment workflow.
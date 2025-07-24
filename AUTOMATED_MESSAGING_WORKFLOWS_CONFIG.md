# GOMFLOW Automated Messaging Workflows Configuration

## Overview

This document defines the automated messaging workflows that provide the 95% time reduction for GOMs. These workflows are triggered by database events, time-based schedules, and Smart Agent processing results.

## Workflow Architecture

### Event-Driven System
```
Database Event → Queue → Message Router → Platform-Specific Service → Delivery
     ↓               ↓            ↓                    ↓                ↓
   Order Created  → Redis    → Core Logic    → Telegram/Discord   → User
   Payment Received          → Smart Routing  → WhatsApp          → Notification
   Deadline Near             → Template Engine → Email             → Confirmation
```

### Smart Agent Integration
```
Payment Screenshot → OCR/GPT-4 Vision → Database Update → Notification Trigger
        ↓                    ↓                ↓                 ↓
   User Upload        → Smart Agent     → Status Change  → Multi-Platform
   Image Analysis     → Confidence Score → Auto-Approval  → Notifications
   Error Handling     → Manual Review   → GOM Alert      → Real-time Updates
```

## Message Templates

### 1. Order Confirmation Messages

#### Telegram Template
```typescript
export const ORDER_CONFIRMATION_TELEGRAM = {
  PH: (data: OrderConfirmationData) => `
🎉 *Order Confirmed!*

📦 *Item:* ${data.title}
🔢 *Quantity:* ${data.quantity}
💰 *Total:* ₱${data.total_amount}
📧 *Reference:* \`${data.payment_reference}\`

💳 *Payment Instructions:*
${data.payment_instructions}

⏰ *Deadline:* ${data.deadline}
📱 *Order Status:* [Track Here](${data.order_url})

Questions? Type /help or contact your GOM.
  `,
  MY: (data: OrderConfirmationData) => `
🎉 *Order Confirmed!*

📦 *Item:* ${data.title}
🔢 *Quantity:* ${data.quantity}
💰 *Total:* RM${data.total_amount}
📧 *Reference:* \`${data.payment_reference}\`

💳 *Payment Instructions:*
${data.payment_instructions}

⏰ *Deadline:* ${data.deadline}
📱 *Order Status:* [Track Here](${data.order_url})

Questions? Type /help or contact your GOM.
  `
};
```

#### Discord Template
```typescript
export const ORDER_CONFIRMATION_DISCORD = {
  embed: (data: OrderConfirmationData) => ({
    color: 0x10B981, // Green
    title: '🎉 Order Confirmed!',
    description: `Your order for **${data.title}** has been confirmed.`,
    fields: [
      { name: '📦 Item', value: data.title, inline: true },
      { name: '🔢 Quantity', value: data.quantity.toString(), inline: true },
      { name: '💰 Total', value: formatCurrency(data.total_amount, data.currency), inline: true },
      { name: '📧 Reference', value: `\`${data.payment_reference}\``, inline: false },
      { name: '💳 Payment Instructions', value: data.payment_instructions, inline: false },
      { name: '⏰ Deadline', value: data.deadline, inline: true }
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 5,
            label: 'Track Order',
            url: data.order_url
          },
          {
            type: 2,
            style: 2,
            label: 'Upload Payment',
            custom_id: `upload_payment_${data.submission_id}`
          }
        ]
      }
    ],
    timestamp: new Date().toISOString()
  })
};
```

#### WhatsApp Template
```typescript
export const ORDER_CONFIRMATION_WHATSAPP = {
  PH: (data: OrderConfirmationData) => `
🎉 Order Confirmed!

Item: ${data.title}
Quantity: ${data.quantity}
Total: ₱${data.total_amount}
Reference: ${data.payment_reference}

Payment Instructions:
${data.payment_instructions}

Deadline: ${data.deadline}
Track: ${data.order_url}

Reply HELP for assistance.
  `,
  MY: (data: OrderConfirmationData) => `
🎉 Order Confirmed!

Item: ${data.title}
Quantity: ${data.quantity}
Total: RM${data.total_amount}
Reference: ${data.payment_reference}

Payment Instructions:
${data.payment_instructions}

Deadline: ${data.deadline}
Track: ${data.order_url}

Reply HELP for assistance.
  `
};
```

### 2. Payment Reminder Messages

#### Automated Reminder Logic
```typescript
export const PAYMENT_REMINDER_SCHEDULE = {
  // Send reminders at these intervals before deadline
  intervals: [
    { hours: 48, message: 'PAYMENT_REMINDER_48H' },
    { hours: 24, message: 'PAYMENT_REMINDER_24H' },
    { hours: 12, message: 'PAYMENT_REMINDER_12H' },
    { hours: 6, message: 'PAYMENT_REMINDER_6H' },
    { hours: 2, message: 'PAYMENT_REMINDER_2H' }
  ],
  
  // Don't send reminders if payment already received
  conditions: {
    skip_if_paid: true,
    skip_if_cancelled: true,
    max_reminders_per_day: 2
  }
};
```

#### Reminder Templates
```typescript
export const PAYMENT_REMINDER_TEMPLATES = {
  PAYMENT_REMINDER_24H: {
    telegram: (data: ReminderData) => `
⏰ *Payment Reminder - 24 Hours Left*

Hi ${data.buyer_name}! 👋

Your payment for **${data.title}** is due in 24 hours.

💰 *Amount:* ${formatCurrency(data.total_amount, data.currency)}
📧 *Reference:* \`${data.payment_reference}\`
⏰ *Deadline:* ${data.deadline}

💳 *Quick Payment Options:*
${data.payment_options}

Upload your payment proof here after paying, or use /pay command.

Don't miss out! 🏃‍♂️
    `,
    
    discord: (data: ReminderData) => ({
      color: 0xF59E0B, // Amber
      title: '⏰ Payment Reminder - 24 Hours Left',
      description: `Hi ${data.buyer_name}! Your payment is due soon.`,
      fields: [
        { name: '📦 Item', value: data.title, inline: false },
        { name: '💰 Amount', value: formatCurrency(data.total_amount, data.currency), inline: true },
        { name: '⏰ Deadline', value: data.deadline, inline: true },
        { name: '💳 Payment Options', value: data.payment_options, inline: false }
      ],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 1,
              label: 'Upload Payment',
              custom_id: `upload_payment_${data.submission_id}`
            },
            {
              type: 2,
              style: 5,
              label: 'Payment Instructions',
              url: data.payment_url
            }
          ]
        }
      ]
    }),
    
    whatsapp: (data: ReminderData) => `
⏰ Payment Reminder - 24 Hours Left

Hi ${data.buyer_name}!

Your payment for ${data.title} is due in 24 hours.

Amount: ${formatCurrency(data.total_amount, data.currency)}
Reference: ${data.payment_reference}
Deadline: ${data.deadline}

Payment Options:
${data.payment_options}

Send your payment proof after paying.
    `
  }
};
```

### 3. Smart Agent Processing Messages

#### Payment Confirmation Templates
```typescript
export const PAYMENT_CONFIRMATION_TEMPLATES = {
  SUCCESS: {
    telegram: (data: PaymentData) => `
✅ *Payment Confirmed!*

Your payment has been automatically verified and approved.

💰 *Amount:* ${formatCurrency(data.amount, data.currency)}
📧 *Reference:* \`${data.reference}\`
🤖 *Processed by:* Smart Agent
⏱️ *Processed at:* ${data.processed_at}

Your order is now confirmed! 🎉

Use /status to check your order details.
    `,
    
    discord: (data: PaymentData) => ({
      color: 0x10B981, // Green
      title: '✅ Payment Confirmed!',
      description: 'Your payment has been automatically verified and approved.',
      fields: [
        { name: '💰 Amount', value: formatCurrency(data.amount, data.currency), inline: true },
        { name: '📧 Reference', value: `\`${data.reference}\``, inline: true },
        { name: '🤖 Processed by', value: 'Smart Agent', inline: true },
        { name: '⏱️ Processed at', value: data.processed_at, inline: false }
      ],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 5,
              label: 'View Order',
              url: data.order_url
            }
          ]
        }
      ]
    }),
    
    whatsapp: (data: PaymentData) => `
✅ Payment Confirmed!

Your payment has been automatically verified.

Amount: ${formatCurrency(data.amount, data.currency)}
Reference: ${data.reference}
Processed: ${data.processed_at}

Your order is now confirmed! 🎉
    `
  },
  
  MANUAL_REVIEW: {
    telegram: (data: PaymentData) => `
🔍 *Payment Under Review*

We've received your payment proof and it's being reviewed by your GOM.

📧 *Reference:* \`${data.reference}\`
⏱️ *Submitted:* ${data.submitted_at}
👤 *Reviewer:* ${data.gom_name}

You'll receive a confirmation once approved (usually within 2-4 hours).

Use /status to check updates.
    `,
    
    whatsapp: (data: PaymentData) => `
🔍 Payment Under Review

Your payment is being reviewed by ${data.gom_name}.

Reference: ${data.reference}
Submitted: ${data.submitted_at}

You'll receive confirmation once approved.
    `
  }
};
```

### 4. GOM Notification Templates

#### New Submission Alerts
```typescript
export const GOM_NOTIFICATION_TEMPLATES = {
  NEW_SUBMISSION: {
    telegram: (data: SubmissionData) => `
🔔 *New Order Submission*

📦 *Order:* ${data.order_title}
👤 *Buyer:* ${data.buyer_name}
📱 *Contact:* ${data.buyer_contact}
🔢 *Quantity:* ${data.quantity}
💰 *Amount:* ${formatCurrency(data.total_amount, data.currency)}

📧 *Reference:* \`${data.payment_reference}\`
⏰ *Submitted:* ${data.submitted_at}

Use /manage ${data.order_id} to view details.
    `,
    
    discord: (data: SubmissionData) => ({
      color: 0x3B82F6, // Blue
      title: '🔔 New Order Submission',
      fields: [
        { name: '📦 Order', value: data.order_title, inline: false },
        { name: '👤 Buyer', value: data.buyer_name, inline: true },
        { name: '📱 Contact', value: data.buyer_contact, inline: true },
        { name: '🔢 Quantity', value: data.quantity.toString(), inline: true },
        { name: '💰 Amount', value: formatCurrency(data.total_amount, data.currency), inline: true },
        { name: '📧 Reference', value: `\`${data.payment_reference}\``, inline: false }
      ],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 1,
              label: 'View Details',
              custom_id: `view_submission_${data.submission_id}`
            },
            {
              type: 2,
              style: 3,
              label: 'Approve',
              custom_id: `approve_submission_${data.submission_id}`
            }
          ]
        }
      ]
    })
  },
  
  PAYMENT_RECEIVED: {
    telegram: (data: PaymentNotificationData) => `
💰 *Payment Received*

${data.auto_approved ? '🤖 *Auto-Approved by Smart Agent*' : '👀 *Requires Your Review*'}

📦 *Order:* ${data.order_title}
👤 *Buyer:* ${data.buyer_name}
💰 *Amount:* ${formatCurrency(data.amount, data.currency)}
📧 *Reference:* \`${data.reference}\`
🎯 *Confidence:* ${data.confidence_score}%

${data.auto_approved ? 
  'Payment has been automatically approved.' : 
  'Please review the payment proof and approve/reject.'}

Use /payments to review all pending payments.
    `,
    
    discord: (data: PaymentNotificationData) => ({
      color: data.auto_approved ? 0x10B981 : 0xF59E0B,
      title: data.auto_approved ? '💰 Payment Auto-Approved' : '💰 Payment Needs Review',
      fields: [
        { name: '📦 Order', value: data.order_title, inline: false },
        { name: '👤 Buyer', value: data.buyer_name, inline: true },
        { name: '💰 Amount', value: formatCurrency(data.amount, data.currency), inline: true },
        { name: '🎯 Confidence', value: `${data.confidence_score}%`, inline: true },
        { name: '📧 Reference', value: `\`${data.reference}\``, inline: false }
      ],
      components: data.auto_approved ? [] : [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 3,
              label: 'Approve',
              custom_id: `approve_payment_${data.submission_id}`
            },
            {
              type: 2,
              style: 4,
              label: 'Reject',
              custom_id: `reject_payment_${data.submission_id}`
            },
            {
              type: 2,
              style: 2,
              label: 'View Proof',
              custom_id: `view_proof_${data.submission_id}`
            }
          ]
        }
      ]
    })
  }
};
```

## Automated Workflow Triggers

### 1. Database Triggers
```typescript
export const DATABASE_TRIGGERS = {
  // Order events
  ORDER_CREATED: {
    trigger: 'orders.created',
    actions: [
      'send_order_announcement',
      'schedule_deadline_reminders',
      'notify_gom_new_order'
    ]
  },
  
  // Submission events
  SUBMISSION_CREATED: {
    trigger: 'submissions.created',
    actions: [
      'send_order_confirmation',
      'notify_gom_new_submission',
      'schedule_payment_reminders'
    ]
  },
  
  SUBMISSION_PAYMENT_UPDATED: {
    trigger: 'submissions.payment_status_changed',
    actions: [
      'send_payment_confirmation',
      'notify_gom_payment_received',
      'cancel_payment_reminders'
    ]
  },
  
  // Order completion
  ORDER_QUOTA_REACHED: {
    trigger: 'orders.quota_reached',
    actions: [
      'send_quota_reached_notifications',
      'close_order_submissions',
      'notify_gom_order_complete'
    ]
  }
};
```

### 2. Time-Based Triggers
```typescript
export const SCHEDULED_TRIGGERS = {
  PAYMENT_REMINDERS: {
    schedule: 'every 1 hour',
    action: 'check_upcoming_deadlines',
    conditions: {
      reminder_intervals: [48, 24, 12, 6, 2], // hours before deadline
      skip_if_paid: true,
      max_per_day: 2
    }
  },
  
  DEADLINE_WARNINGS: {
    schedule: 'every 30 minutes',
    action: 'check_approaching_deadlines',
    conditions: {
      warning_intervals: [6, 2, 1], // hours before deadline
      notify_goms: true,
      auto_close_after_deadline: true
    }
  },
  
  ORDER_STATUS_UPDATES: {
    schedule: 'every 15 minutes',
    action: 'broadcast_order_updates',
    conditions: {
      quota_thresholds: [25, 50, 75, 90, 100], // percentage filled
      update_channels: ['telegram', 'discord', 'whatsapp']
    }
  }
};
```

### 3. Smart Agent Triggers
```typescript
export const SMART_AGENT_TRIGGERS = {
  PAYMENT_PROCESSED: {
    trigger: 'smart_agent.payment_processed',
    conditions: {
      confidence_threshold: 85,
      auto_approve_above: 95,
      manual_review_below: 85
    },
    actions: {
      high_confidence: [
        'auto_approve_payment',
        'send_payment_confirmation',
        'notify_gom_auto_approval'
      ],
      low_confidence: [
        'flag_for_manual_review',
        'send_review_notification',
        'notify_gom_review_needed'
      ]
    }
  },
  
  OCR_FAILED: {
    trigger: 'smart_agent.ocr_failed',
    actions: [
      'request_clearer_image',
      'send_upload_guidance',
      'notify_gom_processing_issue'
    ]
  }
};
```

## Message Routing Logic

### 1. Platform Selection Algorithm
```typescript
export const MESSAGE_ROUTING = {
  priority_order: ['telegram', 'discord', 'whatsapp', 'email'],
  
  user_preferences: {
    // Route based on user's preferred platform
    check_user_settings: true,
    fallback_to_all: false,
    respect_quiet_hours: true
  },
  
  message_type_routing: {
    urgent: ['telegram', 'whatsapp'], // Immediate notifications
    reminders: ['telegram', 'discord', 'whatsapp'], // All platforms
    confirmations: ['telegram', 'discord'], // Interactive platforms
    announcements: ['telegram', 'discord'], // Community platforms
    gom_alerts: ['telegram', 'discord'] // Professional platforms
  },
  
  platform_capabilities: {
    telegram: {
      supports_buttons: true,
      supports_images: true,
      supports_files: true,
      max_message_length: 4096,
      supports_markdown: true
    },
    discord: {
      supports_embeds: true,
      supports_buttons: true,
      supports_modals: true,
      max_embed_length: 4096,
      supports_slash_commands: true
    },
    whatsapp: {
      supports_buttons: false,
      supports_images: true,
      supports_files: true,
      max_message_length: 1600,
      supports_templates: true
    }
  }
};
```

### 2. Message Queue Processing
```typescript
export const QUEUE_CONFIGURATION = {
  message_queues: {
    high_priority: {
      name: 'high-priority-messages',
      concurrency: 10,
      retry_attempts: 3,
      retry_delay: 5000,
      types: ['payment_confirmations', 'urgent_alerts']
    },
    normal_priority: {
      name: 'normal-messages',
      concurrency: 5,
      retry_attempts: 2,
      retry_delay: 10000,
      types: ['reminders', 'notifications']
    },
    bulk_messages: {
      name: 'bulk-messages',
      concurrency: 3,
      retry_attempts: 1,
      retry_delay: 15000,
      types: ['announcements', 'mass_notifications']
    }
  },
  
  processing_rules: {
    deduplication: true,
    max_retry_attempts: 3,
    dead_letter_queue: true,
    message_ttl: 86400000, // 24 hours
    batch_processing: {
      enabled: true,
      batch_size: 50,
      batch_timeout: 30000
    }
  }
};
```

## Smart Agent Workflow Configuration

### 1. Payment Processing Pipeline
```typescript
export const PAYMENT_PROCESSING_PIPELINE = {
  stages: [
    {
      name: 'image_validation',
      timeout: 10000,
      rules: {
        max_file_size: 20971520, // 20MB
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        min_dimensions: { width: 200, height: 200 }
      }
    },
    {
      name: 'ocr_extraction',
      timeout: 30000,
      service: 'google_vision',
      fallback: 'tesseract'
    },
    {
      name: 'gpt_analysis',
      timeout: 45000,
      model: 'gpt-4-vision-preview',
      confidence_threshold: 0.85
    },
    {
      name: 'data_validation',
      timeout: 5000,
      rules: {
        amount_tolerance: 0.01, // ±1 cent
        reference_format_validation: true,
        date_range_validation: true
      }
    },
    {
      name: 'decision_engine',
      timeout: 5000,
      rules: {
        auto_approve_threshold: 95,
        manual_review_threshold: 85,
        reject_threshold: 50
      }
    }
  ],
  
  error_handling: {
    retry_on_timeout: true,
    max_retries: 2,
    escalate_on_failure: true,
    fallback_to_manual: true
  }
};
```

### 2. Confidence Scoring Algorithm
```typescript
export const CONFIDENCE_SCORING = {
  factors: {
    amount_match: { weight: 30, threshold: 0.99 },
    reference_detected: { weight: 25, threshold: 0.90 },
    payment_method_identified: { weight: 20, threshold: 0.85 },
    date_validity: { weight: 15, threshold: 0.95 },
    image_quality: { weight: 10, threshold: 0.80 }
  },
  
  decision_matrix: {
    score_95_plus: 'auto_approve',
    score_85_94: 'conditional_approve',
    score_70_84: 'manual_review',
    score_below_70: 'reject_with_feedback'
  },
  
  feedback_messages: {
    low_quality: 'Please upload a clearer image of your payment proof.',
    amount_mismatch: 'The payment amount doesn\'t match your order total.',
    no_reference: 'Please ensure your payment reference is visible.',
    invalid_date: 'Payment date seems invalid or too old.'
  }
};
```

## Implementation Status

### Current Implementation ✅
- [x] Basic message templates for all platforms
- [x] Database trigger system
- [x] Queue-based message processing
- [x] Smart Agent integration framework
- [x] Multi-platform routing logic
- [x] Error handling and retry mechanisms

### Pending Implementation 🔄
- [ ] Advanced AI-powered message personalization
- [ ] Dynamic template selection based on user behavior
- [ ] Advanced analytics and A/B testing framework
- [ ] Cross-platform message synchronization
- [ ] Advanced scheduling with timezone awareness
- [ ] Machine learning for optimal send times

### Future Enhancements 🚀
- [ ] Voice message support for WhatsApp
- [ ] Video confirmation messages
- [ ] Interactive payment forms
- [ ] Real-time collaborative order management
- [ ] Advanced fraud detection
- [ ] Predictive messaging based on order patterns

## Configuration Management

### Environment-Specific Settings
```typescript
export const ENVIRONMENT_CONFIG = {
  development: {
    message_delay: 0,
    enable_test_mode: true,
    skip_actual_sending: false,
    debug_logging: true
  },
  
  staging: {
    message_delay: 1000,
    enable_test_mode: true,
    skip_actual_sending: false,
    debug_logging: true
  },
  
  production: {
    message_delay: 2000, // Anti-spam delay
    enable_test_mode: false,
    skip_actual_sending: false,
    debug_logging: false
  }
};
```

### Feature Flags
```typescript
export const FEATURE_FLAGS = {
  SMART_AGENT_AUTO_APPROVAL: true,
  BULK_NOTIFICATIONS: true,
  CROSS_PLATFORM_SYNC: true,
  ADVANCED_ANALYTICS: false, // Coming soon
  AI_MESSAGE_OPTIMIZATION: false, // Future feature
  VOICE_MESSAGES: false // Future feature
};
```

---

This configuration provides the foundation for GOMFLOW's automated messaging workflows that deliver the promised 95% time reduction for GOMs while ensuring buyers receive timely, relevant communications across their preferred platforms.
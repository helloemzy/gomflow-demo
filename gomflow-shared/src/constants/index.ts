// Country configurations
export const COUNTRY_CONFIGS = {
  PH: {
    currency: 'PHP' as const,
    currencySymbol: '₱',
    paymentGateway: 'paymongo' as const,
    phoneFormat: /^(\+63|63|0)?9\d{9}$/,
    supportedMethods: ['gcash', 'paymaya', 'grab_pay', 'bank_transfer', 'card'],
    timezone: 'Asia/Manila',
    locale: 'en-PH',
  },
  MY: {
    currency: 'MYR' as const,
    currencySymbol: 'RM',
    paymentGateway: 'billplz' as const,
    phoneFormat: /^(\+60|60|0)?1\d{8,9}$/,
    supportedMethods: ['fpx', 'bank_transfer', 'card'],
    timezone: 'Asia/Kuala_Lumpur',
    locale: 'ms-MY',
  },
};

// Payment method configurations
export const PAYMENT_METHODS = {
  gcash: {
    name: 'GCash',
    icon: '📱',
    countries: ['PH'],
    requiresAccount: true,
  },
  paymaya: {
    name: 'PayMaya',
    icon: '💳',
    countries: ['PH'],
    requiresAccount: true,
  },
  grab_pay: {
    name: 'GrabPay',
    icon: '🚗',
    countries: ['PH', 'MY'],
    requiresAccount: false,
  },
  bank_transfer: {
    name: 'Bank Transfer',
    icon: '🏦',
    countries: ['PH', 'MY'],
    requiresAccount: true,
  },
  maybank2u: {
    name: 'Maybank2u',
    icon: '🏦',
    countries: ['MY'],
    requiresAccount: true,
  },
  tng: {
    name: 'Touch n Go',
    icon: '💰',
    countries: ['MY'],
    requiresAccount: true,
  },
  fpx: {
    name: 'FPX',
    icon: '💸',
    countries: ['MY'],
    requiresAccount: false,
  },
  card: {
    name: 'Credit/Debit Card',
    icon: '💳',
    countries: ['PH', 'MY'],
    requiresAccount: false,
  },
};

// Order status configurations
export const ORDER_STATUS = {
  pending: {
    label: 'Pending Payment',
    color: 'yellow',
    icon: '⏰',
  },
  paid: {
    label: 'Paid',
    color: 'green',
    icon: '✅',
  },
  failed: {
    label: 'Payment Failed',
    color: 'red',
    icon: '❌',
  },
  expired: {
    label: 'Expired',
    color: 'gray',
    icon: '⏱️',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'gray',
    icon: '🚫',
  },
};

// Message templates
export const MESSAGE_TEMPLATES = {
  PH: {
    orderConfirmation: (data: any) => `✅ Order confirmed!

🛒 ${data.title}
📦 Quantity: ${data.quantity}
💰 Total: ₱${data.total_amount}
🔢 Reference: ${data.payment_reference}

${data.payment_url ? `💳 Pay now: ${data.payment_url}` : `Please send payment to:\n${data.payment_instructions}`}

⏰ Payment due: ${data.deadline}

Thank you! 😊`,

    paymentReminder: (data: any) => `⏰ Payment reminder

Hi ${data.buyer_name}! Your order for ${data.title} is waiting for payment.

💰 Amount: ₱${data.total_amount}
🔢 Reference: ${data.payment_reference}
⏰ Time left: ${data.time_left}

${data.payment_url ? `Pay now: ${data.payment_url}` : data.payment_instructions}`,

    paymentConfirmed: (data: any) => `🎉 Payment confirmed!

Your order for ${data.title} is secured!
Quantity: ${data.quantity}
Total: ₱${data.total_amount}

You'll receive updates when the order is ready for shipping. Thank you! 💙`,
  },
  MY: {
    orderConfirmation: (data: any) => `✅ Pesanan disahkan!

🛒 ${data.title}
📦 Kuantiti: ${data.quantity}
💰 Jumlah: RM${data.total_amount}
🔢 Rujukan: ${data.payment_reference}

${data.payment_url ? `💳 Bayar sekarang: ${data.payment_url}` : `Sila hantar bayaran ke:\n${data.payment_instructions}`}

⏰ Tarikh akhir bayaran: ${data.deadline}

Terima kasih! 😊`,

    paymentReminder: (data: any) => `⏰ Peringatan pembayaran

Hi ${data.buyer_name}! Pesanan anda untuk ${data.title} menunggu pembayaran.

💰 Jumlah: RM${data.total_amount}
🔢 Rujukan: ${data.payment_reference}
⏰ Masa tinggal: ${data.time_left}

${data.payment_url ? `Bayar sekarang: ${data.payment_url}` : data.payment_instructions}`,

    paymentConfirmed: (data: any) => `🎉 Pembayaran diterima!

Pesanan anda untuk ${data.title} telah disahkan!
Kuantiti: ${data.quantity}
Jumlah: RM${data.total_amount}

Anda akan menerima kemas kini apabila pesanan sedia untuk penghantaran. Terima kasih! 💙`,
  },
};

// API endpoints
export const API_ENDPOINTS = {
  // Core API
  orders: '/api/orders',
  submissions: '/api/submissions',
  users: '/api/users',
  dashboard: '/api/dashboard',
  
  // Service endpoints
  whatsapp: {
    send: '/api/whatsapp/send',
    webhook: '/api/whatsapp/webhook',
  },
  telegram: {
    send: '/api/telegram/send',
    webhook: '/api/telegram/webhook',
  },
  discord: {
    send: '/api/discord/send',
    webhook: '/api/discord/webhook',
  },
  payments: {
    create: '/api/payments/create',
    webhook: '/api/payments/webhook',
  },
  smartAgent: {
    detect: '/api/smart-agent/detect',
    process: '/api/smart-agent/process',
  },
};
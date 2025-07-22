import { COUNTRY_CONFIGS } from '../constants';

// Phone number utilities
export function detectCountry(phoneNumber: string): 'PH' | 'MY' | null {
  const cleaned = phoneNumber.replace(/\s+/g, '');
  
  if (COUNTRY_CONFIGS.PH.phoneFormat.test(cleaned)) {
    return 'PH';
  }
  if (COUNTRY_CONFIGS.MY.phoneFormat.test(cleaned)) {
    return 'MY';
  }
  
  return null;
}

export function formatPhoneNumber(phoneNumber: string, country: 'PH' | 'MY'): string {
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  if (country === 'PH') {
    // Format: +63 917 123 4567
    if (cleaned.startsWith('63')) {
      const number = cleaned.slice(2);
      return `+63 ${number.slice(0, 3)} ${number.slice(3, 6)} ${number.slice(6)}`;
    }
    return `+63 ${cleaned.slice(1, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }
  
  if (country === 'MY') {
    // Format: +60 12-345 6789
    if (cleaned.startsWith('60')) {
      const number = cleaned.slice(2);
      return `+60 ${number.slice(0, 2)}-${number.slice(2, 5)} ${number.slice(5)}`;
    }
    return `+60 ${cleaned.slice(1, 3)}-${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  
  return phoneNumber;
}

// Payment reference utilities
export function generatePaymentReference(orderId: string, buyerName: string): string {
  // Format: GF-{order_short}-{initials}-{random}
  const orderShort = orderId.split('-')[0].slice(0, 6).toUpperCase();
  const initials = buyerName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 3);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  
  return `GF-${orderShort}-${initials}-${random}`;
}

// Smart payment amount generation (for custom payment tracking)
export function generateUniqueAmount(basePrice: number, orderNumber: number): number {
  // Add cents based on order number to make amount unique
  // ₱850 + 0.23 = ₱850.23 for order #23
  const cents = (orderNumber % 100) / 100;
  return Number((basePrice + cents).toFixed(2));
}

export function extractOrderFromAmount(amount: number, basePrice: number): number {
  const difference = amount - basePrice;
  return Math.round(difference * 100);
}

// Currency formatting
export function formatCurrency(amount: number, currency: 'PHP' | 'MYR'): string {
  const config = currency === 'PHP' ? COUNTRY_CONFIGS.PH : COUNTRY_CONFIGS.MY;
  return `${config.currencySymbol}${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

// Date utilities
export function formatDeadline(deadline: Date, locale: string = 'en'): string {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  
  return new Date(deadline).toLocaleDateString(locale, options);
}

export function getTimeUntilDeadline(deadline: Date): string {
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diffMs = deadlineDate.getTime() - now.getTime();
  
  if (diffMs < 0) return 'Expired';
  
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ${hours} hour${hours > 1 ? 's' : ''}`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} min${minutes > 1 ? 's' : ''}`;
  return `${minutes} minute${minutes > 1 ? 's' : ''}`;
}

// URL utilities
export function generateOrderSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

// Validation utilities
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePhoneNumber(phone: string): boolean {
  const country = detectCountry(phone);
  if (!country) return false;
  
  const config = COUNTRY_CONFIGS[country];
  return config.phoneFormat.test(phone.replace(/\s+/g, ''));
}

// Service communication utilities
export function createServiceHeaders(serviceSecret: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Service-Token': serviceSecret,
  };
}

// Error handling utilities
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function handleApiError(error: any): { statusCode: number; message: string; code?: string } {
  if (error instanceof ApiError) {
    return {
      statusCode: error.statusCode,
      message: error.message,
      code: error.code,
    };
  }
  
  if (error.response) {
    return {
      statusCode: error.response.status || 500,
      message: error.response.data?.message || error.message,
      code: error.response.data?.code,
    };
  }
  
  return {
    statusCode: 500,
    message: error.message || 'Internal server error',
  };
}
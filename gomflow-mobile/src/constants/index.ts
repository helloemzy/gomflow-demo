// Constants for GOMFLOW mobile app

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.gomflow.com';
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const COLORS = {
  primary: '#3B82F6', // Blue
  secondary: '#8B5CF6', // Purple
  success: '#10B981', // Green
  warning: '#F59E0B', // Orange
  error: '#EF4444', // Red
  background: '#F3F4F6',
  surface: '#FFFFFF',
  text: '#111827',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
};

export const PAYMENT_METHODS = {
  PH: [
    { id: 'gcash', name: 'GCash', type: 'gcash', icon: '=³' },
    { id: 'paymaya', name: 'PayMaya', type: 'paymaya', icon: '=³' },
    { id: 'bank_transfer', name: 'Bank Transfer', type: 'bank_transfer', icon: '<æ' },
  ],
  MY: [
    { id: 'maybank', name: 'Maybank2u', type: 'maybank', icon: '<æ' },
    { id: 'touch_n_go', name: "Touch 'n Go", type: 'touch_n_go', icon: '=³' },
    { id: 'cimb', name: 'CIMB Bank', type: 'cimb', icon: '<æ' },
  ],
};

export const ORDER_CATEGORIES = [
  { value: 'album', label: 'Album' },
  { value: 'merchandise', label: 'Merchandise' },
  { value: 'photocard', label: 'Photocard' },
  { value: 'fashion', label: 'Fashion' },
  { value: 'collectible', label: 'Collectible' },
  { value: 'other', label: 'Other' },
];

export const CURRENCIES = {
  PH: { code: 'PHP', symbol: '±' },
  MY: { code: 'MYR', symbol: 'RM' },
};

export const LANGUAGES = {
  en: 'English',
  fil: 'Filipino',
  ms: 'Malay',
};

export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  AUTH_ERROR: 'Authentication failed. Please login again.',
  GENERIC_ERROR: 'Something went wrong. Please try again.',
  VALIDATION_ERROR: 'Please check your input and try again.',
};

export const SUCCESS_MESSAGES = {
  ORDER_CREATED: 'Order created successfully!',
  SUBMISSION_CREATED: 'Your order has been submitted!',
  PAYMENT_UPLOADED: 'Payment proof uploaded successfully!',
  ORDER_UPDATED: 'Order updated successfully!',
};

export const STORAGE_KEYS = {
  AUTH_TOKEN: '@gomflow_auth_token',
  USER_DATA: '@gomflow_user_data',
  LANGUAGE: '@gomflow_language',
  THEME: '@gomflow_theme',
};
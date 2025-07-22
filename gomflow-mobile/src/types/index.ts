// Core type definitions for GOMFLOW mobile app

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  user_type: 'gom' | 'buyer';
  country: 'PH' | 'MY';
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  title: string;
  description?: string;
  price: number;
  currency: 'PHP' | 'MYR';
  deadline: string;
  min_orders: number;
  max_orders?: number;
  category: 'album' | 'merchandise' | 'photocard' | 'fashion' | 'collectible' | 'other';
  shipping_from: string;
  is_active: boolean;
  status: 'draft' | 'active' | 'closed' | 'completed' | 'cancelled';
  gom_id: string;
  gom_name?: string;
  submission_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Submission {
  id: string;
  order_id: string;
  buyer_id: string;
  quantity: number;
  buyer_name: string;
  buyer_phone: string;
  buyer_email: string;
  delivery_address: string;
  payment_method: string;
  payment_status: 'pending' | 'pending_verification' | 'confirmed' | 'rejected';
  payment_reference: string;
  payment_proof_url?: string;
  special_instructions?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  type: 'gcash' | 'paymaya' | 'bank_transfer' | 'maybank' | 'touch_n_go' | 'cimb';
  country: 'PH' | 'MY';
  icon?: string;
}

export interface DashboardStats {
  totalOrders: number;
  activeOrders: number;
  totalSubmissions: number;
  totalRevenue: number;
  pendingPayments: number;
  overduePayments: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

// Navigation types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  OrderDetail: { orderId: string };
  OrderSubmit: { orderId: string };
  PaymentInstructions: { orderId: string; submissionId: string };
  CreateOrder: undefined;
  ManageOrder: { orderId: string };
};

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Orders: undefined;
  Browse: undefined;
  Profile: undefined;
};
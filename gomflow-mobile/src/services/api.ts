import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { API_BASE_URL } from '../constants';
import { authService } from './supabase';
import type { Order, Submission, DashboardStats, ApiResponse, PaginatedResponse } from '../types';

// Base query with authentication
const baseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  prepareHeaders: async (headers) => {
    const session = await authService.getSession();
    if (session?.access_token) {
      headers.set('Authorization', `Bearer ${session.access_token}`);
    }
    headers.set('Content-Type', 'application/json');
    return headers;
  },
});

export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Order', 'Submission', 'Dashboard'],
  endpoints: (builder) => ({
    // Orders
    getOrders: builder.query<ApiResponse<Order[]>, { limit?: number; offset?: number }>({
      query: ({ limit = 50, offset = 0 } = {}) => ({
        url: '/api/orders',
        params: { limit, offset },
      }),
      transformResponse: (response: ApiResponse<Order[]>) => response,
      providesTags: ['Order'],
    }),

    getPublicOrders: builder.query<PaginatedResponse<Order>, { 
      limit?: number; 
      offset?: number;
      category?: string;
      country?: string;
    }>({
      query: ({ limit = 50, offset = 0, category, country } = {}) => ({
        url: '/api/orders/public',
        params: { limit, offset, category, country },
      }),
      transformResponse: (response: PaginatedResponse<Order>) => response,
      providesTags: ['Order'],
    }),

    getOrder: builder.query<ApiResponse<Order>, string>({
      query: (orderId) => `/api/orders/${orderId}`,
      providesTags: (result, error, orderId) => [{ type: 'Order', id: orderId }],
    }),

    createOrder: builder.mutation<ApiResponse<Order>, Partial<Order>>({
      query: (orderData) => ({
        url: '/api/orders',
        method: 'POST',
        body: orderData,
      }),
      invalidatesTags: ['Order', 'Dashboard'],
    }),

    updateOrder: builder.mutation<ApiResponse<Order>, { id: string; data: Partial<Order> }>({
      query: ({ id, data }) => ({
        url: `/api/orders/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Order', id }, 'Dashboard'],
    }),

    deleteOrder: builder.mutation<ApiResponse<void>, string>({
      query: (orderId) => ({
        url: `/api/orders/${orderId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Order', 'Dashboard'],
    }),

    // Submissions
    getSubmissions: builder.query<ApiResponse<Submission[]>, string>({
      query: (orderId) => `/api/orders/${orderId}/submissions`,
      providesTags: (result, error, orderId) => [{ type: 'Submission', id: orderId }],
    }),

    createSubmission: builder.mutation<ApiResponse<Submission>, {
      orderId: string;
      data: Omit<Submission, 'id' | 'created_at' | 'updated_at'>;
    }>({
      query: ({ orderId, data }) => ({
        url: `/api/orders/${orderId}/submissions`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (result, error, { orderId }) => [
        { type: 'Submission', id: orderId },
        { type: 'Order', id: orderId },
        'Dashboard',
      ],
    }),

    updateSubmissionStatus: builder.mutation<ApiResponse<Submission>, {
      submissionId: string;
      status: string;
    }>({
      query: ({ submissionId, status }) => ({
        url: `/api/submissions/${submissionId}/status`,
        method: 'PATCH',
        body: { payment_status: status },
      }),
      invalidatesTags: ['Submission', 'Order', 'Dashboard'],
    }),

    // Payment proof upload
    uploadPaymentProof: builder.mutation<ApiResponse<any>, {
      formData: FormData;
    }>({
      query: ({ formData }) => ({
        url: '/api/payments/upload-proof',
        method: 'POST',
        body: formData,
        formData: true,
      }),
      invalidatesTags: ['Submission', 'Order'],
    }),

    // Dashboard
    getDashboardStats: builder.query<ApiResponse<DashboardStats>, void>({
      query: () => '/api/dashboard',
      providesTags: ['Dashboard'],
    }),

    // Health check
    getHealth: builder.query<{ status: string; timestamp: string }, void>({
      query: () => '/api/health',
    }),
  }),
});

export const {
  // Orders
  useGetOrdersQuery,
  useGetPublicOrdersQuery,
  useGetOrderQuery,
  useCreateOrderMutation,
  useUpdateOrderMutation,
  useDeleteOrderMutation,
  
  // Submissions
  useGetSubmissionsQuery,
  useCreateSubmissionMutation,
  useUpdateSubmissionStatusMutation,
  
  // Payment
  useUploadPaymentProofMutation,
  
  // Dashboard
  useGetDashboardStatsQuery,
  
  // Health
  useGetHealthQuery,
} = api;
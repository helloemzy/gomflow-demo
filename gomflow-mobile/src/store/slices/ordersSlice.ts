import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { dbService } from '../../services/supabase';
import { Order, Submission } from '../../types';

interface OrdersState {
  orders: Order[];
  currentOrder: Order | null;
  submissions: Submission[];
  isLoading: boolean;
  error: string | null;
  filters: {
    category: string;
    status: string;
    search: string;
  };
}

const initialState: OrdersState = {
  orders: [],
  currentOrder: null,
  submissions: [],
  isLoading: false,
  error: null,
  filters: {
    category: 'all',
    status: 'all',
    search: '',
  },
};

// Async thunks
export const fetchOrders = createAsyncThunk(
  'orders/fetchOrders',
  async (filters?: { is_active?: boolean; gom_id?: string }) => {
    const orders = await dbService.getOrders(filters);
    return orders.map(order => ({
      ...order,
      submission_count: Array.isArray(order.submission_count) 
        ? order.submission_count.length 
        : order.submission_count || 0,
    }));
  }
);

export const fetchOrder = createAsyncThunk(
  'orders/fetchOrder',
  async (orderId: string) => {
    const order = await dbService.getOrder(orderId);
    return {
      ...order,
      submission_count: Array.isArray(order.submission_count) 
        ? order.submission_count.length 
        : order.submission_count || 0,
      gom_name: order.gom?.full_name || 'Unknown GOM',
    };
  }
);

export const createOrder = createAsyncThunk(
  'orders/createOrder',
  async (orderData: Omit<Order, 'id' | 'created_at' | 'updated_at' | 'submission_count'>) => {
    const order = await dbService.createOrder({
      ...orderData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return order;
  }
);

export const updateOrder = createAsyncThunk(
  'orders/updateOrder',
  async ({ orderId, updates }: { orderId: string; updates: Partial<Order> }) => {
    const order = await dbService.updateOrder(orderId, {
      ...updates,
      updated_at: new Date().toISOString(),
    });
    return order;
  }
);

export const fetchSubmissions = createAsyncThunk(
  'orders/fetchSubmissions',
  async (orderId: string) => {
    const submissions = await dbService.getSubmissions(orderId);
    return submissions;
  }
);

export const createSubmission = createAsyncThunk(
  'orders/createSubmission',
  async (submissionData: Omit<Submission, 'id' | 'created_at' | 'updated_at'>) => {
    const submission = await dbService.createSubmission({
      ...submissionData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return submission;
  }
);

const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setCurrentOrder: (state, action: PayloadAction<Order | null>) => {
      state.currentOrder = action.payload;
    },
    updateFilters: (state, action: PayloadAction<Partial<typeof initialState.filters>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearFilters: (state) => {
      state.filters = {
        category: 'all',
        status: 'all',
        search: '',
      };
    },
    updateOrderInList: (state, action: PayloadAction<Order>) => {
      const index = state.orders.findIndex(order => order.id === action.payload.id);
      if (index !== -1) {
        state.orders[index] = action.payload;
      }
    },
    addSubmissionToOrder: (state, action: PayloadAction<Submission>) => {
      state.submissions.push(action.payload);
      // Update submission count if current order matches
      if (state.currentOrder && state.currentOrder.id === action.payload.order_id) {
        state.currentOrder.submission_count = (state.currentOrder.submission_count || 0) + 1;
      }
    },
  },
  extraReducers: (builder) => {
    // Fetch Orders
    builder
      .addCase(fetchOrders.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchOrders.fulfilled, (state, action) => {
        state.isLoading = false;
        state.orders = action.payload;
        state.error = null;
      })
      .addCase(fetchOrders.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch orders';
      });

    // Fetch Order
    builder
      .addCase(fetchOrder.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchOrder.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentOrder = action.payload;
        state.error = null;
      })
      .addCase(fetchOrder.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch order';
      });

    // Create Order
    builder
      .addCase(createOrder.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createOrder.fulfilled, (state, action) => {
        state.isLoading = false;
        state.orders.unshift(action.payload);
        state.error = null;
      })
      .addCase(createOrder.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to create order';
      });

    // Update Order
    builder
      .addCase(updateOrder.fulfilled, (state, action) => {
        const index = state.orders.findIndex(order => order.id === action.payload.id);
        if (index !== -1) {
          state.orders[index] = action.payload;
        }
        if (state.currentOrder && state.currentOrder.id === action.payload.id) {
          state.currentOrder = action.payload;
        }
      });

    // Fetch Submissions
    builder
      .addCase(fetchSubmissions.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchSubmissions.fulfilled, (state, action) => {
        state.isLoading = false;
        state.submissions = action.payload;
        state.error = null;
      })
      .addCase(fetchSubmissions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch submissions';
      });

    // Create Submission
    builder
      .addCase(createSubmission.fulfilled, (state, action) => {
        state.submissions.push(action.payload);
      });
  },
});

export const {
  clearError,
  setCurrentOrder,
  updateFilters,
  clearFilters,
  updateOrderInList,
  addSubmissionToOrder,
} = ordersSlice.actions;

export default ordersSlice.reducer;
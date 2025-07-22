import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, STORAGE_KEYS } from '../constants';

// Create Supabase client with AsyncStorage for persistence
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Auth helper functions
export const authService = {
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    
    // Store user data
    if (data.user) {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(data.user));
    }
    
    return data;
  },

  async signUp(email: string, password: string, metadata: { full_name: string; phone: string; user_type: 'gom' | 'buyer'; country: 'PH' | 'MY' }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    });
    
    if (error) throw error;
    
    return data;
  },

  async signOut() {
    await AsyncStorage.multiRemove([STORAGE_KEYS.USER_DATA, STORAGE_KEYS.AUTH_TOKEN]);
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  async getUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  },

  // Set up auth state listener
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  },
};

// Database helper functions
export const dbService = {
  // Orders
  async getOrders(filters?: { is_active?: boolean; gom_id?: string }) {
    let query = supabase
      .from('orders')
      .select(`
        *,
        submission_count:submissions(count)
      `)
      .order('created_at', { ascending: false });

    if (filters?.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }
    
    if (filters?.gom_id) {
      query = query.eq('gom_id', filters.gom_id);
    }

    const { data, error } = await query;
    if (error) throw error;
    
    return data;
  },

  async getOrder(orderId: string) {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        submission_count:submissions(count),
        gom:users!orders_gom_id_fkey(full_name)
      `)
      .eq('id', orderId)
      .single();

    if (error) throw error;
    return data;
  },

  async createOrder(order: any) {
    const { data, error } = await supabase
      .from('orders')
      .insert(order)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateOrder(orderId: string, updates: any) {
    const { data, error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Submissions
  async getSubmissions(orderId: string) {
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async createSubmission(submission: any) {
    const { data, error } = await supabase
      .from('submissions')
      .insert(submission)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateSubmission(submissionId: string, updates: any) {
    const { data, error } = await supabase
      .from('submissions')
      .update(updates)
      .eq('id', submissionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Dashboard stats
  async getDashboardStats(userId: string) {
    const { data, error } = await supabase
      .rpc('get_dashboard_stats', { user_id: userId });

    if (error) throw error;
    return data;
  },
};

// Storage helper functions
export const storageService = {
  async uploadPaymentProof(file: Blob, orderId: string, submissionId: string) {
    const fileName = `payment-proofs/${orderId}/${submissionId}-${Date.now()}.jpg`;
    
    const { data, error } = await supabase.storage
      .from('payment-proofs')
      .upload(fileName, file, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (error) throw error;
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('payment-proofs')
      .getPublicUrl(fileName);

    return publicUrl;
  },
};

// Real-time subscriptions
export const realtimeService = {
  subscribeToOrder(orderId: string, callback: (payload: any) => void) {
    return supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'submissions',
          filter: `order_id=eq.${orderId}`,
        },
        callback
      )
      .subscribe();
  },

  unsubscribe(channel: any) {
    supabase.removeChannel(channel);
  },
};
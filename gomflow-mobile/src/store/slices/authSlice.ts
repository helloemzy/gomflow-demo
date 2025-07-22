import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { authService } from '../../services/supabase';
import { User } from '../../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../constants';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

// Async thunks
export const signIn = createAsyncThunk(
  'auth/signIn',
  async ({ email, password }: { email: string; password: string }) => {
    const { user } = await authService.signIn(email, password);
    if (!user) throw new Error('Sign in failed');
    
    return {
      id: user.id,
      email: user.email!,
      full_name: user.user_metadata.full_name || '',
      phone: user.user_metadata.phone || '',
      user_type: user.user_metadata.user_type || 'buyer',
      country: user.user_metadata.country || 'PH',
      created_at: user.created_at,
      updated_at: user.updated_at || user.created_at,
    } as User;
  }
);

export const signUp = createAsyncThunk(
  'auth/signUp',
  async (params: {
    email: string;
    password: string;
    full_name: string;
    phone: string;
    user_type: 'gom' | 'buyer';
    country: 'PH' | 'MY';
  }) => {
    const { email, password, ...metadata } = params;
    const { user } = await authService.signUp(email, password, metadata);
    if (!user) throw new Error('Sign up failed');
    
    return {
      id: user.id,
      email: user.email!,
      full_name: metadata.full_name,
      phone: metadata.phone,
      user_type: metadata.user_type,
      country: metadata.country,
      created_at: user.created_at,
      updated_at: user.created_at,
    } as User;
  }
);

export const signOut = createAsyncThunk('auth/signOut', async () => {
  await authService.signOut();
});

export const checkAuth = createAsyncThunk('auth/checkAuth', async () => {
  const user = await authService.getUser();
  if (!user) return null;
  
  return {
    id: user.id,
    email: user.email!,
    full_name: user.user_metadata.full_name || '',
    phone: user.user_metadata.phone || '',
    user_type: user.user_metadata.user_type || 'buyer',
    country: user.user_metadata.country || 'PH',
    created_at: user.created_at,
    updated_at: user.updated_at || user.created_at,
  } as User;
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
  },
  extraReducers: (builder) => {
    // Sign In
    builder
      .addCase(signIn.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(signIn.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(signIn.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Sign in failed';
      });

    // Sign Up
    builder
      .addCase(signUp.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(signUp.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(signUp.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Sign up failed';
      });

    // Sign Out
    builder
      .addCase(signOut.fulfilled, (state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.error = null;
      });

    // Check Auth
    builder
      .addCase(checkAuth.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(checkAuth.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.isAuthenticated = !!action.payload;
      })
      .addCase(checkAuth.rejected, (state) => {
        state.isLoading = false;
        state.user = null;
        state.isAuthenticated = false;
      });
  },
});

export const { clearError, updateUser } = authSlice.actions;
export default authSlice.reducer;
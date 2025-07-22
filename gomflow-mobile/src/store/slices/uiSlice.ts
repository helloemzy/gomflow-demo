import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UiState {
  theme: 'light' | 'dark';
  language: 'en' | 'fil' | 'ms';
  notifications: {
    enabled: boolean;
    orders: boolean;
    payments: boolean;
    marketing: boolean;
  };
  loading: {
    [key: string]: boolean;
  };
  toast: {
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  } | null;
}

const initialState: UiState = {
  theme: 'light',
  language: 'en',
  notifications: {
    enabled: true,
    orders: true,
    payments: true,
    marketing: false,
  },
  loading: {},
  toast: null,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload;
    },
    setLanguage: (state, action: PayloadAction<'en' | 'fil' | 'ms'>) => {
      state.language = action.payload;
    },
    updateNotificationSettings: (
      state,
      action: PayloadAction<Partial<UiState['notifications']>>
    ) => {
      state.notifications = { ...state.notifications, ...action.payload };
    },
    setLoading: (state, action: PayloadAction<{ key: string; loading: boolean }>) => {
      state.loading[action.payload.key] = action.payload.loading;
    },
    clearLoading: (state, action: PayloadAction<string>) => {
      delete state.loading[action.payload];
    },
    showToast: (
      state,
      action: PayloadAction<{
        message: string;
        type: 'success' | 'error' | 'warning' | 'info';
      }>
    ) => {
      state.toast = {
        visible: true,
        message: action.payload.message,
        type: action.payload.type,
      };
    },
    hideToast: (state) => {
      state.toast = null;
    },
  },
});

export const {
  setTheme,
  setLanguage,
  updateNotificationSettings,
  setLoading,
  clearLoading,
  showToast,
  hideToast,
} = uiSlice.actions;

export default uiSlice.reducer;
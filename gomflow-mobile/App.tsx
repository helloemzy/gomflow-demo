import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Provider as PaperProvider } from 'react-native-paper';
import { Provider as ReduxProvider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { store } from './src/store';
import RootNavigator from './src/navigation/RootNavigator';
import { COLORS } from './src/constants';
import { notificationService } from './src/services/notificationService';
import { deepLinkService } from './src/services/deepLinkService';

const theme = {
  colors: {
    primary: COLORS.primary,
    secondary: COLORS.secondary,
    background: COLORS.background,
    surface: COLORS.surface,
    error: COLORS.error,
    text: COLORS.text,
    onSurface: COLORS.text,
    disabled: COLORS.textSecondary,
    placeholder: COLORS.textSecondary,
    backdrop: 'rgba(0, 0, 0, 0.5)',
  },
};

export default function App() {
  useEffect(() => {
    // Initialize services
    const initializeServices = async () => {
      try {
        await notificationService.initializeNotifications();
        await deepLinkService.initializeDeepLinking();
      } catch (error) {
        console.error('Failed to initialize services:', error);
      }
    };

    initializeServices();

    // Cleanup on unmount
    return () => {
      deepLinkService.cleanup();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ReduxProvider store={store}>
          <PaperProvider theme={theme}>
            <RootNavigator />
            <StatusBar style="auto" />
          </PaperProvider>
        </ReduxProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

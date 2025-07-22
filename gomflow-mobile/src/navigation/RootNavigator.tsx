import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useDispatch, useSelector } from 'react-redux';
import { ActivityIndicator, View } from 'react-native';

import { RootState, AppDispatch } from '../store';
import { checkAuth } from '../store/slices/authSlice';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import { COLORS } from '../constants';
import { deepLinkService } from '../services/deepLinkService';

const Stack = createStackNavigator();

const RootNavigator = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { isAuthenticated, isLoading } = useSelector((state: RootState) => state.auth);
  const navigationRef = useRef(null);

  useEffect(() => {
    // Check authentication status on app start
    dispatch(checkAuth());
  }, [dispatch]);

  useEffect(() => {
    // Set navigation reference for deep linking
    if (navigationRef.current) {
      deepLinkService.setNavigationRef(navigationRef);
    }
  }, []);

  useEffect(() => {
    // Process pending deep links after authentication
    if (isAuthenticated) {
      deepLinkService.processPendingLink();
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: COLORS.background 
      }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator 
        screenOptions={{ 
          headerShown: false,
          cardStyle: { backgroundColor: COLORS.background }
        }}
      >
        {isAuthenticated ? (
          <Stack.Screen name="Main" component={MainNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigator;
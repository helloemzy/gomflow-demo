import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useSelector } from 'react-redux';
import { MaterialIcons } from '@expo/vector-icons';

import { MainTabParamList, RootStackParamList } from '../types';
import { RootState } from '../store';
import { COLORS } from '../constants';

// Import main screens
import DashboardScreen from '../screens/main/DashboardScreen';
import OrdersScreen from '../screens/main/OrdersScreen';
import BrowseScreen from '../screens/main/BrowseScreen';
import ProfileScreen from '../screens/main/ProfileScreen';

// Import order-specific screens
import OrderDetailScreen from '../screens/orders/OrderDetailScreen';
import OrderSubmitScreen from '../screens/orders/OrderSubmitScreen';
import PaymentInstructionsScreen from '../screens/orders/PaymentInstructionsScreen';
import CreateOrderScreen from '../screens/orders/CreateOrderScreen';
// TODO: Import manage order screen when created
// import ManageOrderScreen from '../screens/orders/ManageOrderScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createStackNavigator<RootStackParamList>();

const TabNavigator = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const isGOM = user?.user_type === 'gom';

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof MaterialIcons.glyphMap;

          switch (route.name) {
            case 'Dashboard':
              iconName = focused ? 'dashboard' : 'dashboard';
              break;
            case 'Orders':
              iconName = focused ? 'shopping-bag' : 'shopping-bag';
              break;
            case 'Browse':
              iconName = focused ? 'search' : 'search';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person';
              break;
            default:
              iconName = 'dashboard';
          }

          return <MaterialIcons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          paddingTop: 5,
          paddingBottom: 5,
          height: 60,
        },
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginTop: 2,
        },
      })}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{ 
          tabBarLabel: 'Home',
          title: 'Dashboard',
        }}
      />
      <Tab.Screen 
        name="Orders" 
        component={OrdersScreen}
        options={{ 
          tabBarLabel: isGOM ? 'My Orders' : 'Orders',
          title: 'Orders',
        }}
      />
      <Tab.Screen 
        name="Browse" 
        component={BrowseScreen}
        options={{ 
          tabBarLabel: 'Browse',
          title: 'Browse',
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{ 
          tabBarLabel: 'Profile',
          title: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
};

const MainNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyleInterpolator: ({ current, layouts }) => {
          return {
            cardStyle: {
              transform: [
                {
                  translateX: current.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [layouts.screen.width, 0],
                  }),
                },
              ],
            },
          };
        },
      }}
    >
      <Stack.Screen name="Main" component={TabNavigator} />
      <Stack.Screen 
        name="OrderDetail" 
        component={OrderDetailScreen}
        options={{
          headerShown: false,
          title: 'Order Details',
        }}
      />
      <Stack.Screen 
        name="OrderSubmit" 
        component={OrderSubmitScreen}
        options={{
          headerShown: false,
          title: 'Join Order',
        }}
      />
      <Stack.Screen 
        name="PaymentInstructions" 
        component={PaymentInstructionsScreen}
        options={{
          headerShown: false,
          title: 'Payment Instructions',
        }}
      />
      <Stack.Screen 
        name="CreateOrder" 
        component={CreateOrderScreen}
        options={{
          headerShown: false,
          title: 'Create Order',
        }}
      />
      {/* TODO: Add manage order screen when created
      <Stack.Screen name="ManageOrder" component={ManageOrderScreen} />
      */}
    </Stack.Navigator>
  );
};

export default MainNavigator;
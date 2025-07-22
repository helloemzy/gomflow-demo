import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Dimensions } from 'react-native';
import { Text, Card, Button, Avatar, Chip, Divider } from 'react-native-paper';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import { RootState, AppDispatch } from '../../store';
import { RootStackParamList } from '../../types';
import { COLORS } from '../../constants';

type DashboardScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');

const DashboardScreen = () => {
  const navigation = useNavigation<DashboardScreenNavigationProp>();
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((state: RootState) => state.auth);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    activeOrders: 0,
    totalRevenue: 0,
    completedOrders: 0,
    pendingPayments: 0,
    totalSubmissions: 0,
  });

  const isGOM = user?.user_type === 'gom';

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      // TODO: Implement API call to fetch dashboard statistics
      // This would connect to /api/dashboard endpoint
      setStats({
        activeOrders: isGOM ? 12 : 5,
        totalRevenue: isGOM ? 15750 : 2500,
        completedOrders: isGOM ? 45 : 18,
        pendingPayments: isGOM ? 8 : 2,
        totalSubmissions: 156,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardStats();
    setRefreshing(false);
  };

  const renderGOMDashboard = () => (
    <>
      {/* Welcome Header */}
      <Card style={styles.welcomeCard}>
        <View style={styles.welcomeContent}>
          <View style={styles.welcomeText}>
            <Text style={styles.welcomeTitle}>Welcome back, {user?.full_name?.split(' ')[0]}!</Text>
            <Text style={styles.welcomeSubtitle}>Here's your order management overview</Text>
          </View>
          <Avatar.Icon 
            size={50} 
            icon="account-star" 
            style={styles.avatar}
          />
        </View>
      </Card>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <Card style={styles.statCard}>
          <View style={styles.statContent}>
            <MaterialIcons name="shopping-bag" size={24} color={COLORS.primary} />
            <Text style={styles.statNumber}>{stats.activeOrders}</Text>
            <Text style={styles.statLabel}>Active Orders</Text>
          </View>
        </Card>
        
        <Card style={styles.statCard}>
          <View style={styles.statContent}>
            <MaterialIcons name="attach-money" size={24} color={COLORS.success} />
            <Text style={styles.statNumber}>₱{stats.totalRevenue.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Total Revenue</Text>
          </View>
        </Card>
      </View>

      <View style={styles.statsContainer}>
        <Card style={styles.statCard}>
          <View style={styles.statContent}>
            <MaterialIcons name="done-all" size={24} color={COLORS.success} />
            <Text style={styles.statNumber}>{stats.completedOrders}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
        </Card>
        
        <Card style={styles.statCard}>
          <View style={styles.statContent}>
            <MaterialIcons name="pending" size={24} color={COLORS.warning} />
            <Text style={styles.statNumber}>{stats.pendingPayments}</Text>
            <Text style={styles.statLabel}>Pending Payments</Text>
          </View>
        </Card>
      </View>

      {/* Quick Actions */}
      <Card style={styles.actionsCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Quick Actions</Text>
        </View>
        <View style={styles.actionsGrid}>
          <Button
            mode="contained"
            onPress={() => navigation.navigate('CreateOrder')}
            style={styles.actionButton}
            icon="plus"
            contentStyle={styles.actionButtonContent}
          >
            Create Order
          </Button>
          <Button
            mode="outlined"
            onPress={() => {/* TODO: Navigate to orders */}}
            style={styles.actionButton}
            icon="view-list"
            contentStyle={styles.actionButtonContent}
          >
            View Orders
          </Button>
        </View>
      </Card>

      {/* Recent Activity */}
      <Card style={styles.activityCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Recent Activity</Text>
          <Button mode="text" compact>View All</Button>
        </View>
        <Divider />
        
        {/* Sample activity items */}
        <View style={styles.activityItem}>
          <MaterialIcons name="payment" size={20} color={COLORS.success} />
          <View style={styles.activityText}>
            <Text style={styles.activityTitle}>Payment received</Text>
            <Text style={styles.activitySubtitle}>BTS Album - Sarah M. • ₱850</Text>
          </View>
          <Text style={styles.activityTime}>2m ago</Text>
        </View>
        
        <View style={styles.activityItem}>
          <MaterialIcons name="person-add" size={20} color={COLORS.primary} />
          <View style={styles.activityText}>
            <Text style={styles.activityTitle}>New submission</Text>
            <Text style={styles.activitySubtitle}>TWICE Photobook - Maria L.</Text>
          </View>
          <Text style={styles.activityTime}>15m ago</Text>
        </View>
        
        <View style={styles.activityItem}>
          <MaterialIcons name="check-circle" size={20} color={COLORS.success} />
          <View style={styles.activityText}>
            <Text style={styles.activityTitle}>Order completed</Text>
            <Text style={styles.activitySubtitle}>SEVENTEEN Album • 25 items</Text>
          </View>
          <Text style={styles.activityTime}>1h ago</Text>
        </View>
      </Card>
    </>
  );

  const renderBuyerDashboard = () => (
    <>
      {/* Welcome Header */}
      <Card style={styles.welcomeCard}>
        <View style={styles.welcomeContent}>
          <View style={styles.welcomeText}>
            <Text style={styles.welcomeTitle}>Hi {user?.full_name?.split(' ')[0]}!</Text>
            <Text style={styles.welcomeSubtitle}>Discover trending group orders</Text>
          </View>
          <Avatar.Icon 
            size={50} 
            icon="account-heart" 
            style={styles.avatar}
          />
        </View>
      </Card>

      {/* My Orders Summary */}
      <View style={styles.statsContainer}>
        <Card style={styles.statCard}>
          <View style={styles.statContent}>
            <MaterialIcons name="shopping-cart" size={24} color={COLORS.primary} />
            <Text style={styles.statNumber}>{stats.activeOrders}</Text>
            <Text style={styles.statLabel}>Active Orders</Text>
          </View>
        </Card>
        
        <Card style={styles.statCard}>
          <View style={styles.statContent}>
            <MaterialIcons name="history" size={24} color={COLORS.textSecondary} />
            <Text style={styles.statNumber}>{stats.completedOrders}</Text>
            <Text style={styles.statLabel}>Past Orders</Text>
          </View>
        </Card>
      </View>

      {/* Quick Actions */}
      <Card style={styles.actionsCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Discover Orders</Text>
        </View>
        <View style={styles.actionsGrid}>
          <Button
            mode="contained"
            onPress={() => {/* TODO: Navigate to browse */}}
            style={styles.actionButton}
            icon="magnify"
            contentStyle={styles.actionButtonContent}
          >
            Browse Orders
          </Button>
          <Button
            mode="outlined"
            onPress={() => {/* TODO: Navigate to my orders */}}
            style={styles.actionButton}
            icon="format-list-bulleted"
            contentStyle={styles.actionButtonContent}
          >
            My Orders
          </Button>
        </View>
      </Card>

      {/* Trending Orders */}
      <Card style={styles.activityCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>🔥 Trending Now</Text>
          <Button mode="text" compact>See All</Button>
        </View>
        <Divider />
        
        {/* Sample trending orders */}
        <View style={styles.trendingItem}>
          <View style={styles.trendingInfo}>
            <Text style={styles.trendingTitle}>NewJeans "Get Up" Album</Text>
            <Text style={styles.trendingSubtitle}>by KPop_Manila • ₱650 each</Text>
            <View style={styles.trendingMeta}>
              <Chip size="small" style={styles.progressChip}>
                <Text style={styles.chipText}>89% filled</Text>
              </Chip>
              <Text style={styles.trendingTime}>2 days left</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.trendingItem}>
          <View style={styles.trendingInfo}>
            <Text style={styles.trendingTitle}>ATEEZ Concert Lightstick</Text>
            <Text style={styles.trendingSubtitle}>by AtinyPH • ₱2,200 each</Text>
            <View style={styles.trendingMeta}>
              <Chip size="small" style={styles.progressChip}>
                <Text style={styles.chipText}>76% filled</Text>
              </Chip>
              <Text style={styles.trendingTime}>5 days left</Text>
            </View>
          </View>
        </View>
        
        <View style={styles.trendingItem}>
          <View style={styles.trendingInfo}>
            <Text style={styles.trendingTitle}>BTS Proof Collector's Edition</Text>
            <Text style={styles.trendingSubtitle}>by ArmyOrders • ₱1,850 each</Text>
            <View style={styles.trendingMeta}>
              <Chip size="small" style={styles.urgentChip}>
                <Text style={styles.chipText}>Goal reached!</Text>
              </Chip>
              <Text style={styles.trendingTime}>Closing soon</Text>
            </View>
          </View>
        </View>
      </Card>

      {/* My Recent Activity */}
      <Card style={styles.activityCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>My Recent Activity</Text>
        </View>
        <Divider />
        
        <View style={styles.activityItem}>
          <MaterialIcons name="payment" size={20} color={COLORS.success} />
          <View style={styles.activityText}>
            <Text style={styles.activityTitle}>Payment confirmed</Text>
            <Text style={styles.activitySubtitle}>LE SSERAFIM Album • Order #LS2024001</Text>
          </View>
          <Text style={styles.activityTime}>1h ago</Text>
        </View>
        
        <View style={styles.activityItem}>
          <MaterialIcons name="add-shopping-cart" size={20} color={COLORS.primary} />
          <View style={styles.activityText}>
            <Text style={styles.activityTitle}>Joined order</Text>
            <Text style={styles.activitySubtitle}>ITZY Checkmate Photobook</Text>
          </View>
          <Text style={styles.activityTime}>3h ago</Text>
        </View>
      </Card>
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {isGOM ? renderGOMDashboard() : renderBuyerDashboard()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100, // Extra space for tab navigation
  },
  welcomeCard: {
    marginBottom: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    elevation: 2,
  },
  welcomeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  welcomeText: {
    flex: 1,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  avatar: {
    backgroundColor: COLORS.primary,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    elevation: 1,
  },
  statContent: {
    padding: 16,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  actionsCard: {
    marginBottom: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingTop: 8,
  },
  actionButton: {
    flex: 1,
    borderRadius: 8,
  },
  actionButtonContent: {
    height: 40,
  },
  activityCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    elevation: 2,
    marginBottom: 16,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingVertical: 12,
  },
  activityText: {
    flex: 1,
    marginLeft: 12,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 2,
  },
  activitySubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  activityTime: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  trendingItem: {
    padding: 16,
    paddingVertical: 12,
  },
  trendingInfo: {
    flex: 1,
  },
  trendingTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 2,
  },
  trendingSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  trendingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressChip: {
    backgroundColor: `${COLORS.primary}20`,
  },
  urgentChip: {
    backgroundColor: `${COLORS.success}20`,
  },
  chipText: {
    fontSize: 10,
    color: COLORS.primary,
  },
  trendingTime: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
});

export default DashboardScreen;
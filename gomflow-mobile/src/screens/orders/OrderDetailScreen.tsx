import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert, Share } from 'react-native';
import { Text, Button, Card, Avatar, Chip, Divider, ProgressBar, FAB } from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { MaterialIcons } from '@expo/vector-icons';

import { RootStackParamList } from '../../types';
import { RootState } from '../../store';
import { COLORS } from '../../constants';
import { Order } from '../../types';

type OrderDetailScreenNavigationProp = StackNavigationProp<RootStackParamList, 'OrderDetail'>;
type OrderDetailScreenRouteProp = RouteProp<RootStackParamList, 'OrderDetail'>;

const OrderDetailScreen = () => {
  const navigation = useNavigation<OrderDetailScreenNavigationProp>();
  const route = useRoute<OrderDetailScreenRouteProp>();
  const { user } = useSelector((state: RootState) => state.auth);
  
  const { orderId } = route.params;
  const [order, setOrder] = useState<Order | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const isGOM = user?.user_type === 'gom';
  const isOrderOwner = order?.gom_id === user?.id;

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      // TODO: Implement API call to fetch order details
      // This would connect to /api/orders/[id] endpoint
      console.log('Fetching order details for:', orderId);
      
      // Simulate API call with sample data
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const sampleOrder: Order = {
        id: orderId,
        gom_id: isGOM ? user?.id || '' : 'other-gom-id',
        title: 'SEVENTEEN "God of Music" Limited Edition',
        description: 'Pre-order for SEVENTEEN\'s latest album "God of Music" with exclusive photocard set, poster, and limited edition packaging. This is the official Korean version with all bonus materials included.',
        category: 'Albums',
        price_per_item: 650,
        currency: 'PHP',
        min_quantity: 20,
        max_quantity: 100,
        current_quantity: 78,
        deadline: '2025-01-25T23:59:59Z',
        shipping_location: 'Manila, Philippines',
        status: 'active',
        payment_methods: ['gcash', 'paymaya', 'bank_transfer'],
        created_at: '2025-01-15T10:00:00Z',
        updated_at: '2025-01-15T18:30:00Z',
        gom_name: isGOM ? user?.full_name : 'KPop Manila Store',
        gom_rating: 4.8,
        special_instructions: 'Please ensure your payment screenshot includes your full name and the reference number for faster processing.',
      };
      
      setOrder(sampleOrder);
    } catch (error) {
      console.error('Error fetching order details:', error);
      Alert.alert('Error', 'Failed to load order details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrderDetails();
    setRefreshing(false);
  };

  const handleShare = async () => {
    if (!order) return;
    
    try {
      await Share.share({
        message: `Check out this group order: ${order.title}\n\nPrice: ${order.currency === 'PHP' ? '₱' : 'RM'}${order.price_per_item} each\nMinimum: ${order.min_quantity} orders\nDeadline: ${new Date(order.deadline).toLocaleDateString()}\n\nJoin now on GOMFLOW!`,
        title: order.title,
      });
    } catch (error) {
      console.error('Error sharing order:', error);
    }
  };

  const handleJoinOrder = () => {
    if (!order) return;
    navigation.navigate('OrderSubmit', { orderId: order.id });
  };

  const handleManageOrder = () => {
    if (!order) return;
    // TODO: Navigate to manage order screen or show management options
    Alert.alert(
      'Manage Order',
      'Order management features coming soon!',
      [
        { text: 'Edit Order', onPress: () => console.log('Edit order') },
        { text: 'View Submissions', onPress: () => console.log('View submissions') },
        { text: 'Send Updates', onPress: () => console.log('Send updates') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return COLORS.primary;
      case 'completed':
        return COLORS.success;
      case 'closed':
        return COLORS.error;
      default:
        return COLORS.textSecondary;
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return COLORS.success;
    if (progress >= 80) return COLORS.warning;
    return COLORS.primary;
  };

  const formatDeadline = (deadline: string) => {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Expired';
    if (diffDays === 0) return 'Ends today';
    if (diffDays === 1) return 'Ends tomorrow';
    return `${diffDays} days left`;
  };

  const getPaymentMethodName = (methodId: string) => {
    const methods: Record<string, string> = {
      gcash: 'GCash',
      paymaya: 'PayMaya', 
      bank_transfer: 'Bank Transfer',
      touch_n_go: 'Touch n Go',
      maybank: 'Maybank2u',
      cimb: 'CIMB Clicks',
    };
    return methods[methodId] || methodId;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading order details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Order not found</Text>
          <Button mode="outlined" onPress={() => navigation.goBack()}>
            Go Back
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const progress = (order.current_quantity / order.min_quantity) * 100;
  const progressColor = getProgressColor(progress);
  const statusColor = getStatusColor(order.status);
  const deadlineText = formatDeadline(order.deadline);
  const isUrgent = deadlineText === 'Ends today' || deadlineText === 'Ends tomorrow';
  const isGoalReached = progress >= 100;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Button
          mode="text"
          onPress={() => navigation.goBack()}
          icon="arrow-left"
          compact
          textColor={COLORS.text}
        >
          Back
        </Button>
        <Text style={styles.headerTitle}>Order Details</Text>
        <Button
          mode="text"
          onPress={handleShare}
          icon="share"
          compact
          textColor={COLORS.text}
        >
          Share
        </Button>
      </View>

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
        {/* Order Header */}
        <Card style={styles.headerCard}>
          <View style={styles.orderHeader}>
            <View style={styles.orderInfo}>
              <Text style={styles.orderTitle}>{order.title}</Text>
              <View style={styles.gomInfo}>
                <Avatar.Text 
                  size={24} 
                  label={order.gom_name?.charAt(0) || 'G'} 
                  style={styles.gomAvatar}
                  labelStyle={styles.gomAvatarText}
                />
                <Text style={styles.gomName}>{order.gom_name}</Text>
                {order.gom_rating && (
                  <View style={styles.ratingContainer}>
                    <MaterialIcons name="star" size={14} color={COLORS.warning} />
                    <Text style={styles.ratingText}>{order.gom_rating}</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.statusContainer}>
              <Chip
                style={[styles.statusChip, { backgroundColor: `${statusColor}20` }]}
                textStyle={[styles.statusText, { color: statusColor }]}
              >
                {order.status.toUpperCase()}
              </Chip>
              <Chip style={styles.categoryChip}>
                {order.category}
              </Chip>
            </View>
          </View>
        </Card>

        {/* Description */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="description" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Description</Text>
          </View>
          <Text style={styles.description}>{order.description}</Text>
        </Card>

        {/* Progress Section */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="trending-up" size={20} color={progressColor} />
            <Text style={styles.sectionTitle}>Order Progress</Text>
          </View>
          
          <View style={styles.progressContainer}>
            <View style={styles.progressInfo}>
              <Text style={styles.progressText}>
                {order.current_quantity} / {order.min_quantity} orders
              </Text>
              <Text style={[styles.progressPercent, { color: progressColor }]}>
                {Math.round(progress)}%
              </Text>
            </View>
            <ProgressBar 
              progress={Math.min(progress / 100, 1)} 
              color={progressColor}
              style={styles.progressBar}
            />
            <View style={styles.progressMeta}>
              <Text style={styles.progressLabel}>
                {isGoalReached ? 'Goal reached!' : `${order.min_quantity - order.current_quantity} more needed`}
              </Text>
              <Text style={styles.progressLabel}>
                Max: {order.max_quantity}
              </Text>
            </View>
          </View>
        </Card>

        {/* Order Details */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="info" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Order Information</Text>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <MaterialIcons name="attach-money" size={20} color={COLORS.success} />
              <View style={styles.detailText}>
                <Text style={styles.detailLabel}>Price per item</Text>
                <Text style={styles.detailValue}>
                  {order.currency === 'PHP' ? '₱' : 'RM'}{order.price_per_item.toLocaleString()}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <MaterialIcons 
                name="schedule" 
                size={20} 
                color={isUrgent ? COLORS.error : COLORS.textSecondary} 
              />
              <View style={styles.detailText}>
                <Text style={styles.detailLabel}>Deadline</Text>
                <Text style={[
                  styles.detailValue,
                  isUrgent && { color: COLORS.error, fontWeight: '600' }
                ]}>
                  {new Date(order.deadline).toLocaleDateString()} ({deadlineText})
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <MaterialIcons name="local-shipping" size={20} color={COLORS.primary} />
              <View style={styles.detailText}>
                <Text style={styles.detailLabel}>Shipping from</Text>
                <Text style={styles.detailValue}>{order.shipping_location}</Text>
              </View>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <MaterialIcons name="date-range" size={20} color={COLORS.textSecondary} />
              <View style={styles.detailText}>
                <Text style={styles.detailLabel}>Created</Text>
                <Text style={styles.detailValue}>
                  {new Date(order.created_at).toLocaleDateString()}
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Payment Methods */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="payment" size={20} color={COLORS.success} />
            <Text style={styles.sectionTitle}>Accepted Payment Methods</Text>
          </View>
          <View style={styles.paymentMethods}>
            {order.payment_methods.map((methodId) => (
              <Chip key={methodId} style={styles.paymentChip}>
                {getPaymentMethodName(methodId)}
              </Chip>
            ))}
          </View>
        </Card>

        {/* Special Instructions */}
        {order.special_instructions && (
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="notes" size={20} color={COLORS.warning} />
              <Text style={styles.sectionTitle}>Special Instructions</Text>
            </View>
            <Text style={styles.instructions}>{order.special_instructions}</Text>
          </Card>
        )}

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          {isOrderOwner ? (
            <Button
              mode="contained"
              onPress={handleManageOrder}
              style={styles.primaryAction}
              icon="settings"
              contentStyle={styles.actionButtonContent}
            >
              Manage Order
            </Button>
          ) : (
            <Button
              mode="contained"
              onPress={handleJoinOrder}
              style={[styles.primaryAction, isGoalReached && styles.disabledAction]}
              disabled={isGoalReached || order.status !== 'active'}
              contentStyle={styles.actionButtonContent}
            >
              {isGoalReached ? 'Goal Reached' : 'Join Order'}
            </Button>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Action Button for quick actions */}
      {isOrderOwner && (
        <FAB
          icon="message"
          style={styles.fab}
          onPress={() => {
            // TODO: Navigate to send notification to all participants
            Alert.alert('Send Update', 'Send notification to all participants about this order.');
          }}
          label="Notify All"
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  headerCard: {
    marginBottom: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    elevation: 2,
  },
  orderHeader: {
    padding: 16,
  },
  orderInfo: {
    marginBottom: 12,
  },
  orderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
    lineHeight: 28,
  },
  gomInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gomAvatar: {
    backgroundColor: COLORS.primary,
  },
  gomAvatarText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  gomName: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  statusContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  statusChip: {
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  categoryChip: {
    backgroundColor: `${COLORS.secondary}20`,
    borderRadius: 12,
  },
  section: {
    marginBottom: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: 8,
  },
  description: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  progressContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  progressPercent: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  detailRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    marginLeft: 12,
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  paymentMethods: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  paymentChip: {
    backgroundColor: `${COLORS.success}20`,
  },
  instructions: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
    paddingHorizontal: 16,
    paddingBottom: 16,
    fontStyle: 'italic',
  },
  actionContainer: {
    paddingVertical: 16,
  },
  primaryAction: {
    backgroundColor: COLORS.primary,
    borderRadius: 25,
    marginHorizontal: 16,
  },
  disabledAction: {
    opacity: 0.6,
  },
  actionButtonContent: {
    height: 48,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 100,
    backgroundColor: COLORS.secondary,
  },
});

export default OrderDetailScreen;
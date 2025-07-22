import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Dimensions } from 'react-native';
import { Text, Card, Button, Chip, SearchBar, FAB, Menu, Divider } from 'react-native-paper';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import { RootState } from '../../store';
import { COLORS } from '../../constants';
import { Order, RootStackParamList } from '../../types';

type OrdersScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');

const OrdersScreen = () => {
  const navigation = useNavigation<OrdersScreenNavigationProp>();
  const { user } = useSelector((state: RootState) => state.auth);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [filterMenuVisible, setFilterMenuVisible] = useState(false);
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'closed' | 'completed'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'progress' | 'deadline'>('date');

  const isGOM = user?.user_type === 'gom';

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    filterAndSortOrders();
  }, [orders, searchQuery, activeFilter, sortBy]);

  const fetchOrders = async () => {
    try {
      // TODO: Implement API call to fetch orders
      // This would connect to /api/orders endpoint
      const sampleOrders: Order[] = [
        {
          id: '1',
          gom_id: user?.id || '',
          title: 'SEVENTEEN "God of Music" Album',
          description: 'Pre-order for SEVENTEEN\'s latest album with exclusive photocard',
          category: 'Albums',
          price_per_item: 650,
          currency: 'PHP',
          min_quantity: 20,
          max_quantity: 100,
          current_quantity: 78,
          deadline: '2025-01-20T23:59:59Z',
          shipping_location: 'Manila, Philippines',
          status: 'active',
          payment_methods: ['gcash', 'paymaya'],
          created_at: '2025-01-15T10:00:00Z',
          updated_at: '2025-01-15T10:00:00Z',
        },
        {
          id: '2',
          gom_id: user?.id || '',
          title: 'NewJeans "Get Up" Photobook',
          description: 'Limited edition photobook with poster',
          category: 'Photobooks',
          price_per_item: 1200,
          currency: 'PHP',
          min_quantity: 15,
          max_quantity: 50,
          current_quantity: 15,
          deadline: '2025-01-25T23:59:59Z',
          shipping_location: 'Quezon City, Philippines',
          status: 'completed',
          payment_methods: ['gcash', 'bank_transfer'],
          created_at: '2025-01-10T14:00:00Z',
          updated_at: '2025-01-15T09:30:00Z',
        },
        {
          id: '3',
          gom_id: user?.id || '',
          title: 'BTS Proof Collector Edition',
          description: 'Special collector\'s edition with exclusive content',
          category: 'Albums',
          price_per_item: 1850,
          currency: 'PHP',
          min_quantity: 10,
          max_quantity: 30,
          current_quantity: 8,
          deadline: '2025-01-18T23:59:59Z',
          shipping_location: 'Makati, Philippines',
          status: 'active',
          payment_methods: ['gcash', 'paymaya', 'bank_transfer'],
          created_at: '2025-01-12T16:00:00Z',
          updated_at: '2025-01-15T11:15:00Z',
        },
      ];
      setOrders(sampleOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  const filterAndSortOrders = () => {
    let filtered = orders;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(order =>
        order.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply status filter
    if (activeFilter !== 'all') {
      filtered = filtered.filter(order => order.status === activeFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'progress':
          const progressA = (a.current_quantity / a.min_quantity) * 100;
          const progressB = (b.current_quantity / b.min_quantity) * 100;
          return progressB - progressA;
        case 'deadline':
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        default:
          return 0;
      }
    });

    setFilteredOrders(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
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
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    return `${diffDays} days left`;
  };

  const renderOrderCard = ({ item }: { item: Order }) => {
    const progress = (item.current_quantity / item.min_quantity) * 100;
    const progressColor = getProgressColor(progress);
    const statusColor = getStatusColor(item.status);
    const deadlineText = formatDeadline(item.deadline);
    const isUrgent = deadlineText === 'Today' || deadlineText === 'Tomorrow';

    return (
      <Card style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View style={styles.orderInfo}>
            <Text style={styles.orderTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.orderCategory}>{item.category}</Text>
          </View>
          <View style={styles.statusContainer}>
            <Chip
              size="small"
              style={[styles.statusChip, { backgroundColor: `${statusColor}20` }]}
              textStyle={[styles.statusText, { color: statusColor }]}
            >
              {item.status.toUpperCase()}
            </Chip>
          </View>
        </View>

        <View style={styles.orderMeta}>
          <View style={styles.priceContainer}>
            <MaterialIcons name="attach-money" size={16} color={COLORS.success} />
            <Text style={styles.priceText}>
              {item.currency === 'PHP' ? '₱' : 'RM'}{item.price_per_item.toLocaleString()} each
            </Text>
          </View>
          <View style={styles.deadlineContainer}>
            <MaterialIcons 
              name="schedule" 
              size={16} 
              color={isUrgent ? COLORS.error : COLORS.textSecondary} 
            />
            <Text style={[
              styles.deadlineText,
              isUrgent && { color: COLORS.error, fontWeight: '600' }
            ]}>
              {deadlineText}
            </Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressInfo}>
            <Text style={styles.progressText}>
              {item.current_quantity} / {item.min_quantity} orders
            </Text>
            <Text style={[styles.progressPercent, { color: progressColor }]}>
              {Math.round(progress)}%
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  width: `${Math.min(progress, 100)}%`,
                  backgroundColor: progressColor,
                }
              ]} 
            />
          </View>
        </View>

        <View style={styles.orderActions}>
          <Button
            mode="outlined"
            onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
            style={styles.actionButton}
            compact
          >
            View Details
          </Button>
          {isGOM && (
            <Button
              mode="contained"
              onPress={() => navigation.navigate('OrderDetail', { orderId: item.id })}
              style={styles.actionButton}
              compact
            >
              Manage
            </Button>
          )}
        </View>
      </Card>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialIcons 
        name={isGOM ? "add-shopping-cart" : "search"} 
        size={64} 
        color={COLORS.textSecondary} 
      />
      <Text style={styles.emptyTitle}>
        {isGOM ? 'No orders yet' : 'No orders found'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {isGOM 
          ? 'Create your first group order to get started'
          : 'Try adjusting your search or browse trending orders'
        }
      </Text>
      {isGOM && (
        <Button
          mode="contained"
          onPress={() => {/* TODO: Navigate to create order */}}
          style={styles.emptyButton}
          icon="plus"
        >
          Create Order
        </Button>
      )}
    </View>
  );

  const filterOptions = [
    { key: 'all', label: 'All Orders' },
    { key: 'active', label: 'Active' },
    { key: 'completed', label: 'Completed' },
    { key: 'closed', label: 'Closed' },
  ];

  const sortOptions = [
    { key: 'date', label: 'Date Created' },
    { key: 'progress', label: 'Progress' },
    { key: 'deadline', label: 'Deadline' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {isGOM ? 'My Orders' : 'My Orders'}
        </Text>
        <View style={styles.headerActions}>
          <Menu
            visible={sortMenuVisible}
            onDismiss={() => setSortMenuVisible(false)}
            anchor={
              <Button
                mode="outlined"
                onPress={() => setSortMenuVisible(true)}
                icon="sort"
                compact
                style={styles.menuButton}
              >
                Sort
              </Button>
            }
          >
            {sortOptions.map((option) => (
              <Menu.Item
                key={option.key}
                onPress={() => {
                  setSortBy(option.key as any);
                  setSortMenuVisible(false);
                }}
                title={option.label}
                leadingIcon={sortBy === option.key ? "check" : undefined}
              />
            ))}
          </Menu>

          <Menu
            visible={filterMenuVisible}
            onDismiss={() => setFilterMenuVisible(false)}
            anchor={
              <Button
                mode="outlined"
                onPress={() => setFilterMenuVisible(true)}
                icon="filter-variant"
                compact
                style={styles.menuButton}
              >
                Filter
              </Button>
            }
          >
            {filterOptions.map((option) => (
              <Menu.Item
                key={option.key}
                onPress={() => {
                  setActiveFilter(option.key as any);
                  setFilterMenuVisible(false);
                }}
                title={option.label}
                leadingIcon={activeFilter === option.key ? "check" : undefined}
              />
            ))}
          </Menu>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <SearchBar
          placeholder="Search orders..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          inputStyle={styles.searchInput}
          icon="magnify"
          clearIcon="close"
        />
      </View>

      {/* Filter Tags */}
      {(activeFilter !== 'all' || searchQuery) && (
        <View style={styles.activeFilters}>
          {activeFilter !== 'all' && (
            <Chip
              onPress={() => setActiveFilter('all')}
              onClose={() => setActiveFilter('all')}
              style={styles.filterChip}
            >
              {filterOptions.find(f => f.key === activeFilter)?.label}
            </Chip>
          )}
          {searchQuery && (
            <Chip
              onPress={() => setSearchQuery('')}
              onClose={() => setSearchQuery('')}
              style={styles.filterChip}
            >
              "{searchQuery}"
            </Chip>
          )}
        </View>
      )}

      {/* Orders List */}
      <FlatList
        data={filteredOrders}
        renderItem={renderOrderCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
          />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />

      {/* FAB for creating new order (GOM only) */}
      {isGOM && (
        <FAB
          icon="plus"
          style={styles.fab}
          onPress={() => navigation.navigate('CreateOrder')}
          label="Create Order"
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  menuButton: {
    minWidth: 80,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
  },
  searchBar: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    fontSize: 14,
  },
  activeFilters: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  filterChip: {
    backgroundColor: `${COLORS.primary}20`,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100, // Space for FAB
  },
  orderCard: {
    marginBottom: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    paddingBottom: 8,
  },
  orderInfo: {
    flex: 1,
    marginRight: 12,
  },
  orderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  orderCategory: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusChip: {
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  orderMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.success,
    marginLeft: 4,
  },
  deadlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deadlineText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  progressContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressBar: {
    height: 6,
    backgroundColor: `${COLORS.primary}20`,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  orderActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 8,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyButton: {
    borderRadius: 20,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 80, // Space for tab navigation
    backgroundColor: COLORS.primary,
  },
});

export default OrdersScreen;
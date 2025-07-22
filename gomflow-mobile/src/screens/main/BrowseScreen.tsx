import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Dimensions } from 'react-native';
import { Text, Card, Button, Chip, SearchBar, Menu, Avatar } from 'react-native-paper';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import { RootState } from '../../store';
import { COLORS } from '../../constants';
import { Order, RootStackParamList } from '../../types';

type BrowseScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');

const BrowseScreen = () => {
  const navigation = useNavigation<BrowseScreenNavigationProp>();
  const { user } = useSelector((state: RootState) => state.auth);
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [categoryMenuVisible, setCategoryMenuVisible] = useState(false);
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'trending' | 'deadline' | 'progress' | 'price'>('trending');

  useEffect(() => {
    fetchPublicOrders();
  }, []);

  useEffect(() => {
    filterAndSortOrders();
  }, [orders, searchQuery, selectedCategory, sortBy]);

  const fetchPublicOrders = async () => {
    try {
      // TODO: Implement API call to fetch public orders
      // This would connect to /api/orders/public endpoint
      const sampleOrders: Order[] = [
        {
          id: '1',
          gom_id: 'gom1',
          title: 'SEVENTEEN "God of Music" Album',
          description: 'Pre-order for SEVENTEEN\'s latest album with exclusive photocard and poster. Limited edition includes special packaging.',
          category: 'Albums',
          price_per_item: 650,
          currency: 'PHP',
          min_quantity: 20,
          max_quantity: 100,
          current_quantity: 89,
          deadline: '2025-01-20T23:59:59Z',
          shipping_location: 'Manila, Philippines',
          status: 'active',
          payment_methods: ['gcash', 'paymaya'],
          created_at: '2025-01-15T10:00:00Z',
          updated_at: '2025-01-15T18:30:00Z',
          gom_name: 'KPop Manila',
          gom_rating: 4.8,
          trending_score: 95,
        },
        {
          id: '2',
          gom_id: 'gom2',
          title: 'NewJeans "Get Up" Photobook Special Edition',
          description: 'Limited edition photobook with exclusive photos and behind-the-scenes content. Includes poster and stickers.',
          category: 'Photobooks',
          price_per_item: 1200,
          currency: 'PHP',
          min_quantity: 15,
          max_quantity: 50,
          current_quantity: 38,
          deadline: '2025-01-22T23:59:59Z',
          shipping_location: 'Quezon City, Philippines',
          status: 'active',
          payment_methods: ['gcash', 'bank_transfer'],
          created_at: '2025-01-14T14:00:00Z',
          updated_at: '2025-01-15T16:45:00Z',
          gom_name: 'Bunnies PH',
          gom_rating: 4.9,
          trending_score: 88,
        },
        {
          id: '3',
          gom_id: 'gom3',
          title: 'ATEEZ Concert Lightstick Official',
          description: 'Official ATEEZ lightstick for upcoming concert. Bluetooth connectivity and app control features.',
          category: 'Concert Goods',
          price_per_item: 2200,
          currency: 'PHP',
          min_quantity: 10,
          max_quantity: 30,
          current_quantity: 23,
          deadline: '2025-01-25T23:59:59Z',
          shipping_location: 'Pasig, Philippines',
          status: 'active',
          payment_methods: ['gcash', 'paymaya', 'bank_transfer'],
          created_at: '2025-01-13T16:00:00Z',
          updated_at: '2025-01-15T14:20:00Z',
          gom_name: 'Atiny Orders',
          gom_rating: 4.7,
          trending_score: 82,
        },
        {
          id: '4',
          gom_id: 'gom4',
          title: 'BTS Proof Collector\'s Edition',
          description: 'Special collector\'s edition with exclusive content, photocards, and limited edition packaging.',
          category: 'Albums',
          price_per_item: 1850,
          currency: 'PHP',
          min_quantity: 8,
          max_quantity: 25,
          current_quantity: 25,
          deadline: '2025-01-18T23:59:59Z',
          shipping_location: 'Makati, Philippines',
          status: 'active',
          payment_methods: ['gcash', 'paymaya'],
          created_at: '2025-01-12T16:00:00Z',
          updated_at: '2025-01-15T12:10:00Z',
          gom_name: 'Army PH',
          gom_rating: 5.0,
          trending_score: 98,
        },
        {
          id: '5',
          gom_id: 'gom5',
          title: 'ITZY "Kill My Doubt" Album Set',
          description: 'Complete album set with all versions. Includes photocards, posters, and special packaging.',
          category: 'Albums',
          price_per_item: 950,
          currency: 'PHP',
          min_quantity: 12,
          max_quantity: 40,
          current_quantity: 6,
          deadline: '2025-01-28T23:59:59Z',
          shipping_location: 'Cebu City, Philippines',
          status: 'active',
          payment_methods: ['gcash', 'paymaya'],
          created_at: '2025-01-14T12:00:00Z',
          updated_at: '2025-01-15T09:15:00Z',
          gom_name: 'Midzy Cebu',
          gom_rating: 4.6,
          trending_score: 65,
        },
      ];
      setOrders(sampleOrders);
    } catch (error) {
      console.error('Error fetching public orders:', error);
    }
  };

  const filterAndSortOrders = () => {
    let filtered = orders;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(order =>
        order.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.gom_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(order => order.category === selectedCategory);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'trending':
          return (b.trending_score || 0) - (a.trending_score || 0);
        case 'deadline':
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        case 'progress':
          const progressA = (a.current_quantity / a.min_quantity) * 100;
          const progressB = (b.current_quantity / b.min_quantity) * 100;
          return progressB - progressA;
        case 'price':
          return a.price_per_item - b.price_per_item;
        default:
          return 0;
      }
    });

    setFilteredOrders(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPublicOrders();
    setRefreshing(false);
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

  const getTrendingBadge = (score: number) => {
    if (score >= 90) return { icon: '🔥', text: 'Hot', color: COLORS.error };
    if (score >= 80) return { icon: '📈', text: 'Trending', color: COLORS.warning };
    if (score >= 70) return { icon: '⭐', text: 'Popular', color: COLORS.primary };
    return null;
  };

  const renderOrderCard = ({ item }: { item: Order }) => {
    const progress = (item.current_quantity / item.min_quantity) * 100;
    const progressColor = getProgressColor(progress);
    const deadlineText = formatDeadline(item.deadline);
    const isUrgent = deadlineText === 'Ends today' || deadlineText === 'Ends tomorrow';
    const isCompleted = progress >= 100;
    const trendingBadge = getTrendingBadge(item.trending_score || 0);

    return (
      <Card style={styles.orderCard}>
        {/* Trending Badge */}
        {trendingBadge && (
          <View style={[styles.trendingBadge, { backgroundColor: `${trendingBadge.color}20` }]}>
            <Text style={styles.trendingIcon}>{trendingBadge.icon}</Text>
            <Text style={[styles.trendingText, { color: trendingBadge.color }]}>
              {trendingBadge.text}
            </Text>
          </View>
        )}

        <View style={styles.orderHeader}>
          <View style={styles.orderInfo}>
            <Text style={styles.orderTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <View style={styles.gomInfo}>
              <Avatar.Text 
                size={20} 
                label={item.gom_name?.charAt(0) || 'G'} 
                style={styles.gomAvatar}
                labelStyle={styles.gomAvatarText}
              />
              <Text style={styles.gomName}>{item.gom_name}</Text>
              <View style={styles.ratingContainer}>
                <MaterialIcons name="star" size={12} color={COLORS.warning} />
                <Text style={styles.ratingText}>{item.gom_rating}</Text>
              </View>
            </View>
          </View>
          <Chip size="small" style={styles.categoryChip}>
            {item.category}
          </Chip>
        </View>

        <Text style={styles.orderDescription} numberOfLines={2}>
          {item.description}
        </Text>

        <View style={styles.orderMeta}>
          <View style={styles.priceContainer}>
            <MaterialIcons name="attach-money" size={16} color={COLORS.success} />
            <Text style={styles.priceText}>
              {item.currency === 'PHP' ? '₱' : 'RM'}{item.price_per_item.toLocaleString()} each
            </Text>
          </View>
          <View style={styles.locationContainer}>
            <MaterialIcons name="location-on" size={16} color={COLORS.textSecondary} />
            <Text style={styles.locationText} numberOfLines={1}>
              {item.shipping_location}
            </Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressInfo}>
            <Text style={styles.progressText}>
              {item.current_quantity} / {item.min_quantity} orders
            </Text>
            <View style={styles.deadlineContainer}>
              <MaterialIcons 
                name="schedule" 
                size={14} 
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
          <Text style={[styles.progressPercent, { color: progressColor }]}>
            {Math.round(progress)}% {isCompleted && '(Goal reached!)'}
          </Text>
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
          <Button
            mode="contained"
            onPress={() => navigation.navigate('OrderSubmit', { orderId: item.id })}
            style={[styles.actionButton, isCompleted && styles.disabledButton]}
            disabled={isCompleted}
            compact
          >
            {isCompleted ? 'Goal Reached' : 'Join Order'}
          </Button>
        </View>
      </Card>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialIcons name="search-off" size={64} color={COLORS.textSecondary} />
      <Text style={styles.emptyTitle}>No orders found</Text>
      <Text style={styles.emptySubtitle}>
        Try adjusting your search terms or filters to find more group orders
      </Text>
      <Button
        mode="contained"
        onPress={() => {
          setSearchQuery('');
          setSelectedCategory('all');
        }}
        style={styles.emptyButton}
        icon="refresh"
      >
        Clear Filters
      </Button>
    </View>
  );

  const categories = [
    { key: 'all', label: 'All Categories' },
    { key: 'Albums', label: 'Albums' },
    { key: 'Photobooks', label: 'Photobooks' },
    { key: 'Concert Goods', label: 'Concert Goods' },
    { key: 'Merchandise', label: 'Merchandise' },
    { key: 'Collectibles', label: 'Collectibles' },
  ];

  const sortOptions = [
    { key: 'trending', label: 'Trending' },
    { key: 'deadline', label: 'Ending Soon' },
    { key: 'progress', label: 'Most Progress' },
    { key: 'price', label: 'Price (Low to High)' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Browse Orders</Text>
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
            visible={categoryMenuVisible}
            onDismiss={() => setCategoryMenuVisible(false)}
            anchor={
              <Button
                mode="outlined"
                onPress={() => setCategoryMenuVisible(true)}
                icon="tag"
                compact
                style={styles.menuButton}
              >
                Category
              </Button>
            }
          >
            {categories.map((option) => (
              <Menu.Item
                key={option.key}
                onPress={() => {
                  setSelectedCategory(option.key);
                  setCategoryMenuVisible(false);
                }}
                title={option.label}
                leadingIcon={selectedCategory === option.key ? "check" : undefined}
              />
            ))}
          </Menu>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <SearchBar
          placeholder="Search orders, GOMs, or categories..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          inputStyle={styles.searchInput}
          icon="magnify"
          clearIcon="close"
        />
      </View>

      {/* Active Filters */}
      {(selectedCategory !== 'all' || searchQuery) && (
        <View style={styles.activeFilters}>
          {selectedCategory !== 'all' && (
            <Chip
              onPress={() => setSelectedCategory('all')}
              onClose={() => setSelectedCategory('all')}
              style={styles.filterChip}
            >
              {categories.find(c => c.key === selectedCategory)?.label}
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
    paddingBottom: 100,
  },
  orderCard: {
    marginBottom: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    elevation: 2,
    position: 'relative',
  },
  trendingBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  trendingIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  trendingText: {
    fontSize: 10,
    fontWeight: '600',
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
    marginBottom: 8,
  },
  gomInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gomAvatar: {
    backgroundColor: COLORS.primary,
  },
  gomAvatarText: {
    fontSize: 8,
    fontWeight: 'bold',
  },
  gomName: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  categoryChip: {
    backgroundColor: `${COLORS.secondary}20`,
    borderRadius: 12,
  },
  orderDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    paddingHorizontal: 16,
    marginBottom: 12,
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
    flex: 1,
  },
  priceText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.success,
    marginLeft: 4,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  locationText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 4,
    textAlign: 'right',
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
  deadlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deadlineText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  progressBar: {
    height: 6,
    backgroundColor: `${COLORS.primary}20`,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressPercent: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
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
  disabledButton: {
    opacity: 0.6,
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
});

export default BrowseScreen;
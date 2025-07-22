import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Text, TextInput, Button, Card, HelperText, Chip, Menu, Divider } from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { MaterialIcons } from '@expo/vector-icons';

import { RootStackParamList, Order } from '../../types';
import { RootState } from '../../store';
import { COLORS } from '../../constants';

type OrderSubmitScreenNavigationProp = StackNavigationProp<RootStackParamList, 'OrderSubmit'>;
type OrderSubmitScreenRouteProp = RouteProp<RootStackParamList, 'OrderSubmit'>;

interface SubmissionFormData {
  full_name: string;
  phone: string;
  email: string;
  shipping_address: string;
  quantity: string;
  payment_method: string;
  special_requests: string;
}

const OrderSubmitScreen = () => {
  const navigation = useNavigation<OrderSubmitScreenNavigationProp>();
  const route = useRoute<OrderSubmitScreenRouteProp>();
  const { user } = useSelector((state: RootState) => state.auth);
  
  const { orderId } = route.params;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMenuVisible, setPaymentMenuVisible] = useState(false);

  const [formData, setFormData] = useState<SubmissionFormData>({
    full_name: user?.full_name || '',
    phone: user?.phone || '',
    email: user?.email || '',
    shipping_address: '',
    quantity: '1',
    payment_method: '',
    special_requests: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      // TODO: Implement API call to fetch order details
      console.log('Fetching order details for submission:', orderId);
      
      // Simulate API call with sample data
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const sampleOrder: Order = {
        id: orderId,
        gom_id: 'gom-id',
        title: 'SEVENTEEN "God of Music" Limited Edition',
        description: 'Pre-order for SEVENTEEN\'s latest album with exclusive photocard set and poster.',
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
        gom_name: 'KPop Manila Store',
        gom_rating: 4.8,
      };
      
      setOrder(sampleOrder);
      
      // Set default payment method
      if (sampleOrder.payment_methods.length > 0) {
        setFormData(prev => ({ ...prev, payment_method: sampleOrder.payment_methods[0] }));
      }
    } catch (error) {
      console.error('Error fetching order details:', error);
      Alert.alert('Error', 'Failed to load order details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof SubmissionFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Full name validation
    if (!formData.full_name.trim()) {
      newErrors.full_name = 'Full name is required';
    } else if (formData.full_name.trim().length < 2) {
      newErrors.full_name = 'Full name must be at least 2 characters';
    }

    // Phone validation
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^[\+]?[0-9\s\-\(\)]{10,15}$/.test(formData.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Shipping address validation
    if (!formData.shipping_address.trim()) {
      newErrors.shipping_address = 'Shipping address is required';
    } else if (formData.shipping_address.trim().length < 10) {
      newErrors.shipping_address = 'Please provide a complete address';
    }

    // Quantity validation
    if (!formData.quantity) {
      newErrors.quantity = 'Quantity is required';
    } else {
      const quantity = parseInt(formData.quantity);
      if (isNaN(quantity) || quantity < 1) {
        newErrors.quantity = 'Quantity must be at least 1';
      } else if (order && quantity > (order.max_quantity - order.current_quantity)) {
        newErrors.quantity = `Only ${order.max_quantity - order.current_quantity} spots remaining`;
      }
    }

    // Payment method validation
    if (!formData.payment_method) {
      newErrors.payment_method = 'Please select a payment method';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !order) {
      Alert.alert('Validation Error', 'Please fix the errors before submitting.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // TODO: Implement API call to submit order
      console.log('Submitting order:', { orderId, ...formData });
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      Alert.alert(
        'Success!',
        'Your order submission has been received. You will be redirected to payment instructions.',
        [
          {
            text: 'Continue',
            onPress: () => {
              // TODO: Navigate to payment instructions with submission ID
              navigation.navigate('PaymentInstructions', { 
                orderId, 
                submissionId: 'temp-submission-id' 
              });
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error submitting order:', error);
      Alert.alert('Error', 'Failed to submit order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateTotal = () => {
    if (!order || !formData.quantity) return 0;
    const quantity = parseInt(formData.quantity);
    return isNaN(quantity) ? 0 : order.price_per_item * quantity;
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

  const formatDeadline = (deadline: string) => {
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const diffTime = deadlineDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Expired';
    if (diffDays === 0) return 'Ends today';
    if (diffDays === 1) return 'Ends tomorrow';
    return `${diffDays} days left`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading order...</Text>
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

  const availableSpots = order.max_quantity - order.current_quantity;
  const deadlineText = formatDeadline(order.deadline);
  const isUrgent = deadlineText === 'Ends today' || deadlineText === 'Ends tomorrow';

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
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
          <Text style={styles.headerTitle}>Join Order</Text>
          <View style={{ width: 80 }} />
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Order Summary */}
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="shopping-cart" size={20} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Order Summary</Text>
            </View>

            <View style={styles.orderSummary}>
              <Text style={styles.orderTitle}>{order.title}</Text>
              <Text style={styles.orderGom}>by {order.gom_name}</Text>
              
              <View style={styles.orderMeta}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Price per item</Text>
                  <Text style={styles.metaValue}>
                    {order.currency === 'PHP' ? '₱' : 'RM'}{order.price_per_item.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Available spots</Text>
                  <Text style={styles.metaValue}>{availableSpots}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Deadline</Text>
                  <Text style={[
                    styles.metaValue,
                    isUrgent && { color: COLORS.error, fontWeight: '600' }
                  ]}>
                    {deadlineText}
                  </Text>
                </View>
              </View>
            </View>
          </Card>

          {/* Personal Information */}
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="person" size={20} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Personal Information</Text>
            </View>

            <TextInput
              label="Full Name *"
              value={formData.full_name}
              onChangeText={(value) => handleInputChange('full_name', value)}
              mode="outlined"
              style={styles.input}
              error={!!errors.full_name}
              autoCapitalize="words"
            />
            {errors.full_name && (
              <HelperText type="error" visible={!!errors.full_name}>
                {errors.full_name}
              </HelperText>
            )}

            <TextInput
              label="Phone Number *"
              value={formData.phone}
              onChangeText={(value) => handleInputChange('phone', value)}
              mode="outlined"
              style={styles.input}
              error={!!errors.phone}
              keyboardType="phone-pad"
              placeholder="+63 xxx xxx xxxx"
            />
            {errors.phone && (
              <HelperText type="error" visible={!!errors.phone}>
                {errors.phone}
              </HelperText>
            )}

            <TextInput
              label="Email Address *"
              value={formData.email}
              onChangeText={(value) => handleInputChange('email', value)}
              mode="outlined"
              style={styles.input}
              error={!!errors.email}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {errors.email && (
              <HelperText type="error" visible={!!errors.email}>
                {errors.email}
              </HelperText>
            )}
          </Card>

          {/* Shipping Information */}
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="local-shipping" size={20} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Shipping Information</Text>
            </View>

            <TextInput
              label="Complete Shipping Address *"
              value={formData.shipping_address}
              onChangeText={(value) => handleInputChange('shipping_address', value)}
              mode="outlined"
              style={styles.input}
              error={!!errors.shipping_address}
              multiline
              numberOfLines={3}
              placeholder="House/Unit No., Street, Barangay, City, Province, Postal Code"
            />
            {errors.shipping_address && (
              <HelperText type="error" visible={!!errors.shipping_address}>
                {errors.shipping_address}
              </HelperText>
            )}

            <View style={styles.shippingNote}>
              <MaterialIcons name="info" size={16} color={COLORS.warning} />
              <Text style={styles.shippingNoteText}>
                Items will be shipped from: {order.shipping_location}
              </Text>
            </View>
          </Card>

          {/* Order Details */}
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="shopping-bag" size={20} color={COLORS.success} />
              <Text style={styles.sectionTitle}>Order Details</Text>
            </View>

            <TextInput
              label="Quantity *"
              value={formData.quantity}
              onChangeText={(value) => handleInputChange('quantity', value)}
              mode="outlined"
              style={styles.input}
              error={!!errors.quantity}
              keyboardType="numeric"
              placeholder="1"
              right={<TextInput.Icon icon="format-list-numbered" />}
            />
            {errors.quantity && (
              <HelperText type="error" visible={!!errors.quantity}>
                {errors.quantity}
              </HelperText>
            )}

            <Menu
              visible={paymentMenuVisible}
              onDismiss={() => setPaymentMenuVisible(false)}
              anchor={
                <TextInput
                  label="Payment Method *"
                  value={getPaymentMethodName(formData.payment_method)}
                  mode="outlined"
                  style={styles.input}
                  error={!!errors.payment_method}
                  right={<TextInput.Icon icon="chevron-down" onPress={() => setPaymentMenuVisible(true)} />}
                  editable={false}
                  onPressIn={() => setPaymentMenuVisible(true)}
                />
              }
            >
              {order.payment_methods.map((methodId) => (
                <Menu.Item
                  key={methodId}
                  onPress={() => {
                    handleInputChange('payment_method', methodId);
                    setPaymentMenuVisible(false);
                  }}
                  title={getPaymentMethodName(methodId)}
                  leadingIcon={formData.payment_method === methodId ? "check" : undefined}
                />
              ))}
            </Menu>
            {errors.payment_method && (
              <HelperText type="error" visible={!!errors.payment_method}>
                {errors.payment_method}
              </HelperText>
            )}

            <TextInput
              label="Special Requests (Optional)"
              value={formData.special_requests}
              onChangeText={(value) => handleInputChange('special_requests', value)}
              mode="outlined"
              style={styles.input}
              multiline
              numberOfLines={2}
              placeholder="Any special requests or notes for the GOM..."
              maxLength={200}
            />
          </Card>

          {/* Order Total */}
          <Card style={styles.totalSection}>
            <View style={styles.totalContainer}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  {formData.quantity} × {order.currency === 'PHP' ? '₱' : 'RM'}{order.price_per_item.toLocaleString()}
                </Text>
                <Text style={styles.totalAmount}>
                  {order.currency === 'PHP' ? '₱' : 'RM'}{calculateTotal().toLocaleString()}
                </Text>
              </View>
              <Divider style={styles.totalDivider} />
              <View style={styles.totalRow}>
                <Text style={styles.totalFinalLabel}>Total Amount</Text>
                <Text style={styles.totalFinalAmount}>
                  {order.currency === 'PHP' ? '₱' : 'RM'}{calculateTotal().toLocaleString()}
                </Text>
              </View>
            </View>
          </Card>

          {/* Submit Button */}
          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting || availableSpots === 0}
            style={styles.submitButton}
            contentStyle={styles.submitButtonContent}
            labelStyle={styles.submitButtonText}
          >
            {isSubmitting ? 'Submitting Order...' : 
             availableSpots === 0 ? 'Order Full' : 
             'Join Order'}
          </Button>

          <View style={{ height: 50 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardAvoid: {
    flex: 1,
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
  orderSummary: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  orderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  orderGom: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  orderMeta: {
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  input: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: COLORS.surface,
  },
  shippingNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.warning}20`,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
  },
  shippingNoteText: {
    fontSize: 12,
    color: COLORS.warning,
    marginLeft: 8,
    flex: 1,
  },
  totalSection: {
    marginBottom: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    elevation: 2,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  totalContainer: {
    padding: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  totalLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  totalAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  totalDivider: {
    marginVertical: 8,
  },
  totalFinalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  totalFinalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    marginTop: 20,
    marginHorizontal: 16,
    borderRadius: 25,
  },
  submitButtonContent: {
    height: 50,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default OrderSubmitScreen;
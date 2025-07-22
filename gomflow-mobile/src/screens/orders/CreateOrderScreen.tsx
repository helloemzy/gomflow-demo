import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Text, TextInput, Button, Card, HelperText, Chip, Menu, Divider } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';

import { RootStackParamList } from '../../types';
import { RootState } from '../../store';
import { COLORS } from '../../constants';

type CreateOrderScreenNavigationProp = StackNavigationProp<RootStackParamList, 'CreateOrder'>;

interface OrderFormData {
  title: string;
  description: string;
  category: string;
  price_per_item: string;
  currency: 'PHP' | 'MY';
  min_quantity: string;
  max_quantity: string;
  deadline: Date;
  shipping_location: string;
  payment_methods: string[];
  special_instructions: string;
}

const CreateOrderScreen = () => {
  const navigation = useNavigation<CreateOrderScreenNavigationProp>();
  const { user } = useSelector((state: RootState) => state.auth);
  
  const [formData, setFormData] = useState<OrderFormData>({
    title: '',
    description: '',
    category: 'Albums',
    price_per_item: '',
    currency: user?.country === 'PH' ? 'PHP' : 'MY',
    min_quantity: '',
    max_quantity: '',
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 7 days from now
    shipping_location: '',
    payment_methods: user?.country === 'PH' ? ['gcash'] : ['touch_n_go'],
    special_instructions: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [categoryMenuVisible, setCategoryMenuVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = [
    'Albums',
    'Photobooks', 
    'Concert Goods',
    'Merchandise',
    'Collectibles',
    'Accessories',
    'Special Items',
  ];

  const paymentMethods = user?.country === 'PH' 
    ? [
        { id: 'gcash', name: 'GCash', icon: 'account-balance-wallet' },
        { id: 'paymaya', name: 'PayMaya', icon: 'credit-card' },
        { id: 'bank_transfer', name: 'Bank Transfer', icon: 'account-balance' },
      ]
    : [
        { id: 'touch_n_go', name: 'Touch n Go', icon: 'account-balance-wallet' },
        { id: 'maybank', name: 'Maybank2u', icon: 'account-balance' },
        { id: 'cimb', name: 'CIMB Clicks', icon: 'account-balance' },
        { id: 'bank_transfer', name: 'Bank Transfer', icon: 'account-balance' },
      ];

  const handleInputChange = (field: keyof OrderFormData, value: string | string[] | Date) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const togglePaymentMethod = (methodId: string) => {
    const newMethods = formData.payment_methods.includes(methodId)
      ? formData.payment_methods.filter(id => id !== methodId)
      : [...formData.payment_methods, methodId];
    
    handleInputChange('payment_methods', newMethods);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Title validation
    if (!formData.title.trim()) {
      newErrors.title = 'Order title is required';
    } else if (formData.title.trim().length < 10) {
      newErrors.title = 'Title must be at least 10 characters';
    }

    // Description validation
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.trim().length < 20) {
      newErrors.description = 'Description must be at least 20 characters';
    }

    // Price validation
    if (!formData.price_per_item) {
      newErrors.price_per_item = 'Price is required';
    } else {
      const price = parseFloat(formData.price_per_item);
      if (isNaN(price) || price <= 0) {
        newErrors.price_per_item = 'Please enter a valid price';
      }
    }

    // Quantity validation
    if (!formData.min_quantity) {
      newErrors.min_quantity = 'Minimum quantity is required';
    } else {
      const minQty = parseInt(formData.min_quantity);
      if (isNaN(minQty) || minQty < 1) {
        newErrors.min_quantity = 'Minimum quantity must be at least 1';
      }
    }

    if (!formData.max_quantity) {
      newErrors.max_quantity = 'Maximum quantity is required';
    } else {
      const maxQty = parseInt(formData.max_quantity);
      const minQty = parseInt(formData.min_quantity);
      if (isNaN(maxQty) || maxQty < 1) {
        newErrors.max_quantity = 'Maximum quantity must be at least 1';
      } else if (maxQty < minQty) {
        newErrors.max_quantity = 'Maximum must be greater than minimum';
      }
    }

    // Deadline validation
    if (formData.deadline <= new Date()) {
      newErrors.deadline = 'Deadline must be in the future';
    }

    // Shipping location validation
    if (!formData.shipping_location.trim()) {
      newErrors.shipping_location = 'Shipping location is required';
    }

    // Payment methods validation
    if (formData.payment_methods.length === 0) {
      newErrors.payment_methods = 'At least one payment method is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fix the errors before submitting.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // TODO: Implement API call to create order
      // This would connect to /api/orders endpoint
      console.log('Creating order:', formData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      Alert.alert(
        'Success',
        'Your order has been created successfully!',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Error creating order:', error);
      Alert.alert('Error', 'Failed to create order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: string) => {
    if (!amount) return '';
    const num = parseFloat(amount);
    if (isNaN(num)) return amount;
    return formData.currency === 'PHP' ? `₱${num.toLocaleString()}` : `RM${num.toLocaleString()}`;
  };

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
          <Text style={styles.headerTitle}>Create Order</Text>
          <View style={{ width: 80 }} />
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Order Details Section */}
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="info" size={20} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Order Details</Text>
            </View>

            <TextInput
              label="Order Title *"
              value={formData.title}
              onChangeText={(value) => handleInputChange('title', value)}
              mode="outlined"
              style={styles.input}
              placeholder="e.g., BTS Proof Collector's Edition"
              error={!!errors.title}
              maxLength={100}
            />
            {errors.title && (
              <HelperText type="error" visible={!!errors.title}>
                {errors.title}
              </HelperText>
            )}

            <TextInput
              label="Description *"
              value={formData.description}
              onChangeText={(value) => handleInputChange('description', value)}
              mode="outlined"
              style={styles.input}
              placeholder="Describe the item, what's included, and any special details..."
              multiline
              numberOfLines={4}
              error={!!errors.description}
              maxLength={500}
            />
            {errors.description && (
              <HelperText type="error" visible={!!errors.description}>
                {errors.description}
              </HelperText>
            )}

            <Menu
              visible={categoryMenuVisible}
              onDismiss={() => setCategoryMenuVisible(false)}
              anchor={
                <TextInput
                  label="Category *"
                  value={formData.category}
                  mode="outlined"
                  style={styles.input}
                  right={<TextInput.Icon icon="chevron-down" onPress={() => setCategoryMenuVisible(true)} />}
                  editable={false}
                  onPressIn={() => setCategoryMenuVisible(true)}
                />
              }
            >
              {categories.map((category) => (
                <Menu.Item
                  key={category}
                  onPress={() => {
                    handleInputChange('category', category);
                    setCategoryMenuVisible(false);
                  }}
                  title={category}
                  leadingIcon={formData.category === category ? "check" : undefined}
                />
              ))}
            </Menu>
          </Card>

          {/* Pricing Section */}
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="attach-money" size={20} color={COLORS.success} />
              <Text style={styles.sectionTitle}>Pricing</Text>
            </View>

            <View style={styles.row}>
              <TextInput
                label="Price per Item *"
                value={formData.price_per_item}
                onChangeText={(value) => handleInputChange('price_per_item', value)}
                mode="outlined"
                style={[styles.input, styles.flex1]}
                placeholder="0.00"
                keyboardType="numeric"
                error={!!errors.price_per_item}
                left={<TextInput.Icon icon={() => (
                  <Text style={styles.currencyIcon}>
                    {formData.currency === 'PHP' ? '₱' : 'RM'}
                  </Text>
                )} />}
              />
            </View>
            {errors.price_per_item && (
              <HelperText type="error" visible={!!errors.price_per_item}>
                {errors.price_per_item}
              </HelperText>
            )}

            {formData.price_per_item && (
              <View style={styles.pricePreview}>
                <Text style={styles.pricePreviewText}>
                  Price per item: {formatCurrency(formData.price_per_item)}
                </Text>
              </View>
            )}
          </Card>

          {/* Quantity Section */}
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="format-list-numbered" size={20} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Order Quantities</Text>
            </View>

            <View style={styles.row}>
              <TextInput
                label="Minimum Quantity *"
                value={formData.min_quantity}
                onChangeText={(value) => handleInputChange('min_quantity', value)}
                mode="outlined"
                style={[styles.input, styles.flex1, { marginRight: 8 }]}
                placeholder="e.g., 10"
                keyboardType="numeric"
                error={!!errors.min_quantity}
              />
              <TextInput
                label="Maximum Quantity *"
                value={formData.max_quantity}
                onChangeText={(value) => handleInputChange('max_quantity', value)}
                mode="outlined"
                style={[styles.input, styles.flex1, { marginLeft: 8 }]}
                placeholder="e.g., 50"
                keyboardType="numeric"
                error={!!errors.max_quantity}
              />
            </View>
            {(errors.min_quantity || errors.max_quantity) && (
              <HelperText type="error" visible={!!(errors.min_quantity || errors.max_quantity)}>
                {errors.min_quantity || errors.max_quantity}
              </HelperText>
            )}
          </Card>

          {/* Deadline Section */}
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="schedule" size={20} color={COLORS.warning} />
              <Text style={styles.sectionTitle}>Order Deadline</Text>
            </View>

            <TextInput
              label="Deadline *"
              value={formData.deadline.toLocaleDateString() + ' ' + formData.deadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              mode="outlined"
              style={styles.input}
              editable={false}
              right={<TextInput.Icon icon="calendar" onPress={() => setShowDatePicker(true)} />}
              onPressIn={() => setShowDatePicker(true)}
              error={!!errors.deadline}
            />
            {errors.deadline && (
              <HelperText type="error" visible={!!errors.deadline}>
                {errors.deadline}
              </HelperText>
            )}

            {showDatePicker && (
              <DateTimePicker
                value={formData.deadline}
                mode="datetime"
                is24Hour={false}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (selectedDate) {
                    handleInputChange('deadline', selectedDate);
                  }
                }}
                minimumDate={new Date()}
              />
            )}
          </Card>

          {/* Shipping Section */}
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="local-shipping" size={20} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>Shipping Information</Text>
            </View>

            <TextInput
              label="Shipping Location *"
              value={formData.shipping_location}
              onChangeText={(value) => handleInputChange('shipping_location', value)}
              mode="outlined"
              style={styles.input}
              placeholder="e.g., Manila, Philippines"
              error={!!errors.shipping_location}
            />
            {errors.shipping_location && (
              <HelperText type="error" visible={!!errors.shipping_location}>
                {errors.shipping_location}
              </HelperText>
            )}
          </Card>

          {/* Payment Methods Section */}
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="payment" size={20} color={COLORS.success} />
              <Text style={styles.sectionTitle}>Payment Methods</Text>
            </View>

            <Text style={styles.sectionDescription}>
              Select which payment methods you accept:
            </Text>

            <View style={styles.paymentMethods}>
              {paymentMethods.map((method) => (
                <Chip
                  key={method.id}
                  selected={formData.payment_methods.includes(method.id)}
                  onPress={() => togglePaymentMethod(method.id)}
                  style={[
                    styles.paymentChip,
                    formData.payment_methods.includes(method.id) && styles.selectedPaymentChip
                  ]}
                  textStyle={[
                    styles.paymentChipText,
                    formData.payment_methods.includes(method.id) && styles.selectedPaymentChipText
                  ]}
                  icon={method.icon as any}
                >
                  {method.name}
                </Chip>
              ))}
            </View>
            {errors.payment_methods && (
              <HelperText type="error" visible={!!errors.payment_methods}>
                {errors.payment_methods}
              </HelperText>
            )}
          </Card>

          {/* Special Instructions Section */}
          <Card style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="notes" size={20} color={COLORS.textSecondary} />
              <Text style={styles.sectionTitle}>Special Instructions (Optional)</Text>
            </View>

            <TextInput
              label="Additional Instructions"
              value={formData.special_instructions}
              onChangeText={(value) => handleInputChange('special_instructions', value)}
              mode="outlined"
              style={styles.input}
              placeholder="Any special requirements, shipping notes, or important information..."
              multiline
              numberOfLines={3}
              maxLength={300}
            />
          </Card>

          {/* Submit Button */}
          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting}
            style={styles.submitButton}
            contentStyle={styles.submitButtonContent}
            labelStyle={styles.submitButtonText}
          >
            {isSubmitting ? 'Creating Order...' : 'Create Order'}
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
  sectionDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  input: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: COLORS.surface,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  flex1: {
    flex: 1,
  },
  currencyIcon: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.success,
  },
  pricePreview: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  pricePreviewText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.success,
  },
  paymentMethods: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  paymentChip: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selectedPaymentChip: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  paymentChipText: {
    color: COLORS.text,
  },
  selectedPaymentChipText: {
    color: '#FFFFFF',
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

export default CreateOrderScreen;
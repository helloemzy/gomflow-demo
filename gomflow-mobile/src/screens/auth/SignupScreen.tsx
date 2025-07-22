import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, Button, Card, HelperText, RadioButton, Chip } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';

import { AuthStackParamList } from '../../types';
import { RootState, AppDispatch } from '../../store';
import { signUp, clearError } from '../../store/slices/authSlice';
import { COLORS } from '../../constants';

type SignupScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Signup'>;

const SignupScreen = () => {
  const navigation = useNavigation<SignupScreenNavigationProp>();
  const dispatch = useDispatch<AppDispatch>();
  const { isLoading, error } = useSelector((state: RootState) => state.auth);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    phone: '',
    user_type: 'buyer' as 'gom' | 'buyer',
    country: 'PH' as 'PH' | 'MY',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string) => {
    // Basic phone validation for PH/MY formats
    const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,15}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    // Full name validation
    if (!formData.full_name.trim()) {
      newErrors.full_name = 'Full name is required';
    } else if (formData.full_name.trim().length < 2) {
      newErrors.full_name = 'Full name must be at least 2 characters';
    }

    // Phone validation
    if (!formData.phone) {
      newErrors.phone = 'Phone number is required';
    } else if (!validatePhone(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = async () => {
    dispatch(clearError());

    if (!validateForm()) {
      return;
    }

    try {
      const { confirmPassword, ...signupData } = formData;
      await dispatch(signUp(signupData)).unwrap();
      // Navigation will be handled by RootNavigator based on auth state
    } catch (err) {
      console.log('Signup error:', err);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Text style={styles.logo}>G</Text>
            </View>
            <Text style={styles.title}>Join GOMFLOW</Text>
            <Text style={styles.subtitle}>Start managing group orders like a pro</Text>
          </View>

          {/* Signup Form */}
          <Card style={styles.formCard}>
            <View style={styles.formContent}>
              <Text style={styles.formTitle}>Create Account</Text>

              {/* User Type Selection */}
              <View style={styles.userTypeContainer}>
                <Text style={styles.sectionTitle}>I want to...</Text>
                <View style={styles.userTypeOptions}>
                  <Chip
                    selected={formData.user_type === 'buyer'}
                    onPress={() => handleInputChange('user_type', 'buyer')}
                    style={[
                      styles.userTypeChip,
                      formData.user_type === 'buyer' && styles.selectedChip
                    ]}
                    textStyle={[
                      styles.chipText,
                      formData.user_type === 'buyer' && styles.selectedChipText
                    ]}
                  >
                    =Ò Buy from group orders
                  </Chip>
                  <Chip
                    selected={formData.user_type === 'gom'}
                    onPress={() => handleInputChange('user_type', 'gom')}
                    style={[
                      styles.userTypeChip,
                      formData.user_type === 'gom' && styles.selectedChip
                    ]}
                    textStyle={[
                      styles.chipText,
                      formData.user_type === 'gom' && styles.selectedChipText
                    ]}
                  >
                    <¯ Manage group orders
                  </Chip>
                </View>
              </View>

              {/* Country Selection */}
              <View style={styles.countryContainer}>
                <Text style={styles.sectionTitle}>Country</Text>
                <RadioButton.Group
                  onValueChange={(value) => handleInputChange('country', value)}
                  value={formData.country}
                >
                  <View style={styles.radioOption}>
                    <RadioButton value="PH" />
                    <Text style={styles.radioLabel}><õ<í Philippines</Text>
                  </View>
                  <View style={styles.radioOption}>
                    <RadioButton value="MY" />
                    <Text style={styles.radioLabel}><ò<þ Malaysia</Text>
                  </View>
                </RadioButton.Group>
              </View>

              {/* Personal Information */}
              <Text style={styles.sectionTitle}>Personal Information</Text>

              <TextInput
                label="Full Name"
                value={formData.full_name}
                onChangeText={(value) => handleInputChange('full_name', value)}
                mode="outlined"
                style={styles.input}
                autoCapitalize="words"
                error={!!errors.full_name}
                left={<TextInput.Icon icon="account" />}
              />
              {errors.full_name && (
                <HelperText type="error" visible={!!errors.full_name}>
                  {errors.full_name}
                </HelperText>
              )}

              <TextInput
                label="Email"
                value={formData.email}
                onChangeText={(value) => handleInputChange('email', value)}
                mode="outlined"
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                error={!!errors.email}
                left={<TextInput.Icon icon="email" />}
              />
              {errors.email && (
                <HelperText type="error" visible={!!errors.email}>
                  {errors.email}
                </HelperText>
              )}

              <TextInput
                label={`Phone Number (${formData.country === 'PH' ? '+63' : '+60'})`}
                value={formData.phone}
                onChangeText={(value) => handleInputChange('phone', value)}
                mode="outlined"
                style={styles.input}
                keyboardType="phone-pad"
                autoComplete="tel"
                error={!!errors.phone}
                left={<TextInput.Icon icon="phone" />}
              />
              {errors.phone && (
                <HelperText type="error" visible={!!errors.phone}>
                  {errors.phone}
                </HelperText>
              )}

              <TextInput
                label="Password"
                value={formData.password}
                onChangeText={(value) => handleInputChange('password', value)}
                mode="outlined"
                style={styles.input}
                secureTextEntry={!showPassword}
                autoComplete="password-new"
                error={!!errors.password}
                left={<TextInput.Icon icon="lock" />}
                right={
                  <TextInput.Icon
                    icon={showPassword ? "eye-off" : "eye"}
                    onPress={() => setShowPassword(!showPassword)}
                  />
                }
              />
              {errors.password && (
                <HelperText type="error" visible={!!errors.password}>
                  {errors.password}
                </HelperText>
              )}

              <TextInput
                label="Confirm Password"
                value={formData.confirmPassword}
                onChangeText={(value) => handleInputChange('confirmPassword', value)}
                mode="outlined"
                style={styles.input}
                secureTextEntry={!showConfirmPassword}
                error={!!errors.confirmPassword}
                left={<TextInput.Icon icon="lock-check" />}
                right={
                  <TextInput.Icon
                    icon={showConfirmPassword ? "eye-off" : "eye"}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  />
                }
              />
              {errors.confirmPassword && (
                <HelperText type="error" visible={!!errors.confirmPassword}>
                  {errors.confirmPassword}
                </HelperText>
              )}

              {/* Global Error */}
              {error && (
                <HelperText type="error" visible={!!error} style={styles.globalError}>
                  {error}
                </HelperText>
              )}

              {/* Signup Button */}
              <Button
                mode="contained"
                onPress={handleSignup}
                loading={isLoading}
                disabled={isLoading}
                style={styles.signupButton}
                contentStyle={styles.buttonContent}
                labelStyle={styles.buttonText}
              >
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </Button>

              {/* Terms */}
              <Text style={styles.termsText}>
                By creating an account, you agree to our{' '}
                <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
                <Text style={styles.termsLink}>Privacy Policy</Text>
              </Text>
            </View>
          </Card>

          {/* Login Link */}
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <Button
              mode="text"
              onPress={() => navigation.navigate('Login')}
              labelStyle={styles.loginButton}
              compact
            >
              Sign In
            </Button>
          </View>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  logoContainer: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  logo: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    elevation: 2,
    marginBottom: 20,
  },
  formContent: {
    padding: 20,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
    marginTop: 8,
  },
  userTypeContainer: {
    marginBottom: 20,
  },
  userTypeOptions: {
    gap: 10,
  },
  userTypeChip: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selectedChip: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    color: COLORS.text,
  },
  selectedChipText: {
    color: '#FFFFFF',
  },
  countryContainer: {
    marginBottom: 20,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  radioLabel: {
    fontSize: 16,
    color: COLORS.text,
    marginLeft: 8,
  },
  input: {
    marginBottom: 8,
    backgroundColor: COLORS.surface,
  },
  globalError: {
    marginBottom: 10,
  },
  signupButton: {
    backgroundColor: COLORS.primary,
    marginTop: 20,
    marginBottom: 15,
    borderRadius: 25,
  },
  buttonContent: {
    height: 48,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  termsText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    color: COLORS.primary,
    fontWeight: '500',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  loginText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  loginButton: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SignupScreen;
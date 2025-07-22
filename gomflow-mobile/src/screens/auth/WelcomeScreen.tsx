import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Text, Button, Card } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthStackParamList } from '../../types';
import { COLORS } from '../../constants';

type WelcomeScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Welcome'>;

const { width, height } = Dimensions.get('window');

const WelcomeScreen = () => {
  const navigation = useNavigation<WelcomeScreenNavigationProp>();

  const features = [
    {
      icon: '=ñ',
      title: 'Mobile-First Design',
      description: 'Manage orders on the go with our intuitive mobile interface'
    },
    {
      icon: '¡',
      title: '95% Time Reduction',
      description: 'Automate payment tracking and order management'
    },
    {
      icon: '>',
      title: 'AI-Powered Processing',
      description: 'Smart payment verification with screenshot analysis'
    },
    {
      icon: '<',
      title: 'Southeast Asia Ready',
      description: 'Built for Philippines and Malaysia with local payment methods'
    }
  ];

  return (
    <View style={[styles.container, { backgroundColor: COLORS.primary }]}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Logo and Title */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Text style={styles.logo}>G</Text>
            </View>
            <Text style={styles.title}>GOMFLOW</Text>
            <Text style={styles.subtitle}>
              Group Order Management Made Simple
            </Text>
          </View>

          {/* Features */}
          <View style={styles.featuresContainer}>
            {features.map((feature, index) => (
              <Card key={index} style={styles.featureCard}>
                <View style={styles.featureContent}>
                  <Text style={styles.featureIcon}>{feature.icon}</Text>
                  <View style={styles.featureText}>
                    <Text style={styles.featureTitle}>{feature.title}</Text>
                    <Text style={styles.featureDescription}>{feature.description}</Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonsContainer}>
            <Button
              mode="contained"
              onPress={() => navigation.navigate('Signup')}
              style={styles.primaryButton}
              labelStyle={styles.primaryButtonText}
              contentStyle={styles.buttonContent}
            >
              Get Started Free
            </Button>
            
            <Button
              mode="outlined"
              onPress={() => navigation.navigate('Login')}
              style={styles.secondaryButton}
              labelStyle={styles.secondaryButtonText}
              contentStyle={styles.buttonContent}
            >
              Sign In
            </Button>
          </View>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>1,000+</Text>
              <Text style={styles.statLabel}>GOMs</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>10,000+</Text>
              <Text style={styles.statLabel}>Orders</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNumber}>95%</Text>
              <Text style={styles.statLabel}>Time Saved</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 20,
  },
  featuresContainer: {
    flex: 1,
    justifyContent: 'center',
    marginVertical: 20,
  },
  featureCard: {
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
  },
  featureContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  featureIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  buttonsContainer: {
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
    borderRadius: 25,
  },
  primaryButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    borderColor: '#FFFFFF',
    borderWidth: 2,
    borderRadius: 25,
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonContent: {
    height: 50,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingVertical: 20,
    marginBottom: 20,
  },
  stat: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    textTransform: 'uppercase',
  },
});

export default WelcomeScreen;
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';

import { notificationService, NotificationPreferences } from '../services/notificationService';
import { colors, spacing, typography } from '../theme';
import logger from '../utils/logger';

interface NotificationSettingsScreenProps {
  navigation: any;
}

const NotificationSettingsScreen: React.FC<NotificationSettingsScreenProps> = ({ navigation }) => {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    orderUpdates: true,
    paymentReminders: true,
    paymentConfirmations: true,
    systemAnnouncements: true,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
  });

  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const saved = notificationService.getPreferences();
      if (saved) {
        setPreferences(saved);
      }
    } catch (error) {
      logger.error('Failed to load notification preferences:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updatePreference = async (key: keyof NotificationPreferences, value: any) => {
    try {
      const updated = { ...preferences, [key]: value };
      setPreferences(updated);
      await notificationService.updatePreferences({ [key]: value });
    } catch (error) {
      logger.error('Failed to update notification preference:', error);
      Alert.alert('Error', 'Failed to update notification settings. Please try again.');
    }
  };

  const handleTimeChange = (event: any, selectedTime: Date | undefined, isStartTime: boolean) => {
    if (Platform.OS === 'android') {
      setShowStartTimePicker(false);
      setShowEndTimePicker(false);
    }

    if (selectedTime) {
      const timeString = `${selectedTime.getHours().toString().padStart(2, '0')}:${selectedTime.getMinutes().toString().padStart(2, '0')}`;
      
      if (isStartTime) {
        updatePreference('quietHoursStart', timeString);
      } else {
        updatePreference('quietHoursEnd', timeString);
      }
    }
  };

  const parseTime = (timeString: string): Date => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  const formatTime = (timeString: string): string => {
    const date = parseTime(timeString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const testNotification = () => {
    notificationService.showLocalNotification({
      type: 'system_announcement',
      title: 'Test Notification',
      body: 'This is a test notification from GOMFLOW!',
      data: { test: true },
    });
  };

  const clearAllNotifications = () => {
    Alert.alert(
      'Clear Notifications',
      'Are you sure you want to clear all notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: () => notificationService.clearAllNotifications()
        }
      ]
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification Settings</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Notification Types */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notification Types</Text>
          <Text style={styles.sectionDescription}>
            Choose which types of notifications you'd like to receive
          </Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Order Updates</Text>
              <Text style={styles.settingDescription}>
                Get notified when order status changes
              </Text>
            </View>
            <Switch
              value={preferences.orderUpdates}
              onValueChange={(value) => updatePreference('orderUpdates', value)}
              trackColor={{ false: colors.gray300, true: colors.primary }}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Payment Reminders</Text>
              <Text style={styles.settingDescription}>
                Reminders for pending payments
              </Text>
            </View>
            <Switch
              value={preferences.paymentReminders}
              onValueChange={(value) => updatePreference('paymentReminders', value)}
              trackColor={{ false: colors.gray300, true: colors.primary }}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Payment Confirmations</Text>
              <Text style={styles.settingDescription}>
                Confirmations when payments are received
              </Text>
            </View>
            <Switch
              value={preferences.paymentConfirmations}
              onValueChange={(value) => updatePreference('paymentConfirmations', value)}
              trackColor={{ false: colors.gray300, true: colors.primary }}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>System Announcements</Text>
              <Text style={styles.settingDescription}>
                Important updates and announcements
              </Text>
            </View>
            <Switch
              value={preferences.systemAnnouncements}
              onValueChange={(value) => updatePreference('systemAnnouncements', value)}
              trackColor={{ false: colors.gray300, true: colors.primary }}
            />
          </View>
        </View>

        {/* Quiet Hours */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quiet Hours</Text>
          <Text style={styles.sectionDescription}>
            Pause notifications during specific hours
          </Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Enable Quiet Hours</Text>
              <Text style={styles.settingDescription}>
                Turn off notifications during quiet hours
              </Text>
            </View>
            <Switch
              value={preferences.quietHoursEnabled}
              onValueChange={(value) => updatePreference('quietHoursEnabled', value)}
              trackColor={{ false: colors.gray300, true: colors.primary }}
            />
          </View>

          {preferences.quietHoursEnabled && (
            <>
              <TouchableOpacity
                style={styles.timeSettingRow}
                onPress={() => setShowStartTimePicker(true)}
              >
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Start Time</Text>
                  <Text style={styles.settingDescription}>
                    When quiet hours begin
                  </Text>
                </View>
                <Text style={styles.timeValue}>
                  {formatTime(preferences.quietHoursStart)}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.timeSettingRow}
                onPress={() => setShowEndTimePicker(true)}
              >
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>End Time</Text>
                  <Text style={styles.settingDescription}>
                    When quiet hours end
                  </Text>
                </View>
                <Text style={styles.timeValue}>
                  {formatTime(preferences.quietHoursEnd)}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={testNotification}
          >
            <MaterialIcons name="notifications" size={24} color={colors.primary} />
            <Text style={styles.actionButtonText}>Test Notification</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={clearAllNotifications}
          >
            <MaterialIcons name="clear-all" size={24} color={colors.error} />
            <Text style={[styles.actionButtonText, { color: colors.error }]}>
              Clear All Notifications
            </Text>
          </TouchableOpacity>
        </View>

        {/* Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Information</Text>
          <Text style={styles.infoText}>
            Notifications help you stay updated on your orders and payments. 
            You can customize which types of notifications you receive and when.
          </Text>
          <Text style={styles.infoText}>
            Push notifications require device permission. If you're not receiving 
            notifications, check your device settings.
          </Text>
        </View>
      </ScrollView>

      {/* Time Pickers */}
      {showStartTimePicker && (
        <DateTimePicker
          value={parseTime(preferences.quietHoursStart)}
          mode="time"
          is24Hour={false}
          onChange={(event, time) => handleTimeChange(event, time, true)}
          onTouchCancel={() => setShowStartTimePicker(false)}
        />
      )}

      {showEndTimePicker && (
        <DateTimePicker
          value={parseTime(preferences.quietHoursEnd)}
          mode="time"
          is24Hour={false}
          onChange={(event, time) => handleTimeChange(event, time, false)}
          onTouchCancel={() => setShowEndTimePicker(false)}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  timeSettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  settingDescription: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  timeValue: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.primary,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  actionButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.primary,
    marginLeft: spacing.sm,
  },
  infoText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
});

export default NotificationSettingsScreen;
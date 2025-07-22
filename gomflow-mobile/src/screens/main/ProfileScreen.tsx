import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, Button, Avatar, List, Divider, Switch, Dialog, Portal } from 'react-native-paper';
import { useSelector, useDispatch } from 'react-redux';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import { RootState, AppDispatch } from '../../store';
import { signOut } from '../../store/slices/authSlice';
import { COLORS } from '../../constants';

const ProfileScreen = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useSelector((state: RootState) => state.auth);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [signOutDialogVisible, setSignOutDialogVisible] = useState(false);

  const isGOM = user?.user_type === 'gom';

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            dispatch(signOut());
          },
        },
      ]
    );
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatUserType = (type?: string) => {
    if (type === 'gom') return 'Group Order Manager';
    if (type === 'buyer') return 'Buyer';
    return 'User';
  };

  const getCountryFlag = (country?: string) => {
    if (country === 'PH') return '🇵🇭';
    if (country === 'MY') return '🇲🇾';
    return '🌍';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <Card style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <Avatar.Text 
              size={80} 
              label={getInitials(user?.full_name)} 
              style={styles.avatar}
              labelStyle={styles.avatarText}
            />
            <View style={styles.profileInfo}>
              <Text style={styles.userName}>{user?.full_name || 'User'}</Text>
              <Text style={styles.userEmail}>{user?.email}</Text>
              <View style={styles.userMeta}>
                <Text style={styles.userType}>{formatUserType(user?.user_type)}</Text>
                <Text style={styles.userCountry}>
                  {getCountryFlag(user?.country)} {user?.country}
                </Text>
              </View>
            </View>
          </View>
          <Button
            mode="outlined"
            onPress={() => {/* TODO: Navigate to edit profile */}}
            style={styles.editButton}
            icon="pencil"
            compact
          >
            Edit Profile
          </Button>
        </Card>

        {/* Statistics (GOM only) */}
        {isGOM && (
          <Card style={styles.statsCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Your Statistics</Text>
            </View>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <MaterialIcons name="shopping-bag" size={24} color={COLORS.primary} />
                <Text style={styles.statNumber}>12</Text>
                <Text style={styles.statLabel}>Active Orders</Text>
              </View>
              <View style={styles.statItem}>
                <MaterialIcons name="done-all" size={24} color={COLORS.success} />
                <Text style={styles.statNumber}>45</Text>
                <Text style={styles.statLabel}>Completed</Text>
              </View>
              <View style={styles.statItem}>
                <MaterialIcons name="attach-money" size={24} color={COLORS.success} />
                <Text style={styles.statNumber}>₱15.7K</Text>
                <Text style={styles.statLabel}>Revenue</Text>
              </View>
              <View style={styles.statItem}>
                <MaterialIcons name="star" size={24} color={COLORS.warning} />
                <Text style={styles.statNumber}>4.8</Text>
                <Text style={styles.statLabel}>Rating</Text>
              </View>
            </View>
          </Card>
        )}

        {/* Account Settings */}
        <Card style={styles.settingsCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Account Settings</Text>
          </View>
          <List.Item
            title="Personal Information"
            description="Update your profile details"
            left={props => <List.Icon {...props} icon="account-edit" color={COLORS.primary} />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => {/* TODO: Navigate to edit profile */}}
          />
          <Divider />
          <List.Item
            title="Payment Methods"
            description="Manage your payment options"
            left={props => <List.Icon {...props} icon="credit-card" color={COLORS.primary} />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => {/* TODO: Navigate to payment methods */}}
          />
          <Divider />
          <List.Item
            title="Shipping Addresses"
            description="Manage delivery locations"
            left={props => <List.Icon {...props} icon="map-marker" color={COLORS.primary} />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => {/* TODO: Navigate to addresses */}}
          />
          <Divider />
          <List.Item
            title="Security"
            description="Password and two-factor authentication"
            left={props => <List.Icon {...props} icon="shield-account" color={COLORS.primary} />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => {/* TODO: Navigate to security settings */}}
          />
        </Card>

        {/* Notification Settings */}
        <Card style={styles.settingsCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Notifications</Text>
          </View>
          <List.Item
            title="Email Notifications"
            description="Receive updates via email"
            left={props => <List.Icon {...props} icon="email" color={COLORS.primary} />}
            right={() => (
              <Switch
                value={emailNotifications}
                onValueChange={setEmailNotifications}
                color={COLORS.primary}
              />
            )}
          />
          <Divider />
          <List.Item
            title="Push Notifications"
            description="Get alerts on your device"
            left={props => <List.Icon {...props} icon="bell" color={COLORS.primary} />}
            right={() => (
              <Switch
                value={pushNotifications}
                onValueChange={setPushNotifications}
                color={COLORS.primary}
              />
            )}
          />
          <Divider />
          <List.Item
            title="SMS Notifications"
            description="Receive text message alerts"
            left={props => <List.Icon {...props} icon="message-text" color={COLORS.primary} />}
            right={() => (
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                color={COLORS.primary}
              />
            )}
          />
        </Card>

        {/* App Settings */}
        <Card style={styles.settingsCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>App Settings</Text>
          </View>
          <List.Item
            title="Language"
            description="English"
            left={props => <List.Icon {...props} icon="translate" color={COLORS.primary} />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => {/* TODO: Navigate to language settings */}}
          />
          <Divider />
          <List.Item
            title="Currency"
            description={user?.country === 'PH' ? 'Philippine Peso (₱)' : 'Malaysian Ringgit (RM)'}
            left={props => <List.Icon {...props} icon="currency-usd" color={COLORS.primary} />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => {/* TODO: Navigate to currency settings */}}
          />
          <Divider />
          <List.Item
            title="Dark Mode"
            description="Switch to dark theme"
            left={props => <List.Icon {...props} icon="theme-light-dark" color={COLORS.primary} />}
            right={() => (
              <Switch
                value={false}
                onValueChange={() => {/* TODO: Implement dark mode */}}
                color={COLORS.primary}
              />
            )}
          />
        </Card>

        {/* Support & Info */}
        <Card style={styles.settingsCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Support & Information</Text>
          </View>
          <List.Item
            title="Help Center"
            description="Get help and find answers"
            left={props => <List.Icon {...props} icon="help-circle" color={COLORS.primary} />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => {/* TODO: Navigate to help center */}}
          />
          <Divider />
          <List.Item
            title="Contact Support"
            description="Get in touch with our team"
            left={props => <List.Icon {...props} icon="headphones" color={COLORS.primary} />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => {/* TODO: Navigate to contact support */}}
          />
          <Divider />
          <List.Item
            title="Privacy Policy"
            description="Read our privacy policy"
            left={props => <List.Icon {...props} icon="shield-check" color={COLORS.primary} />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => {/* TODO: Navigate to privacy policy */}}
          />
          <Divider />
          <List.Item
            title="Terms of Service"
            description="Read our terms of service"
            left={props => <List.Icon {...props} icon="file-document" color={COLORS.primary} />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => {/* TODO: Navigate to terms of service */}}
          />
          <Divider />
          <List.Item
            title="About GOMFLOW"
            description="Version 1.0.0"
            left={props => <List.Icon {...props} icon="information" color={COLORS.primary} />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
            onPress={() => {/* TODO: Navigate to about page */}}
          />
        </Card>

        {/* Sign Out */}
        <Card style={[styles.settingsCard, styles.signOutCard]}>
          <List.Item
            title="Sign Out"
            description="Sign out of your account"
            titleStyle={styles.signOutText}
            left={props => <List.Icon {...props} icon="logout" color={COLORS.error} />}
            onPress={handleSignOut}
          />
        </Card>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Made with ❤️ for the K-pop community
          </Text>
          <Text style={styles.versionText}>
            GOMFLOW v1.0.0
          </Text>
        </View>
      </ScrollView>

      {/* Sign Out Dialog */}
      <Portal>
        <Dialog visible={signOutDialogVisible} onDismiss={() => setSignOutDialogVisible(false)}>
          <Dialog.Title>Sign Out</Dialog.Title>
          <Dialog.Content>
            <Text>Are you sure you want to sign out of your account?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setSignOutDialogVisible(false)}>Cancel</Button>
            <Button
              onPress={() => {
                setSignOutDialogVisible(false);
                dispatch(signOut());
              }}
              textColor={COLORS.error}
            >
              Sign Out
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
  profileCard: {
    marginBottom: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    elevation: 2,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
  },
  avatar: {
    backgroundColor: COLORS.primary,
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userType: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
    backgroundColor: `${COLORS.primary}20`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  userCountry: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  editButton: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 8,
  },
  statsCard: {
    marginBottom: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    elevation: 2,
  },
  cardHeader: {
    padding: 16,
    paddingBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  settingsCard: {
    marginBottom: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    elevation: 2,
    overflow: 'hidden',
  },
  signOutCard: {
    borderColor: COLORS.error,
    borderWidth: 1,
  },
  signOutText: {
    color: COLORS.error,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 40,
  },
  footerText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  versionText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});

export default ProfileScreen;
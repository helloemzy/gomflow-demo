import { Linking, Alert } from 'react-native';
import { NavigationContainerRef } from '@react-navigation/native';

import logger from '../utils/logger';
import { store } from '../store';
import { RootStackParamList } from '../navigation/types';

export interface DeepLinkData {
  url: string;
  orderId?: string;
  submissionId?: string;
  action?: string;
  params?: Record<string, string>;
}

export interface DeepLinkConfig {
  scheme: string;
  domain?: string;
  prefixes: string[];
}

class DeepLinkService {
  private navigationRef: React.RefObject<NavigationContainerRef<RootStackParamList>> | null = null;
  private config: DeepLinkConfig;
  private pendingLink: string | null = null;
  private isInitialized: boolean = false;

  constructor() {
    this.config = {
      scheme: 'gomflow',
      domain: 'gomflow.com',
      prefixes: [
        'gomflow://',
        'https://gomflow.com',
        'https://app.gomflow.com',
      ],
    };

    this.initializeDeepLinking();
  }

  /**
   * Initialize deep linking
   */
  async initializeDeepLinking(): Promise<void> {
    try {
      logger.info('Initializing deep linking service...');

      // Add URL event listener
      Linking.addEventListener('url', this.handleIncomingURL);

      // Check if app was opened from a URL
      const initialURL = await Linking.getInitialURL();
      if (initialURL) {
        logger.info('App opened with initial URL:', initialURL);
        this.pendingLink = initialURL;
      }

      this.isInitialized = true;
      logger.info('Deep linking service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize deep linking service:', error);
    }
  }

  /**
   * Set navigation reference
   */
  setNavigationRef(ref: React.RefObject<NavigationContainerRef<RootStackParamList>>): void {
    this.navigationRef = ref;
    
    // Process pending link if available
    if (this.pendingLink) {
      this.handleDeepLink(this.pendingLink);
      this.pendingLink = null;
    }
  }

  /**
   * Handle incoming URL
   */
  private handleIncomingURL = (event: { url: string }): void => {
    logger.info('Incoming URL received:', event.url);
    this.handleDeepLink(event.url);
  };

  /**
   * Parse deep link URL
   */
  parseDeepLink(url: string): DeepLinkData | null {
    try {
      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname.split('/').filter(Boolean);
      const searchParams = new URLSearchParams(urlObj.search);

      // Convert search params to object
      const params: Record<string, string> = {};
      searchParams.forEach((value, key) => {
        params[key] = value;
      });

      const linkData: DeepLinkData = {
        url,
        params,
      };

      // Parse different URL patterns
      if (pathSegments.length === 0) {
        // gomflow:// or https://gomflow.com/
        linkData.action = 'home';
      } else if (pathSegments[0] === 'order' && pathSegments[1]) {
        // gomflow://order/{orderId} or gomflow://order/{orderId}/payment
        linkData.orderId = pathSegments[1];
        linkData.action = pathSegments[2] === 'payment' ? 'payment' : 'order_detail';
      } else if (pathSegments[0] === 'submission' && pathSegments[1]) {
        // gomflow://submission/{submissionId}
        linkData.submissionId = pathSegments[1];
        linkData.action = 'submission_detail';
      } else if (pathSegments[0] === 'dashboard') {
        // gomflow://dashboard
        linkData.action = 'dashboard';
      } else if (pathSegments[0] === 'browse') {
        // gomflow://browse
        linkData.action = 'browse';
      } else if (pathSegments[0] === 'profile') {
        // gomflow://profile
        linkData.action = 'profile';
      } else if (pathSegments[0] === 'settings') {
        // gomflow://settings
        linkData.action = 'settings';
      } else if (pathSegments[0] === 'notifications') {
        // gomflow://notifications
        linkData.action = 'notifications';
      } else {
        logger.warn('Unknown deep link pattern:', url);
        return null;
      }

      return linkData;
    } catch (error) {
      logger.error('Failed to parse deep link:', error);
      return null;
    }
  }

  /**
   * Handle deep link navigation
   */
  async handleDeepLink(url: string): Promise<void> {
    try {
      if (!this.navigationRef?.current) {
        logger.warn('Navigation ref not available, storing link for later');
        this.pendingLink = url;
        return;
      }

      const linkData = this.parseDeepLink(url);
      if (!linkData) {
        logger.error('Failed to parse deep link:', url);
        return;
      }

      // Check authentication for protected routes
      const state = store.getState();
      const isAuthenticated = !!state.auth.user;

      if (!isAuthenticated && this.requiresAuthentication(linkData.action)) {
        // Store link and redirect to login
        this.pendingLink = url;
        this.navigateToLogin();
        return;
      }

      // Navigate based on action
      await this.navigateToDestination(linkData);
    } catch (error) {
      logger.error('Failed to handle deep link:', error);
      this.showDeepLinkError();
    }
  }

  /**
   * Navigate to destination based on link data
   */
  private async navigateToDestination(linkData: DeepLinkData): Promise<void> {
    const navigation = this.navigationRef?.current;
    if (!navigation) return;

    switch (linkData.action) {
      case 'home':
      case 'dashboard':
        navigation.navigate('MainTabs', { screen: 'Dashboard' });
        break;

      case 'order_detail':
        if (linkData.orderId) {
          navigation.navigate('OrderDetail', { orderId: linkData.orderId });
        }
        break;

      case 'payment':
        if (linkData.orderId) {
          navigation.navigate('OrderSubmission', { orderId: linkData.orderId });
        }
        break;

      case 'submission_detail':
        if (linkData.submissionId) {
          // Navigate to submission detail (would need to be implemented)
          navigation.navigate('MainTabs', { 
            screen: 'Orders',
            params: { submissionId: linkData.submissionId }
          });
        }
        break;

      case 'browse':
        navigation.navigate('MainTabs', { screen: 'Browse' });
        break;

      case 'profile':
        navigation.navigate('MainTabs', { screen: 'Profile' });
        break;

      case 'settings':
        navigation.navigate('Settings');
        break;

      case 'notifications':
        navigation.navigate('Notifications');
        break;

      default:
        logger.warn('Unknown deep link action:', linkData.action);
        navigation.navigate('MainTabs', { screen: 'Dashboard' });
    }
  }

  /**
   * Check if action requires authentication
   */
  private requiresAuthentication(action?: string): boolean {
    const publicActions = ['home'];
    return !publicActions.includes(action || '');
  }

  /**
   * Navigate to login screen
   */
  private navigateToLogin(): void {
    const navigation = this.navigationRef?.current;
    if (navigation) {
      navigation.navigate('Login');
    }
  }

  /**
   * Show deep link error
   */
  private showDeepLinkError(): void {
    Alert.alert(
      'Link Error',
      'Sorry, we couldn\'t open that link. Please try again or navigate manually.',
      [
        { text: 'OK', style: 'default' },
        { 
          text: 'Go to Dashboard', 
          style: 'default',
          onPress: () => {
            const navigation = this.navigationRef?.current;
            if (navigation) {
              navigation.navigate('MainTabs', { screen: 'Dashboard' });
            }
          }
        }
      ]
    );
  }

  /**
   * Generate deep link URL
   */
  generateDeepLink(action: string, params: Record<string, string> = {}): string {
    const baseUrl = `${this.config.scheme}://`;
    const queryString = Object.keys(params).length > 0 
      ? '?' + new URLSearchParams(params).toString()
      : '';

    switch (action) {
      case 'order_detail':
        return `${baseUrl}order/${params.orderId}${queryString}`;
      case 'payment':
        return `${baseUrl}order/${params.orderId}/payment${queryString}`;
      case 'submission_detail':
        return `${baseUrl}submission/${params.submissionId}${queryString}`;
      case 'dashboard':
        return `${baseUrl}dashboard${queryString}`;
      case 'browse':
        return `${baseUrl}browse${queryString}`;
      case 'profile':
        return `${baseUrl}profile${queryString}`;
      case 'settings':
        return `${baseUrl}settings${queryString}`;
      case 'notifications':
        return `${baseUrl}notifications${queryString}`;
      default:
        return `${baseUrl}${queryString}`;
    }
  }

  /**
   * Generate web link (for sharing)
   */
  generateWebLink(action: string, params: Record<string, string> = {}): string {
    const baseUrl = `https://${this.config.domain}`;
    const queryString = Object.keys(params).length > 0 
      ? '?' + new URLSearchParams(params).toString()
      : '';

    switch (action) {
      case 'order_detail':
        return `${baseUrl}/order/${params.orderId}${queryString}`;
      case 'browse':
        return `${baseUrl}/browse${queryString}`;
      default:
        return `${baseUrl}${queryString}`;
    }
  }

  /**
   * Open external URL
   */
  async openExternalURL(url: string): Promise<boolean> {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        return true;
      } else {
        logger.warn('Cannot open URL:', url);
        return false;
      }
    } catch (error) {
      logger.error('Failed to open external URL:', error);
      return false;
    }
  }

  /**
   * Share order link
   */
  async shareOrderLink(orderId: string): Promise<string> {
    const webLink = this.generateWebLink('order_detail', { orderId });
    return webLink;
  }

  /**
   * Process pending link after authentication
   */
  processPendingLink(): void {
    if (this.pendingLink) {
      const link = this.pendingLink;
      this.pendingLink = null;
      this.handleDeepLink(link);
    }
  }

  /**
   * Clear pending link
   */
  clearPendingLink(): void {
    this.pendingLink = null;
  }

  /**
   * Get deep link configuration
   */
  getConfiguration(): DeepLinkConfig {
    return this.config;
  }

  /**
   * Check if service is initialized
   */
  isServiceInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Cleanup service
   */
  cleanup(): void {
    Linking.removeAllListeners('url');
    this.pendingLink = null;
    this.navigationRef = null;
  }
}

export const deepLinkService = new DeepLinkService();
export default deepLinkService;
/**
 * OAuth Provider Factory
 * Creates and manages OAuth providers for different social media platforms
 */

import { TwitterOAuthProvider } from './platforms/twitter';
import { InstagramOAuthProvider } from './platforms/instagram';
import { TikTokOAuthProvider } from './platforms/tiktok';
import { FacebookOAuthProvider } from './platforms/facebook';
import { DiscordOAuthProvider } from './platforms/discord';
import { TelegramOAuthProvider } from './platforms/telegram';
import { BaseOAuthProvider, OAuthConfig } from './base';

// Supported platforms
export type SupportedPlatform = 'twitter' | 'instagram' | 'tiktok' | 'facebook' | 'discord' | 'telegram';

// Platform configurations interface
interface PlatformConfigs {
  [key: string]: Omit<OAuthConfig, 'baseUrl' | 'authUrl' | 'tokenUrl'>;
}

// Environment variable mapping
const ENV_MAPPING = {
  twitter: {
    clientId: 'TWITTER_CLIENT_ID',
    clientSecret: 'TWITTER_CLIENT_SECRET',
    redirectUri: 'TWITTER_REDIRECT_URI',
  },
  instagram: {
    clientId: 'INSTAGRAM_CLIENT_ID',
    clientSecret: 'INSTAGRAM_CLIENT_SECRET',
    redirectUri: 'INSTAGRAM_REDIRECT_URI',
  },
  tiktok: {
    clientId: 'TIKTOK_CLIENT_ID',
    clientSecret: 'TIKTOK_CLIENT_SECRET',
    redirectUri: 'TIKTOK_REDIRECT_URI',
  },
  facebook: {
    clientId: 'FACEBOOK_CLIENT_ID',
    clientSecret: 'FACEBOOK_CLIENT_SECRET',
    redirectUri: 'FACEBOOK_REDIRECT_URI',
  },
  discord: {
    clientId: 'DISCORD_CLIENT_ID',
    clientSecret: 'DISCORD_CLIENT_SECRET',
    redirectUri: 'DISCORD_REDIRECT_URI',
  },
  telegram: {
    clientId: 'TELEGRAM_BOT_TOKEN',
    clientSecret: 'TELEGRAM_BOT_TOKEN',
    redirectUri: 'TELEGRAM_REDIRECT_URI',
  },
};

// Default scopes for each platform
const DEFAULT_SCOPES = {
  twitter: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
  instagram: ['instagram_basic', 'instagram_content_publish'],
  tiktok: ['user.info.basic', 'video.list', 'video.upload'],
  facebook: ['pages_manage_posts', 'pages_read_engagement', 'publish_to_groups'],
  discord: ['identify', 'guilds', 'guilds.join'],
  telegram: ['message', 'inline_query', 'callback_query'],
};

// Default redirect URIs
const getDefaultRedirectUri = (platform: string): string => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${baseUrl}/api/social/auth/${platform}/callback`;
};

// Provider instances cache
const providerCache = new Map<string, BaseOAuthProvider>();

/**
 * Get platform configuration from environment variables
 */
function getPlatformConfig(platform: SupportedPlatform): Omit<OAuthConfig, 'baseUrl' | 'authUrl' | 'tokenUrl'> {
  const envMapping = ENV_MAPPING[platform];
  
  if (!envMapping) {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  const clientId = process.env[envMapping.clientId];
  const clientSecret = process.env[envMapping.clientSecret];
  const redirectUri = process.env[envMapping.redirectUri] || getDefaultRedirectUri(platform);

  if (!clientId || !clientSecret) {
    throw new Error(`Missing OAuth configuration for ${platform}. Please set ${envMapping.clientId} and ${envMapping.clientSecret} environment variables.`);
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    scopes: DEFAULT_SCOPES[platform] || [],
  };
}

/**
 * Create OAuth provider instance
 */
function createProvider(platform: SupportedPlatform): BaseOAuthProvider {
  const config = getPlatformConfig(platform);
  
  switch (platform) {
    case 'twitter':
      return new TwitterOAuthProvider(config);
    
    case 'instagram':
      return new InstagramOAuthProvider(config);
    
    case 'tiktok':
      return new TikTokOAuthProvider(config);
    
    case 'facebook':
      return new FacebookOAuthProvider(config);
    
    case 'discord':
      return new DiscordOAuthProvider(config);
    
    case 'telegram':
      return new TelegramOAuthProvider(config);
    
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

/**
 * Get OAuth provider instance (with caching)
 */
export function getOAuthProvider(platform: string): BaseOAuthProvider {
  if (!isSupportedPlatform(platform)) {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  // Check cache first
  if (providerCache.has(platform)) {
    return providerCache.get(platform)!;
  }

  try {
    // Create new provider instance
    const provider = createProvider(platform as SupportedPlatform);
    
    // Cache the instance
    providerCache.set(platform, provider);
    
    return provider;
  } catch (error) {
    console.error(`Failed to create OAuth provider for ${platform}:`, error);
    throw new Error(`OAuth provider initialization failed for ${platform}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if platform is supported
 */
export function isSupportedPlatform(platform: string): platform is SupportedPlatform {
  return Object.keys(ENV_MAPPING).includes(platform);
}

/**
 * Get list of supported platforms
 */
export function getSupportedPlatforms(): SupportedPlatform[] {
  return Object.keys(ENV_MAPPING) as SupportedPlatform[];
}

/**
 * Get configured platforms (those with valid environment variables)
 */
export function getConfiguredPlatforms(): SupportedPlatform[] {
  const configuredPlatforms: SupportedPlatform[] = [];
  
  for (const platform of getSupportedPlatforms()) {
    try {
      getPlatformConfig(platform);
      configuredPlatforms.push(platform);
    } catch (error) {
      // Platform not configured, skip it
      console.warn(`Platform ${platform} is not configured:`, error instanceof Error ? error.message : 'Unknown error');
    }
  }
  
  return configuredPlatforms;
}

/**
 * Get platform display information
 */
export function getPlatformInfo(platform: SupportedPlatform): {
  id: string;
  name: string;
  displayName: string;
  color: string;
  icon: string;
  description: string;
  features: string[];
} {
  const platformInfo = {
    twitter: {
      id: 'twitter',
      name: 'twitter',
      displayName: 'Twitter/X',
      color: '#1DA1F2',
      icon: '𝕏',
      description: 'Share updates and engage with your audience on X (formerly Twitter)',
      features: ['Post tweets', 'Upload media', 'Get analytics', 'Manage followers'],
    },
    instagram: {
      id: 'instagram',
      name: 'instagram',
      displayName: 'Instagram',
      color: '#E4405F',
      icon: '📷',
      description: 'Share photos and videos with your Instagram followers',
      features: ['Post photos/videos', 'Stories', 'Get insights', 'Manage content'],
    },
    tiktok: {
      id: 'tiktok',
      name: 'tiktok',
      displayName: 'TikTok',
      color: '#FF0050',
      icon: '🎵',
      description: 'Create and share short-form videos on TikTok',
      features: ['Upload videos', 'Get analytics', 'Manage content', 'View comments'],
    },
    facebook: {
      id: 'facebook',
      name: 'facebook',
      displayName: 'Facebook',
      color: '#1877F2',
      icon: '👤',
      description: 'Connect with your audience on Facebook and manage pages',
      features: ['Post updates', 'Manage pages', 'Get insights', 'Schedule posts'],
    },
    discord: {
      id: 'discord',
      name: 'discord',
      displayName: 'Discord',
      color: '#5865F2',
      icon: '🎮',
      description: 'Engage with communities and manage Discord servers',
      features: ['Send messages', 'Manage servers', 'Create webhooks', 'Bot integration'],
    },
    telegram: {
      id: 'telegram',
      name: 'telegram',
      displayName: 'Telegram',
      color: '#0088CC',
      icon: '✈️',
      description: 'Send messages and manage Telegram bots and channels',
      features: ['Send messages', 'Bot management', 'Channel posting', 'Inline keyboards'],
    },
  };

  return platformInfo[platform];
}

/**
 * Get all platform information for configured platforms
 */
export function getAllPlatformInfo(): Array<{
  id: string;
  name: string;
  displayName: string;
  color: string;
  icon: string;
  description: string;
  features: string[];
  configured: boolean;
}> {
  const configuredPlatforms = getConfiguredPlatforms();
  
  return getSupportedPlatforms().map(platform => ({
    ...getPlatformInfo(platform),
    configured: configuredPlatforms.includes(platform),
  }));
}

/**
 * Validate platform configuration
 */
export function validatePlatformConfig(platform: SupportedPlatform): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    const config = getPlatformConfig(platform);
    
    // Check required fields
    if (!config.clientId) {
      errors.push('Client ID is required');
    }
    
    if (!config.clientSecret) {
      errors.push('Client Secret is required');
    }
    
    if (!config.redirectUri) {
      warnings.push('Redirect URI not set, using default');
    } else {
      // Validate redirect URI format
      try {
        new URL(config.redirectUri);
      } catch {
        errors.push('Invalid redirect URI format');
      }
    }
    
    // Check scopes
    if (!config.scopes || config.scopes.length === 0) {
      warnings.push('No scopes configured, using defaults');
    }
    
    // Platform-specific validations
    switch (platform) {
      case 'telegram':
        if (!config.clientId.includes(':')) {
          errors.push('Telegram bot token format is invalid');
        }
        break;
      
      case 'discord':
        if (config.clientId.length !== 18) {
          warnings.push('Discord client ID should be 18 characters');
        }
        break;
    }
    
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Configuration error');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Clear provider cache (useful for testing or config changes)
 */
export function clearProviderCache(): void {
  providerCache.clear();
}

/**
 * Get provider cache size
 */
export function getProviderCacheSize(): number {
  return providerCache.size;
}

/**
 * Health check for all configured platforms
 */
export async function healthCheckPlatforms(): Promise<{
  [platform: string]: {
    configured: boolean;
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
}> {
  const results: { [platform: string]: any } = {};
  
  for (const platform of getSupportedPlatforms()) {
    try {
      const validation = validatePlatformConfig(platform);
      results[platform] = {
        configured: true,
        ...validation,
      };
    } catch (error) {
      results[platform] = {
        configured: false,
        valid: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        warnings: [],
      };
    }
  }
  
  return results;
}

// Export types
export type { SupportedPlatform, OAuthConfig };
export { BaseOAuthProvider };
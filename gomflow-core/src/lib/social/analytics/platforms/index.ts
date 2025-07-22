// GOMFLOW Social Media Analytics Platforms Index
// Export all platform analytics services

export { default as BasePlatformAnalytics } from './base';
export type { 
  PlatformConfig, 
  AnalyticsMetrics, 
  PostAnalytics, 
  AudienceInsights, 
  EngagementData 
} from './base';

export { default as TwitterAnalytics } from './twitter';
export { default as InstagramAnalytics } from './instagram';
export { default as FacebookAnalytics } from './facebook';
export { default as TikTokAnalytics } from './tiktok';
export { default as DiscordAnalytics } from './discord';
export { default as TelegramAnalytics } from './telegram';

// Platform factory
import TwitterAnalytics from './twitter';
import InstagramAnalytics from './instagram';
import FacebookAnalytics from './facebook';
import TikTokAnalytics from './tiktok';
import DiscordAnalytics from './discord';
import TelegramAnalytics from './telegram';
import { PlatformConfig } from './base';

export type SupportedPlatform = 'twitter' | 'instagram' | 'facebook' | 'tiktok' | 'discord' | 'telegram';

export class PlatformAnalyticsFactory {
  private static instances = new Map<string, any>();

  static createAnalytics(platform: SupportedPlatform, config: PlatformConfig) {
    const cacheKey = `${platform}_${JSON.stringify(config)}`;
    
    if (this.instances.has(cacheKey)) {
      return this.instances.get(cacheKey);
    }

    let analyticsInstance;

    switch (platform) {
      case 'twitter':
        analyticsInstance = new TwitterAnalytics(config);
        break;
      case 'instagram':
        analyticsInstance = new InstagramAnalytics(config);
        break;
      case 'facebook':
        analyticsInstance = new FacebookAnalytics(config);
        break;
      case 'tiktok':
        analyticsInstance = new TikTokAnalytics(config);
        break;
      case 'discord':
        analyticsInstance = new DiscordAnalytics(config);
        break;
      case 'telegram':
        analyticsInstance = new TelegramAnalytics(config);
        break;
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }

    this.instances.set(cacheKey, analyticsInstance);
    return analyticsInstance;
  }

  static getSupportedPlatforms(): SupportedPlatform[] {
    return ['twitter', 'instagram', 'facebook', 'tiktok', 'discord', 'telegram'];
  }

  static clearCache(): void {
    this.instances.clear();
  }
}

export default PlatformAnalyticsFactory;
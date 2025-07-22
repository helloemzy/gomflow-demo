/**
 * Posting Service Factory
 * Creates platform-specific posting services using the OAuth system
 */

import { TwitterPostingService } from './twitter';
import { InstagramPostingService } from './instagram';
import { FacebookPostingService } from './facebook';
import { TikTokPostingService } from './tiktok';
import { DiscordPostingService } from './discord';
import { TelegramPostingService } from './telegram';
import { BasePostingService } from './base';

export class PostingServiceFactory {
  private static services: Map<string, BasePostingService> = new Map();

  /**
   * Get posting service for a specific platform
   */
  static getService(platformId: string): BasePostingService {
    if (!this.services.has(platformId)) {
      const service = this.createService(platformId);
      this.services.set(platformId, service);
    }

    const service = this.services.get(platformId);
    if (!service) {
      throw new Error(`Unsupported platform: ${platformId}`);
    }

    return service;
  }

  /**
   * Create a new posting service instance
   */
  private static createService(platformId: string): BasePostingService {
    switch (platformId) {
      case 'twitter':
        return new TwitterPostingService();
      case 'instagram':
        return new InstagramPostingService();
      case 'facebook':
        return new FacebookPostingService();
      case 'tiktok':
        return new TikTokPostingService();
      case 'discord':
        return new DiscordPostingService();
      case 'telegram':
        return new TelegramPostingService();
      default:
        throw new Error(`Unsupported platform: ${platformId}`);
    }
  }

  /**
   * Get all supported platforms
   */
  static getSupportedPlatforms(): string[] {
    return ['twitter', 'instagram', 'facebook', 'tiktok', 'discord', 'telegram'];
  }

  /**
   * Clear service cache (useful for testing)
   */
  static clearCache(): void {
    this.services.clear();
  }
}

export default PostingServiceFactory;
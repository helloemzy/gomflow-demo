// GOMFLOW Discord Analytics Service
// Analytics collection for Discord platform

import { BasePlatformAnalytics, PlatformConfig, AnalyticsMetrics, PostAnalytics, AudienceInsights, EngagementData } from './base';

export class DiscordAnalytics extends BasePlatformAnalytics {
  constructor(config: PlatformConfig) {
    super('discord', {
      ...config,
      baseUrl: config.baseUrl || 'https://discord.com/api',
      apiVersion: config.apiVersion || 'v10',
      rateLimits: {
        requests: 50,
        windowMs: 60 * 1000 // 1 minute
      }
    });
  }

  protected getAuthHeaders(): Record<string, string> {
    return {
      'Authorization': `Bot ${this.config.accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  async fetchAccountAnalytics(accountId: string): Promise<AnalyticsMetrics> {
    try {
      // For Discord, accountId would be a guild (server) ID
      const guild = await this.apiRequest(`/guilds/${accountId}`);
      
      if (!guild) {
        throw new Error('Guild not found');
      }

      // Get guild member count
      const memberCount = guild.approximate_member_count || guild.member_count || 0;
      
      // Get channels for message counting
      const channels = await this.apiRequest(`/guilds/${accountId}/channels`);
      const textChannels = channels.filter((c: any) => c.type === 0); // Text channels

      // Calculate approximate activity metrics
      let totalMessages = 0;
      let totalReactions = 0;
      
      for (const channel of textChannels.slice(0, 5)) { // Limit to avoid rate limits
        try {
          const messages = await this.apiRequest(`/channels/${channel.id}/messages?limit=100`);
          totalMessages += messages.length;
          
          // Count reactions on recent messages
          messages.forEach((msg: any) => {
            if (msg.reactions) {
              totalReactions += msg.reactions.reduce((sum: number, r: any) => sum + r.count, 0);
            }
          });
        } catch (error) {
          console.warn(`Cannot access channel ${channel.id}: ${error}`);
        }
      }

      return {
        followers: memberCount,
        following: 0, // Not applicable for Discord servers
        posts: totalMessages,
        engagement_rate: this.calculateDiscordEngagementRate(totalMessages, totalReactions, memberCount),
        reach: memberCount, // Approximate: all members can see messages
        impressions: totalMessages * Math.ceil(memberCount * 0.1) // Estimate: 10% active users see each message
      };
    } catch (error) {
      console.error('Error fetching Discord analytics:', error);
      throw error;
    }
  }

  async fetchPostsAnalytics(
    accountId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<PostAnalytics[]> {
    try {
      const guild = await this.apiRequest(`/guilds/${accountId}`);
      const channels = await this.apiRequest(`/guilds/${accountId}/channels`);
      const textChannels = channels.filter((c: any) => c.type === 0);

      const postsAnalytics: PostAnalytics[] = [];

      for (const channel of textChannels.slice(0, 10)) { // Limit channels to process
        try {
          const messages = await this.apiRequest(`/channels/${channel.id}/messages?limit=100`);

          for (const message of messages) {
            const messageDate = new Date(message.timestamp);
            
            // Filter by date range
            if (messageDate < dateRange.start || messageDate > dateRange.end) {
              continue;
            }

            // Skip bot messages unless they're from the guild owner
            if (message.author.bot && message.author.id !== guild.owner_id) {
              continue;
            }

            // Count reactions
            const reactions = message.reactions || [];
            const totalReactions = reactions.reduce((sum: number, r: any) => sum + r.count, 0);

            // Get message attachments
            const mediaUrls = message.attachments?.map((a: any) => a.url) || [];
            if (message.embeds) {
              message.embeds.forEach((embed: any) => {
                if (embed.image?.url) mediaUrls.push(embed.image.url);
                if (embed.thumbnail?.url) mediaUrls.push(embed.thumbnail.url);
                if (embed.video?.url) mediaUrls.push(embed.video.url);
              });
            }

            // Extract mentions and hashtags
            const mentions = this.extractMentions(message.content);
            const hashtags = this.extractHashtags(message.content);

            // Determine post type
            const postType = this.determinePostType(message);

            postsAnalytics.push({
              id: message.id,
              platform_post_id: message.id,
              content: message.content,
              media_urls: mediaUrls,
              hashtags,
              mentions,
              post_type: postType,
              posted_at: message.timestamp,
              likes: totalReactions,
              comments: 0, // Discord doesn't have traditional comments (would need to track replies)
              shares: 0, // Discord doesn't have shares
              reach: guild.approximate_member_count || 100, // Estimate
              impressions: guild.approximate_member_count || 100,
              engagement_rate: this.calculateMessageEngagementRate(totalReactions, guild.approximate_member_count || 100),
              sentiment_score: await this.analyzeSentiment(message.content)
            });
          }
        } catch (error) {
          console.warn(`Cannot process channel ${channel.id}: ${error}`);
        }
      }

      return postsAnalytics;
    } catch (error) {
      console.error('Error fetching Discord posts analytics:', error);
      return [];
    }
  }

  async fetchAudienceInsights(accountId: string): Promise<AudienceInsights> {
    try {
      const guild = await this.apiRequest(`/guilds/${accountId}?with_counts=true`);
      
      // Discord has limited demographic data available through API
      // Most insights would come from bot interactions or surveys
      
      return {
        demographics: {
          age_groups: {
            '13-17': 20,
            '18-24': 40,
            '25-34': 25,
            '35-44': 10,
            '45+': 5
          }, // Typical Discord demographics
          gender: {
            'unknown': 100 // Discord doesn't provide gender data
          },
          locations: {} // Would need to analyze from user timezones/activity
        },
        interests: [
          'gaming',
          'technology',
          'anime',
          'music',
          'art',
          'programming',
          'community',
          'streaming',
          'esports',
          'memes'
        ], // Common Discord interests
        active_hours: await this.getActiveHours(accountId),
        growth_metrics: {
          new_followers: 0, // Would need historical data
          unfollowers: 0,
          net_growth: guild.approximate_member_count - (guild.member_count || 0)
        }
      };
    } catch (error) {
      console.error('Error fetching Discord audience insights:', error);
      return {
        demographics: {
          age_groups: {},
          gender: {},
          locations: {}
        },
        interests: [],
        active_hours: {},
        growth_metrics: {
          new_followers: 0,
          unfollowers: 0,
          net_growth: 0
        }
      };
    }
  }

  async fetchEngagementData(
    postIds: string[],
    dateRange?: { start: Date; end: Date }
  ): Promise<EngagementData[]> {
    const engagementData: EngagementData[] = [];

    try {
      for (const messageId of postIds) {
        // For Discord, we need the channel ID to get message reactions
        // This is a limitation - we'd need to store channel IDs with message IDs
        
        // For now, return empty array as Discord's API structure doesn't easily support
        // this without knowing the channel context
      }
    } catch (error) {
      console.error('Error fetching Discord engagement data:', error);
    }

    return engagementData;
  }

  async fetchTrendingHashtags(location?: string): Promise<string[]> {
    // Discord doesn't have traditional hashtags, but popular Discord terms
    return [
      'discord',
      'server',
      'community',
      'gaming',
      'voice',
      'chat',
      'bot',
      'role',
      'channel',
      'nitro',
      'stream',
      'dmme',
      'lfg', // Looking for group
      'gg', // Good game
      'pog' // Popular Discord slang
    ];
  }

  async searchCompetitors(query: string, limit = 10): Promise<any[]> {
    try {
      // Discord API doesn't provide server search functionality
      // This would require Discord bot presence in servers or external services
      return [];
    } catch (error) {
      console.error('Error searching Discord competitors:', error);
      return [];
    }
  }

  private calculateDiscordEngagementRate(messages: number, reactions: number, members: number): number {
    if (members === 0) return 0;
    
    // Calculate engagement as (reactions + messages) per member
    const totalEngagement = reactions + messages * 0.1; // Weight messages lower than reactions
    return (totalEngagement / members) * 100;
  }

  private calculateMessageEngagementRate(reactions: number, memberCount: number): number {
    if (memberCount === 0) return 0;
    return (reactions / memberCount) * 100;
  }

  private determinePostType(message: any): PostAnalytics['post_type'] {
    if (message.attachments && message.attachments.length > 0) {
      const hasVideo = message.attachments.some((a: any) => 
        a.content_type?.startsWith('video/') || a.filename?.match(/\.(mp4|mov|avi|webm)$/i)
      );
      const hasImage = message.attachments.some((a: any) => 
        a.content_type?.startsWith('image/') || a.filename?.match(/\.(jpg|jpeg|png|gif|webp)$/i)
      );
      
      if (hasVideo) return 'video';
      if (hasImage) return 'image';
    }

    if (message.embeds && message.embeds.length > 0) {
      const hasVideo = message.embeds.some((e: any) => e.video);
      const hasImage = message.embeds.some((e: any) => e.image || e.thumbnail);
      
      if (hasVideo) return 'video';
      if (hasImage) return 'image';
    }

    return 'text';
  }

  private extractMentions(text: string): string[] {
    // Discord mentions are in format <@userID> or <@!userID>
    const mentionRegex = /<@!?(\d+)>/g;
    const matches = text.match(mentionRegex);
    return matches ? matches.map(mention => mention) : [];
  }

  private extractHashtags(text: string): string[] {
    // Discord doesn't have traditional hashtags, but look for #channel references
    const hashtagRegex = /#[a-zA-Z0-9_-]+/g;
    const matches = text.match(hashtagRegex);
    return matches ? matches.map(tag => tag.slice(1)) : [];
  }

  private async getActiveHours(guildId: string): Promise<Record<string, number>> {
    try {
      // This would require analyzing message timestamps over time
      // For now, return typical Discord active hours
      return {
        '14': 10, // 2 PM
        '15': 15,
        '16': 20,
        '17': 25,
        '18': 30,
        '19': 35,
        '20': 40, // Peak Discord hours
        '21': 35,
        '22': 30,
        '23': 20,
        '0': 15,
        '1': 10
      };
    } catch (error) {
      return {};
    }
  }

  private async analyzeSentiment(text: string): Promise<number> {
    // Discord-specific positive words
    const positiveWords = ['gg', 'pog', 'poggers', 'nice', 'cool', 'awesome', 'great', 'love', 'thanks', 'lit'];
    const negativeWords = ['rip', 'oof', 'cringe', 'bad', 'terrible', 'hate', 'annoying', 'spam'];
    
    const words = text.toLowerCase().split(/\s+/);
    let score = 0;
    
    words.forEach(word => {
      if (positiveWords.includes(word)) score += 0.1;
      if (negativeWords.includes(word)) score -= 0.1;
    });
    
    return Math.max(-1, Math.min(1, score));
  }

  /**
   * Get Discord-specific insights
   */
  getPlatformInsights(metrics: AnalyticsMetrics): string[] {
    const insights = super.getPlatformInsights(metrics);

    // Discord-specific insights
    if (metrics.followers > 1000) {
      insights.push('Large Discord community - consider hosting events or voice chats');
    } else if (metrics.followers < 100) {
      insights.push('Growing Discord server - focus on community building and engagement');
    }

    if (metrics.posts > 100) {
      insights.push('Active Discord server - maintain momentum with regular events');
    }

    insights.push('Consider using Discord bots to enhance member engagement');
    insights.push('Voice channels and events can significantly boost community activity');

    return insights;
  }

  /**
   * Calculate Discord-specific performance score
   */
  calculatePerformanceScore(metrics: AnalyticsMetrics): number {
    let score = 0;
    let factors = 0;

    // Community size (0-30 points)
    if (metrics.followers > 0) {
      if (metrics.followers > 1000) {
        score += 30;
      } else if (metrics.followers > 100) {
        score += 20;
      } else {
        score += 10;
      }
      factors++;
    }

    // Activity level (0-40 points)
    if (metrics.posts > 0) {
      const messagesPerMember = metrics.posts / Math.max(metrics.followers, 1);
      score += Math.min(messagesPerMember * 100, 40);
      factors++;
    }

    // Engagement (0-30 points)
    if (metrics.engagement_rate > 0) {
      score += Math.min(metrics.engagement_rate * 3, 30);
      factors++;
    }

    return factors > 0 ? Math.round(score / factors * (100 / 35)) : 0;
  }
}

export default DiscordAnalytics;
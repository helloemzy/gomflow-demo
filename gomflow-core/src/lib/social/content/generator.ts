/**
 * Content Generation Engine
 * Handles template processing, variable injection, and platform-specific content adaptation
 */

import { createClient } from '@/lib/supabase/server';

export interface ContentTemplate {
  id: string;
  name: string;
  description?: string;
  category: 'k-pop' | 'merchandise' | 'promotion' | 'update' | 'announcement' | 'custom';
  templateType: 'text' | 'image' | 'video' | 'carousel' | 'story';
  contentTemplate: string;
  variables: Record<string, string>;
  platformConfigs: Record<string, any>;
  mediaRequirements: Record<string, any>;
  hashtags: string[];
  defaultMentions: string[];
  isPublic: boolean;
  usageCount: number;
}

export interface ContentGenerationRequest {
  templateId?: string;
  customTemplate?: string;
  variables: Record<string, any>;
  platformId: string;
  mediaFiles?: MediaFile[];
  additionalHashtags?: string[];
  mentions?: string[];
  scheduledFor?: Date;
  campaignId?: string;
}

export interface MediaFile {
  id: string;
  fileName: string;
  fileUrl: string;
  thumbnailUrl?: string;
  mimeType: string;
  altText?: string;
  platformVersions?: Record<string, string>;
}

export interface GeneratedContent {
  text: string;
  hashtags: string[];
  mentions: string[];
  mediaFiles: MediaFile[];
  platformSpecific: Record<string, any>;
  characterCount: number;
  estimatedEngagement?: {
    likes: number;
    shares: number;
    comments: number;
    reach: number;
  };
}

export interface PlatformLimits {
  maxTextLength: number;
  maxHashtags: number;
  maxMentions: number;
  maxMediaFiles: number;
  supportedMediaTypes: string[];
  characterCountIncludes: ('hashtags' | 'mentions' | 'urls')[];
}

export class ContentGenerator {
  private supabase;
  private platformLimits: Record<string, PlatformLimits> = {
    twitter: {
      maxTextLength: 280,
      maxHashtags: 2, // Best practice, not hard limit
      maxMentions: 10,
      maxMediaFiles: 4,
      supportedMediaTypes: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'],
      characterCountIncludes: ['hashtags', 'mentions', 'urls'],
    },
    instagram: {
      maxTextLength: 2200,
      maxHashtags: 30,
      maxMentions: 20,
      maxMediaFiles: 10,
      supportedMediaTypes: ['image/jpeg', 'image/png', 'video/mp4'],
      characterCountIncludes: [],
    },
    facebook: {
      maxTextLength: 63206,
      maxHashtags: 10, // Best practice
      maxMentions: 50,
      maxMediaFiles: 10,
      supportedMediaTypes: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'],
      characterCountIncludes: [],
    },
    tiktok: {
      maxTextLength: 2200,
      maxHashtags: 20,
      maxMentions: 20,
      maxMediaFiles: 1,
      supportedMediaTypes: ['video/mp4'],
      characterCountIncludes: [],
    },
    discord: {
      maxTextLength: 2000,
      maxHashtags: 20,
      maxMentions: 100,
      maxMediaFiles: 10,
      supportedMediaTypes: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'],
      characterCountIncludes: [],
    },
    telegram: {
      maxTextLength: 4096,
      maxHashtags: 20,
      maxMentions: 50,
      maxMediaFiles: 10,
      supportedMediaTypes: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'],
      characterCountIncludes: [],
    },
  };

  constructor() {
    this.supabase = createClient();
  }

  /**
   * Generate content from template with variable injection
   */
  async generateContent(request: ContentGenerationRequest): Promise<GeneratedContent> {
    let template: ContentTemplate | null = null;
    
    // Get template if provided
    if (request.templateId) {
      template = await this.getTemplate(request.templateId);
      if (!template) {
        throw new Error('Template not found');
      }
    }

    // Use custom template or template content
    const contentTemplate = request.customTemplate || template?.contentTemplate || '';
    if (!contentTemplate) {
      throw new Error('No content template provided');
    }

    // Process template variables
    const processedContent = this.processTemplate(contentTemplate, request.variables);
    
    // Get platform limits
    const platformLimits = this.platformLimits[request.platformId];
    if (!platformLimits) {
      throw new Error(`Unsupported platform: ${request.platformId}`);
    }

    // Combine hashtags
    const baseHashtags = template?.hashtags || [];
    const additionalHashtags = request.additionalHashtags || [];
    const allHashtags = [...baseHashtags, ...additionalHashtags];

    // Combine mentions
    const baseMentions = template?.defaultMentions || [];
    const additionalMentions = request.mentions || [];
    const allMentions = [...baseMentions, ...additionalMentions];

    // Adapt content for platform
    const adaptedContent = await this.adaptContentForPlatform(
      processedContent,
      allHashtags,
      allMentions,
      request.platformId,
      platformLimits
    );

    // Process media files
    const processedMedia = await this.processMediaForPlatform(
      request.mediaFiles || [],
      request.platformId,
      platformLimits
    );

    // Generate platform-specific data
    const platformSpecific = this.generatePlatformSpecificData(
      request.platformId,
      adaptedContent,
      processedMedia
    );

    // Calculate character count
    const characterCount = this.calculateCharacterCount(
      adaptedContent.text,
      adaptedContent.hashtags,
      adaptedContent.mentions,
      platformLimits
    );

    // Predict engagement (simplified ML model)
    const estimatedEngagement = await this.predictEngagement(
      adaptedContent.text,
      adaptedContent.hashtags,
      request.platformId,
      processedMedia.length
    );

    // Update template usage if used
    if (template) {
      await this.incrementTemplateUsage(template.id);
    }

    return {
      text: adaptedContent.text,
      hashtags: adaptedContent.hashtags,
      mentions: adaptedContent.mentions,
      mediaFiles: processedMedia,
      platformSpecific,
      characterCount,
      estimatedEngagement,
    };
  }

  /**
   * Get content template by ID
   */
  async getTemplate(templateId: string): Promise<ContentTemplate | null> {
    const { data, error } = await this.supabase
      .from('content_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      description: data.description,
      category: data.category,
      templateType: data.template_type,
      contentTemplate: data.content_template,
      variables: data.variables || {},
      platformConfigs: data.platform_configs || {},
      mediaRequirements: data.media_requirements || {},
      hashtags: data.hashtags || [],
      defaultMentions: data.default_mentions || [],
      isPublic: data.is_public,
      usageCount: data.usage_count,
    };
  }

  /**
   * Get public templates by category
   */
  async getPublicTemplates(category?: string): Promise<ContentTemplate[]> {
    let query = this.supabase
      .from('content_templates')
      .select('*')
      .eq('is_public', true)
      .order('usage_count', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error || !data) {
      return [];
    }

    return data.map(template => ({
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      templateType: template.template_type,
      contentTemplate: template.content_template,
      variables: template.variables || {},
      platformConfigs: template.platform_configs || {},
      mediaRequirements: template.media_requirements || {},
      hashtags: template.hashtags || [],
      defaultMentions: template.default_mentions || [],
      isPublic: template.is_public,
      usageCount: template.usage_count,
    }));
  }

  /**
   * Process template with variable substitution
   */
  private processTemplate(template: string, variables: Record<string, any>): string {
    let processedTemplate = template;

    // Replace variables in format {variable_name}
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      processedTemplate = processedTemplate.replace(regex, String(value));
    });

    // Handle conditional blocks: {if:variable}content{/if}
    processedTemplate = processedTemplate.replace(
      /\{if:(\w+)\}(.*?)\{\/if\}/gs,
      (match, variableName, content) => {
        const variableValue = variables[variableName];
        return variableValue && variableValue !== '' ? content : '';
      }
    );

    // Handle optional blocks: {optional:variable}default text{/optional}
    processedTemplate = processedTemplate.replace(
      /\{optional:(\w+)\}(.*?)\{\/optional\}/gs,
      (match, variableName, defaultContent) => {
        const variableValue = variables[variableName];
        return variableValue && variableValue !== '' ? String(variableValue) : defaultContent;
      }
    );

    // Handle date formatting: {date:variable:format}
    processedTemplate = processedTemplate.replace(
      /\{date:(\w+):([^}]+)\}/g,
      (match, variableName, format) => {
        const dateValue = variables[variableName];
        if (dateValue) {
          try {
            const date = new Date(dateValue);
            return this.formatDate(date, format);
          } catch (error) {
            return String(dateValue);
          }
        }
        return match;
      }
    );

    return processedTemplate.trim();
  }

  /**
   * Adapt content for specific platform constraints
   */
  private async adaptContentForPlatform(
    content: string,
    hashtags: string[],
    mentions: string[],
    platformId: string,
    limits: PlatformLimits
  ): Promise<{ text: string; hashtags: string[]; mentions: string[] }> {
    // Limit hashtags and mentions
    const limitedHashtags = hashtags.slice(0, limits.maxHashtags);
    const limitedMentions = mentions.slice(0, limits.maxMentions);

    // Add platform-specific formatting
    let adaptedText = content;
    
    switch (platformId) {
      case 'twitter':
        adaptedText = this.adaptForTwitter(content, limitedHashtags, limitedMentions);
        break;
      case 'instagram':
        adaptedText = this.adaptForInstagram(content, limitedHashtags, limitedMentions);
        break;
      case 'facebook':
        adaptedText = this.adaptForFacebook(content, limitedHashtags, limitedMentions);
        break;
      case 'tiktok':
        adaptedText = this.adaptForTikTok(content, limitedHashtags, limitedMentions);
        break;
      case 'discord':
        adaptedText = this.adaptForDiscord(content, limitedHashtags, limitedMentions);
        break;
      case 'telegram':
        adaptedText = this.adaptForTelegram(content, limitedHashtags, limitedMentions);
        break;
    }

    // Truncate if necessary
    const characterCount = this.calculateCharacterCount(
      adaptedText,
      limitedHashtags,
      limitedMentions,
      limits
    );

    if (characterCount > limits.maxTextLength) {
      adaptedText = this.truncateContent(adaptedText, limits.maxTextLength, limitedHashtags, limitedMentions, limits);
    }

    return {
      text: adaptedText,
      hashtags: limitedHashtags,
      mentions: limitedMentions,
    };
  }

  /**
   * Platform-specific content adaptation methods
   */
  private adaptForTwitter(content: string, hashtags: string[], mentions: string[]): string {
    // Twitter: Keep it concise, hashtags at the end
    let adapted = content;
    
    if (hashtags.length > 0) {
      adapted += '\n\n' + hashtags.map(tag => `#${tag.replace(/^#/, '')}`).join(' ');
    }
    
    if (mentions.length > 0) {
      adapted += '\n' + mentions.map(mention => `@${mention.replace(/^@/, '')}`).join(' ');
    }
    
    return adapted;
  }

  private adaptForInstagram(content: string, hashtags: string[], mentions: string[]): string {
    // Instagram: Content first, then hashtags in groups
    let adapted = content;
    
    if (mentions.length > 0) {
      adapted += '\n\n' + mentions.map(mention => `@${mention.replace(/^@/, '')}`).join(' ');
    }
    
    if (hashtags.length > 0) {
      adapted += '\n\n' + hashtags.map(tag => `#${tag.replace(/^#/, '')}`).join(' ');
    }
    
    return adapted;
  }

  private adaptForFacebook(content: string, hashtags: string[], mentions: string[]): string {
    // Facebook: More conversational, fewer hashtags
    let adapted = content;
    
    if (mentions.length > 0) {
      adapted += '\n\n' + mentions.map(mention => `@${mention.replace(/^@/, '')}`).join(' ');
    }
    
    // Limit hashtags for Facebook (they're less important)
    const limitedHashtags = hashtags.slice(0, 5);
    if (limitedHashtags.length > 0) {
      adapted += '\n\n' + limitedHashtags.map(tag => `#${tag.replace(/^#/, '')}`).join(' ');
    }
    
    return adapted;
  }

  private adaptForTikTok(content: string, hashtags: string[], mentions: string[]): string {
    // TikTok: Hashtags are crucial for discovery
    let adapted = content;
    
    if (hashtags.length > 0) {
      adapted += '\n\n' + hashtags.map(tag => `#${tag.replace(/^#/, '')}`).join(' ');
    }
    
    if (mentions.length > 0) {
      adapted += '\n' + mentions.map(mention => `@${mention.replace(/^@/, '')}`).join(' ');
    }
    
    return adapted;
  }

  private adaptForDiscord(content: string, hashtags: string[], mentions: string[]): string {
    // Discord: Use Discord markdown and emojis
    let adapted = content;
    
    // Convert basic formatting to Discord markdown
    adapted = adapted.replace(/\*\*(.*?)\*\*/g, '**$1**'); // Bold
    adapted = adapted.replace(/\*(.*?)\*/g, '*$1*'); // Italic
    
    if (mentions.length > 0) {
      adapted += '\n\n' + mentions.map(mention => `@${mention.replace(/^@/, '')}`).join(' ');
    }
    
    if (hashtags.length > 0) {
      adapted += '\n\n' + hashtags.map(tag => `#${tag.replace(/^#/, '')}`).join(' ');
    }
    
    return adapted;
  }

  private adaptForTelegram(content: string, hashtags: string[], mentions: string[]): string {
    // Telegram: Support HTML and Markdown formatting
    let adapted = content;
    
    if (mentions.length > 0) {
      adapted += '\n\n' + mentions.map(mention => `@${mention.replace(/^@/, '')}`).join(' ');
    }
    
    if (hashtags.length > 0) {
      adapted += '\n\n' + hashtags.map(tag => `#${tag.replace(/^#/, '')}`).join(' ');
    }
    
    return adapted;
  }

  /**
   * Process media files for platform compatibility
   */
  private async processMediaForPlatform(
    mediaFiles: MediaFile[],
    platformId: string,
    limits: PlatformLimits
  ): Promise<MediaFile[]> {
    // Filter supported media types
    const supportedMedia = mediaFiles.filter(media => 
      limits.supportedMediaTypes.includes(media.mimeType)
    );

    // Limit number of files
    const limitedMedia = supportedMedia.slice(0, limits.maxMediaFiles);

    // Return platform-optimized versions if available
    return limitedMedia.map(media => ({
      ...media,
      fileUrl: media.platformVersions?.[platformId] || media.fileUrl,
    }));
  }

  /**
   * Generate platform-specific posting data
   */
  private generatePlatformSpecificData(
    platformId: string,
    content: { text: string; hashtags: string[]; mentions: string[] },
    mediaFiles: MediaFile[]
  ): Record<string, any> {
    const platformData: Record<string, any> = {};

    switch (platformId) {
      case 'twitter':
        platformData.tweetData = {
          text: content.text,
          mediaIds: [], // To be filled when media is uploaded
        };
        break;
      
      case 'instagram':
        platformData.instagramData = {
          caption: content.text,
          mediaType: mediaFiles.length > 1 ? 'CAROUSEL' : 
                     mediaFiles[0]?.mimeType.startsWith('video') ? 'VIDEO' : 'IMAGE',
        };
        break;
      
      case 'facebook':
        platformData.facebookData = {
          message: content.text,
          attachments: mediaFiles.map(media => ({
            type: 'photo',
            url: media.fileUrl,
          })),
        };
        break;
      
      case 'tiktok':
        platformData.tiktokData = {
          text: content.text,
          video_id: mediaFiles[0]?.id, // TikTok requires video
        };
        break;
      
      case 'discord':
        platformData.discordData = {
          content: content.text,
          embeds: [],
          files: mediaFiles.map(media => ({
            attachment: media.fileUrl,
            name: media.fileName,
          })),
        };
        break;
      
      case 'telegram':
        platformData.telegramData = {
          text: content.text,
          parse_mode: 'Markdown',
          media: mediaFiles.map(media => ({
            type: media.mimeType.startsWith('video') ? 'video' : 'photo',
            media: media.fileUrl,
            caption: media.altText,
          })),
        };
        break;
    }

    return platformData;
  }

  /**
   * Calculate character count including platform-specific elements
   */
  private calculateCharacterCount(
    text: string,
    hashtags: string[],
    mentions: string[],
    limits: PlatformLimits
  ): number {
    let count = text.length;

    if (limits.characterCountIncludes.includes('hashtags')) {
      count += hashtags.reduce((sum, tag) => sum + tag.length + 1, 0); // +1 for #
    }

    if (limits.characterCountIncludes.includes('mentions')) {
      count += mentions.reduce((sum, mention) => sum + mention.length + 1, 0); // +1 for @
    }

    if (limits.characterCountIncludes.includes('urls')) {
      // Count URLs in text (simplified)
      const urlMatches = text.match(/https?:\/\/[^\s]+/g) || [];
      count += urlMatches.reduce((sum, url) => sum + url.length, 0);
    }

    return count;
  }

  /**
   * Truncate content to fit platform limits
   */
  private truncateContent(
    text: string,
    maxLength: number,
    hashtags: string[],
    mentions: string[],
    limits: PlatformLimits
  ): string {
    // Calculate space needed for hashtags and mentions
    let reservedSpace = 0;
    
    if (limits.characterCountIncludes.includes('hashtags')) {
      reservedSpace += hashtags.reduce((sum, tag) => sum + tag.length + 1, 0);
    }
    
    if (limits.characterCountIncludes.includes('mentions')) {
      reservedSpace += mentions.reduce((sum, mention) => sum + mention.length + 1, 0);
    }

    // Available space for main text
    const availableLength = maxLength - reservedSpace - 10; // -10 for safety margin

    if (text.length <= availableLength) {
      return text;
    }

    // Truncate at word boundary
    const truncated = text.substring(0, availableLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > availableLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
  }

  /**
   * Simple engagement prediction based on historical data
   */
  private async predictEngagement(
    text: string,
    hashtags: string[],
    platformId: string,
    mediaCount: number
  ): Promise<{ likes: number; shares: number; comments: number; reach: number }> {
    // This is a simplified prediction model
    // In a real implementation, you'd use ML models trained on historical data
    
    let baseEngagement = {
      likes: 50,
      shares: 10,
      comments: 15,
      reach: 500,
    };

    // Adjust based on platform
    const platformMultipliers: Record<string, number> = {
      twitter: 1.0,
      instagram: 1.5,
      facebook: 0.8,
      tiktok: 2.0,
      discord: 0.6,
      telegram: 0.7,
    };

    const platformMultiplier = platformMultipliers[platformId] || 1.0;

    // Adjust based on content factors
    let contentMultiplier = 1.0;
    
    // More hashtags = better discovery
    contentMultiplier += Math.min(hashtags.length * 0.1, 0.5);
    
    // Media presence boosts engagement
    contentMultiplier += mediaCount * 0.2;
    
    // Emojis and exclamation marks boost engagement
    const emojiCount = (text.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || []).length;
    const exclamationCount = (text.match(/!/g) || []).length;
    contentMultiplier += Math.min((emojiCount + exclamationCount) * 0.05, 0.3);

    // Apply multipliers
    const totalMultiplier = platformMultiplier * contentMultiplier;

    return {
      likes: Math.round(baseEngagement.likes * totalMultiplier),
      shares: Math.round(baseEngagement.shares * totalMultiplier),
      comments: Math.round(baseEngagement.comments * totalMultiplier),
      reach: Math.round(baseEngagement.reach * totalMultiplier),
    };
  }

  /**
   * Format date according to specified format
   */
  private formatDate(date: Date, format: string): string {
    const formatMap: Record<string, string> = {
      'YYYY': date.getFullYear().toString(),
      'MM': (date.getMonth() + 1).toString().padStart(2, '0'),
      'DD': date.getDate().toString().padStart(2, '0'),
      'HH': date.getHours().toString().padStart(2, '0'),
      'mm': date.getMinutes().toString().padStart(2, '0'),
    };

    let formattedDate = format;
    Object.entries(formatMap).forEach(([key, value]) => {
      formattedDate = formattedDate.replace(key, value);
    });

    return formattedDate;
  }

  /**
   * Increment template usage count
   */
  private async incrementTemplateUsage(templateId: string): Promise<void> {
    await this.supabase.rpc('increment_template_usage', {
      template_uuid: templateId,
    });
  }

  /**
   * Get trending hashtags for a platform
   */
  async getTrendingHashtags(platformId: string, limit: number = 10): Promise<Array<{
    hashtag: string;
    usageCount: number;
    avgPerformanceScore: number;
    trendingScore: number;
  }>> {
    const { data, error } = await this.supabase
      .from('hashtag_analytics')
      .select('hashtag, usage_count, avg_performance_score, trending_score')
      .eq('platform_id', platformId)
      .order('trending_score', { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return data.map(item => ({
      hashtag: item.hashtag,
      usageCount: item.usage_count,
      avgPerformanceScore: item.avg_performance_score,
      trendingScore: item.trending_score,
    }));
  }

  /**
   * Suggest hashtags based on content analysis
   */
  async suggestHashtags(content: string, platformId: string): Promise<string[]> {
    // Simple keyword-based hashtag suggestion
    // In a real implementation, you'd use NLP and ML models
    
    const keywordToHashtag: Record<string, string[]> = {
      'order': ['GroupOrder', 'KPop', 'Preorder'],
      'album': ['Album', 'Music', 'KPop'],
      'comeback': ['Comeback', 'NewMusic', 'KPop'],
      'shipping': ['Shipping', 'Delivery', 'Update'],
      'deadline': ['LastChance', 'Deadline', 'Hurry'],
      'payment': ['Payment', 'Reminder', 'ASAP'],
      'group': ['GroupBuy', 'Together', 'Community'],
      'merchandise': ['Merch', 'Collectible', 'Limited'],
      'photocard': ['Photocard', 'PC', 'Collect'],
      'limited': ['Limited', 'Exclusive', 'Rare'],
    };

    const suggestions = new Set<string>();
    const lowerContent = content.toLowerCase();

    Object.entries(keywordToHashtag).forEach(([keyword, hashtags]) => {
      if (lowerContent.includes(keyword)) {
        hashtags.forEach(tag => suggestions.add(tag));
      }
    });

    // Get trending hashtags for this platform
    const trending = await this.getTrendingHashtags(platformId, 5);
    trending.forEach(item => suggestions.add(item.hashtag));

    return Array.from(suggestions).slice(0, 10);
  }
}

export default ContentGenerator;
/**
 * Template Management System
 * Handles content templates for social media posts
 */

import { createClient } from '@/lib/supabase/server';

export interface ContentTemplate {
  id: string;
  userId: string;
  name: string;
  description?: string;
  category: 'k-pop' | 'merchandise' | 'promotion' | 'update' | 'announcement' | 'custom';
  templateType: 'text' | 'image' | 'video' | 'carousel' | 'story';
  contentTemplate: string;
  variables: Record<string, TemplateVariable>;
  platformConfigs: Record<string, PlatformConfig>;
  mediaRequirements: MediaRequirements;
  hashtags: string[];
  defaultMentions: string[];
  isPublic: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateVariable {
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'url' | 'email';
  required: boolean;
  defaultValue?: string;
  description?: string;
  placeholder?: string;
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    options?: string[];
  };
}

export interface PlatformConfig {
  enabled: boolean;
  maxLength?: number;
  adaptations?: {
    prefix?: string;
    suffix?: string;
    formatting?: 'markdown' | 'html' | 'plain';
    hashtagStrategy?: 'inline' | 'end' | 'separate';
  };
}

export interface MediaRequirements {
  required: boolean;
  minFiles: number;
  maxFiles: number;
  supportedTypes: string[];
  dimensions?: {
    width?: number;
    height?: number;
    aspectRatio?: string;
  };
  maxSizeMB: number;
}

export interface TemplatePreview {
  platform: string;
  content: string;
  characterCount: number;
  hashtags: string[];
  mentions: string[];
  withinLimits: boolean;
  warnings: string[];
}

export interface TemplateSearchFilters {
  category?: string;
  templateType?: string;
  isPublic?: boolean;
  userId?: string;
  searchText?: string;
  tags?: string[];
  minUsageCount?: number;
}

export class TemplateManager {
  private supabase;

  constructor() {
    this.supabase = createClient();
  }

  /**
   * Create a new template
   */
  async createTemplate(templateData: Omit<ContentTemplate, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>): Promise<ContentTemplate> {
    try {
      const { data, error } = await this.supabase
        .from('content_templates')
        .insert({
          user_id: templateData.userId,
          name: templateData.name,
          description: templateData.description,
          category: templateData.category,
          template_type: templateData.templateType,
          content_template: templateData.contentTemplate,
          variables: templateData.variables,
          platform_configs: templateData.platformConfigs,
          media_requirements: templateData.mediaRequirements,
          hashtags: templateData.hashtags,
          default_mentions: templateData.defaultMentions,
          is_public: templateData.isPublic,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create template: ${error.message}`);
      }

      return this.mapToTemplate(data);
    } catch (error) {
      throw new Error(`Template creation failed: ${error.message}`);
    }
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId: string, userId?: string): Promise<ContentTemplate | null> {
    try {
      let query = this.supabase
        .from('content_templates')
        .select('*')
        .eq('id', templateId);

      // If userId provided, ensure user can access this template
      if (userId) {
        query = query.and(`user_id.eq.${userId},is_public.eq.true`);
      }

      const { data, error } = await query.single();

      if (error || !data) {
        return null;
      }

      return this.mapToTemplate(data);
    } catch (error) {
      console.error('Failed to get template:', error);
      return null;
    }
  }

  /**
   * Search templates with filters
   */
  async searchTemplates(filters: TemplateSearchFilters, limit: number = 20, offset: number = 0): Promise<{
    templates: ContentTemplate[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      let query = this.supabase
        .from('content_templates')
        .select('*', { count: 'exact' });

      // Apply filters
      if (filters.category) {
        query = query.eq('category', filters.category);
      }

      if (filters.templateType) {
        query = query.eq('template_type', filters.templateType);
      }

      if (filters.isPublic !== undefined) {
        query = query.eq('is_public', filters.isPublic);
      }

      if (filters.userId) {
        if (filters.isPublic === false) {
          // User's private templates
          query = query.eq('user_id', filters.userId);
        } else {
          // User's templates OR public templates
          query = query.or(`user_id.eq.${filters.userId},is_public.eq.true`);
        }
      }

      if (filters.searchText) {
        query = query.or(
          `name.ilike.%${filters.searchText}%,description.ilike.%${filters.searchText}%,content_template.ilike.%${filters.searchText}%`
        );
      }

      if (filters.minUsageCount) {
        query = query.gte('usage_count', filters.minUsageCount);
      }

      // Order by usage count (popular first) then by creation date
      query = query
        .order('usage_count', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        throw new Error(`Template search failed: ${error.message}`);
      }

      const templates = (data || []).map(item => this.mapToTemplate(item));
      const total = count || 0;
      const hasMore = offset + limit < total;

      return { templates, total, hasMore };
    } catch (error) {
      throw new Error(`Template search failed: ${error.message}`);
    }
  }

  /**
   * Update template
   */
  async updateTemplate(templateId: string, updates: Partial<ContentTemplate>): Promise<ContentTemplate> {
    try {
      const updateData: any = {};

      if (updates.name) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.category) updateData.category = updates.category;
      if (updates.templateType) updateData.template_type = updates.templateType;
      if (updates.contentTemplate) updateData.content_template = updates.contentTemplate;
      if (updates.variables) updateData.variables = updates.variables;
      if (updates.platformConfigs) updateData.platform_configs = updates.platformConfigs;
      if (updates.mediaRequirements) updateData.media_requirements = updates.mediaRequirements;
      if (updates.hashtags) updateData.hashtags = updates.hashtags;
      if (updates.defaultMentions) updateData.default_mentions = updates.defaultMentions;
      if (updates.isPublic !== undefined) updateData.is_public = updates.isPublic;

      const { data, error } = await this.supabase
        .from('content_templates')
        .update(updateData)
        .eq('id', templateId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update template: ${error.message}`);
      }

      return this.mapToTemplate(data);
    } catch (error) {
      throw new Error(`Template update failed: ${error.message}`);
    }
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('content_templates')
        .delete()
        .eq('id', templateId)
        .eq('user_id', userId); // Ensure user owns the template

      if (error) {
        throw new Error(`Failed to delete template: ${error.message}`);
      }

      return true;
    } catch (error) {
      console.error('Template deletion failed:', error);
      return false;
    }
  }

  /**
   * Clone template for user
   */
  async cloneTemplate(templateId: string, userId: string, customName?: string): Promise<ContentTemplate> {
    try {
      // Get original template
      const original = await this.getTemplate(templateId);
      if (!original) {
        throw new Error('Template not found');
      }

      // Create cloned template
      const clonedTemplate = await this.createTemplate({
        userId,
        name: customName || `${original.name} (Copy)`,
        description: original.description,
        category: original.category,
        templateType: original.templateType,
        contentTemplate: original.contentTemplate,
        variables: original.variables,
        platformConfigs: original.platformConfigs,
        mediaRequirements: original.mediaRequirements,
        hashtags: original.hashtags,
        defaultMentions: original.defaultMentions,
        isPublic: false, // Cloned templates start as private
      });

      return clonedTemplate;
    } catch (error) {
      throw new Error(`Template cloning failed: ${error.message}`);
    }
  }

  /**
   * Preview template with variables
   */
  async previewTemplate(
    templateId: string,
    variables: Record<string, any>,
    platforms: string[] = ['twitter', 'instagram', 'facebook']
  ): Promise<TemplatePreview[]> {
    try {
      const template = await this.getTemplate(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      const previews: TemplatePreview[] = [];

      for (const platform of platforms) {
        const preview = await this.generatePlatformPreview(template, variables, platform);
        previews.push(preview);
      }

      return previews;
    } catch (error) {
      throw new Error(`Template preview failed: ${error.message}`);
    }
  }

  /**
   * Generate platform-specific preview
   */
  private async generatePlatformPreview(
    template: ContentTemplate,
    variables: Record<string, any>,
    platform: string
  ): Promise<TemplatePreview> {
    // Process template variables
    let processedContent = this.processTemplateVariables(template.contentTemplate, variables);
    
    // Apply platform-specific configuration
    const platformConfig = template.platformConfigs[platform];
    if (platformConfig) {
      processedContent = this.applyPlatformConfig(processedContent, platformConfig);
    }

    // Add hashtags and mentions
    const hashtags = [...template.hashtags];
    const mentions = [...template.defaultMentions];

    // Calculate character count based on platform rules
    const characterCount = this.calculateCharacterCount(processedContent, hashtags, mentions, platform);
    
    // Check platform limits
    const limits = this.getPlatformLimits(platform);
    const withinLimits = characterCount <= limits.maxLength;
    
    // Generate warnings
    const warnings = this.generateWarnings(template, processedContent, hashtags, mentions, platform, limits);

    return {
      platform,
      content: processedContent,
      characterCount,
      hashtags,
      mentions,
      withinLimits,
      warnings,
    };
  }

  /**
   * Process template variables
   */
  private processTemplateVariables(template: string, variables: Record<string, any>): string {
    let processed = template;

    // Replace variables in format {variable_name}
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      processed = processed.replace(regex, String(value || ''));
    });

    // Handle conditional blocks: {if:variable}content{/if}
    processed = processed.replace(
      /\{if:(\w+)\}(.*?)\{\/if\}/gs,
      (match, variableName, content) => {
        const variableValue = variables[variableName];
        return variableValue && variableValue !== '' ? content : '';
      }
    );

    // Handle optional blocks: {optional:variable}default text{/optional}
    processed = processed.replace(
      /\{optional:(\w+)\}(.*?)\{\/optional\}/gs,
      (match, variableName, defaultContent) => {
        const variableValue = variables[variableName];
        return variableValue && variableValue !== '' ? String(variableValue) : defaultContent;
      }
    );

    return processed.trim();
  }

  /**
   * Apply platform-specific configuration
   */
  private applyPlatformConfig(content: string, config: PlatformConfig): string {
    if (!config.enabled) {
      return content;
    }

    let adapted = content;

    if (config.adaptations?.prefix) {
      adapted = config.adaptations.prefix + adapted;
    }

    if (config.adaptations?.suffix) {
      adapted = adapted + config.adaptations.suffix;
    }

    // Apply formatting
    switch (config.adaptations?.formatting) {
      case 'markdown':
        // Convert basic HTML to Markdown if needed
        adapted = adapted.replace(/<b>(.*?)<\/b>/g, '**$1**');
        adapted = adapted.replace(/<i>(.*?)<\/i>/g, '*$1*');
        break;
      case 'html':
        // Convert Markdown to HTML if needed
        adapted = adapted.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
        adapted = adapted.replace(/\*(.*?)\*/g, '<i>$1</i>');
        break;
      case 'plain':
        // Remove all formatting
        adapted = adapted.replace(/\*\*(.*?)\*\*/g, '$1');
        adapted = adapted.replace(/\*(.*?)\*/g, '$1');
        adapted = adapted.replace(/<[^>]*>/g, '');
        break;
    }

    return adapted;
  }

  /**
   * Calculate character count for platform
   */
  private calculateCharacterCount(
    content: string,
    hashtags: string[],
    mentions: string[],
    platform: string
  ): number {
    let count = content.length;

    // Platform-specific character counting rules
    switch (platform) {
      case 'twitter':
        // Twitter counts hashtags and mentions toward limit
        count += hashtags.reduce((sum, tag) => sum + tag.length + 1, 0); // +1 for #
        count += mentions.reduce((sum, mention) => sum + mention.length + 1, 0); // +1 for @
        break;
      case 'instagram':
      case 'facebook':
      case 'tiktok':
      case 'discord':
      case 'telegram':
      default:
        // Most platforms don't count hashtags/mentions separately
        if (!content.includes('#') && hashtags.length > 0) {
          count += hashtags.reduce((sum, tag) => sum + tag.length + 1, 0) + 2; // +2 for spacing
        }
        if (!content.includes('@') && mentions.length > 0) {
          count += mentions.reduce((sum, mention) => sum + mention.length + 1, 0) + 1; // +1 for spacing
        }
        break;
    }

    return count;
  }

  /**
   * Get platform limits
   */
  private getPlatformLimits(platform: string): { maxLength: number; maxHashtags: number; maxMentions: number } {
    const limits = {
      twitter: { maxLength: 280, maxHashtags: 2, maxMentions: 10 },
      instagram: { maxLength: 2200, maxHashtags: 30, maxMentions: 20 },
      facebook: { maxLength: 63206, maxHashtags: 10, maxMentions: 50 },
      tiktok: { maxLength: 2200, maxHashtags: 20, maxMentions: 20 },
      discord: { maxLength: 2000, maxHashtags: 20, maxMentions: 100 },
      telegram: { maxLength: 4096, maxHashtags: 20, maxMentions: 50 },
    };

    return limits[platform] || limits.twitter;
  }

  /**
   * Generate warnings for template
   */
  private generateWarnings(
    template: ContentTemplate,
    content: string,
    hashtags: string[],
    mentions: string[],
    platform: string,
    limits: { maxLength: number; maxHashtags: number; maxMentions: number }
  ): string[] {
    const warnings: string[] = [];

    if (content.length > limits.maxLength) {
      warnings.push(`Content exceeds ${platform} character limit of ${limits.maxLength}`);
    }

    if (hashtags.length > limits.maxHashtags) {
      warnings.push(`Too many hashtags for ${platform} (${hashtags.length}/${limits.maxHashtags})`);
    }

    if (mentions.length > limits.maxMentions) {
      warnings.push(`Too many mentions for ${platform} (${mentions.length}/${limits.maxMentions})`);
    }

    // Check for missing required variables
    const variableMatches = template.contentTemplate.match(/\{(\w+)\}/g) || [];
    const missingVariables = variableMatches
      .map(match => match.slice(1, -1))
      .filter(varName => {
        const variable = template.variables[varName];
        return variable?.required && !content.includes(`{${varName}}`);
      });

    if (missingVariables.length > 0) {
      warnings.push(`Missing required variables: ${missingVariables.join(', ')}`);
    }

    // Platform-specific warnings
    if (platform === 'instagram' && template.templateType === 'text') {
      warnings.push('Instagram posts require at least one media file');
    }

    if (platform === 'tiktok' && template.templateType !== 'video') {
      warnings.push('TikTok posts require a video file');
    }

    return warnings;
  }

  /**
   * Get template analytics
   */
  async getTemplateAnalytics(templateId: string): Promise<{
    usageCount: number;
    avgPerformance: number;
    topPlatforms: Array<{ platform: string; uses: number }>;
    recentUses: Array<{ date: Date; platform: string; performance?: number }>;
  }> {
    try {
      // Get template usage data
      const { data: template } = await this.supabase
        .from('content_templates')
        .select('usage_count')
        .eq('id', templateId)
        .single();

      // Get content queue data for this template
      const { data: contentQueue } = await this.supabase
        .from('content_queue')
        .select(`
          created_at,
          social_accounts (platform_id),
          actual_engagement
        `)
        .eq('template_id', templateId)
        .order('created_at', { ascending: false })
        .limit(100);

      const usageCount = template?.usage_count || 0;
      
      // Calculate platform usage
      const platformUsage = new Map<string, number>();
      let totalPerformance = 0;
      let performanceCount = 0;

      (contentQueue || []).forEach(item => {
        const platform = item.social_accounts?.platform_id;
        if (platform) {
          platformUsage.set(platform, (platformUsage.get(platform) || 0) + 1);
        }

        if (item.actual_engagement) {
          const engagement = Object.values(item.actual_engagement).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0);
          totalPerformance += engagement;
          performanceCount++;
        }
      });

      const topPlatforms = Array.from(platformUsage.entries())
        .map(([platform, uses]) => ({ platform, uses }))
        .sort((a, b) => b.uses - a.uses)
        .slice(0, 5);

      const avgPerformance = performanceCount > 0 ? totalPerformance / performanceCount : 0;

      const recentUses = (contentQueue || [])
        .slice(0, 10)
        .map(item => ({
          date: new Date(item.created_at),
          platform: item.social_accounts?.platform_id || 'unknown',
          performance: item.actual_engagement ? 
            Object.values(item.actual_engagement).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0) : 
            undefined,
        }));

      return {
        usageCount,
        avgPerformance,
        topPlatforms,
        recentUses,
      };
    } catch (error) {
      console.error('Failed to get template analytics:', error);
      return {
        usageCount: 0,
        avgPerformance: 0,
        topPlatforms: [],
        recentUses: [],
      };
    }
  }

  /**
   * Get popular templates
   */
  async getPopularTemplates(category?: string, limit: number = 10): Promise<ContentTemplate[]> {
    try {
      let query = this.supabase
        .from('content_templates')
        .select('*')
        .eq('is_public', true)
        .order('usage_count', { ascending: false })
        .limit(limit);

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to get popular templates: ${error.message}`);
      }

      return (data || []).map(item => this.mapToTemplate(item));
    } catch (error) {
      console.error('Failed to get popular templates:', error);
      return [];
    }
  }

  /**
   * Export template as JSON
   */
  async exportTemplate(templateId: string): Promise<string> {
    try {
      const template = await this.getTemplate(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      // Remove user-specific and system fields
      const exportData = {
        name: template.name,
        description: template.description,
        category: template.category,
        templateType: template.templateType,
        contentTemplate: template.contentTemplate,
        variables: template.variables,
        platformConfigs: template.platformConfigs,
        mediaRequirements: template.mediaRequirements,
        hashtags: template.hashtags,
        defaultMentions: template.defaultMentions,
        exportedAt: new Date().toISOString(),
        version: '1.0',
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      throw new Error(`Template export failed: ${error.message}`);
    }
  }

  /**
   * Import template from JSON
   */
  async importTemplate(userId: string, templateJson: string): Promise<ContentTemplate> {
    try {
      const templateData = JSON.parse(templateJson);
      
      // Validate required fields
      if (!templateData.name || !templateData.contentTemplate) {
        throw new Error('Invalid template format');
      }

      return await this.createTemplate({
        userId,
        name: templateData.name,
        description: templateData.description || '',
        category: templateData.category || 'custom',
        templateType: templateData.templateType || 'text',
        contentTemplate: templateData.contentTemplate,
        variables: templateData.variables || {},
        platformConfigs: templateData.platformConfigs || {},
        mediaRequirements: templateData.mediaRequirements || {
          required: false,
          minFiles: 0,
          maxFiles: 0,
          supportedTypes: [],
          maxSizeMB: 10,
        },
        hashtags: templateData.hashtags || [],
        defaultMentions: templateData.defaultMentions || [],
        isPublic: false,
      });
    } catch (error) {
      throw new Error(`Template import failed: ${error.message}`);
    }
  }

  /**
   * Map database row to ContentTemplate
   */
  private mapToTemplate(data: any): ContentTemplate {
    return {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      description: data.description,
      category: data.category,
      templateType: data.template_type,
      contentTemplate: data.content_template,
      variables: data.variables || {},
      platformConfigs: data.platform_configs || {},
      mediaRequirements: data.media_requirements || {
        required: false,
        minFiles: 0,
        maxFiles: 0,
        supportedTypes: [],
        maxSizeMB: 10,
      },
      hashtags: data.hashtags || [],
      defaultMentions: data.default_mentions || [],
      isPublic: data.is_public,
      usageCount: data.usage_count,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}

export default TemplateManager;
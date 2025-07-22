import OpenAI from 'openai';
import { supabase } from '@/lib/supabase/client';

// Types for AI content generation
export interface ContentGenerationRequest {
  promptId?: string;
  customPrompt?: string;
  platform: 'twitter' | 'instagram' | 'tiktok' | 'facebook' | 'telegram';
  contentType: 'text' | 'image' | 'video' | 'carousel';
  language: 'en' | 'ko' | 'tl' | 'id' | 'th' | 'ms';
  variables: Record<string, string>;
  orderId?: string;
  tone?: 'excited' | 'professional' | 'casual' | 'urgency' | 'community';
  includeHashtags?: boolean;
  maxLength?: number;
}

export interface ContentGenerationResponse {
  id: string;
  textContent: string;
  hashtags: string[];
  qualityScore: number;
  engagementPrediction: number;
  sentimentScore: number;
  culturalRelevanceScore: number;
  suggestions: string[];
  tokensUsed: number;
  cost: number;
}

export interface AIContentPrompt {
  id: string;
  name: string;
  description: string;
  category: string;
  platform: string;
  language: string;
  systemPrompt: string;
  userPromptTemplate: string;
  variables: string[];
  tags: string[];
}

// Platform-specific constraints
const PLATFORM_CONSTRAINTS = {
  twitter: {
    maxLength: 280,
    hashtagLimit: 3,
    supportsImages: true,
    supportsVideo: true,
    supportsCarousel: false,
  },
  instagram: {
    maxLength: 2200,
    hashtagLimit: 30,
    supportsImages: true,
    supportsVideo: true,
    supportsCarousel: true,
  },
  tiktok: {
    maxLength: 150,
    hashtagLimit: 5,
    supportsImages: false,
    supportsVideo: true,
    supportsCarousel: false,
  },
  facebook: {
    maxLength: 63206,
    hashtagLimit: 5,
    supportsImages: true,
    supportsVideo: true,
    supportsCarousel: true,
  },
  telegram: {
    maxLength: 4096,
    hashtagLimit: 10,
    supportsImages: true,
    supportsVideo: true,
    supportsCarousel: false,
  },
};

// K-pop specific hashtag sets by category
const KPOP_HASHTAGS = {
  album: ['#KpopAlbum', '#GroupOrder', '#Preorder', '#KpopCommunity'],
  photocard: ['#Photocard', '#PC', '#KpopTrade', '#Collect'],
  merchandise: ['#KpopMerch', '#KpopGoods', '#Fanmerch'],
  concert: ['#KpopConcert', '#LiveShow', '#KpopTour'],
  general: ['#Kpop', '#Korean', '#Music', '#Stan'],
};

// Regional hashtags by country
const REGIONAL_HASHTAGS = {
  PH: ['#KpopPH', '#Philippines', '#Pinoy', '#Manila'],
  MY: ['#KpopMY', '#Malaysia', '#KualaLumpur'],
  ID: ['#KpopID', '#Indonesia', '#Jakarta'],
  TH: ['#KpopTH', '#Thailand', '#Bangkok'],
  SG: ['#KpopSG', '#Singapore'],
};

class AIContentGenerator {
  private openai: OpenAI;
  private defaultModel = 'gpt-4-turbo-preview';

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Generate AI content based on prompt and parameters
   */
  async generateContent(request: ContentGenerationRequest): Promise<ContentGenerationResponse> {
    const startTime = Date.now();
    
    try {
      // Get prompt template if promptId provided
      let prompt: AIContentPrompt | null = null;
      if (request.promptId) {
        prompt = await this.getPromptById(request.promptId);
        if (!prompt) {
          throw new Error(`Prompt with ID ${request.promptId} not found`);
        }
      }

      // Build the generation prompt
      const { systemPrompt, userPrompt } = await this.buildPrompts(request, prompt);

      // Generate content using OpenAI
      const completion = await this.openai.chat.completions.create({
        model: this.defaultModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      // Parse the JSON response
      const parsedResponse = JSON.parse(response);
      
      // Validate and enhance the response
      const enhancedContent = await this.enhanceContent(parsedResponse, request);

      // Calculate costs
      const tokensUsed = completion.usage?.total_tokens || 0;
      const cost = this.calculateCost(tokensUsed);

      // Assess content quality
      const qualityScores = await this.assessContentQuality(enhancedContent.textContent, request);

      // Save to database
      const savedContent = await this.saveGeneratedContent({
        promptId: request.promptId,
        orderId: request.orderId,
        platform: request.platform,
        contentType: request.contentType,
        textContent: enhancedContent.textContent,
        hashtags: enhancedContent.hashtags,
        variablesUsed: request.variables,
        qualityScore: qualityScores.overall,
        engagementPrediction: qualityScores.engagement,
        sentimentScore: qualityScores.sentiment,
        culturalRelevanceScore: qualityScores.cultural,
      });

      // Track usage analytics
      await this.trackUsage({
        promptId: request.promptId,
        platform: request.platform,
        contentType: request.contentType,
        generationTimeMs: Date.now() - startTime,
        tokensUsed,
        cost,
        success: true,
      });

      return {
        id: savedContent.id,
        textContent: enhancedContent.textContent,
        hashtags: enhancedContent.hashtags,
        qualityScore: qualityScores.overall,
        engagementPrediction: qualityScores.engagement,
        sentimentScore: qualityScores.sentiment,
        culturalRelevanceScore: qualityScores.cultural,
        suggestions: enhancedContent.suggestions || [],
        tokensUsed,
        cost,
      };

    } catch (error) {
      // Track failed usage
      await this.trackUsage({
        promptId: request.promptId,
        platform: request.platform,
        contentType: request.contentType,
        generationTimeMs: Date.now() - startTime,
        tokensUsed: 0,
        cost: 0,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Get prompt template by ID
   */
  private async getPromptById(promptId: string): Promise<AIContentPrompt | null> {
    const { data, error } = await supabase
      .from('ai_content_prompts')
      .select('*')
      .eq('id', promptId)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('Error fetching prompt:', error);
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      description: data.description,
      category: data.category,
      platform: data.platform,
      language: data.language,
      systemPrompt: data.system_prompt,
      userPromptTemplate: data.user_prompt_template,
      variables: data.variables || [],
      tags: data.tags || [],
    };
  }

  /**
   * Build system and user prompts
   */
  private async buildPrompts(request: ContentGenerationRequest, prompt?: AIContentPrompt | null) {
    const platformConstraints = PLATFORM_CONSTRAINTS[request.platform];
    
    // Get cultural context for the language/region
    const culturalContext = await this.getCulturalContext(request.language);

    let systemPrompt = '';
    let userPrompt = '';

    if (prompt) {
      // Use template prompt
      systemPrompt = prompt.systemPrompt;
      userPrompt = this.replaceVariables(prompt.userPromptTemplate, request.variables);
    } else {
      // Use custom prompt
      systemPrompt = this.buildDefaultSystemPrompt(request);
      userPrompt = request.customPrompt || 'Generate engaging social media content';
    }

    // Enhance system prompt with platform constraints and cultural context
    systemPrompt += `\n\nPlatform: ${request.platform}
Platform Constraints:
- Maximum length: ${platformConstraints.maxLength} characters
- Maximum hashtags: ${platformConstraints.hashtagLimit}
- Content type: ${request.contentType}

Language: ${request.language}
Cultural Context: ${culturalContext}

Response format:
{
  "textContent": "Main content text",
  "hashtags": ["hashtag1", "hashtag2"],
  "suggestions": ["improvement1", "improvement2"],
  "reasoning": "Why this content works"
}

Requirements:
- Respect character limits
- Include appropriate emojis
- Use cultural references appropriately
- Make content engaging and shareable
- Include relevant hashtags within limit`;

    return { systemPrompt, userPrompt };
  }

  /**
   * Build default system prompt for custom requests
   */
  private buildDefaultSystemPrompt(request: ContentGenerationRequest): string {
    const toneInstructions = {
      excited: 'Use enthusiastic language with lots of emojis and exclamation points',
      professional: 'Maintain a professional but friendly tone',
      casual: 'Use casual, conversational language',
      urgency: 'Create a sense of urgency with time-sensitive language',
      community: 'Focus on building community and engagement',
    };

    return `You are an expert social media content creator specializing in K-pop and Southeast Asian culture. 
Create engaging ${request.platform} content for ${request.contentType}.

Tone: ${toneInstructions[request.tone || 'casual']}

Focus on:
- K-pop culture and terminology
- Group order dynamics
- Community building
- Cultural sensitivity for ${request.language} speakers`;
  }

  /**
   * Get cultural context for language/region
   */
  private async getCulturalContext(language: string): Promise<string> {
    const { data, error } = await supabase
      .from('ai_cultural_context')
      .select('context_key, context_value, usage_examples')
      .eq('language', language)
      .eq('is_active', true)
      .order('relevance_score', { ascending: false })
      .limit(10);

    if (error || !data) {
      return 'Use culturally appropriate language and references.';
    }

    return data.map(item => 
      `${item.context_key}: ${item.context_value} (Examples: ${item.usage_examples?.join(', ') || 'N/A'})`
    ).join('\n');
  }

  /**
   * Replace variables in template
   */
  private replaceVariables(template: string, variables: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{${key}}`, 'g'), value);
    }
    return result;
  }

  /**
   * Enhance generated content with hashtags and formatting
   */
  private async enhanceContent(parsedResponse: any, request: ContentGenerationRequest) {
    let textContent = parsedResponse.textContent || '';
    let hashtags = parsedResponse.hashtags || [];

    // Add platform-specific hashtags if needed
    if (request.includeHashtags !== false) {
      const additionalHashtags = this.generateRelevantHashtags(request);
      hashtags = [...new Set([...hashtags, ...additionalHashtags])];
      
      // Respect platform hashtag limits
      const limit = PLATFORM_CONSTRAINTS[request.platform].hashtagLimit;
      hashtags = hashtags.slice(0, limit);
    }

    // Ensure content meets length requirements
    const maxLength = request.maxLength || PLATFORM_CONSTRAINTS[request.platform].maxLength;
    if (textContent.length > maxLength) {
      textContent = textContent.substring(0, maxLength - 3) + '...';
    }

    return {
      textContent,
      hashtags,
      suggestions: parsedResponse.suggestions || [],
      reasoning: parsedResponse.reasoning,
    };
  }

  /**
   * Generate relevant hashtags based on content and platform
   */
  private generateRelevantHashtags(request: ContentGenerationRequest): string[] {
    const hashtags: string[] = [];

    // Add K-pop category hashtags
    if (request.variables.artist) {
      hashtags.push(`#${request.variables.artist.replace(/\s+/g, '')}`);
    }

    // Add category-specific hashtags
    const category = this.inferCategory(request.variables);
    if (KPOP_HASHTAGS[category as keyof typeof KPOP_HASHTAGS]) {
      hashtags.push(...KPOP_HASHTAGS[category as keyof typeof KPOP_HASHTAGS]);
    }

    // Add general K-pop hashtags
    hashtags.push(...KPOP_HASHTAGS.general);

    // Add regional hashtags (infer from language)
    const regionMap = { tl: 'PH', id: 'ID', th: 'TH', ms: 'MY' };
    const region = regionMap[request.language as keyof typeof regionMap];
    if (region && REGIONAL_HASHTAGS[region as keyof typeof REGIONAL_HASHTAGS]) {
      hashtags.push(...REGIONAL_HASHTAGS[region as keyof typeof REGIONAL_HASHTAGS].slice(0, 2));
    }

    return hashtags;
  }

  /**
   * Infer content category from variables
   */
  private inferCategory(variables: Record<string, string>): string {
    if (variables.album_name || variables.album) return 'album';
    if (variables.photocard || variables.pc) return 'photocard';
    if (variables.concert || variables.tour) return 'concert';
    if (variables.merchandise || variables.merch) return 'merchandise';
    return 'general';
  }

  /**
   * Assess content quality using AI
   */
  private async assessContentQuality(content: string, request: ContentGenerationRequest) {
    try {
      const assessmentPrompt = `Assess the quality of this social media content for ${request.platform}:

"${content}"

Rate each aspect from 1-10 and provide scores in JSON format:
{
  "overall": 8.5,
  "creativity": 8.0,
  "relevance": 9.0,
  "cultural": 8.5,
  "language": 9.0,
  "engagement": 8.0,
  "sentiment": 0.8
}

Consider:
- Platform appropriateness
- K-pop cultural relevance
- Language quality for ${request.language} speakers
- Engagement potential
- Cultural sensitivity`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: assessmentPrompt }],
        temperature: 0.3,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      });

      const response = completion.choices[0]?.message?.content;
      if (response) {
        const scores = JSON.parse(response);
        return {
          overall: scores.overall || 7.0,
          engagement: scores.engagement || 7.0,
          sentiment: scores.sentiment || 0.5,
          cultural: scores.cultural || 7.0,
        };
      }
    } catch (error) {
      console.error('Error assessing content quality:', error);
    }

    // Default scores if assessment fails
    return {
      overall: 7.0,
      engagement: 7.0,
      sentiment: 0.5,
      cultural: 7.0,
    };
  }

  /**
   * Save generated content to database
   */
  private async saveGeneratedContent(data: any) {
    const { data: saved, error } = await supabase
      .from('ai_generated_content')
      .insert({
        prompt_id: data.promptId,
        order_id: data.orderId,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        platform: data.platform,
        content_type: data.contentType,
        text_content: data.textContent,
        hashtags: data.hashtags,
        variables_used: data.variablesUsed,
        quality_score: data.qualityScore,
        engagement_prediction: data.engagementPrediction,
        sentiment_score: data.sentimentScore,
        cultural_relevance_score: data.culturalRelevanceScore,
        status: 'generated',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save content: ${error.message}`);
    }

    return saved;
  }

  /**
   * Track usage analytics
   */
  private async trackUsage(data: {
    promptId?: string;
    platform: string;
    contentType: string;
    generationTimeMs: number;
    tokensUsed: number;
    cost: number;
    success: boolean;
    errorMessage?: string;
  }) {
    const { error } = await supabase
      .from('ai_content_usage_analytics')
      .insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        prompt_id: data.promptId,
        platform: data.platform,
        content_type: data.contentType,
        generation_time_ms: data.generationTimeMs,
        tokens_used: data.tokensUsed,
        cost_usd: data.cost,
        success: data.success,
        error_message: data.errorMessage,
      });

    if (error) {
      console.error('Error tracking usage:', error);
    }
  }

  /**
   * Calculate API cost based on tokens
   */
  private calculateCost(tokens: number): number {
    // GPT-4 Turbo pricing: $0.01 per 1K input tokens, $0.03 per 1K output tokens
    // Simplified calculation assuming 70% input, 30% output
    const inputTokens = Math.round(tokens * 0.7);
    const outputTokens = Math.round(tokens * 0.3);
    
    const inputCost = (inputTokens / 1000) * 0.01;
    const outputCost = (outputTokens / 1000) * 0.03;
    
    return Number((inputCost + outputCost).toFixed(4));
  }

  /**
   * Get available prompts for user
   */
  async getAvailablePrompts(platform?: string, language = 'en'): Promise<AIContentPrompt[]> {
    let query = supabase
      .from('ai_content_prompts')
      .select('*')
      .eq('is_active', true)
      .eq('language', language);

    if (platform) {
      query = query.eq('platform', platform);
    }

    const { data, error } = await query.order('name');

    if (error) {
      console.error('Error fetching prompts:', error);
      return [];
    }

    return data.map(item => ({
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      platform: item.platform,
      language: item.language,
      systemPrompt: item.system_prompt,
      userPromptTemplate: item.user_prompt_template,
      variables: item.variables || [],
      tags: item.tags || [],
    }));
  }

  /**
   * Get user's content generation analytics
   */
  async getUserAnalytics(daysBack = 30) {
    const { data, error } = await supabase
      .rpc('get_user_content_analytics', {
        user_uuid: (await supabase.auth.getUser()).data.user?.id,
        days_back: daysBack,
      });

    if (error) {
      console.error('Error fetching analytics:', error);
      return null;
    }

    return data[0] || {
      totalGenerated: 0,
      avgQualityScore: 0,
      totalCostUsd: 0,
      mostUsedPlatform: '',
      successRate: 1,
    };
  }

  /**
   * Get trending prompts
   */
  async getTrendingPrompts(platform?: string, language = 'en') {
    const { data, error } = await supabase
      .rpc('get_trending_prompts', {
        platform_filter: platform,
        language_filter: language,
      });

    if (error) {
      console.error('Error fetching trending prompts:', error);
      return [];
    }

    return data || [];
  }
}

// Export singleton instance
export const aiContentGenerator = new AIContentGenerator();

// Export types
export type { ContentGenerationRequest, ContentGenerationResponse, AIContentPrompt };
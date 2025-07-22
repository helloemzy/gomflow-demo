import OpenAI from 'openai';
import { supabase } from '@/lib/supabase/client';

// Types for visual content generation
export interface VisualGenerationRequest {
  contentId: string;
  imagePrompt: string;
  style?: 'photorealistic' | 'anime' | 'minimalist' | 'colorful' | 'dark' | 'bright';
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:5';
  platform: 'twitter' | 'instagram' | 'tiktok' | 'facebook' | 'telegram';
  includeText?: boolean;
  textOverlay?: string;
  colorScheme?: string[];
  culturalStyle?: 'korean' | 'japanese' | 'western' | 'mixed';
}

export interface VisualGenerationResponse {
  imageUrl: string;
  revisedPrompt: string;
  style: string;
  dimensions: { width: number; height: number };
  cost: number;
  generationTime: number;
}

export interface ImageVariation {
  id: string;
  originalImageUrl: string;
  variationUrl: string;
  style: string;
  prompt: string;
  cost: number;
}

// Platform-specific image requirements
const PLATFORM_IMAGE_SPECS = {
  twitter: {
    recommended: { width: 1200, height: 675 },
    aspectRatios: ['16:9', '1:1'],
    maxSize: '5MB',
    formats: ['PNG', 'JPEG', 'GIF', 'WEBP'],
  },
  instagram: {
    recommended: { width: 1080, height: 1080 },
    aspectRatios: ['1:1', '4:5', '16:9'],
    maxSize: '30MB',
    formats: ['PNG', 'JPEG'],
  },
  tiktok: {
    recommended: { width: 1080, height: 1920 },
    aspectRatios: ['9:16'],
    maxSize: '72MB',
    formats: ['MP4', 'MOV', 'MPEG', 'PNG', 'JPEG'],
  },
  facebook: {
    recommended: { width: 1200, height: 630 },
    aspectRatios: ['16:9', '1:1', '4:5'],
    maxSize: '8MB',
    formats: ['PNG', 'JPEG'],
  },
  telegram: {
    recommended: { width: 1280, height: 720 },
    aspectRatios: ['16:9', '1:1'],
    maxSize: '20MB',
    formats: ['PNG', 'JPEG', 'GIF', 'WEBP'],
  },
};

// K-pop visual style templates
const KPOP_VISUAL_STYLES = {
  album_cover: {
    basePrompt: 'Professional K-pop album cover style, high-quality photography, studio lighting',
    styleModifiers: ['clean composition', 'branded aesthetics', 'professional lighting'],
  },
  photocard: {
    basePrompt: 'K-pop photocard style, portrait photography, soft lighting, pastel colors',
    styleModifiers: ['cute aesthetics', 'soft focus', 'dreamy atmosphere'],
  },
  concert: {
    basePrompt: 'Dynamic concert photography, stage lighting, energetic atmosphere',
    styleModifiers: ['dramatic lighting', 'motion blur', 'vibrant colors'],
  },
  merchandise: {
    basePrompt: 'Product photography, clean background, professional lighting',
    styleModifiers: ['minimalist design', 'clean composition', 'commercial style'],
  },
  social_media: {
    basePrompt: 'Social media friendly, eye-catching, trendy aesthetic',
    styleModifiers: ['Instagram-worthy', 'shareable content', 'modern design'],
  },
};

// Cultural color schemes
const CULTURAL_COLOR_SCHEMES = {
  korean: ['#FF69B4', '#9370DB', '#00BFFF', '#FFB6C1'], // Pink, purple, blue, light pink
  japanese: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'], // Coral, teal, blue, salmon
  western: ['#2C3E50', '#E74C3C', '#3498DB', '#F39C12'], // Dark blue, red, blue, orange
  mixed: ['#E91E63', '#9C27B0', '#2196F3', '#FF9800'], // Pink, purple, blue, orange
};

class VisualContentGenerator {
  private openai: OpenAI;
  private baseImageSize = '1024x1024';

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Generate AI image using DALL-E
   */
  async generateImage(request: VisualGenerationRequest): Promise<VisualGenerationResponse> {
    const startTime = Date.now();

    try {
      // Build enhanced prompt
      const enhancedPrompt = await this.buildImagePrompt(request);
      
      // Determine image size based on platform and aspect ratio
      const imageSize = this.getImageSize(request.platform, request.aspectRatio);

      // Generate image using DALL-E 3
      const response = await this.openai.images.generate({
        model: 'dall-e-3',
        prompt: enhancedPrompt,
        size: imageSize as '1024x1024' | '1792x1024' | '1024x1792',
        quality: 'hd',
        style: request.style === 'anime' ? 'vivid' : 'natural',
        n: 1,
      });

      const imageUrl = response.data[0]?.url;
      if (!imageUrl) {
        throw new Error('No image generated');
      }

      // Upload image to Supabase storage
      const uploadedUrl = await this.uploadImageToStorage(imageUrl, request.contentId);

      // Calculate cost (DALL-E 3 HD: $0.080 per image)
      const cost = 0.080;

      // Update content record with image
      await this.updateContentWithImage(request.contentId, uploadedUrl, enhancedPrompt);

      // Track usage
      await this.trackImageGeneration({
        contentId: request.contentId,
        platform: request.platform,
        style: request.style || 'default',
        generationTimeMs: Date.now() - startTime,
        cost,
        success: true,
      });

      return {
        imageUrl: uploadedUrl,
        revisedPrompt: response.data[0]?.revised_prompt || enhancedPrompt,
        style: request.style || 'default',
        dimensions: this.getDimensions(imageSize),
        cost,
        generationTime: Date.now() - startTime,
      };

    } catch (error) {
      await this.trackImageGeneration({
        contentId: request.contentId,
        platform: request.platform,
        style: request.style || 'default',
        generationTimeMs: Date.now() - startTime,
        cost: 0,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Generate image variations
   */
  async generateVariations(
    originalImageUrl: string,
    count: number = 2
  ): Promise<ImageVariation[]> {
    try {
      // Download original image
      const imageResponse = await fetch(originalImageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      const imageFile = new File([imageBuffer], 'original.png', { type: 'image/png' });

      // Generate variations using DALL-E 2 (DALL-E 3 doesn't support variations)
      const response = await this.openai.images.createVariation({
        image: imageFile,
        n: count,
        size: '1024x1024',
      });

      const variations: ImageVariation[] = [];
      const cost = 0.020 * count; // DALL-E 2: $0.020 per image

      for (let i = 0; i < response.data.length; i++) {
        const variationUrl = response.data[i]?.url;
        if (variationUrl) {
          const uploadedUrl = await this.uploadImageToStorage(
            variationUrl,
            `variation_${Date.now()}_${i}`
          );

          variations.push({
            id: `var_${Date.now()}_${i}`,
            originalImageUrl,
            variationUrl: uploadedUrl,
            style: 'variation',
            prompt: 'Generated variation',
            cost: 0.020,
          });
        }
      }

      return variations;

    } catch (error) {
      console.error('Error generating variations:', error);
      throw error;
    }
  }

  /**
   * Build enhanced image prompt with K-pop context
   */
  private async buildImagePrompt(request: VisualGenerationRequest): Promise<string> {
    let prompt = request.imagePrompt;

    // Add style-specific enhancements
    if (request.style) {
      const styleEnhancements = this.getStyleEnhancements(request.style);
      prompt += `, ${styleEnhancements}`;
    }

    // Add cultural style context
    if (request.culturalStyle) {
      const culturalContext = this.getCulturalStyleContext(request.culturalStyle);
      prompt += `, ${culturalContext}`;
    }

    // Add platform-specific optimizations
    const platformContext = this.getPlatformContext(request.platform);
    prompt += `, ${platformContext}`;

    // Add color scheme if specified
    if (request.colorScheme && request.colorScheme.length > 0) {
      prompt += `, using colors: ${request.colorScheme.join(', ')}`;
    } else if (request.culturalStyle && CULTURAL_COLOR_SCHEMES[request.culturalStyle]) {
      const colors = CULTURAL_COLOR_SCHEMES[request.culturalStyle];
      prompt += `, using ${request.culturalStyle} color palette: ${colors.join(', ')}`;
    }

    // Add quality and technical specifications
    prompt += ', high quality, professional photography, 4K resolution, sharp focus';

    // Add negative prompts to avoid unwanted elements
    prompt += ', avoid text, watermarks, signatures, low quality, blurry';

    return prompt;
  }

  /**
   * Get style enhancements for different visual styles
   */
  private getStyleEnhancements(style: string): string {
    const enhancements = {
      photorealistic: 'photorealistic, hyperrealistic, detailed, natural lighting',
      anime: 'anime style, manga inspired, vibrant colors, stylized',
      minimalist: 'minimalist design, clean lines, simple composition, modern',
      colorful: 'vibrant colors, saturated, rainbow palette, energetic',
      dark: 'dark aesthetic, moody lighting, dramatic shadows, noir style',
      bright: 'bright lighting, cheerful colors, high contrast, optimistic mood',
    };

    return enhancements[style as keyof typeof enhancements] || 'professional, modern style';
  }

  /**
   * Get cultural style context
   */
  private getCulturalStyleContext(culturalStyle: string): string {
    const contexts = {
      korean: 'Korean aesthetic, K-pop inspired, Seoul cityscape elements, modern Korean design',
      japanese: 'Japanese aesthetic, anime-inspired, Tokyo elements, kawaii culture',
      western: 'Western pop culture, modern American/European style, urban aesthetics',
      mixed: 'multicultural fusion, global pop culture, diverse aesthetic elements',
    };

    return contexts[culturalStyle as keyof typeof contexts] || 'modern international style';
  }

  /**
   * Get platform-specific context
   */
  private getPlatformContext(platform: string): string {
    const contexts = {
      twitter: 'social media optimized, Twitter-friendly, engaging thumbnail',
      instagram: 'Instagram-worthy, aesthetic composition, feed-ready',
      tiktok: 'TikTok style, vertical composition, mobile-friendly',
      facebook: 'Facebook post style, engaging visual, shareable content',
      telegram: 'messaging app friendly, clear visibility, communication focused',
    };

    return contexts[platform as keyof typeof contexts] || 'social media optimized';
  }

  /**
   * Get image size based on platform and aspect ratio
   */
  private getImageSize(platform: string, aspectRatio?: string): string {
    const platformSpecs = PLATFORM_IMAGE_SPECS[platform as keyof typeof PLATFORM_IMAGE_SPECS];
    
    if (aspectRatio === '16:9') {
      return '1792x1024';
    } else if (aspectRatio === '9:16') {
      return '1024x1792';
    } else {
      return '1024x1024'; // Default square
    }
  }

  /**
   * Get dimensions from size string
   */
  private getDimensions(size: string): { width: number; height: number } {
    const [width, height] = size.split('x').map(Number);
    return { width, height };
  }

  /**
   * Upload generated image to Supabase storage
   */
  private async uploadImageToStorage(imageUrl: string, contentId: string): Promise<string> {
    try {
      // Download image
      const response = await fetch(imageUrl);
      const imageBuffer = await response.arrayBuffer();
      
      // Generate unique filename
      const filename = `ai-generated/${contentId}_${Date.now()}.png`;
      
      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from('content-images')
        .upload(filename, imageBuffer, {
          contentType: 'image/png',
          cacheControl: '3600',
        });

      if (error) {
        throw new Error(`Failed to upload image: ${error.message}`);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('content-images')
        .getPublicUrl(filename);

      return publicUrl;

    } catch (error) {
      console.error('Error uploading image:', error);
      // Return original URL as fallback
      return imageUrl;
    }
  }

  /**
   * Update content record with generated image
   */
  private async updateContentWithImage(
    contentId: string,
    imageUrl: string,
    imagePrompt: string
  ): Promise<void> {
    const { error } = await supabase
      .from('ai_generated_content')
      .update({
        image_url: imageUrl,
        image_prompt: imagePrompt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contentId);

    if (error) {
      console.error('Error updating content with image:', error);
    }
  }

  /**
   * Track image generation usage
   */
  private async trackImageGeneration(data: {
    contentId: string;
    platform: string;
    style: string;
    generationTimeMs: number;
    cost: number;
    success: boolean;
    errorMessage?: string;
  }): Promise<void> {
    const { error } = await supabase
      .from('ai_content_usage_analytics')
      .insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        platform: data.platform,
        content_type: 'image',
        generation_time_ms: data.generationTimeMs,
        tokens_used: 0, // Images don't use tokens
        cost_usd: data.cost,
        success: data.success,
        error_message: data.errorMessage,
        metadata: {
          content_id: data.contentId,
          style: data.style,
        },
      });

    if (error) {
      console.error('Error tracking image generation:', error);
    }
  }

  /**
   * Get image generation suggestions based on content
   */
  async getImageSuggestions(
    textContent: string,
    platform: string,
    category: string = 'general'
  ): Promise<string[]> {
    try {
      const prompt = `Based on this social media content for ${platform}:
"${textContent}"

Generate 3 creative image prompt suggestions that would work well for ${category} content. 
Consider K-pop aesthetics and ${platform} best practices.

Return as JSON array of strings:
["prompt1", "prompt2", "prompt3"]`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 300,
        response_format: { type: 'json_object' },
      });

      const response = completion.choices[0]?.message?.content;
      if (response) {
        const parsed = JSON.parse(response);
        return Array.isArray(parsed) ? parsed : parsed.suggestions || [];
      }

      return [];

    } catch (error) {
      console.error('Error getting image suggestions:', error);
      return [
        'Colorful K-pop inspired design with musical elements',
        'Modern minimalist composition with Korean aesthetics',
        'Vibrant concert-style atmosphere with dynamic lighting',
      ];
    }
  }

  /**
   * Analyze image and suggest improvements
   */
  async analyzeImage(imageUrl: string): Promise<{
    suggestions: string[];
    qualityScore: number;
    platformSuitability: Record<string, number>;
  }> {
    try {
      // This would integrate with image analysis APIs
      // For now, return mock analysis
      return {
        suggestions: [
          'Consider brighter colors for better engagement',
          'Add more contrast to improve visibility on mobile',
          'Include trending visual elements for current K-pop aesthetic',
        ],
        qualityScore: 8.5,
        platformSuitability: {
          twitter: 9.0,
          instagram: 8.5,
          tiktok: 7.5,
          facebook: 8.0,
          telegram: 8.8,
        },
      };

    } catch (error) {
      console.error('Error analyzing image:', error);
      return {
        suggestions: [],
        qualityScore: 7.0,
        platformSuitability: {},
      };
    }
  }

  /**
   * Get recommended image styles for content type
   */
  getRecommendedStyles(contentType: string, platform: string): string[] {
    const styleRecommendations = {
      album: ['photorealistic', 'minimalist', 'colorful'],
      photocard: ['anime', 'colorful', 'bright'],
      concert: ['photorealistic', 'dark', 'colorful'],
      merchandise: ['minimalist', 'bright', 'photorealistic'],
      general: ['colorful', 'bright', 'minimalist'],
    };

    const platformBoosts = {
      instagram: ['minimalist', 'bright'],
      tiktok: ['colorful', 'anime'],
      twitter: ['minimalist', 'photorealistic'],
      facebook: ['bright', 'photorealistic'],
      telegram: ['colorful', 'minimalist'],
    };

    const baseStyles = styleRecommendations[contentType as keyof typeof styleRecommendations] || 
                      styleRecommendations.general;
    
    const boostedStyles = platformBoosts[platform as keyof typeof platformBoosts] || [];
    
    // Combine and prioritize
    return [...new Set([...boostedStyles, ...baseStyles])].slice(0, 4);
  }
}

// Export singleton instance
export const visualContentGenerator = new VisualContentGenerator();

// Export types
export type { 
  VisualGenerationRequest, 
  VisualGenerationResponse, 
  ImageVariation 
};
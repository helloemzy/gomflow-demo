import OpenAI from 'openai';
import { supabase } from '@/lib/supabase/client';

// Types for quality assessment
export interface QualityAssessmentRequest {
  contentId: string;
  textContent: string;
  platform: string;
  language: string;
  hashtags?: string[];
  imageUrl?: string;
  targetAudience?: 'general' | 'kpop_fans' | 'collectors' | 'traders';
  contentCategory?: 'album' | 'photocard' | 'merchandise' | 'concert' | 'general';
}

export interface QualityAssessmentResponse {
  id: string;
  overallScore: number;
  scores: {
    creativity: number;
    relevance: number;
    culturalSensitivity: number;
    languageQuality: number;
    engagementPotential: number;
    brandSafety: number;
  };
  sentimentAnalysis: {
    score: number; // -1 to 1
    label: 'negative' | 'neutral' | 'positive';
    confidence: number;
  };
  engagementPrediction: {
    expectedLikes: number;
    expectedShares: number;
    expectedComments: number;
    engagementRate: number; // percentage
    viralPotential: number; // 0-100
  };
  feedback: string[];
  improvementSuggestions: string[];
  riskFactors: string[];
  approved: boolean;
  confidenceLevel: number;
}

export interface EngagementMetrics {
  platform: string;
  avgLikes: number;
  avgShares: number;
  avgComments: number;
  avgEngagementRate: number;
  topPerformingHours: number[];
  topPerformingHashtags: string[];
  audienceInsights: {
    primaryAge: string;
    primaryGender: string;
    topCountries: string[];
    interests: string[];
  };
}

export interface TrendAnalysis {
  trendingTopics: string[];
  trendingHashtags: string[];
  trendingKeywords: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  momentum: 'rising' | 'stable' | 'declining';
  recommendedTiming: string[];
}

class ContentQualityAssessor {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Comprehensive content quality assessment
   */
  async assessContent(request: QualityAssessmentRequest): Promise<QualityAssessmentResponse> {
    try {
      // Run multiple assessments in parallel
      const [
        qualityScores,
        sentimentAnalysis,
        engagementPrediction,
        riskAssessment,
      ] = await Promise.all([
        this.assessQualityScores(request),
        this.analyzeSentiment(request.textContent, request.language),
        this.predictEngagement(request),
        this.assessRisks(request),
      ]);

      // Calculate overall score
      const overallScore = this.calculateOverallScore(qualityScores);

      // Determine approval status
      const approved = this.determineApproval(overallScore, qualityScores, riskAssessment.risks);

      // Generate feedback and suggestions
      const feedback = await this.generateFeedback(request, qualityScores, sentimentAnalysis);
      const suggestions = await this.generateImprovementSuggestions(request, qualityScores);

      // Save assessment to database
      const assessmentId = await this.saveAssessment({
        contentId: request.contentId,
        overallScore,
        scores: qualityScores,
        sentimentScore: sentimentAnalysis.score,
        engagementPrediction: engagementPrediction.engagementRate,
        feedback: feedback.join('. '),
        suggestions,
        approved,
        riskFactors: riskAssessment.risks,
      });

      return {
        id: assessmentId,
        overallScore,
        scores: qualityScores,
        sentimentAnalysis,
        engagementPrediction,
        feedback,
        improvementSuggestions: suggestions,
        riskFactors: riskAssessment.risks,
        approved,
        confidenceLevel: riskAssessment.confidence,
      };

    } catch (error) {
      console.error('Error assessing content quality:', error);
      throw error;
    }
  }

  /**
   * Assess individual quality scores using AI
   */
  private async assessQualityScores(request: QualityAssessmentRequest) {
    const assessmentPrompt = `Assess this ${request.platform} content for ${request.targetAudience} audience:

Content: "${request.textContent}"
Platform: ${request.platform}
Language: ${request.language}
Category: ${request.contentCategory}
Hashtags: ${request.hashtags?.join(', ') || 'none'}

Rate each aspect from 1-10:

1. Creativity: How original and creative is the content?
2. Relevance: How relevant is it to K-pop and group order context?
3. Cultural Sensitivity: How culturally appropriate is it for ${request.language} speakers?
4. Language Quality: Grammar, spelling, and language flow
5. Engagement Potential: How likely to get likes, shares, comments?
6. Brand Safety: Is it safe for brands and free from controversial content?

Consider:
- Platform best practices for ${request.platform}
- K-pop culture and terminology
- ${request.language} language nuances
- ${request.targetAudience} audience preferences
- Group order marketing effectiveness

Return JSON:
{
  "creativity": 8.5,
  "relevance": 9.0,
  "culturalSensitivity": 8.8,
  "languageQuality": 9.2,
  "engagementPotential": 8.0,
  "brandSafety": 9.5,
  "reasoning": "Brief explanation of scores"
}`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: assessmentPrompt }],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      });

      const response = completion.choices[0]?.message?.content;
      if (response) {
        const scores = JSON.parse(response);
        return {
          creativity: scores.creativity || 7.0,
          relevance: scores.relevance || 7.0,
          culturalSensitivity: scores.culturalSensitivity || 7.0,
          languageQuality: scores.languageQuality || 7.0,
          engagementPotential: scores.engagementPotential || 7.0,
          brandSafety: scores.brandSafety || 7.0,
        };
      }
    } catch (error) {
      console.error('Error assessing quality scores:', error);
    }

    // Default scores if AI assessment fails
    return {
      creativity: 7.0,
      relevance: 7.0,
      culturalSensitivity: 7.0,
      languageQuality: 7.0,
      engagementPotential: 7.0,
      brandSafety: 7.0,
    };
  }

  /**
   * Analyze sentiment of content
   */
  private async analyzeSentiment(content: string, language: string) {
    const sentimentPrompt = `Analyze the sentiment of this ${language} text:
"${content}"

Consider:
- Overall emotional tone
- Cultural context for ${language} speakers
- K-pop fan communication style
- Social media context

Return JSON:
{
  "score": 0.8,
  "label": "positive",
  "confidence": 0.95,
  "reasoning": "Brief explanation"
}

Score: -1 (very negative) to 1 (very positive)
Label: "negative", "neutral", or "positive"
Confidence: 0-1 (how certain you are)`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: sentimentPrompt }],
        temperature: 0.2,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      });

      const response = completion.choices[0]?.message?.content;
      if (response) {
        const sentiment = JSON.parse(response);
        return {
          score: sentiment.score || 0.5,
          label: sentiment.label || 'neutral',
          confidence: sentiment.confidence || 0.8,
        };
      }
    } catch (error) {
      console.error('Error analyzing sentiment:', error);
    }

    return {
      score: 0.5,
      label: 'neutral' as const,
      confidence: 0.8,
    };
  }

  /**
   * Predict engagement metrics
   */
  private async predictEngagement(request: QualityAssessmentRequest) {
    // Get historical performance data for similar content
    const historicalData = await this.getHistoricalPerformance(
      request.platform,
      request.contentCategory || 'general'
    );

    // AI-powered engagement prediction
    const predictionPrompt = `Predict engagement for this ${request.platform} post:

Content: "${request.textContent}"
Platform: ${request.platform}
Category: ${request.contentCategory}
Hashtags: ${request.hashtags?.join(', ') || 'none'}
Target: ${request.targetAudience}

Historical averages for similar content:
- Likes: ${historicalData.avgLikes}
- Shares: ${historicalData.avgShares}
- Comments: ${historicalData.avgComments}
- Engagement Rate: ${historicalData.avgEngagementRate}%

Consider:
- Content quality and appeal
- Hashtag effectiveness
- Platform algorithm preferences
- K-pop community engagement patterns
- Time sensitivity of group orders

Return JSON:
{
  "expectedLikes": 150,
  "expectedShares": 25,
  "expectedComments": 30,
  "engagementRate": 5.2,
  "viralPotential": 35,
  "reasoning": "Brief explanation"
}

Viral potential: 0-100 (likelihood of going viral)`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: predictionPrompt }],
        temperature: 0.4,
        max_tokens: 300,
        response_format: { type: 'json_object' },
      });

      const response = completion.choices[0]?.message?.content;
      if (response) {
        const prediction = JSON.parse(response);
        return {
          expectedLikes: prediction.expectedLikes || historicalData.avgLikes,
          expectedShares: prediction.expectedShares || historicalData.avgShares,
          expectedComments: prediction.expectedComments || historicalData.avgComments,
          engagementRate: prediction.engagementRate || historicalData.avgEngagementRate,
          viralPotential: prediction.viralPotential || 20,
        };
      }
    } catch (error) {
      console.error('Error predicting engagement:', error);
    }

    // Default predictions based on historical data
    return {
      expectedLikes: historicalData.avgLikes,
      expectedShares: historicalData.avgShares,
      expectedComments: historicalData.avgComments,
      engagementRate: historicalData.avgEngagementRate,
      viralPotential: 20,
    };
  }

  /**
   * Assess content risks
   */
  private async assessRisks(request: QualityAssessmentRequest) {
    const riskPrompt = `Assess potential risks in this social media content:

Content: "${request.textContent}"
Platform: ${request.platform}
Language: ${request.language}

Check for:
1. Cultural insensitivity or appropriation
2. Controversial statements
3. Potential copyright issues
4. Inappropriate language
5. Misleading information
6. Platform policy violations
7. Brand safety concerns

Return JSON:
{
  "risks": ["risk1", "risk2"],
  "severity": "low",
  "confidence": 0.9,
  "recommendations": ["recommendation1", "recommendation2"]
}

Severity: "low", "medium", "high"
Confidence: 0-1 (how certain you are about the assessment)`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: riskPrompt }],
        temperature: 0.1,
        max_tokens: 400,
        response_format: { type: 'json_object' },
      });

      const response = completion.choices[0]?.message?.content;
      if (response) {
        const riskAssessment = JSON.parse(response);
        return {
          risks: riskAssessment.risks || [],
          severity: riskAssessment.severity || 'low',
          confidence: riskAssessment.confidence || 0.9,
          recommendations: riskAssessment.recommendations || [],
        };
      }
    } catch (error) {
      console.error('Error assessing risks:', error);
    }

    return {
      risks: [],
      severity: 'low',
      confidence: 0.9,
      recommendations: [],
    };
  }

  /**
   * Calculate overall quality score
   */
  private calculateOverallScore(scores: any): number {
    const weights = {
      creativity: 0.15,
      relevance: 0.20,
      culturalSensitivity: 0.15,
      languageQuality: 0.15,
      engagementPotential: 0.25,
      brandSafety: 0.10,
    };

    let weightedSum = 0;
    let totalWeight = 0;

    for (const [key, weight] of Object.entries(weights)) {
      if (scores[key] !== undefined) {
        weightedSum += scores[key] * weight;
        totalWeight += weight;
      }
    }

    return totalWeight > 0 ? Number((weightedSum / totalWeight).toFixed(2)) : 7.0;
  }

  /**
   * Determine approval status
   */
  private determineApproval(
    overallScore: number,
    scores: any,
    risks: string[]
  ): boolean {
    // Auto-reject if high-risk factors present
    if (risks.length > 0) {
      const highRiskKeywords = ['copyright', 'inappropriate', 'controversial', 'violation'];
      const hasHighRisk = risks.some(risk => 
        highRiskKeywords.some(keyword => risk.toLowerCase().includes(keyword))
      );
      if (hasHighRisk) return false;
    }

    // Require minimum scores
    const minimumRequirements = {
      overallScore: 6.0,
      brandSafety: 7.0,
      culturalSensitivity: 6.5,
    };

    return overallScore >= minimumRequirements.overallScore &&
           scores.brandSafety >= minimumRequirements.brandSafety &&
           scores.culturalSensitivity >= minimumRequirements.culturalSensitivity;
  }

  /**
   * Generate feedback messages
   */
  private async generateFeedback(
    request: QualityAssessmentRequest,
    scores: any,
    sentiment: any
  ): Promise<string[]> {
    const feedback: string[] = [];

    // Score-based feedback
    if (scores.creativity < 6) {
      feedback.push('Consider adding more creative elements or unique perspectives to make your content stand out');
    }
    if (scores.relevance < 7) {
      feedback.push('Try to include more K-pop specific references or group order terminology');
    }
    if (scores.engagementPotential < 7) {
      feedback.push('Add more engaging elements like questions, calls-to-action, or exciting announcements');
    }
    if (scores.languageQuality < 8) {
      feedback.push('Review grammar and spelling to ensure professional presentation');
    }

    // Sentiment feedback
    if (sentiment.score < 0.2) {
      feedback.push('Consider using more positive language to create excitement and community engagement');
    }

    // Platform-specific feedback
    if (request.platform === 'instagram' && !request.hashtags?.length) {
      feedback.push('Instagram posts perform better with relevant hashtags - consider adding 10-15 targeted hashtags');
    }
    if (request.platform === 'twitter' && request.textContent.length > 250) {
      feedback.push('Twitter posts under 250 characters tend to get better engagement');
    }

    return feedback.length > 0 ? feedback : ['Great content! All quality metrics look good.'];
  }

  /**
   * Generate improvement suggestions
   */
  private async generateImprovementSuggestions(
    request: QualityAssessmentRequest,
    scores: any
  ): Promise<string[]> {
    const suggestions: string[] = [];

    // Get AI-powered suggestions
    const suggestionPrompt = `Based on these quality scores for ${request.platform} content:
Creativity: ${scores.creativity}/10
Relevance: ${scores.relevance}/10
Engagement Potential: ${scores.engagementPotential}/10

Content: "${request.textContent}"

Provide 3 specific, actionable improvement suggestions.

Return JSON:
{
  "suggestions": ["suggestion1", "suggestion2", "suggestion3"]
}`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: suggestionPrompt }],
        temperature: 0.7,
        max_tokens: 300,
        response_format: { type: 'json_object' },
      });

      const response = completion.choices[0]?.message?.content;
      if (response) {
        const parsed = JSON.parse(response);
        suggestions.push(...(parsed.suggestions || []));
      }
    } catch (error) {
      console.error('Error generating suggestions:', error);
    }

    // Add default suggestions if none generated
    if (suggestions.length === 0) {
      suggestions.push(
        'Add more emojis to make your content more visually appealing',
        'Include a clear call-to-action to encourage engagement',
        'Use trending K-pop hashtags to increase discoverability'
      );
    }

    return suggestions;
  }

  /**
   * Get historical performance data
   */
  private async getHistoricalPerformance(
    platform: string,
    category: string
  ): Promise<EngagementMetrics> {
    // This would query actual performance data from your database
    // For now, return realistic estimates based on platform and category

    const platformDefaults = {
      twitter: { likes: 50, shares: 8, comments: 12, rate: 3.2 },
      instagram: { likes: 150, shares: 15, comments: 25, rate: 4.8 },
      tiktok: { likes: 300, shares: 45, comments: 35, rate: 8.5 },
      facebook: { likes: 75, shares: 12, comments: 18, rate: 2.8 },
      telegram: { likes: 25, shares: 5, comments: 8, rate: 2.1 },
    };

    const defaults = platformDefaults[platform as keyof typeof platformDefaults] || 
                    platformDefaults.instagram;

    // Category multipliers
    const categoryMultipliers = {
      album: 1.3,
      photocard: 1.1,
      concert: 1.5,
      merchandise: 0.9,
      general: 1.0,
    };

    const multiplier = categoryMultipliers[category as keyof typeof categoryMultipliers] || 1.0;

    return {
      platform,
      avgLikes: Math.round(defaults.likes * multiplier),
      avgShares: Math.round(defaults.shares * multiplier),
      avgComments: Math.round(defaults.comments * multiplier),
      avgEngagementRate: Number((defaults.rate * multiplier).toFixed(1)),
      topPerformingHours: [10, 14, 18, 20], // Peak hours in local time
      topPerformingHashtags: ['#kpop', '#grouporder', '#preorder'],
      audienceInsights: {
        primaryAge: '18-24',
        primaryGender: 'Female',
        topCountries: ['Philippines', 'Thailand', 'Indonesia', 'Malaysia'],
        interests: ['K-pop', 'Music', 'Collecting', 'Social Media'],
      },
    };
  }

  /**
   * Save quality assessment to database
   */
  private async saveAssessment(data: {
    contentId: string;
    overallScore: number;
    scores: any;
    sentimentScore: number;
    engagementPrediction: number;
    feedback: string;
    suggestions: string[];
    approved: boolean;
    riskFactors: string[];
  }): Promise<string> {
    const { data: saved, error } = await supabase
      .from('ai_content_quality_assessments')
      .insert({
        content_id: data.contentId,
        assessment_type: 'automated',
        overall_score: data.overallScore,
        creativity_score: data.scores.creativity,
        relevance_score: data.scores.relevance,
        cultural_sensitivity_score: data.scores.culturalSensitivity,
        language_quality_score: data.scores.languageQuality,
        engagement_potential_score: data.scores.engagementPotential,
        brand_safety_score: data.scores.brandSafety,
        feedback: data.feedback,
        improvement_suggestions: data.suggestions,
        approved: data.approved,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error saving assessment:', error);
      throw new Error('Failed to save quality assessment');
    }

    return saved.id;
  }

  /**
   * Get content performance analytics
   */
  async getContentAnalytics(contentIds: string[]) {
    const { data, error } = await supabase
      .from('ai_content_quality_assessments')
      .select(`
        content_id,
        overall_score,
        engagement_potential_score,
        approved,
        created_at
      `)
      .in('content_id', contentIds)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching content analytics:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get trending content analysis
   */
  async getTrendingAnalysis(platform: string, language: string): Promise<TrendAnalysis> {
    // This would analyze current social media trends
    // For now, return mock trending data specific to K-pop and group orders
    
    const trendingData = {
      trendingTopics: [
        'New album releases',
        'Concert tour announcements',
        'Limited edition photocards',
        'Group order deadlines',
        'Shipping updates',
      ],
      trendingHashtags: [
        '#KpopGroupOrder',
        '#LimitedEdition',
        '#PreorderNow',
        '#AlbumCollection',
        '#PhotocardTrade',
      ],
      trendingKeywords: [
        'comeback',
        'exclusive',
        'limited time',
        'presale',
        'collector edition',
      ],
      sentiment: 'positive' as const,
      momentum: 'rising' as const,
      recommendedTiming: [
        'Evening posts (6-8 PM) get highest engagement',
        'Weekends perform 20% better for group orders',
        'Post 2-3 days before deadline for urgency',
        'Comeback announcement periods see 50% higher activity',
      ],
    };

    return trendingData;
  }
}

// Export singleton instance
export const contentQualityAssessor = new ContentQualityAssessor();

// Export types
export type {
  QualityAssessmentRequest,
  QualityAssessmentResponse,
  EngagementMetrics,
  TrendAnalysis,
};
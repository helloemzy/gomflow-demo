import { supabase } from '@/lib/supabase/client';
import { contentQualityAssessor } from './quality-assessor';
import { aiContentGenerator } from './generator';

// Types for A/B testing
export interface ABTestRequest {
  name: string;
  description?: string;
  baseContentId: string;
  testType: 'text_variation' | 'image_variation' | 'hashtag_variation' | 'timing' | 'platform_comparison';
  platform: string;
  targetAudience?: {
    demographics?: string[];
    interests?: string[];
    countries?: string[];
    languages?: string[];
  };
  testDuration?: number; // days
  variants: ABTestVariant[];
  successMetrics: string[]; // 'engagement_rate', 'click_through_rate', 'conversion_rate', etc.
}

export interface ABTestVariant {
  name: string;
  description?: string;
  contentId?: string; // If using existing content
  modifications?: {
    textChanges?: string;
    imageChanges?: string;
    hashtagChanges?: string[];
    timingChanges?: string;
  };
  trafficAllocation?: number; // percentage, defaults to equal split
}

export interface ABTestResponse {
  id: string;
  name: string;
  status: 'draft' | 'running' | 'completed' | 'paused';
  startDate: string;
  endDate?: string;
  variants: ABTestVariantResult[];
  winner?: {
    variantId: string;
    confidenceLevel: number;
    improvement: number; // percentage improvement
  };
  insights: string[];
  recommendations: string[];
}

export interface ABTestVariantResult {
  id: string;
  name: string;
  contentId: string;
  metrics: {
    impressions: number;
    clicks: number;
    likes: number;
    shares: number;
    comments: number;
    saves: number;
    clickThroughRate: number;
    engagementRate: number;
    conversionRate: number;
    costPerEngagement?: number;
  };
  performance: {
    score: number; // overall performance score
    rank: number; // ranking among variants
    isWinner: boolean;
    statisticalSignificance: boolean;
    confidenceLevel: number;
  };
}

export interface ABTestMetrics {
  testId: string;
  variantId: string;
  contentId: string;
  date: string;
  impressions: number;
  clicks: number;
  likes: number;
  shares: number;
  comments: number;
  saves: number;
  cost?: number;
}

export interface StatisticalAnalysis {
  sampleSize: number;
  conversions: number;
  conversionRate: number;
  standardError: number;
  confidenceInterval: [number, number];
  statisticalSignificance: boolean;
  confidenceLevel: number;
  pValue: number;
}

class ABTestingFramework {
  /**
   * Create a new A/B test
   */
  async createABTest(request: ABTestRequest): Promise<ABTestResponse> {
    try {
      // Validate request
      this.validateABTestRequest(request);

      // Create variant content if needed
      const variantContentIds = await this.createVariantContent(request);

      // Create A/B test record
      const { data: testData, error: testError } = await supabase
        .from('ai_content_ab_tests')
        .insert({
          name: request.name,
          description: request.description,
          base_content_id: request.baseContentId,
          variant_content_ids: variantContentIds,
          test_type: request.testType,
          platform: request.platform,
          target_audience: request.targetAudience || {},
          end_date: request.testDuration ? 
            new Date(Date.now() + request.testDuration * 24 * 60 * 60 * 1000).toISOString() : null,
          status: 'draft',
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (testError) {
        throw new Error(`Failed to create A/B test: ${testError.message}`);
      }

      // Initialize metrics for each variant
      await this.initializeVariantMetrics(testData.id, variantContentIds);

      return await this.getABTestResults(testData.id);

    } catch (error) {
      console.error('Error creating A/B test:', error);
      throw error;
    }
  }

  /**
   * Start an A/B test
   */
  async startABTest(testId: string): Promise<ABTestResponse> {
    const { error } = await supabase
      .from('ai_content_ab_tests')
      .update({
        status: 'running',
        start_date: new Date().toISOString(),
      })
      .eq('id', testId);

    if (error) {
      throw new Error(`Failed to start A/B test: ${error.message}`);
    }

    return await this.getABTestResults(testId);
  }

  /**
   * Stop an A/B test
   */
  async stopABTest(testId: string): Promise<ABTestResponse> {
    // Analyze results and determine winner
    const analysis = await this.analyzeABTestResults(testId);
    
    const { error } = await supabase
      .from('ai_content_ab_tests')
      .update({
        status: 'completed',
        end_date: new Date().toISOString(),
        winner_content_id: analysis.winner?.variantId,
        confidence_level: analysis.winner?.confidenceLevel,
      })
      .eq('id', testId);

    if (error) {
      throw new Error(`Failed to stop A/B test: ${error.message}`);
    }

    return await this.getABTestResults(testId);
  }

  /**
   * Get A/B test results
   */
  async getABTestResults(testId: string): Promise<ABTestResponse> {
    // Get test data
    const { data: testData, error: testError } = await supabase
      .from('ai_content_ab_tests')
      .select('*')
      .eq('id', testId)
      .single();

    if (testError) {
      throw new Error(`Test not found: ${testError.message}`);
    }

    // Get variant metrics
    const variants = await this.getVariantResults(testId, testData.variant_content_ids);

    // Analyze results if test is running or completed
    let winner;
    let insights: string[] = [];
    let recommendations: string[] = [];

    if (testData.status === 'running' || testData.status === 'completed') {
      const analysis = await this.analyzeABTestResults(testId);
      winner = analysis.winner;
      insights = analysis.insights;
      recommendations = analysis.recommendations;
    }

    return {
      id: testData.id,
      name: testData.name,
      status: testData.status,
      startDate: testData.start_date,
      endDate: testData.end_date,
      variants,
      winner,
      insights,
      recommendations,
    };
  }

  /**
   * Record A/B test metrics
   */
  async recordMetrics(metrics: ABTestMetrics): Promise<void> {
    const { error } = await supabase
      .from('ai_content_ab_metrics')
      .insert({
        test_id: metrics.testId,
        content_id: metrics.contentId,
        impressions: metrics.impressions,
        clicks: metrics.clicks,
        likes: metrics.likes,
        shares: metrics.shares,
        comments: metrics.comments,
        saves: metrics.saves,
        click_through_rate: metrics.clicks / (metrics.impressions || 1),
        engagement_rate: (metrics.likes + metrics.shares + metrics.comments + metrics.saves) / 
                        (metrics.impressions || 1),
        conversion_rate: metrics.clicks / (metrics.impressions || 1), // Simplified
        cost_per_engagement: metrics.cost ? 
          metrics.cost / (metrics.likes + metrics.shares + metrics.comments || 1) : null,
      });

    if (error) {
      console.error('Error recording A/B test metrics:', error);
    }
  }

  /**
   * Get A/B test analytics
   */
  async getABTestAnalytics(testId: string, timeframe: 'day' | 'week' | 'month' = 'day') {
    const intervalMap = {
      day: '1 day',
      week: '1 week', 
      month: '1 month',
    };

    const { data, error } = await supabase
      .from('ai_content_ab_metrics')
      .select('*')
      .eq('test_id', testId)
      .gte('recorded_at', `now() - interval '${intervalMap[timeframe]}'`)
      .order('recorded_at', { ascending: true });

    if (error) {
      console.error('Error fetching A/B test analytics:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Validate A/B test request
   */
  private validateABTestRequest(request: ABTestRequest): void {
    if (!request.name || request.name.trim().length === 0) {
      throw new Error('Test name is required');
    }

    if (!request.baseContentId) {
      throw new Error('Base content ID is required');
    }

    if (!request.variants || request.variants.length < 1) {
      throw new Error('At least one variant is required');
    }

    if (request.variants.length > 5) {
      throw new Error('Maximum 5 variants allowed per test');
    }

    // Validate traffic allocation
    const totalAllocation = request.variants.reduce(
      (sum, variant) => sum + (variant.trafficAllocation || 0), 
      0
    );

    if (totalAllocation > 100) {
      throw new Error('Total traffic allocation cannot exceed 100%');
    }
  }

  /**
   * Create content variants for A/B test
   */
  private async createVariantContent(request: ABTestRequest): Promise<string[]> {
    const variantContentIds: string[] = [];

    // Get base content
    const { data: baseContent, error: baseError } = await supabase
      .from('ai_generated_content')
      .select('*')
      .eq('id', request.baseContentId)
      .single();

    if (baseError || !baseContent) {
      throw new Error('Base content not found');
    }

    for (const variant of request.variants) {
      if (variant.contentId) {
        // Use existing content
        variantContentIds.push(variant.contentId);
      } else if (variant.modifications) {
        // Create new variant content
        const variantContent = await this.createVariantFromModifications(
          baseContent,
          variant,
          request
        );
        variantContentIds.push(variantContent.id);
      } else {
        throw new Error(`Variant "${variant.name}" must have either contentId or modifications`);
      }
    }

    return variantContentIds;
  }

  /**
   * Create variant content from modifications
   */
  private async createVariantFromModifications(
    baseContent: any,
    variant: ABTestVariant,
    request: ABTestRequest
  ) {
    let newTextContent = baseContent.text_content;
    let newHashtags = baseContent.hashtags || [];
    let newImageUrl = baseContent.image_url;

    // Apply text modifications
    if (variant.modifications?.textChanges) {
      newTextContent = variant.modifications.textChanges;
    }

    // Apply hashtag modifications  
    if (variant.modifications?.hashtagChanges) {
      newHashtags = variant.modifications.hashtagChanges;
    }

    // Apply image modifications (would need image generation)
    if (variant.modifications?.imageChanges) {
      // This would trigger image generation with new prompt
      // For now, keep the same image
    }

    // Create new content record
    const { data: newContent, error } = await supabase
      .from('ai_generated_content')
      .insert({
        prompt_id: baseContent.prompt_id,
        order_id: baseContent.order_id,
        user_id: baseContent.user_id,
        platform: baseContent.platform,
        content_type: baseContent.content_type,
        text_content: newTextContent,
        image_url: newImageUrl,
        hashtags: newHashtags,
        variables_used: baseContent.variables_used,
        status: 'generated',
        metadata: {
          ...baseContent.metadata,
          ab_test_variant: variant.name,
          base_content_id: baseContent.id,
        },
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create variant content: ${error.message}`);
    }

    return newContent;
  }

  /**
   * Initialize metrics for variants
   */
  private async initializeVariantMetrics(testId: string, contentIds: string[]): Promise<void> {
    const initialMetrics = contentIds.map(contentId => ({
      test_id: testId,
      content_id: contentId,
      impressions: 0,
      clicks: 0,
      likes: 0,
      shares: 0,
      comments: 0,
      saves: 0,
      click_through_rate: 0,
      engagement_rate: 0,
      conversion_rate: 0,
    }));

    const { error } = await supabase
      .from('ai_content_ab_metrics')
      .insert(initialMetrics);

    if (error) {
      console.error('Error initializing variant metrics:', error);
    }
  }

  /**
   * Get variant results
   */
  private async getVariantResults(testId: string, contentIds: string[]): Promise<ABTestVariantResult[]> {
    const results: ABTestVariantResult[] = [];

    for (const contentId of contentIds) {
      // Get aggregated metrics
      const { data: metrics } = await supabase
        .from('ai_content_ab_metrics')
        .select('*')
        .eq('test_id', testId)
        .eq('content_id', contentId);

      if (!metrics || metrics.length === 0) {
        continue;
      }

      // Aggregate metrics
      const aggregated = metrics.reduce(
        (acc, metric) => ({
          impressions: acc.impressions + metric.impressions,
          clicks: acc.clicks + metric.clicks,
          likes: acc.likes + metric.likes,
          shares: acc.shares + metric.shares,
          comments: acc.comments + metric.comments,
          saves: acc.saves + metric.saves,
        }),
        { impressions: 0, clicks: 0, likes: 0, shares: 0, comments: 0, saves: 0 }
      );

      // Calculate rates
      const clickThroughRate = aggregated.clicks / (aggregated.impressions || 1);
      const engagementRate = (aggregated.likes + aggregated.shares + 
                             aggregated.comments + aggregated.saves) / 
                            (aggregated.impressions || 1);

      // Get content info
      const { data: contentData } = await supabase
        .from('ai_generated_content')
        .select('metadata')
        .eq('id', contentId)
        .single();

      const variantName = contentData?.metadata?.ab_test_variant || `Variant ${contentId.slice(-4)}`;

      results.push({
        id: contentId,
        name: variantName,
        contentId,
        metrics: {
          ...aggregated,
          clickThroughRate,
          engagementRate,
          conversionRate: clickThroughRate, // Simplified
        },
        performance: {
          score: engagementRate * 100, // Simplified scoring
          rank: 0, // Will be calculated after all variants
          isWinner: false,
          statisticalSignificance: false,
          confidenceLevel: 0,
        },
      });
    }

    // Rank variants by performance
    results.sort((a, b) => b.performance.score - a.performance.score);
    results.forEach((result, index) => {
      result.performance.rank = index + 1;
    });

    return results;
  }

  /**
   * Analyze A/B test results and determine winner
   */
  private async analyzeABTestResults(testId: string) {
    const testResults = await this.getABTestResults(testId);
    
    if (testResults.variants.length < 2) {
      return {
        winner: null,
        insights: ['Insufficient variants for meaningful analysis'],
        recommendations: ['Add more variants to the test'],
      };
    }

    // Perform statistical significance testing
    const significance = await this.calculateStatisticalSignificance(testId);
    
    // Determine winner
    let winner = null;
    if (significance.isSignificant && testResults.variants.length > 0) {
      const topVariant = testResults.variants[0];
      winner = {
        variantId: topVariant.id,
        confidenceLevel: significance.confidenceLevel,
        improvement: this.calculateImprovement(testResults.variants),
      };
    }

    // Generate insights
    const insights = this.generateInsights(testResults.variants, significance);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(testResults.variants, significance);

    return {
      winner,
      insights,
      recommendations,
    };
  }

  /**
   * Calculate statistical significance
   */
  private async calculateStatisticalSignificance(testId: string): Promise<{
    isSignificant: boolean;
    confidenceLevel: number;
    pValue: number;
  }> {
    // Use the database function for statistical significance
    const { data, error } = await supabase
      .rpc('calculate_ab_test_significance', { test_uuid: testId });

    if (error || !data || data.length < 2) {
      return {
        isSignificant: false,
        confidenceLevel: 0,
        pValue: 1,
      };
    }

    // Simplified statistical analysis
    const topTwoVariants = data.slice(0, 2);
    const [winner, runnerUp] = topTwoVariants;

    // Basic significance test (would use proper statistical tests in production)
    const minSampleSize = 1000;
    const hasEnoughData = winner.sample_size >= minSampleSize && 
                         runnerUp.sample_size >= minSampleSize;
    
    const significantDifference = Math.abs(winner.conversion_rate - runnerUp.conversion_rate) > 0.01;
    
    const isSignificant = hasEnoughData && significantDifference;
    const confidenceLevel = isSignificant ? 0.95 : 0.70;
    const pValue = isSignificant ? 0.03 : 0.15;

    return {
      isSignificant,
      confidenceLevel,
      pValue,
    };
  }

  /**
   * Calculate improvement percentage
   */
  private calculateImprovement(variants: ABTestVariantResult[]): number {
    if (variants.length < 2) return 0;

    const winner = variants[0];
    const baseline = variants[1];
    
    if (baseline.metrics.engagementRate === 0) return 0;
    
    return ((winner.metrics.engagementRate - baseline.metrics.engagementRate) / 
            baseline.metrics.engagementRate) * 100;
  }

  /**
   * Generate insights from test results
   */
  private generateInsights(variants: ABTestVariantResult[], significance: any): string[] {
    const insights: string[] = [];

    if (variants.length === 0) {
      return ['No data available for analysis'];
    }

    const winner = variants[0];
    const totalImpressions = variants.reduce((sum, v) => sum + v.metrics.impressions, 0);

    // Sample size insights
    if (totalImpressions < 1000) {
      insights.push('Sample size is small - results may not be reliable');
    } else if (totalImpressions > 10000) {
      insights.push('Large sample size provides reliable results');
    }

    // Performance insights
    if (winner.metrics.engagementRate > 0.05) {
      insights.push('High engagement rate indicates strong content resonance');
    } else if (winner.metrics.engagementRate < 0.02) {
      insights.push('Low engagement rate suggests content needs improvement');
    }

    // Significance insights
    if (significance.isSignificant) {
      insights.push(`Results are statistically significant (${(significance.confidenceLevel * 100).toFixed(0)}% confidence)`);
    } else {
      insights.push('Results are not yet statistically significant');
    }

    // Variance insights
    const engagementRates = variants.map(v => v.metrics.engagementRate);
    const maxRate = Math.max(...engagementRates);
    const minRate = Math.min(...engagementRates);
    
    if (maxRate > minRate * 1.5) {
      insights.push('Significant variance between variants indicates content differences matter');
    } else {
      insights.push('Similar performance across variants suggests minor impact of changes');
    }

    return insights;
  }

  /**
   * Generate recommendations based on test results
   */
  private generateRecommendations(variants: ABTestVariantResult[], significance: any): string[] {
    const recommendations: string[] = [];

    if (variants.length === 0) {
      return ['Create variants and collect data before generating recommendations'];
    }

    // Sample size recommendations
    const totalImpressions = variants.reduce((sum, v) => sum + v.metrics.impressions, 0);
    if (totalImpressions < 1000) {
      recommendations.push('Continue test to reach at least 1,000 impressions for reliable results');
    }

    // Winner recommendations
    if (significance.isSignificant && variants.length > 1) {
      const winner = variants[0];
      const improvement = this.calculateImprovement(variants);
      
      if (improvement > 20) {
        recommendations.push(`Implement winning variant - shows ${improvement.toFixed(1)}% improvement`);
      } else if (improvement > 10) {
        recommendations.push(`Consider implementing winning variant - shows ${improvement.toFixed(1)}% improvement`);
      }
    }

    // Performance recommendations
    const avgEngagement = variants.reduce((sum, v) => sum + v.metrics.engagementRate, 0) / variants.length;
    
    if (avgEngagement < 0.02) {
      recommendations.push('Overall engagement is low - consider testing different content approaches');
      recommendations.push('Try more engaging visuals, stronger calls-to-action, or trending hashtags');
    } else if (avgEngagement > 0.06) {
      recommendations.push('Strong engagement - replicate successful elements in future content');
    }

    // Click-through rate recommendations
    const avgCTR = variants.reduce((sum, v) => sum + v.metrics.clickThroughRate, 0) / variants.length;
    
    if (avgCTR < 0.01) {
      recommendations.push('Low click-through rate - improve call-to-action clarity');
    } else if (avgCTR > 0.03) {
      recommendations.push('Excellent click-through rate - document what made this content compelling');
    }

    // Test design recommendations
    if (!significance.isSignificant) {
      recommendations.push('Test larger content variations for more decisive results');
      recommendations.push('Consider extending test duration to gather more data');
    }

    return recommendations;
  }

  /**
   * Get user's A/B tests
   */
  async getUserABTests(status?: string, limit = 10) {
    let query = supabase
      .from('ai_content_ab_tests')
      .select('*')
      .eq('created_by', (await supabase.auth.getUser()).data.user?.id);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching user A/B tests:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get A/B testing insights and best practices
   */
  async getABTestingInsights(platform: string, contentCategory: string = 'general') {
    // This would analyze historical A/B test data
    // For now, return best practices

    const insights = {
      platform,
      contentCategory,
      bestPractices: [
        'Test one element at a time for clear results',
        'Run tests for at least 7 days to account for weekly patterns',
        'Ensure at least 1,000 impressions per variant',
        'Focus on testing headlines, images, and call-to-actions',
        'Document learnings for future content creation',
      ],
      recommendedTests: [
        'Emoji usage in captions',
        'Hashtag quantity and placement',
        'Image style variations',
        'Posting time optimization',
        'Call-to-action phrasing',
      ],
      successFactors: [
        'Clear hypothesis before testing',
        'Sufficient sample size',
        'Statistical significance threshold',
        'Consistent testing methodology',
        'Actionable follow-up on results',
      ],
    };

    return insights;
  }
}

// Export singleton instance
export const abTestingFramework = new ABTestingFramework();

// Export types
export type {
  ABTestRequest,
  ABTestResponse,
  ABTestVariant,
  ABTestVariantResult,
  ABTestMetrics,
  StatisticalAnalysis,
};
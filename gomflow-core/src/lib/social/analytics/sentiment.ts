// GOMFLOW Social Media Sentiment Analysis Service
// Advanced sentiment analysis and competitor monitoring

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

interface SentimentResult {
  score: number; // -1 (negative) to 1 (positive)
  magnitude: number; // 0 to 1 (intensity)
  label: 'positive' | 'negative' | 'neutral';
  confidence: number; // 0 to 1
  emotions?: {
    joy?: number;
    anger?: number;
    fear?: number;
    sadness?: number;
    surprise?: number;
    disgust?: number;
  };
  keywords?: string[];
}

interface CompetitorInsight {
  competitor_id: string;
  competitor_name: string;
  platform: string;
  sentiment_trend: 'improving' | 'declining' | 'stable';
  avg_sentiment: number;
  engagement_comparison: number; // Relative to your performance
  content_themes: string[];
  opportunities: string[];
  threats: string[];
}

interface SentimentTrend {
  date: string;
  positive_count: number;
  negative_count: number;
  neutral_count: number;
  avg_sentiment: number;
  total_mentions: number;
}

export class SocialSentimentAnalyzer {
  private supabase;
  private sentimentCache = new Map<string, SentimentResult>();

  constructor() {
    this.supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Analyze sentiment of text content
   */
  async analyzeSentiment(text: string, useAdvanced = false): Promise<SentimentResult> {
    if (!text || text.trim().length === 0) {
      return this.getNeutralSentiment();
    }

    // Check cache first
    const cacheKey = `${text.substring(0, 100)}_${useAdvanced}`;
    if (this.sentimentCache.has(cacheKey)) {
      return this.sentimentCache.get(cacheKey)!;
    }

    let result: SentimentResult;

    if (useAdvanced && process.env.OPENAI_API_KEY) {
      result = await this.advancedSentimentAnalysis(text);
    } else {
      result = await this.basicSentimentAnalysis(text);
    }

    // Cache the result
    this.sentimentCache.set(cacheKey, result);
    
    // Clean cache if it gets too large
    if (this.sentimentCache.size > 1000) {
      const firstKey = this.sentimentCache.keys().next().value;
      this.sentimentCache.delete(firstKey);
    }

    return result;
  }

  /**
   * Analyze sentiment for a batch of posts
   */
  async analyzeBatchSentiment(
    postIds: string[],
    updateDatabase = true
  ): Promise<Map<string, SentimentResult>> {
    const results = new Map<string, SentimentResult>();

    try {
      // Get posts content
      const { data: posts } = await this.supabase
        .from('social_posts')
        .select('id, content')
        .in('id', postIds);

      if (!posts) return results;

      // Analyze each post
      for (const post of posts) {
        const sentiment = await this.analyzeSentiment(post.content || '');
        results.set(post.id, sentiment);

        // Update database if requested
        if (updateDatabase) {
          await this.supabase
            .from('social_posts')
            .update({
              sentiment_score: sentiment.score,
              sentiment_label: sentiment.label
            })
            .eq('id', post.id);
        }
      }

      return results;
    } catch (error) {
      console.error('Error analyzing batch sentiment:', error);
      return results;
    }
  }

  /**
   * Get sentiment trends over time for an account
   */
  async getSentimentTrends(
    accountId: string,
    dateRange: { start: Date; end: Date },
    granularity: 'daily' | 'weekly' = 'daily'
  ): Promise<SentimentTrend[]> {
    try {
      const { data: posts } = await this.supabase
        .from('social_posts')
        .select('posted_at, sentiment_score, sentiment_label')
        .eq('account_id', accountId)
        .gte('posted_at', dateRange.start.toISOString())
        .lte('posted_at', dateRange.end.toISOString())
        .order('posted_at', { ascending: true });

      if (!posts || posts.length === 0) return [];

      // Group by date
      const grouped = new Map<string, {
        positive: number;
        negative: number;
        neutral: number;
        scores: number[];
      }>();

      posts.forEach(post => {
        const date = new Date(post.posted_at);
        let dateKey: string;

        if (granularity === 'weekly') {
          // Get week start date
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          dateKey = weekStart.toISOString().split('T')[0];
        } else {
          dateKey = date.toISOString().split('T')[0];
        }

        if (!grouped.has(dateKey)) {
          grouped.set(dateKey, {
            positive: 0,
            negative: 0,
            neutral: 0,
            scores: []
          });
        }

        const dayData = grouped.get(dateKey)!;
        const label = post.sentiment_label || 'neutral';
        
        if (label === 'positive') dayData.positive++;
        else if (label === 'negative') dayData.negative++;
        else dayData.neutral++;
        
        if (post.sentiment_score !== null) {
          dayData.scores.push(post.sentiment_score);
        }
      });

      // Convert to trend array
      return Array.from(grouped.entries())
        .map(([date, data]) => ({
          date,
          positive_count: data.positive,
          negative_count: data.negative,
          neutral_count: data.neutral,
          avg_sentiment: data.scores.length > 0 
            ? data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length 
            : 0,
          total_mentions: data.positive + data.negative + data.neutral
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      console.error('Error getting sentiment trends:', error);
      return [];
    }
  }

  /**
   * Monitor competitor sentiment and performance
   */
  async analyzeCompetitors(gomId: string): Promise<CompetitorInsight[]> {
    try {
      // Get competitor accounts
      const { data: competitors } = await this.supabase
        .from('competitor_accounts')
        .select(`
          *,
          social_platforms(name, display_name)
        `)
        .eq('gom_id', gomId)
        .eq('is_monitoring', true);

      if (!competitors || competitors.length === 0) return [];

      const insights: CompetitorInsight[] = [];

      for (const competitor of competitors) {
        // Get recent performance data
        const { data: performance } = await this.supabase
          .from('competitor_performance')
          .select('*')
          .eq('competitor_id', competitor.id)
          .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .order('date', { ascending: false });

        if (!performance || performance.length === 0) continue;

        const recentPerf = performance[0];
        const oldestPerf = performance[performance.length - 1];

        // Calculate trends
        const sentimentTrend = this.calculateSentimentTrend(performance);
        const avgSentiment = performance.reduce((sum, p) => sum + (p.average_engagement_rate || 0), 0) / performance.length;

        // Get your performance for comparison
        const yourPerformance = await this.getYourPerformance(gomId, competitor.platform_id);
        const engagementComparison = yourPerformance ? 
          (recentPerf.average_engagement_rate || 0) / yourPerformance : 1;

        // Extract content themes
        const contentThemes = this.extractContentThemes(performance);

        // Identify opportunities and threats
        const { opportunities, threats } = this.identifyOpportunitiesAndThreats(competitor, performance, yourPerformance);

        insights.push({
          competitor_id: competitor.id,
          competitor_name: competitor.competitor_name,
          platform: competitor.social_platforms.display_name,
          sentiment_trend: sentimentTrend,
          avg_sentiment: avgSentiment,
          engagement_comparison: engagementComparison,
          content_themes: contentThemes,
          opportunities,
          threats
        });
      }

      return insights;
    } catch (error) {
      console.error('Error analyzing competitors:', error);
      return [];
    }
  }

  /**
   * Get sentiment analysis for engagement data (comments, mentions)
   */
  async analyzeEngagementSentiment(
    postId: string,
    updateDatabase = true
  ): Promise<{ positive: number; negative: number; neutral: number; details: any[] }> {
    try {
      const { data: engagements } = await this.supabase
        .from('engagement_metrics')
        .select('*')
        .eq('post_id', postId)
        .in('metric_type', ['comment', 'mention'])
        .not('content', 'is', null);

      if (!engagements) {
        return { positive: 0, negative: 0, neutral: 0, details: [] };
      }

      const results = { positive: 0, negative: 0, neutral: 0, details: [] as any[] };

      for (const engagement of engagements) {
        const sentiment = await this.analyzeSentiment(engagement.content || '');
        
        if (sentiment.label === 'positive') results.positive++;
        else if (sentiment.label === 'negative') results.negative++;
        else results.neutral++;

        results.details.push({
          id: engagement.id,
          content: engagement.content,
          sentiment: sentiment,
          user: engagement.username
        });

        // Update database if requested
        if (updateDatabase) {
          await this.supabase
            .from('engagement_metrics')
            .update({ sentiment_score: sentiment.score })
            .eq('id', engagement.id);
        }
      }

      return results;
    } catch (error) {
      console.error('Error analyzing engagement sentiment:', error);
      return { positive: 0, negative: 0, neutral: 0, details: [] };
    }
  }

  /**
   * Generate sentiment-based recommendations
   */
  async generateSentimentRecommendations(accountId: string): Promise<string[]> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const trends = await this.getSentimentTrends(accountId, {
        start: thirtyDaysAgo,
        end: new Date()
      });

      const recommendations: string[] = [];

      if (trends.length === 0) {
        recommendations.push('Start posting content to begin tracking sentiment trends.');
        return recommendations;
      }

      // Calculate overall sentiment
      const avgSentiment = trends.reduce((sum, trend) => sum + trend.avg_sentiment, 0) / trends.length;
      const totalNegative = trends.reduce((sum, trend) => sum + trend.negative_count, 0);
      const totalPositive = trends.reduce((sum, trend) => sum + trend.positive_count, 0);
      const totalMentions = trends.reduce((sum, trend) => sum + trend.total_mentions, 0);

      // Sentiment-based recommendations
      if (avgSentiment < -0.2) {
        recommendations.push('Consider addressing negative feedback proactively and adjusting your content strategy.');
        recommendations.push('Focus on positive, uplifting content that resonates with your audience.');
      } else if (avgSentiment > 0.3) {
        recommendations.push('Great job maintaining positive sentiment! Continue with your current content strategy.');
        recommendations.push('Leverage your positive reputation to introduce new products or services.');
      }

      // Engagement recommendations
      if (totalNegative > totalPositive * 0.3) {
        recommendations.push('Address negative comments promptly and professionally to maintain brand reputation.');
        recommendations.push('Consider creating FAQ content to address common concerns.');
      }

      // Growth recommendations
      if (totalMentions < 10) {
        recommendations.push('Increase posting frequency and engagement to generate more conversations.');
        recommendations.push('Use relevant hashtags and mentions to expand your reach.');
      }

      return recommendations;
    } catch (error) {
      console.error('Error generating sentiment recommendations:', error);
      return ['Unable to generate recommendations at this time.'];
    }
  }

  /**
   * Basic sentiment analysis using keyword matching
   */
  private async basicSentimentAnalysis(text: string): Promise<SentimentResult> {
    const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
    
    // Comprehensive sentiment lexicons
    const positiveWords = [
      'amazing', 'awesome', 'beautiful', 'best', 'excellent', 'fantastic', 'good', 'great', 
      'incredible', 'love', 'perfect', 'wonderful', 'outstanding', 'brilliant', 'fabulous',
      'marvelous', 'superb', 'terrific', 'magnificent', 'spectacular', 'extraordinary',
      'delightful', 'charming', 'pleasant', 'enjoyable', 'satisfying', 'impressive',
      'remarkable', 'exceptional', 'phenomenal', 'stunning', 'gorgeous', 'lovely',
      'adorable', 'sweet', 'nice', 'cool', 'rad', 'epic', 'fire', 'lit', 'dope'
    ];

    const negativeWords = [
      'awful', 'bad', 'terrible', 'horrible', 'disgusting', 'hate', 'worst', 'ugly',
      'disappointing', 'pathetic', 'useless', 'stupid', 'annoying', 'frustrating',
      'boring', 'dull', 'mediocre', 'inferior', 'poor', 'cheap', 'fake', 'scam',
      'fraud', 'waste', 'regret', 'sorry', 'sad', 'angry', 'mad', 'furious',
      'disgusted', 'outraged', 'appalled', 'shocked', 'concerned', 'worried',
      'disappointed', 'unhappy', 'upset', 'troubled', 'bothered', 'irritated'
    ];

    const intensifiers = ['very', 'extremely', 'really', 'absolutely', 'totally', 'completely', 'utterly'];
    const negators = ['not', 'no', 'never', 'none', 'nothing', 'nowhere', 'nobody'];

    let score = 0;
    let positiveCount = 0;
    let negativeCount = 0;
    let intensity = 1;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      
      // Check for intensifiers
      if (intensifiers.includes(word) && i < words.length - 1) {
        intensity = 1.5;
        continue;
      }

      // Check for negators
      let isNegated = false;
      if (i > 0 && negators.includes(words[i - 1])) {
        isNegated = true;
      }

      // Score positive words
      if (positiveWords.includes(word)) {
        const wordScore = isNegated ? -0.5 : 1.0;
        score += wordScore * intensity;
        if (!isNegated) positiveCount++;
        else negativeCount++;
      }

      // Score negative words
      if (negativeWords.includes(word)) {
        const wordScore = isNegated ? 0.5 : -1.0;
        score += wordScore * intensity;
        if (!isNegated) negativeCount++;
        else positiveCount++;
      }

      intensity = 1; // Reset intensity
    }

    // Normalize score
    const totalWords = positiveCount + negativeCount;
    const normalizedScore = totalWords > 0 ? score / totalWords : 0;
    const finalScore = Math.max(-1, Math.min(1, normalizedScore));

    // Calculate magnitude (intensity of sentiment)
    const magnitude = totalWords > 0 ? Math.abs(score) / words.length : 0;

    // Determine label
    let label: 'positive' | 'negative' | 'neutral';
    if (finalScore > 0.1) label = 'positive';
    else if (finalScore < -0.1) label = 'negative';
    else label = 'neutral';

    // Calculate confidence based on word count and clarity
    const confidence = Math.min(1, (totalWords / 5) * 0.7 + (Math.abs(finalScore) * 0.3));

    return {
      score: Math.round(finalScore * 100) / 100,
      magnitude: Math.round(magnitude * 100) / 100,
      label,
      confidence: Math.round(confidence * 100) / 100,
      keywords: [...positiveWords.filter(w => words.includes(w)), ...negativeWords.filter(w => words.includes(w))]
    };
  }

  /**
   * Advanced sentiment analysis using AI (OpenAI)
   */
  private async advancedSentimentAnalysis(text: string): Promise<SentimentResult> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{
            role: 'system',
            content: `Analyze the sentiment of the following text and respond with a JSON object containing:
            - score: number between -1 (very negative) and 1 (very positive)
            - magnitude: number between 0 and 1 indicating intensity
            - label: "positive", "negative", or "neutral"
            - confidence: number between 0 and 1
            - emotions: object with joy, anger, fear, sadness, surprise, disgust (0-1 scale)
            - keywords: array of important sentiment-bearing words`
          }, {
            role: 'user',
            content: text
          }],
          max_tokens: 200,
          temperature: 0.1
        })
      });

      if (!response.ok) {
        throw new Error('OpenAI API request failed');
      }

      const data = await response.json();
      const result = JSON.parse(data.choices[0].message.content);

      return {
        score: Math.round(result.score * 100) / 100,
        magnitude: Math.round(result.magnitude * 100) / 100,
        label: result.label,
        confidence: Math.round(result.confidence * 100) / 100,
        emotions: result.emotions,
        keywords: result.keywords
      };
    } catch (error) {
      console.error('Error with advanced sentiment analysis:', error);
      // Fallback to basic analysis
      return this.basicSentimentAnalysis(text);
    }
  }

  /**
   * Get neutral sentiment result
   */
  private getNeutralSentiment(): SentimentResult {
    return {
      score: 0,
      magnitude: 0,
      label: 'neutral',
      confidence: 1,
      keywords: []
    };
  }

  /**
   * Helper methods for competitor analysis
   */
  private calculateSentimentTrend(performance: any[]): 'improving' | 'declining' | 'stable' {
    if (performance.length < 2) return 'stable';
    
    const recent = performance.slice(0, Math.ceil(performance.length / 3));
    const older = performance.slice(-Math.ceil(performance.length / 3));
    
    const recentAvg = recent.reduce((sum, p) => sum + (p.average_engagement_rate || 0), 0) / recent.length;
    const olderAvg = older.reduce((sum, p) => sum + (p.average_engagement_rate || 0), 0) / older.length;
    
    const change = (recentAvg - olderAvg) / olderAvg;
    
    if (change > 0.1) return 'improving';
    if (change < -0.1) return 'declining';
    return 'stable';
  }

  private extractContentThemes(performance: any[]): string[] {
    // Extract common themes from top performing content
    const themes: string[] = [];
    
    performance.forEach(p => {
      if (p.content_themes) {
        themes.push(...p.content_themes);
      }
    });
    
    // Get most common themes
    const themeCount = themes.reduce((acc, theme) => {
      acc[theme] = (acc[theme] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(themeCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([theme]) => theme);
  }

  private identifyOpportunitiesAndThreats(
    competitor: any, 
    performance: any[], 
    yourPerformance: number
  ): { opportunities: string[]; threats: string[] } {
    const opportunities: string[] = [];
    const threats: string[] = [];
    
    const avgEngagement = performance.reduce((sum, p) => sum + (p.average_engagement_rate || 0), 0) / performance.length;
    
    if (avgEngagement > yourPerformance * 1.5) {
      threats.push(`${competitor.competitor_name} has significantly higher engagement rates`);
      opportunities.push('Analyze their content strategy for insights');
    }
    
    if (competitor.follower_count > yourPerformance * 2) {
      threats.push(`${competitor.competitor_name} has a much larger audience`);
    } else if (competitor.follower_count < yourPerformance * 0.5) {
      opportunities.push('You have a larger audience reach advantage');
    }
    
    return { opportunities, threats };
  }

  private async getYourPerformance(gomId: string, platformId: string): Promise<number> {
    try {
      const { data: account } = await this.supabase
        .from('social_accounts')
        .select('follower_count')
        .eq('gom_id', gomId)
        .eq('platform_id', platformId)
        .single();
      
      return account?.follower_count || 0;
    } catch (error) {
      return 0;
    }
  }
}

// Export singleton instance
export const sentimentAnalyzer = new SocialSentimentAnalyzer();
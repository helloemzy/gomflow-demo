'use client';

import { useState, useCallback } from 'react';
import { aiContentGenerator } from '@/lib/social/ai/generator';
import { visualContentGenerator } from '@/lib/social/ai/visual-generator';
import { contentQualityAssessor } from '@/lib/social/ai/quality-assessor';
import { contentLocalizer } from '@/lib/social/ai/localization';
import { abTestingFramework } from '@/lib/social/ai/ab-testing';
import type {
  ContentGenerationRequest,
  ContentGenerationResponse,
  AIContentPrompt,
} from '@/lib/social/ai/generator';
import type {
  VisualGenerationRequest,
  VisualGenerationResponse,
} from '@/lib/social/ai/visual-generator';
import type {
  QualityAssessmentRequest,
  QualityAssessmentResponse,
  TrendAnalysis,
} from '@/lib/social/ai/quality-assessor';
import type {
  LocalizationRequest,
  LocalizationResponse,
} from '@/lib/social/ai/localization';
import type {
  ABTestRequest,
  ABTestResponse,
} from '@/lib/social/ai/ab-testing';

interface UseAIContentState {
  isLoading: boolean;
  error: string | null;
  generatedContent: ContentGenerationResponse | null;
  visualContent: VisualGenerationResponse | null;
  qualityAssessment: QualityAssessmentResponse | null;
  localizedContent: Record<string, LocalizationResponse>;
  availablePrompts: AIContentPrompt[];
  userAnalytics: any;
  trendingContent: TrendAnalysis | null;
  abTests: ABTestResponse[];
}

export function useAIContent() {
  const [state, setState] = useState<UseAIContentState>({
    isLoading: false,
    error: null,
    generatedContent: null,
    visualContent: null,
    qualityAssessment: null,
    localizedContent: {},
    availablePrompts: [],
    userAnalytics: null,
    trendingContent: null,
    abTests: [],
  });

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, isLoading: loading }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  /**
   * Generate AI content
   */
  const generateContent = useCallback(async (request: ContentGenerationRequest): Promise<ContentGenerationResponse> => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await aiContentGenerator.generateContent(request);
      setState(prev => ({ ...prev, generatedContent: result }));
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate content';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError]);

  /**
   * Generate AI image
   */
  const generateImage = useCallback(async (request: VisualGenerationRequest): Promise<VisualGenerationResponse> => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await visualContentGenerator.generateImage(request);
      setState(prev => ({ ...prev, visualContent: result }));
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate image';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError]);

  /**
   * Generate image variations
   */
  const generateImageVariations = useCallback(async (imageUrl: string, count: number = 2) => {
    setLoading(true);
    setError(null);
    
    try {
      const variations = await visualContentGenerator.generateVariations(imageUrl, count);
      return variations;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate image variations';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError]);

  /**
   * Get image suggestions
   */
  const getImageSuggestions = useCallback(async (
    textContent: string,
    platform: string,
    category: string = 'general'
  ) => {
    try {
      const suggestions = await visualContentGenerator.getImageSuggestions(textContent, platform, category);
      return suggestions;
    } catch (error) {
      console.error('Failed to get image suggestions:', error);
      return [];
    }
  }, []);

  /**
   * Assess content quality
   */
  const assessContentQuality = useCallback(async (request: QualityAssessmentRequest): Promise<QualityAssessmentResponse> => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await contentQualityAssessor.assessContent(request);
      setState(prev => ({ ...prev, qualityAssessment: result }));
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to assess content quality';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError]);

  /**
   * Localize content
   */
  const localizeContent = useCallback(async (request: LocalizationRequest): Promise<LocalizationResponse> => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await contentLocalizer.localizeContent(request);
      setState(prev => ({
        ...prev,
        localizedContent: {
          ...prev.localizedContent,
          [request.targetLanguage]: result,
        },
      }));
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to localize content';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError]);

  /**
   * Batch localize content to multiple languages
   */
  const batchLocalizeContent = useCallback(async (
    content: string,
    sourceLanguage: string,
    targetLanguages: string[],
    platform: string,
    contentType: 'text' | 'hashtags' | 'caption' | 'description' = 'text'
  ) => {
    setLoading(true);
    setError(null);
    
    try {
      const results = await contentLocalizer.batchLocalize(
        content,
        sourceLanguage,
        targetLanguages,
        platform,
        contentType
      );
      
      setState(prev => ({
        ...prev,
        localizedContent: { ...prev.localizedContent, ...results },
      }));
      
      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to batch localize content';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError]);

  /**
   * Get localized hashtags
   */
  const getLocalizedHashtags = useCallback(async (
    baseHashtags: string[],
    targetLanguage: string,
    contentCategory: string = 'general'
  ) => {
    try {
      const localizedHashtags = await contentLocalizer.getLocalizedHashtags(
        baseHashtags,
        targetLanguage,
        contentCategory
      );
      return localizedHashtags;
    } catch (error) {
      console.error('Failed to get localized hashtags:', error);
      return baseHashtags;
    }
  }, []);

  /**
   * Detect content language
   */
  const detectLanguage = useCallback(async (content: string) => {
    try {
      const detection = await contentLocalizer.detectLanguage(content);
      return detection;
    } catch (error) {
      console.error('Failed to detect language:', error);
      return { language: 'en', confidence: 0.5, alternatives: [] };
    }
  }, []);

  /**
   * Get available prompts
   */
  const getPrompts = useCallback(async (platform?: string, language: string = 'en') => {
    try {
      const prompts = await aiContentGenerator.getAvailablePrompts(platform, language);
      setState(prev => ({ ...prev, availablePrompts: prompts }));
      return prompts;
    } catch (error) {
      console.error('Failed to get prompts:', error);
      return [];
    }
  }, []);

  /**
   * Get trending prompts
   */
  const getTrendingPrompts = useCallback(async (platform?: string, language: string = 'en') => {
    try {
      const trending = await aiContentGenerator.getTrendingPrompts(platform, language);
      return trending;
    } catch (error) {
      console.error('Failed to get trending prompts:', error);
      return [];
    }
  }, []);

  /**
   * Get user analytics
   */
  const getUserAnalytics = useCallback(async (daysBack: number = 30) => {
    try {
      const analytics = await aiContentGenerator.getUserAnalytics(daysBack);
      setState(prev => ({ ...prev, userAnalytics: analytics }));
      return analytics;
    } catch (error) {
      console.error('Failed to get user analytics:', error);
      return null;
    }
  }, []);

  /**
   * Get trending content analysis
   */
  const getTrendingContent = useCallback(async (platform: string, language: string = 'en') => {
    try {
      const trending = await contentQualityAssessor.getTrendingAnalysis(platform, language);
      setState(prev => ({ ...prev, trendingContent: trending }));
      return trending;
    } catch (error) {
      console.error('Failed to get trending content:', error);
      return null;
    }
  }, []);

  /**
   * Create A/B test
   */
  const createABTest = useCallback(async (request: ABTestRequest): Promise<ABTestResponse> => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await abTestingFramework.createABTest(request);
      setState(prev => ({ ...prev, abTests: [...prev.abTests, result] }));
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create A/B test';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError]);

  /**
   * Start A/B test
   */
  const startABTest = useCallback(async (testId: string): Promise<ABTestResponse> => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await abTestingFramework.startABTest(testId);
      setState(prev => ({
        ...prev,
        abTests: prev.abTests.map(test => test.id === testId ? result : test),
      }));
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start A/B test';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError]);

  /**
   * Stop A/B test
   */
  const stopABTest = useCallback(async (testId: string): Promise<ABTestResponse> => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await abTestingFramework.stopABTest(testId);
      setState(prev => ({
        ...prev,
        abTests: prev.abTests.map(test => test.id === testId ? result : test),
      }));
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to stop A/B test';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError]);

  /**
   * Get A/B test results
   */
  const getABTestResults = useCallback(async (testId: string): Promise<ABTestResponse | null> => {
    try {
      const result = await abTestingFramework.getABTestResults(testId);
      return result;
    } catch (error) {
      console.error('Failed to get A/B test results:', error);
      return null;
    }
  }, []);

  /**
   * Get user's A/B tests
   */
  const getUserABTests = useCallback(async (status?: string, limit: number = 10) => {
    try {
      const tests = await abTestingFramework.getUserABTests(status, limit);
      setState(prev => ({ ...prev, abTests: tests }));
      return tests;
    } catch (error) {
      console.error('Failed to get user A/B tests:', error);
      return [];
    }
  }, []);

  /**
   * Record A/B test metrics
   */
  const recordABTestMetrics = useCallback(async (metrics: any) => {
    try {
      await abTestingFramework.recordMetrics(metrics);
    } catch (error) {
      console.error('Failed to record A/B test metrics:', error);
    }
  }, []);

  /**
   * Get A/B testing insights
   */
  const getABTestingInsights = useCallback(async (platform: string, contentCategory: string = 'general') => {
    try {
      const insights = await abTestingFramework.getABTestingInsights(platform, contentCategory);
      return insights;
    } catch (error) {
      console.error('Failed to get A/B testing insights:', error);
      return null;
    }
  }, []);

  /**
   * Get available languages
   */
  const getAvailableLanguages = useCallback(() => {
    return contentLocalizer.getAvailableLanguages();
  }, []);

  /**
   * Get language profile
   */
  const getLanguageProfile = useCallback((languageCode: string) => {
    return contentLocalizer.getLanguageProfile(languageCode);
  }, []);

  /**
   * Validate localization
   */
  const validateLocalization = useCallback(async (
    original: string,
    localized: string,
    targetLanguage: string
  ) => {
    try {
      const validation = await contentLocalizer.validateLocalization(original, localized, targetLanguage);
      return validation;
    } catch (error) {
      console.error('Failed to validate localization:', error);
      return { isValid: true, issues: [], suggestions: [] };
    }
  }, []);

  /**
   * Get image style recommendations
   */
  const getImageStyleRecommendations = useCallback((contentType: string, platform: string) => {
    return visualContentGenerator.getRecommendedStyles(contentType, platform);
  }, []);

  /**
   * Analyze image quality
   */
  const analyzeImage = useCallback(async (imageUrl: string) => {
    try {
      const analysis = await visualContentGenerator.analyzeImage(imageUrl);
      return analysis;
    } catch (error) {
      console.error('Failed to analyze image:', error);
      return {
        suggestions: [],
        qualityScore: 7.0,
        platformSuitability: {},
      };
    }
  }, []);

  /**
   * Clear generated content
   */
  const clearContent = useCallback(() => {
    setState(prev => ({
      ...prev,
      generatedContent: null,
      visualContent: null,
      qualityAssessment: null,
      localizedContent: {},
      error: null,
    }));
  }, []);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, [setError]);

  return {
    // State
    ...state,
    
    // Content Generation
    generateContent,
    generateImage,
    generateImageVariations,
    getImageSuggestions,
    
    // Quality Assessment
    assessContentQuality,
    
    // Localization
    localizeContent,
    batchLocalizeContent,
    getLocalizedHashtags,
    detectLanguage,
    validateLocalization,
    getAvailableLanguages,
    getLanguageProfile,
    
    // Prompts & Analytics
    getPrompts,
    getTrendingPrompts,
    getUserAnalytics,
    getTrendingContent,
    
    // A/B Testing
    createABTest,
    startABTest,
    stopABTest,
    getABTestResults,
    getUserABTests,
    recordABTestMetrics,
    getABTestingInsights,
    
    // Image Analysis
    getImageStyleRecommendations,
    analyzeImage,
    
    // Utility
    clearContent,
    clearError,
  };
}

// Export additional types for convenience
export type {
  ContentGenerationRequest,
  ContentGenerationResponse,
  VisualGenerationRequest,
  VisualGenerationResponse,
  QualityAssessmentRequest,
  QualityAssessmentResponse,
  LocalizationRequest,
  LocalizationResponse,
  ABTestRequest,
  ABTestResponse,
};
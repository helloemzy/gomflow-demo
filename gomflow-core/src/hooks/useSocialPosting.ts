/**
 * Social Posting Hook
 * Custom React hook for managing social media posting operations
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

export interface SocialAccount {
  id: string;
  platformId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  isActive: boolean;
  followerCount?: number;
  verified?: boolean;
}

export interface ScheduledPost {
  id: string;
  userId: string;
  templateId?: string;
  socialAccountId: string;
  contentData: any;
  mediaFiles: any[];
  scheduledFor: Date;
  optimalTime?: Date;
  priority: number;
  status: 'scheduled' | 'processing' | 'posted' | 'failed' | 'cancelled';
  retryCount: number;
  maxRetries: number;
  postedAt?: Date;
  platformPostId?: string;
  errorMessage?: string;
  engagementPrediction?: any;
  actualEngagement?: any;
  crossPostGroupId?: string;
}

export interface ContentTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  templateType: string;
  contentTemplate: string;
  variables: Record<string, any>;
  hashtags: string[];
  defaultMentions: string[];
  isPublic: boolean;
  usageCount: number;
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

export interface PostingAnalytics {
  totalScheduled: number;
  totalPosted: number;
  totalFailed: number;
  successRate: number;
  avgEngagementRate: number;
  topPerformingTimes: Array<{ hour: number; avgEngagement: number }>;
  platformBreakdown: Record<string, number>;
}

export interface OptimalTimeRecommendation {
  suggestedTime: Date;
  confidenceScore: number;
  reasoning: string;
  alternativeTimes: Date[];
  expectedEngagement: any;
}

interface UseSocialPostingOptions {
  userId: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseSocialPostingReturn {
  // Data
  socialAccounts: SocialAccount[];
  scheduledPosts: ScheduledPost[];
  templates: ContentTemplate[];
  mediaLibrary: MediaFile[];
  analytics: PostingAnalytics | null;
  
  // Loading states
  loading: {
    accounts: boolean;
    posts: boolean;
    templates: boolean;
    media: boolean;
    analytics: boolean;
    posting: boolean;
  };
  
  // Error states
  errors: {
    accounts: string | null;
    posts: string | null;
    templates: string | null;
    media: string | null;
    analytics: string | null;
    posting: string | null;
  };
  
  // Actions
  actions: {
    // Account management
    loadSocialAccounts: () => Promise<void>;
    connectAccount: (platform: string) => Promise<string>;
    disconnectAccount: (accountId: string) => Promise<void>;
    
    // Content generation
    generateContent: (params: {
      templateId?: string;
      customContent?: string;
      variables: Record<string, any>;
      platformId: string;
      additionalHashtags?: string[];
      mentions?: string[];
      mediaFiles?: MediaFile[];
    }) => Promise<any>;
    
    // Scheduling
    schedulePost: (params: {
      templateId?: string;
      customContent?: string;
      variables: Record<string, any>;
      socialAccountIds: string[];
      mediaFiles?: MediaFile[];
      scheduledFor?: Date;
      useOptimalTiming?: boolean;
      crossPost?: boolean;
      additionalHashtags?: string[];
      mentions?: string[];
    }) => Promise<ScheduledPost>;
    
    scheduleMultiplePosts: (params: {
      posts: Array<{
        templateId?: string;
        customContent?: string;
        variables: Record<string, any>;
        socialAccountIds: string[];
        mediaFiles?: MediaFile[];
        scheduledFor?: Date;
      }>;
      options: {
        useOptimalTiming: boolean;
        crossPost: boolean;
      };
    }) => Promise<ScheduledPost[]>;
    
    // Post management
    loadScheduledPosts: (filters?: {
      status?: string;
      platformId?: string;
      dateRange?: { start: Date; end: Date };
    }) => Promise<void>;
    
    cancelPost: (postId: string) => Promise<void>;
    reschedulePost: (postId: string, newTime: Date) => Promise<void>;
    duplicatePost: (postId: string) => Promise<ScheduledPost>;
    
    // Templates
    loadTemplates: (filters?: {
      category?: string;
      templateType?: string;
      isPublic?: boolean;
      searchText?: string;
    }) => Promise<void>;
    
    createTemplate: (template: Omit<ContentTemplate, 'id' | 'usageCount'>) => Promise<ContentTemplate>;
    updateTemplate: (templateId: string, updates: Partial<ContentTemplate>) => Promise<ContentTemplate>;
    deleteTemplate: (templateId: string) => Promise<void>;
    cloneTemplate: (templateId: string, customName?: string) => Promise<ContentTemplate>;
    
    // Media management
    loadMediaLibrary: (filters?: {
      mimeType?: string;
      tags?: string[];
      searchText?: string;
    }) => Promise<void>;
    
    uploadMedia: (files: File[], options?: {
      platforms?: string[];
      generateThumbnail?: boolean;
      optimizeForWeb?: boolean;
    }) => Promise<MediaFile[]>;
    
    deleteMedia: (mediaId: string) => Promise<void>;
    
    // Analytics
    loadAnalytics: (timeRange: { start: Date; end: Date }) => Promise<void>;
    getOptimalTime: (accountId: string, targetDate?: Date) => Promise<OptimalTimeRecommendation>;
    
    // Utility
    clearErrors: () => void;
    refresh: () => Promise<void>;
  };
}

export function useSocialPosting({
  userId,
  autoRefresh = false,
  refreshInterval = 30000, // 30 seconds
}: UseSocialPostingOptions): UseSocialPostingReturn {
  // State
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [mediaLibrary, setMediaLibrary] = useState<MediaFile[]>([]);
  const [analytics, setAnalytics] = useState<PostingAnalytics | null>(null);

  const [loading, setLoading] = useState({
    accounts: false,
    posts: false,
    templates: false,
    media: false,
    analytics: false,
    posting: false,
  });

  const [errors, setErrors] = useState({
    accounts: null as string | null,
    posts: null as string | null,
    templates: null as string | null,
    media: null as string | null,
    analytics: null as string | null,
    posting: null as string | null,
  });

  // Utility functions
  const setLoadingState = useCallback((key: keyof typeof loading, value: boolean) => {
    setLoading(prev => ({ ...prev, [key]: value }));
  }, []);

  const setError = useCallback((key: keyof typeof errors, error: string | null) => {
    setErrors(prev => ({ ...prev, [key]: error }));
  }, []);

  const clearErrors = useCallback(() => {
    setErrors({
      accounts: null,
      posts: null,
      templates: null,
      media: null,
      analytics: null,
      posting: null,
    });
  }, []);

  // API call wrapper with error handling
  const apiCall = useCallback(async <T>(
    endpoint: string,
    options: RequestInit = {},
    errorKey: keyof typeof errors
  ): Promise<T> => {
    try {
      setError(errorKey, null);
      
      const response = await fetch(endpoint, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || response.statusText);
      }

      return await response.json();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      setError(errorKey, errorMessage);
      throw error;
    }
  }, [setError]);

  // Social Accounts
  const loadSocialAccounts = useCallback(async () => {
    setLoadingState('accounts', true);
    try {
      const accounts = await apiCall<SocialAccount[]>('/api/social/accounts', {}, 'accounts');
      setSocialAccounts(accounts);
    } catch (error) {
      console.error('Failed to load social accounts:', error);
    } finally {
      setLoadingState('accounts', false);
    }
  }, [apiCall, setLoadingState]);

  const connectAccount = useCallback(async (platform: string): Promise<string> => {
    const authUrl = await apiCall<{ authUrl: string }>(`/api/social/auth/${platform}`, {
      method: 'POST',
    }, 'accounts');
    return authUrl.authUrl;
  }, [apiCall]);

  const disconnectAccount = useCallback(async (accountId: string) => {
    await apiCall(`/api/social/accounts/${accountId}`, {
      method: 'DELETE',
    }, 'accounts');
    await loadSocialAccounts();
  }, [apiCall, loadSocialAccounts]);

  // Content Generation
  const generateContent = useCallback(async (params: {
    templateId?: string;
    customContent?: string;
    variables: Record<string, any>;
    platformId: string;
    additionalHashtags?: string[];
    mentions?: string[];
    mediaFiles?: MediaFile[];
  }) => {
    return await apiCall('/api/social/content/generate', {
      method: 'POST',
      body: JSON.stringify(params),
    }, 'posting');
  }, [apiCall]);

  // Scheduling
  const schedulePost = useCallback(async (params: {
    templateId?: string;
    customContent?: string;
    variables: Record<string, any>;
    socialAccountIds: string[];
    mediaFiles?: MediaFile[];
    scheduledFor?: Date;
    useOptimalTiming?: boolean;
    crossPost?: boolean;
    additionalHashtags?: string[];
    mentions?: string[];
  }): Promise<ScheduledPost> => {
    setLoadingState('posting', true);
    try {
      const scheduledPost = await apiCall<ScheduledPost>('/api/social/schedule', {
        method: 'POST',
        body: JSON.stringify({
          ...params,
          scheduledFor: params.scheduledFor?.toISOString(),
        }),
      }, 'posting');
      
      // Update local state
      setScheduledPosts(prev => [...prev, scheduledPost]);
      
      return scheduledPost;
    } finally {
      setLoadingState('posting', false);
    }
  }, [apiCall, setLoadingState]);

  const scheduleMultiplePosts = useCallback(async (params: {
    posts: Array<{
      templateId?: string;
      customContent?: string;
      variables: Record<string, any>;
      socialAccountIds: string[];
      mediaFiles?: MediaFile[];
      scheduledFor?: Date;
    }>;
    options: {
      useOptimalTiming: boolean;
      crossPost: boolean;
    };
  }): Promise<ScheduledPost[]> => {
    setLoadingState('posting', true);
    try {
      const scheduledPosts = await apiCall<ScheduledPost[]>('/api/social/schedule/bulk', {
        method: 'POST',
        body: JSON.stringify({
          ...params,
          posts: params.posts.map(post => ({
            ...post,
            scheduledFor: post.scheduledFor?.toISOString(),
          })),
        }),
      }, 'posting');
      
      // Update local state
      setScheduledPosts(prev => [...prev, ...scheduledPosts]);
      
      return scheduledPosts;
    } finally {
      setLoadingState('posting', false);
    }
  }, [apiCall, setLoadingState]);

  // Post Management
  const loadScheduledPosts = useCallback(async (filters?: {
    status?: string;
    platformId?: string;
    dateRange?: { start: Date; end: Date };
  }) => {
    setLoadingState('posts', true);
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.platformId) params.append('platform', filters.platformId);
      if (filters?.dateRange) {
        params.append('start', filters.dateRange.start.toISOString());
        params.append('end', filters.dateRange.end.toISOString());
      }

      const posts = await apiCall<ScheduledPost[]>(`/api/social/scheduled?${params}`, {}, 'posts');
      setScheduledPosts(posts.map(post => ({
        ...post,
        scheduledFor: new Date(post.scheduledFor),
        optimalTime: post.optimalTime ? new Date(post.optimalTime) : undefined,
        postedAt: post.postedAt ? new Date(post.postedAt) : undefined,
      })));
    } finally {
      setLoadingState('posts', false);
    }
  }, [apiCall, setLoadingState]);

  const cancelPost = useCallback(async (postId: string) => {
    await apiCall(`/api/social/scheduled/${postId}`, {
      method: 'DELETE',
    }, 'posts');
    
    setScheduledPosts(prev => prev.filter(post => post.id !== postId));
  }, [apiCall]);

  const reschedulePost = useCallback(async (postId: string, newTime: Date) => {
    await apiCall(`/api/social/scheduled/${postId}/reschedule`, {
      method: 'PATCH',
      body: JSON.stringify({ newTime: newTime.toISOString() }),
    }, 'posts');
    
    await loadScheduledPosts();
  }, [apiCall, loadScheduledPosts]);

  const duplicatePost = useCallback(async (postId: string): Promise<ScheduledPost> => {
    const duplicatedPost = await apiCall<ScheduledPost>(`/api/social/scheduled/${postId}/duplicate`, {
      method: 'POST',
    }, 'posts');
    
    setScheduledPosts(prev => [...prev, duplicatedPost]);
    return duplicatedPost;
  }, [apiCall]);

  // Templates
  const loadTemplates = useCallback(async (filters?: {
    category?: string;
    templateType?: string;
    isPublic?: boolean;
    searchText?: string;
  }) => {
    setLoadingState('templates', true);
    try {
      const params = new URLSearchParams();
      if (filters?.category) params.append('category', filters.category);
      if (filters?.templateType) params.append('type', filters.templateType);
      if (filters?.isPublic !== undefined) params.append('public', filters.isPublic.toString());
      if (filters?.searchText) params.append('search', filters.searchText);

      const data = await apiCall<{ templates: ContentTemplate[] }>(`/api/social/templates?${params}`, {}, 'templates');
      setTemplates(data.templates);
    } finally {
      setLoadingState('templates', false);
    }
  }, [apiCall, setLoadingState]);

  const createTemplate = useCallback(async (template: Omit<ContentTemplate, 'id' | 'usageCount'>): Promise<ContentTemplate> => {
    const createdTemplate = await apiCall<ContentTemplate>('/api/social/templates', {
      method: 'POST',
      body: JSON.stringify(template),
    }, 'templates');
    
    setTemplates(prev => [...prev, createdTemplate]);
    return createdTemplate;
  }, [apiCall]);

  const updateTemplate = useCallback(async (templateId: string, updates: Partial<ContentTemplate>): Promise<ContentTemplate> => {
    const updatedTemplate = await apiCall<ContentTemplate>(`/api/social/templates/${templateId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }, 'templates');
    
    setTemplates(prev => prev.map(template => 
      template.id === templateId ? updatedTemplate : template
    ));
    
    return updatedTemplate;
  }, [apiCall]);

  const deleteTemplate = useCallback(async (templateId: string) => {
    await apiCall(`/api/social/templates/${templateId}`, {
      method: 'DELETE',
    }, 'templates');
    
    setTemplates(prev => prev.filter(template => template.id !== templateId));
  }, [apiCall]);

  const cloneTemplate = useCallback(async (templateId: string, customName?: string): Promise<ContentTemplate> => {
    const clonedTemplate = await apiCall<ContentTemplate>(`/api/social/templates/${templateId}/clone`, {
      method: 'POST',
      body: JSON.stringify({ customName }),
    }, 'templates');
    
    setTemplates(prev => [...prev, clonedTemplate]);
    return clonedTemplate;
  }, [apiCall]);

  // Media Management
  const loadMediaLibrary = useCallback(async (filters?: {
    mimeType?: string;
    tags?: string[];
    searchText?: string;
  }) => {
    setLoadingState('media', true);
    try {
      const params = new URLSearchParams();
      if (filters?.mimeType) params.append('type', filters.mimeType);
      if (filters?.searchText) params.append('search', filters.searchText);
      if (filters?.tags) filters.tags.forEach(tag => params.append('tags', tag));

      const data = await apiCall<{ files: MediaFile[] }>(`/api/social/media?${params}`, {}, 'media');
      setMediaLibrary(data.files);
    } finally {
      setLoadingState('media', false);
    }
  }, [apiCall, setLoadingState]);

  const uploadMedia = useCallback(async (files: File[], options?: {
    platforms?: string[];
    generateThumbnail?: boolean;
    optimizeForWeb?: boolean;
  }): Promise<MediaFile[]> => {
    const uploadedFiles: MediaFile[] = [];
    
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      if (options?.platforms) {
        formData.append('platforms', options.platforms.join(','));
      }
      if (options?.generateThumbnail) {
        formData.append('generateThumbnail', 'true');
      }
      if (options?.optimizeForWeb) {
        formData.append('optimizeForWeb', 'true');
      }

      try {
        const result = await fetch('/api/social/media/upload', {
          method: 'POST',
          body: formData,
        });

        if (!result.ok) {
          throw new Error(`Upload failed for ${file.name}`);
        }

        const data = await result.json();
        uploadedFiles.push(data.originalFile);
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
        throw error;
      }
    }
    
    setMediaLibrary(prev => [...prev, ...uploadedFiles]);
    return uploadedFiles;
  }, []);

  const deleteMedia = useCallback(async (mediaId: string) => {
    await apiCall(`/api/social/media/${mediaId}`, {
      method: 'DELETE',
    }, 'media');
    
    setMediaLibrary(prev => prev.filter(media => media.id !== mediaId));
  }, [apiCall]);

  // Analytics
  const loadAnalytics = useCallback(async (timeRange: { start: Date; end: Date }) => {
    setLoadingState('analytics', true);
    try {
      const params = new URLSearchParams({
        start: timeRange.start.toISOString(),
        end: timeRange.end.toISOString(),
      });

      const analyticsData = await apiCall<PostingAnalytics>(`/api/social/analytics?${params}`, {}, 'analytics');
      setAnalytics(analyticsData);
    } finally {
      setLoadingState('analytics', false);
    }
  }, [apiCall, setLoadingState]);

  const getOptimalTime = useCallback(async (accountId: string, targetDate?: Date): Promise<OptimalTimeRecommendation> => {
    const params = new URLSearchParams();
    if (targetDate) {
      params.append('date', targetDate.toISOString());
    }

    const recommendation = await apiCall<OptimalTimeRecommendation>(
      `/api/social/optimal-time/${accountId}?${params}`,
      {},
      'analytics'
    );

    return {
      ...recommendation,
      suggestedTime: new Date(recommendation.suggestedTime),
      alternativeTimes: recommendation.alternativeTimes.map(time => new Date(time)),
    };
  }, [apiCall]);

  // Refresh all data
  const refresh = useCallback(async () => {
    await Promise.all([
      loadSocialAccounts(),
      loadScheduledPosts(),
      loadTemplates(),
      loadMediaLibrary(),
    ]);
  }, [loadSocialAccounts, loadScheduledPosts, loadTemplates, loadMediaLibrary]);

  // Auto-refresh setup
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(() => {
        loadScheduledPosts();
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, loadScheduledPosts]);

  // Initial load
  useEffect(() => {
    if (userId) {
      refresh();
    }
  }, [userId, refresh]);

  return {
    // Data
    socialAccounts,
    scheduledPosts,
    templates,
    mediaLibrary,
    analytics,
    
    // Loading states
    loading,
    
    // Error states
    errors,
    
    // Actions
    actions: {
      // Account management
      loadSocialAccounts,
      connectAccount,
      disconnectAccount,
      
      // Content generation
      generateContent,
      
      // Scheduling
      schedulePost,
      scheduleMultiplePosts,
      
      // Post management
      loadScheduledPosts,
      cancelPost,
      reschedulePost,
      duplicatePost,
      
      // Templates
      loadTemplates,
      createTemplate,
      updateTemplate,
      deleteTemplate,
      cloneTemplate,
      
      // Media management
      loadMediaLibrary,
      uploadMedia,
      deleteMedia,
      
      // Analytics
      loadAnalytics,
      getOptimalTime,
      
      // Utility
      clearErrors,
      refresh,
    },
  };
}
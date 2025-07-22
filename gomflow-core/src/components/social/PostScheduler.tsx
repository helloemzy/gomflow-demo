'use client';

/**
 * Post Scheduler Component
 * Interface for scheduling social media posts with calendar and optimization
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Calendar, 
  Clock, 
  Target, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle, 
  X, 
  Play,
  Pause,
  Edit,
  Trash2,
  Copy,
  BarChart3
} from 'lucide-react';

interface ScheduledPost {
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

interface SocialAccount {
  id: string;
  platformId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  isActive: boolean;
}

interface OptimalTimeRecommendation {
  suggestedTime: Date;
  confidenceScore: number;
  reasoning: string;
  alternativeTimes: Date[];
  expectedEngagement: any;
}

interface PostSchedulerProps {
  userId: string;
  onPostScheduled?: (post: ScheduledPost) => void;
  onPostCancelled?: (postId: string) => void;
  initialDate?: Date;
}

export default function PostScheduler({
  userId,
  onPostScheduled,
  onPostCancelled,
  initialDate = new Date()
}: PostSchedulerProps) {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [optimalRecommendations, setOptimalRecommendations] = useState<Record<string, OptimalTimeRecommendation>>({});
  const [useOptimalTiming, setUseOptimalTiming] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<Date[]>([]);

  useEffect(() => {
    loadSocialAccounts();
    loadScheduledPosts();
    generateCalendarDays();
  }, [userId, currentMonth]);

  useEffect(() => {
    if (selectedAccounts.length > 0 && useOptimalTiming) {
      loadOptimalRecommendations();
    }
  }, [selectedAccounts, selectedDate, useOptimalTiming]);

  const loadSocialAccounts = async () => {
    try {
      const response = await fetch('/api/social/accounts');
      if (!response.ok) throw new Error('Failed to load social accounts');
      
      const accounts = await response.json();
      setSocialAccounts(accounts);
    } catch (error) {
      console.error('Failed to load social accounts:', error);
      setError('Failed to load social accounts');
    }
  };

  const loadScheduledPosts = async () => {
    try {
      setLoading(true);
      const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      
      const params = new URLSearchParams({
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      });

      const response = await fetch(`/api/social/scheduled?${params}`);
      if (!response.ok) throw new Error('Failed to load scheduled posts');
      
      const posts = await response.json();
      setScheduledPosts(posts.map((post: any) => ({
        ...post,
        scheduledFor: new Date(post.scheduledFor),
        optimalTime: post.optimalTime ? new Date(post.optimalTime) : undefined,
        postedAt: post.postedAt ? new Date(post.postedAt) : undefined,
      })));
    } catch (error) {
      console.error('Failed to load scheduled posts:', error);
      setError('Failed to load scheduled posts');
    } finally {
      setLoading(false);
    }
  };

  const loadOptimalRecommendations = async () => {
    try {
      const recommendations: Record<string, OptimalTimeRecommendation> = {};
      
      for (const accountId of selectedAccounts) {
        const response = await fetch(`/api/social/optimal-time/${accountId}?date=${selectedDate.toISOString()}`);
        if (response.ok) {
          const recommendation = await response.json();
          recommendations[accountId] = {
            ...recommendation,
            suggestedTime: new Date(recommendation.suggestedTime),
            alternativeTimes: recommendation.alternativeTimes.map((time: string) => new Date(time)),
          };
        }
      }
      
      setOptimalRecommendations(recommendations);
    } catch (error) {
      console.error('Failed to load optimal recommendations:', error);
    }
  };

  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days: Date[] = [];
    const current = new Date(startDate);
    
    for (let i = 0; i < 42; i++) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    setCalendarDays(days);
  };

  const getPostsForDate = (date: Date) => {
    return scheduledPosts.filter(post => 
      post.scheduledFor.toDateString() === date.toDateString()
    );
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    if (useOptimalTiming && selectedAccounts.length > 0) {
      loadOptimalRecommendations();
    }
  };

  const handleAccountToggle = (accountId: string) => {
    setSelectedAccounts(prev => 
      prev.includes(accountId) 
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const handleSchedulePost = async (postData: any) => {
    try {
      setLoading(true);
      
      const scheduleData = {
        ...postData,
        socialAccountIds: selectedAccounts,
        scheduledFor: useOptimalTiming && optimalRecommendations[selectedAccounts[0]] 
          ? optimalRecommendations[selectedAccounts[0]].suggestedTime
          : new Date(`${selectedDate.toDateString()} ${selectedTime}`),
        useOptimalTiming,
      };

      const response = await fetch('/api/social/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scheduleData),
      });

      if (!response.ok) throw new Error('Failed to schedule post');
      
      const scheduledPost = await response.json();
      
      setScheduledPosts(prev => [...prev, scheduledPost]);
      
      if (onPostScheduled) {
        onPostScheduled(scheduledPost);
      }
      
      await loadScheduledPosts(); // Refresh the list
    } catch (error) {
      console.error('Failed to schedule post:', error);
      setError('Failed to schedule post');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelPost = async (postId: string) => {
    try {
      const response = await fetch(`/api/social/scheduled/${postId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to cancel post');
      
      setScheduledPosts(prev => prev.filter(post => post.id !== postId));
      
      if (onPostCancelled) {
        onPostCancelled(postId);
      }
    } catch (error) {
      console.error('Failed to cancel post:', error);
      setError('Failed to cancel post');
    }
  };

  const handleReschedulePost = async (postId: string, newTime: Date) => {
    try {
      const response = await fetch(`/api/social/scheduled/${postId}/reschedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newTime: newTime.toISOString() }),
      });

      if (!response.ok) throw new Error('Failed to reschedule post');
      
      await loadScheduledPosts();
    } catch (error) {
      console.error('Failed to reschedule post:', error);
      setError('Failed to reschedule post');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'processing': return 'bg-yellow-100 text-yellow-800';
      case 'posted': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled': return <Clock className="w-4 h-4" />;
      case 'processing': return <Play className="w-4 h-4" />;
      case 'posted': return <CheckCircle className="w-4 h-4" />;
      case 'failed': return <AlertCircle className="w-4 h-4" />;
      case 'cancelled': return <X className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getBestOptimalTime = () => {
    if (Object.keys(optimalRecommendations).length === 0) return null;
    
    const recommendations = Object.values(optimalRecommendations);
    return recommendations.reduce((best, current) => 
      current.confidenceScore > best.confidenceScore ? current : best
    );
  };

  const renderCalendarView = () => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </CardTitle>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              >
                ←
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(new Date())}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              >
                →
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 mb-4">
            {dayNames.map(day => (
              <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
                {day}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => {
              const posts = getPostsForDate(day);
              const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
              const isToday = day.toDateString() === new Date().toDateString();
              const isSelected = day.toDateString() === selectedDate.toDateString();
              
              return (
                <div
                  key={index}
                  className={`
                    relative p-2 min-h-[80px] border cursor-pointer transition-colors
                    ${isCurrentMonth ? 'bg-white' : 'bg-gray-50 text-gray-400'}
                    ${isToday ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}
                    ${isSelected ? 'ring-2 ring-blue-500' : ''}
                    hover:bg-gray-50
                  `}
                  onClick={() => handleDateSelect(day)}
                >
                  <div className="text-sm font-medium">
                    {day.getDate()}
                  </div>
                  
                  {posts.length > 0 && (
                    <div className="mt-1 space-y-1">
                      {posts.slice(0, 2).map(post => {
                        const account = socialAccounts.find(acc => acc.id === post.socialAccountId);
                        return (
                          <div
                            key={post.id}
                            className={`
                              text-xs px-1 py-0.5 rounded truncate
                              ${getStatusColor(post.status)}
                            `}
                            title={`${account?.displayName} - ${formatTime(post.scheduledFor)}`}
                          >
                            {account?.platformId} {formatTime(post.scheduledFor)}
                          </div>
                        );
                      })}
                      {posts.length > 2 && (
                        <div className="text-xs text-gray-500">
                          +{posts.length - 2} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderListView = () => {
    const postsForDate = getPostsForDate(selectedDate);
    
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            Posts for {selectedDate.toLocaleDateString()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {postsForDate.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No posts scheduled for this date
            </div>
          ) : (
            <div className="space-y-4">
              {postsForDate.map(post => {
                const account = socialAccounts.find(acc => acc.id === post.socialAccountId);
                
                return (
                  <div key={post.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge className={getStatusColor(post.status)}>
                            {getStatusIcon(post.status)}
                            <span className="ml-1">{post.status}</span>
                          </Badge>
                          <span className="text-sm text-gray-500">
                            {account?.displayName} ({account?.platformId})
                          </span>
                        </div>
                        
                        <div className="text-sm mb-2">
                          <strong>Scheduled:</strong> {formatTime(post.scheduledFor)}
                        </div>
                        
                        {post.optimalTime && (
                          <div className="text-sm text-green-600 mb-2">
                            <Target className="w-4 h-4 inline mr-1" />
                            Optimal: {formatTime(post.optimalTime)}
                          </div>
                        )}
                        
                        <div className="text-sm text-gray-600 mb-2">
                          {post.contentData?.text?.substring(0, 100)}
                          {post.contentData?.text?.length > 100 && '...'}
                        </div>
                        
                        {post.engagementPrediction && (
                          <div className="text-sm text-gray-500 mb-2">
                            <TrendingUp className="w-4 h-4 inline mr-1" />
                            Expected: {post.engagementPrediction.likes} likes, {post.engagementPrediction.reach} reach
                          </div>
                        )}
                        
                        {post.errorMessage && (
                          <div className="text-sm text-red-600">
                            <AlertCircle className="w-4 h-4 inline mr-1" />
                            {post.errorMessage}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex space-x-2">
                        {post.status === 'scheduled' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {/* Open edit dialog */}}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancelPost(post.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        
                        {post.status === 'posted' && post.platformPostId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {/* View analytics */}}
                          >
                            <BarChart3 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderOptimalTimeRecommendations = () => {
    const bestRecommendation = getBestOptimalTime();
    
    if (!bestRecommendation) return null;

    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Target className="w-5 h-5 mr-2" />
            Optimal Timing Recommendation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">
                  Best time: {formatTime(bestRecommendation.suggestedTime)}
                </div>
                <div className="text-sm text-gray-600">
                  {bestRecommendation.reasoning}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Confidence</div>
                <div className="flex items-center space-x-2">
                  <Progress 
                    value={bestRecommendation.confidenceScore * 100} 
                    className="w-20" 
                  />
                  <span className="text-sm font-medium">
                    {Math.round(bestRecommendation.confidenceScore * 100)}%
                  </span>
                </div>
              </div>
            </div>
            
            {bestRecommendation.expectedEngagement && (
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Expected Likes</div>
                  <div className="font-medium">{bestRecommendation.expectedEngagement.likes}</div>
                </div>
                <div>
                  <div className="text-gray-500">Expected Shares</div>
                  <div className="font-medium">{bestRecommendation.expectedEngagement.shares}</div>
                </div>
                <div>
                  <div className="text-gray-500">Expected Comments</div>
                  <div className="font-medium">{bestRecommendation.expectedEngagement.comments}</div>
                </div>
                <div>
                  <div className="text-gray-500">Expected Reach</div>
                  <div className="font-medium">{bestRecommendation.expectedEngagement.reach}</div>
                </div>
              </div>
            )}
            
            {bestRecommendation.alternativeTimes.length > 0 && (
              <div>
                <div className="text-sm text-gray-500 mb-2">Alternative times:</div>
                <div className="flex space-x-2">
                  {bestRecommendation.alternativeTimes.slice(0, 3).map((time, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedTime(time.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }))}
                    >
                      {formatTime(time)}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (error) {
    return (
      <Card>
        <CardContent>
          <div className="text-center text-red-600 py-8">
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* View Toggle */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Post Scheduler</h2>
        <div className="flex space-x-2">
          <Button
            variant={viewMode === 'calendar' ? 'default' : 'outline'}
            onClick={() => setViewMode('calendar')}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Calendar
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            onClick={() => setViewMode('list')}
          >
            List
          </Button>
        </div>
      </div>

      {/* Social Account Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Social Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {socialAccounts.map(account => (
              <div
                key={account.id}
                className={`
                  p-3 border rounded-lg cursor-pointer transition-colors
                  ${selectedAccounts.includes(account.id) 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                  }
                `}
                onClick={() => handleAccountToggle(account.id)}
              >
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                    {account.avatarUrl ? (
                      <img 
                        src={account.avatarUrl} 
                        alt={account.displayName}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <span className="text-xs font-medium">
                        {account.platformId.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {account.displayName}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {account.platformId}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Optimal Time Recommendations */}
      {selectedAccounts.length > 0 && renderOptimalTimeRecommendations()}

      {/* Main Content */}
      {viewMode === 'calendar' ? renderCalendarView() : renderListView()}

      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <div>Processing...</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
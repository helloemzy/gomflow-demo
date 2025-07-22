'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Eye,
  Edit3,
  Share2,
  Copy,
  Download,
  Heart,
  MessageCircle,
  Share,
  Bookmark,
  BarChart3,
  TrendingUp,
  Globe,
  Smartphone,
  Monitor,
  Tablet,
  Image as ImageIcon,
  Hash,
  Clock,
  Target,
  Zap,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Lightbulb,
  RefreshCw,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface ContentPreviewProps {
  content: {
    id: string;
    textContent: string;
    hashtags: string[];
    imageUrl?: string;
    platform: string;
    qualityScore: number;
    engagementPrediction: number;
    sentimentScore: number;
    culturalRelevanceScore: number;
    suggestions: string[];
  };
  onEdit?: (editedContent: any) => void;
  onPublish?: (publishData: any) => void;
  onCreateABTest?: (testData: any) => void;
}

interface DevicePreview {
  id: string;
  name: string;
  icon: React.ReactNode;
  width: string;
  height: string;
  className: string;
}

const devices: DevicePreview[] = [
  {
    id: 'mobile',
    name: 'Mobile',
    icon: <Smartphone className="h-4 w-4" />,
    width: '375px',
    height: '667px',
    className: 'border-2 border-gray-300 rounded-3xl',
  },
  {
    id: 'tablet',
    name: 'Tablet',
    icon: <Tablet className="h-4 w-4" />,
    width: '768px',
    height: '1024px',
    className: 'border-2 border-gray-300 rounded-2xl',
  },
  {
    id: 'desktop',
    name: 'Desktop',
    icon: <Monitor className="h-4 w-4" />,
    width: '1200px',
    height: '800px',
    className: 'border border-gray-300 rounded-lg',
  },
];

export function ContentPreview({ content, onEdit, onPublish, onCreateABTest }: ContentPreviewProps) {
  const [activeDevice, setActiveDevice] = useState('mobile');
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState({
    textContent: content.textContent,
    hashtags: content.hashtags,
  });
  const [showMetrics, setShowMetrics] = useState(true);

  // Platform configurations for preview
  const platformConfig = {
    twitter: {
      name: 'Twitter',
      color: 'bg-blue-500',
      avatar: '🐦',
      username: '@gomflow_official',
      verified: true,
      maxLength: 280,
    },
    instagram: {
      name: 'Instagram',
      color: 'bg-pink-500',
      avatar: '📷',
      username: 'gomflow.official',
      verified: true,
      maxLength: 2200,
    },
    tiktok: {
      name: 'TikTok',
      color: 'bg-black',
      avatar: '🎵',
      username: '@gomflow',
      verified: true,
      maxLength: 150,
    },
    facebook: {
      name: 'Facebook',
      color: 'bg-blue-600',
      avatar: '📘',
      username: 'GOMFLOW',
      verified: true,
      maxLength: 63206,
    },
    telegram: {
      name: 'Telegram',
      color: 'bg-blue-400',
      avatar: '✈️',
      username: '@gomflow_channel',
      verified: false,
      maxLength: 4096,
    },
  };

  const currentPlatform = platformConfig[content.platform as keyof typeof platformConfig];

  const handleEdit = () => {
    if (isEditing) {
      // Save changes
      onEdit?.(editedContent);
      setIsEditing(false);
    } else {
      setIsEditing(true);
    }
  };

  const handleCopy = async () => {
    const textToCopy = `${content.textContent}\n\n${content.hashtags.join(' ')}`;
    await navigator.clipboard.writeText(textToCopy);
  };

  const getQualityColor = (score: number) => {
    if (score >= 8) return 'text-green-500';
    if (score >= 6) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getSentimentLabel = (score: number) => {
    if (score > 0.3) return { label: 'Positive', color: 'text-green-500', icon: '😊' };
    if (score < -0.3) return { label: 'Negative', color: 'text-red-500', icon: '😟' };
    return { label: 'Neutral', color: 'text-gray-500', icon: '😐' };
  };

  const sentiment = getSentimentLabel(content.sentimentScore);

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${currentPlatform.color}`}></div>
          <h3 className="text-lg font-semibold">{currentPlatform.name} Preview</h3>
          {currentPlatform.verified && (
            <Badge variant="secondary" className="text-xs">
              <CheckCircle className="h-3 w-3 mr-1" />
              Verified
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Device Selector */}
          <div className="flex items-center border rounded-lg p-1">
            {devices.map((device) => (
              <Button
                key={device.id}
                variant={activeDevice === device.id ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveDevice(device.id)}
                className="h-8 px-2"
              >
                {device.icon}
                <span className="ml-1 hidden sm:inline">{device.name}</span>
              </Button>
            ))}
          </div>

          {/* Action Buttons */}
          <Button variant="outline" size="sm" onClick={handleEdit}>
            <Edit3 className="h-4 w-4 mr-1" />
            {isEditing ? 'Save' : 'Edit'}
          </Button>
          
          <Button variant="outline" size="sm" onClick={handleCopy}>
            <Copy className="h-4 w-4 mr-1" />
            Copy
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Preview Area */}
        <div className="xl:col-span-2">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="bg-gray-50 p-4 border-b">
                <div className="flex items-center justify-center">
                  <div 
                    className={`relative ${devices.find(d => d.id === activeDevice)?.className} bg-white overflow-hidden`}
                    style={{
                      width: activeDevice === 'mobile' ? '320px' : 
                             activeDevice === 'tablet' ? '500px' : '600px',
                      maxWidth: '100%',
                    }}
                  >
                    {/* Platform-specific preview */}
                    {content.platform === 'twitter' && (
                      <TwitterPreview
                        content={isEditing ? editedContent : content}
                        platform={currentPlatform}
                        isEditing={isEditing}
                        onContentChange={setEditedContent}
                      />
                    )}
                    
                    {content.platform === 'instagram' && (
                      <InstagramPreview
                        content={isEditing ? editedContent : content}
                        platform={currentPlatform}
                        isEditing={isEditing}
                        onContentChange={setEditedContent}
                      />
                    )}
                    
                    {content.platform === 'tiktok' && (
                      <TikTokPreview
                        content={isEditing ? editedContent : content}
                        platform={currentPlatform}
                        isEditing={isEditing}
                        onContentChange={setEditedContent}
                      />
                    )}
                    
                    {content.platform === 'facebook' && (
                      <FacebookPreview
                        content={isEditing ? editedContent : content}
                        platform={currentPlatform}
                        isEditing={isEditing}
                        onContentChange={setEditedContent}
                      />
                    )}
                    
                    {content.platform === 'telegram' && (
                      <TelegramPreview
                        content={isEditing ? editedContent : content}
                        platform={currentPlatform}
                        isEditing={isEditing}
                        onContentChange={setEditedContent}
                      />
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Metrics & Actions Sidebar */}
        <div className="space-y-6">
          {/* Quality Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <BarChart3 className="h-4 w-4" />
                Content Quality
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Overall Score</span>
                  <span className={`font-semibold ${getQualityColor(content.qualityScore)}`}>
                    {content.qualityScore.toFixed(1)}/10
                  </span>
                </div>
                <Progress value={content.qualityScore * 10} className="h-2" />

                <div className="flex justify-between items-center">
                  <span className="text-sm">Engagement Prediction</span>
                  <span className="font-semibold text-blue-500">
                    {content.engagementPrediction.toFixed(1)}%
                  </span>
                </div>
                <Progress value={content.engagementPrediction} className="h-2" />

                <div className="flex justify-between items-center">
                  <span className="text-sm">Cultural Relevance</span>
                  <span className="font-semibold text-purple-500">
                    {content.culturalRelevanceScore.toFixed(1)}/10
                  </span>
                </div>
                <Progress value={content.culturalRelevanceScore * 10} className="h-2" />

                <div className="flex justify-between items-center">
                  <span className="text-sm">Sentiment</span>
                  <div className="flex items-center gap-1">
                    <span>{sentiment.icon}</span>
                    <span className={`font-semibold ${sentiment.color}`}>
                      {sentiment.label}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Suggestions */}
          {content.suggestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Lightbulb className="h-4 w-4" />
                  AI Suggestions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {content.suggestions.map((suggestion, index) => (
                    <div key={index} className="flex items-start gap-2 text-sm">
                      <div className="w-1 h-1 rounded-full bg-blue-500 mt-2 flex-shrink-0"></div>
                      <span>{suggestion}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Content Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Target className="h-4 w-4" />
                Content Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Character Count</span>
                <span className="font-semibold">
                  {content.textContent.length}/{currentPlatform.maxLength}
                </span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span>Hashtags</span>
                <span className="font-semibold">{content.hashtags.length}</span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span>Has Image</span>
                <span className="font-semibold">
                  {content.imageUrl ? 'Yes' : 'No'}
                </span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span>Platform</span>
                <Badge variant="outline" className="text-xs">
                  {currentPlatform.name}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Zap className="h-4 w-4" />
                Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                onClick={() => onPublish?.(content)} 
                className="w-full"
                disabled={content.qualityScore < 6}
              >
                <Share2 className="h-4 w-4 mr-2" />
                Publish Now
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => onCreateABTest?.(content)}
                className="w-full"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Create A/B Test
              </Button>
              
              <Button variant="outline" className="w-full">
                <Clock className="h-4 w-4 mr-2" />
                Schedule Post
              </Button>
              
              <Button variant="outline" className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </CardContent>
          </Card>

          {/* Quality Warnings */}
          {content.qualityScore < 6 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Quality score is below recommended threshold (6.0). Consider improving content before publishing.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}

// Platform-specific preview components
function TwitterPreview({ content, platform, isEditing, onContentChange }: any) {
  return (
    <div className="p-4 min-h-[200px]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <Avatar className="w-10 h-10">
          <AvatarFallback>{platform.avatar}</AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-1">
            <span className="font-bold text-sm">GOMFLOW</span>
            {platform.verified && <CheckCircle className="h-4 w-4 text-blue-500" />}
          </div>
          <span className="text-gray-500 text-sm">{platform.username}</span>
        </div>
        <span className="text-gray-500 text-sm ml-auto">2m</span>
      </div>

      {/* Content */}
      <div className="space-y-3">
        {isEditing ? (
          <Textarea
            value={content.textContent}
            onChange={(e) => onContentChange({ ...content, textContent: e.target.value })}
            className="min-h-[80px] text-sm"
          />
        ) : (
          <p className="text-sm leading-relaxed">{content.textContent}</p>
        )}

        {content.imageUrl && (
          <div className="rounded-lg overflow-hidden border">
            <img src={content.imageUrl} alt="Content" className="w-full h-48 object-cover" />
          </div>
        )}

        {content.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {content.hashtags.map((tag, index) => (
              <span key={index} className="text-blue-500 text-sm">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center mt-4 pt-3 border-t">
        <div className="flex items-center gap-6">
          <button className="flex items-center gap-1 text-gray-500 hover:text-red-500">
            <Heart className="h-4 w-4" />
            <span className="text-xs">127</span>
          </button>
          <button className="flex items-center gap-1 text-gray-500 hover:text-blue-500">
            <MessageCircle className="h-4 w-4" />
            <span className="text-xs">23</span>
          </button>
          <button className="flex items-center gap-1 text-gray-500 hover:text-green-500">
            <RefreshCw className="h-4 w-4" />
            <span className="text-xs">45</span>
          </button>
          <button className="flex items-center gap-1 text-gray-500 hover:text-blue-500">
            <Share className="h-4 w-4" />
          </button>
        </div>
        <button className="text-gray-500 hover:text-blue-500">
          <Bookmark className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function InstagramPreview({ content, platform, isEditing, onContentChange }: any) {
  return (
    <div className="min-h-[400px]">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b">
        <Avatar className="w-8 h-8">
          <AvatarFallback>{platform.avatar}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-1">
            <span className="font-semibold text-sm">{platform.username}</span>
            {platform.verified && <CheckCircle className="h-4 w-4 text-blue-500" />}
          </div>
        </div>
        <Button variant="ghost" size="sm" className="text-xs">
          Follow
        </Button>
      </div>

      {/* Image */}
      {content.imageUrl && (
        <div className="aspect-square bg-gray-100">
          <img src={content.imageUrl} alt="Content" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Actions */}
      <div className="p-4 space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Heart className="h-6 w-6" />
            <MessageCircle className="h-6 w-6" />
            <Share className="h-6 w-6" />
          </div>
          <Bookmark className="h-6 w-6" />
        </div>

        <div className="text-sm">
          <span className="font-semibold">2,847 likes</span>
        </div>

        {/* Caption */}
        <div className="space-y-1">
          {isEditing ? (
            <Textarea
              value={content.textContent}
              onChange={(e) => onContentChange({ ...content, textContent: e.target.value })}
              className="min-h-[60px] text-sm"
            />
          ) : (
            <p className="text-sm">
              <span className="font-semibold">{platform.username}</span> {content.textContent}
            </p>
          )}

          {content.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {content.hashtags.map((tag, index) => (
                <span key={index} className="text-blue-500 text-sm">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="text-xs text-gray-500">2 MINUTES AGO</div>
      </div>
    </div>
  );
}

function TikTokPreview({ content, platform, isEditing, onContentChange }: any) {
  return (
    <div className="bg-black text-white min-h-[500px] relative">
      {/* Video Area */}
      <div className="aspect-[9/16] bg-gray-800 flex items-center justify-center">
        {content.imageUrl ? (
          <img src={content.imageUrl} alt="Content" className="w-full h-full object-cover" />
        ) : (
          <div className="text-center">
            <ImageIcon className="h-12 w-12 mx-auto mb-2 text-gray-400" />
            <p className="text-gray-400">Video Preview</p>
          </div>
        )}
      </div>

      {/* Overlay Content */}
      <div className="absolute bottom-4 left-4 right-16">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-gray-700">{platform.avatar}</AvatarFallback>
            </Avatar>
            <span className="font-semibold text-sm">{platform.username}</span>
            <Button variant="outline" size="sm" className="text-xs h-6 px-2">
              Follow
            </Button>
          </div>

          {isEditing ? (
            <Textarea
              value={content.textContent}
              onChange={(e) => onContentChange({ ...content, textContent: e.target.value })}
              className="bg-black/50 text-white border-gray-600 text-sm"
            />
          ) : (
            <p className="text-sm">{content.textContent}</p>
          )}

          {content.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {content.hashtags.map((tag, index) => (
                <span key={index} className="text-yellow-400 text-sm">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Side Actions */}
      <div className="absolute right-4 bottom-20 space-y-4">
        <div className="text-center">
          <Heart className="h-8 w-8 mx-auto mb-1" />
          <span className="text-xs">1.2K</span>
        </div>
        <div className="text-center">
          <MessageCircle className="h-8 w-8 mx-auto mb-1" />
          <span className="text-xs">89</span>
        </div>
        <div className="text-center">
          <Share className="h-8 w-8 mx-auto mb-1" />
          <span className="text-xs">156</span>
        </div>
      </div>
    </div>
  );
}

function FacebookPreview({ content, platform, isEditing, onContentChange }: any) {
  return (
    <div className="p-4 min-h-[300px]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <Avatar className="w-10 h-10">
          <AvatarFallback>{platform.avatar}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-1">
            <span className="font-semibold text-sm">{platform.name}</span>
            {platform.verified && <CheckCircle className="h-4 w-4 text-blue-500" />}
          </div>
          <div className="text-xs text-gray-500">2 minutes ago • 🌍</div>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-3">
        {isEditing ? (
          <Textarea
            value={content.textContent}
            onChange={(e) => onContentChange({ ...content, textContent: e.target.value })}
            className="min-h-[80px] text-sm"
          />
        ) : (
          <p className="text-sm leading-relaxed">{content.textContent}</p>
        )}

        {content.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {content.hashtags.map((tag, index) => (
              <span key={index} className="text-blue-500 text-sm">
                {tag}
              </span>
            ))}
          </div>
        )}

        {content.imageUrl && (
          <div className="rounded-lg overflow-hidden border">
            <img src={content.imageUrl} alt="Content" className="w-full h-48 object-cover" />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center mt-4 pt-3 border-t">
        <div className="flex items-center gap-6">
          <button className="flex items-center gap-1 text-gray-500 hover:text-blue-500">
            <Heart className="h-4 w-4" />
            <span className="text-xs">Like</span>
          </button>
          <button className="flex items-center gap-1 text-gray-500 hover:text-blue-500">
            <MessageCircle className="h-4 w-4" />
            <span className="text-xs">Comment</span>
          </button>
          <button className="flex items-center gap-1 text-gray-500 hover:text-blue-500">
            <Share className="h-4 w-4" />
            <span className="text-xs">Share</span>
          </button>
        </div>
      </div>

      <div className="text-xs text-gray-500 mt-2">
        <span className="font-semibold">324 reactions</span> • <span className="font-semibold">28 comments</span> • <span className="font-semibold">15 shares</span>
      </div>
    </div>
  );
}

function TelegramPreview({ content, platform, isEditing, onContentChange }: any) {
  return (
    <div className="bg-blue-50 min-h-[300px] p-4">
      <div className="bg-white rounded-lg p-4 shadow-sm">
        {/* Channel Header */}
        <div className="flex items-center gap-3 mb-3 pb-3 border-b">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-blue-500 text-white">{platform.avatar}</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-semibold text-sm">{platform.username}</div>
            <div className="text-xs text-gray-500">2:34 PM</div>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-3">
          {isEditing ? (
            <Textarea
              value={content.textContent}
              onChange={(e) => onContentChange({ ...content, textContent: e.target.value })}
              className="min-h-[80px] text-sm"
            />
          ) : (
            <p className="text-sm leading-relaxed">{content.textContent}</p>
          )}

          {content.imageUrl && (
            <div className="rounded-lg overflow-hidden">
              <img src={content.imageUrl} alt="Content" className="w-full h-48 object-cover" />
            </div>
          )}

          {content.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {content.hashtags.map((tag, index) => (
                <span key={index} className="text-blue-500 text-sm">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t text-xs text-gray-500">
          <span>👁 1.2K views</span>
          <span>💬 45 comments</span>
          <span>📤 78 shares</span>
        </div>
      </div>
    </div>
  );
}
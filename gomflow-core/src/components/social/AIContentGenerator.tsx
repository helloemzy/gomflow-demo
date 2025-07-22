'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Wand2, 
  Image, 
  Hash, 
  Globe, 
  Target, 
  Sparkles, 
  Clock, 
  TrendingUp,
  Copy,
  Download,
  Share2,
  Eye,
  BarChart3,
  Lightbulb,
  Zap,
  Heart,
  MessageCircle,
  Share,
  Bookmark,
  ExternalLink,
} from 'lucide-react';
import { useAIContent } from '@/hooks/useAIContent';
import { ContentPreview } from './ContentPreview';
import { LANGUAGE_PROFILES } from '@/lib/social/ai/localization';

interface AIContentGeneratorProps {
  orderId?: string;
  onContentGenerated?: (content: any) => void;
  initialPlatform?: string;
  initialLanguage?: string;
}

interface GenerationForm {
  promptId?: string;
  customPrompt?: string;
  platform: string;
  contentType: string;
  language: string;
  variables: Record<string, string>;
  tone: string;
  includeHashtags: boolean;
  includeImage: boolean;
  imageStyle?: string;
  maxLength?: number;
}

export function AIContentGenerator({
  orderId,
  onContentGenerated,
  initialPlatform = 'twitter',
  initialLanguage = 'en',
}: AIContentGeneratorProps) {
  const [form, setForm] = useState<GenerationForm>({
    platform: initialPlatform,
    contentType: 'text',
    language: initialLanguage,
    variables: {},
    tone: 'excited',
    includeHashtags: true,
    includeImage: false,
  });

  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState('generate');

  const {
    generateContent,
    generateImage,
    getPrompts,
    getUserAnalytics,
    getTrendingContent,
    isLoading,
    error,
    generatedContent,
    availablePrompts,
    userAnalytics,
    trendingContent,
  } = useAIContent();

  // Load initial data
  useEffect(() => {
    getPrompts(form.platform, form.language);
    getUserAnalytics();
    getTrendingContent(form.platform, form.language);
  }, [form.platform, form.language]);

  // Platform configurations
  const platformConfig = {
    twitter: { maxLength: 280, icon: '🐦', color: 'bg-blue-500' },
    instagram: { maxLength: 2200, icon: '📷', color: 'bg-pink-500' },
    tiktok: { maxLength: 150, icon: '🎵', color: 'bg-black' },
    facebook: { maxLength: 63206, icon: '📘', color: 'bg-blue-600' },
    telegram: { maxLength: 4096, icon: '✈️', color: 'bg-blue-400' },
  };

  const handleFormChange = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleVariableChange = (key: string, value: string) => {
    setForm(prev => ({
      ...prev,
      variables: { ...prev.variables, [key]: value },
    }));
  };

  const handleGenerate = async () => {
    try {
      const content = await generateContent({
        promptId: form.promptId,
        customPrompt: form.customPrompt,
        platform: form.platform as any,
        contentType: form.contentType as any,
        language: form.language as any,
        variables: form.variables,
        orderId,
        tone: form.tone as any,
        includeHashtags: form.includeHashtags,
        maxLength: form.maxLength,
      });

      // Generate image if requested
      if (form.includeImage && content.id) {
        await generateImage({
          contentId: content.id,
          imagePrompt: `Create an engaging image for: ${content.textContent}`,
          style: form.imageStyle as any,
          platform: form.platform as any,
          culturalStyle: form.language === 'ko' ? 'korean' : 'mixed',
        });
      }

      setShowPreview(true);
      setActiveTab('preview');
      onContentGenerated?.(content);
    } catch (err) {
      console.error('Generation failed:', err);
    }
  };

  const selectedPrompt = availablePrompts.find(p => p.id === form.promptId);
  const requiredVariables = selectedPrompt?.variables || [];

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Wand2 className="h-6 w-6 text-purple-500" />
            AI Content Generator
          </h2>
          <p className="text-muted-foreground">
            Create engaging K-pop social media content with AI
          </p>
        </div>
        
        {userAnalytics && (
          <div className="flex gap-4 text-sm">
            <div className="text-center">
              <div className="font-semibold">{userAnalytics.totalGenerated}</div>
              <div className="text-muted-foreground">Generated</div>
            </div>
            <div className="text-center">
              <div className="font-semibold">{userAnalytics.avgQualityScore?.toFixed(1)}/10</div>
              <div className="text-muted-foreground">Avg Quality</div>
            </div>
            <div className="text-center">
              <div className="font-semibold">{(userAnalytics.successRate * 100)?.toFixed(0)}%</div>
              <div className="text-muted-foreground">Success Rate</div>
            </div>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="generate" className="flex items-center gap-2">
            <Wand2 className="h-4 w-4" />
            Generate
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-2" disabled={!generatedContent}>
            <Eye className="h-4 w-4" />
            Preview
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="trending" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Trending
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Generation Form */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Content Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Platform & Language */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="platform">Platform</Label>
                      <Select value={form.platform} onValueChange={(value) => handleFormChange('platform', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(platformConfig).map(([key, config]) => (
                            <SelectItem key={key} value={key}>
                              <div className="flex items-center gap-2">
                                <span>{config.icon}</span>
                                <span className="capitalize">{key}</span>
                                <Badge variant="secondary" className="text-xs">
                                  {config.maxLength} chars
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="language">Language</Label>
                      <Select value={form.language} onValueChange={(value) => handleFormChange('language', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(LANGUAGE_PROFILES).map((lang) => (
                            <SelectItem key={lang.code} value={lang.code}>
                              <div className="flex items-center gap-2">
                                <Globe className="h-4 w-4" />
                                <span>{lang.nativeName}</span>
                                <span className="text-muted-foreground">({lang.name})</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Content Type & Tone */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="contentType">Content Type</Label>
                      <Select value={form.contentType} onValueChange={(value) => handleFormChange('contentType', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text Only</SelectItem>
                          <SelectItem value="image">Image + Text</SelectItem>
                          <SelectItem value="carousel">Carousel</SelectItem>
                          <SelectItem value="video">Video</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="tone">Tone</Label>
                      <Select value={form.tone} onValueChange={(value) => handleFormChange('tone', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="excited">🎉 Excited</SelectItem>
                          <SelectItem value="professional">👔 Professional</SelectItem>
                          <SelectItem value="casual">😊 Casual</SelectItem>
                          <SelectItem value="urgency">⚡ Urgency</SelectItem>
                          <SelectItem value="community">🤝 Community</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Options */}
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="includeHashtags"
                        checked={form.includeHashtags}
                        onCheckedChange={(checked) => handleFormChange('includeHashtags', checked)}
                      />
                      <Label htmlFor="includeHashtags" className="flex items-center gap-2">
                        <Hash className="h-4 w-4" />
                        Include hashtags
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="includeImage"
                        checked={form.includeImage}
                        onCheckedChange={(checked) => handleFormChange('includeImage', checked)}
                      />
                      <Label htmlFor="includeImage" className="flex items-center gap-2">
                        <Image className="h-4 w-4" />
                        Generate AI image
                      </Label>
                    </div>

                    {form.includeImage && (
                      <div className="ml-6">
                        <Label htmlFor="imageStyle">Image Style</Label>
                        <Select value={form.imageStyle} onValueChange={(value) => handleFormChange('imageStyle', value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select style" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="photorealistic">📸 Photorealistic</SelectItem>
                            <SelectItem value="anime">🎌 Anime</SelectItem>
                            <SelectItem value="minimalist">⚪ Minimalist</SelectItem>
                            <SelectItem value="colorful">🌈 Colorful</SelectItem>
                            <SelectItem value="dark">🌙 Dark</SelectItem>
                            <SelectItem value="bright">☀️ Bright</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Content Creation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Template Selection */}
                  <div>
                    <Label htmlFor="prompt">Template (Optional)</Label>
                    <Select value={form.promptId || ''} onValueChange={(value) => handleFormChange('promptId', value || undefined)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a template or create custom content" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Custom Content</SelectItem>
                        {availablePrompts.map((prompt) => (
                          <SelectItem key={prompt.id} value={prompt.id}>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {prompt.category}
                              </Badge>
                              <span>{prompt.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedPrompt && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedPrompt.description}
                      </p>
                    )}
                  </div>

                  {/* Template Variables */}
                  {requiredVariables.length > 0 && (
                    <div className="space-y-3">
                      <Label>Template Variables</Label>
                      <div className="grid grid-cols-1 gap-3">
                        {requiredVariables.map((variable) => (
                          <div key={variable}>
                            <Label htmlFor={variable} className="capitalize">
                              {variable.replace('_', ' ')}
                            </Label>
                            <Input
                              id={variable}
                              value={form.variables[variable] || ''}
                              onChange={(e) => handleVariableChange(variable, e.target.value)}
                              placeholder={`Enter ${variable.replace('_', ' ')}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Custom Prompt */}
                  {!form.promptId && (
                    <div>
                      <Label htmlFor="customPrompt">Custom Prompt</Label>
                      <Textarea
                        id="customPrompt"
                        value={form.customPrompt || ''}
                        onChange={(e) => handleFormChange('customPrompt', e.target.value)}
                        placeholder="Describe the content you want to generate..."
                        rows={3}
                      />
                    </div>
                  )}

                  {/* Max Length */}
                  <div>
                    <Label htmlFor="maxLength">
                      Character Limit (Max: {platformConfig[form.platform as keyof typeof platformConfig]?.maxLength})
                    </Label>
                    <Input
                      id="maxLength"
                      type="number"
                      value={form.maxLength || ''}
                      onChange={(e) => handleFormChange('maxLength', parseInt(e.target.value) || undefined)}
                      max={platformConfig[form.platform as keyof typeof platformConfig]?.maxLength}
                      placeholder="Auto"
                    />
                  </div>

                  {/* Generate Button */}
                  <Button
                    onClick={handleGenerate}
                    disabled={isLoading || (!form.promptId && !form.customPrompt)}
                    className="w-full"
                    size="lg"
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Generating...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        Generate Content
                      </div>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Quick Tips */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Lightbulb className="h-4 w-4" />
                    Quick Tips
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <div className="w-1 h-1 rounded-full bg-blue-500 mt-2 flex-shrink-0"></div>
                    <span>Use specific K-pop terms for better engagement</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1 h-1 rounded-full bg-green-500 mt-2 flex-shrink-0"></div>
                    <span>Include deadlines to create urgency</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1 h-1 rounded-full bg-purple-500 mt-2 flex-shrink-0"></div>
                    <span>Add emojis for visual appeal</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1 h-1 rounded-full bg-orange-500 mt-2 flex-shrink-0"></div>
                    <span>Mention group order benefits</span>
                  </div>
                </CardContent>
              </Card>

              {/* Platform Stats */}
              {userAnalytics && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <BarChart3 className="h-4 w-4" />
                      Your Stats
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>Content Generated</span>
                      <span className="font-semibold">{userAnalytics.totalGenerated}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Average Quality</span>
                      <div className="flex items-center gap-1">
                        <span className="font-semibold">{userAnalytics.avgQualityScore?.toFixed(1)}</span>
                        <span className="text-xs text-muted-foreground">/10</span>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Total Cost</span>
                      <span className="font-semibold">${userAnalytics.totalCostUsd?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Most Used</span>
                      <Badge variant="secondary" className="text-xs">
                        {userAnalytics.mostUsedPlatform}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recent Templates */}
              {availablePrompts.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4" />
                      Popular Templates
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {availablePrompts.slice(0, 3).map((prompt) => (
                      <div
                        key={prompt.id}
                        className="p-2 rounded-lg border cursor-pointer hover:bg-muted"
                        onClick={() => handleFormChange('promptId', prompt.id)}
                      >
                        <div className="font-medium text-sm">{prompt.name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Badge variant="outline" className="text-xs">
                            {prompt.category}
                          </Badge>
                          <span className="capitalize">{prompt.platform}</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="preview">
          {generatedContent && (
            <ContentPreview 
              content={generatedContent}
              onEdit={(editedContent) => {
                // Handle content editing
                console.log('Content edited:', editedContent);
              }}
              onPublish={(publishData) => {
                // Handle publishing
                console.log('Publishing:', publishData);
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {userAnalytics && (
              <>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Generated</p>
                        <p className="text-2xl font-bold">{userAnalytics.totalGenerated}</p>
                      </div>
                      <Wand2 className="h-8 w-8 text-purple-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Avg Quality</p>
                        <p className="text-2xl font-bold">{userAnalytics.avgQualityScore?.toFixed(1)}/10</p>
                      </div>
                      <BarChart3 className="h-8 w-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                        <p className="text-2xl font-bold">{(userAnalytics.successRate * 100)?.toFixed(0)}%</p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Total Cost</p>
                        <p className="text-2xl font-bold">${userAnalytics.totalCostUsd?.toFixed(2)}</p>
                      </div>
                      <Target className="h-8 w-8 text-orange-500" />
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="trending">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Trending Content
                </CardTitle>
              </CardHeader>
              <CardContent>
                {trendingContent ? (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Trending Topics</h4>
                      <div className="flex flex-wrap gap-2">
                        {trendingContent.trendingTopics.map((topic, index) => (
                          <Badge key={index} variant="outline">
                            {topic}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h4 className="font-medium mb-2">Hot Hashtags</h4>
                      <div className="flex flex-wrap gap-2">
                        {trendingContent.trendingHashtags.map((hashtag, index) => (
                          <Badge key={index} className="bg-blue-500 text-white">
                            {hashtag}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h4 className="font-medium mb-2">Optimal Timing</h4>
                      <div className="space-y-2">
                        {trendingContent.recommendedTiming.map((tip, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span>{tip}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Loading trending data...</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
'use client';

/**
 * Content Creator Component
 * Complete interface for creating and scheduling social media content
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import TemplateManager from './TemplateManager';
import PostScheduler from './PostScheduler';
import { 
  FileText,
  Image,
  Video,
  Calendar,
  Send,
  Eye,
  Hash,
  AtSign,
  Upload,
  X,
  AlertCircle,
  CheckCircle,
  Wand2,
  Target,
  TrendingUp,
  Copy,
  Shuffle
} from 'lucide-react';

interface ContentTemplate {
  id: string;
  name: string;
  contentTemplate: string;
  variables: Record<string, any>;
  hashtags: string[];
  defaultMentions: string[];
  category: string;
  templateType: string;
}

interface MediaFile {
  id: string;
  fileName: string;
  fileUrl: string;
  thumbnailUrl?: string;
  mimeType: string;
  altText?: string;
}

interface SocialAccount {
  id: string;
  platformId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  isActive: boolean;
}

interface GeneratedContent {
  text: string;
  hashtags: string[];
  mentions: string[];
  characterCount: number;
  platformSpecific: Record<string, any>;
  estimatedEngagement?: {
    likes: number;
    shares: number;
    comments: number;
    reach: number;
  };
}

interface ContentCreatorProps {
  userId: string;
  initialTemplate?: ContentTemplate;
  onContentCreated?: (content: any) => void;
}

export default function ContentCreator({
  userId,
  initialTemplate,
  onContentCreated
}: ContentCreatorProps) {
  // Main state
  const [currentStep, setCurrentStep] = useState<'template' | 'content' | 'media' | 'schedule'>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<ContentTemplate | null>(initialTemplate || null);
  const [customContent, setCustomContent] = useState('');
  const [useTemplate, setUseTemplate] = useState(true);
  
  // Content generation
  const [templateVariables, setTemplateVariables] = useState<Record<string, any>>({});
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['twitter']);
  const [additionalHashtags, setAdditionalHashtags] = useState<string[]>([]);
  const [additionalMentions, setAdditionalMentions] = useState<string[]>([]);
  
  // Media management
  const [selectedMedia, setSelectedMedia] = useState<MediaFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [mediaLibrary, setMediaLibrary] = useState<MediaFile[]>([]);
  
  // Scheduling
  const [schedulingOptions, setSchedulingOptions] = useState({
    scheduleNow: false,
    scheduledFor: new Date(),
    useOptimalTiming: true,
    crossPost: true,
  });
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [hashtagInput, setHashtagInput] = useState('');
  const [mentionInput, setMentionInput] = useState('');

  const steps = [
    { key: 'template', label: 'Template', icon: FileText },
    { key: 'content', label: 'Content', icon: Wand2 },
    { key: 'media', label: 'Media', icon: Image },
    { key: 'schedule', label: 'Schedule', icon: Calendar },
  ];

  useEffect(() => {
    loadSocialAccounts();
    loadMediaLibrary();
  }, [userId]);

  useEffect(() => {
    if (selectedTemplate) {
      // Initialize template variables with default values
      const defaultVariables: Record<string, any> = {};
      Object.entries(selectedTemplate.variables).forEach(([key, variable]) => {
        defaultVariables[key] = variable.defaultValue || '';
      });
      setTemplateVariables(defaultVariables);
    }
  }, [selectedTemplate]);

  useEffect(() => {
    if ((selectedTemplate || customContent) && selectedPlatforms.length > 0) {
      generateContent();
    }
  }, [selectedTemplate, customContent, templateVariables, selectedPlatforms, additionalHashtags, additionalMentions]);

  const loadSocialAccounts = async () => {
    try {
      const response = await fetch('/api/social/accounts');
      if (!response.ok) throw new Error('Failed to load social accounts');
      
      const accounts = await response.json();
      setSocialAccounts(accounts);
      
      // Set default selected platforms based on available accounts
      const availablePlatforms = accounts.map((acc: SocialAccount) => acc.platformId);
      setSelectedPlatforms(prev => prev.filter(platform => availablePlatforms.includes(platform)));
    } catch (error) {
      console.error('Failed to load social accounts:', error);
      setError('Failed to load social accounts');
    }
  };

  const loadMediaLibrary = async () => {
    try {
      const response = await fetch('/api/social/media');
      if (!response.ok) throw new Error('Failed to load media library');
      
      const { files } = await response.json();
      setMediaLibrary(files);
    } catch (error) {
      console.error('Failed to load media library:', error);
    }
  };

  const generateContent = async () => {
    try {
      setLoading(true);
      setError(null);

      const requestData = {
        templateId: useTemplate ? selectedTemplate?.id : undefined,
        customTemplate: !useTemplate ? customContent : undefined,
        variables: templateVariables,
        platformId: selectedPlatforms[0], // Primary platform for generation
        additionalHashtags,
        mentions: additionalMentions,
        mediaFiles: selectedMedia,
      };

      const response = await fetch('/api/social/content/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) throw new Error('Failed to generate content');

      const content = await response.json();
      setGeneratedContent(content);
    } catch (error) {
      console.error('Failed to generate content:', error);
      setError('Failed to generate content');
    } finally {
      setLoading(false);
    }
  };

  const handleMediaUpload = async (files: FileList) => {
    for (const file of Array.from(files)) {
      try {
        const fileId = crypto.randomUUID();
        setUploadProgress(prev => ({ ...prev, [fileId]: 0 }));

        const formData = new FormData();
        formData.append('file', file);
        formData.append('platforms', selectedPlatforms.join(','));

        const response = await fetch('/api/social/media/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) throw new Error('Upload failed');

        const uploadedFile = await response.json();
        setSelectedMedia(prev => [...prev, uploadedFile.originalFile]);
        setUploadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[fileId];
          return newProgress;
        });
      } catch (error) {
        console.error('Media upload failed:', error);
        setError('Media upload failed');
      }
    }
  };

  const handleAddHashtag = () => {
    if (hashtagInput.trim() && !additionalHashtags.includes(hashtagInput.trim())) {
      setAdditionalHashtags(prev => [...prev, hashtagInput.trim().replace('#', '')]);
      setHashtagInput('');
    }
  };

  const handleAddMention = () => {
    if (mentionInput.trim() && !additionalMentions.includes(mentionInput.trim())) {
      setAdditionalMentions(prev => [...prev, mentionInput.trim().replace('@', '')]);
      setMentionInput('');
    }
  };

  const handleSchedulePost = async () => {
    if (!generatedContent) return;

    try {
      setLoading(true);

      const scheduleData = {
        templateId: selectedTemplate?.id,
        customContent: !useTemplate ? customContent : undefined,
        variables: templateVariables,
        socialAccountIds: socialAccounts
          .filter(acc => selectedPlatforms.includes(acc.platformId))
          .map(acc => acc.id),
        mediaFiles: selectedMedia,
        scheduledFor: schedulingOptions.scheduleNow ? new Date() : schedulingOptions.scheduledFor,
        useOptimalTiming: schedulingOptions.useOptimalTiming,
        crossPost: schedulingOptions.crossPost,
        additionalHashtags,
        mentions: additionalMentions,
      };

      const response = await fetch('/api/social/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scheduleData),
      });

      if (!response.ok) throw new Error('Failed to schedule post');

      const scheduledPost = await response.json();
      
      if (onContentCreated) {
        onContentCreated(scheduledPost);
      }

      // Reset form
      resetForm();
    } catch (error) {
      console.error('Failed to schedule post:', error);
      setError('Failed to schedule post');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCurrentStep('template');
    setSelectedTemplate(null);
    setCustomContent('');
    setTemplateVariables({});
    setGeneratedContent(null);
    setSelectedMedia([]);
    setAdditionalHashtags([]);
    setAdditionalMentions([]);
    setError(null);
  };

  const canProceedToNextStep = () => {
    switch (currentStep) {
      case 'template':
        return useTemplate ? selectedTemplate !== null : customContent.trim() !== '';
      case 'content':
        return generatedContent !== null;
      case 'media':
        return true; // Media is optional
      case 'schedule':
        return selectedPlatforms.length > 0;
      default:
        return false;
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center space-x-4 mb-8">
      {steps.map((step, index) => {
        const isActive = step.key === currentStep;
        const isCompleted = steps.findIndex(s => s.key === currentStep) > index;
        const Icon = step.icon;
        
        return (
          <div key={step.key} className="flex items-center">
            <div
              className={`
                flex items-center justify-center w-10 h-10 rounded-full
                ${isActive ? 'bg-blue-500 text-white' : 
                  isCompleted ? 'bg-green-500 text-white' : 
                  'bg-gray-200 text-gray-500'}
              `}
            >
              {isCompleted ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <Icon className="w-5 h-5" />
              )}
            </div>
            <span className={`ml-2 ${isActive ? 'font-medium' : 'text-gray-500'}`}>
              {step.label}
            </span>
            {index < steps.length - 1 && (
              <div className={`w-8 h-0.5 ml-4 ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );

  const renderTemplateStep = () => (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button
          variant={useTemplate ? "default" : "outline"}
          onClick={() => setUseTemplate(true)}
        >
          Use Template
        </Button>
        <Button
          variant={!useTemplate ? "default" : "outline"}
          onClick={() => setUseTemplate(false)}
        >
          Custom Content
        </Button>
      </div>

      {useTemplate ? (
        <TemplateManager
          userId={userId}
          mode="browser"
          selectedTemplateId={selectedTemplate?.id}
          onTemplateSelect={setSelectedTemplate}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Create Custom Content</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="customContent">Content</Label>
                <textarea
                  id="customContent"
                  className="w-full h-32 p-3 border rounded-lg resize-none"
                  placeholder="Write your content here..."
                  value={customContent}
                  onChange={(e) => setCustomContent(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderContentStep = () => (
    <div className="space-y-6">
      {/* Platform Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Platforms</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {socialAccounts.map(account => (
              <div
                key={account.id}
                className={`
                  p-3 border rounded-lg cursor-pointer transition-colors
                  ${selectedPlatforms.includes(account.platformId) 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                  }
                `}
                onClick={() => {
                  setSelectedPlatforms(prev => 
                    prev.includes(account.platformId)
                      ? prev.filter(p => p !== account.platformId)
                      : [...prev, account.platformId]
                  );
                }}
              >
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                  <div>
                    <div className="font-medium">{account.displayName}</div>
                    <div className="text-sm text-gray-500">{account.platformId}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Template Variables */}
      {useTemplate && selectedTemplate && Object.keys(selectedTemplate.variables).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Template Variables</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(selectedTemplate.variables).map(([key, variable]) => (
                <div key={key}>
                  <Label htmlFor={key}>
                    {variable.name || key}
                    {variable.required && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                  <Input
                    id={key}
                    type={variable.type === 'number' ? 'number' : 'text'}
                    placeholder={variable.placeholder || variable.defaultValue}
                    value={templateVariables[key] || ''}
                    onChange={(e) => setTemplateVariables(prev => ({
                      ...prev,
                      [key]: e.target.value,
                    }))}
                  />
                  {variable.description && (
                    <p className="text-sm text-gray-500 mt-1">{variable.description}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hashtags and Mentions */}
      <Card>
        <CardHeader>
          <CardTitle>Hashtags & Mentions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Hashtags */}
            <div>
              <Label>Hashtags</Label>
              <div className="flex space-x-2 mb-2">
                <Input
                  placeholder="Add hashtag"
                  value={hashtagInput}
                  onChange={(e) => setHashtagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddHashtag()}
                />
                <Button onClick={handleAddHashtag}>
                  <Hash className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(selectedTemplate?.hashtags || []).map((tag, index) => (
                  <Badge key={index} variant="secondary">
                    #{tag}
                  </Badge>
                ))}
                {additionalHashtags.map((tag, index) => (
                  <Badge key={index} variant="default">
                    #{tag}
                    <X 
                      className="w-3 h-3 ml-1 cursor-pointer" 
                      onClick={() => setAdditionalHashtags(prev => prev.filter((_, i) => i !== index))}
                    />
                  </Badge>
                ))}
              </div>
            </div>

            {/* Mentions */}
            <div>
              <Label>Mentions</Label>
              <div className="flex space-x-2 mb-2">
                <Input
                  placeholder="Add mention"
                  value={mentionInput}
                  onChange={(e) => setMentionInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddMention()}
                />
                <Button onClick={handleAddMention}>
                  <AtSign className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(selectedTemplate?.defaultMentions || []).map((mention, index) => (
                  <Badge key={index} variant="secondary">
                    @{mention}
                  </Badge>
                ))}
                {additionalMentions.map((mention, index) => (
                  <Badge key={index} variant="default">
                    @{mention}
                    <X 
                      className="w-3 h-3 ml-1 cursor-pointer" 
                      onClick={() => setAdditionalMentions(prev => prev.filter((_, i) => i !== index))}
                    />
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generated Content Preview */}
      {generatedContent && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Generated Content
              <div className="flex items-center space-x-2">
                <Badge variant="outline">
                  {generatedContent.characterCount} characters
                </Badge>
                <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
                  <Eye className="w-4 h-4 mr-1" />
                  Preview
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="whitespace-pre-wrap text-sm">
                {generatedContent.text}
              </div>
            </div>
            
            {generatedContent.estimatedEngagement && (
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Expected Likes</div>
                  <div className="font-medium">{generatedContent.estimatedEngagement.likes}</div>
                </div>
                <div>
                  <div className="text-gray-500">Expected Shares</div>
                  <div className="font-medium">{generatedContent.estimatedEngagement.shares}</div>
                </div>
                <div>
                  <div className="text-gray-500">Expected Comments</div>
                  <div className="font-medium">{generatedContent.estimatedEngagement.comments}</div>
                </div>
                <div>
                  <div className="text-gray-500">Expected Reach</div>
                  <div className="font-medium">{generatedContent.estimatedEngagement.reach}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderMediaStep = () => (
    <div className="space-y-6">
      {/* Media Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Media</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <div className="text-lg font-medium text-gray-900 mb-2">
              Upload your media files
            </div>
            <div className="text-gray-500 mb-4">
              Drag and drop files here, or click to browse
            </div>
            <input
              type="file"
              multiple
              accept="image/*,video/*"
              className="hidden"
              id="media-upload"
              onChange={(e) => e.target.files && handleMediaUpload(e.target.files)}
            />
            <label htmlFor="media-upload">
              <Button variant="outline" className="cursor-pointer">
                Choose Files
              </Button>
            </label>
          </div>

          {/* Upload Progress */}
          {Object.keys(uploadProgress).length > 0 && (
            <div className="mt-4 space-y-2">
              {Object.entries(uploadProgress).map(([fileId, progress]) => (
                <div key={fileId}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Uploading...</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Media */}
      {selectedMedia.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Selected Media</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {selectedMedia.map((media) => (
                <div key={media.id} className="relative group">
                  <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                    {media.mimeType.startsWith('image/') ? (
                      <img 
                        src={media.thumbnailUrl || media.fileUrl} 
                        alt={media.fileName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setSelectedMedia(prev => prev.filter(m => m.id !== media.id))}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <div className="mt-2 text-sm text-center truncate">
                    {media.fileName}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Media Library */}
      <Card>
        <CardHeader>
          <CardTitle>Media Library</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {mediaLibrary.slice(0, 12).map((media) => (
              <div 
                key={media.id} 
                className={`
                  aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer border-2
                  ${selectedMedia.some(m => m.id === media.id) ? 'border-blue-500' : 'border-transparent'}
                `}
                onClick={() => {
                  setSelectedMedia(prev => 
                    prev.some(m => m.id === media.id)
                      ? prev.filter(m => m.id !== media.id)
                      : [...prev, media]
                  );
                }}
              >
                {media.mimeType.startsWith('image/') ? (
                  <img 
                    src={media.thumbnailUrl || media.fileUrl} 
                    alt={media.fileName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Video className="w-6 h-6 text-gray-400" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderScheduleStep = () => (
    <div className="space-y-6">
      {/* Scheduling Options */}
      <Card>
        <CardHeader>
          <CardTitle>Scheduling Options</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="schedule-now"
                name="schedule-type"
                checked={schedulingOptions.scheduleNow}
                onChange={(e) => setSchedulingOptions(prev => ({ ...prev, scheduleNow: e.target.checked }))}
              />
              <Label htmlFor="schedule-now">Post immediately</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="radio"
                id="schedule-later"
                name="schedule-type"
                checked={!schedulingOptions.scheduleNow}
                onChange={(e) => setSchedulingOptions(prev => ({ ...prev, scheduleNow: !e.target.checked }))}
              />
              <Label htmlFor="schedule-later">Schedule for later</Label>
            </div>

            {!schedulingOptions.scheduleNow && (
              <div className="ml-6 space-y-4">
                <div>
                  <Label>Date & Time</Label>
                  <Input
                    type="datetime-local"
                    value={schedulingOptions.scheduledFor.toISOString().slice(0, 16)}
                    onChange={(e) => setSchedulingOptions(prev => ({
                      ...prev,
                      scheduledFor: new Date(e.target.value)
                    }))}
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="optimal-timing"
                    checked={schedulingOptions.useOptimalTiming}
                    onChange={(e) => setSchedulingOptions(prev => ({ ...prev, useOptimalTiming: e.target.checked }))}
                  />
                  <Label htmlFor="optimal-timing">Use AI-optimized timing</Label>
                </div>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="cross-post"
                checked={schedulingOptions.crossPost}
                onChange={(e) => setSchedulingOptions(prev => ({ ...prev, crossPost: e.target.checked }))}
              />
              <Label htmlFor="cross-post">Cross-post to all selected platforms</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Final Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Final Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label>Platforms</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {selectedPlatforms.map(platform => (
                  <Badge key={platform} variant="outline">
                    {platform}
                  </Badge>
                ))}
              </div>
            </div>

            {generatedContent && (
              <div>
                <Label>Content</Label>
                <div className="bg-gray-50 rounded-lg p-3 mt-1">
                  <div className="text-sm whitespace-pre-wrap">
                    {generatedContent.text}
                  </div>
                </div>
              </div>
            )}

            {selectedMedia.length > 0 && (
              <div>
                <Label>Media</Label>
                <div className="flex space-x-2 mt-1">
                  {selectedMedia.slice(0, 4).map(media => (
                    <div key={media.id} className="w-16 h-16 bg-gray-100 rounded overflow-hidden">
                      {media.mimeType.startsWith('image/') ? (
                        <img src={media.thumbnailUrl || media.fileUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Video className="w-4 h-4 text-gray-400" />
                        </div>
                      )}
                    </div>
                  ))}
                  {selectedMedia.length > 4 && (
                    <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center text-sm text-gray-500">
                      +{selectedMedia.length - 4}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <Label>Schedule</Label>
              <div className="text-sm text-gray-600 mt-1">
                {schedulingOptions.scheduleNow 
                  ? 'Post immediately'
                  : `Scheduled for ${schedulingOptions.scheduledFor.toLocaleString()}`}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'template': return renderTemplateStep();
      case 'content': return renderContentStep();
      case 'media': return renderMediaStep();
      case 'schedule': return renderScheduleStep();
      default: return null;
    }
  };

  if (error) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
          <div className="text-red-600">{error}</div>
          <Button variant="outline" className="mt-4" onClick={() => setError(null)}>
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Create Content</h1>
        <p className="text-gray-600 mt-2">
          Create and schedule engaging social media content for your audience
        </p>
      </div>

      {/* Step Indicator */}
      {renderStepIndicator()}

      {/* Current Step Content */}
      {renderCurrentStep()}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => {
            const currentIndex = steps.findIndex(s => s.key === currentStep);
            if (currentIndex > 0) {
              setCurrentStep(steps[currentIndex - 1].key as any);
            }
          }}
          disabled={currentStep === 'template'}
        >
          Previous
        </Button>

        <div className="space-x-2">
          {currentStep === 'schedule' ? (
            <Button 
              onClick={handleSchedulePost}
              disabled={!canProceedToNextStep() || loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                  Scheduling...
                </>
              ) : schedulingOptions.scheduleNow ? (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Post Now
                </>
              ) : (
                <>
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule Post
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={() => {
                const currentIndex = steps.findIndex(s => s.key === currentStep);
                if (currentIndex < steps.length - 1) {
                  setCurrentStep(steps[currentIndex + 1].key as any);
                }
              }}
              disabled={!canProceedToNextStep()}
            >
              Next
            </Button>
          )}
        </div>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <div>Processing your content...</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
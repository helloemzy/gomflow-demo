'use client';

/**
 * Template Manager Component
 * Interface for managing content templates with preview and organization
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  FileText,
  Plus,
  Search,
  Filter,
  Star,
  Copy,
  Edit,
  Trash2,
  Eye,
  Download,
  Upload,
  Globe,
  Lock,
  TrendingUp,
  Hash,
  AtSign,
  Image,
  Video,
  Users
} from 'lucide-react';

interface ContentTemplate {
  id: string;
  userId: string;
  name: string;
  description?: string;
  category: 'k-pop' | 'merchandise' | 'promotion' | 'update' | 'announcement' | 'custom';
  templateType: 'text' | 'image' | 'video' | 'carousel' | 'story';
  contentTemplate: string;
  variables: Record<string, TemplateVariable>;
  platformConfigs: Record<string, any>;
  mediaRequirements: any;
  hashtags: string[];
  defaultMentions: string[];
  isPublic: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface TemplateVariable {
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'url' | 'email';
  required: boolean;
  defaultValue?: string;
  description?: string;
  placeholder?: string;
}

interface TemplatePreview {
  platform: string;
  content: string;
  characterCount: number;
  hashtags: string[];
  mentions: string[];
  withinLimits: boolean;
  warnings: string[];
}

interface TemplateManagerProps {
  userId: string;
  onTemplateSelect?: (template: ContentTemplate) => void;
  selectedTemplateId?: string;
  mode?: 'browser' | 'manager';
}

export default function TemplateManager({
  userId,
  onTemplateSelect,
  selectedTemplateId,
  mode = 'manager'
}: TemplateManagerProps) {
  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [showPublicOnly, setShowPublicOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'usage' | 'created'>('usage');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedTemplate, setSelectedTemplate] = useState<ContentTemplate | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewVariables, setPreviewVariables] = useState<Record<string, any>>({});
  const [templatePreviews, setTemplatePreviews] = useState<TemplatePreview[]>([]);

  const categories = [
    { value: '', label: 'All Categories' },
    { value: 'k-pop', label: 'K-pop' },
    { value: 'merchandise', label: 'Merchandise' },
    { value: 'promotion', label: 'Promotion' },
    { value: 'update', label: 'Update' },
    { value: 'announcement', label: 'Announcement' },
    { value: 'custom', label: 'Custom' },
  ];

  const templateTypes = [
    { value: '', label: 'All Types' },
    { value: 'text', label: 'Text' },
    { value: 'image', label: 'Image' },
    { value: 'video', label: 'Video' },
    { value: 'carousel', label: 'Carousel' },
    { value: 'story', label: 'Story' },
  ];

  useEffect(() => {
    loadTemplates();
  }, [userId, searchText, selectedCategory, selectedType, showPublicOnly, sortBy]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (searchText) params.append('search', searchText);
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedType) params.append('type', selectedType);
      if (showPublicOnly) params.append('public', 'true');
      params.append('sort', sortBy);

      const response = await fetch(`/api/social/templates?${params}`);
      if (!response.ok) throw new Error('Failed to load templates');

      const data = await response.json();
      setTemplates(data.templates.map((template: any) => ({
        ...template,
        createdAt: new Date(template.createdAt),
        updatedAt: new Date(template.updatedAt),
      })));
    } catch (error) {
      console.error('Failed to load templates:', error);
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateSelect = (template: ContentTemplate) => {
    setSelectedTemplate(template);
    if (onTemplateSelect) {
      onTemplateSelect(template);
    }
  };

  const handlePreviewTemplate = async (template: ContentTemplate) => {
    try {
      setSelectedTemplate(template);
      setShowPreview(true);

      // Initialize preview variables with default values
      const defaultVariables: Record<string, any> = {};
      Object.entries(template.variables).forEach(([key, variable]) => {
        defaultVariables[key] = variable.defaultValue || '';
      });
      setPreviewVariables(defaultVariables);

      // Generate previews
      await generatePreviews(template, defaultVariables);
    } catch (error) {
      console.error('Failed to preview template:', error);
    }
  };

  const generatePreviews = async (template: ContentTemplate, variables: Record<string, any>) => {
    try {
      const platforms = ['twitter', 'instagram', 'facebook'];
      const response = await fetch(`/api/social/templates/${template.id}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variables, platforms }),
      });

      if (!response.ok) throw new Error('Failed to generate previews');

      const previews = await response.json();
      setTemplatePreviews(previews);
    } catch (error) {
      console.error('Failed to generate previews:', error);
    }
  };

  const handleCloneTemplate = async (template: ContentTemplate) => {
    try {
      const response = await fetch(`/api/social/templates/${template.id}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customName: `${template.name} (Copy)` }),
      });

      if (!response.ok) throw new Error('Failed to clone template');

      await loadTemplates();
    } catch (error) {
      console.error('Failed to clone template:', error);
      setError('Failed to clone template');
    }
  };

  const handleDeleteTemplate = async (template: ContentTemplate) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const response = await fetch(`/api/social/templates/${template.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete template');

      setTemplates(prev => prev.filter(t => t.id !== template.id));
    } catch (error) {
      console.error('Failed to delete template:', error);
      setError('Failed to delete template');
    }
  };

  const handleExportTemplate = async (template: ContentTemplate) => {
    try {
      const response = await fetch(`/api/social/templates/${template.id}/export`);
      if (!response.ok) throw new Error('Failed to export template');

      const exportData = await response.text();
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `${template.name.replace(/[^a-z0-9]/gi, '_')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export template:', error);
      setError('Failed to export template');
    }
  };

  const handleImportTemplate = async (file: File) => {
    try {
      const content = await file.text();
      const response = await fetch('/api/social/templates/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateJson: content }),
      });

      if (!response.ok) throw new Error('Failed to import template');

      await loadTemplates();
    } catch (error) {
      console.error('Failed to import template:', error);
      setError('Failed to import template');
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'k-pop': return '🎵';
      case 'merchandise': return '🛍️';
      case 'promotion': return '📢';
      case 'update': return '📰';
      case 'announcement': return '📣';
      default: return '📝';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'text': return <FileText className="w-4 h-4" />;
      case 'image': return <Image className="w-4 h-4" />;
      case 'video': return <Video className="w-4 h-4" />;
      case 'carousel': return <Users className="w-4 h-4" />;
      case 'story': return <Eye className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const renderTemplateCard = (template: ContentTemplate) => {
    const isSelected = selectedTemplateId === template.id;
    
    return (
      <Card 
        key={template.id} 
        className={`cursor-pointer transition-all hover:shadow-md ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
        onClick={() => mode === 'browser' && handleTemplateSelect(template)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <span className="text-lg">{getCategoryIcon(template.category)}</span>
                <Badge variant="outline" className="text-xs">
                  {template.category}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {getTypeIcon(template.templateType)}
                  <span className="ml-1">{template.templateType}</span>
                </Badge>
              </div>
              <h3 className="font-semibold text-lg leading-tight">{template.name}</h3>
              {template.description && (
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                  {template.description}
                </p>
              )}
            </div>
            <div className="flex items-center space-x-1">
              {template.isPublic ? (
                <Globe className="w-4 h-4 text-green-600" title="Public template" />
              ) : (
                <Lock className="w-4 h-4 text-gray-400" title="Private template" />
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          <div className="space-y-3">
            {/* Template preview */}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm font-mono text-gray-700 line-clamp-3">
                {template.contentTemplate}
              </div>
            </div>
            
            {/* Meta information */}
            <div className="flex items-center justify-between text-sm text-gray-500">
              <div className="flex items-center space-x-4">
                {template.hashtags.length > 0 && (
                  <div className="flex items-center space-x-1">
                    <Hash className="w-3 h-3" />
                    <span>{template.hashtags.length}</span>
                  </div>
                )}
                {template.defaultMentions.length > 0 && (
                  <div className="flex items-center space-x-1">
                    <AtSign className="w-3 h-3" />
                    <span>{template.defaultMentions.length}</span>
                  </div>
                )}
                <div className="flex items-center space-x-1">
                  <TrendingUp className="w-3 h-3" />
                  <span>{template.usageCount} uses</span>
                </div>
              </div>
              <div className="text-xs">
                {template.createdAt.toLocaleDateString()}
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center space-x-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePreviewTemplate(template);
                }}
              >
                <Eye className="w-4 h-4 mr-1" />
                Preview
              </Button>
              
              {mode === 'manager' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloneTemplate(template);
                    }}
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Clone
                  </Button>
                  
                  {template.userId === userId && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Handle edit
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTemplate(template);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExportTemplate(template);
                    }}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderPreviewDialog = () => {
    if (!showPreview || !selectedTemplate) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-xl font-semibold">Template Preview</h2>
            <Button variant="ghost" onClick={() => setShowPreview(false)}>
              <X className="w-5 h-5" />
            </Button>
          </div>
          
          <div className="p-6 overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Variables Input */}
              <div>
                <h3 className="font-medium mb-4">Template Variables</h3>
                <div className="space-y-4">
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
                        value={previewVariables[key] || ''}
                        onChange={(e) => {
                          const newVariables = {
                            ...previewVariables,
                            [key]: e.target.value,
                          };
                          setPreviewVariables(newVariables);
                          generatePreviews(selectedTemplate, newVariables);
                        }}
                      />
                      {variable.description && (
                        <p className="text-sm text-gray-500 mt-1">{variable.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Platform Previews */}
              <div>
                <h3 className="font-medium mb-4">Platform Previews</h3>
                <div className="space-y-4">
                  {templatePreviews.map((preview) => (
                    <Card key={preview.platform}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="capitalize text-base">
                            {preview.platform}
                          </CardTitle>
                          <div className="flex items-center space-x-2">
                            <Badge
                              variant={preview.withinLimits ? "default" : "destructive"}
                              className="text-xs"
                            >
                              {preview.characterCount} chars
                            </Badge>
                            {!preview.withinLimits && (
                              <Badge variant="destructive" className="text-xs">
                                Over limit
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="text-sm whitespace-pre-wrap">
                              {preview.content}
                            </div>
                          </div>
                          
                          {(preview.hashtags.length > 0 || preview.mentions.length > 0) && (
                            <div className="flex flex-wrap gap-1">
                              {preview.hashtags.map((tag, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  #{tag}
                                </Badge>
                              ))}
                              {preview.mentions.map((mention, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  @{mention}
                                </Badge>
                              ))}
                            </div>
                          )}
                          
                          {preview.warnings.length > 0 && (
                            <div className="space-y-1">
                              {preview.warnings.map((warning, index) => (
                                <div key={index} className="text-sm text-amber-600 flex items-center">
                                  <AlertCircle className="w-4 h-4 mr-1" />
                                  {warning}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (error) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <div className="text-red-600">
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {mode === 'browser' ? 'Choose Template' : 'Template Manager'}
        </h2>
        
        {mode === 'manager' && (
          <div className="flex space-x-2">
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImportTemplate(file);
                }}
              />
              <Button variant="outline">
                <Upload className="w-4 h-4 mr-2" />
                Import
              </Button>
            </label>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Template
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="search"
                  placeholder="Search templates..."
                  className="pl-10"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>
            </div>
            
            <div>
              <Label>Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                {categories.map(category => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </Select>
            </div>
            
            <div>
              <Label>Type</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                {templateTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
            </div>
            
            <div>
              <Label>Sort by</Label>
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <option value="usage">Most Used</option>
                <option value="name">Name</option>
                <option value="created">Date Created</option>
              </Select>
            </div>
            
            <div className="flex items-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowPublicOnly(!showPublicOnly)}
                className={showPublicOnly ? 'bg-blue-50 border-blue-200' : ''}
              >
                <Globe className="w-4 h-4 mr-2" />
                Public Only
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates Grid */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <div>Loading templates...</div>
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
            <p className="text-gray-500 mb-4">
              {searchText || selectedCategory || selectedType
                ? 'Try adjusting your filters or search terms.'
                : 'Get started by creating your first template.'}
            </p>
            {mode === 'manager' && (
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Template
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map(renderTemplateCard)}
        </div>
      )}

      {/* Preview Dialog */}
      {renderPreviewDialog()}
    </div>
  );
}
// GOMFLOW Conflict Resolution Component
// UI for resolving collaborative editing conflicts

"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  Users, 
  Clock, 
  CheckCircle, 
  XCircle,
  ArrowRight,
  User,
  Calendar,
  FileText,
  Merge,
  X,
  Info,
  Crown,
  Shield,
  Edit,
  Eye
} from 'lucide-react';
import { 
  WorkspaceMember, 
  WorkspaceRole 
} from '@/lib/collaboration/types';

interface ConflictData {
  field: string;
  localValue: any;
  remoteValue: any;
  remoteUser: string;
  timestamp: string;
  conflictType?: 'concurrent_edit' | 'version_mismatch' | 'permission_conflict';
}

interface ConflictResolution {
  field: string;
  selectedValue: any;
  resolutionType: 'local' | 'remote' | 'merge' | 'custom';
  customValue?: any;
}

interface ConflictResolverProps {
  conflicts: ConflictData[];
  onResolve: (resolutions: ConflictResolution[]) => void;
  onClose: () => void;
  members: WorkspaceMember[];
  allowCustomResolution?: boolean;
}

const ConflictResolver: React.FC<ConflictResolverProps> = ({
  conflicts,
  onResolve,
  onClose,
  members,
  allowCustomResolution = true
}) => {
  const [resolutions, setResolutions] = useState<Map<string, ConflictResolution>>(new Map());
  const [customValues, setCustomValues] = useState<Map<string, any>>(new Map());
  const [selectedTab, setSelectedTab] = useState<'conflicts' | 'preview'>('conflicts');

  const handleResolutionChange = (field: string, resolutionType: ConflictResolution['resolutionType'], value?: any) => {
    const conflict = conflicts.find(c => c.field === field);
    if (!conflict) return;

    let selectedValue = value;
    if (resolutionType === 'local') {
      selectedValue = conflict.localValue;
    } else if (resolutionType === 'remote') {
      selectedValue = conflict.remoteValue;
    } else if (resolutionType === 'custom') {
      selectedValue = customValues.get(field) || conflict.localValue;
    }

    const resolution: ConflictResolution = {
      field,
      selectedValue,
      resolutionType,
      customValue: resolutionType === 'custom' ? selectedValue : undefined
    };

    setResolutions(prev => new Map(prev).set(field, resolution));
  };

  const handleCustomValueChange = (field: string, value: any) => {
    setCustomValues(prev => new Map(prev).set(field, value));
    
    // Update resolution if it's already set to custom
    const currentResolution = resolutions.get(field);
    if (currentResolution?.resolutionType === 'custom') {
      handleResolutionChange(field, 'custom', value);
    }
  };

  const handleResolveAll = () => {
    const resolutionArray = Array.from(resolutions.values());
    
    // Auto-resolve any unresolved conflicts with local values
    const unresolvedConflicts = conflicts.filter(c => !resolutions.has(c.field));
    unresolvedConflicts.forEach(conflict => {
      resolutionArray.push({
        field: conflict.field,
        selectedValue: conflict.localValue,
        resolutionType: 'local'
      });
    });

    onResolve(resolutionArray);
  };

  const getMemberByUserId = (userId: string): WorkspaceMember | null => {
    return members.find(m => m.user_id === userId) || null;
  };

  const getRoleIcon = (role: WorkspaceRole) => {
    switch (role) {
      case 'owner': return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'admin': return <Shield className="w-4 h-4 text-blue-500" />;
      case 'editor': return <Edit className="w-4 h-4 text-green-500" />;
      case 'viewer': return <Eye className="w-4 h-4 text-gray-500" />;
      default: return null;
    }
  };

  const getFieldDisplayName = (field: string): string => {
    const fieldNames: Record<string, string> = {
      'title': 'Title',
      'description': 'Description',
      'price': 'Price',
      'currency': 'Currency',
      'deadline': 'Deadline',
      'max_quantity': 'Max Quantity',
      'min_quantity': 'Min Quantity',
      'shipping_cost': 'Shipping Cost',
      'category': 'Category',
      'payment_methods': 'Payment Methods',
      'image_url': 'Image URL'
    };
    return fieldNames[field] || field;
  };

  const formatValue = (value: any, field: string): string => {
    if (value === null || value === undefined) return 'Not set';
    
    if (field === 'deadline' && typeof value === 'string') {
      return new Date(value).toLocaleString();
    }
    
    if (field === 'price' || field === 'shipping_cost') {
      return typeof value === 'number' ? `$${value.toFixed(2)}` : String(value);
    }
    
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    
    return String(value);
  };

  const getConflictSeverity = (conflict: ConflictData): 'high' | 'medium' | 'low' => {
    if (conflict.field === 'price' || conflict.field === 'deadline') return 'high';
    if (conflict.field === 'title' || conflict.field === 'description') return 'medium';
    return 'low';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getResolutionPreview = () => {
    const preview = conflicts.map(conflict => {
      const resolution = resolutions.get(conflict.field);
      return {
        field: conflict.field,
        currentValue: conflict.localValue,
        finalValue: resolution?.selectedValue ?? conflict.localValue,
        changed: resolution ? resolution.selectedValue !== conflict.localValue : false,
        resolutionType: resolution?.resolutionType ?? 'local'
      };
    });
    return preview;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              <div>
                <CardTitle>Resolve Conflicts</CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} detected while editing
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            <Button
              variant={selectedTab === 'conflicts' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedTab('conflicts')}
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Conflicts ({conflicts.length})
            </Button>
            <Button
              variant={selectedTab === 'preview' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedTab('preview')}
            >
              <FileText className="w-4 h-4 mr-2" />
              Preview
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {selectedTab === 'conflicts' ? (
            <div className="space-y-6">
              {conflicts.map((conflict, index) => {
                const remoteMember = getMemberByUserId(conflict.remoteUser);
                const severity = getConflictSeverity(conflict);
                const currentResolution = resolutions.get(conflict.field);
                
                return (
                  <div key={`${conflict.field}-${index}`} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Badge className={getSeverityColor(severity)}>
                          {severity} priority
                        </Badge>
                        <h3 className="font-semibold">{getFieldDisplayName(conflict.field)}</h3>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Clock className="w-4 h-4" />
                        {new Date(conflict.timestamp).toLocaleTimeString()}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      {/* Local Value */}
                      <div className="border rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <User className="w-4 h-4 text-blue-500" />
                          <span className="font-medium text-sm">Your Version</span>
                        </div>
                        <div className="text-sm bg-gray-50 p-2 rounded">
                          {formatValue(conflict.localValue, conflict.field)}
                        </div>
                        <Button
                          variant={currentResolution?.resolutionType === 'local' ? 'default' : 'outline'}
                          size="sm"
                          className="mt-2 w-full"
                          onClick={() => handleResolutionChange(conflict.field, 'local')}
                        >
                          {currentResolution?.resolutionType === 'local' && (
                            <CheckCircle className="w-4 h-4 mr-2" />
                          )}
                          Keep Your Version
                        </Button>
                      </div>

                      {/* Remote Value */}
                      <div className="border rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">
                            {remoteMember?.user?.name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <span className="font-medium text-sm">
                            {remoteMember?.user?.name || 'Unknown User'}
                          </span>
                          {remoteMember && getRoleIcon(remoteMember.role)}
                        </div>
                        <div className="text-sm bg-gray-50 p-2 rounded">
                          {formatValue(conflict.remoteValue, conflict.field)}
                        </div>
                        <Button
                          variant={currentResolution?.resolutionType === 'remote' ? 'default' : 'outline'}
                          size="sm"
                          className="mt-2 w-full"
                          onClick={() => handleResolutionChange(conflict.field, 'remote')}
                        >
                          {currentResolution?.resolutionType === 'remote' && (
                            <CheckCircle className="w-4 h-4 mr-2" />
                          )}
                          Accept Their Version
                        </Button>
                      </div>
                    </div>

                    {/* Custom Resolution */}
                    {allowCustomResolution && (
                      <div className="border rounded-lg p-3 bg-blue-50">
                        <div className="flex items-center gap-2 mb-2">
                          <Merge className="w-4 h-4 text-blue-500" />
                          <span className="font-medium text-sm">Custom Resolution</span>
                        </div>
                        <div className="space-y-2">
                          <input
                            type="text"
                            placeholder="Enter custom value..."
                            value={customValues.get(conflict.field) || ''}
                            onChange={(e) => handleCustomValueChange(conflict.field, e.target.value)}
                            className="w-full p-2 border rounded text-sm"
                          />
                          <Button
                            variant={currentResolution?.resolutionType === 'custom' ? 'default' : 'outline'}
                            size="sm"
                            className="w-full"
                            onClick={() => handleResolutionChange(conflict.field, 'custom')}
                            disabled={!customValues.has(conflict.field) || !customValues.get(conflict.field)}
                          >
                            {currentResolution?.resolutionType === 'custom' && (
                              <CheckCircle className="w-4 h-4 mr-2" />
                            )}
                            Use Custom Value
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Resolution Status */}
                    {currentResolution && (
                      <div className="mt-3 p-2 bg-green-50 rounded flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-green-700">
                          Resolution selected: {currentResolution.resolutionType === 'local' ? 'Your version' : 
                                               currentResolution.resolutionType === 'remote' ? 'Their version' : 
                                               'Custom value'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Preview Tab */
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Info className="w-5 h-5 text-blue-500" />
                <h3 className="font-semibold">Resolution Preview</h3>
              </div>
              
              {getResolutionPreview().map((preview, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{getFieldDisplayName(preview.field)}</h4>
                    {preview.changed && (
                      <Badge variant="secondary">Modified</Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="text-sm text-gray-600 mb-1">Current</div>
                      <div className="text-sm bg-gray-50 p-2 rounded">
                        {formatValue(preview.currentValue, preview.field)}
                      </div>
                    </div>
                    
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                    
                    <div className="flex-1">
                      <div className="text-sm text-gray-600 mb-1">Final</div>
                      <div className={`text-sm p-2 rounded ${
                        preview.changed ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                      }`}>
                        {formatValue(preview.finalValue, preview.field)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>

        {/* Actions */}
        <div className="p-6 border-t bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {resolutions.size} of {conflicts.length} conflicts resolved
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleResolveAll}
                disabled={conflicts.length > 0 && resolutions.size === 0}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Resolve All Conflicts
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ConflictResolver;
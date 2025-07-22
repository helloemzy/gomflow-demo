"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Settings,
  Save,
  X,
  Edit,
  Trash2,
  Users,
  Shield,
  Bell,
  Globe,
  Lock,
  Unlock,
  Image,
  Link,
  Download,
  Upload,
  AlertTriangle,
  Check,
  Eye,
  EyeOff,
  Calendar,
  Clock,
  Zap,
  Database,
  Palette,
  Volume2,
  VolumeX,
  Smartphone,
  Mail,
  MessageCircle,
  Archive,
  RefreshCw,
  ExternalLink
} from "lucide-react";

interface WorkspaceSettings {
  id: string;
  name: string;
  description: string;
  avatar?: string;
  isPublic: boolean;
  allowInvites: boolean;
  allowGuestAccess: boolean;
  defaultRole: 'viewer' | 'editor';
  autoArchive: boolean;
  autoArchiveDays: number;
  timezone: string;
  language: string;
  theme: 'light' | 'dark' | 'auto';
  notifications: {
    email: boolean;
    push: boolean;
    sound: boolean;
    desktop: boolean;
    digest: boolean;
    digestFrequency: 'daily' | 'weekly' | 'never';
  };
  collaboration: {
    allowRealtimeEditing: boolean;
    showCursors: boolean;
    lockTimeout: number;
    maxConcurrentEditors: number;
    versionHistory: boolean;
    autosave: boolean;
    autosaveInterval: number;
  };
  security: {
    twoFactorRequired: boolean;
    passwordStrength: 'low' | 'medium' | 'high';
    sessionTimeout: number;
    allowedDomains: string[];
    ipWhitelist: string[];
  };
}

interface WorkspaceSettingsProps {
  workspace: WorkspaceSettings;
  userRole: 'owner' | 'admin' | 'editor' | 'viewer';
  onUpdate: (settings: Partial<WorkspaceSettings>) => void;
  onDelete: () => void;
  onExport: () => void;
  onArchive: () => void;
  className?: string;
}

const timezones = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'Eastern Time (US & Canada)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Seoul', label: 'Seoul (KST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Manila', label: 'Manila (PHT)' },
  { value: 'Asia/Jakarta', label: 'Jakarta (WIB)' }
];

const languages = [
  { value: 'en', label: 'English' },
  { value: 'ko', label: '한국어 (Korean)' },
  { value: 'ja', label: '日本語 (Japanese)' },
  { value: 'zh', label: '中文 (Chinese)' },
  { value: 'th', label: 'ไทย (Thai)' },
  { value: 'id', label: 'Bahasa Indonesia' },
  { value: 'ms', label: 'Bahasa Melayu' },
  { value: 'tl', label: 'Filipino' }
];

export function WorkspaceSettings({
  workspace,
  userRole,
  onUpdate,
  onDelete,
  onExport,
  onArchive,
  className
}: WorkspaceSettingsProps) {
  const [settings, setSettings] = useState<WorkspaceSettings>(workspace);
  const [activeTab, setActiveTab] = useState('general');
  const [hasChanges, setHasChanges] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAdvancedSecurity, setShowAdvancedSecurity] = useState(false);

  const canEdit = userRole === 'owner' || userRole === 'admin';
  const canDelete = userRole === 'owner';

  useEffect(() => {
    const hasChanges = JSON.stringify(settings) !== JSON.stringify(workspace);
    setHasChanges(hasChanges);
  }, [settings, workspace]);

  const handleSave = () => {
    onUpdate(settings);
    setHasChanges(false);
  };

  const handleReset = () => {
    setSettings(workspace);
    setHasChanges(false);
  };

  const updateSetting = (path: string, value: any) => {
    if (!canEdit) return;
    
    const keys = path.split('.');
    setSettings(prev => {
      const newSettings = { ...prev };
      let current = newSettings;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]] = { ...current[keys[i]] };
      }
      
      current[keys[keys.length - 1]] = value;
      return newSettings;
    });
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'collaboration', label: 'Collaboration', icon: MessageCircle },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'advanced', label: 'Advanced', icon: Database }
  ];

  const renderGeneralTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label htmlFor="workspace-name">Workspace Name</Label>
          <Input
            id="workspace-name"
            value={settings.name}
            onChange={(e) => updateSetting('name', e.target.value)}
            disabled={!canEdit}
            className="mt-1"
          />
        </div>
        
        <div>
          <Label htmlFor="workspace-timezone">Timezone</Label>
          <select
            id="workspace-timezone"
            value={settings.timezone}
            onChange={(e) => updateSetting('timezone', e.target.value)}
            disabled={!canEdit}
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            {timezones.map(tz => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <Label htmlFor="workspace-description">Description</Label>
        <textarea
          id="workspace-description"
          value={settings.description}
          onChange={(e) => updateSetting('description', e.target.value)}
          disabled={!canEdit}
          rows={3}
          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
          placeholder="Describe your workspace..."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label htmlFor="workspace-language">Language</Label>
          <select
            id="workspace-language"
            value={settings.language}
            onChange={(e) => updateSetting('language', e.target.value)}
            disabled={!canEdit}
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            {languages.map(lang => (
              <option key={lang.value} value={lang.value}>{lang.label}</option>
            ))}
          </select>
        </div>
        
        <div>
          <Label htmlFor="workspace-theme">Theme</Label>
          <select
            id="workspace-theme"
            value={settings.theme}
            onChange={(e) => updateSetting('theme', e.target.value)}
            disabled={!canEdit}
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="auto">Auto</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Workspace Visibility</h3>
        
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="public-workspace"
            checked={settings.isPublic}
            onChange={(e) => updateSetting('isPublic', e.target.checked)}
            disabled={!canEdit}
            className="rounded"
          />
          <Label htmlFor="public-workspace" className="flex items-center space-x-2">
            <Globe className="h-4 w-4" />
            <span>Public workspace</span>
          </Label>
        </div>
        
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="allow-invites"
            checked={settings.allowInvites}
            onChange={(e) => updateSetting('allowInvites', e.target.checked)}
            disabled={!canEdit}
            className="rounded"
          />
          <Label htmlFor="allow-invites" className="flex items-center space-x-2">
            <Users className="h-4 w-4" />
            <span>Allow member invites</span>
          </Label>
        </div>
        
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="allow-guest-access"
            checked={settings.allowGuestAccess}
            onChange={(e) => updateSetting('allowGuestAccess', e.target.checked)}
            disabled={!canEdit}
            className="rounded"
          />
          <Label htmlFor="allow-guest-access" className="flex items-center space-x-2">
            <Eye className="h-4 w-4" />
            <span>Allow guest access</span>
          </Label>
        </div>
      </div>
    </div>
  );

  const renderMembersTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label htmlFor="default-role">Default Role for New Members</Label>
          <select
            id="default-role"
            value={settings.defaultRole}
            onChange={(e) => updateSetting('defaultRole', e.target.value)}
            disabled={!canEdit}
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
        </div>
        
        <div>
          <Label htmlFor="auto-archive">Auto-Archive Inactive Members</Label>
          <div className="flex items-center space-x-3 mt-2">
            <input
              type="checkbox"
              id="auto-archive"
              checked={settings.autoArchive}
              onChange={(e) => updateSetting('autoArchive', e.target.checked)}
              disabled={!canEdit}
              className="rounded"
            />
            <span className="text-sm text-gray-600">
              Archive members after {settings.autoArchiveDays} days of inactivity
            </span>
          </div>
        </div>
      </div>

      {settings.autoArchive && (
        <div>
          <Label htmlFor="auto-archive-days">Days Until Auto-Archive</Label>
          <Input
            id="auto-archive-days"
            type="number"
            value={settings.autoArchiveDays}
            onChange={(e) => updateSetting('autoArchiveDays', parseInt(e.target.value))}
            disabled={!canEdit}
            min="7"
            max="365"
            className="mt-1 w-32"
          />
        </div>
      )}
    </div>
  );

  const renderCollaborationTab = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Real-time Collaboration</h3>
        
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="realtime-editing"
            checked={settings.collaboration.allowRealtimeEditing}
            onChange={(e) => updateSetting('collaboration.allowRealtimeEditing', e.target.checked)}
            disabled={!canEdit}
            className="rounded"
          />
          <Label htmlFor="realtime-editing" className="flex items-center space-x-2">
            <Edit className="h-4 w-4" />
            <span>Allow real-time editing</span>
          </Label>
        </div>
        
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="show-cursors"
            checked={settings.collaboration.showCursors}
            onChange={(e) => updateSetting('collaboration.showCursors', e.target.checked)}
            disabled={!canEdit}
            className="rounded"
          />
          <Label htmlFor="show-cursors" className="flex items-center space-x-2">
            <Eye className="h-4 w-4" />
            <span>Show live cursors</span>
          </Label>
        </div>
        
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="version-history"
            checked={settings.collaboration.versionHistory}
            onChange={(e) => updateSetting('collaboration.versionHistory', e.target.checked)}
            disabled={!canEdit}
            className="rounded"
          />
          <Label htmlFor="version-history" className="flex items-center space-x-2">
            <Clock className="h-4 w-4" />
            <span>Enable version history</span>
          </Label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label htmlFor="lock-timeout">Lock Timeout (minutes)</Label>
          <Input
            id="lock-timeout"
            type="number"
            value={settings.collaboration.lockTimeout}
            onChange={(e) => updateSetting('collaboration.lockTimeout', parseInt(e.target.value))}
            disabled={!canEdit}
            min="1"
            max="60"
            className="mt-1"
          />
        </div>
        
        <div>
          <Label htmlFor="max-editors">Max Concurrent Editors</Label>
          <Input
            id="max-editors"
            type="number"
            value={settings.collaboration.maxConcurrentEditors}
            onChange={(e) => updateSetting('collaboration.maxConcurrentEditors', parseInt(e.target.value))}
            disabled={!canEdit}
            min="1"
            max="20"
            className="mt-1"
          />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Auto-save</h3>
        
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="autosave"
            checked={settings.collaboration.autosave}
            onChange={(e) => updateSetting('collaboration.autosave', e.target.checked)}
            disabled={!canEdit}
            className="rounded"
          />
          <Label htmlFor="autosave" className="flex items-center space-x-2">
            <Save className="h-4 w-4" />
            <span>Enable auto-save</span>
          </Label>
        </div>
        
        {settings.collaboration.autosave && (
          <div>
            <Label htmlFor="autosave-interval">Auto-save Interval (seconds)</Label>
            <Input
              id="autosave-interval"
              type="number"
              value={settings.collaboration.autosaveInterval}
              onChange={(e) => updateSetting('collaboration.autosaveInterval', parseInt(e.target.value))}
              disabled={!canEdit}
              min="10"
              max="300"
              className="mt-1 w-32"
            />
          </div>
        )}
      </div>
    </div>
  );

  const renderNotificationsTab = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Notification Channels</h3>
        
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="email-notifications"
            checked={settings.notifications.email}
            onChange={(e) => updateSetting('notifications.email', e.target.checked)}
            disabled={!canEdit}
            className="rounded"
          />
          <Label htmlFor="email-notifications" className="flex items-center space-x-2">
            <Mail className="h-4 w-4" />
            <span>Email notifications</span>
          </Label>
        </div>
        
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="push-notifications"
            checked={settings.notifications.push}
            onChange={(e) => updateSetting('notifications.push', e.target.checked)}
            disabled={!canEdit}
            className="rounded"
          />
          <Label htmlFor="push-notifications" className="flex items-center space-x-2">
            <Smartphone className="h-4 w-4" />
            <span>Push notifications</span>
          </Label>
        </div>
        
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="sound-notifications"
            checked={settings.notifications.sound}
            onChange={(e) => updateSetting('notifications.sound', e.target.checked)}
            disabled={!canEdit}
            className="rounded"
          />
          <Label htmlFor="sound-notifications" className="flex items-center space-x-2">
            <Volume2 className="h-4 w-4" />
            <span>Sound notifications</span>
          </Label>
        </div>
        
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="desktop-notifications"
            checked={settings.notifications.desktop}
            onChange={(e) => updateSetting('notifications.desktop', e.target.checked)}
            disabled={!canEdit}
            className="rounded"
          />
          <Label htmlFor="desktop-notifications" className="flex items-center space-x-2">
            <Monitor className="h-4 w-4" />
            <span>Desktop notifications</span>
          </Label>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Digest Settings</h3>
        
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="digest-enabled"
            checked={settings.notifications.digest}
            onChange={(e) => updateSetting('notifications.digest', e.target.checked)}
            disabled={!canEdit}
            className="rounded"
          />
          <Label htmlFor="digest-enabled" className="flex items-center space-x-2">
            <Calendar className="h-4 w-4" />
            <span>Enable digest emails</span>
          </Label>
        </div>
        
        {settings.notifications.digest && (
          <div>
            <Label htmlFor="digest-frequency">Digest Frequency</Label>
            <select
              id="digest-frequency"
              value={settings.notifications.digestFrequency}
              onChange={(e) => updateSetting('notifications.digestFrequency', e.target.value)}
              disabled={!canEdit}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="never">Never</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );

  const renderSecurityTab = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Authentication</h3>
        
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="two-factor-required"
            checked={settings.security.twoFactorRequired}
            onChange={(e) => updateSetting('security.twoFactorRequired', e.target.checked)}
            disabled={!canEdit}
            className="rounded"
          />
          <Label htmlFor="two-factor-required" className="flex items-center space-x-2">
            <Shield className="h-4 w-4" />
            <span>Require two-factor authentication</span>
          </Label>
        </div>
        
        <div>
          <Label htmlFor="password-strength">Password Strength Requirement</Label>
          <select
            id="password-strength"
            value={settings.security.passwordStrength}
            onChange={(e) => updateSetting('security.passwordStrength', e.target.value)}
            disabled={!canEdit}
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        
        <div>
          <Label htmlFor="session-timeout">Session Timeout (hours)</Label>
          <Input
            id="session-timeout"
            type="number"
            value={settings.security.sessionTimeout}
            onChange={(e) => updateSetting('security.sessionTimeout', parseInt(e.target.value))}
            disabled={!canEdit}
            min="1"
            max="168"
            className="mt-1 w-32"
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Advanced Security</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvancedSecurity(!showAdvancedSecurity)}
          >
            {showAdvancedSecurity ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        
        {showAdvancedSecurity && (
          <>
            <div>
              <Label htmlFor="allowed-domains">Allowed Email Domains</Label>
              <textarea
                id="allowed-domains"
                value={settings.security.allowedDomains.join('\n')}
                onChange={(e) => updateSetting('security.allowedDomains', e.target.value.split('\n').filter(Boolean))}
                disabled={!canEdit}
                rows={3}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="example.com&#10;company.com"
              />
            </div>
            
            <div>
              <Label htmlFor="ip-whitelist">IP Whitelist</Label>
              <textarea
                id="ip-whitelist"
                value={settings.security.ipWhitelist.join('\n')}
                onChange={(e) => updateSetting('security.ipWhitelist', e.target.value.split('\n').filter(Boolean))}
                disabled={!canEdit}
                rows={3}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="192.168.1.0/24&#10;10.0.0.0/16"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );

  const renderAdvancedTab = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Data Management</h3>
        
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            onClick={onExport}
            className="flex items-center space-x-2"
          >
            <Download className="h-4 w-4" />
            <span>Export Data</span>
          </Button>
          
          <Button
            variant="outline"
            onClick={onArchive}
            className="flex items-center space-x-2"
          >
            <Archive className="h-4 w-4" />
            <span>Archive Workspace</span>
          </Button>
        </div>
      </div>

      {canDelete && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-red-600">Danger Zone</h3>
          
          <Card className="p-4 border-red-200 bg-red-50">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div className="flex-1">
                <h4 className="font-medium text-red-900">Delete Workspace</h4>
                <p className="text-sm text-red-700">
                  This action cannot be undone. All data will be permanently deleted.
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                className="bg-red-600 hover:bg-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );

  return (
    <div className={cn("max-w-4xl mx-auto", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workspace Settings</h1>
          <p className="text-gray-600">Configure your workspace preferences and policies</p>
        </div>
        
        {canEdit && hasChanges && (
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              onClick={handleReset}
              className="text-gray-600 hover:text-gray-900"
            >
              <X className="h-4 w-4 mr-2" />
              Reset
            </Button>
            
            <Button
              onClick={handleSave}
              className="bg-primary-600 hover:bg-primary-700"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 mb-8 border-b border-gray-200">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center space-x-2 px-4 py-2 rounded-t-lg transition-colors",
                activeTab === tab.id
                  ? "bg-primary-50 text-primary-700 border-b-2 border-primary-600"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {activeTab === 'general' && renderGeneralTab()}
        {activeTab === 'members' && renderMembersTab()}
        {activeTab === 'collaboration' && renderCollaborationTab()}
        {activeTab === 'notifications' && renderNotificationsTab()}
        {activeTab === 'security' && renderSecurityTab()}
        {activeTab === 'advanced' && renderAdvancedTab()}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              <h3 className="text-lg font-medium text-gray-900">Delete Workspace</h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this workspace? This action cannot be undone and all data will be permanently deleted.
            </p>
            
            <div className="flex items-center justify-end space-x-3">
              <Button
                variant="ghost"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              
              <Button
                variant="destructive"
                onClick={() => {
                  onDelete();
                  setShowDeleteConfirm(false);
                }}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete Workspace
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkspaceSettings;
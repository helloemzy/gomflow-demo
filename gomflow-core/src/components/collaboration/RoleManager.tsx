"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Users,
  Crown,
  Shield,
  Edit,
  Eye,
  UserPlus,
  UserMinus,
  Mail,
  Search,
  MoreVertical,
  Check,
  X,
  ChevronDown,
  Lock,
  Unlock,
  Settings,
  AlertTriangle,
  Copy,
  ExternalLink
} from "lucide-react";

interface WorkspaceMember {
  user_id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  avatar?: string;
  joined_at: string;
  last_active: string;
  permissions: {
    can_create_orders: boolean;
    can_edit_orders: boolean;
    can_delete_orders: boolean;
    can_view_analytics: boolean;
    can_manage_payments: boolean;
    can_invite_members: boolean;
    can_chat: boolean;
  };
}

interface RoleManagerProps {
  workspaceId: string;
  members: WorkspaceMember[];
  currentUserRole: string;
  onMemberUpdate: (memberId: string, updates: Partial<WorkspaceMember>) => void;
  onMemberRemove: (memberId: string) => void;
  onMemberInvite: (email: string, role: string) => void;
  className?: string;
}

const roleConfigs = {
  owner: {
    name: 'Owner',
    icon: Crown,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    description: 'Full control over workspace and members',
    permissions: {
      can_create_orders: true,
      can_edit_orders: true,
      can_delete_orders: true,
      can_view_analytics: true,
      can_manage_payments: true,
      can_invite_members: true,
      can_chat: true
    }
  },
  admin: {
    name: 'Admin',
    icon: Shield,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    description: 'Manage members and workspace settings',
    permissions: {
      can_create_orders: true,
      can_edit_orders: true,
      can_delete_orders: true,
      can_view_analytics: true,
      can_manage_payments: true,
      can_invite_members: true,
      can_chat: true
    }
  },
  editor: {
    name: 'Editor',
    icon: Edit,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    description: 'Create and edit orders and content',
    permissions: {
      can_create_orders: true,
      can_edit_orders: true,
      can_delete_orders: false,
      can_view_analytics: true,
      can_manage_payments: false,
      can_invite_members: false,
      can_chat: true
    }
  },
  viewer: {
    name: 'Viewer',
    icon: Eye,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    description: 'View orders and participate in chat',
    permissions: {
      can_create_orders: false,
      can_edit_orders: false,
      can_delete_orders: false,
      can_view_analytics: false,
      can_manage_payments: false,
      can_invite_members: false,
      can_chat: true
    }
  }
};

export function RoleManager({
  workspaceId,
  members,
  currentUserRole,
  onMemberUpdate,
  onMemberRemove,
  onMemberInvite,
  className
}: RoleManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  const filteredMembers = members.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = selectedRole === 'all' || member.role === selectedRole;
    return matchesSearch && matchesRole;
  });

  const canManageMembers = currentUserRole === 'owner' || currentUserRole === 'admin';
  const canInviteMembers = canManageMembers;

  const handleRoleChange = (memberId: string, newRole: string) => {
    if (!canManageMembers) return;
    
    const member = members.find(m => m.user_id === memberId);
    if (!member) return;

    const roleConfig = roleConfigs[newRole as keyof typeof roleConfigs];
    if (!roleConfig) return;

    onMemberUpdate(memberId, {
      role: newRole as any,
      permissions: roleConfig.permissions
    });
    
    setEditingMember(null);
  };

  const handleInviteMember = () => {
    if (!inviteEmail || !canInviteMembers) return;
    
    onMemberInvite(inviteEmail, inviteRole);
    setInviteEmail('');
    setInviteRole('editor');
    setShowInviteForm(false);
  };

  const handleRemoveMember = (memberId: string) => {
    if (!canManageMembers) return;
    
    if (confirm('Are you sure you want to remove this member from the workspace?')) {
      onMemberRemove(memberId);
    }
  };

  const getRoleIcon = (role: string) => {
    const roleConfig = roleConfigs[role as keyof typeof roleConfigs];
    if (!roleConfig) return Eye;
    return roleConfig.icon;
  };

  const getRoleColor = (role: string) => {
    const roleConfig = roleConfigs[role as keyof typeof roleConfigs];
    return roleConfig?.color || 'text-gray-600';
  };

  const renderMemberCard = (member: WorkspaceMember) => {
    const roleConfig = roleConfigs[member.role];
    const RoleIcon = roleConfig?.icon || Eye;
    const isExpanded = expandedMember === member.user_id;
    const isEditing = editingMember === member.user_id;

    return (
      <Card key={member.user_id} className="p-4 hover:shadow-sm transition-shadow">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium">
              {member.name.charAt(0)}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <h3 className="font-medium text-gray-900">{member.name}</h3>
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-xs",
                    roleConfig?.bgColor,
                    roleConfig?.borderColor,
                    roleConfig?.color
                  )}
                >
                  <RoleIcon className="h-3 w-3 mr-1" />
                  {roleConfig?.name}
                </Badge>
              </div>
              <p className="text-sm text-gray-600">{member.email}</p>
              <p className="text-xs text-gray-500">
                Joined {new Date(member.joined_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpandedMember(isExpanded ? null : member.user_id)}
              className="text-gray-600 hover:text-gray-900"
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
            </Button>
            
            {canManageMembers && member.role !== 'owner' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingMember(isEditing ? null : member.user_id)}
                className="text-gray-600 hover:text-gray-900"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-sm text-gray-900 mb-2">Permissions</h4>
                <div className="space-y-2">
                  {Object.entries(member.permissions).map(([key, value]) => (
                    <div key={key} className="flex items-center space-x-2">
                      {value ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <X className="h-4 w-4 text-gray-400" />
                      )}
                      <span className={cn(
                        "text-sm",
                        value ? "text-gray-900" : "text-gray-500"
                      )}>
                        {key.replace('can_', '').replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-sm text-gray-900 mb-2">Activity</h4>
                <div className="space-y-2">
                  <div className="text-sm text-gray-600">
                    Last active: {new Date(member.last_active).toLocaleDateString()}
                  </div>
                  <div className="text-sm text-gray-600">
                    Role: {roleConfig?.description}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {isEditing && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Label htmlFor="role-select" className="text-sm font-medium">
                  Role:
                </Label>
                <select
                  id="role-select"
                  value={member.role}
                  onChange={(e) => handleRoleChange(member.user_id, e.target.value)}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm"
                >
                  {Object.entries(roleConfigs).map(([key, config]) => (
                    <option key={key} value={key}>
                      {config.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingMember(null)}
                  className="text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </Button>
                
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleRemoveMember(member.user_id)}
                  className="text-red-600 hover:text-red-700"
                >
                  Remove
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Team Members</h2>
          <p className="text-sm text-gray-600">
            Manage workspace members and their permissions
          </p>
        </div>
        
        {canInviteMembers && (
          <Button
            onClick={() => setShowInviteForm(!showInviteForm)}
            className="bg-primary-600 hover:bg-primary-700"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Member
          </Button>
        )}
      </div>

      {/* Role Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Object.entries(roleConfigs).map(([key, config]) => {
          const Icon = config.icon;
          const count = members.filter(m => m.role === key).length;
          
          return (
            <Card key={key} className={cn("p-4", config.bgColor, config.borderColor)}>
              <div className="flex items-center space-x-3">
                <Icon className={cn("h-6 w-6", config.color)} />
                <div>
                  <h3 className="font-medium text-gray-900">{config.name}</h3>
                  <p className="text-sm text-gray-600">{count} members</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Invite Form */}
      {showInviteForm && (
        <Card className="p-4 border-dashed border-2 border-gray-300">
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">Invite New Member</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="invite-email" className="text-sm font-medium">
                  Email Address
                </Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="invite-role" className="text-sm font-medium">
                  Role
                </Label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  {Object.entries(roleConfigs).map(([key, config]) => (
                    <option key={key} value={key}>
                      {config.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                onClick={handleInviteMember}
                disabled={!inviteEmail}
                className="bg-primary-600 hover:bg-primary-700"
              >
                Send Invitation
              </Button>
              
              <Button
                variant="ghost"
                onClick={() => setShowInviteForm(false)}
                className="text-gray-600 hover:text-gray-900"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Search and Filter */}
      <div className="flex items-center space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search members..."
            className="pl-10"
          />
        </div>
        
        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md"
        >
          <option value="all">All Roles</option>
          {Object.entries(roleConfigs).map(([key, config]) => (
            <option key={key} value={key}>
              {config.name}
            </option>
          ))}
        </select>
      </div>

      {/* Members List */}
      <div className="space-y-4">
        {filteredMembers.map(renderMemberCard)}
      </div>

      {filteredMembers.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No members found matching your criteria.
        </div>
      )}
    </div>
  );
}

export default RoleManager;
// GOMFLOW Workspace Manager Component
// Interface for managing workspaces and members

"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  Plus, 
  Settings, 
  Activity, 
  ChevronRight,
  Search,
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  UserPlus,
  LogOut,
  Crown,
  Shield,
  Eye,
  Clock,
  MessageSquare,
  BarChart3,
  Globe,
  Lock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import {
  Workspace,
  WorkspaceMember,
  WorkspaceRole,
  WorkspaceSettings,
  MemberStatus,
  PresenceStatus,
  ApiResponse
} from '@/lib/collaboration/types';

interface WorkspaceManagerProps {
  userId: string;
  authToken: string;
  onWorkspaceSelect?: (workspaceId: string) => void;
  onCreateWorkspace?: (workspace: Workspace) => void;
}

interface WorkspaceWithStats extends Workspace {
  stats: {
    totalMembers: number;
    activeMembers: number;
    onlineMembers: number;
    totalOrders: number;
    activeOrders: number;
    recentActivity: number;
  };
}

interface CreateWorkspaceForm {
  name: string;
  description: string;
  settings: WorkspaceSettings;
}

interface MemberInviteForm {
  email: string;
  role: WorkspaceRole;
}

const WorkspaceManager: React.FC<WorkspaceManagerProps> = ({
  userId,
  authToken,
  onWorkspaceSelect,
  onCreateWorkspace
}) => {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceWithStats[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceWithStats | null>(null);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'owned' | 'member'>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [showMemberManagement, setShowMemberManagement] = useState(false);

  // Create workspace form
  const [createForm, setCreateForm] = useState<CreateWorkspaceForm>({
    name: '',
    description: '',
    settings: {
      auto_invite: false,
      public_orders: true,
      require_approval: false,
      default_role: 'viewer'
    }
  });

  // Invite member form
  const [inviteForm, setInviteForm] = useState<MemberInviteForm>({
    email: '',
    role: 'viewer'
  });

  // Load workspaces
  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/collaboration/workspaces', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (!response.ok) {
        throw new Error('Failed to load workspaces');
      }

      const result: ApiResponse<WorkspaceWithStats[]> = await response.json();
      setWorkspaces(result.data || []);
    } catch (err) {
      console.error('Error loading workspaces:', err);
      setError('Failed to load workspaces');
    } finally {
      setIsLoading(false);
    }
  };

  const loadWorkspaceMembers = async (workspaceId: string) => {
    try {
      const response = await fetch(`/api/collaboration/workspaces/${workspaceId}/members`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (!response.ok) {
        throw new Error('Failed to load workspace members');
      }

      const result: ApiResponse<WorkspaceMember[]> = await response.json();
      setWorkspaceMembers(result.data || []);
    } catch (err) {
      console.error('Error loading workspace members:', err);
      setError('Failed to load workspace members');
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/collaboration/workspaces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(createForm)
      });

      if (!response.ok) {
        throw new Error('Failed to create workspace');
      }

      const result: ApiResponse<Workspace> = await response.json();
      if (result.data) {
        onCreateWorkspace?.(result.data);
        setShowCreateForm(false);
        setCreateForm({
          name: '',
          description: '',
          settings: {
            auto_invite: false,
            public_orders: true,
            require_approval: false,
            default_role: 'viewer'
          }
        });
        loadWorkspaces();
      }
    } catch (err) {
      console.error('Error creating workspace:', err);
      setError('Failed to create workspace');
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedWorkspace) return;

    try {
      const response = await fetch(`/api/collaboration/workspaces/${selectedWorkspace.id}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(inviteForm)
      });

      if (!response.ok) {
        throw new Error('Failed to invite member');
      }

      setShowInviteForm(false);
      setInviteForm({ email: '', role: 'viewer' });
      loadWorkspaceMembers(selectedWorkspace.id);
    } catch (err) {
      console.error('Error inviting member:', err);
      setError('Failed to invite member');
    }
  };

  const handleWorkspaceSelect = (workspace: WorkspaceWithStats) => {
    setSelectedWorkspace(workspace);
    loadWorkspaceMembers(workspace.id);
    onWorkspaceSelect?.(workspace.id);
  };

  const handleJoinWorkspace = (workspaceId: string) => {
    router.push(`/workspace/${workspaceId}`);
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

  const getStatusIcon = (status: MemberStatus) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'invited': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'suspended': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'left': return <AlertCircle className="w-4 h-4 text-gray-500" />;
      default: return null;
    }
  };

  const getPresenceColor = (status: PresenceStatus) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'busy': return 'bg-red-500';
      case 'offline': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  const filteredWorkspaces = workspaces.filter(workspace => {
    const matchesSearch = workspace.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         workspace.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterStatus === 'all' || 
                         (filterStatus === 'owned' && workspace.owner_id === userId) ||
                         (filterStatus === 'member' && workspace.owner_id !== userId);
    
    return matchesSearch && matchesFilter;
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Workspaces</h1>
        <Button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Create Workspace
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search workspaces..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={filterStatus === 'all' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('all')}
            size="sm"
          >
            All
          </Button>
          <Button
            variant={filterStatus === 'owned' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('owned')}
            size="sm"
          >
            <Crown className="w-4 h-4 mr-1" />
            Owned
          </Button>
          <Button
            variant={filterStatus === 'member' ? 'default' : 'outline'}
            onClick={() => setFilterStatus('member')}
            size="sm"
          >
            <Users className="w-4 h-4 mr-1" />
            Member
          </Button>
        </div>
      </div>

      {/* Workspace List */}
      <div className="grid gap-4">
        {filteredWorkspaces.map((workspace) => (
          <Card 
            key={workspace.id} 
            className={`cursor-pointer transition-all hover:shadow-lg ${
              selectedWorkspace?.id === workspace.id ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => handleWorkspaceSelect(workspace)}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{workspace.name}</h3>
                    {workspace.owner_id === userId && (
                      <Badge variant="secondary" className="text-xs">
                        <Crown className="w-3 h-3 mr-1" />
                        Owner
                      </Badge>
                    )}
                    <div className="flex items-center gap-1">
                      {workspace.settings.public_orders ? (
                        <Globe className="w-4 h-4 text-green-500" />
                      ) : (
                        <Lock className="w-4 h-4 text-gray-500" />
                      )}
                    </div>
                  </div>
                  
                  {workspace.description && (
                    <p className="text-sm text-gray-600 mb-3">{workspace.description}</p>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-500" />
                      <span className="text-sm">
                        {workspace.stats.totalMembers} members
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-green-500" />
                      <span className="text-sm">
                        {workspace.stats.onlineMembers} online
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-blue-500" />
                      <span className="text-sm">
                        {workspace.stats.activeOrders} orders
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-purple-500" />
                      <span className="text-sm">
                        {workspace.stats.recentActivity} activity
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">Activity</span>
                      <Progress 
                        value={Math.min(workspace.stats.recentActivity / 10 * 100, 100)} 
                        className="w-20 h-2"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleJoinWorkspace(workspace.id);
                        }}
                      >
                        Join
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                      {workspace.owner_id === userId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowMemberManagement(true);
                          }}
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* No workspaces message */}
      {filteredWorkspaces.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No workspaces found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm 
                ? "No workspaces match your search criteria." 
                : "Get started by creating your first workspace."}
            </p>
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Workspace
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Workspace Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Create New Workspace</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateWorkspace} className="space-y-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={createForm.name}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter workspace name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={createForm.description}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter workspace description"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Settings</Label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={createForm.settings.public_orders}
                        onChange={(e) => setCreateForm(prev => ({
                          ...prev,
                          settings: { ...prev.settings, public_orders: e.target.checked }
                        }))}
                      />
                      <span className="text-sm">Public orders</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={createForm.settings.require_approval}
                        onChange={(e) => setCreateForm(prev => ({
                          ...prev,
                          settings: { ...prev.settings, require_approval: e.target.checked }
                        }))}
                      />
                      <span className="text-sm">Require approval for new members</span>
                    </label>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Member Management Modal */}
      {showMemberManagement && selectedWorkspace && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Manage Members - {selectedWorkspace.name}</CardTitle>
                <Button
                  variant="outline"
                  onClick={() => setShowInviteForm(true)}
                  className="flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Invite Member
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {workspaceMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                          {member.user?.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${getPresenceColor(member.presence_status || 'offline')}`}></div>
                      </div>
                      <div>
                        <div className="font-semibold">{member.user?.name || member.user?.email}</div>
                        <div className="text-sm text-gray-600">{member.user?.email}</div>
                        <div className="flex items-center gap-2 mt-1">
                          {getRoleIcon(member.role)}
                          <span className="text-sm capitalize">{member.role}</span>
                          {getStatusIcon(member.status)}
                          <span className="text-sm capitalize">{member.status}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end mt-6">
                <Button onClick={() => setShowMemberManagement(false)}>
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Invite Member</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleInviteMember} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter email address"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <select
                    id="role"
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm(prev => ({ ...prev, role: e.target.value as WorkspaceRole }))}
                    className="w-full p-2 border border-gray-300 rounded"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowInviteForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Send Invite</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default WorkspaceManager;
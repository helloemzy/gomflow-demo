// GOMFLOW Workspace Management
// Shared workspace management for collaborative order management

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import {
  Workspace,
  WorkspaceMember,
  WorkspaceRole,
  MemberStatus,
  WorkspaceSettings,
  WorkspaceInvitation,
  CollaborativeOrder,
  ApiResponse,
  PaginatedResponse,
  ValidationError,
  WorkspacePermissions
} from './types';

class WorkspaceManager {
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  // ============================================================================
  // WORKSPACE MANAGEMENT
  // ============================================================================

  async createWorkspace(data: {
    name: string;
    description?: string;
    owner_id: string;
    settings?: Partial<WorkspaceSettings>;
  }): Promise<ApiResponse<Workspace>> {
    try {
      const { name, description, owner_id, settings } = data;

      // Validate input
      const validation = this.validateWorkspaceData(data);
      if (validation.length > 0) {
        return {
          success: false,
          error: 'VALIDATION_ERROR',
          message: validation[0].message
        };
      }

      // Generate unique slug
      const slug = await this.generateUniqueSlug(name);

      // Default settings
      const defaultSettings: WorkspaceSettings = {
        auto_invite: false,
        public_orders: true,
        require_approval: true,
        default_role: 'viewer'
      };

      // Create workspace
      const { data: workspace, error } = await this.supabase
        .from('workspaces')
        .insert({
          name,
          description,
          owner_id,
          slug,
          settings: { ...defaultSettings, ...settings }
        })
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: 'CREATE_WORKSPACE_ERROR',
          message: error.message
        };
      }

      // Add owner as member
      await this.addMemberToWorkspace(workspace.id, owner_id, 'owner', {
        can_create_orders: true,
        can_edit_orders: true,
        can_delete_orders: true,
        can_view_analytics: true,
        can_manage_payments: true,
        can_invite_members: true,
        can_chat: true
      });

      // Log activity
      await this.logActivity({
        workspace_id: workspace.id,
        user_id: owner_id,
        activity_type: 'workspace_created',
        entity_type: 'workspace',
        entity_id: workspace.id,
        metadata: { name },
        description: `Created workspace: ${name}`
      });

      return {
        success: true,
        data: workspace
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  async getWorkspace(workspaceId: string, userId: string): Promise<ApiResponse<Workspace>> {
    try {
      // Check if user has access to workspace
      const hasAccess = await this.checkWorkspaceAccess(workspaceId, userId);
      if (!hasAccess) {
        return {
          success: false,
          error: 'ACCESS_DENIED',
          message: 'You do not have access to this workspace'
        };
      }

      // Get workspace with stats
      const { data: workspace, error } = await this.supabase
        .from('workspace_overview')
        .select('*')
        .eq('id', workspaceId)
        .single();

      if (error) {
        return {
          success: false,
          error: 'WORKSPACE_NOT_FOUND',
          message: 'Workspace not found'
        };
      }

      return {
        success: true,
        data: workspace
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  async updateWorkspace(
    workspaceId: string,
    userId: string,
    updates: Partial<Workspace>
  ): Promise<ApiResponse<Workspace>> {
    try {
      // Check if user can update workspace
      const canUpdate = await this.checkWorkspacePermission(workspaceId, userId, 'can_manage_workspace');
      if (!canUpdate) {
        return {
          success: false,
          error: 'PERMISSION_DENIED',
          message: 'You do not have permission to update this workspace'
        };
      }

      // Update workspace
      const { data: workspace, error } = await this.supabase
        .from('workspaces')
        .update(updates)
        .eq('id', workspaceId)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: 'UPDATE_WORKSPACE_ERROR',
          message: error.message
        };
      }

      // Log activity
      await this.logActivity({
        workspace_id: workspaceId,
        user_id: userId,
        activity_type: 'workspace_updated',
        entity_type: 'workspace',
        entity_id: workspaceId,
        metadata: { changes: updates },
        description: `Updated workspace: ${workspace.name}`
      });

      return {
        success: true,
        data: workspace
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  async deleteWorkspace(workspaceId: string, userId: string): Promise<ApiResponse<void>> {
    try {
      // Check if user is owner
      const { data: workspace, error } = await this.supabase
        .from('workspaces')
        .select('owner_id')
        .eq('id', workspaceId)
        .single();

      if (error || workspace.owner_id !== userId) {
        return {
          success: false,
          error: 'PERMISSION_DENIED',
          message: 'Only the workspace owner can delete the workspace'
        };
      }

      // Delete workspace (cascade will handle related data)
      const { error: deleteError } = await this.supabase
        .from('workspaces')
        .delete()
        .eq('id', workspaceId);

      if (deleteError) {
        return {
          success: false,
          error: 'DELETE_WORKSPACE_ERROR',
          message: deleteError.message
        };
      }

      return {
        success: true,
        message: 'Workspace deleted successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  async getUserWorkspaces(userId: string): Promise<ApiResponse<Workspace[]>> {
    try {
      const { data: workspaces, error } = await this.supabase
        .from('workspace_overview')
        .select('*')
        .eq('workspace_members.user_id', userId)
        .eq('workspace_members.status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        return {
          success: false,
          error: 'GET_WORKSPACES_ERROR',
          message: error.message
        };
      }

      return {
        success: true,
        data: workspaces || []
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  // ============================================================================
  // MEMBER MANAGEMENT
  // ============================================================================

  async addMemberToWorkspace(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
    permissions?: WorkspacePermissions
  ): Promise<ApiResponse<WorkspaceMember>> {
    try {
      // Get default permissions for role
      const defaultPermissions = this.getDefaultPermissions(role);

      // Create member
      const { data: member, error } = await this.supabase
        .from('workspace_members')
        .insert({
          workspace_id: workspaceId,
          user_id: userId,
          role,
          status: 'active',
          permissions: permissions || defaultPermissions,
          joined_at: new Date().toISOString()
        })
        .select(`
          *,
          user:users(id, name, username, email)
        `)
        .single();

      if (error) {
        return {
          success: false,
          error: 'ADD_MEMBER_ERROR',
          message: error.message
        };
      }

      return {
        success: true,
        data: member
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  async updateMemberRole(
    workspaceId: string,
    memberId: string,
    newRole: WorkspaceRole,
    updatedBy: string
  ): Promise<ApiResponse<WorkspaceMember>> {
    try {
      // Check if user can update member roles
      const canUpdate = await this.checkWorkspacePermission(workspaceId, updatedBy, 'can_manage_members');
      if (!canUpdate) {
        return {
          success: false,
          error: 'PERMISSION_DENIED',
          message: 'You do not have permission to update member roles'
        };
      }

      // Get new permissions for role
      const newPermissions = this.getDefaultPermissions(newRole);

      // Update member
      const { data: member, error } = await this.supabase
        .from('workspace_members')
        .update({
          role: newRole,
          permissions: newPermissions
        })
        .eq('id', memberId)
        .eq('workspace_id', workspaceId)
        .select(`
          *,
          user:users(id, name, username, email)
        `)
        .single();

      if (error) {
        return {
          success: false,
          error: 'UPDATE_MEMBER_ERROR',
          message: error.message
        };
      }

      // Log activity
      await this.logActivity({
        workspace_id: workspaceId,
        user_id: updatedBy,
        activity_type: 'member_role_changed',
        entity_type: 'member',
        entity_id: memberId,
        metadata: { new_role: newRole },
        description: `Updated member role to ${newRole}`
      });

      return {
        success: true,
        data: member
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  async removeMemberFromWorkspace(
    workspaceId: string,
    memberId: string,
    removedBy: string
  ): Promise<ApiResponse<void>> {
    try {
      // Check if user can remove members
      const canRemove = await this.checkWorkspacePermission(workspaceId, removedBy, 'can_manage_members');
      if (!canRemove) {
        return {
          success: false,
          error: 'PERMISSION_DENIED',
          message: 'You do not have permission to remove members'
        };
      }

      // Update member status to left
      const { error } = await this.supabase
        .from('workspace_members')
        .update({ status: 'left' })
        .eq('id', memberId)
        .eq('workspace_id', workspaceId);

      if (error) {
        return {
          success: false,
          error: 'REMOVE_MEMBER_ERROR',
          message: error.message
        };
      }

      // Log activity
      await this.logActivity({
        workspace_id: workspaceId,
        user_id: removedBy,
        activity_type: 'member_removed',
        entity_type: 'member',
        entity_id: memberId,
        metadata: {},
        description: 'Removed member from workspace'
      });

      return {
        success: true,
        message: 'Member removed successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  async getWorkspaceMembers(
    workspaceId: string,
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<ApiResponse<PaginatedResponse<WorkspaceMember>>> {
    try {
      // Check if user has access to workspace
      const hasAccess = await this.checkWorkspaceAccess(workspaceId, userId);
      if (!hasAccess) {
        return {
          success: false,
          error: 'ACCESS_DENIED',
          message: 'You do not have access to this workspace'
        };
      }

      const offset = (page - 1) * limit;

      // Get members with user data and presence
      const { data: members, error, count } = await this.supabase
        .from('member_presence')
        .select(`
          *,
          user:users(id, name, username, email)
        `)
        .eq('workspace_id', workspaceId)
        .eq('member_status', 'active')
        .order('last_active_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        return {
          success: false,
          error: 'GET_MEMBERS_ERROR',
          message: error.message
        };
      }

      const total = count || 0;
      const totalPages = Math.ceil(total / limit);

      return {
        success: true,
        data: {
          data: members || [],
          pagination: {
            page,
            limit,
            total,
            total_pages: totalPages,
            has_next: page < totalPages,
            has_prev: page > 1
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  // ============================================================================
  // INVITATION MANAGEMENT
  // ============================================================================

  async inviteToWorkspace(
    workspaceId: string,
    email: string,
    role: WorkspaceRole,
    invitedBy: string
  ): Promise<ApiResponse<WorkspaceInvitation>> {
    try {
      // Check if user can invite members
      const canInvite = await this.checkWorkspacePermission(workspaceId, invitedBy, 'can_invite_members');
      if (!canInvite) {
        return {
          success: false,
          error: 'PERMISSION_DENIED',
          message: 'You do not have permission to invite members'
        };
      }

      // Check if user is already a member
      const { data: existingMember } = await this.supabase
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('user_id', email) // Assuming email lookup
        .single();

      if (existingMember) {
        return {
          success: false,
          error: 'ALREADY_MEMBER',
          message: 'User is already a member of this workspace'
        };
      }

      // Generate invitation token
      const token = uuidv4();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Create invitation
      const { data: invitation, error } = await this.supabase
        .from('workspace_invitations')
        .insert({
          workspace_id: workspaceId,
          email,
          invited_by: invitedBy,
          role,
          token,
          expires_at: expiresAt.toISOString()
        })
        .select(`
          *,
          inviter:users!invited_by(id, name, username, email),
          workspace:workspaces(id, name, description)
        `)
        .single();

      if (error) {
        return {
          success: false,
          error: 'CREATE_INVITATION_ERROR',
          message: error.message
        };
      }

      // TODO: Send invitation email

      return {
        success: true,
        data: invitation
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  async acceptInvitation(token: string, userId: string): Promise<ApiResponse<WorkspaceMember>> {
    try {
      // Get invitation
      const { data: invitation, error } = await this.supabase
        .from('workspace_invitations')
        .select('*')
        .eq('token', token)
        .is('used_at', null)
        .single();

      if (error || !invitation) {
        return {
          success: false,
          error: 'INVALID_INVITATION',
          message: 'Invalid or expired invitation'
        };
      }

      // Check if invitation is expired
      if (new Date(invitation.expires_at) < new Date()) {
        return {
          success: false,
          error: 'INVITATION_EXPIRED',
          message: 'Invitation has expired'
        };
      }

      // Add user to workspace
      const memberResult = await this.addMemberToWorkspace(
        invitation.workspace_id,
        userId,
        invitation.role
      );

      if (!memberResult.success) {
        return memberResult;
      }

      // Mark invitation as used
      await this.supabase
        .from('workspace_invitations')
        .update({
          used_at: new Date().toISOString(),
          used_by: userId
        })
        .eq('id', invitation.id);

      // Log activity
      await this.logActivity({
        workspace_id: invitation.workspace_id,
        user_id: userId,
        activity_type: 'member_added',
        entity_type: 'member',
        entity_id: memberResult.data!.id,
        metadata: { role: invitation.role },
        description: 'Accepted workspace invitation'
      });

      return memberResult;
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  // ============================================================================
  // COLLABORATIVE ORDERS
  // ============================================================================

  async addOrderToWorkspace(
    orderId: string,
    workspaceId: string,
    userId: string
  ): Promise<ApiResponse<CollaborativeOrder>> {
    try {
      // Check if user can create orders
      const canCreate = await this.checkWorkspacePermission(workspaceId, userId, 'can_create_orders');
      if (!canCreate) {
        return {
          success: false,
          error: 'PERMISSION_DENIED',
          message: 'You do not have permission to create orders in this workspace'
        };
      }

      // Create collaborative order
      const { data: collaborativeOrder, error } = await this.supabase
        .from('collaborative_orders')
        .insert({
          order_id: orderId,
          workspace_id: workspaceId,
          last_edited_by: userId,
          version: 1
        })
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: 'ADD_ORDER_ERROR',
          message: error.message
        };
      }

      return {
        success: true,
        data: collaborativeOrder
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  async getWorkspaceOrders(
    workspaceId: string,
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<ApiResponse<PaginatedResponse<any>>> {
    try {
      // Check if user has access to workspace
      const hasAccess = await this.checkWorkspaceAccess(workspaceId, userId);
      if (!hasAccess) {
        return {
          success: false,
          error: 'ACCESS_DENIED',
          message: 'You do not have access to this workspace'
        };
      }

      const offset = (page - 1) * limit;

      // Get orders with collaborative data
      const { data: orders, error, count } = await this.supabase
        .from('collaborative_orders')
        .select(`
          *,
          order:orders(*),
          last_editor:users!last_edited_by(id, name, username)
        `)
        .eq('workspace_id', workspaceId)
        .order('last_edited_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        return {
          success: false,
          error: 'GET_ORDERS_ERROR',
          message: error.message
        };
      }

      const total = count || 0;
      const totalPages = Math.ceil(total / limit);

      return {
        success: true,
        data: {
          data: orders || [],
          pagination: {
            page,
            limit,
            total,
            total_pages: totalPages,
            has_next: page < totalPages,
            has_prev: page > 1
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private async generateUniqueSlug(name: string): Promise<string> {
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const { data: existing } = await this.supabase
        .from('workspaces')
        .select('id')
        .eq('slug', slug)
        .single();

      if (!existing) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  private validateWorkspaceData(data: any): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!data.name || data.name.trim().length < 3) {
      errors.push({
        field: 'name',
        message: 'Workspace name must be at least 3 characters long',
        code: 'INVALID_NAME'
      });
    }

    if (!data.owner_id) {
      errors.push({
        field: 'owner_id',
        message: 'Owner ID is required',
        code: 'MISSING_OWNER'
      });
    }

    return errors;
  }

  private getDefaultPermissions(role: WorkspaceRole): WorkspacePermissions {
    switch (role) {
      case 'owner':
        return {
          can_create_orders: true,
          can_edit_orders: true,
          can_delete_orders: true,
          can_view_analytics: true,
          can_manage_payments: true,
          can_invite_members: true,
          can_chat: true
        };
      case 'admin':
        return {
          can_create_orders: true,
          can_edit_orders: true,
          can_delete_orders: true,
          can_view_analytics: true,
          can_manage_payments: true,
          can_invite_members: true,
          can_chat: true
        };
      case 'editor':
        return {
          can_create_orders: true,
          can_edit_orders: true,
          can_delete_orders: false,
          can_view_analytics: true,
          can_manage_payments: false,
          can_invite_members: false,
          can_chat: true
        };
      case 'viewer':
        return {
          can_create_orders: false,
          can_edit_orders: false,
          can_delete_orders: false,
          can_view_analytics: false,
          can_manage_payments: false,
          can_invite_members: false,
          can_chat: true
        };
      default:
        return {
          can_create_orders: false,
          can_edit_orders: false,
          can_delete_orders: false,
          can_view_analytics: false,
          can_manage_payments: false,
          can_invite_members: false,
          can_chat: false
        };
    }
  }

  private async checkWorkspaceAccess(workspaceId: string, userId: string): Promise<boolean> {
    const { data: member } = await this.supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    return !!member;
  }

  private async checkWorkspacePermission(
    workspaceId: string,
    userId: string,
    permission: keyof WorkspacePermissions
  ): Promise<boolean> {
    const { data: result } = await this.supabase
      .rpc('check_workspace_permission', {
        user_uuid: userId,
        workspace_uuid: workspaceId,
        permission_name: permission
      });

    return result || false;
  }

  private async logActivity(data: {
    workspace_id: string;
    user_id: string;
    activity_type: string;
    entity_type: string;
    entity_id: string;
    metadata: Record<string, any>;
    description: string;
  }): Promise<void> {
    await this.supabase.rpc('log_workspace_activity', {
      workspace_uuid: data.workspace_id,
      user_uuid: data.user_id,
      activity_type: data.activity_type,
      entity_type: data.entity_type,
      entity_uuid: data.entity_id,
      metadata: data.metadata,
      description: data.description
    });
  }
}

export default WorkspaceManager;
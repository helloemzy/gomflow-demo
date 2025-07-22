// GOMFLOW Role-Based Permissions
// Access control system for collaborative workspaces

import { createClient } from '@supabase/supabase-js';
import {
  WorkspaceRole,
  WorkspacePermissions,
  WorkspaceMember,
  ApiResponse
} from './types';

interface PermissionCheck {
  permission: keyof WorkspacePermissions;
  resource?: string;
  resourceId?: string;
}

interface PermissionResult {
  allowed: boolean;
  reason?: string;
  requiredRole?: WorkspaceRole;
}

class PermissionManager {
  private supabase: ReturnType<typeof createClient>;
  private permissionCache: Map<string, { permissions: WorkspacePermissions; expires: Date }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  // ============================================================================
  // PERMISSION CHECKING
  // ============================================================================

  async checkPermission(
    userId: string,
    workspaceId: string,
    permission: keyof WorkspacePermissions,
    resourceId?: string
  ): Promise<PermissionResult> {
    try {
      // Get user's permissions in workspace
      const userPermissions = await this.getUserPermissions(userId, workspaceId);
      
      if (!userPermissions) {
        return {
          allowed: false,
          reason: 'User is not a member of this workspace'
        };
      }

      // Check basic permission
      const hasPermission = userPermissions.permissions[permission];
      
      if (!hasPermission) {
        return {
          allowed: false,
          reason: `Permission denied: ${permission}`,
          requiredRole: this.getRequiredRoleForPermission(permission)
        };
      }

      // Check resource-specific permissions
      if (resourceId) {
        const resourcePermission = await this.checkResourcePermission(
          userId,
          workspaceId,
          permission,
          resourceId
        );
        
        if (!resourcePermission.allowed) {
          return resourcePermission;
        }
      }

      return {
        allowed: true
      };
    } catch (error) {
      return {
        allowed: false,
        reason: 'Error checking permission'
      };
    }
  }

  async checkMultiplePermissions(
    userId: string,
    workspaceId: string,
    permissions: PermissionCheck[]
  ): Promise<Record<string, PermissionResult>> {
    const results: Record<string, PermissionResult> = {};
    
    for (const check of permissions) {
      const key = `${check.permission}_${check.resource || 'default'}_${check.resourceId || ''}`;
      results[key] = await this.checkPermission(
        userId,
        workspaceId,
        check.permission,
        check.resourceId
      );
    }
    
    return results;
  }

  async canUserAccessWorkspace(userId: string, workspaceId: string): Promise<boolean> {
    try {
      const { data: member } = await this.supabase
        .from('workspace_members')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      return !!member;
    } catch (error) {
      return false;
    }
  }

  async canUserEditOrder(userId: string, workspaceId: string, orderId: string): Promise<boolean> {
    try {
      // Check basic edit permission
      const editPermission = await this.checkPermission(userId, workspaceId, 'can_edit_orders');
      if (!editPermission.allowed) {
        return false;
      }

      // Check if order is locked by another user
      const { data: collaborativeOrder } = await this.supabase
        .from('collaborative_orders')
        .select('edit_lock_user_id, edit_lock_expires_at')
        .eq('order_id', orderId)
        .eq('workspace_id', workspaceId)
        .single();

      if (collaborativeOrder?.edit_lock_user_id) {
        // Check if lock is expired
        const lockExpires = new Date(collaborativeOrder.edit_lock_expires_at);
        const now = new Date();
        
        if (lockExpires > now && collaborativeOrder.edit_lock_user_id !== userId) {
          return false;
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  async canUserDeleteOrder(userId: string, workspaceId: string, orderId: string): Promise<boolean> {
    try {
      // Check basic delete permission
      const deletePermission = await this.checkPermission(userId, workspaceId, 'can_delete_orders');
      if (!deletePermission.allowed) {
        return false;
      }

      // Check if user is order owner or admin/owner
      const { data: order } = await this.supabase
        .from('orders')
        .select('user_id')
        .eq('id', orderId)
        .single();

      if (order?.user_id === userId) {
        return true;
      }

      // Check if user is admin or owner
      const userPermissions = await this.getUserPermissions(userId, workspaceId);
      return userPermissions?.role === 'admin' || userPermissions?.role === 'owner';
    } catch (error) {
      return false;
    }
  }

  // ============================================================================
  // ROLE MANAGEMENT
  // ============================================================================

  async updateUserRole(
    targetUserId: string,
    workspaceId: string,
    newRole: WorkspaceRole,
    updatedBy: string
  ): Promise<ApiResponse<WorkspaceMember>> {
    try {
      // Check if updater has permission to manage roles
      const canManageRoles = await this.checkPermission(updatedBy, workspaceId, 'can_invite_members');
      if (!canManageRoles.allowed) {
        return {
          success: false,
          error: 'PERMISSION_DENIED',
          message: 'You do not have permission to manage roles'
        };
      }

      // Get updater's role
      const updaterPermissions = await this.getUserPermissions(updatedBy, workspaceId);
      const targetPermissions = await this.getUserPermissions(targetUserId, workspaceId);

      if (!updaterPermissions || !targetPermissions) {
        return {
          success: false,
          error: 'USER_NOT_FOUND',
          message: 'User not found in workspace'
        };
      }

      // Role hierarchy check
      const canUpdateRole = this.canUpdateUserRole(
        updaterPermissions.role,
        targetPermissions.role,
        newRole
      );

      if (!canUpdateRole.allowed) {
        return {
          success: false,
          error: 'ROLE_HIERARCHY_ERROR',
          message: canUpdateRole.reason
        };
      }

      // Update role and permissions
      const newPermissions = this.getDefaultPermissions(newRole);
      
      const { data: updatedMember, error } = await this.supabase
        .from('workspace_members')
        .update({
          role: newRole,
          permissions: newPermissions
        })
        .eq('user_id', targetUserId)
        .eq('workspace_id', workspaceId)
        .select(`
          *,
          user:users(id, name, username, email)
        `)
        .single();

      if (error) {
        return {
          success: false,
          error: 'UPDATE_ROLE_ERROR',
          message: error.message
        };
      }

      // Clear cache
      this.clearPermissionCache(targetUserId, workspaceId);

      return {
        success: true,
        data: updatedMember
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  async updateUserPermissions(
    targetUserId: string,
    workspaceId: string,
    newPermissions: Partial<WorkspacePermissions>,
    updatedBy: string
  ): Promise<ApiResponse<WorkspaceMember>> {
    try {
      // Check if updater has permission to manage permissions
      const canManagePermissions = await this.checkPermission(updatedBy, workspaceId, 'can_invite_members');
      if (!canManagePermissions.allowed) {
        return {
          success: false,
          error: 'PERMISSION_DENIED',
          message: 'You do not have permission to manage permissions'
        };
      }

      // Get current permissions
      const currentPermissions = await this.getUserPermissions(targetUserId, workspaceId);
      if (!currentPermissions) {
        return {
          success: false,
          error: 'USER_NOT_FOUND',
          message: 'User not found in workspace'
        };
      }

      // Merge permissions
      const mergedPermissions = {
        ...currentPermissions.permissions,
        ...newPermissions
      };

      // Update permissions
      const { data: updatedMember, error } = await this.supabase
        .from('workspace_members')
        .update({
          permissions: mergedPermissions
        })
        .eq('user_id', targetUserId)
        .eq('workspace_id', workspaceId)
        .select(`
          *,
          user:users(id, name, username, email)
        `)
        .single();

      if (error) {
        return {
          success: false,
          error: 'UPDATE_PERMISSIONS_ERROR',
          message: error.message
        };
      }

      // Clear cache
      this.clearPermissionCache(targetUserId, workspaceId);

      return {
        success: true,
        data: updatedMember
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
  // PERMISSION TEMPLATES
  // ============================================================================

  getDefaultPermissions(role: WorkspaceRole): WorkspacePermissions {
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

  getCustomPermissionTemplate(templateName: string): WorkspacePermissions {
    switch (templateName) {
      case 'content_manager':
        return {
          can_create_orders: true,
          can_edit_orders: true,
          can_delete_orders: false,
          can_view_analytics: true,
          can_manage_payments: false,
          can_invite_members: false,
          can_chat: true
        };
      case 'financial_manager':
        return {
          can_create_orders: false,
          can_edit_orders: false,
          can_delete_orders: false,
          can_view_analytics: true,
          can_manage_payments: true,
          can_invite_members: false,
          can_chat: true
        };
      case 'community_manager':
        return {
          can_create_orders: false,
          can_edit_orders: false,
          can_delete_orders: false,
          can_view_analytics: false,
          can_manage_payments: false,
          can_invite_members: true,
          can_chat: true
        };
      default:
        return this.getDefaultPermissions('viewer');
    }
  }

  // ============================================================================
  // PERMISSION UTILITIES
  // ============================================================================

  async getUserPermissions(
    userId: string,
    workspaceId: string
  ): Promise<{ role: WorkspaceRole; permissions: WorkspacePermissions; status: string } | null> {
    try {
      // Check cache first
      const cacheKey = `${userId}:${workspaceId}`;
      const cached = this.permissionCache.get(cacheKey);
      
      if (cached && cached.expires > new Date()) {
        return {
          role: 'viewer', // We don't cache role for simplicity
          permissions: cached.permissions,
          status: 'active'
        };
      }

      // Get from database
      const { data: member, error } = await this.supabase
        .from('workspace_members')
        .select('role, permissions, status')
        .eq('user_id', userId)
        .eq('workspace_id', workspaceId)
        .eq('status', 'active')
        .single();

      if (error || !member) {
        return null;
      }

      // Cache the result
      this.permissionCache.set(cacheKey, {
        permissions: member.permissions,
        expires: new Date(Date.now() + this.CACHE_DURATION)
      });

      return {
        role: member.role,
        permissions: member.permissions,
        status: member.status
      };
    } catch (error) {
      return null;
    }
  }

  private async checkResourcePermission(
    userId: string,
    workspaceId: string,
    permission: keyof WorkspacePermissions,
    resourceId: string
  ): Promise<PermissionResult> {
    // For now, we'll implement basic resource-specific checks
    // This can be extended for more complex resource permissions
    
    if (permission === 'can_edit_orders' || permission === 'can_delete_orders') {
      return await this.checkOrderPermission(userId, workspaceId, resourceId, permission);
    }

    return { allowed: true };
  }

  private async checkOrderPermission(
    userId: string,
    workspaceId: string,
    orderId: string,
    permission: 'can_edit_orders' | 'can_delete_orders'
  ): Promise<PermissionResult> {
    try {
      // Check if user created the order
      const { data: order } = await this.supabase
        .from('orders')
        .select('user_id')
        .eq('id', orderId)
        .single();

      if (order?.user_id === userId) {
        return { allowed: true };
      }

      // Check if user has admin/owner privileges
      const userPermissions = await this.getUserPermissions(userId, workspaceId);
      if (userPermissions?.role === 'admin' || userPermissions?.role === 'owner') {
        return { allowed: true };
      }

      // For delete permission, only allow if user is admin/owner
      if (permission === 'can_delete_orders') {
        return {
          allowed: false,
          reason: 'Only order creators, admins, and owners can delete orders'
        };
      }

      return { allowed: true };
    } catch (error) {
      return {
        allowed: false,
        reason: 'Error checking order permission'
      };
    }
  }

  private getRequiredRoleForPermission(permission: keyof WorkspacePermissions): WorkspaceRole {
    switch (permission) {
      case 'can_create_orders':
        return 'editor';
      case 'can_edit_orders':
        return 'editor';
      case 'can_delete_orders':
        return 'admin';
      case 'can_view_analytics':
        return 'editor';
      case 'can_manage_payments':
        return 'admin';
      case 'can_invite_members':
        return 'admin';
      case 'can_chat':
        return 'viewer';
      default:
        return 'viewer';
    }
  }

  private canUpdateUserRole(
    updaterRole: WorkspaceRole,
    targetRole: WorkspaceRole,
    newRole: WorkspaceRole
  ): { allowed: boolean; reason?: string } {
    const roleHierarchy = {
      viewer: 0,
      editor: 1,
      admin: 2,
      owner: 3
    };

    const updaterLevel = roleHierarchy[updaterRole];
    const targetLevel = roleHierarchy[targetRole];
    const newLevel = roleHierarchy[newRole];

    // Owner can do anything
    if (updaterRole === 'owner') {
      return { allowed: true };
    }

    // Can't update someone with same or higher role
    if (targetLevel >= updaterLevel) {
      return {
        allowed: false,
        reason: 'Cannot update users with same or higher role'
      };
    }

    // Can't assign higher role than own
    if (newLevel >= updaterLevel) {
      return {
        allowed: false,
        reason: 'Cannot assign higher role than your own'
      };
    }

    return { allowed: true };
  }

  private clearPermissionCache(userId: string, workspaceId: string): void {
    const cacheKey = `${userId}:${workspaceId}`;
    this.permissionCache.delete(cacheKey);
  }

  // ============================================================================
  // PERMISSION AUDITING
  // ============================================================================

  async auditPermissions(workspaceId: string, userId: string): Promise<ApiResponse<any>> {
    try {
      // Check if user has admin privileges
      const canAudit = await this.checkPermission(userId, workspaceId, 'can_invite_members');
      if (!canAudit.allowed) {
        return {
          success: false,
          error: 'PERMISSION_DENIED',
          message: 'You do not have permission to audit permissions'
        };
      }

      // Get all workspace members with their permissions
      const { data: members, error } = await this.supabase
        .from('workspace_members')
        .select(`
          *,
          user:users(id, name, username, email)
        `)
        .eq('workspace_id', workspaceId)
        .eq('status', 'active');

      if (error) {
        return {
          success: false,
          error: 'AUDIT_ERROR',
          message: error.message
        };
      }

      // Analyze permissions
      const audit = {
        total_members: members?.length || 0,
        role_distribution: this.analyzeRoleDistribution(members || []),
        permission_analysis: this.analyzePermissions(members || []),
        security_concerns: this.identifySecurityConcerns(members || [])
      };

      return {
        success: true,
        data: audit
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  private analyzeRoleDistribution(members: any[]): Record<WorkspaceRole, number> {
    const distribution: Record<WorkspaceRole, number> = {
      owner: 0,
      admin: 0,
      editor: 0,
      viewer: 0
    };

    members.forEach(member => {
      distribution[member.role]++;
    });

    return distribution;
  }

  private analyzePermissions(members: any[]): any {
    const permissionCount: Record<keyof WorkspacePermissions, number> = {
      can_create_orders: 0,
      can_edit_orders: 0,
      can_delete_orders: 0,
      can_view_analytics: 0,
      can_manage_payments: 0,
      can_invite_members: 0,
      can_chat: 0
    };

    members.forEach(member => {
      Object.keys(member.permissions).forEach(permission => {
        if (member.permissions[permission]) {
          permissionCount[permission as keyof WorkspacePermissions]++;
        }
      });
    });

    return permissionCount;
  }

  private identifySecurityConcerns(members: any[]): string[] {
    const concerns: string[] = [];

    const adminCount = members.filter(m => m.role === 'admin').length;
    const ownerCount = members.filter(m => m.role === 'owner').length;

    if (ownerCount > 1) {
      concerns.push('Multiple owners detected');
    }

    if (adminCount > 5) {
      concerns.push('High number of admins');
    }

    const deletePermissionCount = members.filter(m => m.permissions.can_delete_orders).length;
    if (deletePermissionCount > 10) {
      concerns.push('Many users have delete permissions');
    }

    return concerns;
  }

  public clearAllCache(): void {
    this.permissionCache.clear();
  }
}

export default PermissionManager;
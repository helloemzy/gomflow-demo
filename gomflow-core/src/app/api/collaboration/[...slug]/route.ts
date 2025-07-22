// GOMFLOW Collaboration API Routes
// RESTful API endpoints for collaboration features

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import WorkspaceManager from '@/lib/collaboration/workspace';
import PresenceManager from '@/lib/collaboration/presence';
import OperationalTransformManager from '@/lib/collaboration/operations';
import PermissionManager from '@/lib/collaboration/permissions';
import ActivityManager from '@/lib/collaboration/activity';
import ChatManager from '@/lib/collaboration/chat';
import {
  ApiResponse,
  WorkspaceRole,
  WorkspacePermissions,
  ActivityType,
  ChatMessageType,
  PresenceStatus
} from '@/lib/collaboration/types';

// Initialize managers
const workspaceManager = new WorkspaceManager();
const presenceManager = new PresenceManager();
const operationManager = new OperationalTransformManager();
const permissionManager = new PermissionManager();
const activityManager = new ActivityManager();
const chatManager = new ChatManager();

// Helper function to authenticate requests
async function authenticateRequest(request: NextRequest): Promise<string | null> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    return decoded.userId;
  } catch (error) {
    return null;
  }
}

// Helper function to create error response
function createErrorResponse(message: string, status: number = 400): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status });
}

// Helper function to create success response
function createSuccessResponse(data: any, status: number = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

// ============================================================================
// WORKSPACE ROUTES
// ============================================================================

async function handleWorkspaceRoutes(
  request: NextRequest,
  pathSegments: string[],
  userId: string
): Promise<NextResponse> {
  const method = request.method;
  const action = pathSegments[1];

  try {
    switch (action) {
      case 'create':
        if (method === 'POST') {
          const body = await request.json();
          const result = await workspaceManager.createWorkspace({
            name: body.name,
            description: body.description,
            owner_id: userId,
            settings: body.settings
          });
          return result.success
            ? createSuccessResponse(result.data, 201)
            : createErrorResponse(result.message || 'Failed to create workspace');
        }
        break;

      case 'list':
        if (method === 'GET') {
          const result = await workspaceManager.getUserWorkspaces(userId);
          return result.success
            ? createSuccessResponse(result.data)
            : createErrorResponse(result.message || 'Failed to get workspaces');
        }
        break;

      default:
        // Handle specific workspace operations
        const workspaceId = action;
        const subAction = pathSegments[2];

        if (!subAction) {
          // Get workspace details
          if (method === 'GET') {
            const result = await workspaceManager.getWorkspace(workspaceId, userId);
            return result.success
              ? createSuccessResponse(result.data)
              : createErrorResponse(result.message || 'Failed to get workspace');
          }
          // Update workspace
          if (method === 'PUT') {
            const body = await request.json();
            const result = await workspaceManager.updateWorkspace(workspaceId, userId, body);
            return result.success
              ? createSuccessResponse(result.data)
              : createErrorResponse(result.message || 'Failed to update workspace');
          }
          // Delete workspace
          if (method === 'DELETE') {
            const result = await workspaceManager.deleteWorkspace(workspaceId, userId);
            return result.success
              ? createSuccessResponse(null, 204)
              : createErrorResponse(result.message || 'Failed to delete workspace');
          }
        } else {
          // Handle workspace sub-actions
          return await handleWorkspaceSubActions(request, workspaceId, subAction, pathSegments, userId);
        }
    }
  } catch (error) {
    console.error('Workspace route error:', error);
    return createErrorResponse('Internal server error', 500);
  }

  return createErrorResponse('Not found', 404);
}

async function handleWorkspaceSubActions(
  request: NextRequest,
  workspaceId: string,
  subAction: string,
  pathSegments: string[],
  userId: string
): Promise<NextResponse> {
  const method = request.method;

  switch (subAction) {
    case 'members':
      if (method === 'GET') {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '20');
        
        const result = await workspaceManager.getWorkspaceMembers(workspaceId, userId, page, limit);
        return result.success
          ? createSuccessResponse(result.data)
          : createErrorResponse(result.message || 'Failed to get members');
      }
      break;

    case 'invite':
      if (method === 'POST') {
        const body = await request.json();
        const result = await workspaceManager.inviteToWorkspace(
          workspaceId,
          body.email,
          body.role,
          userId
        );
        return result.success
          ? createSuccessResponse(result.data, 201)
          : createErrorResponse(result.message || 'Failed to send invitation');
      }
      break;

    case 'orders':
      if (method === 'GET') {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '20');
        
        const result = await workspaceManager.getWorkspaceOrders(workspaceId, userId, page, limit);
        return result.success
          ? createSuccessResponse(result.data)
          : createErrorResponse(result.message || 'Failed to get orders');
      }
      break;

    case 'stats':
      if (method === 'GET') {
        const result = await workspaceManager.getWorkspace(workspaceId, userId);
        return result.success
          ? createSuccessResponse(result.data)
          : createErrorResponse(result.message || 'Failed to get stats');
      }
      break;
  }

  return createErrorResponse('Not found', 404);
}

// ============================================================================
// PRESENCE ROUTES
// ============================================================================

async function handlePresenceRoutes(
  request: NextRequest,
  pathSegments: string[],
  userId: string
): Promise<NextResponse> {
  const method = request.method;
  const action = pathSegments[1];

  try {
    switch (action) {
      case 'update':
        if (method === 'POST') {
          const body = await request.json();
          const result = await presenceManager.updatePresence(
            userId,
            body.workspace_id,
            body.status,
            body.current_page,
            body.cursor_position,
            body.socket_id
          );
          return result.success
            ? createSuccessResponse(result.data)
            : createErrorResponse(result.message || 'Failed to update presence');
        }
        break;

      case 'workspace':
        const workspaceId = pathSegments[2];
        if (method === 'GET') {
          const result = await presenceManager.getWorkspacePresence(workspaceId, userId);
          return result.success
            ? createSuccessResponse(result.data)
            : createErrorResponse(result.message || 'Failed to get presence');
        }
        break;

      case 'active':
        const activeWorkspaceId = pathSegments[2];
        if (method === 'GET') {
          const url = new URL(request.url);
          const withinMinutes = parseInt(url.searchParams.get('within_minutes') || '5');
          
          const result = await presenceManager.getActiveUsers(activeWorkspaceId, withinMinutes);
          return result.success
            ? createSuccessResponse(result.data)
            : createErrorResponse(result.message || 'Failed to get active users');
        }
        break;

      case 'analytics':
        const analyticsWorkspaceId = pathSegments[2];
        if (method === 'GET') {
          const url = new URL(request.url);
          const days = parseInt(url.searchParams.get('days') || '7');
          
          const result = await presenceManager.getPresenceAnalytics(analyticsWorkspaceId, userId, days);
          return result.success
            ? createSuccessResponse(result.data)
            : createErrorResponse(result.message || 'Failed to get analytics');
        }
        break;
    }
  } catch (error) {
    console.error('Presence route error:', error);
    return createErrorResponse('Internal server error', 500);
  }

  return createErrorResponse('Not found', 404);
}

// ============================================================================
// OPERATIONS ROUTES
// ============================================================================

async function handleOperationsRoutes(
  request: NextRequest,
  pathSegments: string[],
  userId: string
): Promise<NextResponse> {
  const method = request.method;
  const action = pathSegments[1];

  try {
    switch (action) {
      case 'create':
        if (method === 'POST') {
          const body = await request.json();
          const result = await operationManager.createOperation(
            body.order_id,
            body.workspace_id,
            userId,
            body.operation,
            body.version
          );
          return result.success
            ? createSuccessResponse(result.data, 201)
            : createErrorResponse(result.message || 'Failed to create operation');
        }
        break;

      case 'apply':
        const transformId = pathSegments[2];
        if (method === 'POST') {
          const body = await request.json();
          const result = await operationManager.applyOperation(
            transformId,
            body.order_id,
            body.workspace_id
          );
          return result.success
            ? createSuccessResponse(result.data)
            : createErrorResponse(result.message || 'Failed to apply operation');
        }
        break;

      case 'history':
        const orderId = pathSegments[2];
        const workspaceId = pathSegments[3];
        if (method === 'GET') {
          const url = new URL(request.url);
          const limit = parseInt(url.searchParams.get('limit') || '50');
          
          const result = await operationManager.getOperationHistory(orderId, workspaceId, userId, limit);
          return result.success
            ? createSuccessResponse(result.data)
            : createErrorResponse(result.message || 'Failed to get history');
        }
        break;

      case 'cleanup':
        if (method === 'POST') {
          const body = await request.json();
          const result = await operationManager.cleanupOldOperations(body.days || 30);
          return result.success
            ? createSuccessResponse(null)
            : createErrorResponse(result.message || 'Failed to cleanup operations');
        }
        break;
    }
  } catch (error) {
    console.error('Operations route error:', error);
    return createErrorResponse('Internal server error', 500);
  }

  return createErrorResponse('Not found', 404);
}

// ============================================================================
// PERMISSIONS ROUTES
// ============================================================================

async function handlePermissionsRoutes(
  request: NextRequest,
  pathSegments: string[],
  userId: string
): Promise<NextResponse> {
  const method = request.method;
  const action = pathSegments[1];

  try {
    switch (action) {
      case 'check':
        if (method === 'POST') {
          const body = await request.json();
          const result = await permissionManager.checkPermission(
            userId,
            body.workspace_id,
            body.permission,
            body.resource_id
          );
          return createSuccessResponse(result);
        }
        break;

      case 'update-role':
        if (method === 'POST') {
          const body = await request.json();
          const result = await permissionManager.updateUserRole(
            body.target_user_id,
            body.workspace_id,
            body.new_role,
            userId
          );
          return result.success
            ? createSuccessResponse(result.data)
            : createErrorResponse(result.message || 'Failed to update role');
        }
        break;

      case 'update-permissions':
        if (method === 'POST') {
          const body = await request.json();
          const result = await permissionManager.updateUserPermissions(
            body.target_user_id,
            body.workspace_id,
            body.permissions,
            userId
          );
          return result.success
            ? createSuccessResponse(result.data)
            : createErrorResponse(result.message || 'Failed to update permissions');
        }
        break;

      case 'audit':
        const auditWorkspaceId = pathSegments[2];
        if (method === 'GET') {
          const result = await permissionManager.auditPermissions(auditWorkspaceId, userId);
          return result.success
            ? createSuccessResponse(result.data)
            : createErrorResponse(result.message || 'Failed to audit permissions');
        }
        break;
    }
  } catch (error) {
    console.error('Permissions route error:', error);
    return createErrorResponse('Internal server error', 500);
  }

  return createErrorResponse('Not found', 404);
}

// ============================================================================
// ACTIVITY ROUTES
// ============================================================================

async function handleActivityRoutes(
  request: NextRequest,
  pathSegments: string[],
  userId: string
): Promise<NextResponse> {
  const method = request.method;
  const action = pathSegments[1];

  try {
    switch (action) {
      case 'log':
        if (method === 'POST') {
          const body = await request.json();
          const result = await activityManager.logActivity({
            workspace_id: body.workspace_id,
            user_id: userId,
            activity_type: body.activity_type,
            entity_type: body.entity_type,
            entity_id: body.entity_id,
            metadata: body.metadata,
            description: body.description
          });
          return result.success
            ? createSuccessResponse(result.data, 201)
            : createErrorResponse(result.message || 'Failed to log activity');
        }
        break;

      case 'feed':
        const feedWorkspaceId = pathSegments[2];
        if (method === 'GET') {
          const url = new URL(request.url);
          const page = parseInt(url.searchParams.get('page') || '1');
          const limit = parseInt(url.searchParams.get('limit') || '50');
          
          // Parse filter parameters
          const filter: any = {};
          if (url.searchParams.get('activity_types')) {
            filter.activity_types = url.searchParams.get('activity_types')?.split(',');
          }
          if (url.searchParams.get('entity_types')) {
            filter.entity_types = url.searchParams.get('entity_types')?.split(',');
          }
          if (url.searchParams.get('start_date')) {
            filter.start_date = url.searchParams.get('start_date');
          }
          if (url.searchParams.get('end_date')) {
            filter.end_date = url.searchParams.get('end_date');
          }
          if (url.searchParams.get('is_read')) {
            filter.is_read = url.searchParams.get('is_read') === 'true';
          }
          
          const result = await activityManager.getActivityFeed(feedWorkspaceId, userId, page, limit, filter);
          return result.success
            ? createSuccessResponse(result.data)
            : createErrorResponse(result.message || 'Failed to get activity feed');
        }
        break;

      case 'mark-read':
        const activityId = pathSegments[2];
        if (method === 'POST') {
          const result = await activityManager.markActivityAsRead(activityId, userId);
          return result.success
            ? createSuccessResponse(result.data)
            : createErrorResponse(result.message || 'Failed to mark as read');
        }
        break;

      case 'mark-all-read':
        const markAllWorkspaceId = pathSegments[2];
        if (method === 'POST') {
          const result = await activityManager.markAllActivitiesAsRead(markAllWorkspaceId, userId);
          return result.success
            ? createSuccessResponse(null)
            : createErrorResponse(result.message || 'Failed to mark all as read');
        }
        break;

      case 'stats':
        const statsWorkspaceId = pathSegments[2];
        if (method === 'GET') {
          const url = new URL(request.url);
          const days = parseInt(url.searchParams.get('days') || '30');
          
          const result = await activityManager.getActivityStats(statsWorkspaceId, userId, days);
          return result.success
            ? createSuccessResponse(result.data)
            : createErrorResponse(result.message || 'Failed to get stats');
        }
        break;

      case 'unread-count':
        const unreadWorkspaceId = pathSegments[2];
        if (method === 'GET') {
          const result = await activityManager.getUnreadCount(unreadWorkspaceId, userId);
          return result.success
            ? createSuccessResponse(result.data)
            : createErrorResponse(result.message || 'Failed to get unread count');
        }
        break;
    }
  } catch (error) {
    console.error('Activity route error:', error);
    return createErrorResponse('Internal server error', 500);
  }

  return createErrorResponse('Not found', 404);
}

// ============================================================================
// CHAT ROUTES
// ============================================================================

async function handleChatRoutes(
  request: NextRequest,
  pathSegments: string[],
  userId: string
): Promise<NextResponse> {
  const method = request.method;
  const action = pathSegments[1];

  try {
    switch (action) {
      case 'send':
        if (method === 'POST') {
          const body = await request.json();
          const result = await chatManager.sendMessage({
            workspace_id: body.workspace_id,
            user_id: userId,
            content: body.content,
            message_type: body.message_type,
            thread_id: body.thread_id,
            parent_message_id: body.parent_message_id,
            attachments: body.attachments,
            mentions: body.mentions
          });
          return result.success
            ? createSuccessResponse(result.data, 201)
            : createErrorResponse(result.message || 'Failed to send message');
        }
        break;

      case 'messages':
        const messagesWorkspaceId = pathSegments[2];
        if (method === 'GET') {
          const url = new URL(request.url);
          const page = parseInt(url.searchParams.get('page') || '1');
          const limit = parseInt(url.searchParams.get('limit') || '50');
          
          // Parse filter parameters
          const filter: any = {};
          if (url.searchParams.get('message_types')) {
            filter.message_types = url.searchParams.get('message_types')?.split(',');
          }
          if (url.searchParams.get('thread_id')) {
            filter.thread_id = url.searchParams.get('thread_id');
          }
          if (url.searchParams.get('search_query')) {
            filter.search_query = url.searchParams.get('search_query');
          }
          
          const result = await chatManager.getMessages(messagesWorkspaceId, userId, page, limit, filter);
          return result.success
            ? createSuccessResponse(result.data)
            : createErrorResponse(result.message || 'Failed to get messages');
        }
        break;

      case 'edit':
        const editMessageId = pathSegments[2];
        if (method === 'PUT') {
          const body = await request.json();
          const result = await chatManager.editMessage(editMessageId, body.content, userId);
          return result.success
            ? createSuccessResponse(result.data)
            : createErrorResponse(result.message || 'Failed to edit message');
        }
        break;

      case 'delete':
        const deleteMessageId = pathSegments[2];
        if (method === 'DELETE') {
          const result = await chatManager.deleteMessage(deleteMessageId, userId);
          return result.success
            ? createSuccessResponse(null, 204)
            : createErrorResponse(result.message || 'Failed to delete message');
        }
        break;

      case 'react':
        const reactMessageId = pathSegments[2];
        if (method === 'POST') {
          const body = await request.json();
          const result = await chatManager.addReaction(reactMessageId, body.emoji, userId);
          return result.success
            ? createSuccessResponse(result.data)
            : createErrorResponse(result.message || 'Failed to add reaction');
        }
        if (method === 'DELETE') {
          const body = await request.json();
          const result = await chatManager.removeReaction(reactMessageId, body.emoji, userId);
          return result.success
            ? createSuccessResponse(result.data)
            : createErrorResponse(result.message || 'Failed to remove reaction');
        }
        break;

      case 'thread':
        const threadId = pathSegments[2];
        if (method === 'GET') {
          const url = new URL(request.url);
          const workspaceId = url.searchParams.get('workspace_id');
          const page = parseInt(url.searchParams.get('page') || '1');
          const limit = parseInt(url.searchParams.get('limit') || '50');
          
          if (!workspaceId) {
            return createErrorResponse('workspace_id is required');
          }
          
          const result = await chatManager.getThreadMessages(threadId, workspaceId, userId, page, limit);
          return result.success
            ? createSuccessResponse(result.data)
            : createErrorResponse(result.message || 'Failed to get thread messages');
        }
        break;

      case 'stats':
        const chatStatsWorkspaceId = pathSegments[2];
        if (method === 'GET') {
          const url = new URL(request.url);
          const days = parseInt(url.searchParams.get('days') || '30');
          
          const result = await chatManager.getChatStats(chatStatsWorkspaceId, userId, days);
          return result.success
            ? createSuccessResponse(result.data)
            : createErrorResponse(result.message || 'Failed to get chat stats');
        }
        break;
    }
  } catch (error) {
    console.error('Chat route error:', error);
    return createErrorResponse('Internal server error', 500);
  }

  return createErrorResponse('Not found', 404);
}

// ============================================================================
// MAIN ROUTE HANDLERS
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
): Promise<NextResponse> {
  const userId = await authenticateRequest(request);
  if (!userId) {
    return createErrorResponse('Unauthorized', 401);
  }

  const pathSegments = params.slug;
  const resource = pathSegments[0];

  switch (resource) {
    case 'workspace':
      return handleWorkspaceRoutes(request, pathSegments, userId);
    case 'presence':
      return handlePresenceRoutes(request, pathSegments, userId);
    case 'operations':
      return handleOperationsRoutes(request, pathSegments, userId);
    case 'permissions':
      return handlePermissionsRoutes(request, pathSegments, userId);
    case 'activity':
      return handleActivityRoutes(request, pathSegments, userId);
    case 'chat':
      return handleChatRoutes(request, pathSegments, userId);
    default:
      return createErrorResponse('Not found', 404);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
): Promise<NextResponse> {
  const userId = await authenticateRequest(request);
  if (!userId) {
    return createErrorResponse('Unauthorized', 401);
  }

  const pathSegments = params.slug;
  const resource = pathSegments[0];

  switch (resource) {
    case 'workspace':
      return handleWorkspaceRoutes(request, pathSegments, userId);
    case 'presence':
      return handlePresenceRoutes(request, pathSegments, userId);
    case 'operations':
      return handleOperationsRoutes(request, pathSegments, userId);
    case 'permissions':
      return handlePermissionsRoutes(request, pathSegments, userId);
    case 'activity':
      return handleActivityRoutes(request, pathSegments, userId);
    case 'chat':
      return handleChatRoutes(request, pathSegments, userId);
    default:
      return createErrorResponse('Not found', 404);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
): Promise<NextResponse> {
  const userId = await authenticateRequest(request);
  if (!userId) {
    return createErrorResponse('Unauthorized', 401);
  }

  const pathSegments = params.slug;
  const resource = pathSegments[0];

  switch (resource) {
    case 'workspace':
      return handleWorkspaceRoutes(request, pathSegments, userId);
    case 'chat':
      return handleChatRoutes(request, pathSegments, userId);
    default:
      return createErrorResponse('Not found', 404);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string[] } }
): Promise<NextResponse> {
  const userId = await authenticateRequest(request);
  if (!userId) {
    return createErrorResponse('Unauthorized', 401);
  }

  const pathSegments = params.slug;
  const resource = pathSegments[0];

  switch (resource) {
    case 'workspace':
      return handleWorkspaceRoutes(request, pathSegments, userId);
    case 'chat':
      return handleChatRoutes(request, pathSegments, userId);
    default:
      return createErrorResponse('Not found', 404);
  }
}
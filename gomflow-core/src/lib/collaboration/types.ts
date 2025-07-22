// GOMFLOW Collaboration System Types
// Real-time collaboration types for workspace management

export interface User {
  id: string;
  email: string;
  name: string;
  username: string;
  phone: string;
  country: 'PH' | 'MY';
  avatar?: string;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  slug: string;
  settings: WorkspaceSettings;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  
  // Computed fields
  owner_name?: string;
  owner_username?: string;
  total_members?: number;
  active_members?: number;
  online_members?: number;
  total_orders?: number;
  active_orders?: number;
  recent_activity?: number;
}

export interface WorkspaceSettings {
  auto_invite: boolean;
  public_orders: boolean;
  require_approval: boolean;
  default_role: WorkspaceRole;
}

export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer';
export type MemberStatus = 'active' | 'invited' | 'suspended' | 'left';
export type PresenceStatus = 'online' | 'away' | 'busy' | 'offline';

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  status: MemberStatus;
  permissions: WorkspacePermissions;
  invited_by?: string;
  invited_at?: string;
  joined_at?: string;
  last_active_at: string;
  created_at: string;
  updated_at: string;
  
  // User data
  user?: User;
  
  // Presence data
  presence_status?: PresenceStatus;
  current_page?: string;
  last_activity?: string;
}

export interface WorkspacePermissions {
  can_create_orders: boolean;
  can_edit_orders: boolean;
  can_delete_orders: boolean;
  can_view_analytics: boolean;
  can_manage_payments: boolean;
  can_invite_members: boolean;
  can_chat: boolean;
}

export interface CollaborativeOrder {
  id: string;
  order_id: string;
  workspace_id: string;
  last_edited_by?: string;
  last_edited_at: string;
  edit_lock_user_id?: string;
  edit_lock_expires_at?: string;
  version: number;
  conflict_resolution_data: Record<string, any>;
  created_at: string;
  updated_at: string;
  
  // Order data
  order?: any;
  last_editor?: User;
  edit_lock_user?: User;
}

export interface PresenceTracking {
  id: string;
  user_id: string;
  workspace_id: string;
  status: PresenceStatus;
  current_page?: string;
  cursor_position?: CursorPosition;
  last_activity: string;
  socket_id?: string;
  user_agent?: string;
  ip_address?: string;
  created_at: string;
  updated_at: string;
  
  // User data
  user?: User;
}

export interface CursorPosition {
  x: number;
  y: number;
  page?: string;
  element?: string;
  selection?: {
    start: number;
    end: number;
    text?: string;
  };
}

export type OperationType = 'insert' | 'delete' | 'retain' | 'replace';

export interface OperationalTransform {
  id: string;
  order_id: string;
  user_id: string;
  workspace_id: string;
  operation_type: OperationType;
  field_path: string;
  old_value?: any;
  new_value?: any;
  position?: number;
  length?: number;
  version: number;
  timestamp: string;
  applied: boolean;
  conflicts_with?: string[];
  created_at: string;
  
  // User data
  user?: User;
}

export type ActivityType = 
  | 'order_created'
  | 'order_updated'
  | 'order_deleted'
  | 'submission_paid'
  | 'submission_updated'
  | 'member_added'
  | 'member_removed'
  | 'member_role_changed'
  | 'workspace_created'
  | 'workspace_updated'
  | 'chat_message'
  | 'presence_update';

export interface ActivityFeed {
  id: string;
  workspace_id: string;
  user_id: string;
  activity_type: ActivityType;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, any>;
  description?: string;
  is_read: boolean;
  created_at: string;
  
  // User data
  user?: User;
}

export type ChatMessageType = 'text' | 'system' | 'file' | 'order_mention' | 'member_mention';

export interface ChatMessage {
  id: string;
  workspace_id: string;
  user_id: string;
  thread_id?: string;
  parent_message_id?: string;
  message_type: ChatMessageType;
  content: string;
  formatted_content?: Record<string, any>;
  attachments?: ChatAttachment[];
  mentions?: ChatMention[];
  reactions?: Record<string, string[]>; // emoji -> user_ids
  is_edited: boolean;
  edited_at?: string;
  is_deleted: boolean;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
  
  // User data
  user?: User;
  
  // Thread data
  reply_count?: number;
  latest_reply?: string;
}

export interface ChatAttachment {
  id: string;
  type: 'image' | 'file' | 'video' | 'audio';
  name: string;
  url: string;
  size?: number;
  mime_type?: string;
}

export interface ChatMention {
  id: string;
  type: 'user' | 'order' | 'everyone';
  name: string;
  position: number;
  length: number;
}

export interface WorkspaceInvitation {
  id: string;
  workspace_id: string;
  email: string;
  invited_by: string;
  role: WorkspaceRole;
  token: string;
  expires_at: string;
  used_at?: string;
  used_by?: string;
  created_at: string;
  
  // User data
  inviter?: User;
  workspace?: Workspace;
}

// WebSocket message types
export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: string;
  user_id?: string;
  workspace_id?: string;
}

export interface PresenceUpdate {
  user_id: string;
  workspace_id: string;
  status: PresenceStatus;
  current_page?: string;
  cursor_position?: CursorPosition;
}

export interface OrderEdit {
  order_id: string;
  workspace_id: string;
  user_id: string;
  field_path: string;
  old_value: any;
  new_value: any;
  version: number;
  timestamp: string;
}

export interface LockRequest {
  order_id: string;
  workspace_id: string;
  user_id: string;
  lock_duration?: number; // in minutes
}

export interface LockResponse {
  success: boolean;
  locked_by?: string;
  locked_until?: string;
  message?: string;
}

// Real-time event types
export type RealtimeEvent = 
  | 'presence_update'
  | 'order_lock'
  | 'order_unlock'
  | 'order_edit'
  | 'order_created'
  | 'order_updated'
  | 'order_deleted'
  | 'chat_message'
  | 'member_joined'
  | 'member_left'
  | 'member_role_changed'
  | 'activity_created'
  | 'notification'
  | 'error';

export interface RealtimeEventData {
  event: RealtimeEvent;
  data: any;
  user_id?: string;
  workspace_id?: string;
  timestamp: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = any> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

// Collaboration client configuration
export interface CollaborationConfig {
  websocket_url: string;
  auth_token: string;
  user_id: string;
  reconnect_attempts: number;
  heartbeat_interval: number;
  presence_update_interval: number;
  cursor_update_throttle: number;
}

// Error types
export interface CollaborationError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
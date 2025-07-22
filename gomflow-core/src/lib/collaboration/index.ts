// GOMFLOW Collaboration System
// Main entry point for collaboration features

export * from './types';

// Core managers
export { default as WorkspaceManager } from './workspace';
export { default as PresenceManager } from './presence';
export { default as OperationalTransformManager } from './operations';
export { default as PermissionManager } from './permissions';
export { default as ActivityManager } from './activity';
export { default as ChatManager } from './chat';
export { default as CollaborationWebSocketServer } from './websocket';

// Utility functions
export const createCollaborationSystem = () => {
  return {
    workspace: new (require('./workspace').default)(),
    presence: new (require('./presence').default)(),
    operations: new (require('./operations').default)(),
    permissions: new (require('./permissions').default)(),
    activity: new (require('./activity').default)(),
    chat: new (require('./chat').default)(),
  };
};

// Export types for better TypeScript support
export type {
  User,
  Workspace,
  WorkspaceSettings,
  WorkspaceRole,
  MemberStatus,
  PresenceStatus,
  WorkspaceMember,
  WorkspacePermissions,
  CollaborativeOrder,
  PresenceTracking,
  CursorPosition,
  OperationalTransform,
  OperationType,
  ActivityFeed,
  ActivityType,
  ChatMessage,
  ChatMessageType,
  ChatAttachment,
  ChatMention,
  WorkspaceInvitation,
  WebSocketMessage,
  PresenceUpdate,
  OrderEdit,
  LockRequest,
  LockResponse,
  RealtimeEvent,
  RealtimeEventData,
  ApiResponse,
  PaginatedResponse,
  CollaborationConfig,
  CollaborationError,
  ValidationError,
  DeepPartial,
  RequiredFields,
  OptionalFields
} from './types';
# GOMFLOW Real-time Collaboration Components

This directory contains the core frontend components for GOMFLOW's real-time collaboration system, enabling seamless teamwork on order management.

## Components Overview

### 1. WorkspaceManager.tsx
**Main workspace management interface**
- Displays workspace list with statistics
- Member management with role-based permissions
- Workspace creation and settings
- Real-time member activity indicators

**Key Features:**
- Search and filter workspaces
- Role-based access control (Owner, Admin, Editor, Viewer)
- Live member count and activity metrics
- Workspace settings management

### 2. CollaborativeEditor.tsx
**Real-time order editor with live cursors**
- Collaborative order editing with conflict resolution
- Real-time cursor positions and user presence
- Automatic save and version control
- Field-level locking system

**Key Features:**
- Live collaborative editing
- Conflict detection and resolution
- Undo/redo functionality
- Order locking mechanism
- Real-time cursor tracking

### 3. PresenceIndicator.tsx
**Live presence display with avatars**
- Real-time user presence status
- Live cursor positions
- Member activity indicators
- Compact and detailed view modes

**Key Features:**
- Online/away/busy/offline status
- Live cursor tracking
- Activity descriptions
- Role-based member display

### 4. TeamChat.tsx
**Team communication interface**
- Real-time messaging with typing indicators
- Message threading and replies
- Emoji reactions and file attachments
- Search and filtering capabilities

**Key Features:**
- Real-time messaging
- Thread conversations
- Emoji reactions
- Message history and search
- User mentions and notifications

### 5. ConflictResolver.tsx
**UI for resolving collaborative editing conflicts**
- Visual conflict comparison
- Resolution options (local, remote, custom)
- Batch conflict resolution
- Preview before applying changes

**Key Features:**
- Side-by-side conflict view
- Multiple resolution strategies
- Custom value input
- Bulk resolution actions

### 6. ActivityFeed.tsx
**Real-time activity timeline**
- Workspace activity tracking
- Filtered activity views
- Real-time updates
- Unread activity indicators

**Key Features:**
- Activity type filtering
- Time-based grouping
- Real-time updates
- Mark as read functionality

## Integration Example

```tsx
import { useCollaboration } from '@/hooks/useCollaboration';
import WorkspaceManager from '@/components/collaboration/WorkspaceManager';
import CollaborativeEditor from '@/components/collaboration/CollaborativeEditor';
import TeamChat from '@/components/collaboration/TeamChat';

function CollaborationExample() {
  const { state, actions } = useCollaboration({
    workspaceId: 'workspace-123',
    userId: 'user-456',
    authToken: 'jwt-token',
    autoConnect: true
  });

  return (
    <div className="flex h-screen">
      {/* Main workspace */}
      <div className="flex-1">
        <WorkspaceManager
          userId={state.userId}
          authToken={state.authToken}
          onWorkspaceSelect={(id) => actions.joinWorkspace(id)}
        />
      </div>
      
      {/* Sidebar chat */}
      <div className="w-80">
        <TeamChat
          workspaceId={state.currentWorkspace?.id}
          userId={state.userId}
          authToken={state.authToken}
          compact={true}
        />
      </div>
    </div>
  );
}
```

## Real-time Features

### WebSocket Integration
All components integrate with the `useCollaboration` hook for real-time updates:
- Automatic reconnection
- Presence tracking
- Live cursor positions
- Instant message delivery
- Conflict detection

### Permission System
Role-based permissions control user capabilities:
- **Owner**: Full workspace control
- **Admin**: Member management, settings
- **Editor**: Order editing, content creation
- **Viewer**: Read-only access

### Performance Optimizations
- **Throttled Updates**: Cursor positions throttled to 100ms
- **Lazy Loading**: Activity feed pagination
- **Efficient Rendering**: React.memo for presence indicators
- **Debounced Search**: Search input debounced to 300ms

## Backend Integration

### API Endpoints
Components communicate with these backend services:
- `/api/collaboration/workspaces` - Workspace management
- `/api/collaboration/orders` - Order collaboration
- `/api/collaboration/chat` - Team messaging
- `/api/collaboration/activity` - Activity tracking

### WebSocket Events
Real-time events handled by components:
- `presence_update` - User presence changes
- `order_edit` - Collaborative edits
- `chat_message` - New messages
- `activity_created` - New activities
- `member_joined/left` - Member changes

## Styling and Themes

All components use:
- **shadcn/ui** for consistent design system
- **Tailwind CSS** for utility-first styling
- **Lucide Icons** for consistent iconography
- **Responsive Design** for mobile compatibility

## Error Handling

Comprehensive error handling includes:
- Network failure recovery
- WebSocket reconnection
- Conflict resolution dialogs
- User-friendly error messages
- Graceful degradation

## Accessibility

Components implement:
- ARIA labels and roles
- Keyboard navigation
- Screen reader support
- High contrast mode
- Focus management

## Testing

Components are tested with:
- Unit tests for core functionality
- Integration tests for real-time features
- End-to-end tests for user workflows
- Performance tests for large workspaces

## Future Enhancements

Planned improvements:
- Voice/video calling integration
- Advanced search capabilities
- Mobile-optimized interfaces
- Offline sync capabilities
- Enhanced analytics dashboard
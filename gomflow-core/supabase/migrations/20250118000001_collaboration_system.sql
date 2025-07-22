-- GOMFLOW Collaboration System Database Schema
-- Created: January 18, 2025
-- Description: Real-time collaboration system for shared workspace management

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create collaboration-specific types
CREATE TYPE workspace_role AS ENUM ('owner', 'admin', 'editor', 'viewer');
CREATE TYPE member_status AS ENUM ('active', 'invited', 'suspended', 'left');
CREATE TYPE activity_type AS ENUM ('order_created', 'order_updated', 'order_deleted', 'submission_paid', 'submission_updated', 'member_added', 'member_removed', 'member_role_changed', 'workspace_created', 'workspace_updated', 'chat_message', 'presence_update');
CREATE TYPE presence_status AS ENUM ('online', 'away', 'busy', 'offline');
CREATE TYPE operation_type AS ENUM ('insert', 'delete', 'retain', 'replace');
CREATE TYPE chat_message_type AS ENUM ('text', 'system', 'file', 'order_mention', 'member_mention');

-- ============================================================================
-- WORKSPACES TABLE
-- ============================================================================
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slug VARCHAR(100) UNIQUE NOT NULL,
    settings JSONB NOT NULL DEFAULT '{
        "auto_invite": false,
        "public_orders": true,
        "require_approval": true,
        "default_role": "viewer"
    }'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workspaces indexes
CREATE INDEX idx_workspaces_owner_id ON workspaces(owner_id);
CREATE INDEX idx_workspaces_slug ON workspaces(slug);
CREATE INDEX idx_workspaces_is_active ON workspaces(is_active);
CREATE INDEX idx_workspaces_name_trgm ON workspaces USING gin (name gin_trgm_ops);

-- ============================================================================
-- WORKSPACE_MEMBERS TABLE
-- ============================================================================
CREATE TABLE workspace_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role workspace_role NOT NULL DEFAULT 'viewer',
    status member_status NOT NULL DEFAULT 'active',
    permissions JSONB NOT NULL DEFAULT '{
        "can_create_orders": false,
        "can_edit_orders": false,
        "can_delete_orders": false,
        "can_view_analytics": false,
        "can_manage_payments": false,
        "can_invite_members": false,
        "can_chat": true
    }'::jsonb,
    invited_by UUID REFERENCES users(id),
    invited_at TIMESTAMP WITH TIME ZONE,
    joined_at TIMESTAMP WITH TIME ZONE,
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workspace_id, user_id)
);

-- Workspace members indexes
CREATE INDEX idx_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user_id ON workspace_members(user_id);
CREATE INDEX idx_workspace_members_role ON workspace_members(role);
CREATE INDEX idx_workspace_members_status ON workspace_members(status);
CREATE INDEX idx_workspace_members_last_active ON workspace_members(last_active_at);

-- ============================================================================
-- COLLABORATIVE_ORDERS TABLE (extends orders with workspace support)
-- ============================================================================
CREATE TABLE collaborative_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    last_edited_by UUID REFERENCES users(id),
    last_edited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    edit_lock_user_id UUID REFERENCES users(id),
    edit_lock_expires_at TIMESTAMP WITH TIME ZONE,
    version INTEGER DEFAULT 1,
    conflict_resolution_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(order_id, workspace_id)
);

-- Collaborative orders indexes
CREATE INDEX idx_collaborative_orders_order_id ON collaborative_orders(order_id);
CREATE INDEX idx_collaborative_orders_workspace_id ON collaborative_orders(workspace_id);
CREATE INDEX idx_collaborative_orders_last_edited_by ON collaborative_orders(last_edited_by);
CREATE INDEX idx_collaborative_orders_edit_lock_user_id ON collaborative_orders(edit_lock_user_id);
CREATE INDEX idx_collaborative_orders_version ON collaborative_orders(version);

-- ============================================================================
-- PRESENCE_TRACKING TABLE
-- ============================================================================
CREATE TABLE presence_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    status presence_status NOT NULL DEFAULT 'online',
    current_page VARCHAR(255),
    cursor_position JSONB DEFAULT '{}'::jsonb,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    socket_id VARCHAR(255),
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, workspace_id)
);

-- Presence tracking indexes
CREATE INDEX idx_presence_tracking_user_id ON presence_tracking(user_id);
CREATE INDEX idx_presence_tracking_workspace_id ON presence_tracking(workspace_id);
CREATE INDEX idx_presence_tracking_status ON presence_tracking(status);
CREATE INDEX idx_presence_tracking_last_activity ON presence_tracking(last_activity);
CREATE INDEX idx_presence_tracking_socket_id ON presence_tracking(socket_id);

-- ============================================================================
-- OPERATIONAL_TRANSFORMS TABLE
-- ============================================================================
CREATE TABLE operational_transforms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    operation_type operation_type NOT NULL,
    field_path VARCHAR(255) NOT NULL,
    old_value JSONB,
    new_value JSONB,
    position INTEGER,
    length INTEGER,
    version INTEGER NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    applied BOOLEAN DEFAULT false,
    conflicts_with UUID[], -- Array of conflicting operation IDs
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Operational transforms indexes
CREATE INDEX idx_operational_transforms_order_id ON operational_transforms(order_id);
CREATE INDEX idx_operational_transforms_user_id ON operational_transforms(user_id);
CREATE INDEX idx_operational_transforms_workspace_id ON operational_transforms(workspace_id);
CREATE INDEX idx_operational_transforms_version ON operational_transforms(version);
CREATE INDEX idx_operational_transforms_timestamp ON operational_transforms(timestamp);
CREATE INDEX idx_operational_transforms_applied ON operational_transforms(applied);

-- ============================================================================
-- ACTIVITY_FEED TABLE
-- ============================================================================
CREATE TABLE activity_feed (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type activity_type NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    description TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activity feed indexes
CREATE INDEX idx_activity_feed_workspace_id ON activity_feed(workspace_id);
CREATE INDEX idx_activity_feed_user_id ON activity_feed(user_id);
CREATE INDEX idx_activity_feed_activity_type ON activity_feed(activity_type);
CREATE INDEX idx_activity_feed_entity_type ON activity_feed(entity_type);
CREATE INDEX idx_activity_feed_entity_id ON activity_feed(entity_id);
CREATE INDEX idx_activity_feed_is_read ON activity_feed(is_read);
CREATE INDEX idx_activity_feed_created_at ON activity_feed(created_at);

-- ============================================================================
-- CHAT_MESSAGES TABLE
-- ============================================================================
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    thread_id UUID, -- For threaded conversations
    parent_message_id UUID REFERENCES chat_messages(id),
    message_type chat_message_type NOT NULL DEFAULT 'text',
    content TEXT NOT NULL,
    formatted_content JSONB, -- For rich text, mentions, etc.
    attachments JSONB DEFAULT '[]'::jsonb,
    mentions JSONB DEFAULT '[]'::jsonb, -- User and order mentions
    reactions JSONB DEFAULT '{}'::jsonb, -- Emoji reactions
    is_edited BOOLEAN DEFAULT false,
    edited_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat messages indexes
CREATE INDEX idx_chat_messages_workspace_id ON chat_messages(workspace_id);
CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX idx_chat_messages_thread_id ON chat_messages(thread_id);
CREATE INDEX idx_chat_messages_parent_message_id ON chat_messages(parent_message_id);
CREATE INDEX idx_chat_messages_message_type ON chat_messages(message_type);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX idx_chat_messages_is_deleted ON chat_messages(is_deleted);

-- ============================================================================
-- WORKSPACE_INVITATIONS TABLE
-- ============================================================================
CREATE TABLE workspace_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role workspace_role NOT NULL DEFAULT 'viewer',
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    used_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workspace invitations indexes
CREATE INDEX idx_workspace_invitations_workspace_id ON workspace_invitations(workspace_id);
CREATE INDEX idx_workspace_invitations_email ON workspace_invitations(email);
CREATE INDEX idx_workspace_invitations_token ON workspace_invitations(token);
CREATE INDEX idx_workspace_invitations_expires_at ON workspace_invitations(expires_at);
CREATE INDEX idx_workspace_invitations_used_at ON workspace_invitations(used_at);

-- ============================================================================
-- DATABASE FUNCTIONS FOR COLLABORATION
-- ============================================================================

-- Function to get workspace stats
CREATE OR REPLACE FUNCTION get_workspace_stats(workspace_uuid UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_members', (
            SELECT COUNT(*) FROM workspace_members 
            WHERE workspace_id = workspace_uuid AND status = 'active'
        ),
        'total_orders', (
            SELECT COUNT(*) FROM collaborative_orders co
            JOIN orders o ON co.order_id = o.id
            WHERE co.workspace_id = workspace_uuid
        ),
        'active_orders', (
            SELECT COUNT(*) FROM collaborative_orders co
            JOIN orders o ON co.order_id = o.id
            WHERE co.workspace_id = workspace_uuid AND o.is_active = true
        ),
        'total_submissions', (
            SELECT COUNT(*) FROM collaborative_orders co
            JOIN orders o ON co.order_id = o.id
            JOIN submissions s ON o.id = s.order_id
            WHERE co.workspace_id = workspace_uuid
        ),
        'online_members', (
            SELECT COUNT(*) FROM presence_tracking 
            WHERE workspace_id = workspace_uuid 
            AND status = 'online' 
            AND last_activity > NOW() - INTERVAL '5 minutes'
        ),
        'total_messages', (
            SELECT COUNT(*) FROM chat_messages 
            WHERE workspace_id = workspace_uuid AND is_deleted = false
        ),
        'recent_activity', (
            SELECT COUNT(*) FROM activity_feed 
            WHERE workspace_id = workspace_uuid 
            AND created_at > NOW() - INTERVAL '24 hours'
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to check user permissions in workspace
CREATE OR REPLACE FUNCTION check_workspace_permission(
    user_uuid UUID,
    workspace_uuid UUID,
    permission_name TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    user_role workspace_role;
    user_permissions JSONB;
    has_permission BOOLEAN;
BEGIN
    -- Get user role and permissions
    SELECT wm.role, wm.permissions INTO user_role, user_permissions
    FROM workspace_members wm
    WHERE wm.user_id = user_uuid 
    AND wm.workspace_id = workspace_uuid 
    AND wm.status = 'active';
    
    -- If user not found, return false
    IF user_role IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Owner has all permissions
    IF user_role = 'owner' THEN
        RETURN TRUE;
    END IF;
    
    -- Admin has most permissions
    IF user_role = 'admin' AND permission_name != 'can_delete_workspace' THEN
        RETURN TRUE;
    END IF;
    
    -- Check specific permission
    SELECT (user_permissions ->> permission_name)::BOOLEAN INTO has_permission;
    
    RETURN COALESCE(has_permission, FALSE);
END;
$$ LANGUAGE plpgsql;

-- Function to apply operational transform
CREATE OR REPLACE FUNCTION apply_operational_transform(
    transform_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    transform_record operational_transforms%ROWTYPE;
    current_version INTEGER;
    success BOOLEAN := FALSE;
BEGIN
    -- Get the transform record
    SELECT * INTO transform_record FROM operational_transforms WHERE id = transform_id;
    
    IF transform_record.id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Get current version of the order
    SELECT version INTO current_version 
    FROM collaborative_orders 
    WHERE order_id = transform_record.order_id 
    AND workspace_id = transform_record.workspace_id;
    
    -- Apply transform if versions match
    IF current_version = transform_record.version THEN
        -- Update the order based on the transform
        CASE transform_record.operation_type
            WHEN 'replace' THEN
                -- Apply the replace operation
                UPDATE orders 
                SET title = COALESCE((transform_record.new_value ->> 'title'), title),
                    description = COALESCE((transform_record.new_value ->> 'description'), description),
                    price = COALESCE((transform_record.new_value ->> 'price')::DECIMAL, price),
                    deadline = COALESCE((transform_record.new_value ->> 'deadline')::TIMESTAMP WITH TIME ZONE, deadline),
                    updated_at = NOW()
                WHERE id = transform_record.order_id;
                
                success := TRUE;
            ELSE
                -- Handle other operation types as needed
                success := FALSE;
        END CASE;
        
        IF success THEN
            -- Update collaborative order version
            UPDATE collaborative_orders 
            SET version = version + 1,
                last_edited_by = transform_record.user_id,
                last_edited_at = NOW()
            WHERE order_id = transform_record.order_id 
            AND workspace_id = transform_record.workspace_id;
            
            -- Mark transform as applied
            UPDATE operational_transforms 
            SET applied = TRUE 
            WHERE id = transform_id;
        END IF;
    END IF;
    
    RETURN success;
END;
$$ LANGUAGE plpgsql;

-- Function to log activity
CREATE OR REPLACE FUNCTION log_workspace_activity(
    workspace_uuid UUID,
    user_uuid UUID,
    activity_type activity_type,
    entity_type VARCHAR(50),
    entity_uuid UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    description TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    activity_id UUID;
BEGIN
    INSERT INTO activity_feed (
        workspace_id, user_id, activity_type, entity_type, entity_id, metadata, description
    ) VALUES (
        workspace_uuid, user_uuid, activity_type, entity_type, entity_uuid, metadata, description
    ) RETURNING id INTO activity_id;
    
    RETURN activity_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update user presence
CREATE OR REPLACE FUNCTION update_user_presence(
    user_uuid UUID,
    workspace_uuid UUID,
    status presence_status,
    current_page VARCHAR(255) DEFAULT NULL,
    cursor_position JSONB DEFAULT NULL,
    socket_id VARCHAR(255) DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO presence_tracking (
        user_id, workspace_id, status, current_page, cursor_position, socket_id, last_activity
    ) VALUES (
        user_uuid, workspace_uuid, status, current_page, cursor_position, socket_id, NOW()
    )
    ON CONFLICT (user_id, workspace_id) 
    DO UPDATE SET 
        status = EXCLUDED.status,
        current_page = COALESCE(EXCLUDED.current_page, presence_tracking.current_page),
        cursor_position = COALESCE(EXCLUDED.cursor_position, presence_tracking.cursor_position),
        socket_id = COALESCE(EXCLUDED.socket_id, presence_tracking.socket_id),
        last_activity = NOW(),
        updated_at = NOW();
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Updated_at triggers
CREATE TRIGGER trigger_workspaces_updated_at BEFORE UPDATE ON workspaces
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_workspace_members_updated_at BEFORE UPDATE ON workspace_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_collaborative_orders_updated_at BEFORE UPDATE ON collaborative_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_presence_tracking_updated_at BEFORE UPDATE ON presence_tracking
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_chat_messages_updated_at BEFORE UPDATE ON chat_messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Activity logging triggers
CREATE OR REPLACE FUNCTION trigger_log_order_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Log order creation
        INSERT INTO activity_feed (workspace_id, user_id, activity_type, entity_type, entity_id, metadata, description)
        SELECT co.workspace_id, NEW.user_id, 'order_created', 'order', NEW.id, 
               json_build_object('title', NEW.title, 'price', NEW.price, 'currency', NEW.currency),
               'Created order: ' || NEW.title
        FROM collaborative_orders co WHERE co.order_id = NEW.id;
        
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Log order updates
        INSERT INTO activity_feed (workspace_id, user_id, activity_type, entity_type, entity_id, metadata, description)
        SELECT co.workspace_id, NEW.user_id, 'order_updated', 'order', NEW.id,
               json_build_object('changes', json_build_object(
                   'title', CASE WHEN OLD.title != NEW.title THEN json_build_object('old', OLD.title, 'new', NEW.title) END,
                   'price', CASE WHEN OLD.price != NEW.price THEN json_build_object('old', OLD.price, 'new', NEW.price) END,
                   'deadline', CASE WHEN OLD.deadline != NEW.deadline THEN json_build_object('old', OLD.deadline, 'new', NEW.deadline) END
               )),
               'Updated order: ' || NEW.title
        FROM collaborative_orders co WHERE co.order_id = NEW.id;
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Log order deletion
        INSERT INTO activity_feed (workspace_id, user_id, activity_type, entity_type, entity_id, metadata, description)
        SELECT co.workspace_id, OLD.user_id, 'order_deleted', 'order', OLD.id,
               json_build_object('title', OLD.title),
               'Deleted order: ' || OLD.title
        FROM collaborative_orders co WHERE co.order_id = OLD.id;
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_orders_activity_log
    AFTER INSERT OR UPDATE OR DELETE ON orders
    FOR EACH ROW EXECUTE FUNCTION trigger_log_order_activity();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all collaboration tables
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaborative_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE presence_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational_transforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;

-- Workspaces policies
CREATE POLICY "Users can view workspaces they are members of" ON workspaces
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM workspace_members 
            WHERE workspace_id = workspaces.id 
            AND user_id::text = auth.uid()::text 
            AND status = 'active'
        )
    );

CREATE POLICY "Users can create workspaces" ON workspaces
    FOR INSERT WITH CHECK (auth.uid()::text = owner_id::text);

CREATE POLICY "Owners can update their workspaces" ON workspaces
    FOR UPDATE USING (auth.uid()::text = owner_id::text);

CREATE POLICY "Owners can delete their workspaces" ON workspaces
    FOR DELETE USING (auth.uid()::text = owner_id::text);

-- Workspace members policies
CREATE POLICY "Users can view workspace members if they are members" ON workspace_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM workspace_members wm 
            WHERE wm.workspace_id = workspace_members.workspace_id 
            AND wm.user_id::text = auth.uid()::text 
            AND wm.status = 'active'
        )
    );

CREATE POLICY "Admins can manage workspace members" ON workspace_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM workspace_members wm
            JOIN workspaces w ON wm.workspace_id = w.id
            WHERE wm.workspace_id = workspace_members.workspace_id 
            AND wm.user_id::text = auth.uid()::text 
            AND wm.status = 'active'
            AND (wm.role = 'admin' OR wm.role = 'owner' OR w.owner_id::text = auth.uid()::text)
        )
    );

-- Collaborative orders policies
CREATE POLICY "Members can view collaborative orders" ON collaborative_orders
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM workspace_members wm 
            WHERE wm.workspace_id = collaborative_orders.workspace_id 
            AND wm.user_id::text = auth.uid()::text 
            AND wm.status = 'active'
        )
    );

CREATE POLICY "Members can create collaborative orders" ON collaborative_orders
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM workspace_members wm 
            WHERE wm.workspace_id = collaborative_orders.workspace_id 
            AND wm.user_id::text = auth.uid()::text 
            AND wm.status = 'active'
            AND (wm.permissions ->> 'can_create_orders')::boolean = true
        )
    );

CREATE POLICY "Members can update collaborative orders" ON collaborative_orders
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM workspace_members wm 
            WHERE wm.workspace_id = collaborative_orders.workspace_id 
            AND wm.user_id::text = auth.uid()::text 
            AND wm.status = 'active'
            AND (wm.permissions ->> 'can_edit_orders')::boolean = true
        )
    );

-- Presence tracking policies
CREATE POLICY "Members can view presence in their workspaces" ON presence_tracking
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM workspace_members wm 
            WHERE wm.workspace_id = presence_tracking.workspace_id 
            AND wm.user_id::text = auth.uid()::text 
            AND wm.status = 'active'
        )
    );

CREATE POLICY "Users can update their own presence" ON presence_tracking
    FOR ALL USING (auth.uid()::text = user_id::text);

-- Activity feed policies
CREATE POLICY "Members can view activity feed" ON activity_feed
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM workspace_members wm 
            WHERE wm.workspace_id = activity_feed.workspace_id 
            AND wm.user_id::text = auth.uid()::text 
            AND wm.status = 'active'
        )
    );

-- Chat messages policies
CREATE POLICY "Members can view chat messages" ON chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM workspace_members wm 
            WHERE wm.workspace_id = chat_messages.workspace_id 
            AND wm.user_id::text = auth.uid()::text 
            AND wm.status = 'active'
        )
    );

CREATE POLICY "Members can create chat messages" ON chat_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM workspace_members wm 
            WHERE wm.workspace_id = chat_messages.workspace_id 
            AND wm.user_id::text = auth.uid()::text 
            AND wm.status = 'active'
            AND (wm.permissions ->> 'can_chat')::boolean = true
        )
    );

CREATE POLICY "Users can update their own chat messages" ON chat_messages
    FOR UPDATE USING (auth.uid()::text = user_id::text);

-- Operational transforms policies
CREATE POLICY "Members can view operational transforms" ON operational_transforms
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM workspace_members wm 
            WHERE wm.workspace_id = operational_transforms.workspace_id 
            AND wm.user_id::text = auth.uid()::text 
            AND wm.status = 'active'
        )
    );

CREATE POLICY "Members can create operational transforms" ON operational_transforms
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM workspace_members wm 
            WHERE wm.workspace_id = operational_transforms.workspace_id 
            AND wm.user_id::text = auth.uid()::text 
            AND wm.status = 'active'
            AND (wm.permissions ->> 'can_edit_orders')::boolean = true
        )
    );

-- Workspace invitations policies
CREATE POLICY "Users can view invitations to workspaces they manage" ON workspace_invitations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM workspace_members wm 
            WHERE wm.workspace_id = workspace_invitations.workspace_id 
            AND wm.user_id::text = auth.uid()::text 
            AND wm.status = 'active'
            AND (wm.role = 'admin' OR wm.role = 'owner')
        )
    );

-- ============================================================================
-- SAMPLE DATA FOR DEVELOPMENT
-- ============================================================================

-- Sample workspace
INSERT INTO workspaces (
    id, name, description, owner_id, slug, settings
) VALUES (
    '00000000-0000-0000-0000-000000000010',
    'SEVENTEEN Fanbase PH',
    'Collaborative workspace for SEVENTEEN merchandise group orders in the Philippines',
    '00000000-0000-0000-0000-000000000001',
    'seventeen-fanbase-ph',
    '{
        "auto_invite": false,
        "public_orders": true,
        "require_approval": true,
        "default_role": "editor"
    }'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Sample workspace member (owner)
INSERT INTO workspace_members (
    id, workspace_id, user_id, role, status, permissions, joined_at
) VALUES (
    '00000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    'owner',
    'active',
    '{
        "can_create_orders": true,
        "can_edit_orders": true,
        "can_delete_orders": true,
        "can_view_analytics": true,
        "can_manage_payments": true,
        "can_invite_members": true,
        "can_chat": true
    }'::jsonb,
    NOW()
) ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- Sample collaborative order
INSERT INTO collaborative_orders (
    id, order_id, workspace_id, last_edited_by, version
) VALUES (
    '00000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    1
) ON CONFLICT (order_id, workspace_id) DO NOTHING;

-- Sample presence
INSERT INTO presence_tracking (
    id, user_id, workspace_id, status, current_page, last_activity
) VALUES (
    '00000000-0000-0000-0000-000000000013',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    'online',
    '/dashboard',
    NOW()
) ON CONFLICT (user_id, workspace_id) DO NOTHING;

-- Sample activity
INSERT INTO activity_feed (
    id, workspace_id, user_id, activity_type, entity_type, entity_id, metadata, description
) VALUES (
    '00000000-0000-0000-0000-000000000014',
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    'workspace_created',
    'workspace',
    '00000000-0000-0000-0000-000000000010',
    '{"name": "SEVENTEEN Fanbase PH"}'::jsonb,
    'Created workspace: SEVENTEEN Fanbase PH'
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- VIEWS FOR COLLABORATION
-- ============================================================================

-- View for workspace overview
CREATE VIEW workspace_overview AS
SELECT 
    w.*,
    u.name as owner_name,
    u.username as owner_username,
    COALESCE(member_stats.total_members, 0) as total_members,
    COALESCE(member_stats.active_members, 0) as active_members,
    COALESCE(member_stats.online_members, 0) as online_members,
    COALESCE(order_stats.total_orders, 0) as total_orders,
    COALESCE(order_stats.active_orders, 0) as active_orders,
    COALESCE(activity_stats.recent_activity, 0) as recent_activity
FROM workspaces w
JOIN users u ON w.owner_id = u.id
LEFT JOIN LATERAL (
    SELECT 
        COUNT(*) as total_members,
        COUNT(*) FILTER (WHERE status = 'active') as active_members,
        COUNT(*) FILTER (WHERE status = 'active' AND EXISTS (
            SELECT 1 FROM presence_tracking pt 
            WHERE pt.user_id = wm.user_id 
            AND pt.workspace_id = w.id 
            AND pt.status = 'online' 
            AND pt.last_activity > NOW() - INTERVAL '5 minutes'
        )) as online_members
    FROM workspace_members wm
    WHERE wm.workspace_id = w.id
) member_stats ON true
LEFT JOIN LATERAL (
    SELECT 
        COUNT(*) as total_orders,
        COUNT(*) FILTER (WHERE o.is_active = true) as active_orders
    FROM collaborative_orders co
    JOIN orders o ON co.order_id = o.id
    WHERE co.workspace_id = w.id
) order_stats ON true
LEFT JOIN LATERAL (
    SELECT 
        COUNT(*) as recent_activity
    FROM activity_feed af
    WHERE af.workspace_id = w.id 
    AND af.created_at > NOW() - INTERVAL '24 hours'
) activity_stats ON true;

-- View for member presence
CREATE VIEW member_presence AS
SELECT 
    wm.workspace_id,
    wm.user_id,
    u.name,
    u.username,
    wm.role,
    wm.status as member_status,
    COALESCE(pt.status, 'offline') as presence_status,
    pt.current_page,
    pt.last_activity,
    pt.cursor_position,
    CASE 
        WHEN pt.last_activity > NOW() - INTERVAL '2 minutes' THEN 'online'
        WHEN pt.last_activity > NOW() - INTERVAL '5 minutes' THEN 'away'
        ELSE 'offline'
    END as computed_status
FROM workspace_members wm
JOIN users u ON wm.user_id = u.id
LEFT JOIN presence_tracking pt ON wm.user_id = pt.user_id AND wm.workspace_id = pt.workspace_id
WHERE wm.status = 'active';

-- Success message
SELECT 'GOMFLOW collaboration system schema created successfully! 🚀' as status;
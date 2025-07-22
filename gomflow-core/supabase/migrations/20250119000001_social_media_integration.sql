-- Social Media Integration Database Schema
-- Migration: 20250119000001_social_media_integration

-- Create social_platforms lookup table
CREATE TABLE IF NOT EXISTS social_platforms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  api_version TEXT,
  base_url TEXT NOT NULL,
  auth_url TEXT NOT NULL,
  token_url TEXT NOT NULL,
  scopes TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default social platforms
INSERT INTO social_platforms (id, name, display_name, api_version, base_url, auth_url, token_url, scopes) VALUES
  ('twitter', 'twitter', 'Twitter/X', 'v2', 'https://api.twitter.com', 'https://twitter.com/i/oauth2/authorize', 'https://api.twitter.com/2/oauth2/token', ARRAY['tweet.read', 'tweet.write', 'users.read', 'offline.access']),
  ('instagram', 'instagram', 'Instagram', 'v1', 'https://graph.instagram.com', 'https://api.instagram.com/oauth/authorize', 'https://api.instagram.com/oauth/access_token', ARRAY['instagram_basic', 'instagram_content_publish']),
  ('tiktok', 'tiktok', 'TikTok', 'v1', 'https://open-api.tiktok.com', 'https://www.tiktok.com/auth/authorize', 'https://open-api.tiktok.com/oauth/access_token', ARRAY['user.info.basic', 'video.list', 'video.upload']),
  ('facebook', 'facebook', 'Facebook', 'v18.0', 'https://graph.facebook.com', 'https://www.facebook.com/v18.0/dialog/oauth', 'https://graph.facebook.com/v18.0/oauth/access_token', ARRAY['pages_manage_posts', 'pages_read_engagement', 'publish_to_groups']),
  ('discord', 'discord', 'Discord', 'v10', 'https://discord.com/api', 'https://discord.com/api/oauth2/authorize', 'https://discord.com/api/oauth2/token', ARRAY['identify', 'guilds', 'guilds.join', 'bot']),
  ('telegram', 'telegram', 'Telegram', 'bot', 'https://api.telegram.org', 'https://oauth.telegram.org/auth', 'https://api.telegram.org/bot', ARRAY['message', 'inline_query', 'callback_query'])
ON CONFLICT (id) DO UPDATE SET
  updated_at = NOW();

-- Create social_accounts table for user social media connections
CREATE TABLE IF NOT EXISTS social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_id TEXT NOT NULL REFERENCES social_platforms(id) ON DELETE CASCADE,
  platform_user_id TEXT NOT NULL,
  username TEXT,
  display_name TEXT,
  email TEXT,
  avatar_url TEXT,
  follower_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT false,
  account_type TEXT CHECK (account_type IN ('personal', 'business', 'creator')) DEFAULT 'personal',
  account_status TEXT CHECK (account_status IN ('active', 'suspended', 'deactivated', 'error')) DEFAULT 'active',
  permissions TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  last_sync_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, platform_id, platform_user_id)
);

-- Create social_tokens table for encrypted OAuth tokens
CREATE TABLE IF NOT EXISTS social_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  social_account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  token_type TEXT CHECK (token_type IN ('access_token', 'refresh_token', 'id_token')) NOT NULL,
  encrypted_token TEXT NOT NULL,
  encryption_key_id TEXT NOT NULL,
  token_hash TEXT NOT NULL, -- SHA256 hash for validation without decryption
  scopes TEXT[] DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  usage_count INTEGER DEFAULT 0,
  is_revoked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(social_account_id, token_type)
);

-- Create social_oauth_sessions table for OAuth flow tracking
CREATE TABLE IF NOT EXISTS social_oauth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_id TEXT NOT NULL REFERENCES social_platforms(id) ON DELETE CASCADE,
  state TEXT NOT NULL UNIQUE,
  code_verifier TEXT,
  code_challenge TEXT,
  redirect_uri TEXT NOT NULL,
  scopes TEXT[] DEFAULT '{}',
  nonce TEXT,
  session_data JSONB DEFAULT '{}',
  status TEXT CHECK (status IN ('pending', 'completed', 'expired', 'error')) DEFAULT 'pending',
  error_code TEXT,
  error_message TEXT,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create social_webhooks table for platform webhook management
CREATE TABLE IF NOT EXISTS social_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id TEXT NOT NULL REFERENCES social_platforms(id) ON DELETE CASCADE,
  webhook_id TEXT, -- Platform-specific webhook ID
  webhook_url TEXT NOT NULL,
  webhook_secret TEXT NOT NULL,
  events TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  last_ping_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform_id, webhook_id)
);

-- Create social_posts table for tracking published content
CREATE TABLE IF NOT EXISTS social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  social_account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  platform_post_id TEXT NOT NULL,
  content TEXT,
  media_urls TEXT[] DEFAULT '{}',
  hashtags TEXT[] DEFAULT '{}',
  mentions TEXT[] DEFAULT '{}',
  post_type TEXT CHECK (post_type IN ('text', 'image', 'video', 'carousel', 'story', 'reel')) DEFAULT 'text',
  engagement_metrics JSONB DEFAULT '{}', -- likes, shares, comments, views, etc.
  post_url TEXT,
  published_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(social_account_id, platform_post_id)
);

-- Create social_analytics table for platform analytics
CREATE TABLE IF NOT EXISTS social_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  social_account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL, -- impressions, reach, engagement, followers, etc.
  metric_value BIGINT NOT NULL,
  metric_date DATE NOT NULL,
  metric_period TEXT CHECK (metric_period IN ('daily', 'weekly', 'monthly')) DEFAULT 'daily',
  additional_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(social_account_id, metric_type, metric_date, metric_period)
);

-- Create social_rate_limits table for API rate limiting
CREATE TABLE IF NOT EXISTS social_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_id TEXT NOT NULL REFERENCES social_platforms(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  rate_limit INTEGER NOT NULL,
  rate_window INTEGER NOT NULL, -- in seconds
  current_usage INTEGER DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform_id, endpoint)
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_social_accounts_user_id ON social_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_platform_id ON social_accounts(platform_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_platform_user_id ON social_accounts(platform_user_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_status ON social_accounts(account_status);
CREATE INDEX IF NOT EXISTS idx_social_accounts_expires_at ON social_accounts(expires_at);

CREATE INDEX IF NOT EXISTS idx_social_tokens_account_id ON social_tokens(social_account_id);
CREATE INDEX IF NOT EXISTS idx_social_tokens_type ON social_tokens(token_type);
CREATE INDEX IF NOT EXISTS idx_social_tokens_expires_at ON social_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_social_tokens_revoked ON social_tokens(is_revoked);

CREATE INDEX IF NOT EXISTS idx_social_oauth_sessions_user_id ON social_oauth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_social_oauth_sessions_platform_id ON social_oauth_sessions(platform_id);
CREATE INDEX IF NOT EXISTS idx_social_oauth_sessions_state ON social_oauth_sessions(state);
CREATE INDEX IF NOT EXISTS idx_social_oauth_sessions_status ON social_oauth_sessions(status);
CREATE INDEX IF NOT EXISTS idx_social_oauth_sessions_expires_at ON social_oauth_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_social_posts_account_id ON social_posts(social_account_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_platform_post_id ON social_posts(platform_post_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_published_at ON social_posts(published_at);
CREATE INDEX IF NOT EXISTS idx_social_posts_type ON social_posts(post_type);

CREATE INDEX IF NOT EXISTS idx_social_analytics_account_id ON social_analytics(social_account_id);
CREATE INDEX IF NOT EXISTS idx_social_analytics_date ON social_analytics(metric_date);
CREATE INDEX IF NOT EXISTS idx_social_analytics_type ON social_analytics(metric_type);

CREATE INDEX IF NOT EXISTS idx_social_rate_limits_platform_endpoint ON social_rate_limits(platform_id, endpoint);
CREATE INDEX IF NOT EXISTS idx_social_rate_limits_reset_at ON social_rate_limits(reset_at);

-- Enable Row Level Security (RLS)
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_oauth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_analytics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for social_accounts
CREATE POLICY "Users can view their own social accounts" ON social_accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own social accounts" ON social_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own social accounts" ON social_accounts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own social accounts" ON social_accounts
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for social_tokens
CREATE POLICY "Users can view tokens for their social accounts" ON social_tokens
  FOR SELECT USING (
    social_account_id IN (
      SELECT id FROM social_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert tokens for their social accounts" ON social_tokens
  FOR INSERT WITH CHECK (
    social_account_id IN (
      SELECT id FROM social_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update tokens for their social accounts" ON social_tokens
  FOR UPDATE USING (
    social_account_id IN (
      SELECT id FROM social_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete tokens for their social accounts" ON social_tokens
  FOR DELETE USING (
    social_account_id IN (
      SELECT id FROM social_accounts WHERE user_id = auth.uid()
    )
  );

-- Create RLS policies for social_oauth_sessions
CREATE POLICY "Users can view their own OAuth sessions" ON social_oauth_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own OAuth sessions" ON social_oauth_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own OAuth sessions" ON social_oauth_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- Create RLS policies for social_posts
CREATE POLICY "Users can view posts from their social accounts" ON social_posts
  FOR SELECT USING (
    social_account_id IN (
      SELECT id FROM social_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert posts for their social accounts" ON social_posts
  FOR INSERT WITH CHECK (
    social_account_id IN (
      SELECT id FROM social_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update posts from their social accounts" ON social_posts
  FOR UPDATE USING (
    social_account_id IN (
      SELECT id FROM social_accounts WHERE user_id = auth.uid()
    )
  );

-- Create RLS policies for social_analytics
CREATE POLICY "Users can view analytics for their social accounts" ON social_analytics
  FOR SELECT USING (
    social_account_id IN (
      SELECT id FROM social_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert analytics for their social accounts" ON social_analytics
  FOR INSERT WITH CHECK (
    social_account_id IN (
      SELECT id FROM social_accounts WHERE user_id = auth.uid()
    )
  );

-- Create functions for token cleanup and maintenance
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM social_oauth_sessions 
  WHERE expires_at < NOW() AND status = 'pending';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION cleanup_revoked_tokens()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM social_tokens 
  WHERE is_revoked = true AND updated_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_social_account_sync()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.last_sync_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_social_accounts_updated_at
  BEFORE UPDATE ON social_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_social_account_sync();

CREATE TRIGGER update_social_tokens_updated_at
  BEFORE UPDATE ON social_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_social_platforms_updated_at
  BEFORE UPDATE ON social_platforms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function for token validation
CREATE OR REPLACE FUNCTION validate_social_token(
  p_social_account_id UUID,
  p_token_type TEXT,
  p_token_hash TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  token_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM social_tokens 
    WHERE social_account_id = p_social_account_id 
    AND token_type = p_token_type 
    AND token_hash = p_token_hash 
    AND is_revoked = false
    AND (expires_at IS NULL OR expires_at > NOW())
  ) INTO token_exists;
  
  RETURN token_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function for rate limit checking
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_platform_id TEXT,
  p_endpoint TEXT
)
RETURNS JSONB AS $$
DECLARE
  rate_info RECORD;
  result JSONB;
BEGIN
  SELECT * INTO rate_info
  FROM social_rate_limits 
  WHERE platform_id = p_platform_id AND endpoint = p_endpoint;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', -1,
      'reset_at', null
    );
  END IF;
  
  -- Reset counter if window has expired
  IF rate_info.reset_at <= NOW() THEN
    UPDATE social_rate_limits 
    SET current_usage = 0, 
        reset_at = NOW() + (rate_info.rate_window || ' seconds')::INTERVAL
    WHERE id = rate_info.id;
    
    rate_info.current_usage = 0;
  END IF;
  
  result = jsonb_build_object(
    'allowed', rate_info.current_usage < rate_info.rate_limit,
    'remaining', rate_info.rate_limit - rate_info.current_usage,
    'reset_at', rate_info.reset_at
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to increment rate limit usage
CREATE OR REPLACE FUNCTION increment_rate_limit(
  p_platform_id TEXT,
  p_endpoint TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE social_rate_limits 
  SET current_usage = current_usage + 1,
      updated_at = NOW()
  WHERE platform_id = p_platform_id AND endpoint = p_endpoint;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON TABLE social_platforms IS 'Configuration and metadata for supported social media platforms';
COMMENT ON TABLE social_accounts IS 'User connections to social media accounts';
COMMENT ON TABLE social_tokens IS 'Encrypted OAuth tokens for social media authentication';
COMMENT ON TABLE social_oauth_sessions IS 'Temporary OAuth flow session tracking';
COMMENT ON TABLE social_webhooks IS 'Platform webhook configurations for real-time updates';
COMMENT ON TABLE social_posts IS 'Published content tracking across platforms';
COMMENT ON TABLE social_analytics IS 'Social media analytics and metrics';
COMMENT ON TABLE social_rate_limits IS 'API rate limiting configuration and tracking';

COMMENT ON FUNCTION cleanup_expired_oauth_sessions() IS 'Removes expired OAuth sessions older than 10 minutes';
COMMENT ON FUNCTION cleanup_revoked_tokens() IS 'Removes revoked tokens older than 30 days';
COMMENT ON FUNCTION validate_social_token(UUID, TEXT, TEXT) IS 'Validates if a token hash exists and is valid';
COMMENT ON FUNCTION check_rate_limit(TEXT, TEXT) IS 'Checks API rate limit status for platform endpoint';
COMMENT ON FUNCTION increment_rate_limit(TEXT, TEXT) IS 'Increments rate limit usage counter';
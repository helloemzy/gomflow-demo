-- GOMFLOW Social Media Analytics Database Schema
-- Comprehensive analytics tracking for all social media platforms

-- Social Media Platforms tracking
CREATE TABLE social_platforms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    api_version TEXT,
    base_url TEXT,
    rate_limits JSONB DEFAULT '{}',
    capabilities JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Social Media Accounts linked to GOMs
CREATE TABLE social_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gom_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform_id UUID NOT NULL REFERENCES social_platforms(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL, -- Platform-specific account ID
    username TEXT NOT NULL,
    display_name TEXT,
    follower_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    post_count INTEGER DEFAULT 0,
    profile_url TEXT,
    avatar_url TEXT,
    bio TEXT,
    access_token TEXT, -- Encrypted token for API access
    refresh_token TEXT, -- Encrypted refresh token
    token_expires_at TIMESTAMP WITH TIME ZONE,
    is_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(platform_id, account_id)
);

-- Social Media Posts tracking
CREATE TABLE social_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    platform_post_id TEXT NOT NULL,
    post_type TEXT NOT NULL CHECK (post_type IN ('text', 'image', 'video', 'carousel', 'story', 'reel', 'live')),
    content TEXT,
    media_urls TEXT[],
    hashtags TEXT[],
    mentions TEXT[],
    engagement_score DECIMAL(5,2) DEFAULT 0,
    reach INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    saves_count INTEGER DEFAULT 0,
    clicks_count INTEGER DEFAULT 0,
    video_views INTEGER DEFAULT 0,
    video_completion_rate DECIMAL(5,2) DEFAULT 0,
    sentiment_score DECIMAL(3,2) DEFAULT 0, -- -1 to 1
    sentiment_label TEXT CHECK (sentiment_label IN ('positive', 'negative', 'neutral')),
    is_promoted BOOLEAN DEFAULT false,
    promotion_budget DECIMAL(10,2),
    promotion_reach INTEGER DEFAULT 0,
    posted_at TIMESTAMP WITH TIME ZONE NOT NULL,
    analyzed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(account_id, platform_post_id)
);

-- Engagement Metrics (granular tracking)
CREATE TABLE engagement_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
    metric_type TEXT NOT NULL CHECK (metric_type IN ('like', 'comment', 'share', 'save', 'click', 'view', 'mention', 'dm')),
    user_id TEXT, -- Platform-specific user ID
    username TEXT,
    engagement_value INTEGER DEFAULT 1,
    sentiment_score DECIMAL(3,2), -- For comments/mentions
    content TEXT, -- Comment content or mention context
    metadata JSONB DEFAULT '{}',
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audience Analytics
CREATE TABLE audience_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_followers INTEGER DEFAULT 0,
    new_followers INTEGER DEFAULT 0,
    unfollowers INTEGER DEFAULT 0,
    net_follower_change INTEGER DEFAULT 0,
    demographics JSONB DEFAULT '{}', -- Age, gender, location breakdown
    interests JSONB DEFAULT '{}', -- Audience interests
    active_hours JSONB DEFAULT '{}', -- When audience is most active
    engagement_rate DECIMAL(5,2) DEFAULT 0,
    reach_rate DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(account_id, date)
);

-- Content Performance Scoring
CREATE TABLE content_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
    performance_score DECIMAL(5,2) DEFAULT 0, -- 0-100 score
    engagement_score DECIMAL(5,2) DEFAULT 0,
    reach_score DECIMAL(5,2) DEFAULT 0,
    conversion_score DECIMAL(5,2) DEFAULT 0,
    viral_score DECIMAL(5,2) DEFAULT 0,
    quality_score DECIMAL(5,2) DEFAULT 0,
    timing_score DECIMAL(5,2) DEFAULT 0,
    hashtag_performance JSONB DEFAULT '{}',
    content_insights JSONB DEFAULT '{}',
    optimization_suggestions TEXT[],
    benchmark_comparison JSONB DEFAULT '{}',
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Campaign Tracking
CREATE TABLE social_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gom_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    campaign_type TEXT NOT NULL CHECK (campaign_type IN ('product_launch', 'flash_sale', 'pre_order', 'group_buy', 'engagement', 'awareness')),
    platforms TEXT[] NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    budget DECIMAL(10,2),
    target_metrics JSONB DEFAULT '{}',
    actual_metrics JSONB DEFAULT '{}',
    roi DECIMAL(8,2),
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Campaign Posts (Many-to-Many)
CREATE TABLE campaign_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES social_campaigns(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
    post_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(campaign_id, post_id)
);

-- Conversion Tracking
CREATE TABLE social_conversions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES social_posts(id) ON DELETE SET NULL,
    campaign_id UUID REFERENCES social_campaigns(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    submission_id UUID REFERENCES order_submissions(id) ON DELETE SET NULL,
    conversion_type TEXT NOT NULL CHECK (conversion_type IN ('view', 'click', 'sign_up', 'order', 'payment')),
    user_id TEXT, -- Platform-specific user ID
    session_id TEXT,
    referrer_url TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_content TEXT,
    conversion_value DECIMAL(10,2),
    metadata JSONB DEFAULT '{}',
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Competitor Analysis
CREATE TABLE competitor_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gom_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform_id UUID NOT NULL REFERENCES social_platforms(id) ON DELETE CASCADE,
    competitor_name TEXT NOT NULL,
    account_id TEXT NOT NULL, -- Platform-specific account ID
    username TEXT NOT NULL,
    category TEXT,
    tier TEXT CHECK (tier IN ('direct', 'indirect', 'aspirational')),
    follower_count INTEGER DEFAULT 0,
    engagement_rate DECIMAL(5,2) DEFAULT 0,
    post_frequency DECIMAL(5,2) DEFAULT 0, -- Posts per day
    is_monitoring BOOLEAN DEFAULT true,
    last_analyzed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(gom_id, platform_id, account_id)
);

-- Competitor Performance Tracking
CREATE TABLE competitor_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competitor_id UUID NOT NULL REFERENCES competitor_accounts(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    follower_count INTEGER DEFAULT 0,
    posts_count INTEGER DEFAULT 0,
    total_likes INTEGER DEFAULT 0,
    total_comments INTEGER DEFAULT 0,
    total_shares INTEGER DEFAULT 0,
    average_engagement_rate DECIMAL(5,2) DEFAULT 0,
    top_performing_content JSONB DEFAULT '{}',
    content_themes TEXT[],
    posting_patterns JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(competitor_id, date)
);

-- Analytics Reports
CREATE TABLE analytics_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gom_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    report_type TEXT NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly', 'campaign', 'competitor', 'custom')),
    report_name TEXT NOT NULL,
    date_range_start DATE NOT NULL,
    date_range_end DATE NOT NULL,
    platforms TEXT[],
    metrics JSONB NOT NULL DEFAULT '{}',
    insights TEXT[],
    recommendations TEXT[],
    charts_data JSONB DEFAULT '{}',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
    file_url TEXT, -- URL to generated PDF/Excel report
    scheduled_at TIMESTAMP WITH TIME ZONE,
    generated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Real-time Analytics Cache
CREATE TABLE analytics_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key TEXT NOT NULL UNIQUE,
    cache_type TEXT NOT NULL CHECK (cache_type IN ('metrics', 'charts', 'insights', 'rankings')),
    account_id UUID REFERENCES social_accounts(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance optimization
CREATE INDEX idx_social_accounts_gom_platform ON social_accounts(gom_id, platform_id);
CREATE INDEX idx_social_posts_account_posted ON social_posts(account_id, posted_at DESC);
CREATE INDEX idx_social_posts_order_id ON social_posts(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX idx_engagement_metrics_post_type ON engagement_metrics(post_id, metric_type);
CREATE INDEX idx_engagement_metrics_occurred ON engagement_metrics(occurred_at DESC);
CREATE INDEX idx_audience_analytics_account_date ON audience_analytics(account_id, date DESC);
CREATE INDEX idx_content_performance_score ON content_performance(performance_score DESC);
CREATE INDEX idx_social_conversions_post_campaign ON social_conversions(post_id, campaign_id);
CREATE INDEX idx_social_conversions_occurred ON social_conversions(occurred_at DESC);
CREATE INDEX idx_competitor_performance_date ON competitor_performance(competitor_id, date DESC);
CREATE INDEX idx_analytics_cache_key_expires ON analytics_cache(cache_key, expires_at);

-- Functions for analytics calculations
CREATE OR REPLACE FUNCTION calculate_engagement_rate(post_id UUID)
RETURNS DECIMAL(5,2) AS $$
DECLARE
    total_engagement INTEGER;
    total_reach INTEGER;
    engagement_rate DECIMAL(5,2);
BEGIN
    SELECT 
        COALESCE(likes_count, 0) + COALESCE(comments_count, 0) + COALESCE(shares_count, 0) + COALESCE(saves_count, 0),
        COALESCE(reach, 0)
    INTO total_engagement, total_reach
    FROM social_posts 
    WHERE id = post_id;
    
    IF total_reach > 0 THEN
        engagement_rate := (total_engagement::DECIMAL / total_reach::DECIMAL) * 100;
    ELSE
        engagement_rate := 0;
    END IF;
    
    RETURN LEAST(engagement_rate, 100.00);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_post_engagement_score()
RETURNS TRIGGER AS $$
BEGIN
    NEW.engagement_score := calculate_engagement_rate(NEW.id);
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_post_engagement_score
    BEFORE UPDATE ON social_posts
    FOR EACH ROW
    WHEN (OLD.likes_count IS DISTINCT FROM NEW.likes_count OR 
          OLD.comments_count IS DISTINCT FROM NEW.comments_count OR 
          OLD.shares_count IS DISTINCT FROM NEW.shares_count OR 
          OLD.saves_count IS DISTINCT FROM NEW.saves_count OR 
          OLD.reach IS DISTINCT FROM NEW.reach)
    EXECUTE FUNCTION update_post_engagement_score();

-- Function to get platform analytics summary
CREATE OR REPLACE FUNCTION get_platform_analytics_summary(
    account_id_param UUID,
    start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_posts', COUNT(*),
        'total_reach', SUM(reach),
        'total_impressions', SUM(impressions),
        'total_likes', SUM(likes_count),
        'total_comments', SUM(comments_count),
        'total_shares', SUM(shares_count),
        'average_engagement_rate', AVG(engagement_score),
        'top_performing_post', (
            SELECT jsonb_build_object(
                'id', id,
                'content', LEFT(content, 100),
                'engagement_score', engagement_score,
                'reach', reach
            )
            FROM social_posts sp
            WHERE sp.account_id = account_id_param
            AND DATE(sp.posted_at) BETWEEN start_date AND end_date
            ORDER BY engagement_score DESC
            LIMIT 1
        )
    ) INTO result
    FROM social_posts
    WHERE account_id = account_id_param
    AND DATE(posted_at) BETWEEN start_date AND end_date;
    
    RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies
ALTER TABLE social_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE audience_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_cache ENABLE ROW LEVEL SECURITY;

-- Policies for social_platforms (public read)
CREATE POLICY "Social platforms are viewable by all users" ON social_platforms
    FOR SELECT USING (true);

-- Policies for social_accounts
CREATE POLICY "Users can view their own social accounts" ON social_accounts
    FOR SELECT USING (auth.uid() = gom_id);

CREATE POLICY "Users can insert their own social accounts" ON social_accounts
    FOR INSERT WITH CHECK (auth.uid() = gom_id);

CREATE POLICY "Users can update their own social accounts" ON social_accounts
    FOR UPDATE USING (auth.uid() = gom_id);

CREATE POLICY "Users can delete their own social accounts" ON social_accounts
    FOR DELETE USING (auth.uid() = gom_id);

-- Policies for social_posts
CREATE POLICY "Users can view posts from their social accounts" ON social_posts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM social_accounts sa 
            WHERE sa.id = social_posts.account_id 
            AND sa.gom_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert posts to their social accounts" ON social_posts
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM social_accounts sa 
            WHERE sa.id = social_posts.account_id 
            AND sa.gom_id = auth.uid()
        )
    );

CREATE POLICY "Users can update posts from their social accounts" ON social_posts
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM social_accounts sa 
            WHERE sa.id = social_posts.account_id 
            AND sa.gom_id = auth.uid()
        )
    );

-- Policies for engagement_metrics
CREATE POLICY "Users can view engagement metrics for their posts" ON engagement_metrics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM social_posts sp
            JOIN social_accounts sa ON sa.id = sp.account_id
            WHERE sp.id = engagement_metrics.post_id 
            AND sa.gom_id = auth.uid()
        )
    );

-- Policies for audience_analytics
CREATE POLICY "Users can view audience analytics for their accounts" ON audience_analytics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM social_accounts sa 
            WHERE sa.id = audience_analytics.account_id 
            AND sa.gom_id = auth.uid()
        )
    );

-- Policies for content_performance
CREATE POLICY "Users can view content performance for their posts" ON content_performance
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM social_posts sp
            JOIN social_accounts sa ON sa.id = sp.account_id
            WHERE sp.id = content_performance.post_id 
            AND sa.gom_id = auth.uid()
        )
    );

-- Policies for social_campaigns
CREATE POLICY "Users can manage their own campaigns" ON social_campaigns
    FOR ALL USING (auth.uid() = gom_id);

-- Policies for competitor_accounts
CREATE POLICY "Users can manage their own competitor tracking" ON competitor_accounts
    FOR ALL USING (auth.uid() = gom_id);

-- Policies for analytics_reports
CREATE POLICY "Users can manage their own analytics reports" ON analytics_reports
    FOR ALL USING (auth.uid() = gom_id);

-- Insert default social platforms
INSERT INTO social_platforms (name, display_name, api_version, base_url, capabilities) VALUES
('twitter', 'Twitter/X', 'v2', 'https://api.twitter.com', '{"posts": true, "analytics": true, "streaming": true}'),
('instagram', 'Instagram', 'v17.0', 'https://graph.instagram.com', '{"posts": true, "stories": true, "analytics": true}'),
('facebook', 'Facebook', 'v18.0', 'https://graph.facebook.com', '{"posts": true, "analytics": true, "ads": true}'),
('tiktok', 'TikTok', 'v1.3', 'https://open-api.tiktok.com', '{"posts": true, "analytics": true, "ads": true}'),
('discord', 'Discord', 'v10', 'https://discord.com/api', '{"messages": true, "webhooks": true, "analytics": false}'),
('telegram', 'Telegram', 'bot6.9', 'https://api.telegram.org', '{"messages": true, "channels": true, "analytics": false}');

-- Add analytics cache cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM analytics_cache WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create scheduled job for cache cleanup (if pg_cron is available)
-- SELECT cron.schedule('cleanup-analytics-cache', '0 */6 * * *', 'SELECT cleanup_expired_cache();');
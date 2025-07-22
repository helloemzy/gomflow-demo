-- Social Media Content Management Database Schema
-- Migration: 20250119000002_social_content_management
-- Extends the social media integration schema with content creation, templates, and scheduling

-- Create content_templates table for reusable post templates
CREATE TABLE IF NOT EXISTS content_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('k-pop', 'merchandise', 'promotion', 'update', 'announcement', 'custom')) DEFAULT 'custom',
  template_type TEXT CHECK (template_type IN ('text', 'image', 'video', 'carousel', 'story')) DEFAULT 'text',
  content_template TEXT NOT NULL,
  variables JSONB DEFAULT '{}', -- Template variables like {order_title}, {deadline}, etc.
  platform_configs JSONB DEFAULT '{}', -- Platform-specific configurations
  media_requirements JSONB DEFAULT '{}', -- Media size/format requirements
  hashtags TEXT[] DEFAULT '{}',
  default_mentions TEXT[] DEFAULT '{}',
  is_public BOOLEAN DEFAULT false, -- Allow other users to use this template
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create content_queue table for scheduled posts
CREATE TABLE IF NOT EXISTS content_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES content_templates(id) ON DELETE SET NULL,
  social_account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  content_data JSONB NOT NULL, -- Generated content with variables filled
  media_files JSONB DEFAULT '{}', -- Media file URLs and metadata
  scheduled_for TIMESTAMPTZ NOT NULL,
  optimal_time TIMESTAMPTZ, -- AI-suggested optimal posting time
  priority INTEGER DEFAULT 0 CHECK (priority >= 0 AND priority <= 10),
  status TEXT CHECK (status IN ('scheduled', 'processing', 'posted', 'failed', 'cancelled')) DEFAULT 'scheduled',
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  posted_at TIMESTAMPTZ,
  platform_post_id TEXT,
  error_message TEXT,
  engagement_prediction JSONB DEFAULT '{}', -- AI-predicted engagement metrics
  actual_engagement JSONB DEFAULT '{}', -- Actual engagement after posting
  cross_post_group_id UUID, -- For cross-platform posting
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create media_library table for uploaded media files
CREATE TABLE IF NOT EXISTS media_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  file_url TEXT NOT NULL, -- Supabase Storage URL
  thumbnail_url TEXT, -- For videos and large images
  alt_text TEXT,
  tags TEXT[] DEFAULT '{}',
  platform_versions JSONB DEFAULT '{}', -- Different versions for different platforms
  metadata JSONB DEFAULT '{}', -- EXIF data, dimensions, duration, etc.
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create content_campaigns table for organized content campaigns
CREATE TABLE IF NOT EXISTS content_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  campaign_type TEXT CHECK (campaign_type IN ('order_promotion', 'comeback_announcement', 'milestone_celebration', 'seasonal', 'custom')) DEFAULT 'custom',
  start_date DATE,
  end_date DATE,
  target_platforms TEXT[] DEFAULT '{}',
  budget_estimate DECIMAL(10,2),
  expected_reach INTEGER,
  campaign_tags TEXT[] DEFAULT '{}',
  status TEXT CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled')) DEFAULT 'draft',
  analytics_summary JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create content_analytics table for detailed content performance tracking
CREATE TABLE IF NOT EXISTS content_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_queue_id UUID NOT NULL REFERENCES content_queue(id) ON DELETE CASCADE,
  platform_id TEXT NOT NULL REFERENCES social_platforms(id),
  metric_type TEXT NOT NULL, -- likes, shares, comments, saves, clicks, reach, impressions
  metric_value BIGINT NOT NULL,
  metric_timestamp TIMESTAMPTZ NOT NULL,
  audience_data JSONB DEFAULT '{}', -- Demographics, location data
  performance_score DECIMAL(5,2), -- Normalized performance score 0-100
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create posting_schedules table for optimized posting schedules
CREATE TABLE IF NOT EXISTS posting_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  social_account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
  optimal_hours INTEGER[] DEFAULT '{}', -- Array of optimal hours (0-23)
  audience_timezone TEXT DEFAULT 'UTC',
  engagement_weights JSONB DEFAULT '{}', -- Historical engagement data
  auto_schedule BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, social_account_id, day_of_week)
);

-- Create content_approval_workflow table for team collaboration
CREATE TABLE IF NOT EXISTS content_approval_workflow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_queue_id UUID NOT NULL REFERENCES content_queue(id) ON DELETE CASCADE,
  approver_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'needs_revision')) DEFAULT 'pending',
  comments TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create hashtag_analytics table for hashtag performance tracking
CREATE TABLE IF NOT EXISTS hashtag_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hashtag TEXT NOT NULL,
  platform_id TEXT NOT NULL REFERENCES social_platforms(id),
  usage_count INTEGER DEFAULT 1,
  total_reach BIGINT DEFAULT 0,
  total_engagement BIGINT DEFAULT 0,
  avg_performance_score DECIMAL(5,2) DEFAULT 0,
  trending_score DECIMAL(5,2) DEFAULT 0,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(hashtag, platform_id)
);

-- Add indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_content_templates_user_id ON content_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_content_templates_category ON content_templates(category);
CREATE INDEX IF NOT EXISTS idx_content_templates_public ON content_templates(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_content_templates_usage ON content_templates(usage_count DESC);

CREATE INDEX IF NOT EXISTS idx_content_queue_user_id ON content_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_content_queue_account_id ON content_queue(social_account_id);
CREATE INDEX IF NOT EXISTS idx_content_queue_scheduled_for ON content_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_content_queue_status ON content_queue(status);
CREATE INDEX IF NOT EXISTS idx_content_queue_priority ON content_queue(priority DESC);
CREATE INDEX IF NOT EXISTS idx_content_queue_cross_post ON content_queue(cross_post_group_id);

CREATE INDEX IF NOT EXISTS idx_media_library_user_id ON media_library(user_id);
CREATE INDEX IF NOT EXISTS idx_media_library_mime_type ON media_library(mime_type);
CREATE INDEX IF NOT EXISTS idx_media_library_tags ON media_library USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_media_library_usage ON media_library(usage_count DESC);

CREATE INDEX IF NOT EXISTS idx_content_campaigns_user_id ON content_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_content_campaigns_status ON content_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_content_campaigns_dates ON content_campaigns(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_content_analytics_queue_id ON content_analytics(content_queue_id);
CREATE INDEX IF NOT EXISTS idx_content_analytics_platform ON content_analytics(platform_id);
CREATE INDEX IF NOT EXISTS idx_content_analytics_timestamp ON content_analytics(metric_timestamp);
CREATE INDEX IF NOT EXISTS idx_content_analytics_metric ON content_analytics(metric_type, metric_value);

CREATE INDEX IF NOT EXISTS idx_posting_schedules_user_account ON posting_schedules(user_id, social_account_id);
CREATE INDEX IF NOT EXISTS idx_posting_schedules_auto ON posting_schedules(auto_schedule) WHERE auto_schedule = true;

CREATE INDEX IF NOT EXISTS idx_content_approval_queue_id ON content_approval_workflow(content_queue_id);
CREATE INDEX IF NOT EXISTS idx_content_approval_approver ON content_approval_workflow(approver_user_id);
CREATE INDEX IF NOT EXISTS idx_content_approval_status ON content_approval_workflow(status);

CREATE INDEX IF NOT EXISTS idx_hashtag_analytics_platform ON hashtag_analytics(platform_id);
CREATE INDEX IF NOT EXISTS idx_hashtag_analytics_hashtag ON hashtag_analytics(hashtag);
CREATE INDEX IF NOT EXISTS idx_hashtag_analytics_trending ON hashtag_analytics(trending_score DESC);
CREATE INDEX IF NOT EXISTS idx_hashtag_analytics_performance ON hashtag_analytics(avg_performance_score DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE content_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE posting_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_approval_workflow ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for content_templates
CREATE POLICY "Users can view their own templates and public templates" ON content_templates
  FOR SELECT USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Users can insert their own templates" ON content_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates" ON content_templates
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates" ON content_templates
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for content_queue
CREATE POLICY "Users can view their own content queue" ON content_queue
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own content queue" ON content_queue
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own content queue" ON content_queue
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own content queue" ON content_queue
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for media_library
CREATE POLICY "Users can view their own media" ON media_library
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own media" ON media_library
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own media" ON media_library
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own media" ON media_library
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for content_campaigns
CREATE POLICY "Users can view their own campaigns" ON content_campaigns
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own campaigns" ON content_campaigns
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaigns" ON content_campaigns
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own campaigns" ON content_campaigns
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for content_analytics
CREATE POLICY "Users can view analytics for their content" ON content_analytics
  FOR SELECT USING (
    content_queue_id IN (
      SELECT id FROM content_queue WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert analytics" ON content_analytics
  FOR INSERT WITH CHECK (true); -- Allow system inserts

-- Create RLS policies for posting_schedules
CREATE POLICY "Users can view their own posting schedules" ON posting_schedules
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own posting schedules" ON posting_schedules
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posting schedules" ON posting_schedules
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posting schedules" ON posting_schedules
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for content_approval_workflow
CREATE POLICY "Users can view approval workflows for their content" ON content_approval_workflow
  FOR SELECT USING (
    content_queue_id IN (
      SELECT id FROM content_queue WHERE user_id = auth.uid()
    ) OR approver_user_id = auth.uid()
  );

CREATE POLICY "Approvers can insert approval decisions" ON content_approval_workflow
  FOR INSERT WITH CHECK (auth.uid() = approver_user_id);

CREATE POLICY "Approvers can update their approval decisions" ON content_approval_workflow
  FOR UPDATE USING (auth.uid() = approver_user_id);

-- Create functions for content management

-- Function to update template usage count
CREATE OR REPLACE FUNCTION increment_template_usage(template_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE content_templates 
  SET usage_count = usage_count + 1,
      updated_at = NOW()
  WHERE id = template_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get optimal posting time
CREATE OR REPLACE FUNCTION get_optimal_posting_time(
  p_social_account_id UUID,
  p_target_date DATE DEFAULT CURRENT_DATE
)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  optimal_hour INTEGER;
  target_datetime TIMESTAMPTZ;
BEGIN
  -- Get the most optimal hour for the account and day of week
  SELECT 
    COALESCE(
      (SELECT unnest(optimal_hours) 
       FROM posting_schedules 
       WHERE social_account_id = p_social_account_id 
       AND day_of_week = EXTRACT(DOW FROM p_target_date)
       ORDER BY random() 
       LIMIT 1), 
      12 -- Default to noon if no schedule found
    ) INTO optimal_hour;
  
  target_datetime := p_target_date + (optimal_hour || ' hours')::INTERVAL;
  
  -- If the time has already passed today, schedule for tomorrow
  IF target_datetime <= NOW() THEN
    target_datetime := target_datetime + INTERVAL '1 day';
  END IF;
  
  RETURN target_datetime;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate content performance score
CREATE OR REPLACE FUNCTION calculate_performance_score(
  p_content_queue_id UUID
)
RETURNS DECIMAL AS $$
DECLARE
  total_score DECIMAL := 0;
  metric_count INTEGER := 0;
  engagement_rate DECIMAL;
  reach_score DECIMAL;
BEGIN
  -- Calculate engagement rate (likes + comments + shares) / reach
  WITH metrics AS (
    SELECT 
      metric_type,
      metric_value
    FROM content_analytics 
    WHERE content_queue_id = p_content_queue_id
  ),
  engagement AS (
    SELECT 
      COALESCE(SUM(CASE WHEN metric_type IN ('likes', 'comments', 'shares', 'saves') THEN metric_value END), 0) as total_engagement,
      COALESCE(MAX(CASE WHEN metric_type = 'reach' THEN metric_value END), 1) as total_reach
    FROM metrics
  )
  SELECT 
    CASE 
      WHEN total_reach > 0 THEN (total_engagement::DECIMAL / total_reach::DECIMAL) * 100
      ELSE 0 
    END
  INTO engagement_rate
  FROM engagement;
  
  -- Normalize to 0-100 scale (engagement rates above 10% get max score)
  total_score := LEAST(engagement_rate * 10, 100);
  
  RETURN COALESCE(total_score, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update hashtag analytics
CREATE OR REPLACE FUNCTION update_hashtag_analytics(
  p_hashtags TEXT[],
  p_platform_id TEXT,
  p_reach BIGINT DEFAULT 0,
  p_engagement BIGINT DEFAULT 0
)
RETURNS VOID AS $$
DECLARE
  hashtag TEXT;
  current_avg DECIMAL;
  new_performance DECIMAL;
BEGIN
  FOREACH hashtag IN ARRAY p_hashtags
  LOOP
    -- Calculate performance score for this usage
    new_performance := CASE 
      WHEN p_reach > 0 THEN (p_engagement::DECIMAL / p_reach::DECIMAL) * 100
      ELSE 0 
    END;
    
    -- Insert or update hashtag analytics
    INSERT INTO hashtag_analytics (
      hashtag, 
      platform_id, 
      usage_count, 
      total_reach, 
      total_engagement,
      avg_performance_score,
      last_used_at
    ) VALUES (
      hashtag,
      p_platform_id,
      1,
      p_reach,
      p_engagement,
      new_performance,
      NOW()
    )
    ON CONFLICT (hashtag, platform_id) DO UPDATE SET
      usage_count = hashtag_analytics.usage_count + 1,
      total_reach = hashtag_analytics.total_reach + p_reach,
      total_engagement = hashtag_analytics.total_engagement + p_engagement,
      avg_performance_score = (
        (hashtag_analytics.avg_performance_score * hashtag_analytics.usage_count + new_performance) / 
        (hashtag_analytics.usage_count + 1)
      ),
      last_used_at = NOW(),
      updated_at = NOW();
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup old content queue items
CREATE OR REPLACE FUNCTION cleanup_old_content_queue()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete posted content older than 90 days
  DELETE FROM content_queue 
  WHERE status = 'posted' 
  AND posted_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Delete failed content older than 30 days
  DELETE FROM content_queue 
  WHERE status = 'failed' 
  AND updated_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_content_templates_updated_at
  BEFORE UPDATE ON content_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_queue_updated_at
  BEFORE UPDATE ON content_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_media_library_updated_at
  BEFORE UPDATE ON media_library
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_campaigns_updated_at
  BEFORE UPDATE ON content_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posting_schedules_updated_at
  BEFORE UPDATE ON posting_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hashtag_analytics_updated_at
  BEFORE UPDATE ON hashtag_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default K-pop content templates
INSERT INTO content_templates (
  user_id, 
  name, 
  description, 
  category, 
  template_type, 
  content_template, 
  variables, 
  hashtags, 
  is_public
) VALUES
(
  '00000000-0000-0000-0000-000000000000', -- System user for public templates
  'Group Order Announcement',
  'Standard template for announcing new group orders',
  'k-pop',
  'text',
  '🎵 NEW GROUP ORDER OPEN! 🎵

📀 {order_title}
💰 Price: {price} {currency}
📅 Deadline: {deadline}
📦 Shipping: {shipping_info}

{order_description}

To join: {order_link}

#GroupOrder #KPop #GOMFLOW',
  '{"order_title": "Album/Merchandise Name", "price": "25.00", "currency": "USD", "deadline": "March 15", "shipping_info": "Worldwide", "order_description": "Limited edition album with exclusive photocard", "order_link": "gomflow.com/order/123"}',
  ARRAY['GroupOrder', 'KPop', 'GOMFLOW'],
  true
),
(
  '00000000-0000-0000-0000-000000000000',
  'Order Update Reminder',
  'Template for sending payment reminders and updates',
  'update',
  'text',
  '⏰ REMINDER: {order_title}

📅 Only {days_left} days left to join!
💳 {paid_count}/{total_slots} payments received
📊 {percentage}% quota filled

Don''t miss out! Join now: {order_link}

#LastChance #GroupOrder #KPop',
  '{"order_title": "Album Name", "days_left": "3", "paid_count": "45", "total_slots": "100", "percentage": "45", "order_link": "gomflow.com/order/123"}',
  ARRAY['LastChance', 'GroupOrder', 'KPop'],
  true
),
(
  '00000000-0000-0000-0000-000000000000',
  'Order Closed Success',
  'Template for announcing successful order completion',
  'announcement',
  'text',
  '✅ ORDER CLOSED SUCCESSFULLY! ✅

🎉 {order_title} - FULLY FUNDED!
👥 {total_participants} amazing participants
💝 Expected delivery: {delivery_date}

Thank you for your trust! Updates coming soon 📦

#OrderComplete #ThankYou #KPop #GOMFLOW',
  '{"order_title": "Album Name", "total_participants": "100", "delivery_date": "April 2024"}',
  ARRAY['OrderComplete', 'ThankYou', 'KPop', 'GOMFLOW'],
  true
),
(
  '00000000-0000-0000-0000-000000000000',
  'Comeback Announcement',
  'Template for artist comeback announcements',
  'k-pop',
  'text',
  '🚨 COMEBACK ALERT! 🚨

{artist_name} is coming back!
📅 Release Date: {release_date}
💿 Album: {album_name}

Pre-order group order starting soon!
Stay tuned for details 👀

#Comeback #{artist_hashtag} #KPop #PreOrder',
  '{"artist_name": "BLACKPINK", "release_date": "March 2024", "album_name": "NEW ALBUM", "artist_hashtag": "BLACKPINK"}',
  ARRAY['Comeback', 'KPop', 'PreOrder'],
  true
),
(
  '00000000-0000-0000-0000-000000000000',
  'Shipping Update',
  'Template for shipping and delivery updates',
  'update',
  'text',
  '📦 SHIPPING UPDATE 📦

{order_title} has been shipped! 🎉

📋 Tracking: {tracking_number}
🚚 Carrier: {carrier}
📍 Expected delivery: {delivery_date}

Check your order status: {tracking_link}

#Shipped #Delivery #Update #GOMFLOW',
  '{"order_title": "Album Name", "tracking_number": "1Z999AA1234567890", "carrier": "DHL", "delivery_date": "March 25", "tracking_link": "gomflow.com/track/123"}',
  ARRAY['Shipped', 'Delivery', 'Update', 'GOMFLOW'],
  true
)
ON CONFLICT DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE content_templates IS 'Reusable content templates for social media posts';
COMMENT ON TABLE content_queue IS 'Scheduled social media posts with content and timing';
COMMENT ON TABLE media_library IS 'User uploaded media files with platform optimization';
COMMENT ON TABLE content_campaigns IS 'Organized content marketing campaigns';
COMMENT ON TABLE content_analytics IS 'Detailed performance analytics for posted content';
COMMENT ON TABLE posting_schedules IS 'Optimized posting schedules based on audience engagement';
COMMENT ON TABLE content_approval_workflow IS 'Team collaboration for content approval';
COMMENT ON TABLE hashtag_analytics IS 'Performance tracking for hashtags across platforms';

COMMENT ON FUNCTION increment_template_usage(UUID) IS 'Increments usage count when template is used';
COMMENT ON FUNCTION get_optimal_posting_time(UUID, DATE) IS 'Calculates optimal posting time based on audience data';
COMMENT ON FUNCTION calculate_performance_score(UUID) IS 'Calculates normalized performance score for content';
COMMENT ON FUNCTION update_hashtag_analytics(TEXT[], TEXT, BIGINT, BIGINT) IS 'Updates hashtag performance metrics';
COMMENT ON FUNCTION cleanup_old_content_queue() IS 'Removes old content queue items to maintain database performance';
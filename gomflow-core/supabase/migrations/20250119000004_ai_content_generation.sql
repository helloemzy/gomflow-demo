-- AI Content Generation Schema
-- Tables for AI-powered social media content generation system

-- Content generation prompts and templates
CREATE TABLE IF NOT EXISTS ai_content_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL, -- 'kpop', 'merchandise', 'group_order', 'general'
    platform VARCHAR(50) NOT NULL, -- 'twitter', 'instagram', 'tiktok', 'facebook', 'telegram'
    language VARCHAR(10) NOT NULL DEFAULT 'en', -- 'en', 'ko', 'tl', 'id', 'th', 'ms'
    system_prompt TEXT NOT NULL,
    user_prompt_template TEXT NOT NULL,
    variables JSONB DEFAULT '[]', -- Array of variable names like ['artist', 'product', 'price']
    tags TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Generated content storage
CREATE TABLE IF NOT EXISTS ai_generated_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_id UUID REFERENCES ai_content_prompts(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    content_type VARCHAR(50) NOT NULL, -- 'text', 'image', 'video', 'carousel'
    text_content TEXT,
    image_url TEXT,
    image_prompt TEXT,
    hashtags TEXT[] DEFAULT '{}',
    variables_used JSONB DEFAULT '{}',
    quality_score DECIMAL(3,2), -- 0.00 to 10.00
    engagement_prediction DECIMAL(5,2), -- Predicted engagement rate percentage
    sentiment_score DECIMAL(3,2), -- -1.00 to 1.00 (negative to positive)
    cultural_relevance_score DECIMAL(3,2), -- 0.00 to 10.00
    status VARCHAR(50) DEFAULT 'generated', -- 'generated', 'reviewed', 'approved', 'published', 'rejected'
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- A/B testing variants
CREATE TABLE IF NOT EXISTS ai_content_ab_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    base_content_id UUID REFERENCES ai_generated_content(id) ON DELETE CASCADE,
    variant_content_ids UUID[] DEFAULT '{}', -- Array of content IDs for variants
    test_type VARCHAR(50) NOT NULL, -- 'text_variation', 'image_variation', 'hashtag_variation', 'timing'
    platform VARCHAR(50) NOT NULL,
    target_audience JSONB DEFAULT '{}', -- Audience targeting criteria
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'running', 'completed', 'paused'
    winner_content_id UUID REFERENCES ai_generated_content(id),
    confidence_level DECIMAL(3,2), -- 0.00 to 1.00
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- A/B test performance metrics
CREATE TABLE IF NOT EXISTS ai_content_ab_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID REFERENCES ai_content_ab_tests(id) ON DELETE CASCADE,
    content_id UUID REFERENCES ai_generated_content(id) ON DELETE CASCADE,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    saves INTEGER DEFAULT 0,
    click_through_rate DECIMAL(5,4), -- 0.0000 to 1.0000
    engagement_rate DECIMAL(5,4), -- 0.0000 to 1.0000
    conversion_rate DECIMAL(5,4), -- 0.0000 to 1.0000
    cost_per_engagement DECIMAL(10,2),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Content quality assessments
CREATE TABLE IF NOT EXISTS ai_content_quality_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES ai_generated_content(id) ON DELETE CASCADE,
    assessment_type VARCHAR(50) NOT NULL, -- 'automated', 'human', 'hybrid'
    assessor_id UUID REFERENCES auth.users(id), -- NULL for automated assessments
    overall_score DECIMAL(3,2) NOT NULL, -- 0.00 to 10.00
    creativity_score DECIMAL(3,2), -- 0.00 to 10.00
    relevance_score DECIMAL(3,2), -- 0.00 to 10.00
    cultural_sensitivity_score DECIMAL(3,2), -- 0.00 to 10.00
    language_quality_score DECIMAL(3,2), -- 0.00 to 10.00
    engagement_potential_score DECIMAL(3,2), -- 0.00 to 10.00
    brand_safety_score DECIMAL(3,2), -- 0.00 to 10.00
    feedback TEXT,
    improvement_suggestions TEXT[],
    approved BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Content generation usage tracking
CREATE TABLE IF NOT EXISTS ai_content_usage_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    prompt_id UUID REFERENCES ai_content_prompts(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    content_type VARCHAR(50) NOT NULL,
    generation_time_ms INTEGER, -- Time taken to generate content
    tokens_used INTEGER, -- API tokens consumed
    cost_usd DECIMAL(8,4), -- Cost in USD
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cultural context and localization data
CREATE TABLE IF NOT EXISTS ai_cultural_context (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    language VARCHAR(10) NOT NULL,
    country VARCHAR(5) NOT NULL, -- ISO country code
    cultural_category VARCHAR(100) NOT NULL, -- 'kpop_terms', 'local_slang', 'cultural_references'
    context_key VARCHAR(255) NOT NULL,
    context_value TEXT NOT NULL,
    usage_examples TEXT[],
    relevance_score DECIMAL(3,2) DEFAULT 5.00, -- 0.00 to 10.00
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(language, country, cultural_category, context_key)
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_ai_content_prompts_category_platform ON ai_content_prompts(category, platform);
CREATE INDEX IF NOT EXISTS idx_ai_content_prompts_language ON ai_content_prompts(language);
CREATE INDEX IF NOT EXISTS idx_ai_content_prompts_active ON ai_content_prompts(is_active);

CREATE INDEX IF NOT EXISTS idx_ai_generated_content_user_id ON ai_generated_content(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_generated_content_order_id ON ai_generated_content(order_id);
CREATE INDEX IF NOT EXISTS idx_ai_generated_content_platform ON ai_generated_content(platform);
CREATE INDEX IF NOT EXISTS idx_ai_generated_content_status ON ai_generated_content(status);
CREATE INDEX IF NOT EXISTS idx_ai_generated_content_created_at ON ai_generated_content(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_generated_content_quality_score ON ai_generated_content(quality_score);

CREATE INDEX IF NOT EXISTS idx_ai_content_ab_tests_status ON ai_content_ab_tests(status);
CREATE INDEX IF NOT EXISTS idx_ai_content_ab_tests_platform ON ai_content_ab_tests(platform);
CREATE INDEX IF NOT EXISTS idx_ai_content_ab_tests_date_range ON ai_content_ab_tests(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_ai_content_ab_metrics_test_id ON ai_content_ab_metrics(test_id);
CREATE INDEX IF NOT EXISTS idx_ai_content_ab_metrics_content_id ON ai_content_ab_metrics(content_id);
CREATE INDEX IF NOT EXISTS idx_ai_content_ab_metrics_recorded_at ON ai_content_ab_metrics(recorded_at);

CREATE INDEX IF NOT EXISTS idx_ai_content_quality_assessments_content_id ON ai_content_quality_assessments(content_id);
CREATE INDEX IF NOT EXISTS idx_ai_content_quality_assessments_overall_score ON ai_content_quality_assessments(overall_score);

CREATE INDEX IF NOT EXISTS idx_ai_content_usage_analytics_user_id ON ai_content_usage_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_content_usage_analytics_created_at ON ai_content_usage_analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_content_usage_analytics_platform ON ai_content_usage_analytics(platform);

CREATE INDEX IF NOT EXISTS idx_ai_cultural_context_language_country ON ai_cultural_context(language, country);
CREATE INDEX IF NOT EXISTS idx_ai_cultural_context_category ON ai_cultural_context(cultural_category);
CREATE INDEX IF NOT EXISTS idx_ai_cultural_context_active ON ai_cultural_context(is_active);

-- Row Level Security (RLS) policies
ALTER TABLE ai_content_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generated_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_content_ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_content_ab_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_content_quality_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_content_usage_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cultural_context ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_content_prompts
CREATE POLICY "Users can view active prompts" ON ai_content_prompts
    FOR SELECT USING (is_active = true OR created_by = auth.uid());

CREATE POLICY "Users can create prompts" ON ai_content_prompts
    FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their prompts" ON ai_content_prompts
    FOR UPDATE USING (created_by = auth.uid());

-- RLS Policies for ai_generated_content
CREATE POLICY "Users can view their generated content" ON ai_generated_content
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create generated content" ON ai_generated_content
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their generated content" ON ai_generated_content
    FOR UPDATE USING (user_id = auth.uid());

-- RLS Policies for ai_content_ab_tests
CREATE POLICY "Users can view their A/B tests" ON ai_content_ab_tests
    FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Users can create A/B tests" ON ai_content_ab_tests
    FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their A/B tests" ON ai_content_ab_tests
    FOR UPDATE USING (created_by = auth.uid());

-- RLS Policies for ai_content_ab_metrics
CREATE POLICY "Users can view metrics for their A/B tests" ON ai_content_ab_metrics
    FOR SELECT USING (
        test_id IN (
            SELECT id FROM ai_content_ab_tests WHERE created_by = auth.uid()
        )
    );

CREATE POLICY "Users can insert metrics for their A/B tests" ON ai_content_ab_metrics
    FOR INSERT WITH CHECK (
        test_id IN (
            SELECT id FROM ai_content_ab_tests WHERE created_by = auth.uid()
        )
    );

-- RLS Policies for ai_content_quality_assessments
CREATE POLICY "Users can view quality assessments for their content" ON ai_content_quality_assessments
    FOR SELECT USING (
        content_id IN (
            SELECT id FROM ai_generated_content WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create quality assessments" ON ai_content_quality_assessments
    FOR INSERT WITH CHECK (
        content_id IN (
            SELECT id FROM ai_generated_content WHERE user_id = auth.uid()
        ) OR assessor_id = auth.uid()
    );

-- RLS Policies for ai_content_usage_analytics
CREATE POLICY "Users can view their usage analytics" ON ai_content_usage_analytics
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Service can insert usage analytics" ON ai_content_usage_analytics
    FOR INSERT WITH CHECK (true); -- Allow service to insert for any user

-- RLS Policies for ai_cultural_context (public read, admin write)
CREATE POLICY "Anyone can view active cultural context" ON ai_cultural_context
    FOR SELECT USING (is_active = true);

CREATE POLICY "Users can create cultural context" ON ai_cultural_context
    FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their cultural context" ON ai_cultural_context
    FOR UPDATE USING (created_by = auth.uid());

-- Database functions for common queries
CREATE OR REPLACE FUNCTION get_user_content_analytics(user_uuid UUID, days_back INTEGER DEFAULT 30)
RETURNS TABLE (
    total_generated INTEGER,
    avg_quality_score DECIMAL,
    total_cost_usd DECIMAL,
    most_used_platform TEXT,
    success_rate DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_generated,
        ROUND(AVG(agc.quality_score), 2) as avg_quality_score,
        ROUND(SUM(acua.cost_usd), 4) as total_cost_usd,
        MODE() WITHIN GROUP (ORDER BY agc.platform) as most_used_platform,
        ROUND((COUNT(*) FILTER (WHERE acua.success = true)::DECIMAL / COUNT(*)), 4) as success_rate
    FROM ai_generated_content agc
    LEFT JOIN ai_content_usage_analytics acua ON acua.user_id = agc.user_id
    WHERE agc.user_id = user_uuid 
    AND agc.created_at >= NOW() - INTERVAL '1 day' * days_back;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get trending prompts
CREATE OR REPLACE FUNCTION get_trending_prompts(platform_filter VARCHAR DEFAULT NULL, language_filter VARCHAR DEFAULT 'en')
RETURNS TABLE (
    prompt_id UUID,
    prompt_name VARCHAR,
    usage_count BIGINT,
    avg_quality_score DECIMAL,
    category VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        acp.id as prompt_id,
        acp.name as prompt_name,
        COUNT(agc.id) as usage_count,
        ROUND(AVG(agc.quality_score), 2) as avg_quality_score,
        acp.category
    FROM ai_content_prompts acp
    LEFT JOIN ai_generated_content agc ON acp.id = agc.prompt_id
    WHERE acp.is_active = true
    AND acp.language = language_filter
    AND (platform_filter IS NULL OR acp.platform = platform_filter)
    AND agc.created_at >= NOW() - INTERVAL '7 days'
    GROUP BY acp.id, acp.name, acp.category
    ORDER BY usage_count DESC, avg_quality_score DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate A/B test statistical significance
CREATE OR REPLACE FUNCTION calculate_ab_test_significance(test_uuid UUID)
RETURNS TABLE (
    content_id UUID,
    conversion_rate DECIMAL,
    sample_size INTEGER,
    confidence_level DECIMAL,
    is_significant BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    WITH test_metrics AS (
        SELECT 
            aam.content_id,
            SUM(aam.clicks)::INTEGER as total_clicks,
            SUM(aam.impressions)::INTEGER as total_impressions,
            CASE 
                WHEN SUM(aam.impressions) > 0 
                THEN ROUND((SUM(aam.clicks)::DECIMAL / SUM(aam.impressions)), 4)
                ELSE 0 
            END as conv_rate
        FROM ai_content_ab_metrics aam
        WHERE aam.test_id = test_uuid
        GROUP BY aam.content_id
    ),
    significance_calc AS (
        SELECT 
            tm.content_id,
            tm.conv_rate as conversion_rate,
            tm.total_impressions as sample_size,
            -- Simple confidence calculation (would need more complex stats in production)
            CASE 
                WHEN tm.total_impressions >= 1000 AND tm.conv_rate > 0.01 
                THEN 0.95
                WHEN tm.total_impressions >= 500 AND tm.conv_rate > 0.005
                THEN 0.85
                ELSE 0.70
            END as confidence_level,
            CASE 
                WHEN tm.total_impressions >= 1000 AND tm.conv_rate > 0.01
                THEN true
                ELSE false
            END as is_significant
        FROM test_metrics tm
    )
    SELECT * FROM significance_calc
    ORDER BY conversion_rate DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert default K-pop specific prompts
INSERT INTO ai_content_prompts (name, description, category, platform, language, system_prompt, user_prompt_template, variables, tags) VALUES
-- English K-pop prompts
('K-pop Album Promotion', 'Generate engaging posts for K-pop album group orders', 'kpop', 'twitter', 'en', 
 'You are a K-pop content specialist creating engaging social media posts for group orders. Focus on excitement, community, and K-pop culture. Use appropriate emojis and hashtags.', 
 'Create an exciting post for a {artist} {album_name} group order. Price is {price} {currency}. Deadline is {deadline}. Include relevant hashtags and emojis.',
 '["artist", "album_name", "price", "currency", "deadline"]',
 '{"kpop", "album", "grouporder", "community"}'),

('Photocard Trade Post', 'Create posts for photocard trading and group orders', 'kpop', 'twitter', 'en',
 'You are a K-pop photocard trading expert. Create posts that build community and excitement around rare photocards and trading opportunities.',
 'Create a post about {artist} {item_type} featuring {members}. Emphasize rarity and community trading. Price: {price} {currency}.',
 '["artist", "item_type", "members", "price", "currency"]',
 '{"photocard", "trading", "kpop", "rare"}'),

-- Korean prompts
('케이팝 앨범 홍보', '케이팝 앨범 공동구매를 위한 매력적인 게시물 생성', 'kpop', 'twitter', 'ko',
 '당신은 케이팝 콘텐츠 전문가로서 공동구매를 위한 매력적인 소셜미디어 게시물을 만듭니다. 흥미, 커뮤니티, 케이팝 문화에 집중하세요.',
 '{artist}의 {album_name} 공동구매 게시물을 만드세요. 가격은 {price} {currency}이고 마감일은 {deadline}입니다. 관련 해시태그와 이모지를 포함하세요.',
 '["artist", "album_name", "price", "currency", "deadline"]',
 '{"케이팝", "앨범", "공동구매", "커뮤니티"}'),

-- Tagalog prompts
('K-pop Album Promo (Tagalog)', 'Lumikha ng engaging posts para sa K-pop album group orders', 'kpop', 'twitter', 'tl',
 'Ikaw ay isang K-pop content specialist na lumilikha ng engaging social media posts para sa group orders. Focus sa excitement, community, at K-pop culture.',
 'Lumikha ng exciting post para sa {artist} {album_name} group order. Ang presyo ay {price} {currency}. Deadline ay {deadline}. Isama ang mga hashtag at emoji.',
 '["artist", "album_name", "price", "currency", "deadline"]',
 '{"kpop", "album", "grouporder", "komunidad"}'),

-- Bahasa Indonesia prompts
('Promosi Album K-pop', 'Buat postingan menarik untuk group order album K-pop', 'kpop', 'twitter', 'id',
 'Anda adalah spesialis konten K-pop yang membuat postingan media sosial menarik untuk group order. Fokus pada kegembiraan, komunitas, dan budaya K-pop.',
 'Buat postingan menarik untuk group order {artist} {album_name}. Harga {price} {currency}. Deadline {deadline}. Sertakan hashtag dan emoji yang relevan.',
 '["artist", "album_name", "price", "currency", "deadline"]',
 '{"kpop", "album", "grouporder", "komunitas"}'),

-- Thai prompts
('โปรโมทอัลบั้ม K-pop', 'สร้างโพสต์ที่น่าสนใจสำหรับการสั่งซื้อกลุ่มอัลบั้ม K-pop', 'kpop', 'twitter', 'th',
 'คุณเป็นผู้เชี่ยวชาญด้านเนื้อหา K-pop ที่สร้างโพสต์โซเชียลมีเดียที่น่าสนใจสำหรับการสั่งซื้อกลุ่ม เน้นความตื่นเต้น ชุมชน และวัฒนธรรม K-pop',
 'สร้างโพสต์ที่น่าตื่นเต้นสำหรับการสั่งซื้อกลุ่ม {artist} {album_name} ราคา {price} {currency} วันสุดท้าย {deadline} รวมแฮชแท็กและอิโมจิที่เกี่ยวข้อง',
 '["artist", "album_name", "price", "currency", "deadline"]',
 '{"kpop", "album", "grouporder", "community"}');

-- Insert cultural context data
INSERT INTO ai_cultural_context (language, country, cultural_category, context_key, context_value, usage_examples, relevance_score) VALUES
-- English K-pop terms
('en', 'PH', 'kpop_terms', 'bias', 'Your favorite member in a K-pop group', '{"My bias is switching again!", "Who is your bias in this group?"}', 9.5),
('en', 'PH', 'kpop_terms', 'comeback', 'When a K-pop group releases new music', '{"Excited for their comeback!", "This comeback hits different"}', 9.8),
('en', 'PH', 'kpop_terms', 'stan', 'To be a big fan of a K-pop group', '{"I stan this group so hard", "Local stans where you at?"}', 9.0),

-- Korean cultural context
('ko', 'KR', 'kpop_terms', '오빠', 'Older brother/male K-pop idol (used by females)', '{"우리 오빠 너무 잘생겼어", "오빠 사랑해!"}', 9.8),
('ko', 'KR', 'kpop_terms', '언니', 'Older sister/female K-pop idol (used by females)', '{"언니 너무 예뻐", "언니 같이 춤춰요"}', 9.5),

-- Filipino cultural context
('tl', 'PH', 'local_slang', 'pasabuy', 'Group buying service', '{"May pasabuy ako ng album", "Salamat sa pasabuy!"}', 9.9),
('tl', 'PH', 'local_slang', 'shipping', 'Delivery fee', '{"Magkano shipping sa inyo?", "Free shipping ba yan?"}', 8.5),

-- Indonesian cultural context
('id', 'ID', 'local_slang', 'PO', 'Pre-order', '{"Ada PO album baru!", "PO tutup besok ya"}', 9.0),
('id', 'ID', 'local_slang', 'ongkir', 'Shipping cost', '{"Ongkir ke Jakarta berapa?", "Ongkir gratis minimal pembelian"}', 8.8),

-- Thai cultural context
('th', 'TH', 'local_slang', 'พรีออเดอร์', 'Pre-order (transliterated)', '{"มีพรีออเดอร์อัลบั้มใหม่", "พรีออเดอร์ปิดพรุ่งนี้"}', 8.5),
('th', 'TH', 'local_slang', 'ค่าส่ง', 'Shipping fee', '{"ค่าส่งไปกรุงเทพเท่าไหร่", "ฟรีค่าส่งถ้าซื้อครบ"}', 8.0);

-- Create trigger to update updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ai_content_prompts_updated_at BEFORE UPDATE ON ai_content_prompts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_generated_content_updated_at BEFORE UPDATE ON ai_generated_content FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_content_ab_tests_updated_at BEFORE UPDATE ON ai_content_ab_tests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_cultural_context_updated_at BEFORE UPDATE ON ai_cultural_context FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE ai_content_prompts IS 'AI content generation prompts and templates for different platforms and languages';
COMMENT ON TABLE ai_generated_content IS 'AI generated social media content with quality scores and metadata';
COMMENT ON TABLE ai_content_ab_tests IS 'A/B testing experiments for content optimization';
COMMENT ON TABLE ai_content_ab_metrics IS 'Performance metrics for A/B test variants';
COMMENT ON TABLE ai_content_quality_assessments IS 'Quality assessments for generated content (automated and human)';
COMMENT ON TABLE ai_content_usage_analytics IS 'Usage tracking and cost analytics for AI content generation';
COMMENT ON TABLE ai_cultural_context IS 'Cultural context and localization data for different markets';
-- GOMFLOW Demo Data
-- Sample data for testing all platform features

-- Demo Users
INSERT INTO users (id, email, name, username, phone, country, whatsapp_enabled, telegram_enabled, discord_enabled, plan) VALUES
('demo-user-gom-1', 'emily.gom@demo.gomflow.com', 'Emily (Demo GOM)', 'emily_demo', '+639123456789', 'PH', true, true, true, 'pro'),
('demo-user-gom-2', 'sarah.gom@demo.gomflow.com', 'Sarah (Demo GOM)', 'sarah_demo', '+60123456789', 'MY', true, true, false, 'gateway'),
('demo-user-buyer-1', 'buyer1@demo.gomflow.com', 'Demo Buyer 1', 'buyer1_demo', '+639987654321', 'PH', true, false, true, 'free'),
('demo-user-buyer-2', 'buyer2@demo.gomflow.com', 'Demo Buyer 2', 'buyer2_demo', '+60987654321', 'MY', false, true, false, 'free'),
('demo-user-buyer-3', 'buyer3@demo.gomflow.com', 'Demo Buyer 3', 'buyer3_demo', '+639876543210', 'PH', true, true, true, 'free');

-- Demo Orders
INSERT INTO orders (id, gom_id, title, description, price, currency, minimum_orders, maximum_orders, deadline, status, country, category, product_type) VALUES
('demo-order-1', 'demo-user-gom-1', 'SEVENTEEN "God of Music" Album', 'Limited edition album with special photocard set. Includes: CD, photobook (80 pages), 13 photocards, poster, stickers.', 1800, 'PHP', 20, 50, NOW() + INTERVAL ''7 days'', 'active', 'PH', 'kpop', 'album'),
('demo-order-2', 'demo-user-gom-1', 'BLACKPINK Limited Photobook', 'Rare photobook from Japan tour. High quality prints, exclusive behind-the-scenes photos.', 3500, 'PHP', 30, 100, NOW() + INTERVAL ''14 days'', 'completed', 'PH', 'kpop', 'photobook'),
('demo-order-3', 'demo-user-gom-2', 'STRAY KIDS Concert Goods', 'Official concert merchandise bundle: t-shirt, lightstick, bag, keychain.', 180, 'MYR', 15, 40, NOW() + INTERVAL ''10 days'', 'active', 'MY', 'kpop', 'merchandise'),
('demo-order-4', 'demo-user-gom-2', 'NewJeans Special Edition', 'Get Up album special edition with exclusive cover and extra photocards.', 95, 'MYR', 25, 80, NOW() - INTERVAL ''5 days'', 'collecting', 'MY', 'kpop', 'album'),
('demo-order-5', 'demo-user-gom-1', 'IVE Love Dive Merchandise', 'Official IVE merchandise set: hoodie, photo cards, stickers, poster set.', 2500, 'PHP', 10, 30, NOW() + INTERVAL ''21 days'', 'active', 'PH', 'kpop', 'merchandise');

-- Demo Submissions
INSERT INTO submissions (id, order_id, buyer_id, buyer_name, buyer_email, buyer_phone, quantity, total_amount, currency, payment_method, status, payment_proof_url, payment_reference, notes) VALUES
('demo-sub-1', 'demo-order-1', 'demo-user-buyer-1', 'Demo Buyer 1', 'buyer1@demo.gomflow.com', '+639987654321', 1, 1800, 'PHP', 'gcash', 'paid', 'https://demo.gomflow.com/proofs/gcash_proof_1.jpg', 'GC-DEMO-001', 'Please include Mingyu photocard if possible'),
('demo-sub-2', 'demo-order-1', 'demo-user-buyer-2', 'Demo Buyer 2', 'buyer2@demo.gomflow.com', '+60987654321', 2, 3600, 'PHP', 'paymaya', 'pending', null, null, 'Will pay by tomorrow'),
('demo-sub-3', 'demo-order-2', 'demo-user-buyer-1', 'Demo Buyer 1', 'buyer1@demo.gomflow.com', '+639987654321', 1, 3500, 'PHP', 'gcash', 'paid', 'https://demo.gomflow.com/proofs/gcash_proof_2.jpg', 'GC-DEMO-002', 'Thank you!'),
('demo-sub-4', 'demo-order-3', 'demo-user-buyer-3', 'Demo Buyer 3', 'buyer3@demo.gomflow.com', '+639876543210', 1, 180, 'MYR', 'fpx', 'paid', 'https://demo.gomflow.com/proofs/fpx_proof_1.jpg', 'FPX-DEMO-001', 'Size L for t-shirt please'),
('demo-sub-5', 'demo-order-4', 'demo-user-buyer-2', 'Demo Buyer 2', 'buyer2@demo.gomflow.com', '+60987654321', 3, 285, 'MYR', 'touch_n_go', 'processing', 'https://demo.gomflow.com/proofs/tng_proof_1.jpg', 'TNG-DEMO-001', 'Bulk order for friends');

-- Demo Messages (Communication History)
INSERT INTO messages (id, order_id, sender_id, sender_type, recipient_id, platform, message_type, content, status, sent_at) VALUES
('demo-msg-1', 'demo-order-1', 'demo-user-gom-1', 'gom', 'demo-user-buyer-1', 'whatsapp', 'confirmation', 'Payment received! Your SEVENTEEN album order is confirmed. Will update when we receive the items.', 'delivered', NOW() - INTERVAL ''2 hours''),
('demo-msg-2', 'demo-order-1', 'demo-user-gom-1', 'gom', 'all', 'telegram', 'reminder', 'Only 5 days left for SEVENTEEN album order! We need 6 more orders to reach minimum. Current: 24/30', 'sent', NOW() - INTERVAL ''1 hour''),
('demo-msg-3', 'demo-order-3', 'demo-user-buyer-3', 'buyer', 'demo-user-gom-2', 'discord', 'query_response', 'Hi! What sizes are available for the STRAY KIDS t-shirt? I need size L.', 'delivered', NOW() - INTERVAL ''30 minutes''),
('demo-msg-4', 'demo-order-3', 'demo-user-gom-2', 'gom', 'demo-user-buyer-3', 'discord', 'custom', 'Hi! We have sizes S, M, L, XL available. I''ll note size L for your order. Thanks!', 'delivered', NOW() - INTERVAL ''25 minutes'');

-- Demo Platform Connections
INSERT INTO platform_connections (id, user_id, platform, connection_type, external_id, connection_data, is_active) VALUES
('demo-conn-1', 'demo-user-gom-1', 'whatsapp', 'group', 'demo-wa-group-1', '{"group_name": "SEVENTEEN Album Group Order", "member_count": 25}', true),
('demo-conn-2', 'demo-user-gom-1', 'telegram', 'channel', 'demo-tg-channel-1', '{"channel_name": "Emily GOM Updates", "subscriber_count": 156}', true),
('demo-conn-3', 'demo-user-gom-2', 'discord', 'channel', 'demo-dc-channel-1', '{"server_name": "MY Kpop GOMs", "channel_name": "group-orders", "member_count": 89}', true),
('demo-conn-4', 'demo-user-gom-1', 'discord', 'webhook', 'demo-dc-webhook-1', '{"webhook_url": "https://discord.com/api/webhooks/demo/url", "server_name": "PH Kpop Community"}', true);

-- Demo Analytics Data
INSERT INTO order_analytics (id, order_id, gom_id, total_views, unique_visitors, conversion_rate, average_time_to_submit, popular_payment_methods, geographic_distribution, created_at) VALUES
('demo-analytics-1', 'demo-order-1', 'demo-user-gom-1', 245, 189, 12.7, 8.5, '{"gcash": 45, "paymaya": 30, "card": 25}', '{"manila": 40, "cebu": 25, "davao": 20, "others": 15}', NOW() - INTERVAL ''1 day''),
('demo-analytics-2', 'demo-order-2', 'demo-user-gom-1', 456, 298, 16.8, 6.2, '{"gcash": 60, "paymaya": 25, "card": 15}', '{"manila": 55, "cebu": 20, "quezon": 15, "others": 10}', NOW() - INTERVAL ''2 days''),
('demo-analytics-3', 'demo-order-3', 'demo-user-gom-2', 178, 134, 14.2, 7.8, '{"fpx": 50, "touch_n_go": 30, "maybank2u": 20}', '{"kuala_lumpur": 45, "johor": 25, "penang": 20, "others": 10}', NOW() - INTERVAL ''1 day'');

-- Demo Social Media Posts
INSERT INTO social_media_posts (id, user_id, platform, post_content, media_urls, scheduled_for, posted_at, status, engagement_metrics) VALUES
('demo-post-1', 'demo-user-gom-1', 'instagram', '🎵 SEVENTEEN "God of Music" Album Group Order is LIVE! 📅 Deadline: Jan 30 💰 Only $18 per album ✨ Includes exclusive photocards Link in bio! #SEVENTEEN #GodOfMusic #GroupOrder', '["https://demo.gomflow.com/social/seventeen_album.jpg"]', NOW() + INTERVAL ''2 hours'', null, 'scheduled', null),
('demo-post-2', 'demo-user-gom-2', 'twitter', '🔥 STRAY KIDS Concert Goods Group Order! Official merch bundle for just RM180 🎪 T-shirt + lightstick + bag + keychain Deadline: Feb 5 DM to join! #StrayKids #ConcertGoods #GroupOrder', '[]', NOW() - INTERVAL ''3 hours'', NOW() - INTERVAL ''3 hours'', 'posted', '{"likes": 45, "retweets": 12, "comments": 8}'),
('demo-post-3', 'demo-user-gom-1', 'facebook', 'BLACKPINK Limited Photobook Group Order - COMPLETED! 📚 Thank you everyone for joining! 50/50 slots filled 🎉 Will update when items arrive from Japan 💕', '["https://demo.gomflow.com/social/blackpink_photobook.jpg"]', NOW() - INTERVAL ''1 day'', NOW() - INTERVAL ''1 day'', 'posted', '{"likes": 89, "shares": 23, "comments": 34}');

-- Demo AI Content Templates
INSERT INTO ai_content_templates (id, user_id, template_name, platform, template_content, variables, usage_count, created_at) VALUES
('demo-template-1', 'demo-user-gom-1', 'Album Announcement', 'instagram', '🎵 {{artist}} "{{album_title}}" Album Group Order is LIVE! 📅 Deadline: {{deadline}} 💰 Only {{price}} per album ✨ {{special_features}} Link in bio! #{{artist}} #{{hashtag}} #GroupOrder', '["artist", "album_title", "deadline", "price", "special_features", "hashtag"]', 15, NOW() - INTERVAL ''5 days''),
('demo-template-2', 'demo-user-gom-2', 'Order Reminder', 'telegram', '⏰ REMINDER: {{order_title}} group order ends in {{days_left}} days! Current status: {{current}}/{{minimum}} orders We need {{needed}} more to proceed! Join now: {{link}}', '["order_title", "days_left", "current", "minimum", "needed", "link"]', 8, NOW() - INTERVAL ''3 days''),
('demo-template-3', 'demo-user-gom-1', 'Payment Confirmation', 'whatsapp', '✅ Payment confirmed for {{buyer_name}}! Order: {{order_title}} Amount: {{amount}} {{currency}} Reference: {{reference}} Thank you for joining our group order! 💕', '["buyer_name", "order_title", "amount", "currency", "reference"]', 45, NOW() - INTERVAL ''1 week'');

-- Demo Notifications
INSERT INTO notifications (id, user_id, title, message, type, priority, read_at, created_at, metadata) VALUES
('demo-notif-1', 'demo-user-gom-1', 'New Order Submission', 'Demo Buyer 2 submitted order for SEVENTEEN album (2 copies)', 'order_submission', 'medium', null, NOW() - INTERVAL ''30 minutes'', '{"order_id": "demo-order-1", "buyer_id": "demo-user-buyer-2"}'),
('demo-notif-2', 'demo-user-gom-1', 'Payment Received', 'Payment confirmed for Demo Buyer 1 - BLACKPINK photobook order', 'payment_confirmed', 'high', NOW() - INTERVAL ''1 hour'', NOW() - INTERVAL ''2 hours'', '{"submission_id": "demo-sub-3", "amount": 3500}'),
('demo-notif-3', 'demo-user-gom-2', 'Order Minimum Reached', 'STRAY KIDS Concert Goods order reached minimum (15 orders)!', 'milestone_reached', 'high', null, NOW() - INTERVAL ''4 hours'', '{"order_id": "demo-order-3", "milestone": "minimum_reached"}'),
('demo-notif-4', 'demo-user-buyer-1', 'Order Update', 'Your SEVENTEEN album order payment has been confirmed!', 'order_update', 'medium', null, NOW() - INTERVAL ''2 hours'', '{"order_id": "demo-order-1", "status": "paid"}');

-- Demo Collaboration Workspaces
INSERT INTO collaboration_workspaces (id, name, description, owner_id, settings, created_at) VALUES
('demo-workspace-1', 'PH Kpop GOMs Alliance', 'Collaborative workspace for Philippines-based K-pop Group Order Managers', 'demo-user-gom-1', '{"allow_guests": true, "default_permissions": "editor"}', NOW() - INTERVAL ''1 month''),
('demo-workspace-2', 'SEVENTEEN Specialists', 'Dedicated workspace for SEVENTEEN merchandise group orders', 'demo-user-gom-1', '{"allow_guests": false, "default_permissions": "viewer"}', NOW() - INTERVAL ''2 weeks'');

-- Demo Workspace Members
INSERT INTO workspace_members (id, workspace_id, user_id, role, permissions, joined_at) VALUES
('demo-member-1', 'demo-workspace-1', 'demo-user-gom-1', 'owner', '["read", "write", "admin", "invite"]', NOW() - INTERVAL ''1 month''),
('demo-member-2', 'demo-workspace-1', 'demo-user-gom-2', 'admin', '["read", "write", "invite"]', NOW() - INTERVAL ''3 weeks''),
('demo-member-3', 'demo-workspace-2', 'demo-user-gom-1', 'owner', '["read", "write", "admin", "invite"]', NOW() - INTERVAL ''2 weeks'');

-- Demo Activity Feed
INSERT INTO activity_feed (id, workspace_id, user_id, activity_type, description, metadata, created_at) VALUES
('demo-activity-1', 'demo-workspace-1', 'demo-user-gom-1', 'order_created', 'Created new order: SEVENTEEN God of Music Album', '{"order_id": "demo-order-1"}', NOW() - INTERVAL ''3 hours''),
('demo-activity-2', 'demo-workspace-1', 'demo-user-gom-2', 'payment_received', 'Payment confirmed for STRAY KIDS Concert Goods', '{"submission_id": "demo-sub-4"}', NOW() - INTERVAL ''2 hours''),
('demo-activity-3', 'demo-workspace-1', 'demo-user-gom-1', 'milestone_reached', 'BLACKPINK photobook reached 100% capacity', '{"order_id": "demo-order-2"}', NOW() - INTERVAL ''1 hour'');
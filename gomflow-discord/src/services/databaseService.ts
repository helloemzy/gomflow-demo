import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { Config } from '../config';
import type { 
  User, 
  Order, 
  Submission, 
  PlatformConnection,
  Message,
  Database 
} from '@gomflow/shared';
import type { DiscordUser, GuildSettings, UserSession } from '../types';

export class DatabaseService {
  private supabase: SupabaseClient<Database>;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    this.supabase = createClient(
      config.supabase.url,
      config.supabase.anonKey,
      {
        auth: {
          persistSession: false,
        },
      }
    );
  }

  async initialize(): Promise<void> {
    try {
      // Test connection
      const { error } = await this.supabase.from('users').select('id').limit(1);
      if (error) throw error;
      logger.info('Database connection established');
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      throw new Error('Database connection failed');
    }
  }

  async close(): Promise<void> {
    // Supabase client doesn't need explicit closing
    logger.info('Database service closed');
  }

  // User Management
  async getOrCreateDiscordUser(discordId: string, username: string, discriminator: string): Promise<DiscordUser> {
    try {
      // Check if platform connection exists
      const { data: connection, error: connError } = await this.supabase
        .from('platform_connections')
        .select('*, users(*)')
        .eq('platform', 'discord')
        .eq('platform_user_id', discordId)
        .single();

      if (connError && connError.code !== 'PGRST116') { // Not found error
        throw connError;
      }

      if (connection?.users) {
        return {
          id: connection.users.id,
          discordId,
          username,
          discriminator,
          isGOM: connection.users.is_gom,
          createdAt: connection.users.created_at,
        };
      }

      // Create new user and platform connection
      const { data: newUser, error: userError } = await this.supabase
        .from('users')
        .insert({
          email: `discord_${discordId}@gomflow.temp`,
          phone: null,
          country: 'PH', // Default, will be updated based on guild location
          is_gom: false,
        })
        .select()
        .single();

      if (userError) throw userError;

      // Create platform connection
      const { error: platError } = await this.supabase
        .from('platform_connections')
        .insert({
          user_id: newUser.id,
          platform: 'discord',
          platform_user_id: discordId,
          platform_username: `${username}#${discriminator}`,
        });

      if (platError) throw platError;

      return {
        id: newUser.id,
        discordId,
        username,
        discriminator,
        isGOM: false,
        createdAt: newUser.created_at,
      };
    } catch (error) {
      logger.error('Error in getOrCreateDiscordUser:', error);
      throw error;
    }
  }

  // Guild Settings Management
  async getGuildSettings(guildId: string): Promise<GuildSettings | null> {
    try {
      // For now, store guild settings in a JSON column in platform_connections
      const { data, error } = await this.supabase
        .from('platform_connections')
        .select('metadata')
        .eq('platform', 'discord')
        .eq('platform_user_id', `guild_${guildId}`)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data?.metadata as GuildSettings || null;
    } catch (error) {
      logger.error('Error getting guild settings:', error);
      return null;
    }
  }

  async updateGuildSettings(guildId: string, settings: GuildSettings): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('platform_connections')
        .upsert({
          platform: 'discord',
          platform_user_id: `guild_${guildId}`,
          platform_username: settings.name,
          metadata: settings,
          user_id: '00000000-0000-0000-0000-000000000000', // System user
        });

      if (error) throw error;
    } catch (error) {
      logger.error('Error updating guild settings:', error);
      throw error;
    }
  }

  // Session Management
  async createSession(userId: string, discordId: string, guildId?: string): Promise<UserSession> {
    const session: UserSession = {
      userId,
      discordId,
      guildId,
      state: 'idle',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };

    // Store in messages table temporarily (will move to dedicated session store)
    await this.supabase
      .from('messages')
      .insert({
        platform: 'discord',
        platform_message_id: `session_${discordId}`,
        platform_user_id: discordId,
        content: JSON.stringify(session),
        direction: 'incoming',
        metadata: { type: 'session' },
      });

    return session;
  }

  async getSession(discordId: string): Promise<UserSession | null> {
    try {
      const { data, error } = await this.supabase
        .from('messages')
        .select('content')
        .eq('platform', 'discord')
        .eq('platform_message_id', `session_${discordId}`)
        .eq('metadata->>type', 'session')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) return null;

      const session = JSON.parse(data.content) as UserSession;
      
      // Check if expired
      if (new Date(session.expiresAt) < new Date()) {
        return null;
      }

      return session;
    } catch (error) {
      logger.error('Error getting session:', error);
      return null;
    }
  }

  async updateSession(discordId: string, updates: Partial<UserSession>): Promise<void> {
    const session = await this.getSession(discordId);
    if (!session) return;

    const updatedSession = { ...session, ...updates };
    
    await this.supabase
      .from('messages')
      .update({
        content: JSON.stringify(updatedSession),
      })
      .eq('platform', 'discord')
      .eq('platform_message_id', `session_${discordId}`);
  }

  // Order Management
  async getActiveOrders(userId?: string): Promise<Order[]> {
    try {
      let query = this.supabase
        .from('orders')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (userId) {
        query = query.eq('gom_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data || [];
    } catch (error) {
      logger.error('Error getting active orders:', error);
      return [];
    }
  }

  async getOrderById(orderId: string): Promise<Order | null> {
    try {
      const { data, error } = await this.supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error getting order:', error);
      return null;
    }
  }

  async getOrderBySlug(slug: string): Promise<Order | null> {
    try {
      const { data, error } = await this.supabase
        .from('orders')
        .select('*')
        .eq('slug', slug)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Error getting order by slug:', error);
      return null;
    }
  }

  // Submission Management
  async createSubmission(submission: Omit<Submission, 'id' | 'created_at' | 'updated_at'>): Promise<Submission> {
    try {
      const { data, error } = await this.supabase
        .from('submissions')
        .insert(submission)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Error creating submission:', error);
      throw error;
    }
  }

  async getSubmissionsByOrderId(orderId: string): Promise<Submission[]> {
    try {
      const { data, error } = await this.supabase
        .from('submissions')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Error getting submissions:', error);
      return [];
    }
  }

  async updateSubmissionStatus(submissionId: string, status: Submission['status']): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('submissions')
        .update({ status })
        .eq('id', submissionId);

      if (error) throw error;
    } catch (error) {
      logger.error('Error updating submission status:', error);
      throw error;
    }
  }

  // Message Logging
  async logMessage(message: Omit<Message, 'id' | 'created_at'>): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('messages')
        .insert(message);

      if (error) throw error;
    } catch (error) {
      logger.error('Error logging message:', error);
      // Don't throw - logging shouldn't break the flow
    }
  }

  // Analytics
  async getGuildAnalytics(guildId: string): Promise<any> {
    try {
      // Get all users from this guild
      const { data: connections } = await this.supabase
        .from('platform_connections')
        .select('user_id')
        .eq('platform', 'discord')
        .like('metadata->>guildId', `%${guildId}%`);

      if (!connections?.length) {
        return {
          totalUsers: 0,
          totalOrders: 0,
          totalSubmissions: 0,
          activeOrders: 0,
        };
      }

      const userIds = connections.map(c => c.user_id);

      // Get order stats
      const { data: orderStats } = await this.supabase
        .from('orders')
        .select('id, status')
        .in('gom_id', userIds);

      // Get submission stats
      const { data: submissionStats } = await this.supabase
        .from('submissions')
        .select('id')
        .in('buyer_id', userIds);

      return {
        totalUsers: userIds.length,
        totalOrders: orderStats?.length || 0,
        totalSubmissions: submissionStats?.length || 0,
        activeOrders: orderStats?.filter(o => o.status === 'active').length || 0,
      };
    } catch (error) {
      logger.error('Error getting guild analytics:', error);
      return null;
    }
  }
}
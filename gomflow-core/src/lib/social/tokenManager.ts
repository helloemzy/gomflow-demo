/**
 * Secure Token Manager
 * Handles encryption, storage, and management of OAuth tokens
 */

import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';

interface EncryptedTokenData {
  encryptedToken: string;
  encryptionKeyId: string;
  tokenHash: string;
}

interface TokenMetadata {
  socialAccountId: string;
  tokenType: 'access_token' | 'refresh_token' | 'id_token';
  scopes: string[];
  expiresAt?: Date;
  lastUsedAt?: Date;
  usageCount: number;
  isRevoked: boolean;
}

interface StoredToken extends TokenMetadata {
  id: string;
  encrypted: EncryptedTokenData;
  createdAt: Date;
  updatedAt: Date;
}

export class TokenManager {
  private supabase;
  private readonly encryptionAlgorithm = 'aes-256-gcm';
  private readonly masterKey: string;
  private readonly keyRotationInterval = 30 * 24 * 60 * 60 * 1000; // 30 days

  constructor(masterKey?: string) {
    this.supabase = createClient();
    this.masterKey = masterKey || process.env.TOKEN_ENCRYPTION_KEY || this.generateMasterKey();
    
    if (!this.masterKey) {
      throw new Error('TOKEN_ENCRYPTION_KEY environment variable is required');
    }
  }

  /**
   * Store encrypted token
   */
  async storeToken(
    socialAccountId: string,
    tokenType: 'access_token' | 'refresh_token' | 'id_token',
    token: string,
    options: {
      scopes?: string[];
      expiresIn?: number; // seconds
      replace?: boolean;
    } = {}
  ): Promise<string> {
    try {
      // Check if token already exists
      if (options.replace) {
        await this.revokeToken(socialAccountId, tokenType);
      }

      // Encrypt token
      const encrypted = await this.encryptToken(token);
      
      // Calculate expiration date
      const expiresAt = options.expiresIn 
        ? new Date(Date.now() + options.expiresIn * 1000)
        : undefined;

      // Store in database
      const { data, error } = await this.supabase
        .from('social_tokens')
        .insert({
          social_account_id: socialAccountId,
          token_type: tokenType,
          encrypted_token: encrypted.encryptedToken,
          encryption_key_id: encrypted.encryptionKeyId,
          token_hash: encrypted.tokenHash,
          scopes: options.scopes || [],
          expires_at: expiresAt?.toISOString(),
          usage_count: 0,
          is_revoked: false,
        })
        .select('id')
        .single();

      if (error) {
        throw new Error(`Failed to store token: ${error.message}`);
      }

      return data.id;
    } catch (error) {
      console.error('Token storage failed:', error);
      throw new Error(`Token storage failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve and decrypt token
   */
  async getToken(
    socialAccountId: string,
    tokenType: 'access_token' | 'refresh_token' | 'id_token'
  ): Promise<string | null> {
    try {
      // Get encrypted token from database
      const { data, error } = await this.supabase
        .from('social_tokens')
        .select('*')
        .eq('social_account_id', socialAccountId)
        .eq('token_type', tokenType)
        .eq('is_revoked', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return null;
      }

      // Check if token is expired
      if (data.expires_at && new Date(data.expires_at) <= new Date()) {
        await this.markTokenExpired(data.id);
        return null;
      }

      // Decrypt token
      const decryptedToken = await this.decryptToken({
        encryptedToken: data.encrypted_token,
        encryptionKeyId: data.encryption_key_id,
        tokenHash: data.token_hash,
      });

      // Update usage statistics
      await this.updateTokenUsage(data.id);

      return decryptedToken;
    } catch (error) {
      console.error('Token retrieval failed:', error);
      return null;
    }
  }

  /**
   * Get token metadata without decrypting
   */
  async getTokenMetadata(
    socialAccountId: string,
    tokenType: 'access_token' | 'refresh_token' | 'id_token'
  ): Promise<TokenMetadata | null> {
    try {
      const { data, error } = await this.supabase
        .from('social_tokens')
        .select('social_account_id, token_type, scopes, expires_at, last_used_at, usage_count, is_revoked')
        .eq('social_account_id', socialAccountId)
        .eq('token_type', tokenType)
        .eq('is_revoked', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        socialAccountId: data.social_account_id,
        tokenType: data.token_type,
        scopes: data.scopes,
        expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
        lastUsedAt: data.last_used_at ? new Date(data.last_used_at) : undefined,
        usageCount: data.usage_count,
        isRevoked: data.is_revoked,
      };
    } catch (error) {
      console.error('Token metadata retrieval failed:', error);
      return null;
    }
  }

  /**
   * Check if token exists and is valid
   */
  async isTokenValid(
    socialAccountId: string,
    tokenType: 'access_token' | 'refresh_token' | 'id_token'
  ): Promise<boolean> {
    const metadata = await this.getTokenMetadata(socialAccountId, tokenType);
    
    if (!metadata || metadata.isRevoked) {
      return false;
    }

    // Check expiration
    if (metadata.expiresAt && metadata.expiresAt <= new Date()) {
      return false;
    }

    return true;
  }

  /**
   * Revoke token (mark as revoked)
   */
  async revokeToken(
    socialAccountId: string,
    tokenType: 'access_token' | 'refresh_token' | 'id_token'
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('social_tokens')
        .update({
          is_revoked: true,
          updated_at: new Date().toISOString(),
        })
        .eq('social_account_id', socialAccountId)
        .eq('token_type', tokenType)
        .eq('is_revoked', false);

      return !error;
    } catch (error) {
      console.error('Token revocation failed:', error);
      return false;
    }
  }

  /**
   * Revoke all tokens for a social account
   */
  async revokeAllTokens(socialAccountId: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('social_tokens')
        .update({
          is_revoked: true,
          updated_at: new Date().toISOString(),
        })
        .eq('social_account_id', socialAccountId)
        .eq('is_revoked', false);

      return !error;
    } catch (error) {
      console.error('Token revocation failed:', error);
      return false;
    }
  }

  /**
   * Cleanup expired and revoked tokens
   */
  async cleanupTokens(olderThanDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const { data, error } = await this.supabase
        .from('social_tokens')
        .delete()
        .or(`is_revoked.eq.true,expires_at.lt.${new Date().toISOString()}`)
        .lt('updated_at', cutoffDate.toISOString())
        .select('id');

      if (error) {
        throw new Error(`Cleanup failed: ${error.message}`);
      }

      return data?.length || 0;
    } catch (error) {
      console.error('Token cleanup failed:', error);
      return 0;
    }
  }

  /**
   * Rotate encryption keys (for security)
   */
  async rotateEncryptionKeys(): Promise<void> {
    try {
      // Get all active tokens
      const { data: tokens, error } = await this.supabase
        .from('social_tokens')
        .select('*')
        .eq('is_revoked', false)
        .is('expires_at', null)
        .or(`expires_at.gt.${new Date().toISOString()}`);

      if (error) {
        throw new Error(`Failed to get tokens for rotation: ${error.message}`);
      }

      if (!tokens || tokens.length === 0) {
        return;
      }

      // Re-encrypt tokens with new key
      const updates = [];
      for (const token of tokens) {
        try {
          // Decrypt with old key
          const decryptedToken = await this.decryptToken({
            encryptedToken: token.encrypted_token,
            encryptionKeyId: token.encryption_key_id,
            tokenHash: token.token_hash,
          });

          // Encrypt with new key
          const newEncrypted = await this.encryptToken(decryptedToken);

          updates.push({
            id: token.id,
            encrypted_token: newEncrypted.encryptedToken,
            encryption_key_id: newEncrypted.encryptionKeyId,
            token_hash: newEncrypted.tokenHash,
            updated_at: new Date().toISOString(),
          });
        } catch (error) {
          console.error(`Failed to rotate token ${token.id}:`, error);
        }
      }

      // Batch update
      if (updates.length > 0) {
        await this.supabase
          .from('social_tokens')
          .upsert(updates);
      }

      console.log(`Rotated ${updates.length} tokens`);
    } catch (error) {
      console.error('Key rotation failed:', error);
      throw error;
    }
  }

  /**
   * Get token usage statistics
   */
  async getTokenStats(socialAccountId?: string): Promise<{
    total: number;
    active: number;
    expired: number;
    revoked: number;
    byType: Record<string, number>;
    usageStats: {
      totalUsage: number;
      averageUsage: number;
      mostUsedToken: number;
    };
  }> {
    try {
      let query = this.supabase
        .from('social_tokens')
        .select('token_type, is_revoked, expires_at, usage_count');

      if (socialAccountId) {
        query = query.eq('social_account_id', socialAccountId);
      }

      const { data: tokens, error } = await query;

      if (error) {
        throw new Error(`Failed to get token stats: ${error.message}`);
      }

      const stats = {
        total: tokens?.length || 0,
        active: 0,
        expired: 0,
        revoked: 0,
        byType: {} as Record<string, number>,
        usageStats: {
          totalUsage: 0,
          averageUsage: 0,
          mostUsedToken: 0,
        },
      };

      if (!tokens) {
        return stats;
      }

      const now = new Date();
      
      for (const token of tokens) {
        // Count by type
        stats.byType[token.token_type] = (stats.byType[token.token_type] || 0) + 1;

        // Count by status
        if (token.is_revoked) {
          stats.revoked++;
        } else if (token.expires_at && new Date(token.expires_at) <= now) {
          stats.expired++;
        } else {
          stats.active++;
        }

        // Usage statistics
        stats.usageStats.totalUsage += token.usage_count || 0;
        stats.usageStats.mostUsedToken = Math.max(
          stats.usageStats.mostUsedToken,
          token.usage_count || 0
        );
      }

      stats.usageStats.averageUsage = stats.total > 0 
        ? stats.usageStats.totalUsage / stats.total 
        : 0;

      return stats;
    } catch (error) {
      console.error('Token stats retrieval failed:', error);
      throw error;
    }
  }

  /**
   * Private methods for encryption/decryption
   */
  private async encryptToken(token: string): Promise<EncryptedTokenData> {
    try {
      // Generate unique encryption key ID
      const encryptionKeyId = crypto.randomBytes(16).toString('hex');
      
      // Derive key from master key and key ID
      const key = crypto.pbkdf2Sync(this.masterKey, encryptionKeyId, 100000, 32, 'sha256');
      
      // Generate IV
      const iv = crypto.randomBytes(16);
      
      // Create cipher
      const cipher = crypto.createCipher(this.encryptionAlgorithm, key);
      cipher.setAutoPadding(true);
      
      // Encrypt token
      let encryptedToken = cipher.update(token, 'utf8', 'base64');
      encryptedToken += cipher.final('base64');
      
      // Get auth tag for GCM mode
      const authTag = (cipher as any).getAuthTag?.() || Buffer.alloc(0);
      
      // Combine encrypted data with IV and auth tag
      const combinedData = Buffer.concat([
        iv,
        authTag,
        Buffer.from(encryptedToken, 'base64')
      ]).toString('base64');

      // Create hash for validation
      const tokenHash = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

      return {
        encryptedToken: combinedData,
        encryptionKeyId,
        tokenHash,
      };
    } catch (error) {
      throw new Error(`Token encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async decryptToken(encrypted: EncryptedTokenData): Promise<string> {
    try {
      // Derive key from master key and key ID
      const key = crypto.pbkdf2Sync(this.masterKey, encrypted.encryptionKeyId, 100000, 32, 'sha256');
      
      // Parse combined data
      const combinedBuffer = Buffer.from(encrypted.encryptedToken, 'base64');
      const iv = combinedBuffer.slice(0, 16);
      const authTag = combinedBuffer.slice(16, 32);
      const encryptedData = combinedBuffer.slice(32);
      
      // Create decipher
      const decipher = crypto.createDecipher(this.encryptionAlgorithm, key);
      
      // Set auth tag for GCM mode
      if (authTag.length > 0) {
        (decipher as any).setAuthTag?.(authTag);
      }
      
      // Decrypt token
      let decryptedToken = decipher.update(encryptedData, undefined, 'utf8');
      decryptedToken += decipher.final('utf8');
      
      // Validate hash
      const tokenHash = crypto
        .createHash('sha256')
        .update(decryptedToken)
        .digest('hex');

      if (tokenHash !== encrypted.tokenHash) {
        throw new Error('Token integrity check failed');
      }

      return decryptedToken;
    } catch (error) {
      throw new Error(`Token decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private generateMasterKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private async markTokenExpired(tokenId: string): Promise<void> {
    await this.supabase
      .from('social_tokens')
      .update({
        is_revoked: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tokenId);
  }

  private async updateTokenUsage(tokenId: string): Promise<void> {
    await this.supabase
      .from('social_tokens')
      .update({
        last_used_at: new Date().toISOString(),
        usage_count: this.supabase.raw('usage_count + 1'),
        updated_at: new Date().toISOString(),
      })
      .eq('id', tokenId);
  }
}

// Singleton instance
let tokenManager: TokenManager;

export function getTokenManager(): TokenManager {
  if (!tokenManager) {
    tokenManager = new TokenManager();
  }
  return tokenManager;
}

// Utility functions
export async function storeOAuthToken(
  socialAccountId: string,
  tokenType: 'access_token' | 'refresh_token' | 'id_token',
  token: string,
  options?: {
    scopes?: string[];
    expiresIn?: number;
    replace?: boolean;
  }
): Promise<string> {
  const manager = getTokenManager();
  return manager.storeToken(socialAccountId, tokenType, token, options);
}

export async function getOAuthToken(
  socialAccountId: string,
  tokenType: 'access_token' | 'refresh_token' | 'id_token'
): Promise<string | null> {
  const manager = getTokenManager();
  return manager.getToken(socialAccountId, tokenType);
}

export async function isOAuthTokenValid(
  socialAccountId: string,
  tokenType: 'access_token' | 'refresh_token' | 'id_token'
): Promise<boolean> {
  const manager = getTokenManager();
  return manager.isTokenValid(socialAccountId, tokenType);
}

export async function revokeOAuthToken(
  socialAccountId: string,
  tokenType: 'access_token' | 'refresh_token' | 'id_token'
): Promise<boolean> {
  const manager = getTokenManager();
  return manager.revokeToken(socialAccountId, tokenType);
}

export async function revokeAllOAuthTokens(socialAccountId: string): Promise<boolean> {
  const manager = getTokenManager();
  return manager.revokeAllTokens(socialAccountId);
}
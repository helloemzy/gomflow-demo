import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database';

// Database connection pool configuration
const DATABASE_CONFIG = {
  // Connection pool settings
  poolSize: {
    min: 2,
    max: 10,
    production: {
      min: 5,
      max: 20
    }
  },
  
  // Connection timeout settings
  timeout: {
    connect: 10000,      // 10 seconds
    idle: 30000,         // 30 seconds
    statement: 30000,    // 30 seconds
    query: 60000         // 1 minute
  },
  
  // Retry configuration
  retry: {
    attempts: 3,
    delay: 1000,
    backoff: 2.0
  }
};

// Enhanced Supabase client with connection pooling
class DatabasePool {
  private client: ReturnType<typeof createClient<Database>>;
  private connections: Map<string, any> = new Map();
  private connectionCount = 0;
  private maxConnections: number;
  private minConnections: number;
  
  constructor() {
    const isProduction = process.env.NODE_ENV === 'production';
    
    this.maxConnections = isProduction 
      ? DATABASE_CONFIG.poolSize.production.max 
      : DATABASE_CONFIG.poolSize.max;
      
    this.minConnections = isProduction 
      ? DATABASE_CONFIG.poolSize.production.min 
      : DATABASE_CONFIG.poolSize.min;
    
    this.client = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        global: {
          headers: {
            'Connection': 'keep-alive',
            'Keep-Alive': 'timeout=60, max=1000'
          }
        },
        db: {
          schema: 'public'
        }
      }
    );
    
    // Initialize connection pool
    this.initializePool();
  }
  
  private async initializePool() {
    try {
      // Create minimum connections
      for (let i = 0; i < this.minConnections; i++) {
        await this.createConnection(`pool-${i}`);
      }
      
      console.log(`✅ Database pool initialized with ${this.minConnections} connections`);
    } catch (error) {
      console.error('❌ Failed to initialize database pool:', error);
    }
  }
  
  private async createConnection(connectionId: string) {
    try {
      const connection = {
        id: connectionId,
        client: this.client,
        createdAt: new Date(),
        lastUsed: new Date(),
        inUse: false,
        queryCount: 0
      };
      
      // Test connection
      const { error } = await this.client
        .from('orders')
        .select('count')
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      this.connections.set(connectionId, connection);
      this.connectionCount++;
      
      return connection;
    } catch (error) {
      console.error(`Failed to create connection ${connectionId}:`, error);
      throw error;
    }
  }
  
  private async getConnection(): Promise<any> {
    // Find available connection
    for (const [id, connection] of this.connections.entries()) {
      if (!connection.inUse) {
        connection.inUse = true;
        connection.lastUsed = new Date();
        return connection;
      }
    }
    
    // Create new connection if under limit
    if (this.connectionCount < this.maxConnections) {
      const newConnectionId = `pool-${this.connectionCount}`;
      const connection = await this.createConnection(newConnectionId);
      connection.inUse = true;
      return connection;
    }
    
    // Wait for available connection
    return new Promise((resolve, reject) => {
      const checkForConnection = () => {
        for (const [id, connection] of this.connections.entries()) {
          if (!connection.inUse) {
            connection.inUse = true;
            connection.lastUsed = new Date();
            resolve(connection);
            return;
          }
        }
        
        setTimeout(checkForConnection, 100);
      };
      
      checkForConnection();
      
      // Timeout after 30 seconds
      setTimeout(() => {
        reject(new Error('Connection pool timeout'));
      }, 30000);
    });
  }
  
  private releaseConnection(connection: any) {
    connection.inUse = false;
    connection.queryCount++;
  }
  
  async execute<T>(operation: (client: any) => Promise<T>): Promise<T> {
    const connection = await this.getConnection();
    
    try {
      const result = await operation(connection.client);
      return result;
    } finally {
      this.releaseConnection(connection);
    }
  }
  
  async executeWithRetry<T>(operation: (client: any) => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= DATABASE_CONFIG.retry.attempts; attempt++) {
      try {
        return await this.execute(operation);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === DATABASE_CONFIG.retry.attempts) {
          throw lastError;
        }
        
        const delay = DATABASE_CONFIG.retry.delay * Math.pow(DATABASE_CONFIG.retry.backoff, attempt - 1);
        console.warn(`Database operation failed (attempt ${attempt}/${DATABASE_CONFIG.retry.attempts}), retrying in ${delay}ms:`, error);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }
  
  getPoolStats() {
    const connections = Array.from(this.connections.values());
    const inUse = connections.filter(c => c.inUse).length;
    const available = connections.length - inUse;
    
    return {
      total: connections.length,
      inUse,
      available,
      maxConnections: this.maxConnections,
      minConnections: this.minConnections,
      connections: connections.map(c => ({
        id: c.id,
        inUse: c.inUse,
        createdAt: c.createdAt,
        lastUsed: c.lastUsed,
        queryCount: c.queryCount
      }))
    };
  }
  
  async healthCheck() {
    const stats = this.getPoolStats();
    
    try {
      const connection = await this.getConnection();
      
      const startTime = Date.now();
      const { error } = await connection.client
        .from('orders')
        .select('count')
        .limit(1)
        .single();
      
      const latency = Date.now() - startTime;
      
      this.releaseConnection(connection);
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      return {
        healthy: true,
        latency: `${latency}ms`,
        pool: stats
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        pool: stats
      };
    }
  }
  
  async cleanup() {
    console.log('🧹 Cleaning up database connections...');
    
    const cutoffTime = new Date(Date.now() - DATABASE_CONFIG.timeout.idle);
    
    for (const [id, connection] of this.connections.entries()) {
      if (!connection.inUse && connection.lastUsed < cutoffTime) {
        this.connections.delete(id);
        this.connectionCount--;
        console.log(`Cleaned up idle connection: ${id}`);
      }
    }
  }
}

// Singleton instance
let databasePool: DatabasePool | null = null;

export function getDatabasePool(): DatabasePool {
  if (!databasePool) {
    databasePool = new DatabasePool();
  }
  return databasePool;
}

export default DatabasePool;
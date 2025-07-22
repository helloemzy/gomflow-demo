// GOMFLOW Operational Transforms
// Conflict resolution for simultaneous order edits

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import {
  OperationalTransform,
  OperationType,
  OrderEdit,
  ApiResponse,
  CollaborativeOrder
} from './types';

interface Operation {
  type: OperationType;
  path: string;
  value?: any;
  oldValue?: any;
  position?: number;
  length?: number;
}

interface TransformResult {
  transformedOp: Operation;
  conflicts: string[];
  applied: boolean;
}

class OperationalTransformManager {
  private supabase: ReturnType<typeof createClient>;
  private pendingOperations: Map<string, Operation[]> = new Map(); // orderId -> operations
  private operationHistory: Map<string, OperationalTransform[]> = new Map(); // orderId -> history

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  // ============================================================================
  // OPERATION CREATION AND MANAGEMENT
  // ============================================================================

  async createOperation(
    orderId: string,
    workspaceId: string,
    userId: string,
    operation: Operation,
    currentVersion: number
  ): Promise<ApiResponse<OperationalTransform>> {
    try {
      // Validate operation
      const validationResult = this.validateOperation(operation);
      if (!validationResult.valid) {
        return {
          success: false,
          error: 'INVALID_OPERATION',
          message: validationResult.message
        };
      }

      // Create operation in database
      const { data: transform, error } = await this.supabase
        .from('operational_transforms')
        .insert({
          order_id: orderId,
          workspace_id: workspaceId,
          user_id: userId,
          operation_type: operation.type,
          field_path: operation.path,
          old_value: operation.oldValue,
          new_value: operation.value,
          position: operation.position,
          length: operation.length,
          version: currentVersion,
          timestamp: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: 'CREATE_OPERATION_ERROR',
          message: error.message
        };
      }

      // Add to pending operations
      this.addToPendingOperations(orderId, operation);

      return {
        success: true,
        data: transform
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  async applyOperation(
    transformId: string,
    orderId: string,
    workspaceId: string
  ): Promise<ApiResponse<TransformResult>> {
    try {
      // Get the operation
      const { data: transform, error } = await this.supabase
        .from('operational_transforms')
        .select('*')
        .eq('id', transformId)
        .single();

      if (error || !transform) {
        return {
          success: false,
          error: 'OPERATION_NOT_FOUND',
          message: 'Operation not found'
        };
      }

      // Check if already applied
      if (transform.applied) {
        return {
          success: false,
          error: 'OPERATION_ALREADY_APPLIED',
          message: 'Operation has already been applied'
        };
      }

      // Get current order version
      const { data: collaborativeOrder, error: orderError } = await this.supabase
        .from('collaborative_orders')
        .select('version')
        .eq('order_id', orderId)
        .eq('workspace_id', workspaceId)
        .single();

      if (orderError) {
        return {
          success: false,
          error: 'ORDER_NOT_FOUND',
          message: 'Collaborative order not found'
        };
      }

      // Transform operation against concurrent operations
      const transformResult = await this.transformOperation(
        transform,
        collaborativeOrder.version
      );

      if (!transformResult.applied) {
        return {
          success: false,
          error: 'OPERATION_CONFLICT',
          message: 'Operation conflicts with concurrent changes'
        };
      }

      // Apply the transformed operation
      const applyResult = await this.applyTransformedOperation(
        transformResult.transformedOp,
        orderId,
        workspaceId,
        transform.user_id
      );

      if (!applyResult.success) {
        return applyResult;
      }

      // Mark operation as applied
      await this.supabase
        .from('operational_transforms')
        .update({
          applied: true,
          conflicts_with: transformResult.conflicts
        })
        .eq('id', transformId);

      // Update order version
      await this.supabase
        .from('collaborative_orders')
        .update({
          version: collaborativeOrder.version + 1,
          last_edited_by: transform.user_id,
          last_edited_at: new Date().toISOString()
        })
        .eq('order_id', orderId)
        .eq('workspace_id', workspaceId);

      return {
        success: true,
        data: transformResult
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  // ============================================================================
  // OPERATIONAL TRANSFORM ALGORITHMS
  // ============================================================================

  private async transformOperation(
    operation: OperationalTransform,
    currentVersion: number
  ): Promise<TransformResult> {
    const conflicts: string[] = [];
    let transformedOp: Operation = {
      type: operation.operation_type,
      path: operation.field_path,
      value: operation.new_value,
      oldValue: operation.old_value,
      position: operation.position,
      length: operation.length
    };

    // Get concurrent operations
    const { data: concurrentOps, error } = await this.supabase
      .from('operational_transforms')
      .select('*')
      .eq('order_id', operation.order_id)
      .eq('workspace_id', operation.workspace_id)
      .gt('version', operation.version)
      .lte('version', currentVersion)
      .eq('applied', true)
      .order('version', { ascending: true });

    if (error) {
      return {
        transformedOp,
        conflicts: [],
        applied: false
      };
    }

    // Transform against each concurrent operation
    for (const concurrentOp of concurrentOps || []) {
      const transformResult = this.transformOperationPair(
        transformedOp,
        {
          type: concurrentOp.operation_type,
          path: concurrentOp.field_path,
          value: concurrentOp.new_value,
          oldValue: concurrentOp.old_value,
          position: concurrentOp.position,
          length: concurrentOp.length
        }
      );

      if (transformResult.hasConflict) {
        conflicts.push(concurrentOp.id);
      }

      transformedOp = transformResult.transformedOp;
    }

    return {
      transformedOp,
      conflicts,
      applied: conflicts.length === 0
    };
  }

  private transformOperationPair(
    op1: Operation,
    op2: Operation
  ): { transformedOp: Operation; hasConflict: boolean } {
    // Same path operations
    if (op1.path === op2.path) {
      return this.transformSamePathOperations(op1, op2);
    }

    // Different path operations (usually no conflict)
    return {
      transformedOp: op1,
      hasConflict: false
    };
  }

  private transformSamePathOperations(
    op1: Operation,
    op2: Operation
  ): { transformedOp: Operation; hasConflict: boolean } {
    // Replace vs Replace
    if (op1.type === 'replace' && op2.type === 'replace') {
      return {
        transformedOp: op1,
        hasConflict: true // Last writer wins, but flag conflict
      };
    }

    // Insert vs Insert
    if (op1.type === 'insert' && op2.type === 'insert') {
      return this.transformInsertInsert(op1, op2);
    }

    // Delete vs Delete
    if (op1.type === 'delete' && op2.type === 'delete') {
      return this.transformDeleteDelete(op1, op2);
    }

    // Insert vs Delete
    if (op1.type === 'insert' && op2.type === 'delete') {
      return this.transformInsertDelete(op1, op2);
    }

    // Delete vs Insert
    if (op1.type === 'delete' && op2.type === 'insert') {
      return this.transformDeleteInsert(op1, op2);
    }

    // Default case
    return {
      transformedOp: op1,
      hasConflict: false
    };
  }

  private transformInsertInsert(
    op1: Operation,
    op2: Operation
  ): { transformedOp: Operation; hasConflict: boolean } {
    if (op1.position === undefined || op2.position === undefined) {
      return { transformedOp: op1, hasConflict: false };
    }

    if (op1.position <= op2.position) {
      return { transformedOp: op1, hasConflict: false };
    } else {
      return {
        transformedOp: {
          ...op1,
          position: op1.position + (op2.length || 1)
        },
        hasConflict: false
      };
    }
  }

  private transformDeleteDelete(
    op1: Operation,
    op2: Operation
  ): { transformedOp: Operation; hasConflict: boolean } {
    if (op1.position === undefined || op2.position === undefined) {
      return { transformedOp: op1, hasConflict: true };
    }

    const op1End = op1.position + (op1.length || 1);
    const op2End = op2.position + (op2.length || 1);

    // No overlap
    if (op1End <= op2.position) {
      return { transformedOp: op1, hasConflict: false };
    } else if (op2End <= op1.position) {
      return {
        transformedOp: {
          ...op1,
          position: op1.position - (op2.length || 1)
        },
        hasConflict: false
      };
    } else {
      // Overlap - conflict
      return { transformedOp: op1, hasConflict: true };
    }
  }

  private transformInsertDelete(
    op1: Operation,
    op2: Operation
  ): { transformedOp: Operation; hasConflict: boolean } {
    if (op1.position === undefined || op2.position === undefined) {
      return { transformedOp: op1, hasConflict: false };
    }

    if (op1.position <= op2.position) {
      return { transformedOp: op1, hasConflict: false };
    } else {
      return {
        transformedOp: {
          ...op1,
          position: op1.position - (op2.length || 1)
        },
        hasConflict: false
      };
    }
  }

  private transformDeleteInsert(
    op1: Operation,
    op2: Operation
  ): { transformedOp: Operation; hasConflict: boolean } {
    if (op1.position === undefined || op2.position === undefined) {
      return { transformedOp: op1, hasConflict: false };
    }

    if (op1.position < op2.position) {
      return { transformedOp: op1, hasConflict: false };
    } else {
      return {
        transformedOp: {
          ...op1,
          position: op1.position + (op2.length || 1)
        },
        hasConflict: false
      };
    }
  }

  // ============================================================================
  // OPERATION APPLICATION
  // ============================================================================

  private async applyTransformedOperation(
    operation: Operation,
    orderId: string,
    workspaceId: string,
    userId: string
  ): Promise<ApiResponse<void>> {
    try {
      switch (operation.type) {
        case 'replace':
          return await this.applyReplaceOperation(operation, orderId);
        case 'insert':
          return await this.applyInsertOperation(operation, orderId);
        case 'delete':
          return await this.applyDeleteOperation(operation, orderId);
        default:
          return {
            success: false,
            error: 'UNSUPPORTED_OPERATION',
            message: `Unsupported operation type: ${operation.type}`
          };
      }
    } catch (error) {
      return {
        success: false,
        error: 'APPLY_OPERATION_ERROR',
        message: error.message
      };
    }
  }

  private async applyReplaceOperation(
    operation: Operation,
    orderId: string
  ): Promise<ApiResponse<void>> {
    try {
      const updateData: any = {};
      
      // Map field paths to database columns
      switch (operation.path) {
        case 'title':
          updateData.title = operation.value;
          break;
        case 'description':
          updateData.description = operation.value;
          break;
        case 'price':
          updateData.price = operation.value;
          break;
        case 'deadline':
          updateData.deadline = operation.value;
          break;
        case 'min_orders':
          updateData.min_orders = operation.value;
          break;
        case 'max_orders':
          updateData.max_orders = operation.value;
          break;
        case 'payment_methods':
          updateData.payment_methods = operation.value;
          break;
        default:
          return {
            success: false,
            error: 'UNSUPPORTED_FIELD',
            message: `Unsupported field path: ${operation.path}`
          };
      }

      const { error } = await this.supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) {
        return {
          success: false,
          error: 'UPDATE_ORDER_ERROR',
          message: error.message
        };
      }

      return {
        success: true,
        message: 'Replace operation applied successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  private async applyInsertOperation(
    operation: Operation,
    orderId: string
  ): Promise<ApiResponse<void>> {
    // For now, we'll treat insert as replace for simplicity
    // In a more complex system, this would handle array insertions
    return await this.applyReplaceOperation(operation, orderId);
  }

  private async applyDeleteOperation(
    operation: Operation,
    orderId: string
  ): Promise<ApiResponse<void>> {
    // For now, we'll treat delete as setting to null
    // In a more complex system, this would handle array deletions
    const deleteOperation: Operation = {
      ...operation,
      type: 'replace',
      value: null
    };
    
    return await this.applyReplaceOperation(deleteOperation, orderId);
  }

  // ============================================================================
  // OPERATION HISTORY AND CLEANUP
  // ============================================================================

  async getOperationHistory(
    orderId: string,
    workspaceId: string,
    userId: string,
    limit: number = 50
  ): Promise<ApiResponse<OperationalTransform[]>> {
    try {
      // Check if user has access to workspace
      const hasAccess = await this.checkWorkspaceAccess(workspaceId, userId);
      if (!hasAccess) {
        return {
          success: false,
          error: 'ACCESS_DENIED',
          message: 'You do not have access to this workspace'
        };
      }

      const { data: history, error } = await this.supabase
        .from('operational_transforms')
        .select(`
          *,
          user:users(id, name, username, email)
        `)
        .eq('order_id', orderId)
        .eq('workspace_id', workspaceId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        return {
          success: false,
          error: 'GET_HISTORY_ERROR',
          message: error.message
        };
      }

      return {
        success: true,
        data: history || []
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  async cleanupOldOperations(days: number = 30): Promise<ApiResponse<void>> {
    try {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const { error } = await this.supabase
        .from('operational_transforms')
        .delete()
        .lt('timestamp', cutoffDate)
        .eq('applied', true);

      if (error) {
        return {
          success: false,
          error: 'CLEANUP_ERROR',
          message: error.message
        };
      }

      return {
        success: true,
        message: 'Old operations cleaned up successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private validateOperation(operation: Operation): { valid: boolean; message?: string } {
    if (!operation.type) {
      return { valid: false, message: 'Operation type is required' };
    }

    if (!operation.path) {
      return { valid: false, message: 'Operation path is required' };
    }

    if (operation.type === 'replace' && operation.value === undefined) {
      return { valid: false, message: 'Replace operation requires a value' };
    }

    if ((operation.type === 'insert' || operation.type === 'delete') && operation.position === undefined) {
      return { valid: false, message: 'Insert/Delete operations require a position' };
    }

    return { valid: true };
  }

  private addToPendingOperations(orderId: string, operation: Operation): void {
    if (!this.pendingOperations.has(orderId)) {
      this.pendingOperations.set(orderId, []);
    }
    this.pendingOperations.get(orderId)!.push(operation);
  }

  private async checkWorkspaceAccess(workspaceId: string, userId: string): Promise<boolean> {
    const { data: member } = await this.supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    return !!member;
  }

  // ============================================================================
  // BATCH OPERATIONS
  // ============================================================================

  async applyBatchOperations(
    operations: OperationalTransform[],
    orderId: string,
    workspaceId: string
  ): Promise<ApiResponse<TransformResult[]>> {
    try {
      const results: TransformResult[] = [];
      
      for (const operation of operations) {
        const result = await this.applyOperation(operation.id, orderId, workspaceId);
        if (result.success) {
          results.push(result.data!);
        } else {
          // If one operation fails, we might want to rollback
          // For now, we'll continue with other operations
          results.push({
            transformedOp: {
              type: operation.operation_type,
              path: operation.field_path,
              value: operation.new_value
            },
            conflicts: [],
            applied: false
          });
        }
      }

      return {
        success: true,
        data: results
      };
    } catch (error) {
      return {
        success: false,
        error: 'BATCH_OPERATION_ERROR',
        message: error.message
      };
    }
  }

  public clearPendingOperations(orderId: string): void {
    this.pendingOperations.delete(orderId);
  }

  public getPendingOperations(orderId: string): Operation[] {
    return this.pendingOperations.get(orderId) || [];
  }
}

export default OperationalTransformManager;
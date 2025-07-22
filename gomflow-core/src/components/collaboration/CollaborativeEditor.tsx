// GOMFLOW Collaborative Editor Component
// Real-time collaborative order editing interface

"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Save, 
  Lock, 
  Unlock, 
  Eye, 
  Users, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Undo,
  Redo,
  FileText,
  DollarSign,
  Calendar,
  Package,
  User,
  Settings,
  History,
  MessageSquare,
  Crown
} from 'lucide-react';
import { useCollaboration } from '@/hooks/useCollaboration';
import PresenceIndicator from './PresenceIndicator';
import ConflictResolver from './ConflictResolver';
import { LiveCursors } from './PresenceIndicator';
import {
  CollaborativeOrder,
  OrderEdit,
  OperationType,
  WorkspaceMember,
  CursorPosition,
  PresenceTracking
} from '@/lib/collaboration/types';

interface CollaborativeEditorProps {
  workspaceId: string;
  orderId: string;
  userId: string;
  authToken: string;
  onSave?: (order: any) => void;
  onClose?: () => void;
  readOnly?: boolean;
}

interface OrderData {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  deadline: string;
  max_quantity: number;
  min_quantity: number;
  status: string;
  payment_methods: string[];
  shipping_cost: number;
  category: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
  gom_id: string;
}

interface EditHistory {
  id: string;
  field: string;
  oldValue: any;
  newValue: any;
  timestamp: string;
  userId: string;
  userName: string;
}

const CollaborativeEditor: React.FC<CollaborativeEditorProps> = ({
  workspaceId,
  orderId,
  userId,
  authToken,
  onSave,
  onClose,
  readOnly = false
}) => {
  const { state, actions } = useCollaboration({
    workspaceId,
    userId,
    authToken,
    autoConnect: true
  });

  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [originalData, setOriginalData] = useState<OrderData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockOwner, setLockOwner] = useState<string | null>(null);
  const [lockExpiresAt, setLockExpiresAt] = useState<string | null>(null);
  const [editHistory, setEditHistory] = useState<EditHistory[]>([]);
  const [undoStack, setUndoStack] = useState<EditHistory[]>([]);
  const [redoStack, setRedoStack] = useState<EditHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showConflictResolver, setShowConflictResolver] = useState(false);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [activeCursors, setActiveCursors] = useState<Map<string, CursorPosition & { user: WorkspaceMember }>>(new Map());
  const [focusedField, setFocusedField] = useState<string | null>(null);
  
  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastEditVersionRef = useRef<number>(0);

  // Load initial order data
  useEffect(() => {
    loadOrderData();
  }, [orderId]);

  // Handle real-time events
  useEffect(() => {
    if (!state.isConnected) return;

    const handleOrderEdit = (edit: OrderEdit) => {
      if (edit.order_id === orderId && edit.user_id !== userId) {
        applyRemoteEdit(edit);
      }
    };

    const handleLockUpdate = (data: any) => {
      if (data.orderId === orderId) {
        setIsLocked(data.locked);
        setLockOwner(data.lockedBy);
        setLockExpiresAt(data.expiresAt);
      }
    };

    const handlePresenceUpdate = (presence: PresenceTracking) => {
      if (presence.workspace_id === workspaceId && presence.current_page === `order-${orderId}`) {
        const member = actions.getMemberByUserId(presence.user_id);
        if (member && presence.cursor_position) {
          setActiveCursors(prev => {
            const newCursors = new Map(prev);
            newCursors.set(presence.user_id, {
              ...presence.cursor_position!,
              user: member
            });
            return newCursors;
          });
        }
      }
    };

    // Set up event listeners
    const cleanup = () => {
      // Cleanup function will be called on unmount
    };

    return cleanup;
  }, [state.isConnected, orderId, userId, workspaceId, actions]);

  // Update presence when focusing on fields
  useEffect(() => {
    if (focusedField && state.isConnected) {
      const cursorPosition: CursorPosition = {
        x: 0,
        y: 0,
        page: `order-${orderId}`,
        element: focusedField
      };
      actions.updateCursorPosition(cursorPosition);
    }
  }, [focusedField, orderId, state.isConnected, actions]);

  const loadOrderData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/orders/${orderId}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (!response.ok) {
        throw new Error('Failed to load order data');
      }

      const order = await response.json();
      setOrderData(order);
      setOriginalData(order);
      
      // Load edit history
      loadEditHistory();
      
      // Check lock status
      const lockStatus = actions.getOrderLockStatus(orderId);
      setIsLocked(lockStatus.isLocked);
      setLockOwner(lockStatus.lockedBy || null);
      setLockExpiresAt(lockStatus.expiresAt || null);
      
    } catch (err) {
      console.error('Error loading order:', err);
      setError('Failed to load order data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadEditHistory = async () => {
    try {
      const response = await fetch(`/api/collaboration/orders/${orderId}/history`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (response.ok) {
        const history = await response.json();
        setEditHistory(history);
      }
    } catch (err) {
      console.error('Error loading edit history:', err);
    }
  };

  const requestLock = async () => {
    try {
      const success = await actions.requestOrderLock(orderId, 30); // 30 minute lock
      if (success) {
        setIsLocked(true);
        setLockOwner(userId);
        setLockExpiresAt(new Date(Date.now() + 30 * 60 * 1000).toISOString());
      } else {
        setError('Failed to acquire lock. Order may be locked by another user.');
      }
    } catch (err) {
      console.error('Error requesting lock:', err);
      setError('Failed to request lock');
    }
  };

  const releaseLock = () => {
    actions.releaseOrderLock(orderId);
    setIsLocked(false);
    setLockOwner(null);
    setLockExpiresAt(null);
  };

  const handleFieldChange = useCallback((field: string, value: any) => {
    if (readOnly || (isLocked && lockOwner !== userId)) {
      return;
    }

    setOrderData(prev => {
      if (!prev) return null;
      
      const newData = { ...prev, [field]: value };
      
      // Create edit record
      const edit: OrderEdit = {
        order_id: orderId,
        workspace_id: workspaceId,
        user_id: userId,
        field_path: field,
        old_value: prev[field as keyof OrderData],
        new_value: value,
        version: lastEditVersionRef.current + 1,
        timestamp: new Date().toISOString()
      };

      // Send edit to other users
      actions.sendOrderEdit(edit);
      
      // Update local state
      lastEditVersionRef.current = edit.version;
      setHasUnsavedChanges(true);
      
      // Add to undo stack
      const historyEntry: EditHistory = {
        id: Date.now().toString(),
        field,
        oldValue: prev[field as keyof OrderData],
        newValue: value,
        timestamp: edit.timestamp,
        userId,
        userName: state.workspaceMembers.find(m => m.user_id === userId)?.user?.name || 'Unknown'
      };
      
      setUndoStack(prev => [...prev, historyEntry]);
      setRedoStack([]); // Clear redo stack on new edit
      
      // Auto-save after delay
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveOrder(newData);
      }, 2000);
      
      return newData;
    });
  }, [orderId, workspaceId, userId, isLocked, lockOwner, readOnly, actions, state.workspaceMembers]);

  const applyRemoteEdit = (edit: OrderEdit) => {
    setOrderData(prev => {
      if (!prev) return null;
      
      // Check for conflicts
      const currentValue = prev[edit.field_path as keyof OrderData];
      if (currentValue !== edit.old_value) {
        // Conflict detected
        setConflicts(prevConflicts => [...prevConflicts, {
          field: edit.field_path,
          localValue: currentValue,
          remoteValue: edit.new_value,
          remoteUser: edit.user_id,
          timestamp: edit.timestamp
        }]);
        setShowConflictResolver(true);
        return prev;
      }
      
      // Apply the edit
      const newData = { ...prev, [edit.field_path]: edit.new_value };
      
      // Add to history
      const member = state.workspaceMembers.find(m => m.user_id === edit.user_id);
      const historyEntry: EditHistory = {
        id: edit.timestamp,
        field: edit.field_path,
        oldValue: edit.old_value,
        newValue: edit.new_value,
        timestamp: edit.timestamp,
        userId: edit.user_id,
        userName: member?.user?.name || 'Unknown User'
      };
      
      setEditHistory(prev => [historyEntry, ...prev]);
      
      return newData;
    });
  };

  const saveOrder = async (data: OrderData = orderData!) => {
    if (!data) return;

    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error('Failed to save order');
      }

      const savedOrder = await response.json();
      setOrderData(savedOrder);
      setOriginalData(savedOrder);
      setHasUnsavedChanges(false);
      onSave?.(savedOrder);
      
    } catch (err) {
      console.error('Error saving order:', err);
      setError('Failed to save order');
    } finally {
      setSaving(false);
    }
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    
    const lastEdit = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);
    
    setOrderData(prev => {
      if (!prev) return null;
      return { ...prev, [lastEdit.field]: lastEdit.oldValue };
    });
    
    setUndoStack(newUndoStack);
    setRedoStack(prev => [...prev, lastEdit]);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    
    const lastRedoEdit = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);
    
    setOrderData(prev => {
      if (!prev) return null;
      return { ...prev, [lastRedoEdit.field]: lastRedoEdit.newValue };
    });
    
    setRedoStack(newRedoStack);
    setUndoStack(prev => [...prev, lastRedoEdit]);
  };

  const handleConflictResolution = (resolutions: any[]) => {
    resolutions.forEach(resolution => {
      handleFieldChange(resolution.field, resolution.selectedValue);
    });
    setConflicts([]);
    setShowConflictResolver(false);
  };

  const canEdit = !readOnly && (!isLocked || lockOwner === userId) && actions.hasPermission('edit_orders');

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            Loading order data...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!orderData) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Order Not Found</h3>
            <p className="text-gray-600">The requested order could not be loaded.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Edit Order: {orderData.title}
              </CardTitle>
              {hasUnsavedChanges && (
                <Badge variant="secondary" className="text-yellow-600">
                  <Clock className="w-3 h-3 mr-1" />
                  Unsaved Changes
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <PresenceIndicator
                workspaceId={workspaceId}
                currentPage={`order-${orderId}`}
                members={state.workspaceMembers}
                presenceData={state.presenceData}
              />
              {canEdit && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUndo}
                    disabled={undoStack.length === 0}
                  >
                    <Undo className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRedo}
                    disabled={redoStack.length === 0}
                  >
                    <Redo className="w-4 h-4" />
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
              >
                <History className="w-4 h-4" />
              </Button>
              {canEdit && (
                <Button
                  onClick={() => saveOrder()}
                  disabled={isSaving || !hasUnsavedChanges}
                  className="flex items-center gap-2"
                >
                  {isSaving ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save
                </Button>
              )}
              {onClose && (
                <Button variant="outline" onClick={onClose}>
                  Close
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Lock Status */}
      {isLocked && (
        <Card className={`border-l-4 ${lockOwner === userId ? 'border-l-green-500 bg-green-50' : 'border-l-red-500 bg-red-50'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {lockOwner === userId ? (
                  <Lock className="w-5 h-5 text-green-600" />
                ) : (
                  <Lock className="w-5 h-5 text-red-600" />
                )}
                <div>
                  <div className="font-semibold">
                    {lockOwner === userId ? 'You have editing access' : 'Order is locked'}
                  </div>
                  <div className="text-sm text-gray-600">
                    {lockOwner === userId 
                      ? `Lock expires at ${new Date(lockExpiresAt!).toLocaleTimeString()}`
                      : `Locked by ${actions.getMemberByUserId(lockOwner!)?.user?.name || 'Unknown User'}`
                    }
                  </div>
                </div>
              </div>
              {lockOwner === userId ? (
                <Button variant="outline" size="sm" onClick={releaseLock}>
                  <Unlock className="w-4 h-4 mr-2" />
                  Release Lock
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={requestLock}>
                  <Lock className="w-4 h-4 mr-2" />
                  Request Lock
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Details */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4" ref={editorRef}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={orderData.title}
                    onChange={(e) => handleFieldChange('title', e.target.value)}
                    onFocus={() => setFocusedField('title')}
                    onBlur={() => setFocusedField(null)}
                    disabled={!canEdit}
                  />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={orderData.category}
                    onChange={(e) => handleFieldChange('category', e.target.value)}
                    onFocus={() => setFocusedField('category')}
                    onBlur={() => setFocusedField(null)}
                    disabled={!canEdit}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  value={orderData.description}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  onFocus={() => setFocusedField('description')}
                  onBlur={() => setFocusedField(null)}
                  disabled={!canEdit}
                  rows={3}
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="price">Price</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={orderData.price}
                      onChange={(e) => handleFieldChange('price', parseFloat(e.target.value))}
                      onFocus={() => setFocusedField('price')}
                      onBlur={() => setFocusedField(null)}
                      disabled={!canEdit}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <select
                    id="currency"
                    value={orderData.currency}
                    onChange={(e) => handleFieldChange('currency', e.target.value)}
                    onFocus={() => setFocusedField('currency')}
                    onBlur={() => setFocusedField(null)}
                    disabled={!canEdit}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    <option value="PHP">PHP</option>
                    <option value="MYR">MYR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="shipping_cost">Shipping Cost</Label>
                  <Input
                    id="shipping_cost"
                    type="number"
                    step="0.01"
                    value={orderData.shipping_cost}
                    onChange={(e) => handleFieldChange('shipping_cost', parseFloat(e.target.value))}
                    onFocus={() => setFocusedField('shipping_cost')}
                    onBlur={() => setFocusedField(null)}
                    disabled={!canEdit}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="min_quantity">Min Quantity</Label>
                  <Input
                    id="min_quantity"
                    type="number"
                    value={orderData.min_quantity}
                    onChange={(e) => handleFieldChange('min_quantity', parseInt(e.target.value))}
                    onFocus={() => setFocusedField('min_quantity')}
                    onBlur={() => setFocusedField(null)}
                    disabled={!canEdit}
                  />
                </div>
                <div>
                  <Label htmlFor="max_quantity">Max Quantity</Label>
                  <Input
                    id="max_quantity"
                    type="number"
                    value={orderData.max_quantity}
                    onChange={(e) => handleFieldChange('max_quantity', parseInt(e.target.value))}
                    onFocus={() => setFocusedField('max_quantity')}
                    onBlur={() => setFocusedField(null)}
                    disabled={!canEdit}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="deadline">Deadline</Label>
                <Input
                  id="deadline"
                  type="datetime-local"
                  value={orderData.deadline ? new Date(orderData.deadline).toISOString().slice(0, 16) : ''}
                  onChange={(e) => handleFieldChange('deadline', e.target.value)}
                  onFocus={() => setFocusedField('deadline')}
                  onBlur={() => setFocusedField(null)}
                  disabled={!canEdit}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Active Collaborators */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Active Collaborators</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Array.from(activeCursors.entries()).map(([userId, cursor]) => (
                  <div key={userId} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className="text-sm">{cursor.user.user?.name}</span>
                    {cursor.element && (
                      <Badge variant="outline" className="text-xs">
                        {cursor.element}
                      </Badge>
                    )}
                  </div>
                ))}
                {activeCursors.size === 0 && (
                  <p className="text-sm text-gray-500">No active collaborators</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          {showHistory && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Recent Changes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {editHistory.slice(0, 10).map((entry) => (
                    <div key={entry.id} className="text-xs p-2 border rounded">
                      <div className="font-semibold">{entry.userName}</div>
                      <div className="text-gray-600">
                        Changed {entry.field}: {JSON.stringify(entry.oldValue)} → {JSON.stringify(entry.newValue)}
                      </div>
                      <div className="text-gray-400">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                  {editHistory.length === 0 && (
                    <p className="text-sm text-gray-500">No recent changes</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Conflict Resolution Modal */}
      {showConflictResolver && (
        <ConflictResolver
          conflicts={conflicts}
          onResolve={handleConflictResolution}
          onClose={() => setShowConflictResolver(false)}
          members={state.workspaceMembers}
        />
      )}

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Live Cursors */}
      <LiveCursors cursors={activeCursors} containerRef={editorRef} />
    </div>
  );
};

export default CollaborativeEditor;
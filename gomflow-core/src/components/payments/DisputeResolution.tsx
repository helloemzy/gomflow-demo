"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  AlertTriangle, 
  MessageSquare, 
  Upload, 
  Clock, 
  CheckCircle,
  XCircle,
  Eye,
  Download,
  Send,
  User,
  CreditCard,
  FileImage,
  Calendar,
  DollarSign,
  Shield,
  RefreshCw
} from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface DisputeCase {
  id: string;
  submission_id: string;
  order_id: string;
  dispute_type: 'payment_not_received' | 'wrong_amount' | 'duplicate_payment' | 'refund_request' | 'other';
  status: 'open' | 'investigating' | 'resolved' | 'escalated' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  reported_by: 'buyer' | 'gom' | 'system';
  reported_at: string;
  description: string;
  amount_disputed: number;
  currency: 'PHP' | 'MYR';
  resolution_notes?: string;
  resolved_at?: string;
  resolved_by?: string;
  evidence_files: string[];
  messages: DisputeMessage[];
  buyer_info: {
    name: string;
    email?: string;
    phone: string;
    platform: string;
  };
  order_info: {
    title: string;
    gom_name: string;
    total_amount: number;
  };
}

interface DisputeMessage {
  id: string;
  sender_type: 'buyer' | 'gom' | 'system' | 'admin';
  sender_name: string;
  message: string;
  timestamp: string;
  attachments?: string[];
}

interface DisputeResolutionProps {
  disputeId?: string;
  onClose?: () => void;
  onResolved?: (disputeId: string, resolution: string) => void;
}

export default function DisputeResolution({ 
  disputeId, 
  onClose, 
  onResolved 
}: DisputeResolutionProps) {
  const [disputes, setDisputes] = useState<DisputeCase[]>([]);
  const [selectedDispute, setSelectedDispute] = useState<DisputeCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [newEvidence, setNewEvidence] = useState<File[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'messages' | 'evidence' | 'resolution'>('overview');
  const [resolutionType, setResolutionType] = useState<'approve' | 'reject' | 'partial' | 'escalate'>('approve');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const supabase = createClientComponentClient();

  useEffect(() => {
    fetchDisputes();
  }, []);

  useEffect(() => {
    if (disputeId) {
      const dispute = disputes.find(d => d.id === disputeId);
      if (dispute) {
        setSelectedDispute(dispute);
      }
    }
  }, [disputeId, disputes]);

  const fetchDisputes = async () => {
    try {
      setLoading(true);
      
      // Check if in demo mode
      const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
      
      if (isDemoMode) {
        // Demo data
        const demoDisputes: DisputeCase[] = [
          {
            id: 'dispute-1',
            submission_id: 'sub-1',
            order_id: 'order-1',
            dispute_type: 'payment_not_received',
            status: 'open',
            priority: 'high',
            reported_by: 'buyer',
            reported_at: '2024-01-18T10:30:00Z',
            description: 'I sent payment via GCash 3 days ago but order status still shows pending. Transaction reference: GC123456789',
            amount_disputed: 1250.00,
            currency: 'PHP',
            evidence_files: ['gcash_receipt_1.jpg', 'screenshot_conversation.png'],
            buyer_info: {
              name: 'Maria Santos',
              email: 'maria@example.com',
              phone: '+63917123456',
              platform: 'whatsapp'
            },
            order_info: {
              title: 'SEVENTEEN God of Music Album',
              gom_name: 'KpopGoods PH',
              total_amount: 1250.00
            },
            messages: [
              {
                id: 'msg-1',
                sender_type: 'buyer',
                sender_name: 'Maria Santos',
                message: 'Hi, I sent the payment 3 days ago but my order still shows as pending. Here is the GCash receipt.',
                timestamp: '2024-01-18T10:30:00Z',
                attachments: ['gcash_receipt_1.jpg']
              },
              {
                id: 'msg-2',
                sender_type: 'system',
                sender_name: 'GOMFLOW System',
                message: 'Dispute case opened. GOM has been notified and will respond within 24 hours.',
                timestamp: '2024-01-18T10:31:00Z'
              }
            ]
          },
          {
            id: 'dispute-2',
            submission_id: 'sub-2',
            order_id: 'order-2',
            dispute_type: 'wrong_amount',
            status: 'investigating',
            priority: 'medium',
            reported_by: 'system',
            reported_at: '2024-01-17T15:20:00Z',
            description: 'Smart Agent detected amount mismatch. Expected: ₱890, Received: ₱980 based on payment screenshot analysis.',
            amount_disputed: 90.00,
            currency: 'PHP',
            evidence_files: ['ai_analysis_report.pdf'],
            buyer_info: {
              name: 'John Cruz',
              phone: '+63918987654',
              platform: 'telegram'
            },
            order_info: {
              title: 'BTS Proof Collector Edition',
              gom_name: 'KpopGoods PH',
              total_amount: 890.00
            },
            messages: [
              {
                id: 'msg-3',
                sender_type: 'system',
                sender_name: 'Smart Agent AI',
                message: 'Detected potential amount discrepancy in payment proof. Confidence: 87%',
                timestamp: '2024-01-17T15:20:00Z'
              }
            ]
          }
        ];
        
        setDisputes(demoDisputes);
        if (disputeId) {
          const dispute = demoDisputes.find(d => d.id === disputeId);
          setSelectedDispute(dispute || null);
        }
        setLoading(false);
        return;
      }

      // Real implementation
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('payment_disputes')
        .select(`
          *,
          submissions(
            id,
            buyer_name,
            buyer_email,
            buyer_phone,
            buyer_platform,
            orders(
              id,
              title,
              profiles(name)
            )
          )
        `)
        .eq('gom_user_id', user.id)
        .order('reported_at', { ascending: false });

      if (error) throw error;
      
      // Transform data to match interface
      const transformedDisputes = data?.map(d => ({
        ...d,
        buyer_info: {
          name: d.submissions.buyer_name,
          email: d.submissions.buyer_email,
          phone: d.submissions.buyer_phone,
          platform: d.submissions.buyer_platform
        },
        order_info: {
          title: d.submissions.orders.title,
          gom_name: d.submissions.orders.profiles.name,
          total_amount: d.amount_disputed
        },
        messages: [] // Fetch separately if needed
      })) || [];

      setDisputes(transformedDisputes);
    } catch (error) {
      console.error('Error fetching disputes:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'text-red-600 bg-red-100';
      case 'investigating': return 'text-yellow-600 bg-yellow-100';
      case 'resolved': return 'text-green-600 bg-green-100';
      case 'escalated': return 'text-purple-600 bg-purple-100';
      case 'closed': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getDisputeTypeLabel = (type: string) => {
    const labels = {
      'payment_not_received': 'Payment Not Received',
      'wrong_amount': 'Wrong Amount',
      'duplicate_payment': 'Duplicate Payment', 
      'refund_request': 'Refund Request',
      'other': 'Other Issue'
    };
    return labels[type as keyof typeof labels] || type;
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedDispute) return;

    setIsProcessing(true);
    try {
      // In demo mode, just add to local state
      const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
      
      if (isDemoMode) {
        const newMsg: DisputeMessage = {
          id: `msg-${Date.now()}`,
          sender_type: 'gom',
          sender_name: 'Demo GOM',
          message: newMessage,
          timestamp: new Date().toISOString(),
          attachments: newEvidence.length > 0 ? newEvidence.map(f => f.name) : undefined
        };

        setSelectedDispute(prev => prev ? {
          ...prev,
          messages: [...prev.messages, newMsg]
        } : null);

        setNewMessage('');
        setNewEvidence([]);
        return;
      }

      // Real implementation
      await supabase.from('dispute_messages').insert({
        dispute_id: selectedDispute.id,
        sender_type: 'gom',
        message: newMessage,
        attachments: newEvidence.length > 0 ? newEvidence.map(f => f.name) : null
      });

      setNewMessage('');
      setNewEvidence([]);
      
      // Refresh messages
      fetchDisputes();
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const resolveDispute = async () => {
    if (!selectedDispute || !resolutionNotes.trim()) return;

    setIsProcessing(true);
    try {
      const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
      
      if (isDemoMode) {
        // Update local state
        setSelectedDispute(prev => prev ? {
          ...prev,
          status: resolutionType === 'escalate' ? 'escalated' : 'resolved',
          resolution_notes: resolutionNotes,
          resolved_at: new Date().toISOString(),
          resolved_by: 'Demo GOM'
        } : null);

        onResolved?.(selectedDispute.id, resolutionNotes);
        return;
      }

      // Real implementation
      await supabase
        .from('payment_disputes')
        .update({
          status: resolutionType === 'escalate' ? 'escalated' : 'resolved',
          resolution_notes: resolutionNotes,
          resolved_at: new Date().toISOString()
        })
        .eq('id', selectedDispute.id);

      fetchDisputes();
      onResolved?.(selectedDispute.id, resolutionNotes);
    } catch (error) {
      console.error('Error resolving dispute:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setNewEvidence(prev => [...prev, ...files]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Dispute list view
  if (!selectedDispute) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Payment Disputes</h2>
            <p className="text-gray-600">
              Manage and resolve payment-related issues
            </p>
          </div>
          <Button onClick={fetchDisputes} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Dispute stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Open Disputes</p>
                  <p className="text-2xl font-bold text-red-600">
                    {disputes.filter(d => d.status === 'open').length}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Investigating</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {disputes.filter(d => d.status === 'investigating').length}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Resolved</p>
                  <p className="text-2xl font-bold text-green-600">
                    {disputes.filter(d => d.status === 'resolved').length}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Resolution</p>
                  <p className="text-2xl font-bold text-blue-600">2.3d</p>
                </div>
                <Clock className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Disputes table */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Disputes</CardTitle>
          </CardHeader>
          <CardContent>
            {disputes.length > 0 ? (
              <div className="space-y-4">
                {disputes.map((dispute) => (
                  <div 
                    key={dispute.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedDispute(dispute)}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <AlertTriangle className={`h-5 w-5 ${
                          dispute.priority === 'urgent' ? 'text-red-600' :
                          dispute.priority === 'high' ? 'text-orange-600' :
                          dispute.priority === 'medium' ? 'text-yellow-600' :
                          'text-green-600'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <p className="font-medium text-gray-900 truncate">
                            {getDisputeTypeLabel(dispute.dispute_type)}
                          </p>
                          <Badge className={`text-xs ${getPriorityColor(dispute.priority)}`}>
                            {dispute.priority}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">
                          {dispute.order_info.title} • {dispute.buyer_info.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(dispute.reported_at).toLocaleDateString()} • 
                          Amount: ₱{dispute.amount_disputed.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Badge className={`${getStatusColor(dispute.status)}`}>
                        {dispute.status}
                      </Badge>
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No payment disputes
                </h3>
                <p className="text-gray-500">
                  Great job! You have no active payment disputes to resolve.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Individual dispute view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedDispute(null)}
          >
            ← Back to Disputes
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {getDisputeTypeLabel(selectedDispute.dispute_type)}
            </h2>
            <div className="flex items-center space-x-2 mt-1">
              <Badge className={`${getStatusColor(selectedDispute.status)}`}>
                {selectedDispute.status}
              </Badge>
              <Badge className={`${getPriorityColor(selectedDispute.priority)}`}>
                {selectedDispute.priority} priority
              </Badge>
              <span className="text-gray-500 text-sm">
                #{selectedDispute.id.slice(-8)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {['overview', 'messages', 'evidence', 'resolution'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="h-5 w-5 mr-2" />
                Buyer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Name:</span>
                <span className="font-medium">{selectedDispute.buyer_info.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Phone:</span>
                <span className="font-medium">{selectedDispute.buyer_info.phone}</span>
              </div>
              {selectedDispute.buyer_info.email && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Email:</span>
                  <span className="font-medium">{selectedDispute.buyer_info.email}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Platform:</span>
                <Badge variant="outline">{selectedDispute.buyer_info.platform}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="h-5 w-5 mr-2" />
                Order & Payment Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Order:</span>
                <span className="font-medium">{selectedDispute.order_info.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Amount:</span>
                <span className="font-medium">
                  ₱{selectedDispute.order_info.total_amount.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Disputed Amount:</span>
                <span className="font-medium text-red-600">
                  ₱{selectedDispute.amount_disputed.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Reported:</span>
                <span className="font-medium">
                  {new Date(selectedDispute.reported_at).toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Dispute Description</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-gray-700">{selectedDispute.description}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'messages' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <MessageSquare className="h-5 w-5 mr-2" />
              Communication Thread
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto mb-4">
              {selectedDispute.messages.map((message) => (
                <div key={message.id} className="flex space-x-3">
                  <div className="flex-shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                      message.sender_type === 'buyer' ? 'bg-blue-100 text-blue-600' :
                      message.sender_type === 'gom' ? 'bg-green-100 text-green-600' :
                      message.sender_type === 'system' ? 'bg-gray-100 text-gray-600' :
                      'bg-purple-100 text-purple-600'
                    }`}>
                      {message.sender_name.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-medium text-sm">{message.sender_name}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(message.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-700">{message.message}</p>
                    </div>
                    {message.attachments && (
                      <div className="mt-2 flex space-x-2">
                        {message.attachments.map((attachment, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            <FileImage className="h-3 w-3 mr-1" />
                            {attachment}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Message input */}
            <div className="border-t pt-4">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="message">Your Response</Label>
                  <textarea
                    id="message"
                    className="w-full mt-1 p-3 border rounded-lg resize-none"
                    rows={3}
                    placeholder="Type your message to the buyer..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <input
                      type="file"
                      id="evidence-upload"
                      multiple
                      accept="image/*,.pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('evidence-upload')?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Attach Files
                    </Button>
                    
                    {newEvidence.length > 0 && (
                      <span className="text-sm text-gray-600">
                        {newEvidence.length} file(s) selected
                      </span>
                    )}
                  </div>
                  
                  <Button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || isProcessing}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {isProcessing ? 'Sending...' : 'Send Message'}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'evidence' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileImage className="h-5 w-5 mr-2" />
              Evidence Files
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedDispute.evidence_files.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedDispute.evidence_files.map((file, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <FileImage className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium truncate">{file}</span>
                      </div>
                      <div className="flex space-x-1">
                        <Button variant="outline" size="sm">
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      Uploaded by buyer
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileImage className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No evidence files uploaded</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'resolution' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="h-5 w-5 mr-2" />
              Dispute Resolution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {selectedDispute.status === 'resolved' || selectedDispute.status === 'closed' ? (
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-900">Dispute Resolved</span>
                </div>
                <p className="text-green-800 text-sm mb-2">
                  Resolved on {selectedDispute.resolved_at ? new Date(selectedDispute.resolved_at).toLocaleString() : 'N/A'}
                </p>
                {selectedDispute.resolution_notes && (
                  <div className="bg-white p-3 rounded border">
                    <p className="text-sm text-gray-700">{selectedDispute.resolution_notes}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="resolution-type">Resolution Action</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                    {[
                      { value: 'approve', label: 'Approve Payment', color: 'bg-green-100 text-green-700' },
                      { value: 'reject', label: 'Reject Claim', color: 'bg-red-100 text-red-700' },
                      { value: 'partial', label: 'Partial Refund', color: 'bg-yellow-100 text-yellow-700' },
                      { value: 'escalate', label: 'Escalate', color: 'bg-purple-100 text-purple-700' }
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setResolutionType(option.value as any)}
                        className={`p-3 rounded-lg text-sm font-medium border-2 transition-colors ${
                          resolutionType === option.value
                            ? `${option.color} border-current`
                            : 'bg-gray-50 text-gray-700 border-transparent hover:bg-gray-100'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="resolution-notes">Resolution Notes</Label>
                  <textarea
                    id="resolution-notes"
                    className="w-full mt-2 p-3 border rounded-lg resize-none"
                    rows={4}
                    placeholder="Explain your decision and any actions taken..."
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedDispute(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={resolveDispute}
                    disabled={!resolutionNotes.trim() || isProcessing}
                    className={
                      resolutionType === 'approve' ? 'bg-green-600 hover:bg-green-700' :
                      resolutionType === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                      resolutionType === 'partial' ? 'bg-yellow-600 hover:bg-yellow-700' :
                      'bg-purple-600 hover:bg-purple-700'
                    }
                  >
                    {isProcessing ? 'Processing...' : `${resolutionType === 'escalate' ? 'Escalate' : 'Resolve'} Dispute`}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
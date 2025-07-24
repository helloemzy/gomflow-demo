"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import DisputeResolution from '@/components/payments/DisputeResolution';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft,
  Search,
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  AlertTriangle,
  MessageSquare,
  Filter,
  Download,
  RefreshCw,
  Star,
  User,
  Calendar
} from 'lucide-react';

interface PaymentProof {
  id: string;
  submission_id: string;
  order_id: string;
  buyer_name: string;
  buyer_phone: string;
  amount: number;
  currency: 'PHP' | 'MYR';
  payment_method: string;
  proof_url: string;
  uploaded_at: string;
  status: 'pending' | 'approved' | 'rejected' | 'disputed';
  ai_analysis?: {
    confidence: number;
    detected_amount?: number;
    detected_reference?: string;
    issues?: string[];
  };
  order_title: string;
  manual_notes?: string;
  verified_at?: string;
  verified_by?: string;
}

export default function VerifyPaymentsPage() {
  const [paymentProofs, setPaymentProofs] = useState<PaymentProof[]>([]);
  const [filteredProofs, setFilteredProofs] = useState<PaymentProof[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'disputed'>('all');
  const [selectedProof, setSelectedProof] = useState<PaymentProof | null>(null);
  const [showDisputes, setShowDisputes] = useState(false);
  const [processing, setProcessing] = useState(false);
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    fetchPaymentProofs();
  }, []);

  useEffect(() => {
    filterProofs();
  }, [paymentProofs, searchQuery, statusFilter]);

  const fetchPaymentProofs = async () => {
    try {
      setLoading(true);
      
      const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
      
      if (isDemoMode) {
        // Demo data
        const demoProofs: PaymentProof[] = [
          {
            id: 'proof-1',
            submission_id: 'sub-1',
            order_id: 'order-1',
            buyer_name: 'Maria Santos',
            buyer_phone: '+63917123456',
            amount: 1250.00,
            currency: 'PHP',
            payment_method: 'gcash',
            proof_url: '/demo/gcash_receipt_1.jpg',
            uploaded_at: '2024-01-18T10:30:00Z',
            status: 'pending',
            order_title: 'SEVENTEEN God of Music Album',
            ai_analysis: {
              confidence: 92,
              detected_amount: 1250.00,
              detected_reference: 'GC123456789',
              issues: []
            }
          },
          {
            id: 'proof-2',
            submission_id: 'sub-2',
            order_id: 'order-2',
            buyer_name: 'John Cruz',
            buyer_phone: '+63918987654',
            amount: 890.00,
            currency: 'PHP',
            payment_method: 'paymaya',
            proof_url: '/demo/paymaya_receipt_1.jpg',
            uploaded_at: '2024-01-17T15:20:00Z',
            status: 'disputed',
            order_title: 'BTS Proof Collector Edition',
            ai_analysis: {
              confidence: 78,
              detected_amount: 980.00,
              detected_reference: 'PM987654321',
              issues: ['Amount mismatch detected']
            }
          },
          {
            id: 'proof-3',
            submission_id: 'sub-3',
            order_id: 'order-3',
            buyer_name: 'Sarah Kim',
            buyer_phone: '+63919876543',
            amount: 750.00,
            currency: 'PHP',
            payment_method: 'gcash',
            proof_url: '/demo/gcash_receipt_2.jpg',
            uploaded_at: '2024-01-16T14:15:00Z',
            status: 'approved',
            order_title: 'NewJeans Get Up Album',
            verified_at: '2024-01-16T14:45:00Z',
            verified_by: 'Demo GOM',
            ai_analysis: {
              confidence: 96,
              detected_amount: 750.00,
              detected_reference: 'GC555666777'
            }
          }
        ];
        
        setPaymentProofs(demoProofs);
        return;
      }

      // Real implementation
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('payment_proofs')
        .select(`
          *,
          submissions(
            buyer_name,
            buyer_phone,
            orders(title)
          )
        `)
        .eq('gom_user_id', user.id)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      
      const transformedProofs = data?.map(proof => ({
        ...proof,
        buyer_name: proof.submissions.buyer_name,
        buyer_phone: proof.submissions.buyer_phone,
        order_title: proof.submissions.orders.title
      })) || [];

      setPaymentProofs(transformedProofs);
    } catch (error) {
      console.error('Error fetching payment proofs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterProofs = () => {
    let filtered = paymentProofs;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(proof => proof.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(proof => 
        proof.buyer_name.toLowerCase().includes(query) ||
        proof.order_title.toLowerCase().includes(query) ||
        proof.payment_method.toLowerCase().includes(query) ||
        proof.id.toLowerCase().includes(query)
      );
    }

    setFilteredProofs(filtered);
  };

  const handleVerifyPayment = async (proofId: string, action: 'approve' | 'reject', notes?: string) => {
    setProcessing(true);
    try {
      const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
      
      if (isDemoMode) {
        // Update local state
        setPaymentProofs(prev => prev.map(proof => 
          proof.id === proofId 
            ? { 
                ...proof, 
                status: action === 'approve' ? 'approved' : 'rejected',
                verified_at: new Date().toISOString(),
                verified_by: 'Demo GOM',
                manual_notes: notes
              }
            : proof
        ));
        return;
      }

      // Real implementation
      await supabase
        .from('payment_proofs')
        .update({
          status: action === 'approve' ? 'approved' : 'rejected',
          verified_at: new Date().toISOString(),
          manual_notes: notes
        })
        .eq('id', proofId);

      fetchPaymentProofs();
    } catch (error) {
      console.error('Error verifying payment:', error);
    } finally {
      setProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'approved': return 'text-green-600 bg-green-100';
      case 'rejected': return 'text-red-600 bg-red-100';
      case 'disputed': return 'text-purple-600 bg-purple-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-600';
    if (confidence >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const stats = {
    pending: paymentProofs.filter(p => p.status === 'pending').length,
    approved: paymentProofs.filter(p => p.status === 'approved').length,
    rejected: paymentProofs.filter(p => p.status === 'rejected').length,
    disputed: paymentProofs.filter(p => p.status === 'disputed').length
  };

  if (showDisputes) {
    return (
      <DashboardLayout>
        <DisputeResolution
          onClose={() => setShowDisputes(false)}
          onResolved={(disputeId, resolution) => {
            console.log('Dispute resolved:', disputeId, resolution);
            setShowDisputes(false);
          }}
        />
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Payment Verification</h1>
              <p className="text-gray-600">
                Review and verify payment proofs from your buyers
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              onClick={() => setShowDisputes(true)}
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Manage Disputes
            </Button>
            <Button
              variant="outline"
              onClick={fetchPaymentProofs}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending Review</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Approved</p>
                  <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Rejected</p>
                  <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Disputed</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.disputed}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search by buyer name, order, or reference..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="disputed">Disputed</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Proofs List */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Proofs ({filteredProofs.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredProofs.length > 0 ? (
              <div className="space-y-4">
                {filteredProofs.map((proof) => (
                  <div 
                    key={proof.id}
                    className="border rounded-lg p-4 hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <div className="flex items-center space-x-2">
                            <User className="h-4 w-4 text-gray-500" />
                            <span className="font-medium">{proof.buyer_name}</span>
                          </div>
                          <Badge className={`text-xs ${getStatusColor(proof.status)}`}>
                            {proof.status}
                          </Badge>
                          {proof.ai_analysis && (
                            <Badge variant="outline" className="text-xs">
                              <Star className="h-3 w-3 mr-1" />
                              AI: {proof.ai_analysis.confidence}%
                            </Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Order:</span>
                            <div className="font-medium">{proof.order_title}</div>
                          </div>
                          <div>
                            <span className="text-gray-600">Amount:</span>
                            <div className="font-medium">₱{proof.amount.toLocaleString()}</div>
                          </div>
                          <div>
                            <span className="text-gray-600">Method:</span>
                            <div className="font-medium capitalize">{proof.payment_method}</div>
                          </div>
                          <div>
                            <span className="text-gray-600">Uploaded:</span>
                            <div className="font-medium">
                              {new Date(proof.uploaded_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>

                        {proof.ai_analysis && proof.ai_analysis.issues && proof.ai_analysis.issues.length > 0 && (
                          <div className="mt-3 p-2 bg-yellow-50 rounded border-l-4 border-yellow-400">
                            <div className="flex items-center space-x-2">
                              <AlertTriangle className="h-4 w-4 text-yellow-600" />
                              <span className="text-sm font-medium text-yellow-800">AI Detected Issues:</span>
                            </div>
                            <ul className="text-sm text-yellow-700 mt-1 list-disc list-inside">
                              {proof.ai_analysis.issues.map((issue, idx) => (
                                <li key={idx}>{issue}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedProof(proof)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        
                        {proof.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => handleVerifyPayment(proof.id, 'approve')}
                              disabled={processing}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 border-red-600 hover:bg-red-50"
                              onClick={() => handleVerifyPayment(proof.id, 'reject')}
                              disabled={processing}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}
                        
                        {proof.status === 'disputed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-purple-600 border-purple-600"
                            onClick={() => setShowDisputes(true)}
                          >
                            <MessageSquare className="h-4 w-4 mr-1" />
                            Resolve
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No payment proofs found
                </h3>
                <p className="text-gray-500">
                  {statusFilter === 'all' 
                    ? "No payment proofs to review yet." 
                    : `No ${statusFilter} payment proofs found.`}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Proof Modal */}
        {selectedProof && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Payment Proof Details</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedProof(null)}
                  >
                    Close
                  </Button>
                </div>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-600">Buyer:</span>
                      <div className="font-medium">{selectedProof.buyer_name}</div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Phone:</span>
                      <div className="font-medium">{selectedProof.buyer_phone}</div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Order:</span>
                      <div className="font-medium">{selectedProof.order_title}</div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Amount:</span>
                      <div className="font-medium">₱{selectedProof.amount.toLocaleString()}</div>
                    </div>
                  </div>
                  
                  {selectedProof.ai_analysis && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">AI Analysis</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Confidence:</span>
                          <div className={`font-medium ${getConfidenceColor(selectedProof.ai_analysis.confidence)}`}>
                            {selectedProof.ai_analysis.confidence}%
                          </div>
                        </div>
                        {selectedProof.ai_analysis.detected_amount && (
                          <div>
                            <span className="text-gray-600">Detected Amount:</span>
                            <div className="font-medium">₱{selectedProof.ai_analysis.detected_amount.toLocaleString()}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="bg-gray-100 p-4 rounded-lg text-center">
                    <div className="text-sm text-gray-600 mb-2">Payment Proof Image</div>
                    <div className="w-full h-64 bg-gray-200 rounded flex items-center justify-center">
                      <span className="text-gray-500">Image preview would be shown here</span>
                    </div>
                  </div>
                  
                  {selectedProof.status === 'pending' && (
                    <div className="flex justify-end space-x-3 pt-4 border-t">
                      <Button
                        variant="outline"
                        className="text-red-600 border-red-600"
                        onClick={() => {
                          handleVerifyPayment(selectedProof.id, 'reject');
                          setSelectedProof(null);
                        }}
                      >
                        Reject
                      </Button>
                      <Button
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => {
                          handleVerifyPayment(selectedProof.id, 'approve');
                          setSelectedProof(null);
                        }}
                      >
                        Approve Payment
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
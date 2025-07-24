"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Eye, 
  Search,
  Filter,
  Download,
  MessageSquare,
  AlertTriangle,
  Zap,
  DollarSign,
  Calendar,
  User,
  Phone,
  CreditCard,
  MoreHorizontal,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

interface PaymentSubmission {
  id: string;
  buyer_name: string;
  buyer_phone: string;
  buyer_email?: string;
  order_title: string;
  quantity: number;
  total_amount: number;
  currency: 'PHP' | 'MYR';
  payment_method: string;
  payment_reference: string;
  submitted_at: Date;
  status: 'pending_verification' | 'verified' | 'rejected' | 'requires_review';
  proof_files: {
    id: string;
    url: string;
    filename: string;
    ai_analysis?: {
      confidence: number;
      detected_amount?: number;
      detected_method?: string;
      issues?: string[];
      suggestions?: string[];
    };
  }[];
  verification_notes?: string;
  verified_at?: Date;
  verified_by?: string;
}

interface PaymentVerificationDashboardProps {
  userId: string;
  onPaymentVerified?: (submissionId: string, status: 'verified' | 'rejected', notes?: string) => void;
}

// Mock data for demonstration
const mockSubmissions: PaymentSubmission[] = [
  {
    id: 'sub_001',
    buyer_name: 'Maria Santos',
    buyer_phone: '+639171234567',
    buyer_email: 'maria.santos@gmail.com',
    order_title: 'BLACKPINK - BORN PINK Album',
    quantity: 2,
    total_amount: 1200,
    currency: 'PHP',
    payment_method: 'gcash',
    payment_reference: 'BP2024-001',
    submitted_at: new Date(Date.now() - 3600000), // 1 hour ago
    status: 'pending_verification',
    proof_files: [
      {
        id: 'file_001',
        url: '/placeholder-gcash.jpg',
        filename: 'gcash_payment_proof.jpg',
        ai_analysis: {
          confidence: 92,
          detected_amount: 1200,
          detected_method: 'gcash',
          issues: [],
          suggestions: []
        }
      }
    ]
  },
  {
    id: 'sub_002',
    buyer_name: 'John Doe',
    buyer_phone: '+639181234567',
    order_title: 'SEVENTEEN - SEVENTEENTH HEAVEN',
    quantity: 1,
    total_amount: 800,
    currency: 'PHP',
    payment_method: 'paymaya',
    payment_reference: 'SVT2024-002',
    submitted_at: new Date(Date.now() - 7200000), // 2 hours ago
    status: 'requires_review',
    proof_files: [
      {
        id: 'file_002',
        url: '/placeholder-paymaya.jpg',
        filename: 'paymaya_screenshot.jpg',
        ai_analysis: {
          confidence: 67,
          detected_amount: 750,
          detected_method: 'paymaya',
          issues: ['Amount mismatch detected', 'Screenshot quality is low'],
          suggestions: ['Please verify the amount manually', 'Request clearer screenshot if needed']
        }
      }
    ]
  },
  {
    id: 'sub_003',
    buyer_name: 'Lisa Kim',
    buyer_phone: '+60123456789',
    order_title: 'NewJeans - GetUp Album',
    quantity: 3,
    total_amount: 150,
    currency: 'MYR',
    payment_method: 'touchngo',
    payment_reference: 'NJ2024-003',
    submitted_at: new Date(Date.now() - 1800000), // 30 minutes ago
    status: 'verified',
    proof_files: [
      {
        id: 'file_003',
        url: '/placeholder-tng.jpg',
        filename: 'touchngo_receipt.jpg',
        ai_analysis: {
          confidence: 98,
          detected_amount: 150,
          detected_method: 'touchngo',
          issues: [],
          suggestions: []
        }
      }
    ],
    verification_notes: 'Payment verified successfully. Clear screenshot with all details visible.',
    verified_at: new Date(Date.now() - 900000), // 15 minutes ago
    verified_by: 'GOM Admin'
  }
];

export function PaymentVerificationDashboard({ userId, onPaymentVerified }: PaymentVerificationDashboardProps) {
  const [submissions, setSubmissions] = useState<PaymentSubmission[]>(mockSubmissions);
  const [selectedSubmission, setSelectedSubmission] = useState<PaymentSubmission | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'status'>('date');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Filter and search submissions
  const filteredSubmissions = submissions.filter(sub => {
    const matchesStatus = filterStatus === 'all' || sub.status === filterStatus;
    const matchesSearch = searchQuery === '' || 
      sub.buyer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.order_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.payment_reference.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesStatus && matchesSearch;
  });

  // Sort submissions
  const sortedSubmissions = [...filteredSubmissions].sort((a, b) => {
    switch (sortBy) {
      case 'date':
        return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
      case 'amount':
        return b.total_amount - a.total_amount;
      case 'status':
        const statusOrder = { 'requires_review': 0, 'pending_verification': 1, 'verified': 2, 'rejected': 3 };
        return statusOrder[a.status] - statusOrder[b.status];
      default:
        return 0;
    }
  });

  // Pagination
  const totalPages = Math.ceil(sortedSubmissions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSubmissions = sortedSubmissions.slice(startIndex, startIndex + itemsPerPage);

  // Get status badge props
  const getStatusBadge = (status: PaymentSubmission['status']) => {
    switch (status) {
      case 'pending_verification':
        return { variant: 'secondary' as const, color: 'bg-yellow-100 text-yellow-800', icon: Clock };
      case 'verified':
        return { variant: 'default' as const, color: 'bg-green-100 text-green-800', icon: CheckCircle };
      case 'rejected':
        return { variant: 'destructive' as const, color: 'bg-red-100 text-red-800', icon: XCircle };
      case 'requires_review':
        return { variant: 'outline' as const, color: 'bg-orange-100 text-orange-800', icon: AlertTriangle };
      default:
        return { variant: 'outline' as const, color: 'bg-gray-100 text-gray-800', icon: Clock };
    }
  };

  // Handle verification
  const handleVerification = async (submissionId: string, status: 'verified' | 'rejected') => {
    setIsVerifying(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update submission status
      setSubmissions(prev => prev.map(sub => 
        sub.id === submissionId 
          ? {
              ...sub,
              status,
              verification_notes: verificationNotes,
              verified_at: new Date(),
              verified_by: 'Current User'
            }
          : sub
      ));

      // Call callback
      onPaymentVerified?.(submissionId, status, verificationNotes);
      
      // Reset form
      setVerificationNotes('');
      setSelectedSubmission(null);
      
    } catch (error) {
      console.error('Verification failed:', error);
    } finally {
      setIsVerifying(false);
    }
  };

  // Get summary stats
  const stats = {
    total: submissions.length,
    pending: submissions.filter(s => s.status === 'pending_verification').length,
    requiresReview: submissions.filter(s => s.status === 'requires_review').length,
    verified: submissions.filter(s => s.status === 'verified').length,
    rejected: submissions.filter(s => s.status === 'rejected').length
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-600">Total Submissions</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <div className="text-sm text-gray-600">Pending Review</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">{stats.requiresReview}</div>
            <div className="text-sm text-gray-600">Needs Attention</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{stats.verified}</div>
            <div className="text-sm text-gray-600">Verified</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
            <div className="text-sm text-gray-600">Rejected</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, order, or reference..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                <option value="all">All Status</option>
                <option value="pending_verification">Pending</option>
                <option value="requires_review">Needs Review</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
              </select>
              
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'amount' | 'status')}
                className="px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                <option value="date">Sort by Date</option>
                <option value="amount">Sort by Amount</option>
                <option value="status">Sort by Status</option>
              </select>
              
              <Button variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submissions List */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {paginatedSubmissions.map((submission) => {
              const statusBadge = getStatusBadge(submission.status);
              const StatusIcon = statusBadge.icon;
              
              return (
                <div key={submission.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-3">
                      {/* Header row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div>
                            <h3 className="font-semibold text-gray-900">{submission.buyer_name}</h3>
                            <p className="text-sm text-gray-600">{submission.order_title}</p>
                          </div>
                          
                          <Badge className={statusBadge.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {submission.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Badge>
                          
                          {submission.proof_files[0]?.ai_analysis && (
                            <Badge variant="outline" className="text-blue-600">
                              <Zap className="h-3 w-3 mr-1" />
                              {submission.proof_files[0].ai_analysis.confidence}% AI confidence
                            </Badge>
                          )}
                        </div>
                        
                        <div className="text-right">
                          <div className="text-lg font-bold text-primary">
                            {submission.currency === 'PHP' ? '₱' : 'RM'}{submission.total_amount.toFixed(2)}
                          </div>
                          <div className="text-sm text-gray-600">
                            {submission.quantity} item{submission.quantity > 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>

                      {/* Details row */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {submission.buyer_phone}
                        </div>
                        <div className="flex items-center gap-1">
                          <CreditCard className="h-3 w-3" />
                          {submission.payment_method.toUpperCase()}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(submission.submitted_at).toLocaleDateString()}
                        </div>
                        <div className="font-mono text-xs">
                          Ref: {submission.payment_reference}
                        </div>
                      </div>

                      {/* AI Analysis Issues */}
                      {submission.proof_files[0]?.ai_analysis?.issues && submission.proof_files[0].ai_analysis.issues.length > 0 && (
                        <div className="flex items-center gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                          <span className="text-sm text-yellow-800">
                            {submission.proof_files[0].ai_analysis.issues.length} issue(s) detected by AI
                          </span>
                        </div>
                      )}

                      {/* Verification notes */}
                      {submission.verification_notes && (
                        <div className="p-2 bg-gray-50 border rounded text-sm">
                          <strong>Notes:</strong> {submission.verification_notes}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedSubmission(submission)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Review
                      </Button>
                      
                      {submission.status === 'pending_verification' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleVerification(submission.id, 'verified')}
                            disabled={isVerifying}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleVerification(submission.id, 'rejected')}
                            disabled={isVerifying}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {paginatedSubmissions.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No payment submissions found.</p>
                <p className="text-sm mt-1">
                  {searchQuery || filterStatus !== 'all' 
                    ? 'Try adjusting your search or filters.' 
                    : 'Payment submissions will appear here when buyers upload proof.'
                  }
                </p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <div className="text-sm text-gray-600">
                Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, sortedSubmissions.length)} of {sortedSubmissions.length} submissions
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                
                <span className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Review Modal */}
      {selectedSubmission && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Payment Verification</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedSubmission(null)}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Submission details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3">Buyer Information</h3>
                  <div className="space-y-2">
                    <div><strong>Name:</strong> {selectedSubmission.buyer_name}</div>
                    <div><strong>Phone:</strong> {selectedSubmission.buyer_phone}</div>
                    {selectedSubmission.buyer_email && (
                      <div><strong>Email:</strong> {selectedSubmission.buyer_email}</div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Order Details</h3>
                  <div className="space-y-2">
                    <div><strong>Order:</strong> {selectedSubmission.order_title}</div>
                    <div><strong>Quantity:</strong> {selectedSubmission.quantity}</div>
                    <div><strong>Amount:</strong> {selectedSubmission.currency === 'PHP' ? '₱' : 'RM'}{selectedSubmission.total_amount.toFixed(2)}</div>
                    <div><strong>Method:</strong> {selectedSubmission.payment_method.toUpperCase()}</div>
                    <div><strong>Reference:</strong> {selectedSubmission.payment_reference}</div>
                  </div>
                </div>
              </div>

              {/* Payment proof files */}
              <div>
                <h3 className="font-semibold mb-3">Payment Proof</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedSubmission.proof_files.map((file) => (
                    <div key={file.id} className="border rounded-lg p-4">
                      <div className="aspect-video bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
                        <div className="text-center text-gray-500">
                          <FileImage className="h-12 w-12 mx-auto mb-2" />
                          <p className="text-sm">{file.filename}</p>
                          <Button variant="outline" size="sm" className="mt-2">
                            <Eye className="h-4 w-4 mr-1" />
                            View Image
                          </Button>
                        </div>
                      </div>

                      {file.ai_analysis && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Badge className={file.ai_analysis.confidence >= 90 ? 'bg-green-100 text-green-800' : 
                                             file.ai_analysis.confidence >= 70 ? 'bg-yellow-100 text-yellow-800' : 
                                             'bg-red-100 text-red-800'}>
                              <Zap className="h-3 w-3 mr-1" />
                              {file.ai_analysis.confidence}% confidence
                            </Badge>
                          </div>

                          {file.ai_analysis.detected_amount && (
                            <div className="text-sm">
                              <strong>Detected Amount:</strong> {selectedSubmission.currency === 'PHP' ? '₱' : 'RM'}{file.ai_analysis.detected_amount.toFixed(2)}
                              {Math.abs(file.ai_analysis.detected_amount - selectedSubmission.total_amount) > 0.01 && (
                                <span className="text-red-600 ml-1">(Mismatch!)</span>
                              )}
                            </div>
                          )}

                          {file.ai_analysis.issues && file.ai_analysis.issues.length > 0 && (
                            <div className="p-2 bg-yellow-50 border border-yellow-200 rounded">
                              <div className="text-sm font-medium text-yellow-800 mb-1">Issues:</div>
                              <ul className="text-sm text-yellow-700 list-disc list-inside">
                                {file.ai_analysis.issues.map((issue, index) => (
                                  <li key={index}>{issue}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Verification actions */}
              {selectedSubmission.status === 'pending_verification' || selectedSubmission.status === 'requires_review' ? (
                <div className="border-t pt-6">
                  <h3 className="font-semibold mb-3">Verification Decision</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Verification Notes (Optional)
                      </label>
                      <textarea
                        value={verificationNotes}
                        onChange={(e) => setVerificationNotes(e.target.value)}
                        className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm min-h-[80px]"
                        placeholder="Add any notes about this verification..."
                      />
                    </div>

                    <div className="flex justify-end gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setSelectedSubmission(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleVerification(selectedSubmission.id, 'rejected')}
                        disabled={isVerifying}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject Payment
                      </Button>
                      <Button
                        onClick={() => handleVerification(selectedSubmission.id, 'verified')}
                        disabled={isVerifying}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve Payment
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border-t pt-6">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Payment {selectedSubmission.status} on {selectedSubmission.verified_at ? new Date(selectedSubmission.verified_at).toLocaleString() : 'N/A'}
                  </div>
                  {selectedSubmission.verification_notes && (
                    <div className="mt-2 p-3 bg-gray-50 rounded text-sm">
                      <strong>Verification Notes:</strong> {selectedSubmission.verification_notes}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
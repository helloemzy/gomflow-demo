"use client";

import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, 
  Camera, 
  FileImage, 
  X, 
  CheckCircle, 
  AlertTriangle,
  RotateCcw,
  Maximize2,
  Download,
  Trash2,
  Eye,
  Zap
} from "lucide-react";

interface UploadedFile {
  id: string;
  file: File;
  preview: string;
  status: 'uploading' | 'uploaded' | 'error';
  progress: number;
  aiAnalysis?: {
    confidence: number;
    detectedAmount?: number;
    detectedMethod?: string;
    issues?: string[];
    suggestions?: string[];
  };
}

interface PaymentProofUploadProps {
  onFilesChange: (files: UploadedFile[]) => void;
  maxFiles?: number;
  maxFileSize?: number; // in MB
  requiredAmount?: number;
  currency?: 'PHP' | 'MYR';
  paymentMethod?: string;
  submissionId?: string;
}

export function PaymentProofUpload({
  onFilesChange,
  maxFiles = 3,
  maxFileSize = 10,
  requiredAmount,
  currency = 'PHP',
  paymentMethod,
  submissionId
}: PaymentProofUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const currencySymbol = currency === 'PHP' ? '₱' : 'RM';

  // Handle drag events
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  // Handle drop event
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  }, []);

  // Validate file
  const validateFile = (file: File): string | null => {
    // Check file type
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      return 'Only image files (PNG, JPG, JPEG) and PDF files are allowed';
    }

    // Check file size
    if (file.size > maxFileSize * 1024 * 1024) {
      return `File size must be less than ${maxFileSize}MB`;
    }

    // Check if max files reached
    if (files.length >= maxFiles) {
      return `Maximum ${maxFiles} files allowed`;
    }

    return null;
  };

  // Simulate AI analysis (in real implementation, this would call the Smart Agent API)
  const simulateAiAnalysis = async (file: File): Promise<UploadedFile['aiAnalysis']> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));

    // Mock AI analysis results
    const mockAnalysis = {
      confidence: Math.random() * 30 + 70, // 70-100% confidence
      detectedAmount: requiredAmount ? requiredAmount + (Math.random() - 0.5) * 10 : undefined,
      detectedMethod: paymentMethod,
      issues: [] as string[],
      suggestions: [] as string[]
    };

    // Add random issues/suggestions for demo
    if (Math.random() > 0.7) {
      mockAnalysis.issues.push('Screenshot quality could be better');
    }
    if (Math.random() > 0.8) {
      mockAnalysis.issues.push('Transaction details partially obscured');
    }
    if (mockAnalysis.issues.length > 0) {
      mockAnalysis.suggestions.push('Try taking a clearer screenshot');
      mockAnalysis.suggestions.push('Ensure all transaction details are visible');
    }

    return mockAnalysis;
  };

  // Handle file processing
  const handleFiles = async (fileList: File[]) => {
    const newFiles: UploadedFile[] = [];

    for (const file of fileList) {
      const error = validateFile(file);
      if (error) {
        alert(error); // In production, use a toast notification
        continue;
      }

      const id = Math.random().toString(36).substr(2, 9);
      const preview = URL.createObjectURL(file);
      
      const uploadedFile: UploadedFile = {
        id,
        file,
        preview,
        status: 'uploading',
        progress: 0
      };

      newFiles.push(uploadedFile);
    }

    const updatedFiles = [...files, ...newFiles];
    setFiles(updatedFiles);
    onFilesChange(updatedFiles);

    // Simulate upload progress and AI analysis for each file
    for (const uploadedFile of newFiles) {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setFiles(prevFiles => 
          prevFiles.map(f => 
            f.id === uploadedFile.id 
              ? { ...f, progress: Math.min(f.progress + Math.random() * 30, 95) }
              : f
          )
        );
      }, 300);

      try {
        // Run AI analysis
        const aiAnalysis = await simulateAiAnalysis(uploadedFile.file);
        
        clearInterval(progressInterval);
        
        // Update file with completion and AI results
        setFiles(prevFiles => {
          const updated = prevFiles.map(f => 
            f.id === uploadedFile.id 
              ? { ...f, status: 'uploaded' as const, progress: 100, aiAnalysis }
              : f
          );
          onFilesChange(updated);
          return updated;
        });

      } catch (error) {
        clearInterval(progressInterval);
        setFiles(prevFiles => 
          prevFiles.map(f => 
            f.id === uploadedFile.id 
              ? { ...f, status: 'error' as const, progress: 0 }
              : f
          )
        );
      }
    }
  };

  // Remove file
  const removeFile = (id: string) => {
    const updatedFiles = files.filter(f => f.id !== id);
    setFiles(updatedFiles);
    onFilesChange(updatedFiles);
  };

  // Get status color
  const getStatusColor = (status: UploadedFile['status']) => {
    switch (status) {
      case 'uploading': return 'text-blue-600 bg-blue-50';
      case 'uploaded': return 'text-green-600 bg-green-50';
      case 'error': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-600 bg-green-50';
    if (confidence >= 70) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Payment Proof
          </CardTitle>
          <p className="text-sm text-gray-600">
            Upload screenshots of your payment confirmation. Our AI will automatically verify the details.
          </p>
        </CardHeader>
        <CardContent>
          <div
            className={`
              relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
              ${dragActive 
                ? 'border-primary bg-primary/5' 
                : 'border-gray-300 hover:border-primary/50'
              }
              ${files.length >= maxFiles ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => {
              if (files.length < maxFiles) {
                fileInputRef.current?.click();
              }
            }}
          >
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="p-3 bg-primary/10 rounded-full">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {files.length >= maxFiles 
                    ? `Maximum ${maxFiles} files reached`
                    : 'Drop your payment screenshots here'
                  }
                </h3>
                <p className="text-gray-600">
                  or click to browse • PNG, JPG, PDF • Max {maxFileSize}MB each
                </p>
              </div>

              {files.length < maxFiles && (
                <div className="flex justify-center gap-3">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                  >
                    <FileImage className="h-4 w-4 mr-2" />
                    Browse Files
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      cameraInputRef.current?.click();
                    }}
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Take Photo
                  </Button>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              multiple
              onChange={(e) => {
                if (e.target.files) {
                  handleFiles(Array.from(e.target.files));
                }
                e.target.value = '';
              }}
              className="hidden"
            />
            
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                if (e.target.files) {
                  handleFiles(Array.from(e.target.files));
                }
                e.target.value = '';
              }}
              className="hidden"
            />
          </div>
        </CardContent>
      </Card>

      {/* Uploaded Files */}
      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileImage className="h-5 w-5" />
                Uploaded Files ({files.length}/{maxFiles})
              </div>
              <Badge variant="outline">
                {files.filter(f => f.status === 'uploaded').length} verified
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {files.map((file) => (
                <div key={file.id} className="border rounded-lg p-4">
                  <div className="flex items-start gap-4">
                    {/* File preview */}
                    <div className="flex-shrink-0">
                      {file.file.type.startsWith('image/') ? (
                        <div className="relative">
                          <img
                            src={file.preview}
                            alt="Payment proof"
                            className="w-16 h-16 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => setPreviewFile(file)}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="absolute -top-1 -right-1 h-6 w-6 p-0 bg-white shadow-sm hover:bg-red-50"
                            onClick={() => removeFile(file.id)}
                          >
                            <X className="h-3 w-3 text-red-600" />
                          </Button>
                        </div>
                      ) : (
                        <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                          <FileImage className="h-8 w-8 text-gray-600" />
                        </div>
                      )}
                    </div>

                    {/* File info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium text-gray-900 truncate">
                            {file.file.name}
                          </p>
                          <p className="text-sm text-gray-600">
                            {(file.file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(file.status)}>
                            {file.status === 'uploading' && 'Processing...'}
                            {file.status === 'uploaded' && 'Verified'}
                            {file.status === 'error' && 'Error'}
                          </Badge>
                          
                          {file.status === 'uploaded' && file.aiAnalysis && (
                            <Badge className={getConfidenceColor(file.aiAnalysis.confidence)}>
                              <Zap className="h-3 w-3 mr-1" />
                              {file.aiAnalysis.confidence.toFixed(0)}% confidence
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Progress bar */}
                      {file.status === 'uploading' && (
                        <div className="mb-3">
                          <Progress value={file.progress} className="h-2" />
                          <p className="text-xs text-gray-500 mt-1">
                            Analyzing with AI... {file.progress.toFixed(0)}%
                          </p>
                        </div>
                      )}

                      {/* AI Analysis Results */}
                      {file.status === 'uploaded' && file.aiAnalysis && (
                        <div className="space-y-2">
                          {/* Detected details */}
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            {file.aiAnalysis.detectedAmount && (
                              <div>
                                <span className="text-gray-600">Detected Amount:</span>
                                <div className="font-medium">
                                  {currencySymbol}{file.aiAnalysis.detectedAmount.toFixed(2)}
                                  {requiredAmount && Math.abs(file.aiAnalysis.detectedAmount - requiredAmount) > 0.01 && (
                                    <span className="text-red-600 ml-1">
                                      (Expected: {currencySymbol}{requiredAmount.toFixed(2)})
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {file.aiAnalysis.detectedMethod && (
                              <div>
                                <span className="text-gray-600">Payment Method:</span>
                                <div className="font-medium capitalize">
                                  {file.aiAnalysis.detectedMethod}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Issues */}
                          {file.aiAnalysis.issues && file.aiAnalysis.issues.length > 0 && (
                            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                              <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                <span className="text-sm font-medium text-yellow-800">
                                  Issues Found
                                </span>
                              </div>
                              <ul className="text-sm text-yellow-700 list-disc list-inside space-y-1">
                                {file.aiAnalysis.issues.map((issue, index) => (
                                  <li key={index}>{issue}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Suggestions */}
                          {file.aiAnalysis.suggestions && file.aiAnalysis.suggestions.length > 0 && (
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                              <div className="flex items-center gap-2 mb-2">
                                <CheckCircle className="h-4 w-4 text-blue-600" />
                                <span className="text-sm font-medium text-blue-800">
                                  Suggestions
                                </span>
                              </div>
                              <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
                                {file.aiAnalysis.suggestions.map((suggestion, index) => (
                                  <li key={index}>{suggestion}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-3">
                        {file.file.type.startsWith('image/') && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setPreviewFile(file)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Preview
                          </Button>
                        )}
                        
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = file.preview;
                            link.download = file.file.name;
                            link.click();
                          }}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => removeFile(file.id)}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Image Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-4xl max-h-full">
            <Button
              className="absolute top-4 right-4 z-10"
              variant="secondary"
              size="icon"
              onClick={() => setPreviewFile(null)}
            >
              <X className="h-4 w-4" />
            </Button>
            
            <img
              src={previewFile.preview}
              alt="Payment proof preview"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
            
            <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-1">
                {previewFile.file.name}
              </h3>
              {previewFile.aiAnalysis && (
                <div className="text-sm text-gray-600">
                  AI Analysis: {previewFile.aiAnalysis.confidence.toFixed(0)}% confidence
                  {previewFile.aiAnalysis.detectedAmount && (
                    <span className="ml-2">
                      • Amount: {currencySymbol}{previewFile.aiAnalysis.detectedAmount.toFixed(2)}
                    </span>
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
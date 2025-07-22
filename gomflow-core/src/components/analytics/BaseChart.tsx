"use client";

import { useRef, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Download, 
  Maximize2, 
  Minimize2, 
  RefreshCw,
  Image,
  FileText
} from "lucide-react";
import { exportChartAsPNG, exportChartAsPDF } from "@/lib/chartConfig";

interface BaseChartProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  onRefresh?: () => void;
  loading?: boolean;
  className?: string;
  exportFilename?: string;
}

export default function BaseChart({
  title,
  description,
  children,
  onRefresh,
  loading = false,
  className = "",
  exportFilename = "chart"
}: BaseChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleExportPNG = async () => {
    if (!chartRef.current) return;
    
    setIsExporting(true);
    try {
      const canvas = chartRef.current.querySelector('canvas');
      if (canvas) {
        const url = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `${exportFilename}.png`;
        link.href = url;
        link.click();
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!chartRef.current) return;
    
    setIsExporting(true);
    try {
      await exportChartAsPDF(chartRef, exportFilename);
    } catch (error) {
      console.error('PDF export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const cardClassName = `${className} ${isFullscreen ? 'fixed inset-0 z-50 m-4' : ''}`;

  return (
    <Card className={cardClassName}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-medium">{title}</CardTitle>
          {description && (
            <CardDescription className="text-sm">{description}</CardDescription>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExportPNG}
            disabled={isExporting}
            className="h-8 w-8 p-0"
          >
            <Image className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExportPDF}
            disabled={isExporting}
            className="h-8 w-8 p-0"
          >
            <FileText className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFullscreen}
            className="h-8 w-8 p-0"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className={`${isFullscreen ? 'h-[calc(100vh-8rem)]' : 'h-[300px]'} p-4`}>
        <div ref={chartRef} className="h-full w-full">
          {children}
        </div>
      </CardContent>
      
      {isFullscreen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={handleFullscreen}
        />
      )}
    </Card>
  );
}
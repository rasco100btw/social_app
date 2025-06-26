import { useState, useEffect } from 'react';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface UploadProgressProps {
  progress: number;
  fileName: string;
  fileSize: string;
  status: 'uploading' | 'success' | 'error';
  error?: string;
}

export function UploadProgress({
  progress,
  fileName,
  fileSize,
  status,
  error
}: UploadProgressProps) {
  const [showProgress, setShowProgress] = useState(true);
  
  useEffect(() => {
    if (status === 'success') {
      const timer = setTimeout(() => {
        setShowProgress(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [status]);
  
  if (!showProgress) return null;
  
  return (
    <div className="rounded-lg border bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {status === 'uploading' && (
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          )}
          {status === 'success' && (
            <CheckCircle className="h-5 w-5 text-green-500" />
          )}
          {status === 'error' && (
            <AlertCircle className="h-5 w-5 text-red-500" />
          )}
          
          <div>
            <p className="font-medium">{fileName}</p>
            <p className="text-sm text-gray-500">{fileSize}</p>
          </div>
        </div>
        
        <div className="text-sm">
          {status === 'uploading' && `${Math.round(progress)}%`}
          {status === 'success' && 'Complete'}
          {status === 'error' && 'Failed'}
        </div>
      </div>
      
      {status === 'uploading' && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
          <div 
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      )}
      
      {status === 'error' && error && (
        <p className="mt-1 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
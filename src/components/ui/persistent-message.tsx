import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from './button';

interface PersistentMessageProps {
  content: string | React.ReactNode;
  onDismiss?: () => void;
  position?: 'top' | 'bottom';
  type?: 'info' | 'success' | 'warning' | 'error';
}

export function PersistentMessage({
  content,
  onDismiss,
  position = 'bottom',
  type = 'info'
}: PersistentMessageProps) {
  const [isVisible, setIsVisible] = useState(true);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  if (!isVisible) return null;

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  return (
    <div
      className={`fixed ${
        position === 'top' ? 'top-4' : 'bottom-4'
      } left-1/2 z-50 -translate-x-1/2 transform`}
    >
      <div
        className={`flex min-w-[320px] max-w-[90vw] items-center justify-between rounded-lg border p-4 shadow-lg ${getTypeStyles()}`}
        role="alert"
      >
        <div className="mr-4 flex-1">{content}</div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="opacity-100 transition-opacity"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
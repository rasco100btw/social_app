import { X, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { useState } from 'react';
import { Button } from './button';

interface ImageViewerProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

export function ImageViewer({ src, alt, onClose }: ImageViewerProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  // Close on escape key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="absolute right-4 top-4 flex gap-2">
        <Button
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            handleZoomIn();
          }}
          className="text-white hover:bg-white/20"
        >
          <ZoomIn className="h-6 w-6" />
        </Button>
        <Button
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            handleZoomOut();
          }}
          className="text-white hover:bg-white/20"
        >
          <ZoomOut className="h-6 w-6" />
        </Button>
        <Button
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            handleRotate();
          }}
          className="text-white hover:bg-white/20"
        >
          <RotateCw className="h-6 w-6" />
        </Button>
        <Button
          variant="ghost"
          onClick={onClose}
          className="text-white hover:bg-white/20"
        >
          <X className="h-6 w-6" />
        </Button>
      </div>
      <img
        src={src}
        alt={alt || 'Full screen image'}
        className="max-h-[90vh] max-w-[90vw] object-contain transition-transform duration-200"
        style={{ 
          transform: `scale(${scale}) rotate(${rotation}deg)`,
          cursor: 'grab'
        }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
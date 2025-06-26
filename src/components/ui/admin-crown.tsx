import { Crown } from 'lucide-react';
import { useEffect, useState } from 'react';

interface AdminCrownProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function AdminCrown({ size = 'md', className = '' }: AdminCrownProps) {
  const [isVisible, setIsVisible] = useState(true);
  
  useEffect(() => {
    // Create subtle blinking effect for the crown
    const interval = setInterval(() => {
      setIsVisible(prev => !prev);
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);
  
  const getSizeClass = () => {
    switch (size) {
      case 'sm': return 'h-3 w-3';
      case 'lg': return 'h-6 w-6';
      default: return 'h-4 w-4';
    }
  };
  
  return (
    <div className={`relative ${className}`}>
      <Crown 
        className={`${getSizeClass()} text-yellow-400 drop-shadow-[0_0_2px_rgba(234,179,8,0.5)] transition-all duration-300 animate-pulse-gold`} 
      />
      <div className={`absolute inset-0 animate-ping-slow opacity-75 transition-opacity duration-300 ${isVisible ? 'opacity-75' : 'opacity-0'}`}>
        <Crown className={`${getSizeClass()} text-yellow-400`} />
      </div>
    </div>
  );
}
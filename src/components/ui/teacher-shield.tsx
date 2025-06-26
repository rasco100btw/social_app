import { Shield } from 'lucide-react';
import { useEffect, useState } from 'react';

interface TeacherShieldProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function TeacherShield({ size = 'md', className = '' }: TeacherShieldProps) {
  const [glowIntensity, setGlowIntensity] = useState(0);
  
  useEffect(() => {
    // Create smooth pulsing effect for the shield
    let direction = 1;
    const interval = setInterval(() => {
      setGlowIntensity(prev => {
        const newValue = prev + (0.05 * direction);
        if (newValue >= 1) direction = -1;
        if (newValue <= 0) direction = 1;
        return newValue;
      });
    }, 50);
    
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
      <Shield 
        className={`${getSizeClass()} text-blue-500 transition-all duration-300 animate-pulse-blue`} 
        style={{
          filter: `drop-shadow(0 0 ${2 + glowIntensity * 3}px rgba(59, 130, 246, ${0.5 + glowIntensity * 0.3}))`
        }}
      />
      <div className="absolute inset-0 animate-ripple-slow opacity-0">
        <Shield className={`${getSizeClass()} text-blue-500`} />
      </div>
    </div>
  );
}
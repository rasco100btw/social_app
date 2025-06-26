import { Award } from 'lucide-react';

interface ClassLeaderBadgeProps {
  color?: 'blue' | 'green' | 'purple' | 'red' | 'yellow';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ClassLeaderBadge({ 
  color = 'blue', 
  size = 'md',
  className = ''
}: ClassLeaderBadgeProps) {
  const getBgColor = () => {
    switch (color) {
      case 'green': return 'bg-green-100';
      case 'purple': return 'bg-purple-100';
      case 'red': return 'bg-red-100';
      case 'yellow': return 'bg-yellow-100';
      default: return 'bg-blue-100';
    }
  };

  const getTextColor = () => {
    switch (color) {
      case 'green': return 'text-green-600';
      case 'purple': return 'text-purple-600';
      case 'red': return 'text-red-600';
      case 'yellow': return 'text-yellow-600';
      default: return 'text-blue-600';
    }
  };

  const getSize = () => {
    switch (size) {
      case 'sm': return 'h-4 w-4';
      case 'lg': return 'h-6 w-6';
      default: return 'h-5 w-5';
    }
  };

  const getPadding = () => {
    switch (size) {
      case 'sm': return 'p-0.5';
      case 'lg': return 'p-1.5';
      default: return 'p-1';
    }
  };

  return (
    <div className={`flex items-center gap-1 rounded-full ${getBgColor()} ${getPadding()} ${className}`}>
      <Award className={`${getSize()} ${getTextColor()}`} />
      <span className={`text-xs font-medium ${getTextColor()}`}>Class Leader</span>
    </div>
  );
}
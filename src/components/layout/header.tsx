import { Bell, LogOut, Menu, X, Shield, Crown, GraduationCap, ArrowLeft, Flag, Users, CheckSquare, UserPlus, Award, HelpCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import { NotificationCenter } from '../notifications/notification-center';
import { useAuthStore } from '../../store/auth';
import { cn } from '../../lib/utils';
import { supabase } from '../../lib/supabase';

const getMobileNavItems = (role: string) => {
  const items = [
    { name: 'Profile', href: '/profile', icon: GraduationCap },
    { name: 'Users', href: '/users', icon: Users },
    { name: 'Groups', href: '/groups', icon: UserPlus },
    { name: 'HelpChat', href: '/helpchat', icon: HelpCircle },
  ];

  // Add To-Do List for students and class leaders
  if (role === 'student' || role === 'class_leader') {
    items.push({ name: 'To-Do List', href: '/todos', icon: CheckSquare });
  }

  if (role === 'admin') {
    items.push({ name: 'Reports', href: '/reports', icon: Flag });
  }

  return items;
};

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  // Check if current route should show back button
  const showBackButton = ['/posts', '/messages', '/calendar', '/announcements'].includes(location.pathname);

  useEffect(() => {
    // Get logo from Supabase storage
    const { data: { publicUrl } } = supabase.storage
      .from('logos')
      .getPublicUrl('logo-transparent.png');
      
    setLogoUrl(publicUrl);
  }, []);

  const getRoleIcon = () => {
    switch (user?.role) {
      case 'student':
        return <GraduationCap className="h-4 w-4 text-blue-500" />;
      case 'teacher':
        return <Shield className="h-4 w-4 text-blue-500" />;
      case 'admin':
        return <Crown className="h-4 w-4 text-yellow-400" />;
      case 'class_leader':
        return <Award className="h-4 w-4 text-blue-600" />;
      default:
        return null;
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-4">
          {showBackButton ? (
            <Button
              variant="ghost"
              className="md:hidden"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="h-6 w-6 text-gray-600" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              className="md:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? (
                <X className="h-6 w-6 text-gray-600" />
              ) : (
                <Menu className="h-6 w-6 text-gray-600" />
              )}
            </Button>
          )}
          {logoUrl && (
            <img 
              src={logoUrl}
              alt="CMC Social" 
              className="h-[60px] w-auto" 
            />
          )}
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <NotificationCenter />
          {/* Desktop view - show name and avatar */}
          <div className="hidden items-center gap-3 md:flex">
            <img
              src={user?.avatar_url || user?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.fullName}`}
              alt={user?.fullName}
              className="h-8 w-8 rounded-full object-cover"
            />
            <span className="text-sm font-medium">
              {user?.fullName}
            </span>
            {getRoleIcon()}
          </div>
          {/* Mobile view - show avatar and role */}
          <div className="flex items-center gap-2 md:hidden">
            <div className="flex flex-col items-end">
              <span className="text-sm font-medium">{user?.fullName}</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500 capitalize">{user?.role}</span>
                {getRoleIcon()}
              </div>
            </div>
            <img
              src={user?.avatar_url || user?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.fullName}`}
              alt={user?.fullName}
              className="h-8 w-8 rounded-full object-cover"
            />
          </div>
          <Button
            variant="ghost"
            className="h-9 w-9 p-0"
            onClick={() => logout()}
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {!showBackButton && (
        <div 
          className={cn(
            "fixed inset-0 top-16 z-40 bg-white transition-transform duration-300 ease-in-out md:hidden",
            isMenuOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <nav className="container mx-auto px-4 py-4">
            {getMobileNavItems(user?.role || 'student').map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-lg px-4 py-3 text-lg font-medium',
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  )
                }
                onClick={() => setIsMenuOpen(false)}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </NavLink>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
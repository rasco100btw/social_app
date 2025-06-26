import {
  Home,
  MessageSquare,
  User,
  Users,
  BookOpen,
  Megaphone,
  Calendar,
  Flag,
  CheckSquare,
  UserPlus,
  BarChart,
  HelpCircle,
  Menu
} from 'lucide-react';

import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../store/auth';

import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const getNavigation = (role: string) => {
  // Bottom navigation items
  const bottomNav = [
    { name: 'Posts', href: '/posts', icon: BookOpen },
    { name: 'Messages', href: '/messages', icon: MessageSquare },
    { name: 'Home', href: '/', icon: Home },
    { name: 'Events', href: '/calendar', icon: Calendar },
    { name: 'Polls', href: '/polls', icon: BarChart }, // Added Polls to bottom nav
    { name: 'Announcements', href: '/announcements', icon: Megaphone },
  ];

  // Top navigation items
  const topNav = [
    { name: 'Profile', href: '/profile', icon: User },
    { name: 'Users', href: '/users', icon: Users },
    { name: 'Groups', href: '/groups', icon: UserPlus },
    { name: 'HelpChat', href: '/helpchat', icon: HelpCircle },
  ];

  if (role === 'student' || role === 'class_leader') {
    topNav.push({ name: 'To-Do List', href: '/todos', icon: CheckSquare });
  }

  if (role === 'admin') {
    topNav.push({ name: 'Reports', href: '/reports', icon: Flag });
  }

  return { bottomNav, topNav };
};

export function Sidebar() {
  const { user } = useAuthStore();
  const { bottomNav, topNav } = getNavigation(user?.role || 'student');
  const location = useLocation();

  const hideBottomNav = ['/posts', '/messages', '/calendar', '/announcements'].includes(location.pathname);

  return (
    <>
      {/* Mobile Hamburger Menu - Hidden with display: none */}
      <div className="fixed top-0 left-0 z-50 hidden items-center md:hidden p-4">
        <Sheet>
          <SheetTrigger className="text-gray-800">
            <Menu className="h-6 w-6" />
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-4 bg-transparent">
            <div className="rounded-lg bg-white/80 backdrop-blur-md p-4 h-full">
              <NavLink to="/" className="text-xl font-bold text-blue-600 mb-4 block">
                CMC
              </NavLink>
              <nav className="space-y-1">
                {topNav.map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-gray-700 hover:bg-gray-100'
                      )
                    }
                  >
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </NavLink>
                ))}
              </nav>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <div className="fixed inset-y-0 left-0 z-40 hidden w-64 transform border-r border-gray-200 bg-white transition-transform duration-200 ease-in-out md:flex md:flex-col">
        <div className="flex h-16 items-center border-b border-gray-200 px-6">
          <NavLink
            to="/"
            className="text-2xl font-bold text-blue-600 hover:text-blue-700"
          >
            CMC
          </NavLink>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {topNav.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-700 hover:bg-gray-100'
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Mobile Bottom Navigation */}
      {!hideBottomNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white md:hidden">
          <div className="grid grid-cols-6 gap-1 px-2 py-2">
            {bottomNav.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center justify-center rounded-lg py-2 text-xs',
                    isActive
                      ? 'text-blue-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  )
                }
              >
                <item.icon className="mb-1 h-5 w-5" />
                <span className="text-[10px]">{item.name}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </>
  );
}
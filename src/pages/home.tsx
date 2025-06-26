import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, MessageSquare, Calendar, User, Users, Megaphone, Shield, Crown } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '../components/ui/button';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

interface Announcement {
  id: string;
  title: string;
  content: string;
  created_at: string;
  author: {
    id: string;
    name: string;
    avatar_url: string;
    role: string;
  };
}

export function HomePage() {
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const { data, error } = await supabase
          .from('announcements')
          .select(`
            *,
            author:profiles(
              id,
              name,
              avatar_url,
              role
            )
          `)
          .order('created_at', { ascending: false })
          .limit(3);

        if (error) throw error;
        setAnnouncements(data || []);
      } catch (error) {
        console.error('Error fetching announcements:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnnouncements();
  }, []);

  const features = [
    {
      name: 'Posts',
      description: 'Share updates and connect with other students',
      icon: FileText,
      href: '/posts',
    },
    {
      name: 'Messages',
      description: 'Chat with your fellow students',
      icon: MessageSquare,
      href: '/messages',
    },
    {
      name: 'Calendar',
      description: 'Keep track of events and deadlines',
      icon: Calendar,
      href: '/calendar',
    },
    {
      name: 'Users',
      description: 'Browse and connect with other users',
      icon: Users,
      href: '/users',
    },
    {
      name: 'Profile',
      description: 'Manage your profile and settings',
      icon: User,
      href: '/profile',
    },
  ];

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Welcome to CMC Social</h1>
        <p className="mt-2 text-gray-600">Connect with your fellow students and stay updated</p>
      </div>

      {/* Latest Announcements */}
      <div className="rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold">Latest Announcements</h2>
          </div>
          <Button variant="outline" onClick={() => navigate('/announcements')}>
            View All
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : announcements.length > 0 ? (
          <div className="space-y-4">
            {announcements.map((announcement) => (
              <div key={announcement.id} className="rounded-lg border p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={announcement.author.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${announcement.author.name}`}
                      alt={announcement.author.name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{announcement.author.name}</span>
                        {announcement.author.role === 'teacher' && (
                          <Shield className="h-4 w-4 text-blue-500" />
                        )}
                        {announcement.author.role === 'admin' && (
                          <Crown className="h-4 w-4 text-yellow-400 drop-shadow-[0_0_2px_rgba(234,179,8,0.5)]" />
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {format(new Date(announcement.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                </div>
                <h3 className="font-medium">{announcement.title}</h3>
                <p className="mt-1 text-gray-600 line-clamp-2">{announcement.content}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500 py-8">No announcements yet</p>
        )}
      </div>

      {/* Features Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <Button
            key={feature.name}
            variant="outline"
            className="flex h-auto flex-col items-center gap-4 p-6 text-left hover:bg-gray-50"
            onClick={() => navigate(feature.href)}
          >
            <feature.icon className="h-8 w-8 text-blue-600" />
            <div>
              <h3 className="font-semibold">{feature.name}</h3>
              <p className="mt-1 text-sm text-gray-600">{feature.description}</p>
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
}
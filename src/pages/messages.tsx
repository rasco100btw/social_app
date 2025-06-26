import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { MessageList } from '../components/messages/message-list';
import { ArrowLeft, Search, Shield, Crown, GraduationCap } from 'lucide-react';
import { Button } from '../components/ui/button';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

interface User {
  id: string;
  name: string;
  avatar_url: string;
  role: string;
  unread_count?: number;
}

export function MessagesPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    const recipientId = searchParams.get('recipient');
    if (recipientId) {
      setSelectedUser(recipientId);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;

    const fetchUsers = async () => {
      try {
        let query = supabase
          .from('profiles')
          .select('id, name, avatar_url, role')
          .neq('id', user.id)
          .order('name');

        // Filter based on user role
        if (user.role === 'admin') {
          query = query.eq('role', 'teacher');
        } else if (user.role === 'teacher') {
          query = query.in('role', ['student', 'teacher']);
        } else {
          query = query.in('role', ['teacher', 'student']);
        }

        if (searchQuery) {
          query = query.ilike('name', `%${searchQuery}%`);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Filter out suspended users
        const activeUsers = data?.filter(u => u.role !== 'suspended') || [];

        // Get unread message counts for each user
        const unreadCounts = await Promise.all(
          activeUsers.map(async (u) => {
            const { count } = await supabase
              .from('messages')
              .select('*', { count: 'exact', head: true })
              .eq('sender_id', u.id)
              .eq('receiver_id', user.id)
              .neq('status', 'read');

            return {
              ...u,
              unread_count: count || 0
            };
          })
        );

        setUsers(unreadCounts);
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    fetchUsers();

    // Subscribe to new messages
    const subscription = supabase
      .channel('messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${user?.id}`
      }, () => {
        fetchUsers();
      })
      .subscribe();

    // Subscribe to message status changes
    const statusSubscription = supabase
      .channel('message_status')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${user?.id}`
      }, () => {
        fetchUsers();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
      statusSubscription.unsubscribe();
    };
  }, [user, searchQuery]);

  const handleProfileClick = (userId: string) => {
    navigate(`/profile/${userId}`);
  };

  if (selectedUser) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col bg-gray-50">
        <div className="flex items-center gap-4 border-b bg-white px-4 py-2">
          <Button
            variant="ghost"
            className="p-2"
            onClick={() => setSelectedUser(null)}
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          {users.find(u => u.id === selectedUser)?.name}
        </div>
        <MessageList recipientId={selectedUser} />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] bg-white">
      <div className="border-b p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border bg-gray-50 pl-10 pr-4 py-2"
          />
        </div>
      </div>

      <div className="divide-y">
        {users.map((u) => (
          <button
            key={u.id}
            onClick={() => setSelectedUser(u.id)}
            className="flex w-full items-center gap-4 px-4 py-3 hover:bg-gray-50"
          >
            <div className="relative">
              <img
                src={u.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${u.name}`}
                alt={u.name}
                className="h-12 w-12 rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  handleProfileClick(u.id);
                }}
              />
              {u.unread_count > 0 && (
                <div className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-500 px-1.5 text-xs font-medium text-white">
                  {u.unread_count > 99 ? '99+' : u.unread_count}
                </div>
              )}
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="font-medium">{u.name}</span>
                {u.role === 'student' && (
                  <GraduationCap className="h-4 w-4 text-blue-500" />
                )}
                {u.role === 'teacher' && (
                  <Shield className="h-4 w-4 text-blue-500" />
                )}
                {u.role === 'admin' && (
                  <Crown className="h-4 w-4 text-yellow-400" />
                )}
              </div>
              <div className="text-sm text-gray-500 capitalize">{u.role}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
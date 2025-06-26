import { useState, useEffect } from 'react';
import { Search, Shield, Crown, GraduationCap, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';

interface User {
  id: string;
  name: string;
  avatar_url: string;
  role: string;
  is_online: boolean;
  is_mutual: boolean;
}

interface SharedDialogProps {
  post: {
    id: string;
    content: string;
    media?: string[];
    author: {
      name: string;
      avatar_url: string;
    };
  };
  onClose: () => void;
}

export function SharedDialog({ post, onClose }: SharedDialogProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    const fetchUsers = async () => {
      if (!user) return;

      try {
        // Get users who follow me
        const { data: followers } = await supabase
          .from('followers')
          .select('follower_id')
          .eq('following_id', user.id);

        // Get users I follow
        const { data: following } = await supabase
          .from('followers')
          .select('following_id')
          .eq('follower_id', user.id);

        if (!followers || !following) return;

        // Find mutual followers
        const followerIds = new Set(followers.map(f => f.follower_id));
        const mutualIds = following
          .map(f => f.following_id)
          .filter(id => followerIds.has(id));

        if (mutualIds.length === 0) {
          setIsLoading(false);
          return;
        }

        // Get user details for mutual followers
        const { data: mutualUsers, error } = await supabase
          .from('profiles')
          .select('id, name, avatar_url, role')
          .in('id', mutualIds);

        if (error) throw error;

        setUsers(mutualUsers.map(user => ({
          ...user,
          is_online: Math.random() > 0.5, // Simulated online status
          is_mutual: true
        })));
      } catch (error) {
        console.error('Error fetching mutual followers:', error);
        toast.error('Failed to load users');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [user]);

  const handleShare = async () => {
    if (!user || selectedUsers.length === 0) return;

    setIsSending(true);
    try {
      // Create messages for each selected user
      const messages = selectedUsers.map(receiverId => ({
        content: message || 'Shared a post with you',
        sender_id: user.id,
        receiver_id: receiverId,
        status: 'sent',
        link: `/posts/${post.id}`
      }));

      const { error } = await supabase
        .from('messages')
        .insert(messages);

      if (error) throw error;

      toast.success(`Post shared with ${selectedUsers.length} user${selectedUsers.length > 1 ? 's' : ''}`);
      onClose();
    } catch (error) {
      console.error('Error sharing post:', error);
      toast.error('Failed to share post');
    } finally {
      setIsSending(false);
    }
  };

  const toggleUser = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Share Post</h2>
          <Button variant="ghost" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Post Preview */}
        <div className="mb-4 rounded-lg border p-4">
          <p className="line-clamp-2 text-sm text-gray-600">{post.content}</p>
          {post.media && post.media.length > 0 && (
            <div className="mt-2 grid grid-cols-2 gap-1">
              {post.media.slice(0, 2).map((url, index) => (
                <div 
                  key={index}
                  className="relative aspect-square w-full overflow-hidden rounded-lg bg-gray-100"
                >
                  <img
                    src={url}
                    alt={`Post media ${index + 1}`}
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
              {post.media.length > 2 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white">
                  <span>+{post.media.length - 2} more</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Message Input */}
        <div className="mb-4">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Add a message..."
            className="w-full rounded-lg border p-2"
            rows={2}
          />
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search mutual followers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border pl-10 pr-4 py-2"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : (
          <div className="mb-4 max-h-64 space-y-2 overflow-y-auto">
            {filteredUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => toggleUser(user.id)}
                className={`flex w-full items-center gap-3 rounded-lg p-2 transition-colors ${
                  selectedUsers.includes(user.id)
                    ? 'bg-blue-50'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="relative">
                  <img
                    src={user.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${user.name}`}
                    alt={user.name}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                  {user.is_online && (
                    <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{user.name}</p>
                    {user.role === 'student' && (
                      <GraduationCap className="h-4 w-4 text-blue-500" />
                    )}
                    {user.role === 'teacher' && (
                      <Shield className="h-4 w-4 text-blue-500" />
                    )}
                    {user.role === 'admin' && (
                      <Crown className="h-4 w-4 text-yellow-400" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    {user.is_mutual ? 'Mutual follower' : ''}
                  </p>
                </div>
                <div
                  className={`h-5 w-5 rounded-full border-2 ${
                    selectedUsers.includes(user.id)
                      ? 'border-blue-600 bg-blue-600'
                      : 'border-gray-300'
                  }`}
                >
                  {selectedUsers.includes(user.id) && (
                    <svg
                      className="h-full w-full text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
              </button>
            ))}
            {filteredUsers.length === 0 && (
              <p className="text-center text-gray-500">No mutual followers found</p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleShare}
            disabled={selectedUsers.length === 0 || isSending}
          >
            {isSending ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>Share with {selectedUsers.length} selected</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
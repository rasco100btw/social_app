import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Lock, Globe, Search, Trash2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';

interface Group {
  id: string;
  name: string;
  purpose: string;
  description: string;
  subject_category: string;
  logo_url: string;
  banner_url: string;
  visibility: 'public' | 'private';
  max_capacity: number;
  current_member_count: number;
  created_at: string;
  creator: {
    name: string;
    avatar_url: string;
  };
  is_member: boolean;
  role?: string;
  unread_messages?: number;
}

interface GroupListProps {
  setShowCreateGroup: (show: boolean) => void;
}

export function GroupList({ setShowCreateGroup }: GroupListProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const isClassLeader = user?.role === 'class_leader';

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        // First, fetch the basic group information
        let query = supabase
          .from('student_groups')
          .select(`
            id,
            name,
            purpose,
            description,
            subject_category,
            logo_url,
            banner_url,
            visibility,
            max_capacity,
            current_member_count,
            created_at,
            creator:profiles!creator_id(
              name,
              avatar_url
            )
          `);

        if (searchQuery) {
          query = query.ilike('name', `%${searchQuery}%`);
        }

        const { data: groupsData, error: groupsError } = await query;

        if (groupsError) throw groupsError;

        if (!groupsData) {
          setGroups([]);
          return;
        }

        // If user is authenticated, fetch their membership status separately
        let membershipData = [];
        if (user) {
          const { data: memberships, error: membershipError } = await supabase
            .from('group_membership')
            .select('group_id, role')
            .eq('user_id', user.id);

          if (membershipError) throw membershipError;
          membershipData = memberships || [];
        }

        // Get unread message counts for groups the user is a member of
        const groupsWithUnreadCounts = await Promise.all(
          groupsData.map(async (group) => {
            const membership = membershipData.find(m => m.group_id === group.id);
            
            let unreadMessages = 0;
            if (membership) {
              // Get the timestamp of the user's last read message
              const { data: lastRead } = await supabase
                .from('group_message_reads')
                .select('last_read_at')
                .eq('group_id', group.id)
                .eq('user_id', user?.id)
                .maybeSingle();
              
              // Count messages after the last read timestamp
              if (lastRead) {
                const { count } = await supabase
                  .from('group_messages')
                  .select('*', { count: 'exact', head: true })
                  .eq('group_id', group.id)
                  .neq('sender_id', user?.id)
                  .gt('created_at', lastRead.last_read_at);
                
                unreadMessages = count || 0;
              } else {
                // If no last read message, count all messages not from the user
                const { count } = await supabase
                  .from('group_messages')
                  .select('*', { count: 'exact', head: true })
                  .eq('group_id', group.id)
                  .neq('sender_id', user?.id);
                
                unreadMessages = count || 0;
              }
            }

            return {
              ...group,
              is_member: !!membership,
              role: membership?.role,
              unread_messages: unreadMessages
            };
          })
        );

        setGroups(groupsWithUnreadCounts);
      } catch (error) {
        console.error('Error fetching groups:', error);
        toast.error('Failed to load groups');
      } finally {
        setIsLoading(false);
      }
    };

    fetchGroups();

    // Subscribe to new messages to update unread counts
    const subscription = supabase
      .channel('group-messages')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'group_messages'
      }, () => {
        fetchGroups();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user, searchQuery]);

  const handleJoinRequest = async (groupId: string) => {
    if (!user) return;

    try {
      // Get user's profile data
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('filiere')
        .eq('id', user.id)
        .single();

      if (profileError) throw profileError;

      const { error } = await supabase
        .from('group_join_requests')
        .insert({
          group_id: groupId,
          user_id: user.id,
          academic_year: '2025', // Default value
          major: profile.filiere || 'Undecided',
          interest_statement: 'Interested in joining the group', // Default statement
          status: 'pending'
        });

      if (error) throw error;

      toast.success('Join request sent!');
    } catch (error) {
      console.error('Error sending join request:', error);
      toast.error('Failed to send join request');
    }
  };

  const handleDeleteGroup = async (groupId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    
    if (!isAdmin) return;
    
    if (!window.confirm('Are you sure you want to delete this group? This action cannot be undone.')) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from('student_groups')
        .delete()
        .eq('id', groupId);
        
      if (error) throw error;
      
      setGroups(prev => prev.filter(group => group.id !== groupId));
      toast.success('Group deleted successfully');
    } catch (error) {
      console.error('Error deleting group:', error);
      toast.error('Failed to delete group');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search groups..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border bg-transparent pl-10 pr-4 py-2"
        />
      </div>

      {/* Groups Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {groups.length === 0 ? (
          <div className="col-span-full rounded-lg bg-white p-8 text-center shadow">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-4 text-gray-600">No groups found</p>
            {isClassLeader && (
              <Button 
                onClick={() => setShowCreateGroup(true)}
                className="mt-4"
              >
                Create a Group
              </Button>
            )}
          </div>
        ) : (
          groups.map((group) => (
            <div
              key={group.id}
              className="overflow-hidden rounded-lg border bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              {group.banner_url && (
                <img
                  src={group.banner_url}
                  alt={`${group.name} banner`}
                  className="h-32 w-full object-cover"
                />
              )}
              <div className="p-4">
                <div className="mb-4 flex items-center gap-4">
                  <img
                    src={group.logo_url || 'https://via.placeholder.com/64'}
                    alt={group.name}
                    className="h-16 w-16 rounded-full object-cover"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{group.name}</h3>
                      {group.visibility === 'private' ? (
                        <Lock className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Globe className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Users className="h-4 w-4" />
                      <span>{group.current_member_count}/{group.max_capacity} members</span>
                    </div>
                  </div>
                </div>

                <p className="mb-4 line-clamp-2 text-sm text-gray-600">
                  {group.purpose}
                </p>

                <div className="mb-4">
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700">
                    {group.subject_category}
                  </span>
                </div>

                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/groups/${group.id}`)}
                  >
                    View Group
                  </Button>
                  
                  {!group.is_member && group.visibility === 'public' && !isAdmin ? (
                    <Button onClick={() => handleJoinRequest(group.id)}>
                      Request to Join
                    </Button>
                  ) : group.is_member ? (
                    <div className="flex items-center gap-2">
                      {group.unread_messages && group.unread_messages > 0 && (
                        <div className="flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-600 px-1 text-xs font-medium text-white">
                          {group.unread_messages}
                        </div>
                      )}
                      <Button 
                        variant="outline"
                        onClick={() => navigate(`/groups/${group.id}`)}
                      >
                        <MessageSquare className="h-4 w-4 mr-1" />
                        Chat
                      </Button>
                    </div>
                  ) : null}
                  
                  {isAdmin && (
                    <Button
                      variant="outline"
                      className="text-red-600 hover:bg-red-50"
                      onClick={(e) => handleDeleteGroup(group.id, e)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
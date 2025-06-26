import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Users, Lock, Globe, ArrowLeft, UserPlus, UserMinus, Settings, MessageSquare, Bell, Award } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { GroupMembers } from './group-members';
import { GroupSettings } from './group-settings';
import { GroupChat } from './group-chat';
import { GroupJoinRequests } from './group-join-requests';
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
    id: string;
    name: string;
    avatar_url: string;
    role: string;
  };
  is_member: boolean;
  role?: string;
  rules: {
    id: string;
    rule_text: string;
  }[];
  unread_messages?: number;
}

export function GroupDetail() {
  const [group, setGroup] = useState<Group | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [joinRequestStatus, setJoinRequestStatus] = useState<string | null>(null);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'info' | 'members' | 'requests'>('info');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!id) return;

    const fetchGroup = async () => {
      try {
        // Fetch group data
        const { data: groupData, error: groupError } = await supabase
          .from('student_groups')
          .select(`
            *,
            creator:profiles!creator_id(
              id,
              name,
              avatar_url,
              role
            )
          `)
          .eq('id', id)
          .single();

        if (groupError) throw groupError;

        // Fetch rules
        const { data: rulesData, error: rulesError } = await supabase
          .from('group_rules')
          .select('id, rule_text')
          .eq('group_id', id);

        if (rulesError) throw rulesError;

        // Check membership status
        let membership = null;
        let unreadCount = 0;
        
        if (user) {
          const { data: membershipData, error: membershipError } = await supabase
            .from('group_membership')
            .select('role')
            .eq('group_id', id)
            .eq('user_id', user.id)
            .maybeSingle();

          if (membershipError) throw membershipError;
          membership = membershipData;

          // Check join request status if not a member
          if (!membership) {
            const { data: requestData, error: requestError } = await supabase
              .from('group_join_requests')
              .select('status')
              .eq('group_id', id)
              .eq('user_id', user.id)
              .maybeSingle();

            if (requestError) throw requestError;
            if (requestData) {
              setJoinRequestStatus(requestData.status);
            }
          } else {
            // Get unread message count
            const { data: readData } = await supabase
              .from('group_message_reads')
              .select('last_read_at')
              .eq('group_id', id)
              .eq('user_id', user.id)
              .maybeSingle();
              
            const lastReadAt = readData?.last_read_at;
            
            if (lastReadAt) {
              const { count } = await supabase
                .from('group_messages')
                .select('*', { count: 'exact', head: true })
                .eq('group_id', id)
                .neq('sender_id', user.id)
                .gt('created_at', lastReadAt);
                
              unreadCount = count || 0;
            } else {
              const { count } = await supabase
                .from('group_messages')
                .select('*', { count: 'exact', head: true })
                .eq('group_id', id)
                .neq('sender_id', user.id);
                
              unreadCount = count || 0;
            }
          }

          // If admin or primary admin, get pending requests count
          if (membership?.role === 'admin' || membership?.role === 'primary_admin') {
            const { count, error: countError } = await supabase
              .from('group_join_requests')
              .select('*', { count: 'exact', head: true })
              .eq('group_id', id)
              .eq('status', 'pending');

            if (countError) throw countError;
            setPendingRequestsCount(count || 0);
          }
        }

        setGroup({
          ...groupData,
          rules: rulesData || [],
          is_member: !!membership,
          role: membership?.role,
          unread_messages: unreadCount
        });
      } catch (error) {
        console.error('Error fetching group:', error);
        toast.error('Failed to load group');
      } finally {
        setIsLoading(false);
      }
    };

    fetchGroup();

    // Subscribe to changes
    const subscription = supabase
      .channel(`group-${id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'student_groups',
        filter: `id=eq.${id}`
      }, fetchGroup)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'group_rules',
        filter: `group_id=eq.${id}`
      }, fetchGroup)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'group_membership',
        filter: `group_id=eq.${id}`
      }, fetchGroup)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'group_join_requests',
        filter: `group_id=eq.${id}`
      }, async () => {
        // Update pending requests count
        if (user && group?.is_member && (group?.role === 'admin' || group?.role === 'primary_admin')) {
          const { count } = await supabase
            .from('group_join_requests')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', id)
            .eq('status', 'pending');
          
          setPendingRequestsCount(count || 0);
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'group_messages',
        filter: `group_id=eq.${id}`
      }, async (payload) => {
        // Only update unread count if not in chat and not the sender
        if (!showChat && payload.new.sender_id !== user?.id) {
          setGroup(prev => prev ? {
            ...prev,
            unread_messages: (prev.unread_messages || 0) + 1
          } : null);
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [id, user, showChat]);

  const handleJoinRequest = async () => {
    if (!user || !group) return;

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
          group_id: group.id,
          user_id: user.id,
          academic_year: '2025', // Default value
          major: profile.filiere || 'Undecided',
          interest_statement: 'Interested in joining the group', // Default statement
          status: 'pending'
        });

      if (error) throw error;

      setJoinRequestStatus('pending');
      toast.success('Join request sent!');
    } catch (error) {
      console.error('Error sending join request:', error);
      toast.error('Failed to send join request');
    }
  };

  const handleLeaveGroup = async () => {
    if (!user || !group) return;

    if (!window.confirm('Are you sure you want to leave this group?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('group_membership')
        .delete()
        .eq('group_id', group.id)
        .eq('user_id', user.id);

      if (error) throw error;

      setGroup(prev => prev ? { ...prev, is_member: false, role: undefined } : null);
      toast.success('You have left the group');
    } catch (error) {
      console.error('Error leaving group:', error);
      toast.error('Failed to leave group');
    }
  };

  const handleOpenChat = () => {
    setShowChat(true);
    
    // Reset unread count
    if (group) {
      setGroup({
        ...group,
        unread_messages: 0
      });
    }
    
    // Update read status
    if (user && id) {
      supabase.rpc('update_group_message_read_status', {
        p_group_id: id
      }).then(({ error }) => {
        if (error) {
          console.error('Error updating read status:', error);
        }
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="rounded-lg bg-white p-8 text-center shadow">
        <h2 className="text-xl font-semibold">Group not found</h2>
        <p className="mt-2 text-gray-600">The group you're looking for doesn't exist or you don't have permission to view it.</p>
        <Button 
          onClick={() => navigate('/groups')}
          className="mt-4"
        >
          Back to Groups
        </Button>
      </div>
    );
  }

  const isGroupAdmin = group.is_member && (group.role === 'admin' || group.role === 'primary_admin');
  const isPrimaryAdmin = group.is_member && group.role === 'primary_admin';

  if (showChat) {
    return (
      <div className="flex h-[calc(100vh-8rem)] flex-col">
        <div className="mb-4 flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => setShowChat(false)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">{group.name} Chat</h1>
        </div>
        
        <div className="flex-1 overflow-hidden rounded-lg border bg-white shadow">
          <GroupChat groupId={group.id} groupName={group.name} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => navigate('/groups')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">{group.name}</h1>
        {group.visibility === 'private' ? (
          <Lock className="h-5 w-5 text-gray-500" />
        ) : (
          <Globe className="h-5 w-5 text-gray-500" />
        )}
      </div>

      {/* Banner */}
      {group.banner_url && (
        <div className="relative h-40 w-full overflow-hidden rounded-lg">
          <img
            src={group.banner_url}
            alt={`${group.name} banner`}
            className="h-full w-full object-cover"
          />
        </div>
      )}

      {/* Tabs */}
      {isGroupAdmin && (
        <div className="flex border-b">
          <button
            className={`px-4 py-2 ${activeTab === 'info' ? 'border-b-2 border-blue-600 font-medium text-blue-600' : 'text-gray-600'}`}
            onClick={() => setActiveTab('info')}
          >
            Group Info
          </button>
          <button
            className={`px-4 py-2 ${activeTab === 'members' ? 'border-b-2 border-blue-600 font-medium text-blue-600' : 'text-gray-600'}`}
            onClick={() => setActiveTab('members')}
          >
            Members
          </button>
          <button
            className={`relative px-4 py-2 ${activeTab === 'requests' ? 'border-b-2 border-blue-600 font-medium text-blue-600' : 'text-gray-600'}`}
            onClick={() => setActiveTab('requests')}
          >
            Join Requests
            {pendingRequestsCount > 0 && (
              <span className="absolute right-0 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-xs font-medium text-white">
                {pendingRequestsCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Group Info */}
      {activeTab === 'info' && (
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-6">
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-4">
                <img
                  src={group.logo_url || 'https://via.placeholder.com/64'}
                  alt={group.name}
                  className="h-16 w-16 rounded-full object-cover"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold">{group.name}</h2>
                    {group.creator.role === 'class_leader' && (
                      <Award className="h-5 w-5 text-blue-600" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Users className="h-4 w-4" />
                    <span>{group.current_member_count}/{group.max_capacity} members</span>
                    <span>•</span>
                    <span>{group.subject_category}</span>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="mb-2 font-medium">Purpose</h3>
                <p className="text-gray-600">{group.purpose}</p>
              </div>

              {group.description && (
                <div className="mb-6">
                  <h3 className="mb-2 font-medium">Description</h3>
                  <p className="text-gray-600">{group.description}</p>
                </div>
              )}

              {group.rules.length > 0 && (
                <div>
                  <h3 className="mb-2 font-medium">Group Rules</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    {group.rules.map((rule) => (
                      <li key={rule.id} className="text-gray-600">
                        {rule.rule_text}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              {!group.is_member && group.visibility === 'public' && !isAdmin && (
                joinRequestStatus === 'pending' ? (
                  <Button variant="outline" disabled>
                    Join Request Pending
                  </Button>
                ) : (
                  <Button onClick={handleJoinRequest}>
                    <UserPlus className="mr-2 h-5 w-5" />
                    Request to Join
                  </Button>
                )
              )}

              {group.is_member && !isPrimaryAdmin && (
                <Button 
                  variant="outline" 
                  onClick={handleLeaveGroup}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <UserMinus className="mr-2 h-5 w-5" />
                  Leave Group
                </Button>
              )}

              {isGroupAdmin && (
                <Button 
                  variant="outline"
                  onClick={() => setShowSettings(true)}
                >
                  <Settings className="mr-2 h-5 w-5" />
                  Group Settings
                </Button>
              )}

              {group.is_member && (
                <Button onClick={handleOpenChat} className="relative">
                  <MessageSquare className="mr-2 h-5 w-5" />
                  Group Chat
                  {group.unread_messages && group.unread_messages > 0 && (
                    <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-medium text-white">
                      {group.unread_messages > 99 ? '99+' : group.unread_messages}
                    </span>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <GroupMembers groupId={group.id} />
          </div>
        </div>
      )}

      {/* Members Tab */}
      {activeTab === 'members' && isGroupAdmin && (
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <GroupMembers groupId={group.id} showControls={true} />
        </div>
      )}

      {/* Join Requests Tab */}
      {activeTab === 'requests' && isGroupAdmin && (
        <div className="space-y-4">
          <GroupJoinRequests groupId={group.id} isAdmin={isGroupAdmin} />
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <GroupSettings 
          group={group} 
          onClose={() => setShowSettings(false)} 
        />
      )}
    </div>
  );
}
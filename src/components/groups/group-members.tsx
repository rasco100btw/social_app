import { useState, useEffect } from 'react';
import { Users, Crown, UserMinus, UserPlus, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';

interface GroupMember {
  id: string;
  name: string;
  avatar_url: string;
  role: string;
  membership_role: string;
}

interface GroupMembersProps {
  groupId: string;
  showControls?: boolean;
}

export function GroupMembers({ groupId, showControls = false }: GroupMembersProps) {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { user } = useAuthStore();

  useEffect(() => {
    fetchMembers();

    // Subscribe to membership changes
    const subscription = supabase
      .channel(`group-members-${groupId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'group_membership',
        filter: `group_id=eq.${groupId}`
      }, fetchMembers)
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [groupId]);

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('group_membership')
        .select(`
          id,
          role,
          member:profiles!user_id(
            id,
            name,
            avatar_url,
            role
          )
        `)
        .eq('group_id', groupId)
        .order('role', { ascending: false });

      if (error) throw error;

      const formattedMembers = data.map(item => ({
        id: item.member.id,
        name: item.member.name,
        avatar_url: item.member.avatar_url,
        role: item.member.role,
        membership_role: item.role
      }));

      setMembers(formattedMembers);
    } catch (error) {
      console.error('Error fetching members:', error);
      toast.error('Failed to load group members');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!user) return;
    
    // Check if current user is admin
    const currentMember = members.find(m => m.id === user.id);
    if (!currentMember || (currentMember.membership_role !== 'admin' && currentMember.membership_role !== 'primary_admin')) {
      toast.error('You do not have permission to remove members');
      return;
    }
    
    // Cannot remove primary admin
    const targetMember = members.find(m => m.id === memberId);
    if (targetMember?.membership_role === 'primary_admin') {
      toast.error('Cannot remove the primary admin');
      return;
    }
    
    // Confirm removal
    if (!window.confirm(`Are you sure you want to remove ${targetMember?.name} from the group?`)) {
      return;
    }
    
    setProcessingId(memberId);
    try {
      const { error } = await supabase
        .from('group_membership')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', memberId);

      if (error) throw error;

      // Update member count
      await supabase
        .from('student_groups')
        .update({ current_member_count: members.length - 1 })
        .eq('id', groupId);

      toast.success('Member removed successfully');
      setMembers(prev => prev.filter(m => m.id !== memberId));
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Failed to remove member');
    } finally {
      setProcessingId(null);
    }
  };

  const handlePromoteToAdmin = async (memberId: string) => {
    if (!user) return;
    
    // Check if current user is primary admin
    const currentMember = members.find(m => m.id === user.id);
    if (!currentMember || currentMember.membership_role !== 'primary_admin') {
      toast.error('Only the primary admin can promote members');
      return;
    }
    
    // Target must be a regular member
    const targetMember = members.find(m => m.id === memberId);
    if (!targetMember || targetMember.membership_role !== 'member') {
      toast.error('Can only promote regular members');
      return;
    }
    
    setProcessingId(memberId);
    try {
      const { error } = await supabase
        .from('group_membership')
        .update({ role: 'admin' })
        .eq('group_id', groupId)
        .eq('user_id', memberId);

      if (error) throw error;

      toast.success(`${targetMember.name} is now an admin`);
      setMembers(prev => prev.map(m => 
        m.id === memberId ? { ...m, membership_role: 'admin' } : m
      ));
    } catch (error) {
      console.error('Error promoting member:', error);
      toast.error('Failed to promote member');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDemoteAdmin = async (memberId: string) => {
    if (!user) return;
    
    // Check if current user is primary admin
    const currentMember = members.find(m => m.id === user.id);
    if (!currentMember || currentMember.membership_role !== 'primary_admin') {
      toast.error('Only the primary admin can demote admins');
      return;
    }
    
    // Target must be an admin
    const targetMember = members.find(m => m.id === memberId);
    if (!targetMember || targetMember.membership_role !== 'admin') {
      toast.error('Can only demote admins');
      return;
    }
    
    setProcessingId(memberId);
    try {
      const { error } = await supabase
        .from('group_membership')
        .update({ role: 'member' })
        .eq('group_id', groupId)
        .eq('user_id', memberId);

      if (error) throw error;

      toast.success(`${targetMember.name} is now a regular member`);
      setMembers(prev => prev.map(m => 
        m.id === memberId ? { ...m, membership_role: 'member' } : m
      ));
    } catch (error) {
      console.error('Error demoting admin:', error);
      toast.error('Failed to demote admin');
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  // Sort members: primary_admin first, then admins, then regular members
  const sortedMembers = [...members].sort((a, b) => {
    const roleOrder = { primary_admin: 0, admin: 1, member: 2 };
    return roleOrder[a.membership_role as keyof typeof roleOrder] - 
           roleOrder[b.membership_role as keyof typeof roleOrder];
  });

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Users className="h-5 w-5 text-gray-500" />
        <h3 className="font-medium">Group Members ({members.length})</h3>
      </div>
      <div className="space-y-3">
        {sortedMembers.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <img
                src={member.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${member.name}`}
                alt={member.name}
                className="h-8 w-8 rounded-full object-cover"
              />
              <div>
                <div className="flex items-center gap-1">
                  <span className="font-medium">{member.name}</span>
                  {member.membership_role === 'primary_admin' && (
                    <Crown className="h-4 w-4 text-yellow-500" />
                  )}
                  {member.membership_role === 'admin' && (
                    <Shield className="h-4 w-4 text-blue-500" />
                  )}
                </div>
                <span className="text-xs text-gray-500 capitalize">
                  {member.membership_role === 'primary_admin' ? 'Group Owner' : 
                   member.membership_role === 'admin' ? 'Admin' : 'Member'}
                </span>
              </div>
            </div>

            {showControls && user?.id !== member.id && (
              <div className="flex gap-1">
                {/* Promote to admin button - only for primary admin */}
                {user?.id && 
                 members.find(m => m.id === user.id)?.membership_role === 'primary_admin' && 
                 member.membership_role === 'member' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePromoteToAdmin(member.id)}
                    disabled={processingId === member.id}
                    title="Promote to admin"
                  >
                    <UserPlus className="h-4 w-4 text-blue-500" />
                  </Button>
                )}

                {/* Demote admin button - only for primary admin */}
                {user?.id && 
                 members.find(m => m.id === user.id)?.membership_role === 'primary_admin' && 
                 member.membership_role === 'admin' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDemoteAdmin(member.id)}
                    disabled={processingId === member.id}
                    title="Demote to member"
                  >
                    <UserMinus className="h-4 w-4 text-yellow-500" />
                  </Button>
                )}

                {/* Remove member button - for admins and primary admin */}
                {((user?.id && 
                   members.find(m => m.id === user.id)?.membership_role === 'primary_admin') ||
                  (user?.id && 
                   members.find(m => m.id === user.id)?.membership_role === 'admin' && 
                   member.membership_role === 'member')) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveMember(member.id)}
                    disabled={processingId === member.id}
                    className="text-red-500 hover:bg-red-50 hover:text-red-600"
                    title="Remove from group"
                  >
                    <UserMinus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
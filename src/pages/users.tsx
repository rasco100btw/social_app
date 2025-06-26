import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { GraduationCap, Shield, Crown, ChevronDown, Ban, Award } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

interface User {
  id: string;
  name: string;
  avatar_url: string;
  role: string;
  is_blocked?: boolean;
  is_blocked_by?: boolean;
  class_leader_info?: {
    badge_color: string;
  };
}

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showRoleMenu, setShowRoleMenu] = useState<string | null>(null);
  const [showClassLeaderForm, setShowClassLeaderForm] = useState<string | null>(null);
  const [classLeaderInfo, setClassLeaderInfo] = useState({
    badge_color: 'blue',
    class_name: ''
  });
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const isTeacher = user?.role === 'teacher';

  const fetchUsers = async () => {
    if (!user) return;

    try {
      let query = supabase
        .from('profiles')
        .select(`
          id, 
          name, 
          avatar_url, 
          role,
          class_leader_info(
            badge_color
          )
        `)
        .neq('id', user.id)
        .order('name');

      // Filter based on user role
      if (user.role === 'admin') {
        // Admins can see all users
        query = query;
      } else if (user.role === 'teacher') {
        // Teachers can see students (including suspended)
        query = query.in('role', ['student', 'suspended', 'class_leader']);
      } else {
        // Students can see teachers and other students (including suspended)
        query = query.in('role', ['teacher', 'student', 'suspended', 'class_leader']);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Get block status for each user
      const usersWithBlockStatus = await Promise.all(
        (data || []).map(async (u) => {
          const { data: blockData } = await supabase
            .from('user_blocks')
            .select('blocker_id, blocked_id')
            .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${u.id}),and(blocker_id.eq.${u.id},blocked_id.eq.${user.id})`)
            .maybeSingle();

          return {
            ...u,
            is_blocked: blockData?.blocker_id === user.id,
            is_blocked_by: blockData?.blocker_id === u.id
          };
        })
      );

      setUsers(usersWithBlockStatus);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();

    // Subscribe to both profile and class_leader_info changes
    const subscription = supabase
      .channel('users-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'profiles'
      }, fetchUsers)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'class_leader_info'
      }, fetchUsers)
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!isAdmin && !isTeacher) return;

    // Only admins can assign admin role
    if (newRole === 'admin' && !isAdmin) {
      toast.error('Only administrators can assign admin roles');
      return;
    }

    try {
      // If changing from class leader to something else, remove class leader info first
      if (users.find(u => u.id === userId)?.role === 'class_leader' && newRole !== 'class_leader') {
        await supabase
          .from('class_leader_info')
          .delete()
          .eq('user_id', userId);
      }

      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;

      // If changing to class leader, we need to collect additional info
      if (newRole === 'class_leader') {
        setShowClassLeaderForm(userId);
      } else {
        setUsers(users.map(u => 
          u.id === userId ? { ...u, role: newRole, class_leader_info: undefined } : u
        ));
        
        toast.success(`User role updated to ${newRole}`);
      }
    } catch (error) {
      console.error('Error updating user role:', error);
      toast.error('Failed to update user role');
    } finally {
      setShowRoleMenu(null);
    }
  };

  const handleSaveClassLeaderInfo = async (userId: string) => {
    if (!isAdmin && !isTeacher) return;
    
    if (!classLeaderInfo.class_name) {
      toast.error('Class name is required');
      return;
    }

    try {
      // First insert class leader info
      const { error: infoError } = await supabase
        .from('class_leader_info')
        .insert({
          user_id: userId,
          badge_color: classLeaderInfo.badge_color,
          class_name: classLeaderInfo.class_name
        });

      if (infoError) throw infoError;

      // Then update the user's role to class_leader
      const { error: roleError } = await supabase
        .from('profiles')
        .update({ role: 'class_leader' })
        .eq('id', userId);

      if (roleError) throw roleError;

      // Fetch updated user data to ensure we have the latest state
      await fetchUsers();
      
      toast.success('User is now a class leader');
      setShowClassLeaderForm(null);
      
      // Reset form
      setClassLeaderInfo({
        badge_color: 'blue',
        class_name: ''
      });
    } catch (error) {
      console.error('Error setting class leader info:', error);
      toast.error('Failed to set class leader information');
    }
  };

  const handleSuspend = async (userId: string, isSuspended: boolean) => {
    if (!isAdmin) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          role: isSuspended ? 'student' : 'suspended'
        })
        .eq('id', userId);

      if (error) throw error;

      setUsers(users.map(u => 
        u.id === userId ? { ...u, role: isSuspended ? 'student' : 'suspended' } : u
      ));

      toast.success(isSuspended ? 'User unsuspended' : 'User suspended');
    } catch (error) {
      console.error('Error updating user status:', error);
      toast.error('Failed to update user status');
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
    <div className="container mx-auto py-8">
      <h1 className="mb-8 text-3xl font-bold">Users</h1>
      <div className="grid gap-4">
        {users.map((user) => (
          <div 
            key={user.id} 
            className="rounded-lg border bg-white p-4 shadow-sm hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <img
                  src={user.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${user.name}`}
                  alt={user.name}
                  className="h-16 w-16 rounded-full object-cover cursor-pointer"
                  onClick={() => navigate(`/profile/${user.id}`)}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{user.name}</h3>
                    {user.role === 'student' && (
                      <GraduationCap className="h-4 w-4 text-blue-500" />
                    )}
                    {user.role === 'teacher' && (
                      <Shield className="h-4 w-4 text-blue-500" />
                    )}
                    {user.role === 'admin' && (
                      <Crown className="h-4 w-4 text-yellow-400" />
                    )}
                    {user.role === 'class_leader' && (
                      <Award className={`h-4 w-4 ${
                        user.class_leader_info?.badge_color === 'green' ? 'text-green-600' :
                        user.class_leader_info?.badge_color === 'purple' ? 'text-purple-600' :
                        user.class_leader_info?.badge_color === 'red' ? 'text-red-600' :
                        user.class_leader_info?.badge_color === 'yellow' ? 'text-yellow-600' :
                        'text-blue-600'
                      }`} />
                    )}
                    {user.is_blocked && (
                      <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        <Ban className="h-3 w-3" />
                        Blocked
                      </span>
                    )}
                    {user.is_blocked_by && (
                      <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        <Ban className="h-3 w-3" />
                        Has blocked you
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 capitalize">
                    {user.role}
                  </div>
                </div>
              </div>
              {(isAdmin || isTeacher) && user.role !== 'admin' && (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Button
                      variant="outline"
                      onClick={() => setShowRoleMenu(showRoleMenu === user.id ? null : user.id)}
                      className="flex items-center gap-2"
                    >
                      Change Role
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    {showRoleMenu === user.id && (
                      <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border bg-white py-1 shadow-lg">
                        <button
                          onClick={() => handleRoleChange(user.id, 'student')}
                          className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-gray-50"
                        >
                          <GraduationCap className="h-4 w-4" />
                          Student
                        </button>
                        <button
                          onClick={() => handleRoleChange(user.id, 'class_leader')}
                          className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-gray-50"
                        >
                          <Award className="h-4 w-4 text-blue-600" />
                          Class Leader
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleRoleChange(user.id, 'teacher')}
                            className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-gray-50"
                          >
                            <Shield className="h-4 w-4" />
                            Teacher
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {isAdmin && user.role !== 'teacher' && (
                    <Button
                      variant="outline"
                      className={user.role === 'suspended' ? 'text-green-600' : 'text-red-600'}
                      onClick={() => handleSuspend(user.id, user.role === 'suspended')}
                    >
                      {user.role === 'suspended' ? 'Unsuspend' : 'Suspend'}
                    </Button>
                  )}
                </div>
              )}
            </div>
            
            {/* Class Leader Form */}
            {showClassLeaderForm === user.id && (
              <div className="mt-4 rounded-lg border bg-gray-50 p-4">
                <h4 className="mb-3 font-medium">Class Leader Information</h4>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Class Name</label>
                    <input
                      type="text"
                      value={classLeaderInfo.class_name}
                      onChange={(e) => setClassLeaderInfo({...classLeaderInfo, class_name: e.target.value})}
                      placeholder="e.g., Class 10A, Science Group B"
                      className="w-full rounded-lg border p-2"
                    />
                  </div>
                  
                  <div>
                    <label className="mb-1 block text-sm font-medium">Badge Color</label>
                    <div className="flex gap-2">
                      {['blue', 'green', 'purple', 'red', 'yellow'].map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setClassLeaderInfo({...classLeaderInfo, badge_color: color})}
                          className={`h-8 w-8 rounded-full ${
                            color === 'blue' ? 'bg-blue-500' :
                            color === 'green' ? 'bg-green-500' :
                            color === 'purple' ? 'bg-purple-500' :
                            color === 'red' ? 'bg-red-500' :
                            'bg-yellow-500'
                          } ${classLeaderInfo.badge_color === color ? 'ring-2 ring-offset-2' : ''}`}
                          aria-label={`${color} badge`}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setShowClassLeaderForm(null);
                        setClassLeaderInfo({
                          badge_color: 'blue',
                          class_name: ''
                        });
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => handleSaveClassLeaderInfo(user.id)}
                      disabled={!classLeaderInfo.class_name}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
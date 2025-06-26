import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Shield, Crown, MoreVertical, Flag, UserPlus, UserMinus, MessageSquare, GraduationCap, X, Award } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { ReportModal } from './report-modal';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';

interface Profile {
  id: string;
  name: string;
  email: string;
  avatar_url: string;
  biography: string;
  role: string;
  hobbies: string[];
  created_at: string;
  follower_count: number;
  following_count: number;
  is_following: boolean;
  is_blocked: boolean;
  is_blocked_by: boolean;
  privacy_settings: {
    profile_visibility: string;
    contact_info_visibility: string;
    allow_messages: boolean;
  };
  class_leader_info?: {
    badge_color: string;
    class_name: string;
  };
}

export function ProfileView() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const { user } = useAuthStore();
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchProfile() {
      try {
        if (!id || !user) return;

        // Get profile data
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*, class_leader_info(badge_color, class_name)')
          .eq('id', id)
          .single();

        if (profileError) throw profileError;

        // Get follower counts
        const { count: followerCount } = await supabase
          .from('followers')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', id);

        const { count: followingCount } = await supabase
          .from('followers')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', id);

        // Check if user is following
        const { data: followData } = await supabase
          .from('followers')
          .select('id')
          .eq('follower_id', user.id)
          .eq('following_id', id)
          .maybeSingle();

        // Check block status
        const { data: blockData } = await supabase
          .from('user_blocks')
          .select('blocker_id, blocked_id')
          .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${id}),and(blocker_id.eq.${id},blocked_id.eq.${user.id})`)
          .maybeSingle();

        // If class leader info is not in the profile data, fetch it separately
        let classLeaderInfo = null;
        if (profileData.role === 'class_leader' && !profileData.class_leader_info) {
          const { data: leaderData } = await supabase
            .from('class_leader_info')
            .select('badge_color, class_name')
            .eq('user_id', id)
            .maybeSingle();
          
          classLeaderInfo = leaderData;
        }

        // Get privacy settings
        const { data: privacyData } = await supabase
          .from('user_privacy_settings')
          .select('*')
          .eq('user_id', id)
          .maybeSingle();

        // Ensure hobbies is an array
        const hobbies = Array.isArray(profileData.hobbies) ? profileData.hobbies : [];

        setProfile({
          ...profileData,
          hobbies,
          follower_count: followerCount || 0,
          following_count: followingCount || 0,
          is_following: !!followData,
          is_blocked: blockData?.blocker_id === user.id,
          is_blocked_by: blockData?.blocker_id === id,
          class_leader_info: profileData.class_leader_info || classLeaderInfo,
          privacy_settings: privacyData || {
            profile_visibility: 'public',
            contact_info_visibility: 'public',
            allow_messages: true
          }
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [id, user]);

  const handleFollow = async () => {
    if (!user || !profile) return;

    try {
      if (profile.is_following) {
        // Unfollow
        const { error } = await supabase
          .from('followers')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', profile.id);

        if (error) throw error;

        setProfile(prev => prev ? {
          ...prev,
          is_following: false,
          follower_count: prev.follower_count - 1
        } : null);

        toast.success('Unfollowed successfully');
      } else {
        // Follow
        const { error } = await supabase
          .from('followers')
          .insert({
            follower_id: user.id,
            following_id: profile.id
          });

        if (error) throw error;

        setProfile(prev => prev ? {
          ...prev,
          is_following: true,
          follower_count: prev.follower_count + 1
        } : null);

        toast.success('Following successfully');
      }
    } catch (error) {
      console.error('Error updating follow status:', error);
      toast.error('Failed to update follow status');
    }
  };

  const handleBlock = async () => {
    if (!user || !profile) return;

    // Prevent blocking teachers
    if (profile.role === 'teacher' || profile.role === 'admin') {
      toast.error('You cannot block teachers or administrators');
      return;
    }

    try {
      if (profile.is_blocked) {
        // Unblock
        const { error } = await supabase
          .from('user_blocks')
          .delete()
          .eq('blocker_id', user.id)
          .eq('blocked_id', profile.id);

        if (error) throw error;

        setProfile(prev => prev ? {
          ...prev,
          is_blocked: false
        } : null);

        toast.success('User unblocked');
      } else {
        // Block
        const { error } = await supabase
          .from('user_blocks')
          .insert({
            blocker_id: user.id,
            blocked_id: profile.id
          });

        if (error) throw error;

        setProfile(prev => prev ? {
          ...prev,
          is_blocked: true,
          is_following: false
        } : null);

        toast.success('User blocked');
      }
      setShowOptions(false);
    } catch (error) {
      console.error('Error updating block status:', error);
      toast.error('Failed to update block status');
    }
  };

  const handleReport = () => {
    setShowOptions(false);
    setShowReportModal(true);
  };

  const handleMessage = () => {
    if (!profile) return;
    navigate(`/messages?recipient=${profile.id}`);
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-gray-500">Loading profile...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-red-800">
        <p>{error}</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-lg bg-yellow-50 p-4 text-yellow-800">
        <p>Profile not found</p>
      </div>
    );
  }

  const canBlockOrReport = user?.role !== 'student' || (profile.role !== 'teacher' && profile.role !== 'admin');
  const showHobbies = profile.role !== 'admin' && profile.hobbies && profile.hobbies.length > 0;
  const isViewingOwnProfile = user?.id === profile.id;
  const isAdmin = user?.role === 'admin';

  const getRoleBadge = () => {
    switch (profile.role) {
      case 'student':
        return <GraduationCap className="h-5 w-5 text-blue-500" />;
      case 'teacher':
        return <Shield className="h-5 w-5 text-blue-500" />;
      case 'admin':
        return <Crown className="h-5 w-5 text-yellow-400 drop-shadow-[0_0_2px_rgba(234,179,8,0.5)]" />;
      case 'class_leader':
        return (
          <div className={`flex items-center justify-center rounded-full p-1 ${
            profile.class_leader_info?.badge_color === 'green' ? 'bg-green-100' :
            profile.class_leader_info?.badge_color === 'purple' ? 'bg-purple-100' :
            profile.class_leader_info?.badge_color === 'red' ? 'bg-red-100' :
            profile.class_leader_info?.badge_color === 'yellow' ? 'bg-yellow-100' :
            'bg-blue-100'
          }`}>
            <Award className={`h-4 w-4 ${
              profile.class_leader_info?.badge_color === 'green' ? 'text-green-600' :
              profile.class_leader_info?.badge_color === 'purple' ? 'text-purple-600' :
              profile.class_leader_info?.badge_color === 'red' ? 'text-red-600' :
              profile.class_leader_info?.badge_color === 'yellow' ? 'text-yellow-600' :
              'text-blue-600'
            }`} />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="rounded-lg bg-white p-4 shadow-sm md:p-6">
        <div className="flex flex-col items-center gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col items-center text-center md:flex-row md:items-start md:text-left">
            <img
              src={profile.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${profile.name}`}
              alt={profile.name}
              className="h-24 w-24 rounded-full object-cover md:h-32 md:w-32"
            />
            <div className="mt-4 md:ml-6 md:mt-0">
              <div className="flex flex-col items-center gap-2 md:flex-row">
                <h1 className="text-2xl font-bold">{profile.name}</h1>
                {getRoleBadge()}
                {profile.is_blocked && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    Blocked
                  </span>
                )}
                {profile.is_blocked_by && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    Has blocked you
                  </span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-sm text-gray-500 md:justify-start">
                <span>{profile.follower_count} followers</span>
                <span>{profile.following_count} following</span>
                <span>Joined {format(new Date(profile.created_at), 'MMMM yyyy')}</span>
                {profile.role === 'class_leader' && profile.class_leader_info?.class_name && (
                  <span className="font-medium text-gray-700">
                    Class: {profile.class_leader_info.class_name}
                  </span>
                )}
              </div>
            </div>
          </div>

          {user && user.id !== profile.id && !profile.is_blocked_by && (
            <div className="flex flex-col gap-2 md:flex-row">
              {!profile.is_blocked && (
                <>
                  <Button
                    variant={profile.is_following ? 'outline' : 'default'}
                    onClick={handleFollow}
                    className="w-full md:w-auto"
                  >
                    {profile.is_following ? (
                      <>
                        <UserMinus className="mr-2 h-5 w-5" />
                        Unfollow
                      </>
                    ) : (
                      <>
                        <UserPlus className="mr-2 h-5 w-5" />
                        Follow
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleMessage}
                    className="w-full md:w-auto"
                  >
                    <MessageSquare className="mr-2 h-5 w-5" />
                    Message
                  </Button>
                </>
              )}
              {canBlockOrReport && (
                <div className="relative">
                  <Button
                    variant="ghost"
                    onClick={() => setShowOptions(!showOptions)}
                    className="w-full md:w-auto"
                  >
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                  {showOptions && (
                    <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-lg border bg-white py-1 shadow-lg">
                      <button
                        onClick={handleReport}
                        className="flex w-full items-center px-4 py-2 text-left text-red-600 hover:bg-gray-50"
                      >
                        <Flag className="mr-2 h-4 w-4" />
                        Report User
                      </button>
                      <button
                        onClick={handleBlock}
                        className="flex w-full items-center px-4 py-2 text-left text-red-600 hover:bg-gray-50"
                      >
                        <Shield className="mr-2 h-4 w-4" />
                        {profile.is_blocked ? 'Unblock User' : 'Block User'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Profile Content */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* About */}
        {profile.biography && (
          <div className="rounded-lg bg-white p-4 shadow-sm md:p-6">
            <h2 className="mb-4 text-lg font-semibold">About</h2>
            <p className="text-gray-600">{profile.biography}</p>
          </div>
        )}

        {/* Hobbies - Only show for non-admin users */}
        {showHobbies && !(isViewingOwnProfile && isAdmin) && (
          <div className="rounded-lg bg-white p-4 shadow-sm md:p-6">
            <h2 className="mb-4 text-lg font-semibold">Hobbies</h2>
            <div className="flex flex-wrap gap-2">
              {profile.hobbies.map((hobby) => (
                <span
                  key={hobby}
                  className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800"
                >
                  {hobby}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {showReportModal && profile && (
        <ReportModal
          userId={profile.id}
          userName={profile.name}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </div>
  );
}
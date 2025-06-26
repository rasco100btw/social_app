import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, UserPlus, MessageSquare, Shield, ExternalLink, Award } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';

interface StudentProfile {
  id: string;
  name: string;
  email: string;
  avatar_url: string;
  biography: string;
  academic_program: string;
  year_of_study: number;
  enrollment_status: string;
  student_id: string;
  academic_interests: string[];
  clubs_organizations: string[];
  activities: Array<{
    id: string;
    activity_type: string;
    title: string;
    description: string;
    date: string;
  }>;
  connection_status?: 'none' | 'pending' | 'accepted';
  privacy_settings: {
    profile_visibility: string;
    contact_info_visibility: string;
    academic_info_visibility: string;
    activities_visibility: string;
    allow_messages: boolean;
  };
  role: string;
  class_leader_info?: {
    badge_color: string;
    class_name: string;
  };
}

const DEFAULT_PRIVACY_SETTINGS = {
  profile_visibility: 'public',
  contact_info_visibility: 'public',
  academic_info_visibility: 'public',
  activities_visibility: 'public',
  allow_messages: true,
};

export function StudentProfile() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        // Fetch basic profile data
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*, class_leader_info(badge_color, class_name)')
          .eq('id', id)
          .single();

        if (profileError) throw profileError;

        // Fetch privacy settings using maybeSingle() to handle no results
        const { data: privacyData } = await supabase
          .from('user_privacy_settings')
          .select('*')
          .eq('user_id', id)
          .maybeSingle();

        // Fetch activities
        const { data: activities, error: activitiesError } = await supabase
          .from('student_activities')
          .select('*')
          .eq('student_id', id)
          .order('date', { ascending: false });

        if (activitiesError) throw activitiesError;

        // Fetch connection status if authenticated
        let connectionStatus = 'none';
        if (user) {
          const { data: connection, error: connectionError } = await supabase
            .from('student_connections')
            .select('status')
            .or(`and(requester_id.eq.${user.id},recipient_id.eq.${id}),and(requester_id.eq.${id},recipient_id.eq.${user.id})`)
            .maybeSingle();

          if (connectionError) throw connectionError;
          connectionStatus = connection?.status || 'none';
        }

        setProfile({
          ...profileData,
          activities: activities || [],
          connection_status: connectionStatus as 'none' | 'pending' | 'accepted',
          privacy_settings: privacyData ?? DEFAULT_PRIVACY_SETTINGS
        });
      } catch (error) {
        console.error('Error fetching profile:', error);
        toast.error('Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [id, user]);

  const handleConnect = async () => {
    if (!user || !profile) return;

    try {
      const { error } = await supabase
        .from('student_connections')
        .insert({
          requester_id: user.id,
          recipient_id: profile.id,
          status: 'pending'
        });

      if (error) throw error;

      setProfile(prev => prev ? {
        ...prev,
        connection_status: 'pending'
      } : null);

      toast.success('Connection request sent');
    } catch (error) {
      console.error('Error sending connection request:', error);
      toast.error('Failed to send connection request');
    }
  };

  const handleMessage = () => {
    if (!profile) return;
    navigate(`/messages?recipient=${profile.id}`);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-bold">Profile not found</h2>
        <p className="mt-2 text-gray-600">The requested profile does not exist.</p>
      </div>
    );
  }

  const canViewContact = profile.privacy_settings.contact_info_visibility === 'public' ||
    (profile.privacy_settings.contact_info_visibility === 'connections' && profile.connection_status === 'accepted');

  const canMessage = profile.privacy_settings.allow_messages && profile.connection_status === 'accepted';

  const getRoleBadge = () => {
    if (profile.role === 'class_leader' && profile.class_leader_info) {
      return (
        <div className={`flex items-center gap-1 rounded-full ${
          profile.class_leader_info.badge_color === 'green' ? 'bg-green-100' :
          profile.class_leader_info.badge_color === 'purple' ? 'bg-purple-100' :
          profile.class_leader_info.badge_color === 'red' ? 'bg-red-100' :
          profile.class_leader_info.badge_color === 'yellow' ? 'bg-yellow-100' :
          'bg-blue-100'
        } px-2 py-1`}>
          <Award className={`h-4 w-4 ${
            profile.class_leader_info.badge_color === 'green' ? 'text-green-600' :
            profile.class_leader_info.badge_color === 'purple' ? 'text-purple-600' :
            profile.class_leader_info.badge_color === 'red' ? 'text-red-600' :
            profile.class_leader_info.badge_color === 'yellow' ? 'text-yellow-600' :
            'text-blue-600'
          }`} />
          <span className="text-xs font-medium">
            {profile.class_leader_info.class_name}
          </span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header with Navigation */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="text-gray-600"
        >
          <ArrowLeft className="mr-2 h-5 w-5" />
          Back
        </Button>
        <h1 className="text-2xl font-bold">Student Profile</h1>
      </div>

      {/* Main Profile Section */}
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <div className="flex items-start gap-6">
          <img
            src={profile.avatar_url || 'https://via.placeholder.com/150'}
            alt={profile.name}
            className="h-32 w-32 rounded-full object-cover"
          />
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold">{profile.name}</h2>
                  {getRoleBadge()}
                </div>
                <p className="text-gray-600">{profile.academic_program}</p>
                <p className="text-sm text-gray-500">Year {profile.year_of_study}</p>
              </div>
              <div className="flex gap-2">
                {user && user.id !== profile.id && (
                  <>
                    {profile.connection_status === 'none' && (
                      <Button onClick={handleConnect}>
                        <UserPlus className="mr-2 h-5 w-5" />
                        Connect
                      </Button>
                    )}
                    {profile.connection_status === 'pending' && (
                      <Button variant="outline" disabled>
                        Request Pending
                      </Button>
                    )}
                    {canMessage && (
                      <Button variant="outline" onClick={handleMessage}>
                        <MessageSquare className="mr-2 h-5 w-5" />
                        Message
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Contact Information */}
            {canViewContact && (
              <div className="mt-4 flex items-center gap-4">
                <Button variant="outline" className="text-gray-600">
                  <Mail className="mr-2 h-5 w-5" />
                  {profile.email}
                </Button>
                <div className="flex items-center text-sm text-gray-500">
                  <Shield className="mr-1 h-4 w-4" />
                  Contact info visible to {profile.privacy_settings.contact_info_visibility}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Academic Information */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          {/* About */}
          <section className="rounded-lg bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold">About</h3>
            <p className="text-gray-600">{profile.biography}</p>
          </section>

          {/* Academic Interests */}
          <section className="rounded-lg bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold">Academic Interests</h3>
            <div className="flex flex-wrap gap-2">
              {profile.academic_interests?.map((interest) => (
                <span
                  key={interest}
                  className="rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700"
                >
                  {interest}
                </span>
              ))}
            </div>
          </section>

          {/* Clubs & Organizations */}
          <section className="rounded-lg bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold">Clubs & Organizations</h3>
            <div className="space-y-2">
              {profile.clubs_organizations?.map((club) => (
                <div
                  key={club}
                  className="flex items-center gap-2 rounded-lg bg-gray-50 p-3"
                >
                  <span>{club}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Recent Activities */}
        <div className="space-y-6">
          <section className="rounded-lg bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold">Recent Activities</h3>
            <div className="space-y-4">
              {profile.activities.map((activity) => (
                <div
                  key={activity.id}
                  className="rounded-lg border p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium">{activity.title}</h4>
                      <p className="text-sm text-gray-600">{activity.description}</p>
                    </div>
                    <span className="text-sm text-gray-500">
                      {new Date(activity.date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
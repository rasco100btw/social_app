import { useState, useEffect } from 'react';
import { Check, X, Loader2, UserPlus, UserMinus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';

interface JoinRequest {
  id: string;
  user_id: string;
  academic_year: string | null;
  major: string | null;
  interest_statement: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  user: {
    name: string;
    avatar_url: string;
    role: string;
  };
}

interface GroupJoinRequestsProps {
  groupId: string;
  isAdmin: boolean;
}

export function GroupJoinRequests({ groupId, isAdmin }: GroupJoinRequestsProps) {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { user } = useAuthStore();

  useEffect(() => {
    fetchRequests();

    // Subscribe to changes
    const subscription = supabase
      .channel(`group-requests-${groupId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'group_join_requests',
        filter: `group_id=eq.${groupId}`
      }, fetchRequests)
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [groupId]);

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('group_join_requests')
        .select(`
          *,
          user:profiles!user_id(
            name,
            avatar_url,
            role
          )
        `)
        .eq('group_id', groupId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error('Error fetching join requests:', error);
      toast.error('Failed to load join requests');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequest = async (requestId: string, approve: boolean) => {
    if (!isAdmin) return;
    
    setProcessingId(requestId);
    try {
      const { error } = await supabase
        .from('group_join_requests')
        .update({
          status: approve ? 'approved' : 'rejected'
        })
        .eq('id', requestId);

      if (error) throw error;

      // If approved, the trigger will handle adding the user to the group
      // and updating the member count
      
      toast.success(`Request ${approve ? 'approved' : 'rejected'}`);
      setRequests(prev => prev.filter(req => req.id !== requestId));
    } catch (error) {
      console.error('Error processing request:', error);
      toast.error('Failed to process request');
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-lg border bg-white p-6 text-center shadow-sm">
        <UserPlus className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2 text-gray-600">No pending join requests</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white shadow-sm">
      <div className="border-b p-4">
        <h3 className="font-medium">Pending Join Requests ({requests.length})</h3>
      </div>
      <div className="divide-y">
        {requests.map((request) => (
          <div key={request.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={request.user.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${request.user.name}`}
                  alt={request.user.name}
                  className="h-10 w-10 rounded-full object-cover"
                />
                <div>
                  <p className="font-medium">{request.user.name}</p>
                  <p className="text-sm text-gray-500">
                    {request.major || 'No major specified'}
                    {request.academic_year && ` • Year ${request.academic_year}`}
                  </p>
                </div>
              </div>
              
              {isAdmin && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRequest(request.id, false)}
                    disabled={processingId === request.id}
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    {processingId === request.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleRequest(request.id, true)}
                    disabled={processingId === request.id}
                  >
                    {processingId === request.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}
            </div>
            
            <div className="mt-2 rounded-lg bg-gray-50 p-3">
              <p className="text-sm text-gray-700">{request.interest_statement}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
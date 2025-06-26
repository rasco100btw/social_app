import { useState, useEffect } from 'react';
import { BarChart, Clock, Users, CheckCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '../ui/button';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { toast } from 'sonner';

interface PollOption {
  id: string;
  text: string;
  votes: number;
}

interface PollData {
  id: string;
  post_id: string;
  question: string;
  options: PollOption[];
  end_date: string | null;
  total_votes: number;
  user_vote: string | null;
  created_at: string;
}

interface PollDisplayProps {
  postId: string;
  pollData: any;
}

export function PollDisplay({ postId, pollData }: PollDisplayProps) {
  const [poll, setPoll] = useState<PollData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVoting, setIsVoting] = useState(false);
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const isTeacher = user?.role === 'teacher';
  const canVote = !isAdmin && !isTeacher;

  useEffect(() => {
    fetchPollData();
  }, [postId]);

  const fetchPollData = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      
      // First, check if poll already exists for this post
      const { data: existingPoll, error: checkError } = await supabase
        .from('polls')
        .select('*')
        .eq('post_id', postId)
        .maybeSingle();
        
      // If poll doesn't exist and we have poll data, create it
      if (!existingPoll && pollData) {
        try {
          // Create the poll
          const { data: newPoll, error: createError } = await supabase
            .from('polls')
            .insert({
              post_id: postId,
              question: pollData.question,
              end_date: pollData.end_date
            })
            .select()
            .single();
            
          if (createError) {
            // If there's a duplicate key error, another process might have created it
            if (createError.code === '23505') {
              console.log('Poll already exists, fetching existing poll');
              return fetchPollData();
            }
            throw createError;
          }

          // Create the options
          const optionPromises = pollData.options.map((option: string) => 
            supabase
              .from('poll_options')
              .insert({
                poll_id: newPoll.id,
                text: option
              })
          );
          
          await Promise.all(optionPromises);
          
          // Fetch the newly created poll
          return fetchPollData();
        } catch (error) {
          console.error('Error creating poll:', error);
          throw error;
        }
      }
      
      // Get the poll data
      const pollRecord = existingPoll;
      if (!pollRecord) {
        setIsLoading(false);
        return;
      }
      
      // Get the poll options
      const { data: optionsData, error: optionsError } = await supabase
        .from('poll_options')
        .select('*')
        .eq('poll_id', pollRecord.id)
        .order('created_at', { ascending: true });
        
      if (optionsError) throw optionsError;
      
      // Get the user's vote if any
      const { data: userVote, error: voteError } = await supabase
        .from('poll_votes')
        .select('option_id')
        .eq('poll_id', pollRecord.id)
        .eq('user_id', user.id)
        .maybeSingle();
        
      if (voteError && voteError.code !== 'PGRST116') throw voteError;
      
      // Get all votes and count them client-side
      const { data: votesData, error: votesError } = await supabase
        .from('poll_votes')
        .select('option_id')
        .eq('poll_id', pollRecord.id);
        
      if (votesError) throw votesError;
      
      // Count votes for each option
      const voteCounts = votesData.reduce((acc: { [key: string]: number }, vote) => {
        acc[vote.option_id] = (acc[vote.option_id] || 0) + 1;
        return acc;
      }, {});
      
      // Process the data
      const options = optionsData.map(option => ({
        id: option.id,
        text: option.text,
        votes: voteCounts[option.id] || 0
      }));
      
      const totalVotes = options.reduce((sum, option) => sum + option.votes, 0);
      
      setPoll({
        id: pollRecord.id,
        post_id: pollRecord.post_id,
        question: pollRecord.question,
        options,
        end_date: pollRecord.end_date,
        total_votes: totalVotes,
        user_vote: userVote?.option_id || null,
        created_at: pollRecord.created_at
      });
    } catch (error) {
      console.error('Error fetching poll data:', error);
      toast.error('Error fetching poll data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVote = async (optionId: string) => {
    if (!user || !poll || !canVote) return;
    
    // If user is admin or teacher, don't allow voting
    if (isAdmin || isTeacher) {
      toast.error('Admins and teachers cannot vote in polls');
      return;
    }
    
    // Check if poll has ended
    if (poll.end_date && new Date(poll.end_date) < new Date()) {
      toast.error('This poll has ended');
      return;
    }
    
    // Check if user has already voted
    if (poll.user_vote) {
      toast.error('You have already voted in this poll');
      return;
    }
    
    setIsVoting(true);
    try {
      const { error } = await supabase
        .from('poll_votes')
        .insert({
          poll_id: poll.id,
          option_id: optionId,
          user_id: user.id
        });
        
      if (error) throw error;
      
      // Update local state
      setPoll(prev => {
        if (!prev) return null;
        
        const updatedOptions = prev.options.map(option => 
          option.id === optionId 
            ? { ...option, votes: option.votes + 1 } 
            : option
        );
        
        return {
          ...prev,
          options: updatedOptions,
          total_votes: prev.total_votes + 1,
          user_vote: optionId
        };
      });
      
      toast.success('Vote recorded successfully');
    } catch (error) {
      console.error('Error voting:', error);
      toast.error('Failed to record vote');
    } finally {
      setIsVoting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!poll) return null;

  const isPollEnded = poll.end_date && new Date(poll.end_date) < new Date();
  const hasVoted = !!poll.user_vote;

  return (
    <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart className="h-5 w-5 text-blue-600" />
          <h3 className="font-medium text-blue-800">Poll</h3>
        </div>
        <div className="flex items-center gap-2 text-sm text-blue-600">
          <Users className="h-4 w-4" />
          <span>{poll.total_votes} votes</span>
        </div>
      </div>
      
      <p className="mb-4 text-lg font-medium text-gray-800">{poll.question}</p>
      
      <div className="space-y-3">
        {poll.options.map((option) => {
          const percentage = poll.total_votes > 0 
            ? Math.round((option.votes / poll.total_votes) * 100) 
            : 0;
          
          const isSelected = poll.user_vote === option.id;
          
          return (
            <div key={option.id} className="relative">
              {(hasVoted || isPollEnded || !canVote) ? (
                // Results view
                <div className="rounded-lg border border-blue-200 bg-white p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{option.text}</span>
                      {isSelected && (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                    <span className="text-sm font-medium">{percentage}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                    <div 
                      className={`h-full ${isSelected ? 'bg-green-500' : 'bg-blue-500'}`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {option.votes} {option.votes === 1 ? 'vote' : 'votes'}
                  </div>
                </div>
              ) : (
                // Voting view
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start border-blue-200 bg-white p-3 text-left hover:bg-blue-50"
                  onClick={() => handleVote(option.id)}
                  disabled={isVoting || !canVote}
                >
                  {option.text}
                </Button>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Poll status */}
      <div className="mt-4 flex items-center justify-between text-sm">
        <div className="flex items-center gap-1 text-gray-500">
          <Clock className="h-4 w-4" />
          <span>
            {isPollEnded 
              ? `Ended ${format(new Date(poll.end_date!), 'MMM d, yyyy')}` 
              : poll.end_date 
                ? `Ends ${format(new Date(poll.end_date), 'MMM d, yyyy')}` 
                : 'No end date'}
          </span>
        </div>
        
        {!canVote && (
          <div className="flex items-center gap-1 text-blue-600">
            <AlertCircle className="h-4 w-4" />
            <span>Admins cannot vote</span>
          </div>
        )}
        
        {isPollEnded && (
          <div className="flex items-center gap-1 text-yellow-600">
            <AlertCircle className="h-4 w-4" />
            <span>Poll closed</span>
          </div>
        )}
      </div>
    </div>
  );
}
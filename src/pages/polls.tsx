import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { BarChart, Clock, Users, CheckCircle, AlertCircle, Plus, Loader2, Filter, Search } from 'lucide-react';
import { Button } from '../components/ui/button';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { toast } from 'sonner';
import { PollCreator } from '../components/polls/poll-creator';

interface Poll {
  id: string;
  post_id: string;
  question: string;
  end_date: string | null;
  created_at: string;
  total_votes: number;
  options: {
    id: string;
    text: string;
    votes: number;
  }[];
  user_vote: string | null;
  author: {
    id: string;
    name: string;
    avatar_url: string;
    role: string;
  };
  is_ended: boolean;
}

export function PollsPage() {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>([]);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollEndDate, setPollEndDate] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'ended' | 'voted' | 'not-voted'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { user } = useAuthStore();
  
  const isAdmin = user?.role === 'admin';
  const isTeacher = user?.role === 'teacher';
  const canCreatePolls = isAdmin || isTeacher;
  const canVote = !isAdmin && !isTeacher;

  useEffect(() => {
    fetchPolls();
  }, [filter]);

  const fetchPolls = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      
      // First, get all polls with their options and votes
      const { data: pollsData, error: pollsError } = await supabase
        .from('polls')
        .select(`
          *,
          post:posts(
            author_id,
            author:profiles!posts_author_id_fkey(
              id, name, avatar_url, role
            )
          )
        `)
        .order('created_at', { ascending: false });
        
      if (pollsError) throw pollsError;
      
      // Process each poll to get options, votes, and user vote
      const processedPolls = await Promise.all(
        (pollsData || []).map(async (poll) => {
          // Get options
          const { data: optionsData, error: optionsError } = await supabase
            .from('poll_options')
            .select('*')
            .eq('poll_id', poll.id)
            .order('created_at', { ascending: true });
            
          if (optionsError) throw optionsError;
          
          // Get all votes for this poll
          const { data: votesData, error: votesError } = await supabase
            .from('poll_votes')
            .select('option_id, user_id')
            .eq('poll_id', poll.id);
            
          if (votesError) throw votesError;
          
          // Count votes for each option
          const voteCounts: Record<string, number> = {};
          let userVote = null;
          
          votesData.forEach(vote => {
            // Count this vote
            voteCounts[vote.option_id] = (voteCounts[vote.option_id] || 0) + 1;
            
            // Check if this is the user's vote
            if (vote.user_id === user.id) {
              userVote = vote.option_id;
            }
          });
          
          // Process options with vote counts
          const options = optionsData.map(option => ({
            id: option.id,
            text: option.text,
            votes: voteCounts[option.id] || 0
          }));
          
          const totalVotes = options.reduce((sum, option) => sum + option.votes, 0);
          const isPollEnded = poll.end_date && new Date(poll.end_date) < new Date();
          
          return {
            id: poll.id,
            post_id: poll.post_id,
            question: poll.question,
            end_date: poll.end_date,
            created_at: poll.created_at,
            total_votes: totalVotes,
            options,
            user_vote: userVote,
            author: poll.post.author,
            is_ended: isPollEnded
          };
        })
      );
      
      // Apply filters
      let filteredPolls = processedPolls;
      
      if (filter === 'active') {
        filteredPolls = processedPolls.filter(poll => 
          !poll.is_ended
        );
      } else if (filter === 'ended') {
        filteredPolls = processedPolls.filter(poll => 
          poll.is_ended
        );
      } else if (filter === 'voted') {
        filteredPolls = processedPolls.filter(poll => 
          poll.user_vote !== null
        );
      } else if (filter === 'not-voted') {
        filteredPolls = processedPolls.filter(poll => 
          poll.user_vote === null && !poll.is_ended
        );
      }
      
      // Apply search query
      if (searchQuery) {
        filteredPolls = filteredPolls.filter(poll => 
          poll.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          poll.options.some(option => option.text.toLowerCase().includes(searchQuery.toLowerCase()))
        );
      }
      
      setPolls(filteredPolls);
    } catch (error) {
      console.error('Error fetching polls:', error);
      toast.error('Failed to load polls');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePoll = async () => {
    if (!user || !canCreatePolls) return;
    if (!pollQuestion.trim() || pollOptions.length < 2) {
      toast.error('Please provide a question and at least 2 options');
      return;
    }

    setIsSubmitting(true);
    try {
      // First create a post with the poll data
      const { data: post, error: postError } = await supabase
        .from('posts')
        .insert({
          content: pollQuestion,
          author_id: user.id,
          is_poll: true,
          poll_data: {
            question: pollQuestion,
            options: pollOptions,
            end_date: pollEndDate || null
          }
        })
        .select()
        .single();

      if (postError) throw postError;

      // Then create the poll
      const { data: poll, error: pollError } = await supabase
        .from('polls')
        .insert({
          post_id: post.id,
          question: pollQuestion,
          end_date: pollEndDate || null
        })
        .select()
        .single();

      if (pollError) throw pollError;

      // Create poll options
      const optionPromises = pollOptions.map(option => 
        supabase
          .from('poll_options')
          .insert({
            poll_id: poll.id,
            text: option
          })
      );

      await Promise.all(optionPromises);

      toast.success('Poll created successfully!');
      setShowCreatePoll(false);
      setPollQuestion('');
      setPollOptions([]);
      setPollEndDate('');
      fetchPolls();
    } catch (error) {
      console.error('Error creating poll:', error);
      toast.error('Failed to create poll');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVote = async (pollId: string, optionId: string) => {
    if (!user || !canVote) return;
    
    try {
      const poll = polls.find(p => p.id === pollId);
      if (!poll) return;
      
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
      
      const { error } = await supabase
        .from('poll_votes')
        .insert({
          poll_id: pollId,
          option_id: optionId,
          user_id: user.id
        });
        
      if (error) throw error;
      
      // Update local state
      setPolls(prev => prev.map(p => {
        if (p.id === pollId) {
          const updatedOptions = p.options.map(option => 
            option.id === optionId 
              ? { ...option, votes: option.votes + 1 } 
              : option
          );
          
          return {
            ...p,
            options: updatedOptions,
            total_votes: p.total_votes + 1,
            user_vote: optionId
          };
        }
        return p;
      }));
      
      toast.success('Vote recorded successfully');
    } catch (error) {
      console.error('Error voting:', error);
      toast.error('Failed to record vote');
    }
  };

  const handleDeletePoll = async (pollId: string, postId: string) => {
    if (!user || (!isAdmin && !isTeacher)) return;
    
    if (!window.confirm('Are you sure you want to delete this poll?')) {
      return;
    }
    
    try {
      // Delete the post (this will cascade delete the poll and votes)
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);
        
      if (error) throw error;
      
      // Update local state
      setPolls(prev => prev.filter(p => p.id !== pollId));
      
      toast.success('Poll deleted successfully');
    } catch (error) {
      console.error('Error deleting poll:', error);
      toast.error('Failed to delete poll');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold">Polls</h1>
        </div>
        {canCreatePolls && (
          <Button 
            onClick={() => setShowCreatePoll(true)}
            className="min-h-[44px]"
          >
            <Plus className="mr-2 h-5 w-5" />
            Create Poll
          </Button>
        )}
      </div>

      {/* Search and Filter */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search polls..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border pl-10 pr-4 py-2 min-h-[44px]"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
            className="min-h-[44px]"
          >
            All
          </Button>
          <Button
            variant={filter === 'active' ? 'default' : 'outline'}
            onClick={() => setFilter('active')}
            className="min-h-[44px]"
          >
            Active
          </Button>
          <Button
            variant={filter === 'ended' ? 'default' : 'outline'}
            onClick={() => setFilter('ended')}
            className="min-h-[44px]"
          >
            Ended
          </Button>
          {canVote && (
            <>
              <Button
                variant={filter === 'voted' ? 'default' : 'outline'}
                onClick={() => setFilter('voted')}
                className="min-h-[44px]"
              >
                Voted
              </Button>
              <Button
                variant={filter === 'not-voted' ? 'default' : 'outline'}
                onClick={() => setFilter('not-voted')}
                className="min-h-[44px]"
              >
                Not Voted
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Create Poll Form */}
      {showCreatePoll && canCreatePolls && (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">Create New Poll</h2>
          
          <PollCreator
            question={pollQuestion}
            setQuestion={setPollQuestion}
            options={pollOptions}
            setOptions={setPollOptions}
            endDate={pollEndDate}
            setEndDate={setPollEndDate}
          />
          
          <div className="mt-6 flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setShowCreatePoll(false);
                setPollQuestion('');
                setPollOptions([]);
                setPollEndDate('');
              }}
              className="min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreatePoll}
              disabled={isSubmitting || !pollQuestion.trim() || pollOptions.length < 2}
              className="min-h-[44px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Poll'
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Polls List */}
      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : polls.length === 0 ? (
        <div className="rounded-lg bg-white p-8 text-center shadow-sm">
          <BarChart className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-4 text-gray-600">
            {searchQuery 
              ? 'No polls match your search criteria' 
              : filter !== 'all' 
                ? `No ${filter} polls found` 
                : 'No polls have been created yet'}
          </p>
          {canCreatePolls && !showCreatePoll && (
            <Button 
              onClick={() => setShowCreatePoll(true)}
              className="mt-4 min-h-[44px]"
            >
              Create Your First Poll
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {polls.map((poll) => {
            const isPollEnded = poll.is_ended;
            const hasVoted = !!poll.user_vote;
            
            return (
              <div key={poll.id} className="rounded-lg bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={poll.author.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${poll.author.name}`}
                      alt={poll.author.name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{poll.author.name}</h3>
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 capitalize">
                          {poll.author.role}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {format(new Date(poll.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Users className="h-4 w-4" />
                      <span>{poll.total_votes} votes</span>
                    </div>
                    
                    {isPollEnded ? (
                      <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                        <AlertCircle className="h-3 w-3" />
                        Ended
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                        <Clock className="h-3 w-3" />
                        Active
                      </span>
                    )}
                    
                    {(isAdmin || isTeacher) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeletePoll(poll.id, poll.post_id)}
                        className="text-red-500 hover:bg-red-50 hover:text-red-600 min-h-[44px] min-w-[44px]"
                      >
                        <Loader2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                
                <h2 className="mb-4 text-xl font-semibold">{poll.question}</h2>
                
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
                          <div className="rounded-lg border p-3">
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
                            className="w-full justify-start p-3 text-left min-h-[44px]"
                            onClick={() => handleVote(poll.id, option.id)}
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
                  
                  {hasVoted && canVote && (
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span>You voted</span>
                    </div>
                  )}
                  
                  {!canVote && (
                    <div className="flex items-center gap-1 text-blue-600">
                      <AlertCircle className="h-4 w-4" />
                      <span>Teachers and admins can't vote</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Loader2, Bookmark, Heart, MessageCircle, Share2, BarChart, Pin, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { ImageViewer } from '../ui/image-viewer';
import { VideoPlayer } from '../ui/video-player';
import { SharedDialog } from '../posts/share-dialog';
import { PollDisplay } from '../polls/poll-display';

interface SavedPost {
  id: string;
  post: {
    id: string;
    content: string;
    author_id: string;
    media: string[] | null;
    media_type: string[] | null;
    created_at: string;
    is_poll: boolean;
    poll_data: any;
    is_pinned: boolean;
    author: {
      name: string;
      avatar_url: string;
      role: string;
    };
    likes: { user_id: string }[];
    comments: { id: string }[];
  };
}

export function SavedPosts() {
  const [savedPosts, setSavedPosts] = useState<SavedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [sharePost, setSharePost] = useState<any | null>(null);
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user) return;
    
    const fetchSavedPosts = async () => {
      try {
        const { data, error } = await supabase
          .from('saved_posts')
          .select(`
            id,
            post:posts(
              id,
              content,
              author_id,
              media,
              media_type,
              created_at,
              is_poll,
              poll_data,
              is_pinned,
              author:profiles!posts_author_id_fkey(
                name,
                avatar_url,
                role
              ),
              likes:post_likes(user_id),
              comments:post_comments(id)
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        
        // Filter out any null posts (in case a post was deleted)
        const validPosts = data.filter(item => item.post !== null);
        
        setSavedPosts(validPosts);
      } catch (error) {
        console.error('Error fetching saved posts:', error);
        toast.error('Failed to load saved posts');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSavedPosts();
    
    // Subscribe to saved_posts changes
    const subscription = supabase
      .channel('saved-posts-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'saved_posts',
        filter: `user_id=eq.${user.id}`
      }, fetchSavedPosts)
      .subscribe();
      
    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  const handleUnsave = async (savedId: string) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('saved_posts')
        .delete()
        .eq('id', savedId);
        
      if (error) throw error;
      
      // Update local state
      setSavedPosts(prev => prev.filter(item => item.id !== savedId));
      
      toast.success('Post removed from saved items');
    } catch (error) {
      console.error('Error removing saved post:', error);
      toast.error('Failed to remove post from saved items');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (savedPosts.length === 0) {
    return (
      <div className="rounded-lg bg-white p-8 text-center shadow">
        <Bookmark className="mx-auto h-12 w-12 text-gray-400" />
        <h2 className="mt-4 text-xl font-semibold">No saved posts yet</h2>
        <p className="mt-2 text-gray-600">
          When you save posts, they'll appear here for easy access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Saved Posts</h2>
      
      <div className="space-y-4">
        {savedPosts.map((item) => {
          const post = item.post;
          const hasLiked = post.likes?.some(like => like.user_id === user?.id);
          
          return (
            <div key={item.id} className="rounded-lg bg-white p-4 shadow">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={post.author.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${post.author.name}`}
                    alt={post.author.name}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{post.author.name}</h3>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 capitalize">
                        {post.author.role}
                      </span>
                      {post.is_pinned && (
                        <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                          <Pin className="h-3 w-3" />
                          Pinned
                        </span>
                      )}
                      {post.is_poll && (
                        <span className="flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                          <BarChart className="h-3 w-3" />
                          Poll
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {format(new Date(post.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
                
                <Button
                  variant="ghost"
                  onClick={() => handleUnsave(item.id)}
                  className="text-blue-600"
                >
                  <Bookmark className="h-5 w-5 fill-current" />
                </Button>
              </div>
              
              <p className="mb-4 whitespace-pre-wrap">{post.content}</p>
              
              {/* Poll Display */}
              {post.is_poll && (
                <PollDisplay postId={post.id} pollData={post.poll_data} />
              )}
              
              {/* Media Display */}
              {post.media && post.media.length > 0 && (
                <div className="mb-4 grid grid-cols-2 gap-2">
                  {post.media.map((url: string, index: number) => {
                    const type = post.media_type?.[index];
                    if (type === 'video') {
                      return (
                        <div key={url} className="relative aspect-video rounded-lg bg-black overflow-hidden">
                          <video
                            src={url}
                            className="h-full w-full object-contain cursor-pointer"
                            onClick={() => setSelectedVideo(url)}
                            poster={`${url}#t=0.1`}
                          >
                            Your browser does not support the video tag.
                          </video>
                          <button 
                            className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 hover:bg-opacity-20 transition-opacity"
                            onClick={() => setSelectedVideo(url)}
                          >
                            <Loader2 className="h-12 w-12 text-white opacity-80" />
                          </button>
                        </div>
                      );
                    }
                    return (
                      <img
                        key={url}
                        src={url}
                        alt={`Post media ${index + 1}`}
                        className="w-full cursor-pointer rounded-lg"
                        onClick={() => setSelectedImage(url)}
                      />
                    );
                  })}
                </div>
              )}
              
              <div className="flex space-x-4 border-t pt-3">
                <div className="flex items-center gap-1 text-gray-500">
                  <Heart className={`h-5 w-5 ${hasLiked ? 'fill-current text-red-500' : ''}`} />
                  <span>{post.likes?.length || 0}</span>
                </div>
                
                <div className="flex items-center gap-1 text-gray-500">
                  <MessageCircle className="h-5 w-5" />
                  <span>{post.comments?.length || 0}</span>
                </div>
                
                <Button
                  variant="ghost"
                  className="text-gray-500"
                  onClick={() => setSharePost(post)}
                >
                  <Share2 className="mr-2 h-5 w-5" />
                  Share
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      
      {sharePost && (
        <SharedDialog
          post={sharePost}
          onClose={() => setSharePost(null)}
        />
      )}
      
      {selectedImage && (
        <ImageViewer
          src={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}
      
      {selectedVideo && (
        <VideoPlayer
          src={selectedVideo}
          onClose={() => setSelectedVideo(null)}
        />
      )}
    </div>
  );
}
import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Heart, MessageCircle, Share2, Edit, Trash2, Shield, Crown, GraduationCap, Loader2, Award, Play, Pause, Volume2, VolumeX, Maximize, X, Pin, PinOff, BarChart, Bookmark, Smile } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { ImageViewer } from '../ui/image-viewer';
import { VideoPlayer } from '../ui/video-player';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { SharedDialog } from '../posts/share-dialog';
import { AdminCrown } from '../ui/admin-crown';
import { TeacherShield } from '../ui/teacher-shield';
import { PollDisplay } from '../polls/poll-display';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

interface Post {
  id: string;
  content: string;
  author_id: string;
  author: {
    id: string;
    name: string;
    avatar_url: string;
    role: string;
    class_leader_info?: {
      badge_color: string;
    };
  };
  media?: string[];
  media_type?: ('image' | 'video')[];
  created_at: string;
  updated_at: string;
  likes: { user_id: string }[];
  comments: {
    id: string;
    content: string;
    user_id: string;
    created_at: string;
    author: {
      id: string;
      name: string;
      avatar_url: string;
      role: string;
    };
  }[];
  is_pinned?: boolean;
  pinned_at?: string;
  pinned_by?: string;
  pinned_by_user?: {
    name: string;
    avatar_url: string;
    role: string;
  };
  is_poll?: boolean;
  poll_data?: {
    question: string;
    options: string[];
    end_date: string | null;
  };
  is_saved?: boolean;
}

export function PostList() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [activePost, setActivePost] = useState<string | null>(null);
  const [sharePost, setSharePost] = useState<Post | null>(null);
  const [editingPost, setEditingPost] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const isTeacher = user?.role === 'teacher';
  const canPinPosts = isAdmin || isTeacher;

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          author:profiles!posts_author_id_fkey(*),
          pinned_by_user:profiles!posts_pinned_by_fkey(*),
          comments:post_comments(
            *,
            author:profiles!post_comments_user_id_fkey(*)
          ),
          likes:post_likes(*)
        `)
        .order('is_pinned', { ascending: false })
        .order('pinned_at', { ascending: false, nullsLast: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Check which posts are saved by the current user
      if (user) {
        const { data: savedPosts, error: savedError } = await supabase
          .from('saved_posts')
          .select('post_id')
          .eq('user_id', user.id);
          
        if (savedError) throw savedError;
        
        const savedPostIds = new Set(savedPosts?.map(sp => sp.post_id) || []);
        
        // Mark saved posts
        const postsWithSavedStatus = data?.map(post => ({
          ...post,
          is_saved: savedPostIds.has(post.id)
        })) || [];
        
        setPosts(postsWithSavedStatus);
      } else {
        setPosts(data || []);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast.error('Failed to load posts');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();

    // Subscribe to all post changes
    const subscription = supabase.channel('posts-channel')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'posts'
      }, async (payload) => {
        // Fetch the complete post data including relations
        const { data: newPost, error } = await supabase
          .from('posts')
          .select(`
            *,
            author:profiles!posts_author_id_fkey(*),
            pinned_by_user:profiles!posts_pinned_by_fkey(*),
            comments:post_comments(
              *,
              author:profiles!post_comments_user_id_fkey(*)
            ),
            likes:post_likes(*)
          `)
          .eq('id', payload.new.id)
          .single();

        if (!error && newPost) {
          // Check if this post is saved
          if (user) {
            const { data: savedPost } = await supabase
              .from('saved_posts')
              .select('post_id')
              .eq('post_id', newPost.id)
              .eq('user_id', user.id)
              .maybeSingle();
              
            newPost.is_saved = !!savedPost;
          }
          
          setPosts(prev => [newPost, ...prev]);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'posts'
      }, async (payload) => {
        // Fetch updated post data
        const { data: updatedPost, error } = await supabase
          .from('posts')
          .select(`
            *,
            author:profiles!posts_author_id_fkey(*),
            pinned_by_user:profiles!posts_pinned_by_fkey(*),
            comments:post_comments(
              *,
              author:profiles!post_comments_user_id_fkey(*)
            ),
            likes:post_likes(*)
          `)
          .eq('id', payload.new.id)
          .single();

        if (!error && updatedPost) {
          // Preserve saved status
          if (user) {
            const existingPost = posts.find(p => p.id === updatedPost.id);
            updatedPost.is_saved = existingPost?.is_saved || false;
          }
          
          setPosts(prev => {
            // If the post was pinned, move it to the top
            if (updatedPost.is_pinned && !prev.find(p => p.id === updatedPost.id)?.is_pinned) {
              return [
                updatedPost,
                ...prev.filter(post => post.id !== updatedPost.id)
              ];
            }
            
            // If the post was unpinned, we need to reorder
            if (!updatedPost.is_pinned && prev.find(p => p.id === updatedPost.id)?.is_pinned) {
              // Get all pinned posts except the one that was just unpinned
              const pinnedPosts = prev.filter(p => p.is_pinned && p.id !== updatedPost.id);
              // Get all unpinned posts plus the one that was just unpinned
              const unpinnedPosts = [
                ...prev.filter(p => !p.is_pinned && p.id !== updatedPost.id),
                updatedPost
              ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
              
              return [...pinnedPosts, ...unpinnedPosts];
            }
            
            // Regular update
            return prev.map(post => 
              post.id === updatedPost.id ? updatedPost : post
            );
          });
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'posts'
      }, (payload) => {
        setPosts(prev => prev.filter(post => post.id !== payload.old.id));
      })
      .subscribe();

    // Subscribe to saved_posts changes
    const savedPostsSubscription = supabase.channel('saved-posts-channel')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'saved_posts',
        filter: user ? `user_id=eq.${user.id}` : undefined
      }, async (payload) => {
        if (payload.eventType === 'INSERT') {
          // Mark post as saved
          setPosts(prev => prev.map(post => 
            post.id === payload.new.post_id ? { ...post, is_saved: true } : post
          ));
        } else if (payload.eventType === 'DELETE') {
          // Mark post as unsaved
          setPosts(prev => prev.map(post => 
            post.id === payload.old.post_id ? { ...post, is_saved: false } : post
          ));
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
      savedPostsSubscription.unsubscribe();
    };
  }, [user]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleEdit = async (postId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('posts')
        .update({ content: editContent })
        .eq('id', postId);

      if (error) throw error;

      setPosts(prev => prev.map(p => 
        p.id === postId ? { ...p, content: editContent } : p
      ));

      setEditingPost(null);
      setEditContent('');
      toast.success('Post updated successfully');
    } catch (error) {
      console.error('Error updating post:', error);
      toast.error('Failed to update post');
    }
  };

  const handleDelete = async (postId: string) => {
    if (!user) return;

    if (!window.confirm('Are you sure you want to delete this post?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;

      setPosts(prev => prev.filter(p => p.id !== postId));
      toast.success('Post deleted successfully');
    } catch (error) {
      console.error('Error deleting post:', error);
      toast.error('Failed to delete post');
    }
  };

  const handleTogglePin = async (postId: string, currentPinned: boolean) => {
    if (!user || !canPinPosts) return;

    try {
      const { error } = await supabase
        .from('posts')
        .update({ 
          is_pinned: !currentPinned,
          pinned_by: !currentPinned ? user.id : null
        })
        .eq('id', postId);

      if (error) throw error;

      toast.success(currentPinned ? 'Post unpinned' : 'Post pinned to the top of the feed');
      
      // Optimistic update
      setPosts(prev => {
        const updatedPosts = prev.map(p => 
          p.id === postId ? { 
            ...p, 
            is_pinned: !currentPinned,
            pinned_at: !currentPinned ? new Date().toISOString() : null,
            pinned_by: !currentPinned ? user.id : null
          } : p
        );
        
        // If pinning, move to top
        if (!currentPinned) {
          const pinnedPost = updatedPosts.find(p => p.id === postId);
          if (pinnedPost) {
            return [
              pinnedPost,
              ...updatedPosts.filter(p => p.id !== postId)
            ];
          }
        }
        
        // If unpinning, reorder
        if (currentPinned) {
          const pinnedPosts = updatedPosts.filter(p => p.is_pinned && p.id !== postId);
          const unpinnedPosts = updatedPosts.filter(p => !p.is_pinned);
          return [...pinnedPosts, ...unpinnedPosts];
        }
        
        return updatedPosts;
      });
    } catch (error) {
      console.error('Error toggling pin status:', error);
      toast.error('Failed to update pin status');
    }
  };

  const handleToggleSave = async (postId: string, isSaved: boolean) => {
    if (!user) return;

    try {
      if (isSaved) {
        // Unsave the post
        const { error } = await supabase
          .from('saved_posts')
          .delete()
          .eq('user_id', user.id)
          .eq('post_id', postId);

        if (error) throw error;
        
        toast.success('Post removed from saved items');
      } else {
        // Save the post
        const { error } = await supabase
          .from('saved_posts')
          .insert({
            user_id: user.id,
            post_id: postId
          });

        if (error) throw error;
        
        toast.success('Post saved successfully');
      }

      // Update local state
      setPosts(prev => prev.map(post => 
        post.id === postId ? { ...post, is_saved: !isSaved } : post
      ));
    } catch (error) {
      console.error('Error saving/unsaving post:', error);
      toast.error('Failed to update saved status');
    }
  };

  const handleLike = async (postId: string) => {
    if (!user) return;

    try {
      const post = posts.find(p => p.id === postId);
      if (!post) return;

      const hasLiked = post.likes?.some(like => like.user_id === user.id);

      if (hasLiked) {
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('post_likes')
          .insert({ post_id: postId, user_id: user.id });

        if (error) throw error;
      }

      // Refresh posts to get updated likes
      const { data: updatedPost } = await supabase
        .from('posts')
        .select(`
          *,
          author:profiles!posts_author_id_fkey(*),
          pinned_by_user:profiles!posts_pinned_by_fkey(*),
          comments:post_comments(
            *,
            author:profiles!post_comments_user_id_fkey(*)
          ),
          likes:post_likes(*)
        `)
        .eq('id', postId)
        .single();

      if (updatedPost) {
        // Preserve saved status
        updatedPost.is_saved = post.is_saved;
        
        setPosts(prev => prev.map(p => 
          p.id === postId ? updatedPost : p
        ));
      }
    } catch (error) {
      console.error('Error updating like:', error);
      toast.error('Failed to update like');
    }
  };

  const handleComment = async (postId: string) => {
    if (!user || !comment.trim()) return;
    
    setIsSubmittingComment(true);

    try {
      const { error } = await supabase
        .from('post_comments')
        .insert({
          content: comment,
          post_id: postId,
          user_id: user.id
        });

      if (error) throw error;

      setComment('');
      setShowEmojiPicker(null);
      
      // Refresh post to get updated comments
      const { data: updatedPost } = await supabase
        .from('posts')
        .select(`
          *,
          author:profiles!posts_author_id_fkey(*),
          pinned_by_user:profiles!posts_pinned_by_fkey(*),
          comments:post_comments(
            *,
            author:profiles!post_comments_user_id_fkey(*)
          ),
          likes:post_likes(*)
        `)
        .eq('id', postId)
        .single();

      if (updatedPost) {
        // Preserve saved status
        const existingPost = posts.find(p => p.id === postId);
        updatedPost.is_saved = existingPost?.is_saved || false;
        
        setPosts(prev => prev.map(p => 
          p.id === postId ? updatedPost : p
        ));
      }

      toast.success('Comment added successfully');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const onEmojiSelect = (emoji: any, postId: string) => {
    setComment(prev => prev + emoji.native);
    setShowEmojiPicker(null);
  };

  const getRoleIcon = (role: string, badgeColor?: string) => {
    switch (role) {
      case 'student':
        return <GraduationCap className="h-4 w-4 text-blue-500" />;
      case 'teacher':
        return <TeacherShield size="sm" />;
      case 'admin':
        return <AdminCrown size="sm" />;
      case 'class_leader':
        return (
          <Award className={`h-4 w-4 ${
            badgeColor === 'green' ? 'text-green-600' :
            badgeColor === 'purple' ? 'text-purple-600' :
            badgeColor === 'red' ? 'text-red-600' :
            badgeColor === 'yellow' ? 'text-yellow-600' :
            'text-blue-600'
          }`} />
        );
      default:
        return null;
    }
  };

  // Function to determine if a post is from a teacher or admin
  const isSpecialPost = (post: Post) => {
    return post.author.role === 'teacher' || post.author.role === 'admin';
  };

  // Function to get special post styles
  const getSpecialPostStyles = (post: Post) => {
    if (post.author.role === 'teacher') {
      return {
        containerClass: "rounded-lg bg-gradient-to-br from-blue-50 to-white p-4 shadow-md border border-blue-200 transition-all duration-300 hover:shadow-lg",
        headerClass: "bg-blue-50 -mx-4 -mt-4 px-4 py-3 rounded-t-lg border-b border-blue-100 mb-4",
        nameClass: "font-semibold text-blue-700",
        contentClass: "text-gray-800 leading-relaxed",
        iconClass: "text-blue-600"
      };
    } else if (post.author.role === 'admin') {
      return {
        containerClass: "rounded-lg bg-gradient-to-br from-yellow-50 to-white p-4 shadow-md border border-yellow-200 transition-all duration-300 hover:shadow-lg",
        headerClass: "bg-yellow-50 -mx-4 -mt-4 px-4 py-3 rounded-t-lg border-b border-yellow-100 mb-4",
        nameClass: "font-semibold text-yellow-700",
        contentClass: "text-gray-800 leading-relaxed",
        iconClass: "text-yellow-500"
      };
    }
    return {
      containerClass: "rounded-lg bg-white p-4 shadow",
      headerClass: "",
      nameClass: "font-semibold",
      contentClass: "",
      iconClass: ""
    };
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => {
        const isTeacherOrAdmin = isSpecialPost(post);
        const styles = getSpecialPostStyles(post);
        
        return (
          <article 
            key={post.id} 
            className={`${styles.containerClass} ${post.is_pinned ? 'border-2 border-blue-500' : ''}`}
          >
            <div className={`flex items-center justify-between ${styles.headerClass}`}>
              <div className="flex items-center space-x-3">
                <img
                  src={post.author.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${post.author.name}`}
                  alt={post.author.name}
                  className={`h-10 w-10 rounded-full object-cover ${isTeacherOrAdmin ? 'ring-2 ring-offset-2 ' + (post.author.role === 'teacher' ? 'ring-blue-400' : 'ring-yellow-400') : ''}`}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className={styles.nameClass}>{post.author.name}</h3>
                    <div className={styles.iconClass}>
                      {getRoleIcon(post.author.role, post.author.class_leader_info?.badge_color)}
                    </div>
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
              <div className="flex gap-2">
                {canPinPosts && (
                  <Button
                    variant="ghost"
                    onClick={() => handleTogglePin(post.id, !!post.is_pinned)}
                    title={post.is_pinned ? "Unpin post" : "Pin post"}
                    className={isTeacherOrAdmin ? "hover:bg-white/50" : ""}
                  >
                    {post.is_pinned ? (
                      <PinOff className="h-5 w-5 text-blue-600" />
                    ) : (
                      <Pin className="h-5 w-5" />
                    )}
                  </Button>
                )}
                {(isAdmin || user?.id === post.author.id) && (
                  <>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEditingPost(post.id);
                        setEditContent(post.content);
                      }}
                      className={isTeacherOrAdmin ? "hover:bg-white/50" : ""}
                    >
                      <Edit className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => handleDelete(post.id)}
                      className={isTeacherOrAdmin ? "hover:bg-white/50" : ""}
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {editingPost === post.id ? (
              <div className="mt-4">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full rounded-lg border p-2"
                  rows={3}
                />
                <div className="mt-2 flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setEditingPost(null);
                      setEditContent('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={() => handleEdit(post.id)}>
                    Save Changes
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className={`mt-3 whitespace-pre-wrap ${styles.contentClass}`}>{post.content}</p>
                
                {/* Poll Display */}
                {post.is_poll && (
                  <PollDisplay postId={post.id} pollData={post.poll_data} />
                )}
                
                {/* Media Display */}
                {post.media?.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {post.media.map((url, index) => {
                      const type = post.media_type?.[index];
                      if (type === 'video') {
                        return (
                          <div key={url} className="relative aspect-video rounded-lg bg-black overflow-hidden">
                            <video
                              src={url}
                              className="h-full w-full object-contain cursor-pointer"
                              onClick={() => setSelectedVideo(url)}
                              poster={`${url}#t=0.1`} // Generate thumbnail from the first frame
                            >
                              Your browser does not support the video tag.
                            </video>
                            <button 
                              className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 hover:bg-opacity-20 transition-opacity"
                              onClick={() => setSelectedVideo(url)}
                            >
                              <Play className="h-12 w-12 text-white opacity-80" />
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
              </>
            )}

            <div className={`mt-4 flex space-x-4 ${isTeacherOrAdmin ? 'border-t border-opacity-30 pt-3 ' + (post.author.role === 'teacher' ? 'border-blue-200' : 'border-yellow-200') : ''}`}>
              <Button
                variant="ghost"
                className={`text-gray-500 ${post.likes?.some(like => like.user_id === user?.id) ? 'text-red-500' : ''} ${isTeacherOrAdmin ? 'hover:bg-white/20' : ''}`}
                onClick={() => handleLike(post.id)}
              >
                <Heart className={`mr-2 h-5 w-5 ${post.likes?.some(like => like.user_id === user?.id) ? 'fill-current' : ''}`} />
                {post.likes?.length || 0}
              </Button>

              <Button
                variant="ghost"
                className={`text-gray-500 ${isTeacherOrAdmin ? 'hover:bg-white/20' : ''}`}
                onClick={() => setActivePost(activePost === post.id ? null : post.id)}
              >
                <MessageCircle className="mr-2 h-5 w-5" />
                {post.comments?.length || 0}
              </Button>

              <Button
                variant="ghost"
                className={`text-gray-500 ${isTeacherOrAdmin ? 'hover:bg-white/20' : ''}`}
                onClick={() => setSharePost(post)}
              >
                <Share2 className="mr-2 h-5 w-5" />
                Share
              </Button>

              <Button
                variant="ghost"
                className={`text-gray-500 ${post.is_saved ? 'text-blue-600' : ''} ${isTeacherOrAdmin ? 'hover:bg-white/20' : ''}`}
                onClick={() => handleToggleSave(post.id, !!post.is_saved)}
              >
                <Bookmark className={`mr-2 h-5 w-5 ${post.is_saved ? 'fill-current text-blue-600' : ''}`} />
                {post.is_saved ? 'Saved' : 'Save'}
              </Button>
            </div>

            {activePost === post.id && (
              <div className="mt-4 space-y-4">
                <div className="flex gap-2 relative">
                  <input
                    type="text"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Write a comment..."
                    className="flex-1 rounded-md border p-2 min-h-[44px]"
                    disabled={isSubmittingComment}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowEmojiPicker(showEmojiPicker === post.id ? null : post.id)}
                    className="absolute right-14 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px]"
                    disabled={isSubmittingComment}
                  >
                    <Smile className="h-5 w-5 text-gray-500" />
                  </Button>
                  <Button 
                    onClick={() => handleComment(post.id)}
                    disabled={!comment.trim() || isSubmittingComment}
                    className="min-h-[44px] min-w-[44px]"
                  >
                    {isSubmittingComment ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MessageCircle className="h-4 w-4" />
                    )}
                  </Button>
                  
                  {showEmojiPicker === post.id && (
                    <div 
                      ref={emojiPickerRef}
                      className="absolute right-0 bottom-12 z-50"
                    >
                      <Picker
                        data={data}
                        onEmojiSelect={(emoji: any) => onEmojiSelect(emoji, post.id)}
                        theme="light"
                        previewPosition="none"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {post.comments?.map((comment) => (
                    <div key={comment.id} className="flex items-start space-x-3">
                      <img
                        src={comment.author.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${comment.author.name}`}
                        alt={comment.author.name}
                        className="h-8 w-8 rounded-full"
                      />
                      <div className="flex-1 rounded-lg bg-gray-50 p-3">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{comment.author.name}</p>
                          {getRoleIcon(comment.author.role)}
                        </div>
                        <p className="text-gray-600">{comment.content}</p>
                        <p className="mt-1 text-xs text-gray-400">
                          {format(new Date(comment.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </article>
        );
      })}

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
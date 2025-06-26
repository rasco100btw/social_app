// Previous content remains unchanged, just adding the comment functionality

interface Comment {
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
}

// Inside PostList component, add:
const [comments, setComments] = useState<Record<string, Comment[]>>({});
const [newComment, setNewComment] = useState('');
const [activePost, setActivePost] = useState<string | null>(null);
const [isSubmittingComment, setIsSubmittingComment] = useState(false);

const handleComment = async (postId: string) => {
  if (!user || !newComment.trim()) return;

  setIsSubmittingComment(true);
  try {
    const { data: comment, error } = await supabase
      .from('post_comments')
      .insert({
        post_id: postId,
        user_id: user.id,
        content: newComment.trim()
      })
      .select(`
        *,
        author:profiles(
          id,
          name,
          avatar_url,
          role
        )
      `)
      .single();

    if (error) throw error;

    // Update comments optimistically
    setComments(prev => ({
      ...prev,
      [postId]: [...(prev[postId] || []), comment]
    }));

    setNewComment('');
    toast.success('Comment added successfully');
  } catch (error) {
    console.error('Error adding comment:', error);
    toast.error('Failed to add comment');
  } finally {
    setIsSubmittingComment(false);
  }
};

// Inside the post mapping, after the like button:
<Button
  variant="ghost"
  className="text-gray-500"
  onClick={() => {
    setActivePost(activePost === post.id ? null : post.id);
    if (!comments[post.id]) {
      // Fetch comments when expanding
      supabase
        .from('post_comments')
        .select(`
          *,
          author:profiles(
            id,
            name,
            avatar_url,
            role
          )
        `)
        .eq('post_id', post.id)
        .order('created_at', { ascending: true })
        .then(({ data, error }) => {
          if (error) {
            console.error('Error fetching comments:', error);
            return;
          }
          setComments(prev => ({ ...prev, [post.id]: data || [] }));
        });
    }
  }}
>
  <MessageCircle className="mr-2 h-5 w-5" />
  {comments[post.id]?.length || 0}
</Button>

{/* Comments Section */}
{activePost === post.id && (
  <div className="mt-4 space-y-4">
    <div className="flex gap-2">
      <input
        type="text"
        value={newComment}
        onChange={(e) => setNewComment(e.target.value)}
        placeholder="Write a comment..."
        className="flex-1 rounded-md border p-2"
        disabled={isSubmittingComment}
      />
      <Button 
        onClick={() => handleComment(post.id)}
        disabled={!newComment.trim() || isSubmittingComment}
      >
        {isSubmittingComment ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <MessageCircle className="h-4 w-4" />
        )}
      </Button>
    </div>

    <div className="space-y-3">
      {comments[post.id]?.map((comment) => (
        <div key={comment.id} className="flex items-start space-x-3">
          <img
            src={comment.author.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${comment.author.name}`}
            alt={comment.author.name}
            className="h-8 w-8 rounded-full"
          />
          <div className="flex-1 rounded-lg bg-gray-50 p-3">
            <div className="flex items-center gap-2">
              <p className="font-medium">{comment.author.name}</p>
              {comment.author.role === 'student' && (
                <GraduationCap className="h-4 w-4 text-blue-500" />
              )}
              {comment.author.role === 'teacher' && (
                <Shield className="h-4 w-4 text-blue-500" />
              )}
              {comment.author.role === 'admin' && (
                <Crown className="h-4 w-4 text-yellow-400" />
              )}
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
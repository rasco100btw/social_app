import { ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SharedPostPreviewProps {
  post: {
    id: string;
    content: string;
    media?: string[];
    author: {
      name: string;
      avatar_url: string;
    };
  };
  onClick?: () => void;
}

export function SharedPostPreview({ post, onClick }: SharedPostPreviewProps) {
  const navigate = useNavigate();

  if (!post || !post.author) {
    return null;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // If onClick is provided, use it (for share dialog)
    if (onClick) {
      onClick();
      return;
    }

    // Otherwise navigate to the post
    navigate(`/posts/${post.id}`);
  };

  return (
    <div 
      className="mt-2 cursor-pointer overflow-hidden rounded-lg border bg-gray-50 p-3 transition-shadow hover:shadow-md"
      onClick={handleClick}
    >
      <div className="mb-2 flex items-center gap-2">
        <img
          src={post.author?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${post.author?.name}`}
          alt={post.author?.name}
          className="h-6 w-6 rounded-full object-cover"
        />
        <span className="text-sm font-medium">{post.author?.name}</span>
      </div>
      
      <p className="line-clamp-2 text-sm text-gray-600">{post.content}</p>
      
      {post.media && post.media.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-1">
          {post.media.slice(0, 2).map((url, index) => (
            <div 
              key={index}
              className="relative aspect-square w-full overflow-hidden rounded-lg bg-gray-100"
            >
              <img
                src={url}
                alt={`Post media ${index + 1}`}
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          ))}
          {post.media.length > 2 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white">
              <span>+{post.media.length - 2} more</span>
            </div>
          )}
        </div>
      )}

      <div className="mt-2 flex items-center gap-1 text-xs text-blue-600">
        <ExternalLink className="h-3 w-3" />
        <span>View full post</span>
      </div>
    </div>
  );
}
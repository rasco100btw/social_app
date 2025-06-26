import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, Download, Eye, FileText, Image, Video } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

interface SharedFile {
  id: string;
  url: string;
  type: string;
  name: string;
  size: number;
  created_at: string;
  message: {
    content: string;
    sender: {
      name: string;
      avatar_url: string;
    };
  };
}

export function SharedFilesPage() {
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const otherUserId = searchParams.get('user');

  useEffect(() => {
    const fetchSharedFiles = async () => {
      if (!user) return;

      try {
        let query = supabase
          .from('messages')
          .select(`
            id,
            content,
            created_at,
            media,
            media_type,
            sender:profiles!sender_id(name, avatar_url)
          `)
          .not('media', 'is', null);

        if (otherUserId) {
          query = query.or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`);
        } else {
          query = query.or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;

        const processedFiles = data?.flatMap(message => 
          message.media?.map((url, index) => ({
            id: `${message.id}-${index}`,
            url,
            type: message.media_type?.[index] || 'file',
            name: url.split('/').pop() || 'Unknown file',
            size: 0, // Size information not available
            created_at: message.created_at,
            message: {
              content: message.content,
              sender: message.sender
            }
          })) || []
        ) || [];

        setFiles(processedFiles);
      } catch (error) {
        console.error('Error fetching shared files:', error);
        toast.error('Failed to load shared files');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSharedFiles();
  }, [user, otherUserId]);

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <Image className="h-6 w-6 text-blue-500" />;
      case 'video':
        return <Video className="h-6 w-6 text-purple-500" />;
      default:
        return <FileText className="h-6 w-6 text-gray-500" />;
    }
  };

  const handlePreview = (file: SharedFile) => {
    window.open(file.url, '_blank');
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-6 py-8">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="text-gray-600"
        >
          <ArrowLeft className="mr-2 h-5 w-5" />
          Back
        </Button>
        <h1 className="text-2xl font-bold">Shared Files</h1>
      </div>

      {files.length === 0 ? (
        <div className="rounded-lg bg-white p-8 text-center shadow">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-4 text-gray-600">No shared files yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between rounded-lg bg-white p-4 shadow"
            >
              <div className="flex items-center gap-4">
                {getFileIcon(file.type)}
                <div>
                  <p className="font-medium">{file.name}</p>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <img
                      src={file.message.sender.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${file.message.sender.name}`}
                      alt={file.message.sender.name}
                      className="h-4 w-4 rounded-full"
                    />
                    <span>{file.message.sender.name}</span>
                    <span>•</span>
                    <span>{format(new Date(file.created_at), 'MMM d, yyyy')}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => handlePreview(file)}
                >
                  <Eye className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => window.open(file.url, '_blank')}
                >
                  <Download className="h-5 w-5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
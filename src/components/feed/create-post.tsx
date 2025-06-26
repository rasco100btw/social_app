import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Image, Loader2, Send, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png'];

const postSchema = z.object({
  content: z.string().min(1, 'Post content is required'),
  media: z.array(z.string()).optional(),
});

type PostFormData = z.infer<typeof postSchema>;

export function CreatePost() {
  const [isLoading, setIsLoading] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const { user } = useAuthStore();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<PostFormData>({
    resolver: zodResolver(postSchema),
  });

  useEffect(() => {
    if (!user) return;

    const checkProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .maybeSingle();

        if (error) throw error;
        setHasProfile(!!data);
      } catch (error) {
        console.error('Error checking profile:', error);
        toast.error('Failed to check profile status');
      }
    };

    checkProfile();
  }, [user]);

  const createProfile = async () => {
    if (!user) return;

    setIsCreatingProfile(true);
    try {
      const { error } = await supabase.from('profiles').insert({
        id: user.id,
        name: user.name,
        email: user.email,
        role: 'student',
      });

      if (error) throw error;

      setHasProfile(true);
      toast.success('Profile created successfully!');
    } catch (error) {
      console.error('Error creating profile:', error);
      toast.error('Failed to create profile');
    } finally {
      setIsCreatingProfile(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        toast.error(`${file.name} is not a supported image type`);
        return false;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} exceeds the 5MB size limit`);
        return false;
      }
      return true;
    });

    if (validFiles.length > 4) {
      toast.error('Maximum 4 images allowed');
      return;
    }

    setSelectedFiles(validFiles);

    // Create previews
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: PostFormData) => {
    if (!user || !hasProfile) return;

    setIsLoading(true);
    try {
      const mediaUrls: string[] = [];
      const mediaTypes: string[] = [];

      // Upload images if any
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const filePath = `${user.id}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('images')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('images')
            .getPublicUrl(filePath);

          mediaUrls.push(publicUrl);
          mediaTypes.push('image');
        }
      }

      const { error } = await supabase.from('posts').insert({
        content: data.content,
        author_id: user.id,
        media: mediaUrls.length > 0 ? mediaUrls : null,
        media_type: mediaTypes.length > 0 ? mediaTypes : null,
      });

      if (error) throw error;

      toast.success('Post created successfully!');
      reset();
      setSelectedFiles([]);
      setPreviews([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create post');
    } finally {
      setIsLoading(false);
    }
  };

  if (!hasProfile) {
    return (
      <div className="rounded-lg bg-white p-6 text-center shadow">
        <p className="mb-4 text-gray-600">
          You need to create a profile before you can start posting.
        </p>
        <Button
          onClick={createProfile}
          disabled={isCreatingProfile}
        >
          {isCreatingProfile ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="mr-2 h-4 w-4" />
          )}
          Create Profile
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-lg bg-white p-4 shadow">
      <textarea
        {...register('content')}
        className="w-full resize-none rounded-md border p-2"
        placeholder="What's on your mind?"
        rows={3}
      />
      {errors.content && (
        <p className="text-sm text-red-500">{errors.content.message}</p>
      )}

      {previews.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {previews.map((preview, index) => (
            <div key={index} className="relative">
              <img
                src={preview}
                alt={`Preview ${index + 1}`}
                className="h-32 w-full rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="absolute right-1 top-1 rounded-full bg-black bg-opacity-50 p-1 text-white hover:bg-opacity-70"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <label className="cursor-pointer text-gray-500 hover:text-gray-700">
          <input
            type="file"
            accept=".jpg,.jpeg,.png"
            className="hidden"
            multiple
            onChange={handleFileSelect}
            disabled={isLoading}
          />
          <div className="flex items-center">
            <Image className="mr-2 h-5 w-5" />
            Add Images
          </div>
        </label>
        <Button
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Post
        </Button>
      </div>
    </form>
  );
}
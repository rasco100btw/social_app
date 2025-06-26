import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Image, Loader2, Send, X, Smile, Film } from 'lucide-react';
import { toast } from 'sonner';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { Button } from '../ui/button';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

const postSchema = z.object({
  content: z.string().min(1, 'Post content is required'),
  media: z.array(z.string()).optional(),
  media_type: z.array(z.string()).optional(),
});

type PostFormData = z.infer<typeof postSchema>;

export function PostForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileTypes, setFileTypes] = useState<string[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthStore();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<PostFormData>({
    resolver: zodResolver(postSchema),
  });

  const content = watch('content');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, fileType: 'image' | 'video') => {
    const files = Array.from(e.target.files || []);
    const validFiles: File[] = [];
    const newPreviews: string[] = [];
    const newFileTypes: string[] = [];

    // Check if adding these files would exceed the limit
    if (selectedFiles.length + files.length > 4) {
      toast.error('Maximum 4 files allowed');
      return;
    }

    for (const file of files) {
      // Check file type
      const isValidType = fileType === 'image' 
        ? ALLOWED_IMAGE_TYPES.includes(file.type)
        : ALLOWED_VIDEO_TYPES.includes(file.type);

      if (!isValidType) {
        toast.error(`${file.name} is not a supported ${fileType} type`);
        continue;
      }

      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} exceeds the 15MB size limit`);
        continue;
      }

      validFiles.push(file);
      newPreviews.push(URL.createObjectURL(file));
      newFileTypes.push(fileType);
    }

    setSelectedFiles(prev => [...prev, ...validFiles]);
    setPreviews(prev => [...prev, ...newPreviews]);
    setFileTypes(prev => [...prev, ...newFileTypes]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setFileTypes(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => {
      const newPreviews = [...prev];
      URL.revokeObjectURL(newPreviews[index]);
      return newPreviews.filter((_, i) => i !== index);
    });
  };

  const onEmojiSelect = (emoji: any) => {
    const textarea = document.querySelector('textarea');
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const before = text.substring(0, start);
      const after = text.substring(end);
      const newValue = before + emoji.native + after;
      setValue('content', newValue);
      // Set cursor position after emoji
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + emoji.native.length;
        textarea.focus();
      }, 0);
    }
    setShowEmojiPicker(false);
  };

  const onSubmit = async (data: PostFormData) => {
    if (!user) return;

    setIsLoading(true);
    try {
      const mediaUrls: string[] = [];
      const mediaTypes: string[] = [];

      // Upload files if any
      if (selectedFiles.length > 0) {
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          const fileType = fileTypes[i];
          const fileExt = file.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const filePath = `${user.id}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('posts')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('posts')
            .getPublicUrl(filePath);

          mediaUrls.push(publicUrl);
          mediaTypes.push(fileType);
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
      setFileTypes([]);
      setPreviews([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create post');
    } finally {
      setIsLoading(false);
    }
  };

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-lg bg-white p-4 shadow">
      <div className="relative">
        <textarea
          {...register('content')}
          className="w-full resize-none rounded-md border p-2"
          placeholder="What's on your mind?"
          rows={3}
        />
        <div className="absolute bottom-2 right-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          >
            <Smile className="h-5 w-5 text-gray-500" />
          </Button>
        </div>
        {showEmojiPicker && (
          <div
            ref={emojiPickerRef}
            className="absolute bottom-full right-0 z-50 mb-2"
          >
            <Picker
              data={data}
              onEmojiSelect={onEmojiSelect}
              theme="light"
              previewPosition="none"
            />
          </div>
        )}
      </div>
      {errors.content && (
        <p className="text-sm text-red-500">{errors.content.message}</p>
      )}

      {previews.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {previews.map((preview, index) => (
            <div key={index} className="relative">
              {fileTypes[index] === 'image' ? (
                <img
                  src={preview}
                  alt={`Preview ${index + 1}`}
                  className="h-32 w-full rounded-lg object-cover"
                />
              ) : (
                <video
                  src={preview}
                  className="h-32 w-full rounded-lg object-cover"
                  controls
                >
                  Your browser does not support the video tag.
                </video>
              )}
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="absolute right-1 top-1 rounded-full bg-black bg-opacity-50 p-1 text-white hover:bg-opacity-70"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="absolute bottom-1 left-1 rounded-full bg-black bg-opacity-50 px-2 py-0.5 text-xs text-white">
                {fileTypes[index] === 'image' ? 'Image' : 'Video'}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => imageInputRef.current?.click()}
            className="flex items-center gap-1 text-gray-500 hover:text-gray-700"
            disabled={isLoading || selectedFiles.length >= 4}
          >
            <Image className="h-5 w-5" />
            <span className="hidden sm:inline">Add Images</span>
          </Button>
          
          <Button
            type="button"
            variant="ghost"
            onClick={() => videoInputRef.current?.click()}
            className="flex items-center gap-1 text-gray-500 hover:text-gray-700"
            disabled={isLoading || selectedFiles.length >= 4}
          >
            <Film className="h-5 w-5" />
            <span className="hidden sm:inline">Add Videos</span>
          </Button>
          
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.gif"
            className="hidden"
            multiple
            onChange={(e) => handleFileSelect(e, 'image')}
            disabled={isLoading}
            ref={imageInputRef}
          />
          
          <input
            type="file"
            accept=".mp4,.webm,.mov"
            className="hidden"
            multiple
            onChange={(e) => handleFileSelect(e, 'video')}
            disabled={isLoading}
            ref={videoInputRef}
          />
        </div>
        
        <Button
          type="submit"
          disabled={isLoading || (!content?.trim() && selectedFiles.length === 0)}
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Post
        </Button>
      </div>
      
      {selectedFiles.length > 0 && (
        <p className="text-xs text-gray-500">
          {selectedFiles.length}/4 files selected ({selectedFiles.length === 4 ? 'maximum reached' : 'maximum 4'})
        </p>
      )}
    </form>
  );
}
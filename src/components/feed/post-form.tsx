import { useState, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Upload, Loader2, Send, X, Smile, Image, Film, AlertTriangle, BarChart } from 'lucide-react';
import { toast } from 'sonner';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { Button } from '../ui/button';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { getVideoDuration } from '../../lib/video-utils';
import { PollCreator } from '../polls/poll-creator';

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];

const postSchema = z.object({
  content: z.string().min(1, 'Post content is required'),
  media: z.array(z.string()).optional(),
  media_type: z.array(z.enum(['image', 'video'])).optional(),
});

type PostFormData = z.infer<typeof postSchema>;

interface MediaFile {
  file: File;
  type: 'image' | 'video';
  preview: string;
  progress: number;
}

export function PostForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [dragActive, setDragActive] = useState(false);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>([]);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollEndDate, setPollEndDate] = useState<string>('');
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const files = Array.from(e.target.files || []);
    
    // Check total number of files
    if (mediaFiles.length + files.length > 4) {
      toast.error('Maximum 4 media files allowed');
      return;
    }
    
    const validFiles: File[] = [];
    const newMediaFiles: MediaFile[] = [];
    
    for (const file of files) {
      // Check file type
      const isImage = type === 'image' && ALLOWED_IMAGE_TYPES.includes(file.type);
      const isVideo = type === 'video' && ALLOWED_VIDEO_TYPES.includes(file.type);
      
      if (!isImage && !isVideo) {
        toast.error(`${file.name} is not a supported ${type} type`);
        continue;
      }
      
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} exceeds the 15MB size limit`);
        continue;
      }
      
      // For videos, check duration
      if (isVideo) {
        try {
          const duration = await getVideoDuration(file);
          if (duration > 300) { // 5 minutes
            toast.error(`${file.name} exceeds the maximum duration of 5 minutes`);
            continue;
          }
        } catch (error) {
          toast.error(`Failed to validate video duration for ${file.name}`);
          continue;
        }
      }
      
      validFiles.push(file);
      newMediaFiles.push({
        file,
        type: isImage ? 'image' : 'video',
        preview: URL.createObjectURL(file),
        progress: 0
      });
    }
    
    setMediaFiles(prev => [...prev, ...newMediaFiles]);
    
    // Reset file input
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setMediaFiles(prev => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
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
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + emoji.native.length;
        textarea.focus();
      }, 0);
    }
    setShowEmojiPicker(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      
      // Check total number of files
      if (mediaFiles.length + files.length > 4) {
        toast.error('Maximum 4 media files allowed');
        return;
      }
      
      const validFiles: File[] = [];
      const newMediaFiles: MediaFile[] = [];
      
      for (const file of files) {
        // Check file type
        const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
        const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
        
        if (!isImage && !isVideo) {
          toast.error(`${file.name} is not a supported file type`);
          continue;
        }
        
        // Check file size
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`${file.name} exceeds the 15MB size limit`);
          continue;
        }
        
        // For videos, check duration
        if (isVideo) {
          try {
            const duration = await getVideoDuration(file);
            if (duration > 300) { // 5 minutes
              toast.error(`${file.name} exceeds the maximum duration of 5 minutes`);
              continue;
            }
          } catch (error) {
            toast.error(`Failed to validate video duration for ${file.name}`);
            continue;
          }
        }
        
        validFiles.push(file);
        newMediaFiles.push({
          file,
          type: isImage ? 'image' : 'video',
          preview: URL.createObjectURL(file),
          progress: 0
        });
      }
      
      setMediaFiles(prev => [...prev, ...newMediaFiles]);
    }
  }, [mediaFiles]);

  const updateFileProgress = (fileIndex: number, progress: number) => {
    setMediaFiles(prev => 
      prev.map((file, idx) => 
        idx === fileIndex ? { ...file, progress } : file
      )
    );
  };

  const onSubmit = async (data: PostFormData) => {
    if (!user) return;

    setIsLoading(true);
    try {
      const mediaUrls: string[] = [];
      const mediaTypes: ('image' | 'video')[] = [];

      if (mediaFiles.length > 0) {
        for (const [index, mediaFile] of mediaFiles.entries()) {
          const fileExt = mediaFile.file.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const filePath = `${user.id}/${fileName}`;

          // Create a unique ID for this upload
          const uploadId = `upload-${index}`;
          setUploadProgress(prev => ({ ...prev, [uploadId]: 0 }));

          // Set up upload with progress tracking
          const { error: uploadError } = await supabase.storage
            .from('posts')
            .upload(filePath, mediaFile.file, {
              contentType: mediaFile.file.type,
              onUploadProgress: (progress) => {
                const percentage = Math.round((progress.loaded / progress.total) * 100);
                updateFileProgress(index, percentage);
                setUploadProgress(prev => ({ ...prev, [uploadId]: percentage }));
              }
            });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('posts')
            .getPublicUrl(filePath);

          mediaUrls.push(publicUrl);
          mediaTypes.push(mediaFile.type);
        }
      }

      // Prepare post data
      const postData: any = {
        content: data.content,
        author_id: user.id,
        media: mediaUrls.length > 0 ? mediaUrls : null,
        media_type: mediaTypes.length > 0 ? mediaTypes : null,
      };

      // Add poll data if creating a poll
      if (showPollCreator && pollQuestion && pollOptions.length >= 2) {
        postData.is_poll = true;
        postData.poll_data = {
          question: pollQuestion,
          options: pollOptions,
          end_date: pollEndDate ? new Date(pollEndDate).toISOString() : null
        };
      }

      const { error } = await supabase.from('posts').insert(postData);

      if (error) throw error;

      toast.success('Post created successfully!');
      reset();
      setMediaFiles([]);
      setShowPollCreator(false);
      setPollOptions([]);
      setPollQuestion('');
      setPollEndDate('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create post');
    } finally {
      setIsLoading(false);
      setUploadProgress({});
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-lg bg-white p-4 shadow">
      <div className="relative">
        <textarea
          {...register('content')}
          className="w-full resize-none rounded-md border p-2"
          placeholder={showPollCreator ? "Add some context to your poll..." : "What's on your mind?"}
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

      {/* Poll Creator */}
      {showPollCreator && (
        <PollCreator
          question={pollQuestion}
          setQuestion={setPollQuestion}
          options={pollOptions}
          setOptions={setPollOptions}
          endDate={pollEndDate}
          setEndDate={setPollEndDate}
        />
      )}

      {/* Drag and drop zone */}
      {!showPollCreator && (
        <div 
          ref={dropZoneRef}
          className={`relative rounded-lg border-2 border-dashed p-6 transition-colors ${
            dragActive 
              ? 'border-blue-500 bg-blue-50' 
              : mediaFiles.length > 0 
                ? 'border-gray-300 bg-gray-50' 
                : 'border-gray-300 hover:bg-gray-50'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {mediaFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center">
              <div className="mb-2 flex items-center justify-center gap-2">
                <Image className="h-6 w-6 text-gray-400" />
                <Film className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500">
                Drag and drop images or videos here, or click to select files
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Supports JPG, PNG, GIF, MP4, MOV, AVI (max 15MB)
              </p>
              <div className="mt-4 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Image className="mr-2 h-4 w-4" />
                  Select Images
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => videoInputRef.current?.click()}
                >
                  <Film className="mr-2 h-4 w-4" />
                  Select Videos
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {mediaFiles.map((media, index) => (
                <div key={index} className="relative rounded-lg bg-white shadow">
                  {media.type === 'image' ? (
                    <img
                      src={media.preview}
                      alt={`Preview ${index + 1}`}
                      className="h-32 w-full rounded-lg object-cover"
                    />
                  ) : (
                    <video
                      src={media.preview}
                      className="h-32 w-full rounded-lg object-cover"
                      controls
                    >
                      Your browser does not support the video tag.
                    </video>
                  )}
                  <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black bg-opacity-50 px-2 py-1 text-xs text-white">
                    {media.type === 'image' ? (
                      <Image className="h-3 w-3" />
                    ) : (
                      <Film className="h-3 w-3" />
                    )}
                    {media.type}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="absolute right-1 top-1 rounded-full bg-black bg-opacity-50 p-1 text-white hover:bg-opacity-70"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  
                  {/* Progress bar */}
                  {media.progress > 0 && media.progress < 100 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${media.progress}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              ))}
              
              {/* Add more button if less than 4 files */}
              {mediaFiles.length < 4 && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-32 flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 hover:bg-gray-50"
                  >
                    <Image className="mb-2 h-6 w-6 text-gray-400" />
                    <span className="text-sm text-gray-500">Add Images</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => videoInputRef.current?.click()}
                    className="flex h-32 flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 hover:bg-gray-50"
                  >
                    <Film className="mb-2 h-6 w-6 text-gray-400" />
                    <span className="text-sm text-gray-500">Add Videos</span>
                  </button>
                </div>
              )}
            </div>
          )}
          
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.gif"
            className="hidden"
            multiple
            onChange={(e) => handleFileSelect(e, 'image')}
            disabled={isLoading}
            ref={fileInputRef}
          />
          
          <input
            type="file"
            accept=".mp4,.mov,.avi"
            className="hidden"
            multiple
            onChange={(e) => handleFileSelect(e, 'video')}
            disabled={isLoading}
            ref={videoInputRef}
          />
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {!showPollCreator && (
            <>
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <AlertTriangle className="h-4 w-4" />
                <span>Max 4 files, 15MB each</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowPollCreator(true);
                  // Clear any media files when switching to poll
                  if (mediaFiles.length > 0) {
                    if (window.confirm("Creating a poll will remove any attached media. Continue?")) {
                      mediaFiles.forEach((media, index) => {
                        URL.revokeObjectURL(media.preview);
                      });
                      setMediaFiles([]);
                    } else {
                      return;
                    }
                  }
                }}
                className="flex items-center gap-1 text-blue-600"
                disabled={isLoading}
              >
                <BarChart className="h-4 w-4" />
                Create Poll
              </Button>
            </>
          )}
          {showPollCreator && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (pollQuestion || pollOptions.length > 0) {
                  if (window.confirm("Discard this poll?")) {
                    setShowPollCreator(false);
                    setPollOptions([]);
                    setPollQuestion('');
                    setPollEndDate('');
                  }
                } else {
                  setShowPollCreator(false);
                }
              }}
              className="text-gray-600"
              disabled={isLoading}
            >
              Cancel Poll
            </Button>
          )}
        </div>
        <Button
          type="submit"
          disabled={isLoading || 
            (!content?.trim() && mediaFiles.length === 0) || 
            (showPollCreator && (pollOptions.length < 2 || !pollQuestion))}
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
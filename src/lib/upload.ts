import { supabase } from './supabase';
import { getVideoDuration, generateVideoThumbnail } from './video-utils';

const MAX_IMAGE_SIZE = 15 * 1024 * 1024; // 15MB
const MAX_VIDEO_SIZE = 15 * 1024 * 1024; // 15MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
const MAX_VIDEO_DURATION = 300; // 5 minutes in seconds

export interface UploadOptions {
  onProgress?: (progress: number) => void;
  generateThumbnail?: boolean;
  maxFileSize?: number;
  maxVideoDuration?: number;
}

export interface UploadResult {
  url: string;
  type: 'image' | 'video';
  thumbnailUrl?: string;
  duration?: number;
  width?: number;
  height?: number;
}

/**
 * Uploads a media file to Supabase storage
 */
export async function uploadMedia(
  file: File,
  userId: string,
  bucket: 'posts' | 'messages' | 'profiles' = 'posts',
  options: UploadOptions = {}
): Promise<UploadResult> {
  const {
    onProgress,
    generateThumbnail = false,
    maxFileSize = MAX_IMAGE_SIZE,
    maxVideoDuration = MAX_VIDEO_DURATION
  } = options;

  try {
    // Validate file type
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);

    if (!isImage && !isVideo) {
      throw new Error(
        `Unsupported file type. Please upload ${ALLOWED_IMAGE_TYPES.map(t => t.split('/')[1].toUpperCase()).join(', ')} for images or ${ALLOWED_VIDEO_TYPES.map(t => t.split('/')[1].toUpperCase()).join(', ')} for videos.`
      );
    }

    // Validate file size
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (file.size > maxSize) {
      throw new Error(`File size must be less than ${maxSize / (1024 * 1024)}MB`);
    }

    // For videos, validate duration
    let duration: number | undefined;
    let thumbnailUrl: string | undefined;
    
    if (isVideo) {
      duration = await getVideoDuration(file);
      
      if (duration > maxVideoDuration) {
        throw new Error(`Video duration must be less than ${Math.floor(maxVideoDuration / 60)} minutes`);
      }
      
      // Generate thumbnail if requested
      if (generateThumbnail) {
        const thumbnail = await generateVideoThumbnail(file);
        
        // Convert data URL to File
        const thumbnailFile = dataURLtoFile(thumbnail, `${file.name.split('.')[0]}_thumbnail.jpg`);
        
        // Upload thumbnail
        const thumbnailPath = `${userId}/thumbnails/${Math.random()}.jpg`;
        
        const { error: thumbnailError } = await supabase.storage
          .from(bucket)
          .upload(thumbnailPath, thumbnailFile, {
            contentType: 'image/jpeg',
            cacheControl: '3600'
          });
          
        if (thumbnailError) throw thumbnailError;
        
        const { data: { publicUrl } } = supabase.storage
          .from(bucket)
          .getPublicUrl(thumbnailPath);
          
        thumbnailUrl = publicUrl;
      }
    }

    // Generate a unique filename
    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop();
    const fileName = `${timestamp}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    // Upload file with progress tracking
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false,
        onUploadProgress: (progress) => {
          const percentage = Math.round((progress.loaded / progress.total) * 100);
          onProgress?.(percentage);
        }
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return {
      url: publicUrl,
      type: isImage ? 'image' : 'video',
      thumbnailUrl,
      duration
    };
  } catch (error) {
    console.error('Error uploading media:', error);
    throw error;
  }
}

/**
 * Converts a data URL to a File object
 */
function dataURLtoFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  
  return new File([u8arr], filename, { type: mime });
}
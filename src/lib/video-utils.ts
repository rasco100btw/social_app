/**
 * Utility functions for video processing and optimization
 */

/**
 * Gets the duration of a video file
 * @param file The video file
 * @returns Promise that resolves with the duration in seconds
 */
export const getVideoDuration = (file: File): Promise<number> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    
    video.onerror = () => {
      window.URL.revokeObjectURL(video.src);
      reject('Error loading video');
    };
    
    video.src = URL.createObjectURL(file);
  });
};

/**
 * Generates a thumbnail from a video file
 * @param file The video file
 * @param seekTime Time in seconds to capture the thumbnail (default: 0.1)
 * @returns Promise that resolves with the thumbnail as a data URL
 */
export const generateVideoThumbnail = (file: File, seekTime = 0.1): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.playsInline = true;
    video.muted = true;
    
    video.onloadedmetadata = () => {
      // Seek to the specified time
      video.currentTime = Math.min(seekTime, video.duration);
    };
    
    video.onseeked = () => {
      // Create a canvas and draw the video frame
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject('Could not get canvas context');
        return;
      }
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert canvas to data URL
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      
      // Clean up
      window.URL.revokeObjectURL(video.src);
      
      resolve(dataUrl);
    };
    
    video.onerror = () => {
      window.URL.revokeObjectURL(video.src);
      reject('Error generating thumbnail');
    };
    
    video.src = URL.createObjectURL(file);
  });
};

/**
 * Validates a video file
 * @param file The video file to validate
 * @param options Validation options
 * @returns Promise that resolves with a validation result
 */
export const validateVideo = async (
  file: File, 
  options: {
    maxSize?: number;
    maxDuration?: number;
    allowedTypes?: string[];
  } = {}
): Promise<{ valid: boolean; error?: string }> => {
  const {
    maxSize = 15 * 1024 * 1024, // 15MB
    maxDuration = 300, // 5 minutes
    allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo']
  } = options;
  
  // Check file size
  if (file.size > maxSize) {
    return { 
      valid: false, 
      error: `File size exceeds the maximum limit of ${Math.round(maxSize / (1024 * 1024))}MB` 
    };
  }
  
  // Check file type
  if (!allowedTypes.includes(file.type)) {
    return { 
      valid: false, 
      error: `Unsupported file format. Allowed formats: ${allowedTypes.map(t => t.split('/')[1].toUpperCase()).join(', ')}` 
    };
  }
  
  // Check duration
  try {
    const duration = await getVideoDuration(file);
    if (duration > maxDuration) {
      return { 
        valid: false, 
        error: `Video duration exceeds the maximum limit of ${Math.floor(maxDuration / 60)} minutes` 
      };
    }
  } catch (error) {
    return { 
      valid: false, 
      error: 'Could not validate video duration' 
    };
  }
  
  return { valid: true };
};

/**
 * Gets video dimensions
 * @param file The video file
 * @returns Promise that resolves with the video dimensions
 */
export const getVideoDimensions = (file: File): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      resolve({
        width: video.videoWidth,
        height: video.videoHeight
      });
    };
    
    video.onerror = () => {
      window.URL.revokeObjectURL(video.src);
      reject('Error loading video');
    };
    
    video.src = URL.createObjectURL(file);
  });
};
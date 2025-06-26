import { useState, useRef } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';

interface ImageUploadProps {
  onSuccess?: (url: string) => void;
}

export function ImageUpload({ onSuccess }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user, updateUser } = useAuthStore();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      toast.error('Please upload a JPG or PNG file');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    try {
      setIsUploading(true);

      // Create a unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Delete existing avatar if any
      await supabase.storage
        .from('avatars')
        .remove([`${user.id}/avatar.jpg`, `${user.id}/avatar.png`]);

      // Upload new file with explicit content type
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '0',
          upsert: true,
          contentType: file.type
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          avatar_url: publicUrl,
          name: user.fullName // Ensure name is set to prevent not-null constraint violation
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Show preview
      const preview = URL.createObjectURL(file);
      setPreviewUrl(preview);

      // Update local state
      updateUser({ avatar_url: publicUrl });

      // Notify success
      onSuccess?.(publicUrl);
      toast.success('Profile picture updated successfully');

      // Clean up preview after successful upload
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload image');
      
      // Clean up preview on error
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="relative">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/jpeg,image/png"
        onChange={handleFileSelect}
        disabled={isUploading}
      />

      <div className="flex items-center gap-4">
        <div className="relative">
          <img
            src={previewUrl || user?.avatar_url || user?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.fullName}`}
            alt="Profile"
            className="h-24 w-24 rounded-full object-cover"
          />
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black bg-opacity-50">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload Photo
          </Button>
          <p className="text-xs text-gray-500">
            JPG or PNG • Max 5MB
          </p>
        </div>
      </div>

      {previewUrl && !isUploading && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute -right-2 -top-2 rounded-full p-1"
          onClick={() => {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Upload, Eye, EyeOff, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { ImageUpload } from './image-upload';

const profileSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().optional().refine((val) => {
    if (!val) return true;
    return /^(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{8,}$/.test(val);
  }, 'Password must be at least 8 characters and include numbers and special characters'),
  biography: z.string().max(500, 'Biography cannot exceed 500 characters'),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export function EditProfile() {
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [biography, setBiography] = useState('');
  const { user, updateUser } = useAuthStore();

  const {
    register,
    handleSubmit,
    watch,
    setError,
    setValue,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      biography: '',
    }
  });

  const watchBiography = watch('biography');
  const newPassword = watch('newPassword');

  // Load existing profile data
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('profiles')
          .select('biography')
          .eq('id', user.id)
          .single();
          
        if (error) throw error;
        
        if (data) {
          setBiography(data.biography || '');
          setValue('biography', data.biography || '');
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        toast.error('Failed to load profile data');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProfile();
  }, [user, setValue]);

  useEffect(() => {
    if (!newPassword) {
      setPasswordStrength(0);
      return;
    }

    let strength = 0;
    if (newPassword.length >= 8) strength += 1;
    if (/[0-9]/.test(newPassword)) strength += 1;
    if (/[!@#$%^&*]/.test(newPassword)) strength += 1;
    if (/[A-Z]/.test(newPassword)) strength += 1;

    setPasswordStrength(strength);
  }, [newPassword]);

  const onSubmit = async (data: ProfileFormData) => {
    if (!user?.email) return;

    setIsSubmitting(true);
    try {
      if (data.newPassword) {
        // Verify current password
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: data.currentPassword,
        });

        if (authError) {
          setError('currentPassword', {
            type: 'manual',
            message: 'Current password is incorrect',
          });
          setIsSubmitting(false);
          return;
        }

        // Update password
        const { error: passwordError } = await supabase.auth.updateUser({
          password: data.newPassword,
        });

        if (passwordError) throw passwordError;
      }

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          biography: data.biography,
          name: user.fullName // Ensure name is set to prevent not-null constraint violation
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Update error:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Edit Profile</h2>
        <p className="text-sm text-gray-500">Update your personal information</p>
      </div>

      <div className="space-y-4">
        {/* Profile Picture */}
        <div>
          <label className="mb-2 block text-sm font-medium">Profile Picture</label>
          <ImageUpload 
            onSuccess={(url) => {
              if (user) {
                updateUser({ ...user, avatar: url });
              }
            }} 
          />
        </div>

        {/* Current Password */}
        <div>
          <label className="mb-2 block text-sm font-medium">
            Current Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              {...register('currentPassword')}
              className="w-full rounded-md border p-2 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5 text-gray-400" />
              ) : (
                <Eye className="h-5 w-5 text-gray-400" />
              )}
            </button>
          </div>
          {errors.currentPassword && (
            <p className="mt-1 text-sm text-red-500">
              {errors.currentPassword.message}
            </p>
          )}
        </div>

        {/* New Password */}
        <div>
          <label className="mb-2 block text-sm font-medium">
            New Password (Optional)
          </label>
          <div className="relative">
            <input
              type={showNewPassword ? 'text' : 'password'}
              {...register('newPassword')}
              className="w-full rounded-md border p-2 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              {showNewPassword ? (
                <EyeOff className="h-5 w-5 text-gray-400" />
              ) : (
                <Eye className="h-5 w-5 text-gray-400" />
              )}
            </button>
          </div>
          {newPassword && (
            <div className="mt-2">
              <div className="mb-1 flex gap-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-2 flex-1 rounded-full ${
                      i < passwordStrength
                        ? 'bg-green-500'
                        : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-gray-500">
                Password strength:{' '}
                {passwordStrength === 0
                  ? 'Weak'
                  : passwordStrength === 1
                  ? 'Fair'
                  : passwordStrength === 2
                  ? 'Good'
                  : passwordStrength === 3
                  ? 'Strong'
                  : 'Very Strong'}
              </p>
            </div>
          )}
          {errors.newPassword && (
            <p className="mt-1 text-sm text-red-500">
              {errors.newPassword.message}
            </p>
          )}
        </div>

        {/* Biography */}
        <div>
          <label className="mb-2 block text-sm font-medium">Biography</label>
          <textarea
            {...register('biography')}
            rows={4}
            className="w-full rounded-md border p-2"
          />
          <div className="mt-1 flex justify-between">
            <p className="text-sm text-gray-500">
              {watchBiography?.length || 0}/500 characters
            </p>
            {errors.biography && (
              <p className="text-sm text-red-500">{errors.biography.message}</p>
            )}
          </div>
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        <Save className="mr-2 h-5 w-5" />
        {isSubmitting ? 'Saving...' : 'Save Changes'}
      </Button>
    </form>
  );
}
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Upload, ChevronLeft, User } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';

const profileSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  gender: z.enum(['male', 'female'], {
    required_error: 'Please select your gender',
  }),
  filiere: z.string().min(1, 'Filière is required'),
  hobbies: z.array(z.string()).min(3, 'Select at least 3 hobbies'),
  bio: z.string()
    .min(50, 'Bio must be at least 50 characters')
    .max(150, 'Bio cannot exceed 150 characters'),
  avatar_url: z.string({
    required_error: 'Profile picture is required',
  }),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const FILIERES = [
  'Computer Science',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'Economics',
  'Business',
  'Literature',
  'Languages',
  'Arts',
];

const HOBBIES = [
  'Reading',
  'Writing',
  'Sports',
  'Music',
  'Gaming',
  'Cooking',
  'Photography',
  'Travel',
  'Art',
  'Technology',
];

export function ProfileSetup() {
  const [isLoading, setIsLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const { user, login } = useAuthStore();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      hobbies: [],
    },
  });

  const selectedHobbies = watch('hobbies');
  const selectedGender = watch('gender');

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
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

      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setValue('avatar_url', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return;

    setIsLoading(true);
    try {
      let avatar_url = data.avatar_url;

      if (avatarFile) {
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(`${user.id}/${avatarFile.name}`, avatarFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(uploadData.path);

        avatar_url = publicUrl;
      }

      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        name: `${data.first_name} ${data.last_name}`,
        email: user.email,
        role: 'student',
        gender: data.gender,
        first_name: data.first_name,
        last_name: data.last_name,
        filiere: data.filiere,
        hobbies: data.hobbies,
        bio: data.bio,
        avatar_url,
      });

      if (error) throw error;

      login({
        ...user,
        name: `${data.first_name} ${data.last_name}`,
        avatar: avatar_url,
      });

      toast.success('Profile created successfully!');
    } catch (error) {
      console.error('Error creating profile:', error);
      toast.error('Failed to create profile');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold">Select Gender</h2>
              <p className="text-gray-500">Please select your gender</p>
            </div>
            <div className="flex justify-center gap-4">
              <button
                type="button"
                onClick={() => setValue('gender', 'male')}
                className={`flex flex-col items-center rounded-lg p-6 transition-colors ${
                  selectedGender === 'male'
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-gray-50 text-gray-600'
                }`}
              >
                <div className="mb-2 rounded-full bg-blue-600 p-4">
                  <User className="h-8 w-8 text-white" />
                </div>
                <span className="font-medium">Male</span>
              </button>
              <button
                type="button"
                onClick={() => setValue('gender', 'female')}
                className={`flex flex-col items-center rounded-lg p-6 transition-colors ${
                  selectedGender === 'female'
                    ? 'bg-pink-100 text-pink-600'
                    : 'bg-gray-50 text-gray-600'
                }`}
              >
                <div className="mb-2 rounded-full bg-pink-600 p-4">
                  <User className="h-8 w-8 text-white" />
                </div>
                <span className="font-medium">Female</span>
              </button>
            </div>
            {errors.gender && (
              <p className="text-center text-sm text-red-500">
                {errors.gender.message}
              </p>
            )}
            <Button
              onClick={() => selectedGender && setCurrentStep(2)}
              className="w-full py-6 text-lg font-semibold"
              disabled={!selectedGender}
            >
              Continue
            </Button>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold">Select Your Filière</h2>
              <p className="text-gray-500">Choose your field of study</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {FILIERES.map((filiere) => (
                <button
                  key={filiere}
                  type="button"
                  onClick={() => setValue('filiere', filiere)}
                  className={`rounded-lg p-4 text-center transition-colors ${
                    watch('filiere') === filiere
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-gray-50 text-gray-600'
                  }`}
                >
                  {filiere}
                </button>
              ))}
            </div>
            {errors.filiere && (
              <p className="text-center text-sm text-red-500">
                {errors.filiere.message}
              </p>
            )}
            <div className="flex gap-4">
              <Button
                variant="ghost"
                onClick={() => setCurrentStep(1)}
                className="flex-1 py-6 text-lg font-semibold"
              >
                Back
              </Button>
              <Button
                onClick={() => watch('filiere') && setCurrentStep(3)}
                className="flex-1 py-6 text-lg font-semibold"
                disabled={!watch('filiere')}
              >
                Continue
              </Button>
            </div>
          </div>
        );

      default:
        return (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold">Complete Your Profile</h2>
              <p className="text-gray-500">Tell us more about yourself</p>
            </div>

            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <input
                    {...register('first_name')}
                    placeholder="First Name"
                    className="w-full rounded-md border bg-gray-50 p-2"
                  />
                  {errors.first_name && (
                    <p className="text-sm text-red-500">
                      {errors.first_name.message}
                    </p>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    {...register('last_name')}
                    placeholder="Last Name"
                    className="w-full rounded-md border bg-gray-50 p-2"
                  />
                  {errors.last_name && (
                    <p className="text-sm text-red-500">
                      {errors.last_name.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Profile Picture (Required)
                </label>
                <div className="flex items-center gap-4">
                  {watch('avatar_url') && (
                    <img
                      src={watch('avatar_url')}
                      alt="Avatar preview"
                      className="h-16 w-16 rounded-full object-cover"
                    />
                  )}
                  <label className="flex cursor-pointer items-center gap-2 rounded-md border p-2 hover:bg-gray-50">
                    <Upload className="h-5 w-5" />
                    <span>Upload Photo (JPG/PNG, max 5MB)</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                  </label>
                </div>
                {errors.avatar_url && (
                  <p className="text-sm text-red-500">
                    {errors.avatar_url.message}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Hobbies (Select at least 3)
                </label>
                <div className="flex flex-wrap gap-2">
                  {HOBBIES.map((hobby) => (
                    <label
                      key={hobby}
                      className={`cursor-pointer rounded-full px-4 py-2 text-sm transition-colors ${
                        selectedHobbies?.includes(hobby)
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      <input
                        type="checkbox"
                        value={hobby}
                        className="hidden"
                        {...register('hobbies')}
                      />
                      {hobby}
                    </label>
                  ))}
                </div>
                {errors.hobbies && (
                  <p className="text-sm text-red-500">{errors.hobbies.message}</p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Bio (50-150 characters)
                </label>
                <textarea
                  {...register('bio')}
                  placeholder="Tell us about yourself..."
                  rows={4}
                  className="w-full rounded-md border bg-gray-50 p-2"
                />
                <div className="mt-1 flex justify-between">
                  <p className="text-sm text-gray-500">
                    {watch('bio')?.length || 0}/150 characters
                  </p>
                  {errors.bio && (
                    <p className="text-sm text-red-500">{errors.bio.message}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCurrentStep(2)}
                className="flex-1 py-6 text-lg font-semibold"
              >
                Back
              </Button>
              <Button
                type="submit"
                className="flex-1 py-6 text-lg font-semibold"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Complete Profile
              </Button>
            </div>
          </form>
        );
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 rounded-lg bg-white p-8 shadow-lg">
      <button
        onClick={() => currentStep > 1 && setCurrentStep(currentStep - 1)}
        className="flex items-center text-gray-600"
      >
        <ChevronLeft className="h-6 w-6" />
        BACK
      </button>
      {renderStep()}
    </div>
  );
}
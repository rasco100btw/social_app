import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Upload, X, Loader2, Camera, Image } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png'];

const groupSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').max(50, 'Name cannot exceed 50 characters'),
  purpose: z.string()
    .min(20, 'Purpose must be at least 20 characters')
    .max(250, 'Purpose cannot exceed 250 characters'),
  description: z.string().optional(),
  maxCapacity: z.number().min(5).max(50),
  subjectCategory: z.string().min(1, 'Subject category is required'),
  visibility: z.enum(['public', 'private']),
  logo_url: z.string().optional(),
  banner_url: z.string().optional(),
});

type GroupFormData = z.infer<typeof groupSchema>;

interface CreateGroupProps {
  onClose: () => void;
}

const SUBJECT_CATEGORIES = [
  'Computer Science',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'Engineering',
  'Business',
  'Arts',
  'Humanities',
  'Social Sciences',
];

export function CreateGroup({ onClose }: CreateGroupProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<GroupFormData>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      visibility: 'public',
      maxCapacity: 20,
      subjectCategory: '',
    },
    mode: 'onChange',
  });

  const selectedCategory = watch('subjectCategory');
  const groupName = watch('name');
  const groupPurpose = watch('purpose');

  const handleFileUpload = async (file: File, type: 'logo' | 'banner') => {
    if (!user) return;

    // Validate file
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast.error('Please upload a JPG or PNG file');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error('File size must be less than 5MB');
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = () => {
      if (type === 'logo') {
        setLogoPreview(reader.result as string);
      } else {
        setBannerPreview(reader.result as string);
      }
    };
    reader.readAsDataURL(file);

    // Upload to storage
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('groups')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('groups')
        .getPublicUrl(filePath);

      setValue(type === 'logo' ? 'logo_url' : 'banner_url', publicUrl);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const onSubmit = async (data: GroupFormData) => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      // Create group
      const { data: group, error: groupError } = await supabase
        .from('student_groups')
        .insert({
          name: data.name,
          purpose: data.purpose,
          description: data.description,
          max_capacity: data.maxCapacity,
          subject_category: data.subjectCategory,
          visibility: data.visibility,
          logo_url: data.logo_url,
          banner_url: data.banner_url,
          creator_id: user.id,
        })
        .select()
        .single();

      if (groupError) {
        console.error('Group creation error:', groupError);
        throw new Error(groupError.message || 'Failed to create group');
      }

      // Add creator as primary admin
      const { error: membershipError } = await supabase
        .from('group_membership')
        .insert({
          group_id: group.id,
          user_id: user.id,
          role: 'primary_admin',
        });

      if (membershipError) {
        console.error('Membership error:', membershipError);
        throw new Error(membershipError.message || 'Failed to add you as group admin');
      }

      toast.success('Group created successfully!');
      onClose();
    } catch (error) {
      console.error('Error creating group:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create group');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Scroll to top when changing steps
  const scrollToTop = () => {
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goToNextStep = () => {
    setCurrentStep(2);
    scrollToTop();
  };

  const goToPreviousStep = () => {
    setCurrentStep(1);
    scrollToTop();
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Group Name <span className="text-red-500">*</span>
              </label>
              <input
                {...register('name')}
                className="w-full rounded-lg border bg-transparent p-3"
                placeholder="Enter a name for your group"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Subject Category <span className="text-red-500">*</span>
              </label>
              <select
                {...register('subjectCategory')}
                className="w-full rounded-lg border bg-transparent p-3"
              >
                <option value="">Select a category</option>
                {SUBJECT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              {errors.subjectCategory && (
                <p className="mt-1 text-sm text-red-500">{errors.subjectCategory.message}</p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Purpose <span className="text-red-500">*</span>
                <span className="ml-1 text-xs text-gray-500">
                  (20-250 characters)
                </span>
              </label>
              <textarea
                {...register('purpose')}
                className="w-full rounded-lg border bg-transparent p-3"
                rows={3}
                placeholder="Describe the main purpose of your group"
              />
              <div className="mt-1 flex justify-between">
                <span className="text-xs text-gray-500">
                  {groupPurpose?.length || 0}/250 characters
                </span>
                {errors.purpose && (
                  <p className="text-sm text-red-500">{errors.purpose.message}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                onClick={goToNextStep}
                disabled={!groupName || !selectedCategory || !groupPurpose || groupPurpose.length < 20}
              >
                Next
              </Button>
            </div>
          </div>
        );
      
      case 2:
        return (
          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Description (Optional)
              </label>
              <textarea
                {...register('description')}
                className="w-full rounded-lg border bg-transparent p-3"
                rows={4}
                placeholder="Provide additional details about your group"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Maximum Capacity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  {...register('maxCapacity', { valueAsNumber: true })}
                  className="w-full rounded-lg border bg-transparent p-3"
                  min={5}
                  max={50}
                />
                {errors.maxCapacity && (
                  <p className="mt-1 text-sm text-red-500">{errors.maxCapacity.message}</p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Visibility <span className="text-red-500">*</span>
                </label>
                <select
                  {...register('visibility')}
                  className="w-full rounded-lg border bg-transparent p-3"
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Group Logo
                </label>
                <div className="flex flex-col items-center gap-4">
                  <div className="relative h-32 w-32 overflow-hidden rounded-full border-2 border-dashed border-gray-300 bg-gray-50">
                    {logoPreview ? (
                      <img
                        src={logoPreview}
                        alt="Group logo preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center text-gray-400">
                        <Camera className="h-8 w-8" />
                        <span className="mt-1 text-xs">Logo</span>
                      </div>
                    )}
                    
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 opacity-0 transition-opacity hover:opacity-100"
                    >
                      <Upload className="h-8 w-8 text-white" />
                    </button>
                  </div>
                  
                  <input
                    type="file"
                    ref={logoInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'logo')}
                    disabled={isUploading}
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Group Banner
                </label>
                <div className="flex flex-col items-center gap-4">
                  <div className="relative h-32 w-full overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-gray-50">
                    {bannerPreview ? (
                      <img
                        src={bannerPreview}
                        alt="Group banner preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center text-gray-400">
                        <Image className="h-8 w-8" />
                        <span className="mt-1 text-xs">Banner</span>
                      </div>
                    )}
                    
                    <button
                      type="button"
                      onClick={() => bannerInputRef.current?.click()}
                      className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 opacity-0 transition-opacity hover:opacity-100"
                    >
                      <Upload className="h-8 w-8 text-white" />
                    </button>
                  </div>
                  
                  <input
                    type="file"
                    ref={bannerInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'banner')}
                    disabled={isUploading}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={goToPreviousStep}
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || isUploading}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Group'
                )}
              </Button>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div 
        ref={modalRef}
        className="w-full max-w-lg max-h-[90vh] overflow-hidden rounded-lg bg-white shadow-xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-4">
          <h2 className="text-xl font-bold">Create New Group</h2>
          <Button variant="ghost" onClick={onClose} className="h-10 w-10 rounded-full p-0">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div 
          ref={contentRef}
          className="max-h-[calc(90vh-60px)] overflow-y-auto p-6"
        >
          {/* Progress indicator */}
          <div className="mb-6">
            <div className="flex justify-between">
              {[1, 2].map((step) => (
                <div 
                  key={step}
                  className="flex flex-col items-center"
                  style={{ width: '50%' }}
                >
                  <div 
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${
                      currentStep >= step 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {step}
                  </div>
                  <span className="mt-1 text-center text-xs">
                    {step === 1 ? 'Basic Info' : 'Details & Media'}
                  </span>
                </div>
              ))}
            </div>
            <div className="relative mt-2 h-1 w-full bg-gray-200">
              <div 
                className="absolute h-1 bg-blue-600 transition-all duration-300"
                style={{ width: `${(currentStep - 1) * 100}%` }}
              ></div>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)}>
            {renderStep()}
          </form>
        </div>
      </div>
    </div>
  );
}
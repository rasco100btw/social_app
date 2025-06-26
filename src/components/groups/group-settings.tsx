import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Loader2, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { supabase } from '../../lib/supabase';
import * as Dialog from '@radix-ui/react-dialog';

interface Group {
  id: string;
  name: string;
  purpose: string;
  description: string;
  subject_category: string;
  visibility: 'public' | 'private';
  max_capacity: number;
}

interface GroupSettingsProps {
  group: Group;
  onClose: () => void;
}

const groupSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').max(50, 'Name cannot exceed 50 characters'),
  purpose: z.string()
    .min(50, 'Purpose must be at least 50 characters')
    .max(250, 'Purpose cannot exceed 250 characters'),
  description: z.string().optional(),
  max_capacity: z.number().min(5).max(50),
  visibility: z.enum(['public', 'private']),
});

type GroupFormData = z.infer<typeof groupSchema>;

export function GroupSettings({ group, onClose }: GroupSettingsProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GroupFormData>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      name: group.name,
      purpose: group.purpose,
      description: group.description,
      max_capacity: group.max_capacity,
      visibility: group.visibility,
    },
  });

  const onSubmit = async (data: GroupFormData) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('student_groups')
        .update({
          name: data.name,
          purpose: data.purpose,
          description: data.description,
          max_capacity: data.max_capacity,
          visibility: data.visibility,
        })
        .eq('id', group.id);

      if (error) throw error;

      toast.success('Group settings updated successfully');
      onClose();
    } catch (error) {
      console.error('Error updating group:', error);
      toast.error('Failed to update group settings');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!window.confirm('Are you sure you want to delete this group? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('student_groups')
        .delete()
        .eq('id', group.id);

      if (error) throw error;

      toast.success('Group deleted successfully');
      window.location.href = '/groups';
    } catch (error) {
      console.error('Error deleting group:', error);
      toast.error('Failed to delete group');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog.Root open={true}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black bg-opacity-50" />
        <Dialog.Content className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
            <Dialog.Title className="text-xl font-semibold">Group Settings</Dialog.Title>
            <div className="mb-4 flex items-center justify-between">
              <Button variant="ghost" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Group Name</label>
                <input
                  {...register('name')}
                  className="w-full rounded-lg border p-2"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Purpose (50-250 characters)</label>
                <textarea
                  {...register('purpose')}
                  className="w-full rounded-lg border p-2"
                  rows={3}
                />
                {errors.purpose && (
                  <p className="mt-1 text-sm text-red-500">{errors.purpose.message}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Description (Optional)</label>
                <textarea
                  {...register('description')}
                  className="w-full rounded-lg border p-2"
                  rows={4}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Maximum Capacity</label>
                  <input
                    type="number"
                    {...register('max_capacity', { valueAsNumber: true })}
                    className="w-full rounded-lg border p-2"
                    min={5}
                    max={50}
                  />
                  {errors.max_capacity && (
                    <p className="mt-1 text-sm text-red-500">{errors.max_capacity.message}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Visibility</label>
                  <select
                    {...register('visibility')}
                    className="w-full rounded-lg border p-2"
                  >
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDeleteGroup}
                  disabled={isDeleting}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  {isDeleting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Delete Group
                </Button>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onClose}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save Changes
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
import { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import * as Dialog from '@radix-ui/react-dialog';

interface ReportModalProps {
  userId: string;
  userName: string;
  onClose: () => void;
}

const REPORT_REASONS = [
  'Inappropriate Content',
  'Harassment/Bullying',
  'Spam',
  'Fake Profile',
  'Hate Speech',
  'Violence/Threats',
  'Copyright Violation',
  'Other'
] as const;

export function ReportModal({ userId, userName, onClose }: ReportModalProps) {
  const [reason, setReason] = useState<typeof REPORT_REASONS[number] | ''>('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!reason) {
      toast.error('Please select a reason for reporting');
      return;
    }

    if (description.length < 10) {
      toast.error('Please provide a more detailed description (minimum 10 characters)');
      return;
    }

    if (description.length > 100) {
      toast.error('Description cannot exceed 100 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('user_reports')
        .insert({
          reporter_id: user.id,
          reported_id: userId,
          reason: reason.toLowerCase().replace(/\s+/g, '_'),
          description,
          status: 'pending'
        });

      if (error) throw error;

      toast.success('Thank you for helping keep our community safe. We will review your report within 24 hours.');
      onClose();
    } catch (error) {
      console.error('Error submitting report:', error);
      toast.error('Failed to submit report');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={true}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black bg-opacity-50" />
        <Dialog.Content className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <Dialog.Title className="text-xl font-semibold">Report User</Dialog.Title>
            <div className="mb-4 flex items-center justify-between">
              <Button variant="ghost" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block font-medium">
                  Why are you reporting {userName}?
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as typeof REPORT_REASONS[number])}
                  className="w-full rounded-lg border p-2"
                  required
                >
                  <option value="">Select a reason</option>
                  {REPORT_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block font-medium">
                  Description
                  <span className="ml-1 text-sm text-gray-500">
                    ({description.length}/100)
                  </span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Please provide specific details about the incident"
                  className="w-full rounded-lg border p-2"
                  rows={3}
                  maxLength={100}
                  required
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !reason || description.length < 10}
                >
                  Submit Report
                </Button>
              </div>
            </form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
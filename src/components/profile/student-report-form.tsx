import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Upload, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';

const reportSchema = z.object({
  reporter_name: z.string().min(3, 'Full name is required'),
  reporter_class: z.string().min(2, 'Class/Grade is required'),
  reporter_contact: z.string().email('Valid email is required'),
  student_name: z.string().min(3, 'Student name is required'),
  student_class: z.string().min(2, 'Student class is required'),
  student_id: z.string().optional(),
  incident_date: z.string().min(1, 'Date is required'),
  incident_time: z.string().min(1, 'Time is required'),
  location: z.string().min(3, 'Location is required'),
  incident_type: z.enum(['bullying', 'academic_dishonesty', 'behavioral_issue', 'property_damage', 'other']),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  witnesses: z.string().optional(),
  previous_incidents: z.boolean().default(false),
  immediate_actions: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high']),
});

type ReportFormData = z.infer<typeof reportSchema>;

interface StudentReportFormProps {
  onClose: () => void;
}

export function StudentReportForm({ onClose }: StudentReportFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ReportFormData>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      reporter_name: user?.fullName || '',
      reporter_contact: user?.email || '',
      incident_date: new Date().toISOString().split('T')[0],
      incident_time: new Date().toTimeString().split(' ')[0].substring(0, 5),
      incident_type: 'bullying',
      severity: 'medium',
      previous_incidents: false,
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length > 3) {
      toast.error('Maximum 3 files allowed');
      return;
    }
    
    const validFiles: File[] = [];
    
    for (const file of files) {
      // Check file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} exceeds the 5MB size limit`);
        continue;
      }
      
      // Check file type
      if (!['image/jpeg', 'image/png', 'image/gif', 'application/pdf'].includes(file.type)) {
        toast.error(`${file.name} is not a supported file type (JPG, PNG, GIF, PDF)`);
        continue;
      }
      
      validFiles.push(file);
    }
    
    setSelectedFiles(validFiles);
  };

  const onSubmit = async (data: ReportFormData) => {
    if (!user) return;
    
    setIsSubmitting(true);
    try {
      // Generate a unique report ID
      const reportId = `IR-${Date.now().toString().slice(-6)}`;
      
      // Upload files if any
      const mediaUrls: string[] = [];
      
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${reportId}-${Math.random().toString(36).substring(2)}.${fileExt}`;
          const filePath = `${user.id}/${fileName}`;
          
          const { error: uploadError } = await supabase.storage
            .from('reports')
            .upload(filePath, file);
            
          if (uploadError) throw uploadError;
          
          const { data: { publicUrl } } = supabase.storage
            .from('reports')
            .getPublicUrl(filePath);
            
          mediaUrls.push(publicUrl);
        }
      }
      
      // Create the report
      const { error } = await supabase.from('incident_reports').insert({
        report_id: reportId,
        reporter_id: user.id,
        reporter_name: data.reporter_name,
        reporter_role: user.role,
        reporter_class: data.reporter_class,
        reporter_contact: data.reporter_contact,
        student_name: data.student_name,
        student_class: data.student_class,
        student_id: data.student_id || null,
        incident_date: data.incident_date,
        incident_time: data.incident_time,
        location: data.location,
        incident_type: data.incident_type,
        description: data.description,
        witnesses: data.witnesses || null,
        previous_incidents: data.previous_incidents,
        immediate_actions: data.immediate_actions || null,
        severity: data.severity,
        media_urls: mediaUrls.length > 0 ? mediaUrls : null,
      });
      
      if (error) throw error;
      
      toast.success('Report submitted successfully');
      onClose();
    } catch (error) {
      console.error('Error submitting report:', error);
      toast.error('Failed to submit report');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Submit Incident Report</h2>
          <Button variant="ghost" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Reporter Information */}
          <div>
            <h3 className="mb-4 text-lg font-medium">Reporter Information</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Your Name</label>
                <input
                  {...register('reporter_name')}
                  className="w-full rounded-lg border p-2"
                />
                {errors.reporter_name && (
                  <p className="mt-1 text-sm text-red-500">{errors.reporter_name.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Your Class/Grade</label>
                <input
                  {...register('reporter_class')}
                  className="w-full rounded-lg border p-2"
                  placeholder="e.g., 10th Grade, Class 12B"
                />
                {errors.reporter_class && (
                  <p className="mt-1 text-sm text-red-500">{errors.reporter_class.message}</p>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium">Your Contact Email</label>
                <input
                  {...register('reporter_contact')}
                  type="email"
                  className="w-full rounded-lg border p-2"
                />
                {errors.reporter_contact && (
                  <p className="mt-1 text-sm text-red-500">{errors.reporter_contact.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Student Information */}
          <div>
            <h3 className="mb-4 text-lg font-medium">Student Information</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Student Name</label>
                <input
                  {...register('student_name')}
                  className="w-full rounded-lg border p-2"
                  placeholder="Name of student involved"
                />
                {errors.student_name && (
                  <p className="mt-1 text-sm text-red-500">{errors.student_name.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Student Class/Grade</label>
                <input
                  {...register('student_class')}
                  className="w-full rounded-lg border p-2"
                  placeholder="e.g., 10th Grade, Class 12B"
                />
                {errors.student_class && (
                  <p className="mt-1 text-sm text-red-500">{errors.student_class.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Student ID (Optional)</label>
                <input
                  {...register('student_id')}
                  className="w-full rounded-lg border p-2"
                  placeholder="Student ID if known"
                />
              </div>
            </div>
          </div>

          {/* Incident Details */}
          <div>
            <h3 className="mb-4 text-lg font-medium">Incident Details</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Date of Incident</label>
                <input
                  {...register('incident_date')}
                  type="date"
                  className="w-full rounded-lg border p-2"
                />
                {errors.incident_date && (
                  <p className="mt-1 text-sm text-red-500">{errors.incident_date.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Time of Incident</label>
                <input
                  {...register('incident_time')}
                  type="time"
                  className="w-full rounded-lg border p-2"
                />
                {errors.incident_time && (
                  <p className="mt-1 text-sm text-red-500">{errors.incident_time.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Location</label>
                <input
                  {...register('location')}
                  className="w-full rounded-lg border p-2"
                  placeholder="Where did the incident occur?"
                />
                {errors.location && (
                  <p className="mt-1 text-sm text-red-500">{errors.location.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Type of Incident</label>
                <select
                  {...register('incident_type')}
                  className="w-full rounded-lg border p-2"
                >
                  <option value="bullying">Bullying/Harassment</option>
                  <option value="academic_dishonesty">Academic Dishonesty</option>
                  <option value="behavioral_issue">Behavioral Issue</option>
                  <option value="property_damage">Property Damage</option>
                  <option value="other">Other</option>
                </select>
                {errors.incident_type && (
                  <p className="mt-1 text-sm text-red-500">{errors.incident_type.message}</p>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium">Description of Incident</label>
                <textarea
                  {...register('description')}
                  className="w-full rounded-lg border p-2"
                  rows={4}
                  placeholder="Please provide a detailed description of what happened"
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-500">{errors.description.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Witnesses (Optional)</label>
                <input
                  {...register('witnesses')}
                  className="w-full rounded-lg border p-2"
                  placeholder="Names of any witnesses"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Severity</label>
                <select
                  {...register('severity')}
                  className="w-full rounded-lg border p-2"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                {errors.severity && (
                  <p className="mt-1 text-sm text-red-500">{errors.severity.message}</p>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium">Immediate Actions Taken (Optional)</label>
                <textarea
                  {...register('immediate_actions')}
                  className="w-full rounded-lg border p-2"
                  rows={2}
                  placeholder="Describe any immediate actions that were taken"
                />
              </div>
              <div className="md:col-span-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="previous_incidents"
                    {...register('previous_incidents')}
                    className="h-4 w-4"
                  />
                  <label htmlFor="previous_incidents" className="text-sm">
                    There have been previous incidents involving this student
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Evidence Upload */}
          <div>
            <h3 className="mb-4 text-lg font-medium">Evidence (Optional)</h3>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border p-4 hover:bg-gray-50">
                <Upload className="h-5 w-5 text-gray-500" />
                <span>
                  Upload Files (Max 3 files, 5MB each, JPG/PNG/GIF/PDF)
                </span>
                <input
                  type="file"
                  className="hidden"
                  multiple
                  accept=".jpg,.jpeg,.png,.gif,.pdf"
                  onChange={handleFileSelect}
                  ref={fileInputRef}
                />
              </label>
              
              {selectedFiles.length > 0 && (
                <div className="mt-2 space-y-2">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between rounded-lg bg-gray-50 p-2">
                      <span className="text-sm">{file.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedFiles(prev => prev.filter((_, i) => i !== index));
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[44px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Report'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
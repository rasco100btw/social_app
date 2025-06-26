import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Flag, AlertCircle, CheckCircle, XCircle, Shield, Crown, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

interface Report {
  id: string;
  report_id: string;
  reporter_id: string;
  reporter_name: string;
  reporter_role: string;
  reporter_class: string;
  reporter_contact: string;
  student_name: string;
  student_class: string;
  student_id: string | null;
  incident_date: string;
  incident_time: string;
  location: string;
  incident_type: 'bullying' | 'academic_dishonesty' | 'behavioral_issue' | 'property_damage' | 'other';
  description: string;
  witnesses: string | null;
  previous_incidents: boolean;
  immediate_actions: string | null;
  severity: 'low' | 'medium' | 'high';
  status: 'pending' | 'investigating' | 'resolved';
  media_urls: string[] | null;
  admin_notes: string | null;
  created_at: string;
  reporter: {
    id: string;
    name: string;
    avatar_url: string;
  };
}

const INCIDENT_TYPES = [
  { value: 'bullying', label: 'Bullying/Harassment' },
  { value: 'academic_dishonesty', label: 'Academic Dishonesty' },
  { value: 'behavioral_issue', label: 'Behavioral Issue' },
  { value: 'property_damage', label: 'Property Damage' },
  { value: 'other', label: 'Other' }
];

export function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuthStore();

  useEffect(() => {
    if (user?.role !== 'admin') {
      window.location.href = '/';
      return;
    }

    const fetchReports = async () => {
      try {
        const { data, error } = await supabase
          .from('incident_reports')
          .select(`
            *,
            reporter:profiles!reporter_id(id, name, avatar_url)
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setReports(data || []);
      } catch (error) {
        console.error('Error fetching reports:', error);
        toast.error('Failed to load reports');
      } finally {
        setIsLoading(false);
      }
    };

    fetchReports();

    // Subscribe to new reports
    const subscription = supabase
      .channel('reports')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'incident_reports' 
      }, fetchReports)
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  const handleDeleteReport = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this report?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('incident_reports')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setReports(prev => prev.filter(report => report.id !== id));
      toast.success('Report deleted successfully');
    } catch (error) {
      console.error('Error deleting report:', error);
      toast.error('Failed to delete report');
    }
  };

  const handleUpdateStatus = async (id: string, status: Report['status']) => {
    try {
      const { error } = await supabase
        .from('incident_reports')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      setReports(prev =>
        prev.map(report =>
          report.id === id ? { ...report, status } : report
        )
      );

      toast.success(`Report marked as ${status}`);
    } catch (error) {
      console.error('Error updating report status:', error);
      toast.error('Failed to update report status');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Flag className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Reports</h1>
      </div>

      <div className="space-y-4">
        {reports.length === 0 ? (
          <div className="rounded-lg bg-white p-8 text-center shadow">
            <Flag className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-4 text-gray-600">No reports found</p>
          </div>
        ) : (
          reports.map((report) => (
            <div key={report.id} className="rounded-lg bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <img
                    src={report.reporter.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${report.reporter.name}`}
                    alt={report.reporter.name}
                    className="h-10 w-10 rounded-full"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{report.reporter.name}</p>
                      {report.reporter_role === 'student' && (
                        <GraduationCap className="h-4 w-4 text-blue-500" />
                      )}
                      {report.reporter_role === 'teacher' && (
                        <Shield className="h-4 w-4 text-blue-500" />
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {format(new Date(report.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-sm font-medium ${
                    report.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800'
                      : report.status === 'investigating'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                  </span>
                </div>
              </div>

              <div className="mb-4 rounded-lg bg-gray-50 p-4">
                <div className="mb-2">
                  <p className="font-medium">Report ID: {report.report_id}</p>
                  <p className="text-sm text-gray-600">
                    {report.incident_date} at {report.incident_time}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                    {INCIDENT_TYPES.find(t => t.value === report.incident_type)?.label}
                  </span>
                  <span className={`rounded-full px-3 py-1 text-sm font-medium ${
                    report.severity === 'low'
                      ? 'bg-green-100 text-green-800'
                      : report.severity === 'medium'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {report.severity.charAt(0).toUpperCase() + report.severity.slice(1)} Severity
                  </span>
                </div>
              </div>

              <div className="mb-4">
                <h3 className="mb-2 font-medium">Description:</h3>
                <p className="text-gray-600">{report.description}</p>
              </div>

              {report.media_urls && report.media_urls.length > 0 && (
                <div className="mb-4">
                  <h3 className="mb-2 font-medium">Evidence:</h3>
                  <div className="flex flex-wrap gap-2">
                    {report.media_urls.map((url, index) => (
                      <a
                        key={index}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Evidence #{index + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {report.status === 'pending' && (
                  <Button
                    variant="outline"
                    onClick={() => handleUpdateStatus(report.id, 'investigating')}
                  >
                    Start Investigation
                  </Button>
                )}
                {report.status === 'investigating' && (
                  <Button
                    variant="outline"
                    onClick={() => handleUpdateStatus(report.id, 'resolved')}
                  >
                    Mark as Resolved
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="text-red-600 hover:bg-red-50"
                  onClick={() => handleDeleteReport(report.id)}
                >
                  Delete Report
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
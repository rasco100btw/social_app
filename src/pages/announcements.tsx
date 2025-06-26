import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Megaphone, Plus, Edit, Trash2, Shield, Crown, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

interface Announcement {
  id: string;
  title: string;
  content: string;
  created_at: string;
  author: {
    id: string;
    name: string;
    avatar_url: string;
    role: string;
  };
}

export function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { user } = useAuthStore();

  const canPost = user?.role === 'teacher' || user?.role === 'admin';
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const { data, error } = await supabase
          .from('announcements')
          .select(`
            *,
            author:profiles(
              id,
              name,
              avatar_url,
              role
            )
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setAnnouncements(data || []);
      } catch (error) {
        console.error('Error fetching announcements:', error);
        toast.error('Failed to load announcements');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnnouncements();

    const subscription = supabase
      .channel('announcements')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, fetchAnnouncements)
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleEdit = (announcement: Announcement) => {
    setEditingId(announcement.id);
    setTitle(announcement.title);
    setContent(announcement.content);
    setShowForm(true);
    
    // On mobile, scroll to the form
    if (window.innerWidth < 768) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this announcement?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setAnnouncements(prev => prev.filter(a => a.id !== id));
      toast.success('Announcement deleted successfully');
    } catch (error) {
      console.error('Error deleting announcement:', error);
      toast.error('Failed to delete announcement');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!title.trim() || !content.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from('announcements')
          .update({
            title,
            content,
          })
          .eq('id', editingId);

        if (error) throw error;
        toast.success('Announcement updated successfully');
      } else {
        const { error } = await supabase
          .from('announcements')
          .insert({
            title,
            content,
            author_id: user.id,
          });

        if (error) throw error;
        toast.success('Announcement posted successfully');
      }

      setTitle('');
      setContent('');
      setShowForm(false);
      setEditingId(null);
    } catch (error) {
      console.error('Error with announcement:', error);
      toast.error('Failed to save announcement');
    } finally {
      setIsSubmitting(false);
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
      <div className="sticky top-16 z-10 -mx-4 bg-gray-50 px-4 py-4 md:static md:top-auto md:mx-0 md:bg-transparent md:px-0 md:py-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Megaphone className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Announcements</h1>
          </div>
          {canPost && (
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-5 w-5" />
              New
            </Button>
          )}
        </div>
      </div>

      {showForm && canPost && (
        <div className="fixed inset-0 z-50 bg-white p-4 md:relative md:inset-auto md:bg-transparent md:p-0">
          <form onSubmit={handleSubmit} className="flex h-full flex-col md:h-auto md:rounded-lg md:bg-white md:p-6 md:shadow">
            <div className="mb-4 flex items-center justify-between border-b pb-4 md:border-none md:pb-0">
              <h2 className="text-lg font-semibold">
                {editingId ? 'Edit Announcement' : 'New Announcement'}
              </h2>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setTitle('');
                  setContent('');
                }}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto">
              <div>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Announcement Title"
                  className="w-full rounded-lg border p-2"
                  required
                />
              </div>
              <div>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Announcement Content"
                  className="h-40 w-full rounded-lg border p-2 md:h-32"
                  required
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2 border-t pt-4 md:border-none md:pt-0">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setTitle('');
                  setContent('');
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !title.trim() || !content.trim()}
              >
                {editingId ? 'Update' : 'Post'} Announcement
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {announcements.length === 0 ? (
          <div className="rounded-lg bg-white p-8 text-center shadow">
            <Megaphone className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-4 text-gray-600">No announcements yet</p>
          </div>
        ) : (
          announcements.map((announcement) => (
            <div
              key={announcement.id}
              className="rounded-lg bg-white p-4 shadow-sm md:p-6"
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={announcement.author.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${announcement.author.name}`}
                    alt={announcement.author.name}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{announcement.author.name}</h3>
                      {announcement.author.role === 'teacher' && (
                        <Shield className="h-4 w-4 text-blue-500" />
                      )}
                      {announcement.author.role === 'admin' && (
                        <Crown className="h-4 w-4 text-yellow-400 drop-shadow-[0_0_2px_rgba(234,179,8,0.5)]" />
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {format(new Date(announcement.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
                {(isAdmin || announcement.author.id === user?.id) && (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => handleEdit(announcement)}
                    >
                      <Edit className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => handleDelete(announcement.id)}
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>
                )}
              </div>
              <h2 className="mb-2 text-xl font-semibold">{announcement.title}</h2>
              <p className="whitespace-pre-wrap text-gray-600">{announcement.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
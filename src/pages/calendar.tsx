import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Plus, Users, Clock, Edit, Trash2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

interface Event {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  location: string;
  teacher_id: string;
  max_attendees: number | null;
  teacher: {
    name: string;
    avatar_url: string;
  };
  current_attendees: number;
  user_attendance?: {
    status: 'pending' | 'confirmed' | 'declined';
  }[];
}

export function CalendarPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    max_attendees: ''
  });
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const isStudent = user?.role === 'student';

  useEffect(() => {
    fetchEvents();
  }, [user]);

  async function fetchEvents() {
    try {
      // First get all events
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select(`
          *,
          teacher:profiles!teacher_id(name, avatar_url)
        `)
        .order('start_time', { ascending: true });

      if (eventsError) throw eventsError;

      // Then get attendee counts for each event
      const eventsWithCounts = await Promise.all(
        (eventsData || []).map(async (event) => {
          // Get attendee count
          const { count } = await supabase
            .from('event_attendees')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', event.id);

          // Get user's attendance status if they're a student
          let userAttendance = [];
          if (isStudent) {
            const { data: attendance } = await supabase
              .from('event_attendees')
              .select('status')
              .eq('event_id', event.id)
              .eq('student_id', user?.id)
              .single();

            if (attendance) {
              userAttendance = [attendance];
            }
          }

          return {
            ...event,
            current_attendees: count || 0,
            user_attendance: userAttendance
          };
        })
      );

      setEvents(eventsWithCounts);
    } catch (error) {
      console.error('Error fetching events:', error);
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  }

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isAdmin) return;

    try {
      const { error } = await supabase.from('events').insert({
        title: newEvent.title,
        description: newEvent.description || null,
        start_time: newEvent.start_time,
        end_time: newEvent.end_time,
        teacher_id: user.id,
        max_attendees: newEvent.max_attendees ? parseInt(newEvent.max_attendees) : null
      });

      if (error) throw error;

      toast.success('Event created successfully');
      setShowCreateModal(false);
      setNewEvent({
        title: '',
        description: '',
        start_time: '',
        end_time: '',
        max_attendees: ''
      });
      fetchEvents();
    } catch (error) {
      console.error('Error creating event:', error);
      toast.error('Failed to create event');
    }
  };

  const handleEditEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent || !isAdmin) return;

    try {
      const { error } = await supabase
        .from('events')
        .update({
          title: newEvent.title,
          description: newEvent.description || null,
          start_time: newEvent.start_time,
          end_time: newEvent.end_time,
          max_attendees: newEvent.max_attendees ? parseInt(newEvent.max_attendees) : null
        })
        .eq('id', editingEvent.id);

      if (error) throw error;

      toast.success('Event updated successfully');
      setEditingEvent(null);
      setNewEvent({
        title: '',
        description: '',
        start_time: '',
        end_time: '',
        max_attendees: ''
      });
      fetchEvents();
    } catch (error) {
      console.error('Error updating event:', error);
      toast.error('Failed to update event');
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!isAdmin) return;

    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;

      toast.success('Event deleted successfully');
      fetchEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error('Failed to delete event');
    }
  };

  const handleApplyForEvent = async (eventId: string) => {
    if (!user || !isStudent) return;

    try {
      const { error } = await supabase
        .from('event_attendees')
        .insert({
          event_id: eventId,
          student_id: user.id
        });

      if (error) throw error;

      toast.success('Successfully applied for event');
      fetchEvents();
    } catch (error) {
      console.error('Error applying for event:', error);
      toast.error('Failed to apply for event');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Events</h1>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-5 w-5 mr-2" />
            Create Event
          </Button>
        )}
      </div>

      <div className="grid gap-4">
        {events.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No events scheduled</p>
        ) : (
          events.map((event) => {
            const hasApplied = event.user_attendance?.some(a => a.status === 'confirmed');
            const isFull = event.max_attendees !== null && event.current_attendees >= event.max_attendees;

            return (
              <div
                key={event.id}
                className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg">{event.title}</h3>
                    <div className="flex items-center gap-2 text-gray-500 mt-1">
                      <Clock className="h-4 w-4" />
                      <span>
                        {format(new Date(event.start_time), 'MMM d, yyyy h:mm a')} -{' '}
                        {format(new Date(event.end_time), 'h:mm a')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {event.max_attendees && (
                      <div className="flex items-center gap-2 text-gray-500">
                        <Users className="h-4 w-4" />
                        <span>{event.current_attendees}/{event.max_attendees}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <img
                        src={event.teacher.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${event.teacher.name}`}
                        alt={event.teacher.name}
                        className="h-8 w-8 rounded-full"
                      />
                      <span className="text-sm text-gray-600">{event.teacher.name}</span>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setEditingEvent(event);
                            setNewEvent({
                              title: event.title,
                              description: event.description || '',
                              start_time: event.start_time,
                              end_time: event.end_time,
                              max_attendees: event.max_attendees?.toString() || ''
                            });
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => handleDeleteEvent(event.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    {isStudent && !hasApplied && !isFull && (
                      <Button
                        onClick={() => handleApplyForEvent(event.id)}
                        className="ml-4"
                      >
                        Apply
                      </Button>
                    )}
                    {isStudent && hasApplied && (
                      <Button
                        variant="outline"
                        className="ml-4"
                        disabled
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Applied
                      </Button>
                    )}
                    {isStudent && !hasApplied && isFull && (
                      <Button
                        variant="outline"
                        className="ml-4"
                        disabled
                      >
                        Full
                      </Button>
                    )}
                  </div>
                </div>
                {event.description && (
                  <p className="mt-4 text-gray-600">{event.description}</p>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Create/Edit Event Modal */}
      {(showCreateModal || editingEvent) && isAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h2 className="text-xl font-bold mb-4">
              {editingEvent ? 'Edit Event' : 'Create New Event'}
            </h2>
            <form onSubmit={editingEvent ? handleEditEvent : handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  className="w-full rounded-lg border p-2"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  className="w-full rounded-lg border p-2"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Time</label>
                  <input
                    type="datetime-local"
                    value={newEvent.start_time}
                    onChange={(e) => setNewEvent({ ...newEvent, start_time: e.target.value })}
                    className="w-full rounded-lg border p-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Time</label>
                  <input
                    type="datetime-local"
                    value={newEvent.end_time}
                    onChange={(e) => setNewEvent({ ...newEvent, end_time: e.target.value })}
                    className="w-full rounded-lg border p-2"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Maximum Attendees</label>
                <input
                  type="number"
                  value={newEvent.max_attendees}
                  onChange={(e) => setNewEvent({ ...newEvent, max_attendees: e.target.value })}
                  className="w-full rounded-lg border p-2"
                  min="1"
                />
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingEvent(null);
                    setNewEvent({
                      title: '',
                      description: '',
                      start_time: '',
                      end_time: '',
                      max_attendees: ''
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {editingEvent ? 'Save Changes' : 'Create Event'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
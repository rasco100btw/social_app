import { useState, useEffect } from 'react';
import { Bell, Check, Settings, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';

interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  link?: string;
  read: boolean;
  created_at: string;
}

interface NotificationPreference {
  type: string;
  enabled: boolean;
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [isMarkingAllAsRead, setIsMarkingAllAsRead] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setNotifications(data || []);
        setUnreadCount(data?.filter(n => !n.read).length || 0);
      } catch (error) {
        console.error('Error fetching notifications:', error);
        toast.error('Failed to load notifications');
      }
    };

    const fetchPreferences = async () => {
      try {
        const { data, error } = await supabase
          .from('notification_preferences')
          .select('type, enabled')
          .eq('user_id', user.id);

        if (error) throw error;
        setPreferences(data || []);
      } catch (error) {
        console.error('Error fetching preferences:', error);
        toast.error('Failed to load notification preferences');
      }
    };

    fetchNotifications();
    fetchPreferences();

    // Subscribe to real-time notifications
    const subscription = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        setNotifications(prev => [payload.new as Notification, ...prev]);
        setUnreadCount(prev => prev + 1);
        toast(payload.new.title, {
          description: payload.new.content,
          action: {
            label: 'View',
            onClick: () => {
              setShowNotifications(true);
              if (payload.new.link) {
                window.location.href = payload.new.link;
              }
            }
          }
        });
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
      setUnreadCount(prev => prev - 1);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('Failed to update notification');
    }
  };

  const markAllAsRead = async () => {
    if (isMarkingAllAsRead) return;
    
    try {
      setIsMarkingAllAsRead(true);
      
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user?.id)
        .eq('read', false);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true }))
      );
      setUnreadCount(0);
      toast.success('All notifications marked as read');
      
      // On mobile, automatically close the notification panel after marking all as read
      if (window.innerWidth < 768) {
        setTimeout(() => {
          setShowNotifications(false);
        }, 500);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      toast.error('Failed to update notifications');
    } finally {
      setIsMarkingAllAsRead(false);
    }
  };

  const togglePreference = async (type: string) => {
    if (!user) return;

    try {
      const { data: existingPreference, error: fetchError } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', type)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      const newEnabled = existingPreference ? !existingPreference.enabled : true;

      if (existingPreference) {
        const { error: updateError } = await supabase
          .from('notification_preferences')
          .update({ enabled: newEnabled })
          .eq('id', existingPreference.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('notification_preferences')
          .insert({
            user_id: user.id,
            type,
            enabled: newEnabled
          });

        if (insertError) throw insertError;
      }

      setPreferences(prev =>
        prev.map(p =>
          p.type === type ? { ...p, enabled: newEnabled } : p
        )
      );

      toast.success(`${type} notifications ${newEnabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error updating preference:', error);
      toast.error('Failed to update preference');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message':
        return '💬';
      case 'connection':
        return '🤝';
      case 'comment':
        return '💭';
      case 'like':
        return '❤️';
      case 'mention':
        return '@️';
      case 'achievement':
        return '🏆';
      case 'system':
        return '📢';
      default:
        return '📢';
    }
  };

  const handleNotificationClick = () => {
    setShowNotifications(!showNotifications);
    setShowPreferences(false);
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        className="relative"
        onClick={handleNotificationClick}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">
            {unreadCount}
          </span>
        )}
      </Button>

      {showNotifications && (
        <div className="fixed inset-x-0 top-16 z-50 mx-4 rounded-lg bg-white shadow-lg md:absolute md:right-0 md:top-full md:mx-0 md:mt-2 md:w-96">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="text-lg font-semibold">Notifications</h2>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowPreferences(true);
                  setShowNotifications(false);
                }}
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNotifications(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {notifications.length > 0 ? (
            <>
              <div className="max-h-[80vh] overflow-y-auto md:max-h-96">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`flex items-start gap-3 border-b p-4 ${
                      !notification.read ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="text-2xl">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium">{notification.title}</h3>
                      <p className="text-sm text-gray-600">
                        {notification.content}
                      </p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          {new Date(notification.created_at).toLocaleDateString()}
                        </span>
                        {!notification.read && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markAsRead(notification.id)}
                            className="min-h-[44px] min-w-[44px]"
                          >
                            <Check className="mr-1 h-4 w-4" />
                            Mark as read
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {unreadCount > 0 && (
                <div className="border-t p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full min-h-[44px]"
                    onClick={markAllAsRead}
                    disabled={isMarkingAllAsRead}
                  >
                    {isMarkingAllAsRead ? 'Updating...' : 'Mark all as read'}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="p-8 text-center text-gray-500">
              No notifications yet
            </div>
          )}
        </div>
      )}

      {showPreferences && (
        <div className="fixed inset-x-0 top-16 z-50 mx-4 rounded-lg bg-white shadow-lg md:absolute md:right-0 md:top-full md:mx-0 md:mt-2 md:w-80">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="text-lg font-semibold">Notification Settings</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPreferences(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="max-h-[80vh] overflow-y-auto p-4 md:max-h-96">
            {preferences.map((preference) => (
              <div
                key={preference.type}
                className="flex items-center justify-between py-2"
              >
                <div>
                  <span className="mr-2">{getNotificationIcon(preference.type)}</span>
                  <span className="capitalize">{preference.type}</span>
                </div>
                <Button
                  variant={preference.enabled ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => togglePreference(preference.type)}
                  className="min-h-[44px] min-w-[44px]"
                >
                  {preference.enabled ? 'Enabled' : 'Disabled'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
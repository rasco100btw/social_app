import { supabase } from './supabase';
import { toast } from 'sonner';

const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000; // 1 second

interface NotificationMetrics {
  deliverySuccess: number;
  deliveryFailure: number;
  totalAttempts: number;
  averageLatency: number;
  deviceStatus: Record<string, boolean>;
}

class NotificationSystem {
  private metrics: NotificationMetrics = {
    deliverySuccess: 0,
    deliveryFailure: 0,
    totalAttempts: 0,
    averageLatency: 0,
    deviceStatus: {},
  };

  private retryQueue: Map<string, { attempts: number; notification: any }> = new Map();

  constructor() {
    // Initialize offline storage
    if (typeof window !== 'undefined') {
      this.initializeOfflineStorage();
      this.initializeServiceWorker();
    }
  }

  private async initializeServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/notification-worker.js');
        console.debug('ServiceWorker registered:', registration);
      } catch (error) {
        console.error('ServiceWorker registration failed:', error);
      }
    }
  }

  private initializeOfflineStorage() {
    window.addEventListener('online', this.processOfflineQueue.bind(this));
    window.addEventListener('offline', () => {
      console.debug('Device went offline, notifications will be queued');
    });
  }

  private async processOfflineQueue() {
    const offlineNotifications = localStorage.getItem('offlineNotifications');
    if (offlineNotifications) {
      const notifications = JSON.parse(offlineNotifications);
      localStorage.removeItem('offlineNotifications');
      
      for (const notification of notifications) {
        await this.send(notification);
      }
    }
  }

  private updateMetrics(success: boolean, latency: number) {
    this.metrics.totalAttempts++;
    if (success) {
      this.metrics.deliverySuccess++;
    } else {
      this.metrics.deliveryFailure++;
    }
    this.metrics.averageLatency = (this.metrics.averageLatency * (this.metrics.totalAttempts - 1) + latency) / this.metrics.totalAttempts;
  }

  private async retryDelivery(notificationId: string) {
    const queuedItem = this.retryQueue.get(notificationId);
    if (!queuedItem) return;

    if (queuedItem.attempts < RETRY_ATTEMPTS) {
      queuedItem.attempts++;
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * queuedItem.attempts));
      await this.send(queuedItem.notification);
    } else {
      this.retryQueue.delete(notificationId);
      console.error(`Failed to deliver notification after ${RETRY_ATTEMPTS} attempts:`, notificationId);
    }
  }

  public async send(notification: {
    userId: string;
    type: string;
    title: string;
    content: string;
    link?: string;
  }) {
    const startTime = performance.now();
    const notificationId = crypto.randomUUID();

    try {
      // Check device status and network connectivity
      if (!navigator.onLine) {
        const offlineNotifications = JSON.parse(localStorage.getItem('offlineNotifications') || '[]');
        offlineNotifications.push(notification);
        localStorage.setItem('offlineNotifications', JSON.stringify(offlineNotifications));
        return;
      }

      // Send notification
      const { error } = await supabase.rpc('create_notification', {
        p_user_id: notification.userId,
        p_type: notification.type,
        p_title: notification.title,
        p_content: notification.content,
        p_link: notification.link
      });

      if (error) throw error;

      // Update metrics
      const endTime = performance.now();
      this.updateMetrics(true, endTime - startTime);

      // Request delivery confirmation
      await this.confirmDelivery(notificationId);

      return notificationId;
    } catch (error) {
      console.error('Notification delivery failed:', error);
      
      // Add to retry queue
      this.retryQueue.set(notificationId, {
        attempts: 1,
        notification
      });

      // Update metrics
      const endTime = performance.now();
      this.updateMetrics(false, endTime - startTime);

      // Retry delivery
      await this.retryDelivery(notificationId);
    }
  }

  private async confirmDelivery(notificationId: string) {
    try {
      const { error } = await supabase
        .from('notification_delivery_status')
        .insert({
          notification_id: notificationId,
          status: 'delivered',
          delivery_time: new Date().toISOString()
        });

      if (error) throw error;
    } catch (error) {
      console.error('Failed to confirm notification delivery:', error);
    }
  }

  public getMetrics(): NotificationMetrics {
    return {
      ...this.metrics,
      successRate: (this.metrics.deliverySuccess / this.metrics.totalAttempts) * 100
    };
  }

  public async updateDeviceToken(userId: string, token: string) {
    try {
      const { error } = await supabase
        .from('user_devices')
        .upsert({
          user_id: userId,
          device_token: token,
          last_seen: new Date().toISOString()
        });

      if (error) throw error;
    } catch (error) {
      console.error('Failed to update device token:', error);
    }
  }

  public subscribe(userId: string, callback: (notification: any) => void) {
    return supabase
      .channel(`user-notifications:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      }, callback)
      .subscribe();
  }
}

export const notificationSystem = new NotificationSystem();
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { useMessageStore } from './message-store';

interface RealtimeSubscription {
  table: string;
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
  callback: (payload: any) => void;
}

class RealtimeManager {
  private channels: Map<string, RealtimeChannel> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor() {
    this.handleConnectionStatus();
  }

  private handleConnectionStatus() {
    window.addEventListener('online', () => this.reconnectAll());
    window.addEventListener('offline', () => {
      useMessageStore.getState().addMessage({
        content: 'You are offline. Changes will sync when you reconnect.',
        type: 'warning',
        position: 'bottom'
      });
    });
  }

  subscribe(subscription: RealtimeSubscription): () => void {
    const channelId = `${subscription.table}_${subscription.event}_${subscription.filter || ''}`;

    if (this.channels.has(channelId)) {
      return () => this.unsubscribe(channelId);
    }

    const channel = supabase.channel(channelId)
      .on('postgres_changes', {
        event: subscription.event,
        schema: 'public',
        table: subscription.table,
        filter: subscription.filter
      }, (payload) => {
        try {
          subscription.callback(payload);
        } catch (error) {
          console.error(`Error in subscription callback for ${channelId}:`, error);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.debug(`Subscribed to ${channelId}`);
          this.reconnectAttempts = 0;
        } else if (status === 'CLOSED') {
          this.handleDisconnect(channelId, subscription);
        }
      });

    this.channels.set(channelId, channel);
    return () => this.unsubscribe(channelId);
  }

  private async handleDisconnect(channelId: string, subscription: RealtimeSubscription) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`Failed to reconnect to ${channelId} after ${this.maxReconnectAttempts} attempts`);
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    await new Promise(resolve => setTimeout(resolve, delay));
    this.subscribe(subscription);
  }

  private unsubscribe(channelId: string) {
    const channel = this.channels.get(channelId);
    if (channel) {
      channel.unsubscribe();
      this.channels.delete(channelId);
    }
  }

  private async reconnectAll() {
    for (const [channelId, channel] of this.channels.entries()) {
      await channel.unsubscribe();
      // Resubscribe with a small delay between each to prevent overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
      channel.subscribe();
    }
    
    useMessageStore.getState().addMessage({
      content: 'Back online! Syncing changes...',
      type: 'success',
      position: 'bottom'
    });
  }

  unsubscribeAll() {
    this.channels.forEach((channel) => channel.unsubscribe());
    this.channels.clear();
  }
}

export const realtimeManager = new RealtimeManager();
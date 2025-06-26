import { createClient } from '@supabase/supabase-js';
import { useMessageStore } from './message-store';
import { useAuthStore } from '../store/auth';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Maximum number of retries for failed requests
const MAX_RETRIES = 3;
// Initial delay for retry (in milliseconds)
const INITIAL_RETRY_DELAY = 1000;

// Helper function to implement exponential backoff
const wait = (delay: number) => new Promise((resolve) => setTimeout(resolve, delay));

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'Accept': 'application/json'
    },
    fetch: async (...args) => {
      let retries = 0;
      let delay = INITIAL_RETRY_DELAY;

      while (retries < MAX_RETRIES) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

          const response = await fetch(...args, {
            signal: controller.signal,
            keepalive: true,
            ...(args[1] || {}),
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const error = await response.text();
            
            // Handle refresh token errors
            if (response.status === 400) {
              try {
                const errorData = JSON.parse(error);
                if (errorData.code === 'refresh_token_not_found') {
                  useAuthStore.getState().logout();
                  useMessageStore.getState().addMessage({
                    content: 'Your session has expired. Please sign in again.',
                    type: 'warning',
                    position: 'bottom'
                  });
                  if (!window.location.pathname.includes('/auth')) {
                    window.location.href = '/auth';
                  }
                  return response;
                }
              } catch (e) {
                // If error parsing fails, continue with normal error handling
              }
            }

            // Handle RLS policy violations
            if (response.status === 403) {
              try {
                const errorData = JSON.parse(error);
                if (errorData.code === '42501') {
                  useMessageStore.getState().addMessage({
                    content: 'You do not have permission to perform this action.',
                    type: 'error',
                    position: 'bottom'
                  });
                  throw new Error('Permission denied');
                }
              } catch (e) {
                // If error parsing fails, throw the original error
                throw new Error(`HTTP error! status: ${response.status}, details: ${error}`);
              }
            }
            
            throw new Error(`HTTP error! status: ${response.status}, details: ${error}`);
          }

          return response;
        } catch (err) {
          if (err instanceof Error) {
            // Don't retry if it's a permission error
            if (err.message === 'Permission denied') {
              throw err;
            }

            // Don't retry if it's an abort error
            if (err.name === 'AbortError') {
              useMessageStore.getState().addMessage({
                content: 'Request timeout. Please try again.',
                type: 'error',
                position: 'bottom'
              });
              throw new Error('Request timeout');
            }

            // Check if it's a network error
            if (err.message.includes('Failed to fetch') || err.message.includes('Network request failed')) {
              if (retries < MAX_RETRIES - 1) {
                useMessageStore.getState().addMessage({
                  content: 'Connection issue. Retrying...',
                  type: 'warning',
                  position: 'bottom'
                });
                await wait(delay);
                retries++;
                delay *= 2; // Exponential backoff
                continue;
              } else {
                useMessageStore.getState().addMessage({
                  content: 'Unable to connect. Please check your internet connection.',
                  type: 'error',
                  position: 'bottom'
                });
              }
            }
          }
          throw err;
        }
      }

      throw new Error('Max retries exceeded');
    }
  },
  realtime: {
    params: {
      eventsPerSecond: 2
    }
  }
});

// Helper function to check connection with timeout
export async function checkSupabaseConnection(timeout = 5000) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1)
      .single()
      .abortSignal(controller.signal);

    clearTimeout(timeoutId);

    if (error) {
      console.error('Supabase connection error:', error);
      return false;
    }

    return true;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error('Supabase connection timeout');
        return false;
      }
    }
    console.error('Supabase connection check failed:', error);
    return false;
  }
}

// Set up automatic reconnection
let reconnectTimeout: NodeJS.Timeout;

const channel = supabase.channel('system_status');

channel
  .on('system', { event: 'disconnect' }, () => {
    useMessageStore.getState().addMessage({
      content: 'Connection lost. Attempting to reconnect...',
      type: 'warning',
      position: 'bottom'
    });

    clearTimeout(reconnectTimeout);
    reconnectTimeout = setTimeout(() => {
      channel.subscribe();
    }, 1000);
  })
  .on('system', { event: 'connected' }, () => {
    useMessageStore.getState().addMessage({
      content: 'Connected successfully!',
      type: 'success',
      position: 'bottom'
    });
  })
  .subscribe();
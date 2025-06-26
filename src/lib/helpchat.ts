import { Message } from '../types';
import { toast } from 'sonner';

const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff delays in milliseconds
const MAX_RETRIES = 3;

// Queue for managing API requests
let isProcessing = false;
const requestQueue: (() => Promise<void>)[] = [];

async function processQueue() {
  if (isProcessing || requestQueue.length === 0) return;
  
  isProcessing = true;
  try {
    const nextRequest = requestQueue.shift();
    if (nextRequest) {
      await nextRequest();
    }
  } finally {
    isProcessing = false;
    if (requestQueue.length > 0) {
      processQueue();
    }
  }
}

async function makeRequest(messages: Message[], retryCount = 0): Promise<string> {
  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/helpchat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages: messages.map(m => ({ role: m.role, content: m.content })) }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get AI response');
    }

    const data = await response.json();
    return data.message;
  } catch (error: any) {
    if (error.message.includes('rate limit') && retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAYS[retryCount];
      await new Promise(resolve => setTimeout(resolve, delay));
      return makeRequest(messages, retryCount + 1);
    }
    throw error;
  }
}

export async function sendMessageToAI(messages: Message[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = async () => {
      try {
        const response = await makeRequest(messages);
        resolve(response);
      } catch (error) {
        reject(error);
      }
    };

    requestQueue.push(request);
    processQueue();
  });
}

export function saveChatHistory(messages: Message[]) {
  try {
    localStorage.setItem('helpchat-messages', JSON.stringify(messages));
  } catch (error) {
    console.error('Failed to save chat history:', error);
    toast.error('Failed to save chat history');
  }
}

export function loadChatHistory(): Message[] {
  try {
    const saved = localStorage.getItem('helpchat-messages');
    if (saved) {
      const messages = JSON.parse(saved);
      // Convert string timestamps back to Date objects
      return messages.map((m: any) => ({
        ...m,
        timestamp: new Date(m.timestamp)
      }));
    }
  } catch (error) {
    console.error('Failed to load chat history:', error);
    toast.error('Failed to load chat history');
  }
  return [];
}
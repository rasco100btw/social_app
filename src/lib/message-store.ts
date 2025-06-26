import { create } from 'zustand';

interface Message {
  id: string;
  content: string | React.ReactNode;
  position?: 'top' | 'bottom';
  type?: 'info' | 'success' | 'warning' | 'error';
}

interface MessageStore {
  messages: Message[];
  addMessage: (message: Omit<Message, 'id'>) => void;
  removeMessage: (id: string) => void;
  refreshPage: () => void;
}

export const useMessageStore = create<MessageStore>((set) => ({
  messages: [],
  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, { ...message, id: crypto.randomUUID() }],
    })),
  removeMessage: (id) =>
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== id),
    })),
  refreshPage: () => {
    window.location.reload();
  },
}));
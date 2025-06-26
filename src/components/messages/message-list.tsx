import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Send, Check, CheckCheck, Image, Film, Smile, Shield, Crown, GraduationCap, Ban } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { SharedPostPreview } from './shared-post-preview';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { useMessageStore } from '../../lib/message-store';
import { ImageViewer } from '../ui/image-viewer';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string;
  created_at: string;
  status: 'sent' | 'delivered' | 'read';
  media?: string[];
  media_type?: string[];
  link?: string;
  formatted_content?: any;
  sender: {
    name: string;
    avatar_url: string;
    role: string;
  };
}

interface SharedPost {
  id: string;
  content: string;
  media?: string[];
  author: {
    name: string;
    avatar_url: string;
  };
}

interface MessageListProps {
  recipientId: string;
}

export function MessageList({ recipientId }: MessageListProps) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [sharedPosts, setSharedPosts] = useState<Record<string, SharedPost>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isBlockedBy, setIsBlockedBy] = useState(false);
  const [recipientName, setRecipientName] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();
  const refreshPage = useMessageStore((state) => state.refreshPage);
  const seenMessages = useRef(new Set<string>());

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!user?.id || !recipientId) return;

    // Fetch recipient's name
    const fetchRecipientName = async () => {
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', recipientId)
          .single();

        if (error) throw error;
        if (profile) {
          setRecipientName(profile.name);
        }
      } catch (error) {
        console.error('Error fetching recipient name:', error);
      }
    };

    fetchRecipientName();

    const checkBlockStatus = async () => {
      try {
        const { data: blockData } = await supabase
          .from('user_blocks')
          .select('blocker_id, blocked_id')
          .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${recipientId}),and(blocker_id.eq.${recipientId},blocked_id.eq.${user.id})`)
          .maybeSingle();

        setIsBlocked(blockData?.blocker_id === user.id);
        setIsBlockedBy(blockData?.blocker_id === recipientId);
      } catch (error) {
        console.error('Error checking block status:', error);
      }
    };

    checkBlockStatus();
  }, [user, recipientId]);

  useEffect(() => {
    if (!user?.id || !recipientId) return;

    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select(`
            *,
            sender:profiles!messages_sender_id_fkey(
              name, 
              avatar_url,
              role
            )
          `)
          .or(`and(sender_id.eq.${user.id},receiver_id.eq.${recipientId}),and(sender_id.eq.${recipientId},receiver_id.eq.${user.id})`)
          .order('created_at', { ascending: true });

        if (error) throw error;

        // Filter out duplicates
        const uniqueMessages = data?.filter(msg => !seenMessages.current.has(msg.id)) || [];
        uniqueMessages.forEach(msg => seenMessages.current.add(msg.id));

        setMessages(prev => [...prev, ...uniqueMessages]);
        scrollToBottom();

        // Mark messages as read
        const unreadMessages = uniqueMessages.filter(
          msg => msg.receiver_id === user.id && msg.status !== 'read'
        );

        if (unreadMessages.length) {
          const { error: updateError } = await supabase
            .from('messages')
            .update({ status: 'read' })
            .in(
              'id',
              unreadMessages.map(msg => msg.id)
            );

          if (updateError) throw updateError;
        }

        // Fetch shared posts
        const postIds = uniqueMessages
          .filter(message => message.link?.includes('/posts/'))
          .map(message => message.link?.split('/').pop())
          .filter(Boolean);

        if (postIds.length > 0) {
          const { data: postsData } = await supabase
            .from('posts')
            .select(`
              id,
              content,
              media,
              author:profiles!posts_author_id_fkey(name, avatar_url)
            `)
            .in('id', postIds);

          if (postsData) {
            const postsMap = postsData.reduce((acc, post) => ({
              ...acc,
              [post.id]: post
            }), {});
            setSharedPosts(prev => ({ ...prev, ...postsMap }));
          }
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
        toast.error('Failed to load messages');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();

    const subscription = supabase
      .channel('messages')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'messages',
        filter: `or(sender_id.eq.${user.id},receiver_id.eq.${user.id})` 
      }, (payload) => {
        // Only add message if we haven't seen it before
        if (!seenMessages.current.has(payload.new.id)) {
          seenMessages.current.add(payload.new.id);
          setMessages(prev => [...prev, payload.new]);
          scrollToBottom();
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
      seenMessages.current.clear();
    };
  }, [user, recipientId]);

  const sendMessage = async (content: string, files?: File[]) => {
    if (!user || !recipientId) return;

    const tempId = crypto.randomUUID();
    const tempMessage: Message = {
      id: tempId,
      content,
      sender_id: user.id,
      receiver_id: recipientId,
      created_at: new Date().toISOString(),
      status: 'sent',
      sender: {
        name: user.fullName,
        avatar_url: user.avatar || '',
        role: user.role
      }
    };

    // Add message optimistically
    setMessages(prev => [...prev, tempMessage]);
    seenMessages.current.add(tempId);
    scrollToBottom();

    try {
      let mediaUrls: string[] = [];
      let mediaTypes: string[] = [];

      if (files?.length) {
        for (const file of files) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const filePath = `${user.id}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('messages')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('messages')
            .getPublicUrl(filePath);

          mediaUrls.push(publicUrl);
          mediaTypes.push(file.type.startsWith('image/') ? 'image' : 'video');
        }
      }

      const { error } = await supabase
        .from('messages')
        .insert({
          content,
          sender_id: user.id,
          receiver_id: recipientId,
          status: 'sent',
          media: mediaUrls.length ? mediaUrls : null,
          media_type: mediaTypes.length ? mediaTypes : null
        });

      if (error) throw error;
    } catch (error) {
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      seenMessages.current.delete(tempId);
      
      console.error('Error sending message:', error);
      if (error instanceof Error && error.message.includes('JWT expired')) {
        toast.error('Your session has expired. Please refresh the page.');
      } else {
        toast.error('Failed to send message');
      }
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    await sendMessage(newMessage);
    setNewMessage('');
  };

  const handleFileUpload = async () => {
    if (!selectedFiles.length) return;
    setIsUploading(true);
    
    try {
      await sendMessage(newMessage || '📎 Attachment', selectedFiles);
      setSelectedFiles([]);
      setNewMessage('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-gray-50">
      <div className="flex items-center gap-4 border-b bg-white px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">{recipientName}</span>
          {isBlocked && (
            <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              <Ban className="h-3 w-3" />
              Blocked
            </span>
          )}
          {isBlockedBy && (
            <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              <Ban className="h-3 w-3" />
              Has blocked you
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.map((message) => (
          <div
            key={message.id}
            data-message-id={message.receiver_id === user?.id ? message.id : undefined}
            className={`mb-4 flex ${
              message.sender_id === user?.id ? 'justify-end' : 'justify-start'
            }`}
          >
            <div className="max-w-[85%] md:max-w-[75%]">
              {message.sender_id !== user?.id && (
                <div className="mb-1 flex items-center gap-2 text-sm font-medium text-gray-600">
                  <img
                    src={message.sender.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${message.sender.name}`}
                    alt={message.sender.name}
                    className="h-6 w-6 rounded-full"
                  />
                  <span>{message.sender.name}</span>
                  {message.sender.role === 'student' && (
                    <GraduationCap className="h-4 w-4 text-blue-500" />
                  )}
                  {message.sender.role === 'teacher' && (
                    <Shield className="h-4 w-4 text-blue-500" />
                  )}
                  {message.sender.role === 'admin' && (
                    <Crown className="h-4 w-4 text-yellow-400" />
                  )}
                </div>
              )}
              <div
                className={`rounded-2xl px-4 py-2 ${
                  message.sender_id === user?.id
                    ? 'rounded-br-none bg-blue-600 text-white'
                    : 'rounded-bl-none bg-white'
                }`}
              >
                <p className="whitespace-pre-wrap break-words text-base leading-relaxed">
                  {message.content}
                </p>
                {message.media && message.media.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {message.media.map((url, index) => {
                      const type = message.media_type?.[index];
                      if (type === 'image') {
                        return (
                          <img
                            key={url}
                            src={url}
                            alt="Message attachment"
                            className="max-h-60 w-full cursor-pointer rounded-lg object-contain"
                            loading="lazy"
                            onClick={() => setSelectedImage(url)}
                          />
                        );
                      } else if (type === 'video') {
                        return (
                          <video
                            key={url}
                            src={url}
                            controls
                            className="max-h-60 w-full rounded-lg"
                          >
                            Your browser does not support the video tag.
                          </video>
                        );
                      }
                      return null;
                    })}
                  </div>
                )}
                {message.link?.includes('/posts/') && (
                  <SharedPostPreview
                    post={sharedPosts[message.link.split('/').pop() || '']}
                  />
                )}
                <div className="mt-1 flex items-center justify-end gap-1 text-xs opacity-75">
                  <span>{format(new Date(message.created_at), 'HH:mm')}</span>
                  {message.sender_id === user?.id && (
                    message.status === 'read' ? (
                      <CheckCheck className="h-4 w-4 text-blue-500" />
                    ) : message.status === 'delivered' ? (
                      <CheckCheck className="h-4 w-4" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {selectedImage && (
        <ImageViewer
          src={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}

      <div className="sticky bottom-0 border-t bg-white p-2">
        <div className={`flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 ${(isBlocked || isBlockedBy) ? 'opacity-50' : ''}`}>
          <div ref={emojiPickerRef} className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 rounded-full p-0"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              disabled={isBlocked || isBlockedBy}
            >
              <Smile className="h-5 w-5 text-gray-500" />
            </Button>
            {showEmojiPicker && (
              <div className="absolute bottom-full left-0 mb-2">
                <Picker
                  data={data}
                  onEmojiSelect={(emoji: any) => {
                    setNewMessage(prev => prev + emoji.native);
                    setShowEmojiPicker(false);
                  }}
                  theme="light"
                  previewPosition="none"
                />
              </div>
            )}
          </div>
          
          <label className="flex cursor-pointer items-center">
            <div className="flex h-8 items-center gap-1 rounded-full p-2 hover:bg-gray-200">
              <Image className="h-5 w-5 text-gray-500" />
              <Film className="h-5 w-5 text-gray-500" />
            </div>
            <input
              type="file"
              className="hidden"
              accept="image/*,video/*"
              onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
              ref={fileInputRef}
              multiple
              disabled={isBlocked || isBlockedBy}
            />
          </label>

          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !isUploading && handleSendMessage()}
            placeholder={isBlocked ? "You've blocked this user" : isBlockedBy ? "This user has blocked you" : "Type your message..."}
            className="flex-1 bg-transparent text-base focus:outline-none"
            disabled={isUploading || isBlocked || isBlockedBy}
          />

          <Button
            onClick={selectedFiles.length > 0 ? handleFileUpload : handleSendMessage}
            className="h-8 w-8 rounded-full p-0"
            disabled={(!newMessage.trim() && !selectedFiles.length) || isUploading || isBlocked || isBlockedBy}
          >
            {isUploading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
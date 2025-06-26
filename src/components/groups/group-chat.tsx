import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Send, Image, Film, Smile, X, Loader2, Award, Shield, GraduationCap, Crown } from 'lucide-react';
import { toast } from 'sonner';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { Button } from '../ui/button';
import { ImageViewer } from '../ui/image-viewer';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';

interface GroupMessage {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  media?: string[];
  media_type?: string[];
  sender: {
    name: string;
    avatar_url: string;
    role: string;
  };
}

interface GroupChatProps {
  groupId: string;
  groupName: string;
}

export function GroupChat({ groupId, groupName }: GroupChatProps) {
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    fetchMessages();

    // Subscribe to new messages
    const subscription = supabase
      .channel(`group-chat-${groupId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'group_messages',
        filter: `group_id=eq.${groupId}`
      }, (payload) => {
        // Fetch the complete message with sender info
        fetchMessage(payload.new.id);
      })
      .subscribe();

    // Update read status when opening the chat
    updateReadStatus();

    return () => {
      subscription.unsubscribe();
    };
  }, [groupId]);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('group_messages')
        .select(`
          *,
          sender:profiles!sender_id(
            name, 
            avatar_url,
            role
          )
        `)
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
      
      // Scroll to bottom after messages load
      setTimeout(scrollToBottom, 100);
      
      // Update read status
      updateReadStatus();
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMessage = async (messageId: string) => {
    try {
      const { data, error } = await supabase
        .from('group_messages')
        .select(`
          *,
          sender:profiles!sender_id(
            name, 
            avatar_url,
            role
          )
        `)
        .eq('id', messageId)
        .single();

      if (error) throw error;
      
      if (data) {
        setMessages(prev => [...prev, data]);
        scrollToBottom();
        
        // Update read status if the message is from someone else
        if (data.sender_id !== user?.id) {
          updateReadStatus();
        }
      }
    } catch (error) {
      console.error('Error fetching message:', error);
    }
  };

  const updateReadStatus = async () => {
    if (!user) return;
    
    try {
      await supabase.rpc('update_group_message_read_status', {
        p_group_id: groupId
      });
    } catch (error) {
      console.error('Error updating read status:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && !selectedFiles.length) return;
    if (!user) return;

    try {
      let mediaUrls: string[] = [];
      let mediaTypes: string[] = [];

      if (selectedFiles.length > 0) {
        setIsUploading(true);
        
        for (const file of selectedFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${groupId}/${Math.random()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('group_messages')
            .upload(fileName, file, {
              contentType: file.type
            });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('group_messages')
            .getPublicUrl(fileName);

          mediaUrls.push(publicUrl);
          mediaTypes.push(file.type.startsWith('image/') ? 'image' : 'video');
        }
      }

      const { error } = await supabase
        .from('group_messages')
        .insert({
          group_id: groupId,
          sender_id: user.id,
          content: newMessage.trim() || (selectedFiles.length > 0 ? '📎 Attachment' : ''),
          media: mediaUrls.length > 0 ? mediaUrls : null,
          media_type: mediaTypes.length > 0 ? mediaTypes : null
        });

      if (error) throw error;

      setNewMessage('');
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length > 4) {
      toast.error('Maximum 4 files allowed');
      return;
    }
    
    const validFiles: File[] = [];
    
    for (const file of files) {
      // Check file size (15MB limit)
      if (file.size > 15 * 1024 * 1024) {
        toast.error(`${file.name} exceeds the 15MB size limit`);
        continue;
      }
      
      // Check file type
      if (!['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/quicktime'].includes(file.type)) {
        toast.error(`${file.name} is not a supported file type (JPG, PNG, GIF, MP4, MOV)`);
        continue;
      }
      
      validFiles.push(file);
    }
    
    setSelectedFiles(validFiles);
  };

  const onEmojiSelect = (emoji: any) => {
    setNewMessage(prev => prev + emoji.native);
    setShowEmojiPicker(false);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'student':
        return <GraduationCap className="h-4 w-4 text-blue-500" />;
      case 'teacher':
        return <Shield className="h-4 w-4 text-blue-500" />;
      case 'admin':
        return <Crown className="h-4 w-4 text-yellow-400" />;
      case 'class_leader':
        return <Award className="h-4 w-4 text-blue-600" />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-gray-50">
      <div className="flex items-center justify-between border-b bg-white px-4 py-3">
        <h2 className="text-lg font-semibold">{groupName} Chat</h2>
        <div className="text-sm text-gray-500">{messages.length} messages</div>
      </div>

      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4"
        onScroll={updateReadStatus}
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-gray-500">
            <p>No messages yet</p>
            <p className="mt-2 text-sm">Be the first to send a message!</p>
          </div>
        ) : (
          messages.map((message, index) => {
            const isCurrentUser = message.sender_id === user?.id;
            const showSender = index === 0 || messages[index - 1].sender_id !== message.sender_id;
            
            return (
              <div
                key={message.id}
                className={`mb-4 flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] ${isCurrentUser ? 'order-2' : 'order-1'}`}>
                  {showSender && !isCurrentUser && (
                    <div className="mb-1 flex items-center gap-2">
                      <img
                        src={message.sender.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${message.sender.name}`}
                        alt={message.sender.name}
                        className="h-6 w-6 rounded-full"
                      />
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium">{message.sender.name}</span>
                        {getRoleIcon(message.sender.role)}
                      </div>
                    </div>
                  )}
                  
                  <div
                    className={`rounded-lg px-4 py-2 ${
                      isCurrentUser
                        ? 'rounded-br-none bg-blue-600 text-white'
                        : 'rounded-bl-none bg-white'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    
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
                    
                    <div className="mt-1 flex justify-end">
                      <span className={`text-xs ${isCurrentUser ? 'text-white opacity-75' : 'text-gray-500'}`}>
                        {format(new Date(message.created_at), 'HH:mm')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {selectedImage && (
        <ImageViewer
          src={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}

      <div className="border-t bg-white p-3">
        {selectedFiles.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {selectedFiles.map((file, index) => (
              <div key={index} className="relative rounded bg-gray-100 px-2 py-1 text-sm">
                <span className="mr-6 truncate max-w-[150px] inline-block">
                  {file.name}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
                  }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        
        <div className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-2">
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 rounded-full p-0"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              <Smile className="h-5 w-5 text-gray-500" />
            </Button>
            {showEmojiPicker && (
              <div 
                ref={emojiPickerRef}
                className="absolute bottom-full left-0 mb-2 z-10"
              >
                <Picker
                  data={data}
                  onEmojiSelect={onEmojiSelect}
                  theme="light"
                  previewPosition="none"
                />
              </div>
            )}
          </div>
          
          <label className="cursor-pointer">
            <input
              type="file"
              className="hidden"
              accept="image/*,video/mp4,video/quicktime"
              onChange={handleFileSelect}
              ref={fileInputRef}
              multiple
            />
            <div className="flex h-8 items-center gap-1 rounded-full p-2 hover:bg-gray-200">
              <Image className="h-5 w-5 text-gray-500" />
              <Film className="h-5 w-5 text-gray-500" />
            </div>
          </label>
          
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
            placeholder="Type your message..."
            className="flex-1 bg-transparent text-base focus:outline-none"
          />
          
          <Button
            onClick={handleSendMessage}
            disabled={(!newMessage.trim() && !selectedFiles.length) || isUploading}
            className="h-8 w-8 rounded-full p-0"
          >
            {isUploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
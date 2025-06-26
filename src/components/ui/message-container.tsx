import { useMessageStore } from '../../lib/message-store';
import { PersistentMessage } from './persistent-message';

export function MessageContainer() {
  const messages = useMessageStore((state) => state.messages);
  const removeMessage = useMessageStore((state) => state.removeMessage);

  return (
    <>
      {messages.map((message) => (
        <PersistentMessage
          key={message.id}
          content={message.content}
          position={message.position}
          type={message.type}
          onDismiss={() => removeMessage(message.id)}
        />
      ))}
    </>
  );
}
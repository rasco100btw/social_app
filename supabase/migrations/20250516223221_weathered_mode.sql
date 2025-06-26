-- Add function to handle message read status
CREATE OR REPLACE FUNCTION handle_message_read()
RETURNS TRIGGER AS $$
BEGIN
  -- When message is marked as read
  IF NEW.status = 'read' AND OLD.status != 'read' THEN
    -- Update unread count in notifications
    UPDATE notifications
    SET read = true
    WHERE type = 'message'
    AND user_id = NEW.receiver_id
    AND link LIKE '%' || NEW.sender_id;

    -- Notify sender that message was read
    INSERT INTO notifications (
      user_id,
      type,
      title,
      content,
      link
    )
    VALUES (
      OLD.sender_id,
      'message_read',
      'Message read',
      (SELECT name FROM profiles WHERE id = NEW.receiver_id) || ' read your message',
      '/messages?recipient=' || NEW.receiver_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for message read status
DROP TRIGGER IF EXISTS on_message_read ON messages;
CREATE TRIGGER on_message_read
  AFTER UPDATE OF status ON messages
  FOR EACH ROW
  WHEN (NEW.status = 'read' AND OLD.status != 'read')
  EXECUTE FUNCTION handle_message_read();

-- Add index to improve query performance
CREATE INDEX IF NOT EXISTS idx_messages_status_receiver
ON messages(status, receiver_id, sender_id);
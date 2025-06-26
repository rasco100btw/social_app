-- Add trigger to update message status and handle notifications
CREATE OR REPLACE FUNCTION update_message_status()
RETURNS TRIGGER AS $$
BEGIN
  -- When message is first created, set status to 'sent'
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'sent';
  -- When message is read, update status and notify sender
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'read' AND OLD.status != 'read' THEN
    -- Create notification for sender
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
      (SELECT name FROM profiles WHERE id = OLD.receiver_id) || ' read your message',
      '/messages?recipient=' || OLD.receiver_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for message status updates
DROP TRIGGER IF EXISTS message_status_trigger ON messages;
CREATE TRIGGER message_status_trigger
  BEFORE INSERT OR UPDATE OF status ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_message_status();
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
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for message read status
CREATE TRIGGER on_message_read
  AFTER UPDATE OF status ON messages
  FOR EACH ROW
  WHEN (NEW.status = 'read' AND OLD.status != 'read')
  EXECUTE FUNCTION handle_message_read();
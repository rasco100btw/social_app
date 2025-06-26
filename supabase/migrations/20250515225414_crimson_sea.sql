/*
  # Add message notifications

  1. Changes
    - Create function to handle message notifications
    - Add trigger for new messages
    - Add notification type for messages

  2. Security
    - Function is executed with security definer to ensure notifications can be created
    - Notifications inherit existing RLS policies
*/

-- Create function to handle message notifications
CREATE OR REPLACE FUNCTION handle_new_message()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert notification for the message recipient
  INSERT INTO notifications (
    user_id,
    type,
    title,
    content,
    link
  )
  SELECT
    NEW.receiver_id,
    'message',
    profiles.name || ' sent you a message',
    CASE
      WHEN NEW.media IS NOT NULL AND array_length(NEW.media, 1) > 0
      THEN 'Sent you a media message'
      ELSE substring(NEW.content, 1, 50) || CASE WHEN length(NEW.content) > 50 THEN '...' ELSE '' END
    END,
    '/messages?user=' || NEW.sender_id
  FROM profiles
  WHERE profiles.id = NEW.sender_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new messages
CREATE TRIGGER create_message_notification
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_message();

-- Add default notification preferences for messages
INSERT INTO notification_preferences (user_id, type, enabled)
SELECT 
  id as user_id,
  'message' as type,
  true as enabled
FROM profiles
WHERE NOT EXISTS (
  SELECT 1 
  FROM notification_preferences 
  WHERE notification_preferences.user_id = profiles.id 
  AND notification_preferences.type = 'message'
);
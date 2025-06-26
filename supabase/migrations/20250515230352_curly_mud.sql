-- Create function to check if user is following
CREATE OR REPLACE FUNCTION is_following(follower_id uuid, user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM followers 
    WHERE followers.follower_id = follower_id 
    AND followers.following_id = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to handle post likes notifications
CREATE OR REPLACE FUNCTION handle_new_like()
RETURNS TRIGGER AS $$
DECLARE
  post_author_id uuid;
BEGIN
  -- Get the post author id
  SELECT author_id INTO post_author_id
  FROM posts
  WHERE id = NEW.post_id;

  -- Only create notification if the liker is following the post author
  IF is_following(NEW.user_id, post_author_id) THEN
    INSERT INTO notifications (
      user_id,
      type,
      title,
      content,
      link
    )
    SELECT
      post_author_id,
      'like',
      profiles.name || ' liked your post',
      substring(posts.content, 1, 50) || CASE WHEN length(posts.content) > 50 THEN '...' ELSE '' END,
      '/posts/' || NEW.post_id
    FROM profiles, posts
    WHERE profiles.id = NEW.user_id
    AND posts.id = NEW.post_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to handle post comments notifications
CREATE OR REPLACE FUNCTION handle_new_comment()
RETURNS TRIGGER AS $$
DECLARE
  post_author_id uuid;
BEGIN
  -- Get the post author id
  SELECT author_id INTO post_author_id
  FROM posts
  WHERE id = NEW.post_id;

  -- Only create notification if the commenter is following the post author
  IF is_following(NEW.author_id, post_author_id) THEN
    INSERT INTO notifications (
      user_id,
      type,
      title,
      content,
      link
    )
    SELECT
      post_author_id,
      'comment',
      profiles.name || ' commented on your post',
      substring(NEW.content, 1, 50) || CASE WHEN length(NEW.content) > 50 THEN '...' ELSE '' END,
      '/posts/' || NEW.post_id
    FROM profiles
    WHERE profiles.id = NEW.author_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for likes and comments
CREATE TRIGGER create_like_notification
  AFTER INSERT ON likes
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_like();

CREATE TRIGGER create_comment_notification
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_comment();
DO $$ 
BEGIN
  -- Drop tables if they exist
  DROP TABLE IF EXISTS public.likes CASCADE;
  DROP TABLE IF EXISTS public.comments CASCADE;

  -- Remove columns from posts table if they exist
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'posts' 
    AND column_name = 'likes_count'
  ) THEN
    ALTER TABLE posts DROP COLUMN likes_count;
  END IF;

  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'posts' 
    AND column_name = 'comments_count'
  ) THEN
    ALTER TABLE posts DROP COLUMN comments_count;
  END IF;

  -- Drop functions if they exist
  DROP FUNCTION IF EXISTS handle_new_like() CASCADE;
  DROP FUNCTION IF EXISTS handle_new_comment() CASCADE;

  -- Clean up notifications
  DELETE FROM notifications WHERE type IN ('like', 'comment');
END $$;
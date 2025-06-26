DO $$ 
BEGIN
  -- Drop functions first since they may depend on tables
  DROP FUNCTION IF EXISTS handle_new_like() CASCADE;
  DROP FUNCTION IF EXISTS handle_new_comment() CASCADE;

  -- Drop tables if they exist
  DROP TABLE IF EXISTS public.likes CASCADE;
  DROP TABLE IF EXISTS public.comments CASCADE;

  -- Remove columns from posts table if they exist
  ALTER TABLE posts 
  DROP COLUMN IF EXISTS likes_count,
  DROP COLUMN IF EXISTS comments_count;

  -- Clean up notifications if the table exists
  IF EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'notifications'
  ) THEN
    DELETE FROM notifications WHERE type IN ('like', 'comment');
  END IF;
END $$;
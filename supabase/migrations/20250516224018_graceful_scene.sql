/*
  # Remove likes and comments functionality

  1. Changes
    - Safely remove likes and comments tables if they exist
    - Clean up related triggers and functions
    - Remove notification entries for likes and comments
    - Use DO block to safely handle table existence checks
*/

DO $$ 
BEGIN
  -- Drop likes table if it exists
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'likes') THEN
    DROP TABLE public.likes CASCADE;
  END IF;

  -- Drop comments table if it exists
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'comments') THEN
    DROP TABLE public.comments CASCADE;
  END IF;

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
  IF EXISTS (SELECT FROM pg_proc WHERE proname = 'handle_new_like') THEN
    DROP FUNCTION IF EXISTS handle_new_like() CASCADE;
  END IF;

  IF EXISTS (SELECT FROM pg_proc WHERE proname = 'handle_new_comment') THEN
    DROP FUNCTION IF EXISTS handle_new_comment() CASCADE;
  END IF;

  -- Clean up notifications
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notifications') THEN
    DELETE FROM notifications WHERE type IN ('like', 'comment');
  END IF;
END $$;
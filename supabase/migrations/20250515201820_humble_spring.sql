/*
  # Create profiles and posts schema

  1. New Tables
    - `profiles`
      - `id` (uuid, primary key)
      - `name` (text)
      - `email` (text)
      - `avatar_url` (text)
      - `role` (text)
      - `created_at` (timestamp)

    - `posts`
      - `id` (uuid, primary key)
      - `content` (text)
      - `author_id` (uuid, foreign key to profiles.id)
      - `media` (text array)
      - `created_at` (timestamp)

    - `comments`
      - `id` (uuid, primary key)
      - `content` (text)
      - `post_id` (uuid, foreign key to posts.id)
      - `author_id` (uuid, foreign key to profiles.id)
      - `created_at` (timestamp)

    - `likes`
      - `id` (uuid, primary key)
      - `post_id` (uuid, foreign key to posts.id)
      - `user_id` (uuid, foreign key to profiles.id)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to:
      - Read all profiles
      - Update their own profile
      - Create and read posts
      - Create and read comments
      - Create and delete their own likes
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  avatar_url text,
  role text NOT NULL DEFAULT 'student',
  created_at timestamptz DEFAULT now()
);

-- Create posts table with foreign key to profiles
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  author_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  media text[],
  created_at timestamptz DEFAULT now()
);

-- Create comments table with foreign keys
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Create likes table with foreign keys
CREATE TABLE IF NOT EXISTS likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Anyone can read profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Posts policies
CREATE POLICY "Anyone can read posts"
  ON posts
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create posts"
  ON posts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

-- Comments policies
CREATE POLICY "Anyone can read comments"
  ON comments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create comments"
  ON comments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

-- Likes policies
CREATE POLICY "Anyone can read likes"
  ON likes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create likes"
  ON likes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own likes"
  ON likes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
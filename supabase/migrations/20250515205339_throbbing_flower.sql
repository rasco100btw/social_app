/*
  # Create hobby management system tables

  1. New Tables
    - `hobby_categories`
      - `id` (uuid, primary key)
      - `name` (text, unique)
      - `description` (text)
      - `created_at` (timestamp)
    
    - `hobbies`
      - `id` (uuid, primary key)
      - `name` (text, unique)
      - `description` (text)
      - `category_id` (uuid, foreign key)
      - `time_commitment` (text)
      - `cost_level` (text)
      - `created_at` (timestamp)
    
    - `user_hobbies`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key)
      - `hobby_id` (uuid, foreign key)
      - `is_favorite` (boolean)
      - `priority_level` (integer)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create hobby categories table
create table public.hobby_categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  description text,
  created_at timestamptz default now()
);

alter table public.hobby_categories enable row level security;

create policy "Hobby categories are viewable by authenticated users"
  on hobby_categories for select
  to authenticated
  using (true);

-- Create hobbies table
create table public.hobbies (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  description text not null,
  category_id uuid references public.hobby_categories(id) on delete cascade,
  time_commitment text not null,
  cost_level text not null,
  created_at timestamptz default now()
);

alter table public.hobbies enable row level security;

create policy "Hobbies are viewable by authenticated users"
  on hobbies for select
  to authenticated
  using (true);

-- Create user_hobbies table
create table public.user_hobbies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  hobby_id uuid references public.hobbies(id) on delete cascade,
  is_favorite boolean default false,
  priority_level integer check (priority_level between 1 and 5),
  created_at timestamptz default now(),
  unique(user_id, hobby_id)
);

alter table public.user_hobbies enable row level security;

create policy "Users can view their own hobby selections"
  on user_hobbies for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can manage their own hobby selections"
  on user_hobbies for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Insert initial hobby categories
insert into public.hobby_categories (name, description) values
  ('Sports & Fitness', 'Physical activities and sports for health and recreation'),
  ('Arts & Crafts', 'Creative and artistic pursuits'),
  ('Music', 'Musical instruments and vocal activities'),
  ('Outdoors', 'Activities in nature and outdoor adventures'),
  ('Technology', 'Computer, programming, and digital activities'),
  ('Culinary', 'Cooking, baking, and food-related activities'),
  ('Literature', 'Reading, writing, and literary pursuits'),
  ('Games', 'Board games, video games, and recreational activities'),
  ('Collection', 'Collecting and curating items of interest'),
  ('Learning', 'Educational and skill-building activities');

-- Insert sample hobbies
insert into public.hobbies (name, description, category_id, time_commitment, cost_level) 
select 
  'Photography',
  'Capturing moments and creating visual art through photography',
  id,
  'Medium',
  'Medium'
from public.hobby_categories
where name = 'Arts & Crafts';

insert into public.hobbies (name, description, category_id, time_commitment, cost_level)
select 
  'Hiking',
  'Exploring nature trails and outdoor walking adventures',
  id,
  'Medium',
  'Low'
from public.hobby_categories
where name = 'Outdoors';

insert into public.hobbies (name, description, category_id, time_commitment, cost_level)
select 
  'Guitar',
  'Learning and playing acoustic or electric guitar',
  id,
  'High',
  'Medium'
from public.hobby_categories
where name = 'Music';
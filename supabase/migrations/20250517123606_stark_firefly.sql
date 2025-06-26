/*
  # Student Groups System
  
  1. New Tables
    - `student_groups`
      - `id` (uuid, primary key)
      - `name` (text, required)
      - `purpose` (text, required)
      - `description` (text, optional)
      - `subject_category` (text, required)
      - `logo_url` (text, optional)
      - `banner_url` (text, optional)
      - `visibility` (text, public/private)
      - `max_capacity` (integer)
      - `current_member_count` (integer)
      - `creator_id` (uuid, references profiles)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `group_membership`
      - `id` (uuid, primary key)
      - `group_id` (uuid, references student_groups)
      - `user_id` (uuid, references profiles)
      - `role` (text: member, admin, primary_admin)
      - `joined_at` (timestamptz)
    
    - `group_join_requests`
      - `id` (uuid, primary key)
      - `group_id` (uuid, references student_groups)
      - `user_id` (uuid, references profiles)
      - `academic_year` (text)
      - `major` (text)
      - `interest_statement` (text)
      - `status` (text: pending, approved, rejected)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `group_rules`
      - `id` (uuid, primary key)
      - `group_id` (uuid, references student_groups)
      - `rule_text` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for group creation, membership, and join requests
    - Add storage bucket for group media
*/

-- Create student_groups table
CREATE TABLE IF NOT EXISTS student_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  purpose text NOT NULL,
  description text,
  subject_category text NOT NULL,
  logo_url text,
  banner_url text,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  max_capacity integer,
  current_member_count integer DEFAULT 0,
  creator_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create group_membership table
CREATE TABLE IF NOT EXISTS group_membership (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES student_groups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin', 'primary_admin')),
  joined_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(group_id, user_id)
);

-- Create group_join_requests table
CREATE TABLE IF NOT EXISTS group_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES student_groups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  academic_year text,
  major text,
  interest_statement text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(group_id, user_id)
);

-- Create group_rules table
CREATE TABLE IF NOT EXISTS group_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES student_groups(id) ON DELETE CASCADE NOT NULL,
  rule_text text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE student_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_membership ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_rules ENABLE ROW LEVEL SECURITY;

-- Create policies for student_groups
CREATE POLICY "Anyone can view public groups"
  ON student_groups
  FOR SELECT
  TO authenticated
  USING (visibility = 'public' OR EXISTS (
    SELECT 1 FROM group_membership
    WHERE group_membership.group_id = student_groups.id
    AND group_membership.user_id = auth.uid()
  ));

CREATE POLICY "Students can create groups"
  ON student_groups
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = creator_id AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'student'
    )
  );

CREATE POLICY "Group admins can update their groups"
  ON student_groups
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_membership
      WHERE group_membership.group_id = student_groups.id
      AND group_membership.user_id = auth.uid()
      AND group_membership.role IN ('admin', 'primary_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_membership
      WHERE group_membership.group_id = student_groups.id
      AND group_membership.user_id = auth.uid()
      AND group_membership.role IN ('admin', 'primary_admin')
    )
  );

CREATE POLICY "Primary admins can delete their groups"
  ON student_groups
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_membership
      WHERE group_membership.group_id = student_groups.id
      AND group_membership.user_id = auth.uid()
      AND group_membership.role = 'primary_admin'
    )
  );

-- Create policies for group_membership
CREATE POLICY "Group members can view membership"
  ON group_membership
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM group_membership gm
      WHERE gm.group_id = group_membership.group_id
      AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Group admins can manage membership"
  ON group_membership
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_membership
      WHERE group_membership.group_id = group_membership.group_id
      AND group_membership.user_id = auth.uid()
      AND group_membership.role IN ('admin', 'primary_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_membership
      WHERE group_membership.group_id = group_membership.group_id
      AND group_membership.user_id = auth.uid()
      AND group_membership.role IN ('admin', 'primary_admin')
    )
  );

CREATE POLICY "Users can leave groups"
  ON group_membership
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Create policies for group_join_requests
CREATE POLICY "Students can create join requests"
  ON group_join_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'student'
    )
  );

CREATE POLICY "Users can view their own join requests"
  ON group_join_requests
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM group_membership
      WHERE group_membership.group_id = group_join_requests.group_id
      AND group_membership.user_id = auth.uid()
      AND group_membership.role IN ('admin', 'primary_admin')
    )
  );

CREATE POLICY "Group admins can manage join requests"
  ON group_join_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_membership
      WHERE group_membership.group_id = group_join_requests.group_id
      AND group_membership.user_id = auth.uid()
      AND group_membership.role IN ('admin', 'primary_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_membership
      WHERE group_membership.group_id = group_join_requests.group_id
      AND group_membership.user_id = auth.uid()
      AND group_membership.role IN ('admin', 'primary_admin')
    )
  );

-- Create policies for group_rules
CREATE POLICY "Anyone can view group rules"
  ON group_rules
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM student_groups
      WHERE student_groups.id = group_rules.group_id
      AND (
        student_groups.visibility = 'public' OR
        EXISTS (
          SELECT 1 FROM group_membership
          WHERE group_membership.group_id = group_rules.group_id
          AND group_membership.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Group admins can manage rules"
  ON group_rules
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_membership
      WHERE group_membership.group_id = group_rules.group_id
      AND group_membership.user_id = auth.uid()
      AND group_membership.role IN ('admin', 'primary_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_membership
      WHERE group_membership.group_id = group_rules.group_id
      AND group_membership.user_id = auth.uid()
      AND group_membership.role IN ('admin', 'primary_admin')
    )
  );

-- Create storage bucket for group media
INSERT INTO storage.buckets (id, name, public)
VALUES ('groups', 'groups', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies
CREATE POLICY "Group media is publicly accessible"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'groups');

CREATE POLICY "Group admins can upload media"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'groups' AND
    EXISTS (
      SELECT 1 FROM group_membership
      WHERE group_membership.group_id = (storage.foldername(name))[1]::uuid
      AND group_membership.user_id = auth.uid()
      AND group_membership.role IN ('admin', 'primary_admin')
    )
  );

-- Add updated_at triggers
CREATE TRIGGER update_student_groups_updated_at
  BEFORE UPDATE ON student_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_group_join_requests_updated_at
  BEFORE UPDATE ON group_join_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to handle group join request approval
CREATE OR REPLACE FUNCTION handle_group_join_request()
RETURNS TRIGGER AS $$
BEGIN
  -- If request is approved
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    -- Add user to group membership
    INSERT INTO group_membership (
      group_id,
      user_id,
      role
    ) VALUES (
      NEW.group_id,
      NEW.user_id,
      'member'
    );
    
    -- Increment member count
    UPDATE student_groups
    SET current_member_count = current_member_count + 1
    WHERE id = NEW.group_id;
    
    -- Create notification for the user
    INSERT INTO notifications (
      user_id,
      type,
      title,
      content,
      link
    ) VALUES (
      NEW.user_id,
      'group_join',
      'Group Join Request Approved',
      'Your request to join a group has been approved',
      '/groups/' || NEW.group_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for group join request approval
CREATE TRIGGER on_group_join_request_approval
  AFTER UPDATE OF status ON group_join_requests
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND OLD.status = 'pending')
  EXECUTE FUNCTION handle_group_join_request();

-- Create function to handle new group join requests
CREATE OR REPLACE FUNCTION handle_new_group_join_request()
RETURNS TRIGGER AS $$
DECLARE
  group_name text;
  admin_id uuid;
BEGIN
  -- Get group name
  SELECT name INTO group_name
  FROM student_groups
  WHERE id = NEW.group_id;
  
  -- Notify group admins
  FOR admin_id IN (
    SELECT user_id FROM group_membership
    WHERE group_id = NEW.group_id
    AND role IN ('admin', 'primary_admin')
  ) LOOP
    INSERT INTO notifications (
      user_id,
      type,
      title,
      content,
      link
    ) VALUES (
      admin_id,
      'group_request',
      'New Group Join Request',
      'Someone has requested to join your group: ' || group_name,
      '/groups/' || NEW.group_id || '/requests'
    );
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new group join requests
CREATE TRIGGER on_new_group_join_request
  AFTER INSERT ON group_join_requests
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_group_join_request();
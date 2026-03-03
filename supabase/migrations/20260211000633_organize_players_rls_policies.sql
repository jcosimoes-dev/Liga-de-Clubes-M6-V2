/*
  # Organize Players RLS Policies

  ## Summary
  Clean up and organize all RLS policies for the players table with clear permissions.

  ## Changes

  ### Remove Duplicate Policies
  - Remove all existing policies to start fresh

  ### Player Permissions (Normal Users)
  Players can:
  1. **SELECT** - View their own profile
  2. **INSERT** - Create their own profile (one time, on registration)
  3. **UPDATE** - Update their own profile data

  ### Admin Permissions
  Admins can:
  1. **SELECT** - View all players
  2. **INSERT** - Create new players
  3. **UPDATE** - Update any player
  4. **DELETE** - Delete players (if needed)

  ### Bootstrap Permissions
  When no admin exists in the system:
  1. **INSERT** - Allow first user to create admin profile
  2. **UPDATE** - Allow bootstrap user to update their profile to become admin

  ## Security Notes
  - All policies check `auth.uid()` for ownership
  - Admin checks use `get_current_user_role()` function to avoid RLS recursion
  - Bootstrap checks use `admin_exists()` function
  - No user can access other users' data unless they are admin
*/

-- Drop all existing policies on players table
DROP POLICY IF EXISTS "Admins can insert any player" ON players;
DROP POLICY IF EXISTS "Admins can update all players" ON players;
DROP POLICY IF EXISTS "Admins can view all players" ON players;
DROP POLICY IF EXISTS "Bootstrap: users can insert profile when no admin exists" ON players;
DROP POLICY IF EXISTS "Bootstrap: users can update profile when no admin exists" ON players;
DROP POLICY IF EXISTS "Users can create own profile" ON players;
DROP POLICY IF EXISTS "Users can insert own profile" ON players;
DROP POLICY IF EXISTS "Users can update own profile" ON players;
DROP POLICY IF EXISTS "Users can view own profile" ON players;

-- ============================================================
-- PLAYER POLICIES (Normal users managing their own profile)
-- ============================================================

CREATE POLICY "Players can view own profile"
  ON players
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Players can create own profile"
  ON players
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Players can update own profile"
  ON players
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- ADMIN POLICIES (Full access to all players)
-- ============================================================

CREATE POLICY "Admins can view all players"
  ON players
  FOR SELECT
  TO authenticated
  USING (get_current_user_role() = 'admin');

CREATE POLICY "Admins can create any player"
  ON players
  FOR INSERT
  TO authenticated
  WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Admins can update any player"
  ON players
  FOR UPDATE
  TO authenticated
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');

CREATE POLICY "Admins can delete any player"
  ON players
  FOR DELETE
  TO authenticated
  USING (get_current_user_role() = 'admin');

-- ============================================================
-- BOOTSTRAP POLICIES (First admin setup)
-- ============================================================

CREATE POLICY "Bootstrap: allow first profile creation"
  ON players
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id 
    AND NOT admin_exists()
  );

CREATE POLICY "Bootstrap: allow first profile update"
  ON players
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id 
    AND NOT admin_exists()
  )
  WITH CHECK (
    auth.uid() = user_id 
    AND NOT admin_exists()
  );

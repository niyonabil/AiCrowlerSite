


import { createClient } from '@supabase/supabase-js';

// IMPORTANT: REPLACE WITH YOUR SUPABASE PROJECT DETAILS
// You can find these in your Supabase project settings -> API
const supabaseUrl = ''; // e.g., 'https://xyz.supabase.co'
const supabaseAnonKey = ''; // This is the public 'anon' key

export const isSupabaseConfigured = () => {
    // A simple check to see if the placeholders have been replaced.
    return !supabaseUrl.includes('YOUR_SUPABASE_URL') && !supabaseAnonKey.includes('YOUR_SUPABASE_ANON_KEY');
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Ensures the 'settings' table has its required initial row.
 * This makes the app self-healing on first admin login if the setup script was missed.
 */
export const initializeSettings = async () => {
    const { data, error } = await supabase.from('settings').select('id').limit(1);
    
    // Don't worry about 'relation does not exist' error, that's handled by the health check.
    if (error && error.code !== '42P01') { 
        console.error("Error checking for settings:", error);
        return;
    }

    if (!data || data.length === 0) {
        console.log("Initializing default settings row...");
        const { error: insertError } = await supabase.from('settings').insert([{}]); 
        if (insertError) {
            console.error("Failed to initialize settings:", insertError);
        }
    }
};

/**
 * Checks if the essential database tables have been created by querying a core table.
 * @returns {Promise<'healthy' | 'uninitialized'>} The status of the database schema.
 */
export const checkDatabaseHealth = async (): Promise<'healthy' | 'uninitialized'> => {
    try {
        // We query the `users` table as it's fundamental.
        // If this query fails with "relation does not exist", the DB is not set up.
        const { error } = await supabase.from('users').select('id').limit(1);
        
        if (error && error.code === '42P01') { // 42P01 is PostgreSQL's code for "undefined_table"
            return 'uninitialized';
        }
        
        // Any other error might be a network issue, but for setup purposes, we assume it's healthy if the table exists.
        return 'healthy';
    } catch (e) {
        console.error("Unexpected error during database health check:", e);
        return 'uninitialized'; // Fail safe
    }
};


// ================================================================================
//          AI AUDITOR PRO - COMPLETE SUPABASE DATABASE SETUP SCRIPT
// ================================================================================
export const DATABASE_SETUP_SCRIPT = `
-- ================================================================================
-- INSTRUCTIONS:
-- 1. Run this entire script in your Supabase Project's SQL Editor.
-- 2. It is idempotent, meaning you can run it multiple times without causing errors.
--    It will create tables if they don't exist and safely update functions/policies.
-- ================================================================================

-- ================================================================================
-- SECTION 1: TABLE CREATION (IF NOT EXISTS)
-- ================================================================================

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    picture TEXT,
    plan TEXT DEFAULT 'free' NOT NULL,
    plan_expiry TIMESTAMPTZ,
    api_keys JSONB,
    payment_methods JSONB,
    role TEXT DEFAULT 'user' NOT NULL CHECK (role IN ('admin', 'user'))
);

CREATE TABLE IF NOT EXISTS public.properties (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    url TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.agents (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    system_prompt TEXT,
    is_default BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS public.audit_results (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    property_id BIGINT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    agent_id BIGINT REFERENCES public.agents(id) ON DELETE SET NULL,
    crawled_data JSONB,
    crawl_summary JSONB,
    robots_txt_data JSONB,
    sitemap_data JSONB,
    sitemap_summary JSONB,
    ads_txt_data JSONB,
    "timestamp" TIMESTAMPTZ DEFAULT NOW(),
    analysis_mode TEXT
);

CREATE TABLE IF NOT EXISTS public.posts (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    author_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    content TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'draft' NOT NULL CHECK (status IN ('published', 'draft'))
);

CREATE TABLE IF NOT EXISTS public.settings (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    default_api_keys JSONB,
    adsense_script TEXT,
    bank_details TEXT
);

CREATE TABLE IF NOT EXISTS public.orders (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL,
    amount BIGINT NOT NULL,
    currency TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    payment_method TEXT NOT NULL,
    provider_payment_id TEXT,
    payment_proof_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ================================================================================
-- SECTION 2: CORE FUNCTIONS & TRIGGERS
-- ================================================================================

-- This function provides a fallback name for users signing up via providers that don't supply one (e.g., private Google accounts).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, picture)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', SPLIT_PART(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'picture'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- This function is the definitive fix for the "infinite recursion" error.
-- By using SECURITY DEFINER, it can bypass RLS on the users table to safely check a user's role without causing a loop.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 'anon'; -- For anonymous visitors
  ELSE
    SELECT role INTO user_role FROM public.users WHERE id = auth.uid();
    RETURN user_role;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- Drop trigger if it exists, then create it
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ================================================================================
-- SECTION 3: STORAGE BUCKETS & POLICIES
-- ================================================================================

-- Create a bucket for payment proofs if it doesn't exist.
INSERT INTO storage.buckets (id, name, public)
SELECT 'payment-proofs', 'payment-proofs', true
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'payment-proofs');

-- Storage RLS Policies for 'payment-proofs'
DROP POLICY IF EXISTS "Allow authenticated users to upload their own proofs" ON storage.objects;
CREATE POLICY "Allow authenticated users to upload their own proofs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Allow users to view their own proofs" ON storage.objects;
CREATE POLICY "Allow users to view their own proofs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Allow admins to view all proofs" ON storage.objects;
CREATE POLICY "Allow admins to view all proofs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'payment-proofs' AND public.get_my_role() = 'admin');


-- ================================================================================
-- SECTION 4: ROW LEVEL SECURITY (RLS)
-- ================================================================================

-- Enable RLS for all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to ensure a clean slate
DROP POLICY IF EXISTS "Users can manage their own profile." ON public.users;
DROP POLICY IF EXISTS "Admins can view all user profiles." ON public.users;
DROP POLICY IF EXISTS "Users can manage their own properties." ON public.properties;
DROP POLICY IF EXISTS "Users can manage their own AI agents." ON public.agents;
DROP POLICY IF EXISTS "Users can manage their own audit results." ON public.audit_results;
DROP POLICY IF EXISTS "Users can manage their own orders." ON public.orders;
DROP POLICY IF EXISTS "Published posts are visible to everyone." ON public.posts;
DROP POLICY IF EXISTS "Admins can manage all posts." ON public.posts;
DROP POLICY IF EXISTS "Settings are visible to everyone." ON public.settings;
DROP POLICY IF EXISTS "Admins can update settings." ON public.settings;

-- POLICIES FOR 'users' TABLE
CREATE POLICY "Users can manage their own profile." ON public.users
  FOR ALL USING (auth.uid() = id);
CREATE POLICY "Admins can view all user profiles." ON public.users
  FOR SELECT USING (public.get_my_role() = 'admin');

-- POLICIES FOR DATA TABLES
CREATE POLICY "Users can manage their own properties." ON public.properties
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own AI agents." ON public.agents
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own audit results." ON public.audit_results
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own orders." ON public.orders
  FOR ALL USING (auth.uid() = user_id);

-- POLICIES FOR 'posts' TABLE (Blog)
CREATE POLICY "Published posts are visible to everyone." ON public.posts
  FOR SELECT USING (status = 'published');
CREATE POLICY "Admins can manage all posts." ON public.posts
  FOR ALL USING (public.get_my_role() = 'admin');

-- POLICIES FOR 'settings' TABLE
CREATE POLICY "Settings are visible to everyone." ON public.settings
  FOR SELECT USING (true);
CREATE POLICY "Admins can update settings." ON public.settings
  FOR UPDATE USING (public.get_my_role() = 'admin');


-- ================================================================================
-- SECTION 5: INITIAL DATA & ADMIN USER GUIDE
-- ================================================================================

-- This DO block safely creates the initial settings row only if the table is empty.
DO $$
BEGIN
   IF NOT EXISTS (SELECT 1 FROM public.settings) THEN
      INSERT INTO public.settings DEFAULT VALUES;
   END IF;
END $$;

-- ================================================================================
-- GUIDE: How to Create an Admin User
-- ================================================================================
-- 1. Sign up for an account through your application's user interface.
-- 2. After signing up and confirming your email, run the following SQL command
--    in your Supabase SQL Editor, replacing the email with your own.
--
--    UPDATE public.users
--    SET role = 'admin'
--    WHERE email = 'your-admin-email@example.com';
-- ================================================================================


-- ================================================================================
-- GUIDE: How to Configure Google Authentication & Services
-- ================================================================================
-- This guide covers setting up Google for both user login (via Supabase) and for
-- the app's features (Import from GSC, Submit to Indexing API). You can use a
-- single Google Cloud Project and OAuth Client ID for all steps.
--
-- --------------------------------------------------------------------------------
-- STEP 1: GOOGLE CLOUD PROJECT SETUP
-- --------------------------------------------------------------------------------
-- 1. Go to the Google Cloud Console: https://console.cloud.google.com
-- 2. Create a new project or select an existing one.
-- 3. Enable the required APIs:
--    - In the search bar, find and ENABLE the "Google Search Console API".
--    - In the search bar, find and ENABLE the "Indexing API".
--
-- --------------------------------------------------------------------------------
-- STEP 2: CONFIGURE OAUTH CONSENT SCREEN
-- --------------------------------------------------------------------------------
-- 1. In the Google Cloud Console, navigate to "APIs & Services" -> "OAuth consent screen".
-- 2. Choose "External" for the User Type and click "Create".
-- 3. Fill in the required application details (app name, user support email, etc.).
-- 4. On the "Scopes" page, click "Add or Remove Scopes". You need to add ALL of the
--    following scopes for all features to work correctly:
--    - .../auth/userinfo.email      (For login)
--    - .../auth/userinfo.profile     (For login)
--    - .../auth/webmasters.readonly (For importing sites from GSC)
--    - .../auth/indexing           (For submitting URLs to Google)
-- 5. Save and continue through the rest of the setup.
--
-- --------------------------------------------------------------------------------
-- STEP 3: CREATE OAUTH 2.0 CLIENT ID
-- --------------------------------------------------------------------------------
-- 1. Navigate to "APIs & Services" -> "Credentials".
-- 2. Click "+ CREATE CREDENTIALS" and select "OAuth client ID".
-- 3. For "Application type", choose "Web application".
-- 4. **CRITICAL CONFIGURATION:**
--    - **Authorized JavaScript origins**:
--      - Add the URL where your AI Auditor Pro application is running.
--      - For local development, this might be 'http://localhost:1234' (check your dev server port).
--      - For production, add your production URL (e.g., 'https://yourapp.com').
--      - THIS IS REQUIRED for "Import from Search Console" and "Submit to Google".
--
--    - **Authorized redirect URIs**:
--      - Go to your Supabase Project -> Authentication -> Providers -> Google.
--      - Copy the "Redirect URL" provided by Supabase.
--      - Come back to the Google Cloud Console and paste this URL here.
--      - THIS IS REQUIRED for Google Sign-In to work.
--
-- 5. Click "Create". A pop-up will appear with your credentials.
--
-- --------------------------------------------------------------------------------
-- STEP 4: CONFIGURE YOUR APPLICATION
-- --------------------------------------------------------------------------------
-- 1. **Configure Supabase**:
--    - From the Google Cloud pop-up, copy the "Client ID" and "Client Secret".
--    - Go back to your Supabase Google provider settings.
--    - Paste the Client ID and Client Secret into the corresponding fields and save.
--
-- 2. **Configure AI Auditor Pro**:
--    - From the Google Cloud pop-up, copy ONLY the "Client ID".
--    - Log in to your AI Auditor Pro application (as an admin or user).
--    - Go to the "Settings" page.
--    - Paste the Client ID into the "Your Google Cloud Client ID" field and save.
--
-- Your application is now fully configured for all Google-related features.
-- ================================================================================
`;

-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('works', 'assets', 'blobs_meta');

-- Check policies
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public'
AND tablename IN ('works', 'assets', 'blobs_meta');

-- Check owner_id type
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('works', 'assets', 'blobs_meta')
AND column_name = 'owner_id';

-- Close the Supabase Data API (PostgREST) on the app's tables. On Supabase,
-- tables that postgres creates in "public" are granted to anon/authenticated
-- by default privileges, so with the Data API on, the public anon key could
-- read or write them (wallet_accounts, credit_ledger, scheduler_runs, ...).
-- The app never goes through PostgREST: it connects as the table owner
-- (postgres), which RLS does not restrict (no FORCE), so its access is
-- unchanged.
--
-- 1) Row-level security on every public table this role owns, with no
--    policy: anon/authenticated see nothing even if a grant comes back.
-- 2) Revoke anon/authenticated grants on those tables and sequences, and
--    the default privileges that hand them out on future tables.
-- Skips tables owned by another role (extensions). The role steps only run
-- where the roles exist (Supabase), so a plain Postgres is unaffected.
-- Idempotent.
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND pg_get_userbyid(c.relowner) = current_user
      AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;
END $$;
--> statement-breakpoint
DO $$
DECLARE
  r text;
  t record;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      FOR t IN
        SELECT c.relname, c.relkind
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r', 'p', 'v', 'm', 'S')
          AND pg_get_userbyid(c.relowner) = current_user
      LOOP
        IF t.relkind = 'S' THEN
          EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM %I', t.relname, r);
        ELSE
          EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', t.relname, r);
        END IF;
      END LOOP;
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
    END IF;
  END LOOP;
END $$;

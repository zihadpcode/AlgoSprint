-- Prisma keeps its migration history in public._prisma_migrations. Supabase exposes the public schema through its
-- Data API, and its default privileges gave the browser roles anon and authenticated full access to that table, so
-- anyone holding the publishable key could read or rewrite migration history. Only the migration owner needs it;
-- the owner bypasses RLS, so enabling it without policies denies every other role. Plain PostgreSQL (CI, local,
-- Prisma's shadow database) has neither the roles nor, in the shadow database, the table, so each step is guarded.
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      REVOKE ALL ON public._prisma_migrations FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      REVOKE ALL ON public._prisma_migrations FROM authenticated;
    END IF;
  END IF;
END $$;

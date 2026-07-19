-- Migração aditiva e idempotente para a versão gratuita.
-- Mantém as tabelas existentes e acrescenta contas e limites por categoria.

CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  type TEXT NOT NULL DEFAULT 'outro',
  opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  include_net_worth BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS accounts_user_active_idx ON public.accounts(user_id, active);
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'accounts' AND policyname = 'own_accounts'
  ) THEN
    EXECUTE 'CREATE POLICY "own_accounts" ON public.accounts FOR ALL TO authenticated '
      || 'USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;
END $$;

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS account_id UUID;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'expenses_account_id_fkey' AND conrelid = 'public.expenses'::regclass
  ) THEN
    ALTER TABLE public.expenses
      ADD CONSTRAINT expenses_account_id_fkey
      FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS expenses_account_id_idx ON public.expenses(account_id);

CREATE TABLE IF NOT EXISTS public.category_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, category_id, year, month)
);

ALTER TABLE public.category_limits ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.category_limits TO authenticated;
GRANT ALL ON public.category_limits TO service_role;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'category_limits' AND policyname = 'own_category_limits'
  ) THEN
    EXECUTE 'CREATE POLICY "own_category_limits" ON public.category_limits FOR ALL TO authenticated '
      || 'USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;
END $$;

DO $$ BEGIN
  IF to_regprocedure('public.set_updated_at()') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_accounts_updated' AND tgrelid = 'public.accounts'::regclass
  ) THEN
    EXECUTE 'CREATE TRIGGER trg_accounts_updated BEFORE UPDATE ON public.accounts '
      || 'FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
  END IF;
  IF to_regprocedure('public.set_updated_at()') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_category_limits_updated' AND tgrelid = 'public.category_limits'::regclass
  ) THEN
    EXECUTE 'CREATE TRIGGER trg_category_limits_updated BEFORE UPDATE ON public.category_limits '
      || 'FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()';
  END IF;
END $$;

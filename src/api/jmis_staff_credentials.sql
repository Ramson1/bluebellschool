-- ---------------------------------------------------------------------------
-- Staff portal logins: a credential store that browsers CANNOT read
-- ---------------------------------------------------------------------------
-- PURPOSE
--   The Staff Accounts page can now display the password that was issued to
--   each staff member, restricted to developers (super_admin). Supabase stores
--   only a bcrypt hash of a password, which is one-way and cannot be shown, so
--   the plaintext has to be kept by us for the period the issued password is
--   still the live one.
--
--   It is deliberately NOT a column on jmis_staff. Verified against the live
--   project (BLUEBELL_SUPABASE_REF_PLACEHOLDER) with the public anon key:
--       GET  /rest/v1/jmis_staff?select=id,name      -> 206, 30 rows
--       GET  /rest/v1/jmis_staff?select=email,phone  -> 206, rows returned
--       PATCH /rest/v1/jmis_staff?id=eq.<uuid>       -> 200 (statement allowed)
--   i.e. jmis_staff is readable AND writable by any browser holding the anon
--   key (the admin, staff and student portals all rely on this today). A
--   password column there would be readable by every logged-in staff member,
--   every student and anyone on the internet who lifted the anon key out of a
--   JS bundle -- "visible only to developers" would exist in the UI only.
--
--   This table is reachable exclusively through the service-role key, which
--   never ships to the browser, via app/api/staff-accounts/credentials.
--
-- HOW TO RUN
--   Paste this whole file into the Supabase SQL Editor and press Run. The
--   application cannot execute DDL. Statements are idempotent.
--
-- POSTURE
--   Row Level Security is ENABLED and NO policy is created. With RLS on and no
--   policies, every anon/authenticated read returns zero rows and every write
--   is refused, while service_role bypasses RLS entirely. The explicit REVOKE
--   removes the table privileges Supabase grants through ALTER DEFAULT
--   PRIVILEGES, so the deny does not depend on policy evaluation alone.
--
-- LIFETIME
--   A row exists only while the recorded password is the live one. When the
--   staff member changes their own password on the staff portal (Profile page),
--   the row is deleted, so the page can never show a stale-but-valid credential
--   for a password the teacher has replaced. Accounts the staff member has
--   since changed show as "changed by staff" with no value.
--
-- ROLLBACK
--   DROP TABLE IF EXISTS public.jmis_staff_credentials;
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.jmis_staff_credentials (
  staff_id   uuid PRIMARY KEY,
  email      text,                    -- login email at issue time, for display
  password   text NOT NULL,           -- the password we issued
  set_at     timestamptz DEFAULT now(),
  set_by     text,                    -- admin/developer email that issued it
  CONSTRAINT fk_staff FOREIGN KEY (staff_id)
    REFERENCES public.jmis_staff (id) ON DELETE CASCADE
);

-- Newest-issued first when the admin page lists them.
CREATE INDEX IF NOT EXISTS idx_staff_credentials_set_at
  ON public.jmis_staff_credentials (set_at DESC);

ALTER TABLE public.jmis_staff_credentials ENABLE ROW LEVEL SECURITY;

-- Deny every client role; only the service key (which ignores RLS) may read.
REVOKE ALL ON public.jmis_staff_credentials FROM anon;
REVOKE ALL ON public.jmis_staff_credentials FROM authenticated;
REVOKE ALL ON public.jmis_staff_credentials FROM public;

-- Sanity check after running: this must return an EMPTY result, never rows.
--   curl "$SUPABASE_URL/rest/v1/jmis_staff_credentials?select=*" \
--        -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"

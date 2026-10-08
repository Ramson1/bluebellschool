-- =============================================================================
-- Bluebell chat RLS fix — restore messaging after RLS was enabled on the chat tables
-- -----------------------------------------------------------------------------
-- SYMPTOM: creating a new thread in the Messages page fails with
--   "new row violates row-level security policy for table jmis_chat_conversations"
--
-- ROOT CAUSE: bluebellschool/src/api/jmis_chat_setup.sql creates the two chat tables
-- WITHOUT Row Level Security (the chat is capability-addressed: threads are read
-- and written by anyone holding an unguessable conversation uuid, mirroring the
-- rest of the platform which reads student data with the anon key). RLS has since
-- been enabled on these tables with the default-deny posture, so every INSERT /
-- UPDATE is rejected while SELECTs silently return nothing. Live probe with the
-- anon key confirmed it: SELECT => 200, INSERT => 401 / SQLSTATE 42501.
--
-- FIX: add permissive policies for BOTH roles that actually use chat so behaviour
-- matches the original design:
--   * anon          -> parents/learners (token login, NO Supabase auth account)
--   * authenticated -> school admin (Messages page) and staff (Staff Portal chat)
-- Operations needed by src/utils/chatApi.js: SELECT, INSERT (new conversation /
-- new message), UPDATE (bump conversation.updated_at, edit/soft-delete a message),
-- DELETE (cleanup). USING/WITH CHECK true reproduces the previous no-RLS access.
--
-- Safe to re-run (drops each policy first). Run ONCE in the Supabase SQL Editor.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- jmis_chat_conversations
-- ---------------------------------------------------------------------------
ALTER TABLE public.jmis_chat_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_convo_anon_all"     ON public.jmis_chat_conversations;
DROP POLICY IF EXISTS "chat_convo_authed_all"   ON public.jmis_chat_conversations;

CREATE POLICY "chat_convo_anon_all"
  ON public.jmis_chat_conversations FOR ALL TO anon
  USING (true) WITH CHECK (true);

CREATE POLICY "chat_convo_authed_all"
  ON public.jmis_chat_conversations FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- jmis_chat_messages
-- ---------------------------------------------------------------------------
ALTER TABLE public.jmis_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_msg_anon_all"       ON public.jmis_chat_messages;
DROP POLICY IF EXISTS "chat_msg_authed_all"     ON public.jmis_chat_messages;

CREATE POLICY "chat_msg_anon_all"
  ON public.jmis_chat_messages FOR ALL TO anon
  USING (true) WITH CHECK (true);

CREATE POLICY "chat_msg_authed_all"
  ON public.jmis_chat_messages FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Verify: should list the four policies above.
-- ---------------------------------------------------------------------------
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('jmis_chat_conversations', 'jmis_chat_messages')
ORDER BY tablename, policyname;

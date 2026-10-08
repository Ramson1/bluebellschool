-- =============================================================================
-- Bluebell Parent <-> School chat (messaging)
-- -----------------------------------------------------------------------------
-- A shared chat surface used by three apps against this SAME Supabase project:
--   * Student portal  -> a parent/learner (identity = jmis_student.id)
--   * Staff portal     -> a teacher         (identity = jmis_staff.id)
--   * Admin dashboard  -> the school office (identity = jmis_userauth email)
--
-- Every conversation is a two-party thread between ONE student/parent and ONE
-- "school side" participant, which is either a specific class teacher
-- (school_type = 'teacher') or the general School Admin/Office inbox
-- (school_type = 'admin'). Scoping is enforced in the portals (a parent can
-- only start a thread with the office or their class teacher(s); a teacher only
-- with parents of students in their assigned classes; admin sees all threads).
--
-- SECURITY NOTE: parents have no Supabase Auth account (they sign in with
-- name + result token), so row-level security keyed on the message sender is
-- not achievable. This mirrors the rest of the platform, which already reads
-- student/result data with the anon key and treats the result token as the
-- capability. Messages are therefore readable by any holder of the anon key;
-- threads are addressed by unguessable uuid conversation ids. If parent auth is
-- introduced later, add RLS policies on these two tables.
--
-- IDs are stored as TEXT because jmis_student.id / jmis_staff.id types are not
-- assumed. Table names are lower_case_with_underscores per platform convention.
-- Run this once in the Supabase SQL Editor.
-- =============================================================================

DROP TABLE IF EXISTS public.jmis_chat_messages CASCADE;
DROP TABLE IF EXISTS public.jmis_chat_conversations CASCADE;

CREATE TABLE public.jmis_chat_conversations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_key          text NOT NULL UNIQUE,           -- deterministic <student>:<type>:<teacher> key
  student_id        text NOT NULL,                  -- jmis_student.id (as text)
  student_name      text NOT NULL DEFAULT '',       -- snapshot for display
  student_class     text NOT NULL DEFAULT '',       -- snapshot for display
  school_type       text NOT NULL CHECK (school_type IN ('teacher','admin')),
  teacher_staff_id  text,                            -- jmis_staff.id when school_type='teacher'
  school_label      text NOT NULL DEFAULT 'School Admin/Office', -- teacher name / office label
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.jmis_chat_messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  uuid NOT NULL REFERENCES public.jmis_chat_conversations(id) ON DELETE CASCADE,
  sender_side      text NOT NULL CHECK (sender_side IN ('student','school')),
  sender_key       text NOT NULL DEFAULT '',        -- student:<id> | staff:<id> | admin:<email>
  sender_name      text NOT NULL DEFAULT '',
  body             text NOT NULL DEFAULT '',
  attachment_url   text,
  attachment_name  text,
  attachment_mime  text,
  attachment_size  bigint,
  reply_to_id      uuid REFERENCES public.jmis_chat_messages(id) ON DELETE SET NULL,
  edited_at        timestamptz,
  deleted          boolean NOT NULL DEFAULT false,  -- soft delete -> "This message was deleted"
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS jmis_chat_messages_conv_idx
  ON public.jmis_chat_messages (conversation_id, created_at);

CREATE INDEX IF NOT EXISTS jmis_chat_conversations_student_idx
  ON public.jmis_chat_conversations (student_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS jmis_chat_conversations_teacher_idx
  ON public.jmis_chat_conversations (teacher_staff_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS jmis_chat_conversations_type_idx
  ON public.jmis_chat_conversations (school_type, updated_at DESC);

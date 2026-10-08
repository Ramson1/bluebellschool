-- bluebell_staff_assignments — null-safe uniqueness guards
--
-- OPTIONAL hardening. Run this in the Supabase SQL Editor only after you have
-- de-duplicated the existing rows (query at the bottom). Nothing in the app
-- depends on it: the admin Staff Assignments pages already prevent duplicates
-- from being created (one form-teacher seat per class, transfer on reassign),
-- so this index is defence-in-depth against direct API/SQL writes.
--
-- Why it is needed: the table's existing constraint
--   uq_staff_assignment UNIQUE (staff_id, class, subject, assignment_type, academic_session)
-- treats NULL as distinct, so `subject IS NULL` rows (assignment_type =
-- 'class_teacher', meaning "whole class") can be inserted over and over for the
-- same staff member + class. A subject teacher can also be duplicated with only
-- a spelling difference ("Mathematics" vs "maths").

-- 1) One form-teacher row per staff member per class (ignoring case/spacing).
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_class_teacher
  ON public.bluebell_staff_assignments (
    staff_id,
    lower(regexp_replace(class, '[^a-z0-9]', '', 'g'))
  )
  WHERE assignment_type = 'class_teacher';

-- 2) One subject-teacher row per staff member per normalized class + subject.
--    academic_session is deliberately left out of the key: a teacher should be
--    re-assigned per session by replacing rows, not stacked up as duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_subject_pair
  ON public.bluebell_staff_assignments (
    staff_id,
    lower(regexp_replace(class, '[^a-z0-9]', '', 'g')),
    lower(regexp_replace(subject, '[^a-z0-9]', '', 'g'))
  )
  WHERE assignment_type = 'subject_teacher';

-- 3) One form teacher per class school-wide is ENFORCED IN THE APP, not here:
--    an admin may legitimately keep a historical class_teacher row from a past
--    academic_session alongside the current one. Uncomment the block below only
--    if you want the database to allow exactly one per class per session.
-- CREATE UNIQUE INDEX IF NOT EXISTS uq_one_form_teacher_per_class
--   ON public.bluebell_staff_assignments (
--     lower(regexp_replace(class, '[^a-z0-9]', '', 'g')),
--     coalesce(academic_session, '')
--   )
--   WHERE assignment_type = 'class_teacher';

-- ---------------------------------------------------------------------------
-- Before creating the indexes, find (then delete) existing duplicates:
--
--   -- duplicate form-teacher rows
--   SELECT staff_id, lower(regexp_replace(class,'[^a-z0-9]','','g')) AS cls,
--          count(*) , array_agg(id)
--   FROM public.bluebell_staff_assignments
--   WHERE assignment_type = 'class_teacher'
--   GROUP BY 1,2 HAVING count(*) > 1;
--
--   -- duplicate subject-teacher rows
--   SELECT staff_id, lower(regexp_replace(class,'[^a-z0-9]','','g')) AS cls,
--          lower(regexp_replace(subject,'[^a-z0-9]','','g')) AS sub,
--          count(*), array_agg(id)
--   FROM public.bluebell_staff_assignments
--   WHERE assignment_type = 'subject_teacher'
--   GROUP BY 1,2,3 HAVING count(*) > 1;
--
-- Keep the newest row of each group and delete the rest, e.g.
--   DELETE FROM public.bluebell_staff_assignments WHERE id = '<id>'::uuid;

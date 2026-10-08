-- =====================================================================
-- PLATFORM EXPANSION 5/5: Student portal support columns
-- Copy and paste this ENTIRE script into the Supabase SQL Editor and RUN.
-- bluebell_student holds live data — ALTER only, never drop.
--
-- IMPORTANT: there is deliberately NO DB trigger guarding name/class/token
-- edits, because the admin dashboard (FullStudent inline edit) updates those
-- same columns through the same anon role and a trigger cannot tell admin
-- writes apart from portal writes. Identity-field immutability for students
-- is enforced in the student-portal UI (only sex/parentcontact/address/
-- email are editable there).
-- =====================================================================

-- Portal login linkage + lifecycle
ALTER TABLE bluebell_student ADD COLUMN IF NOT EXISTS auth_user_id UUID;
ALTER TABLE bluebell_student ADD COLUMN IF NOT EXISTS portal_status TEXT DEFAULT 'active'; -- 'active'|'suspended'|'blocked'

-- Extra profile fields the student may fill in the portal
ALTER TABLE bluebell_student ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE bluebell_student ADD COLUMN IF NOT EXISTS address TEXT;
-- first_login: drives the "change your password" prompt on the portal
ALTER TABLE bluebell_student ADD COLUMN IF NOT EXISTS first_login BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_bluebell_student_auth_user ON bluebell_student(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_bluebell_student_email ON bluebell_student(lower(email));
CREATE INDEX IF NOT EXISTS idx_bluebell_student_token ON bluebell_student(token);

-- ---------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------
SELECT column_name FROM information_schema.columns
WHERE table_name = 'bluebell_student'
ORDER BY column_name;

# 🚀 Quick Start: Enable Production Email Notifications

## 3-Step Setup (5 minutes)

### Step 1: Update Database (1 minute)

Open Supabase SQL Editor and run:

```sql
ALTER TABLE jmis_settings 
ADD COLUMN IF NOT EXISTS additionalEmails TEXT;
```

Then configure your recipients:

```sql
UPDATE jmis_settings 
SET 
  adminEmail = 'principal@bluebellschool.com',
  additionalEmails = 'registrar@bluebellschool.com,ict@bluebellschool.com';
```

✅ **Done!** Emails will now send to ALL addresses.

---

### Step 2: Get Gmail App Password (2 minutes)

1. Go to https://myaccount.google.com/apppasswords
2. Enable 2FA if not already enabled
3. Select "Mail" → Your device
4. Copy the 16-character password

Example: `abcd efgh ijkl mnop`

✅ **Done!** You now have your app password.

---

### Step 3: Add Environment Variables (2 minutes)

#### For Vercel:

1. Go to Vercel Dashboard → Your Project
2. Settings → Environment Variables
3. Add these:

| Name | Value |
|------|-------|
| `GMAIL_USER` | `your-email@gmail.com` |
| `GMAIL_APP_PASSWORD` | `abcdefghijklmnop` |

4. Click **Save**
5. Redeploy your project

#### For Development:

Create `.env.local`:
```env
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=abcdefghijklmnop
```

✅ **Done!** Production is ready.

---

## 🎉 That's It!

Your email system now works in production and sends to all configured recipients!

### What Happens Now:

✅ Every exam submission triggers an email  
✅ Every result update sends notification  
✅ All recipients receive emails simultaneously  
✅ Works in both development and production  

---

## 🧪 Test It

1. Take a practice CBT test
2. Submit the exam
3. Check recipient inboxes
4. Verify all emails received

---

## 📧 Recipients Format

In database, use comma-separated format:
```
email1@school.com,email2@school.com,email3@school.com
```

No spaces needed (system handles trimming automatically).

---

## 🆘 Troubleshooting

**No emails received?**
- Check spam folder
- Verify environment variables in Vercel
- Check Vercel function logs

**Authentication error?**
- Regenerate app password
- Update environment variables
- Redeploy

**Still not working?**
- Read `EMAIL_NOTIFICATION_SETUP.md` for detailed guide

---

**Created**: 2026-01-27  
**Setup Time**: 5 minutes  
**Status**: ✅ Production Ready

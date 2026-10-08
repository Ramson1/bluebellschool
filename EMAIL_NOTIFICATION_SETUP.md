# Email Notification Setup Guide - Production Ready

## 📧 Overview

The email notification system has been enhanced to work in **both development and production** environments. Emails are now sent automatically for:

✅ Every new result saved (when a student writes an exam)  
✅ Every result update (when results are modified)  
✅ All configured email recipients (not just admin)

## 🔧 What Was Changed

### 1. Enhanced Email Service (`src/api/emailNotificationService.js`)

**New Features:**
- ✅ Support for multiple email recipients
- ✅ Reads from `bluebell_settings` table (adminEmail + additionalEmails columns)
- ✅ Better error handling and logging
- ✅ Works with API routes (production-compatible)

**Changes:**
```javascript
// NEW: Gets ALL recipients from database
const getEmailRecipients = async (supabase) => {
  // Returns array of all configured emails
}

// UPDATED: Sends to all recipients
const sendEmailNotification = async (supabase, subject, message, recipients) => {
  // Automatically gets all recipients if none specified
  // Supports both single email and array of emails
}
```

### 2. Enhanced QuizComponent (`src/pages_components/QuizComponent.jsx`)

**Email Content Improvements:**
- 📊 Detailed student information
- 📈 Complete exam statistics
- ⏰ Timestamp with date and time
- 🎨 Better formatting with emoji icons

**Email Triggers:**
- ✅ After successful INSERT (new result)
- ✅ After successful UPDATE (modified result)
- ✅ After retry save (network recovery)

## 📋 Database Setup

Run this SQL in your Supabase SQL Editor to add support for multiple recipients:

```sql
-- Add column for additional email recipients
ALTER TABLE bluebell_settings 
ADD COLUMN IF NOT EXISTS additionalEmails TEXT;

-- Add comment
COMMENT ON COLUMN bluebell_settings.additionalEmails IS 'Comma-separated list of additional email addresses to receive notifications';
```

## ⚙️ Configuration Steps

### Step 1: Configure Email Recipients in Database

After adding the `additionalEmails` column, update your settings:

```sql
-- Update with multiple email addresses (comma-separated)
UPDATE bluebell_settings 
SET 
  adminEmail = 'principal@school.com',
  additionalEmails = 'registrar@school.com,ict@school.com,exams@school.com';
```

Or use the Supabase Table Editor:
1. Go to `bluebell_settings` table
2. Edit the row
3. In `adminEmail`: Enter primary email
4. In `additionalEmails`: Enter comma-separated list (e.g., `email1@school.com,email2@school.com`)

### Step 2: Set Up Gmail App Password

If you haven't already:

1. **Enable 2FA** on your Google Account
2. **Generate App Password**:
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and your device
   - Copy the 16-character password
   
3. **Store securely** - you'll need this for environment variables

### Step 3: Configure Environment Variables

#### For Development (`.env.local`):

Create or update `.env.local` in your project root:

```env
# Gmail SMTP Configuration
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-char-app-password

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

#### For Production (Vercel):

1. Go to your Vercel Dashboard
2. Select your project
3. Navigate to **Settings** → **Environment Variables**
4. Add each variable:

| Variable Name | Value | Example |
|--------------|-------|---------|
| `GMAIL_USER` | Your Gmail address | `bluebellschool@gmail.com` |
| `GMAIL_APP_PASSWORD` | 16-char app password | `abcd efgh ijkl mnop` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL | `https://xyz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | `eyJhbG...` |

5. Click **Save**

#### For Other Hosting Platforms:

- **Netlify**: Site Settings → Build & Deploy → Environment
- **Railway**: Project → Variables
- **Heroku**: Settings → Config Vars
- **AWS Amplify**: App Settings → Environment variables

## 🚀 How It Works

### Email Flow Diagram

```
Student Submits Exam
        ↓
Calculate Score
        ↓
Save to Database (bluebell_result)
        ↓
Success? → Send Email Notification
        ↓
┌─────────────────────────────────┐
│ Email Recipients (from DB):     │
│ - adminEmail                    │
│ - additionalEmails[0]           │
│ - additionalEmails[1]           │
│ - ...                           │
└─────────────────────────────────┘
        ↓
API Route (/api/send-email)
        ↓
Nodemailer + Gmail SMTP
        ↓
✅ Delivered to all recipients
```

### Code Flow

```javascript
// 1. Student submits exam
await uploadResults();

// 2. Save to database
const success = await saveResultToDatabase(resultData);

// 3. If successful, send email
if (success) {
  await sendResultEmail(); // ← Triggers email to ALL recipients
}

// 4. Email service gets all recipients
const recipients = await getEmailRecipients(supabase);
// Returns: ['admin@school.com', 'principal@school.com', 'ict@school.com']

// 5. Send via API route
await fetch('/api/send-email', {
  method: 'POST',
  body: JSON.stringify({
    subject: '📊 CBT Exam Result...',
    message: 'Detailed email content...',
    recipients: ['all', 'emails', 'here']
  })
});
```

## 📨 Email Content Example

When a student submits an exam, recipients receive:

```
Subject: 📊 CBT Mid-term Test Result Submitted - John Doe

A CBT result has been submitted:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 STUDENT INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Student Name: John Doe
Class: JSS 1
Term: 1st Term
Subject: Mathematics

📈 EXAM DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Type: Mid-term Test
Purpose: midterm
Total Questions: 30
Correct Answers: 25
Score Obtained: 25/30
Percentage: 83.33%
Grade: A

⏰ TIMESTAMP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Date: 1/27/2026
Time: 10:30:45 AM

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This is an automated notification from 
Bluebell International School
CBT Examination System
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 🧪 Testing

### Test in Development:

1. Start your dev server: `npm run dev`
2. Take a practice CBT test
3. Submit the exam
4. Check console logs for: `✅ Email sent successfully to: ...`
5. Verify email received in inbox

### Test in Production:

1. Deploy to Vercel/production
2. Ensure environment variables are set
3. Take a real exam
4. Submit
5. Check all recipient inboxes

### Debug Commands:

Check browser console for these logs:
- `📧 Sending email to: ...` ← Shows recipients
- `✅ Email sent successfully` ← Confirms delivery
- `❌ Error sending email: ...` ← Shows errors

## 🐛 Troubleshooting

### Issue: "No email recipients configured"

**Solution:**
1. Check `bluebell_settings` table has `adminEmail` value
2. Run SQL migration to add `additionalEmails` column
3. Add at least one email address

### Issue: Emails work in dev but not production

**Solution:**
1. Verify environment variables in Vercel/hosting dashboard
2. Check `GMAIL_APP_PASSWORD` is correct (16 chars, no spaces)
3. Ensure Gmail account has 2FA enabled
4. Check Vercel function logs for errors

### Issue: "Authentication failed"

**Solution:**
1. Regenerate Gmail App Password
2. Update environment variables
3. Redeploy application
4. Wait 5 minutes for changes to propagate

### Issue: Emails going to spam

**Solution:**
1. Use a professional domain email (not @gmail.com)
2. Add SPF/DKIM records to your domain DNS
3. Consider using SendGrid, Mailgun, or AWS SES for production

## 📊 Monitoring

### Check Email Logs:

**Browser Console (Development):**
- Open DevTools → Console tab
- Look for email-related logs

**Server Logs (Production - Vercel):**
1. Go to Vercel Dashboard
2. Select project
3. Click **Functions** tab
4. Select `/api/send-email` function
5. View execution logs

### Track Email Delivery:

The system logs Message ID for each email:
```javascript
console.log('📨 Message ID:', result.messageId);
```

Save these IDs to track specific emails in Gmail logs.

## 🔒 Security Best Practices

✅ **Never commit `.env.local`** to Git (it's in .gitignore)  
✅ **Use App Passwords**, not regular Gmail passwords  
✅ **Rotate passwords** periodically  
✅ **Limit recipient access** to authorized personnel only  
✅ **Monitor usage** for unusual activity  

## 🎯 Production Checklist

Before going live:

- [ ] Run SQL migration to add `additionalEmails` column
- [ ] Configure all email recipients in `bluebell_settings`
- [ ] Set up Gmail App Password
- [ ] Add environment variables to production hosting
- [ ] Test email sending in staging environment
- [ ] Verify all recipients receive emails
- [ ] Check spam folder and adjust if needed
- [ ] Monitor first few production exams
- [ ] Document email recipients in admin handbook

## 📞 Support

If you encounter issues:

1. Check browser console for errors
2. Review server logs in hosting dashboard
3. Verify environment variables are set correctly
4. Test with a single recipient first
5. Check Gmail account security settings

---

**Updated**: 2026-01-27  
**Version**: 2.0 (Production Ready)  
**Status**: ✅ Ready for Deployment

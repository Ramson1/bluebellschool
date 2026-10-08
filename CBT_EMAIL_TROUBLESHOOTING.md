# 🔍 CBT Email Notification Troubleshooting Guide

## Issue: Not receiving emails for CBT CRUD operations

### Recent Changes Made ✅
I've updated the CBT Questions component with better error handling:
- Email errors now show warning toasts
- Console logs added for debugging
- Try-catch blocks prevent email errors from breaking the main operation

---

## Step-by-Step Debugging

### Step 1: Open Browser Console
1. Press `F12` or right-click → Inspect
2. Go to **Console** tab
3. Clear console (trash icon)

### Step 2: Test CBT Operations
1. Add a new CBT question (manual option)
2. Check console for these logs:

#### ✅ If Email is Working:
```
📧 [CBT Create] Sending email notification...
📧 Sending email to: admin@school.com
📧 Subject: New CBT Question Added
📧 Message length: 245
📧 API Response status: 200
📧 API Response: {message: "Email sent successfully", messageId: "..."}
✅ Email sent successfully to: admin@school.com
📨 Message ID: <...>
✅ [CBT Create] Email sent successfully
```

#### ❌ If No Recipients Configured:
```
⚠️ No email recipients configured in bluebell_settings
❌ [CBT Create] Email failed: No email recipients configured
```
**Solution**: See "Fix 1" below

#### ❌ If API Route Fails:
```
📧 [CBT Create] Sending email notification...
📧 Sending email to: admin@school.com
📧 API Response status: 500
📧 API Response: {error: "Email service not configured..."}
❌ [CBT Create] Email failed: Email service not configured
```
**Solution**: See "Fix 2" below

---

## Common Fixes

### Fix 1: Configure Email Recipients in Database

The email system needs recipients configured in the `bluebell_settings` table.

#### Option A: Using Supabase Dashboard
1. Go to your Supabase project
2. Open **Table Editor**
3. Select `bluebell_settings` table
4. Make sure these columns have values:
   - `adminEmail` (required) - e.g., `your-email@gmail.com`
   - `additionalEmails` (optional) - e.g., `person1@gmail.com,person2@gmail.com`

#### Option B: Using SQL
Run this in Supabase **SQL Editor**:

```sql
-- Check current settings
SELECT adminEmail, additionalEmails 
FROM bluebell_settings 
LIMIT 1;

-- Update with your email addresses
UPDATE bluebell_settings 
SET 
  adminEmail = 'your-email@gmail.com',
  additionalEmails = 'person1@gmail.com,person2@gmail.com'
WHERE id IS NOT NULL;

-- Verify the update
SELECT adminEmail, additionalEmails 
FROM bluebell_settings 
LIMIT 1;
```

### Fix 2: Configure Gmail Credentials (Environment Variables)

The email service needs Gmail SMTP credentials.

#### For Local Development:
1. Create `.env.local` file in project root (if not exists)
2. Add these variables:
```env
GMAIL_USER=your-gmail-account@gmail.com
GMAIL_APP_PASSWORD=your-16-character-app-password
```

#### For Production (Vercel):
1. Go to Vercel Dashboard → Your Project
2. Go to **Settings** → **Environment Variables**
3. Add:
   - `GMAIL_USER` = your-gmail-account@gmail.com
   - `GMAIL_APP_PASSWORD` = your-app-password
4. Redeploy the application

#### How to Get Gmail App Password:
1. Go to your Google Account: https://myaccount.google.com/
2. Select **Security**
3. Enable **2-Step Verification** (if not already enabled)
4. Go to **App Passwords**
5. Select **Mail** and your device
6. Click **Generate**
7. Copy the 16-character password (no spaces)

### Fix 3: Check API Route is Working

Test the email API directly:

```bash
# In browser console, run:
fetch('/api/send-email', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    subject: 'Test Email',
    message: 'This is a test email from CBT system',
    recipients: ['your-email@gmail.com']
  })
}).then(r => r.json()).then(console.log);
```

Expected response:
```javascript
{
  message: "Email sent successfully",
  messageId: "<...>"
}
```

---

## What to Look For

### Console Logs (Browser)
After my updates, you should see:
- `📧 [CBT Create]` - When adding questions
- `📧 [CBT Update]` - When editing questions  
- `📧 [CBT Delete]` - When deleting questions
- `✅` - Success indicators
- `❌` - Error indicators

### Toast Notifications
- Green toast: Operation successful, email sent
- Yellow/Orange toast: Operation successful, but email failed
- Red toast: Operation failed

---

## Quick Test Checklist

- [ ] Browser console shows `📧 [CBT Create] Sending email notification...`
- [ ] Console shows `📧 Sending email to: ...` (with email addresses)
- [ ] No console errors about "No email recipients configured"
- [ ] No console errors about "Email service not configured"
- [ ] API response status is 200 (not 400 or 500)
- [ ] Gmail credentials are set in environment variables
- [ ] `bluebell_settings` table has `adminEmail` value
- [ ] Check spam/junk folder in Gmail

---

## Still Not Working?

### Check Server Logs (Production)
1. Go to Vercel Dashboard
2. Select your project
3. Click **Functions** tab
4. Select `/api/send-email` function
5. View execution logs for errors

### Common Errors:
- `Authentication failed` → Wrong Gmail app password
- `No recipients configured` → Database settings empty
- `ETIMEDOUT` → Network/firewall issue
- `Invalid login` → Gmail credentials incorrect

### Get Help:
Share these console logs:
1. The full error message from console
2. The API response (if any)
3. Whether you see "No email recipients configured" warning

---

## Summary of Changes Made

Updated files:
- `src/pages_components/CbtQuestions.jsx` - Added better error handling and logging
- Email will now show warning toast if it fails
- Console logs will help identify the exact issue

The email notifications were already implemented, but errors were being silently caught. Now you'll see exactly what's going wrong!

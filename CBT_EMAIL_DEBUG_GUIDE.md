# 📧 CBT Email Notification Debugging Guide

## Issue Report
**Problem**: Not receiving emails when students submit CBT exams

## Current Implementation Status

### ✅ Email System is Configured
The email notification system has been properly implemented with:

1. **Email Service**: `src/api/emailNotificationService.js` - Handles sending emails via API
2. **API Route**: `app/api/send-email/route.ts` - Uses Nodemailer with Gmail SMTP
3. **Component Integration**: `QuizComponent.jsx` - Calls email service after exam submission

### 📋 Email Recipients
Currently configured to send to:
- `rhemaexpertsolutions@gmail.com`
- `onyevid@gmail.com`

## Email Flow

```
Student Clicks "Submit Exam"
        ↓
handleSubmitExam() called
        ↓
uploadResults() executed
        ↓
Save to Database (jmis_result)
        ↓
Success? → sendResultEmail()
        ↓
sendEmailNotification(supabase, subject, message, recipients)
        ↓
API Route (/api/send-email)
        ↓
Nodemailer + Gmail SMTP
        ↓
✅ Email Delivered
```

## Enhanced Logging

I've added comprehensive console logging to help debug the issue:

### Upload Results Logs:
- `📝 [UploadResults] Starting upload process...`
- `📊 [UploadResults] Result data prepared`
- `💾 [UploadResults] Database save result: SUCCESS/FAILED`
- `📧 [UploadResults] Sending email notification...`
- `✅ [UploadResults] Upload complete`

### Send Email Logs:
- `📧 [SendResultEmail] Starting email process...`
- `📨 [SendResultEmail] Recipients`
- `📄 [SendResultEmail] Subject`
- `📤 [SendResultEmail] Calling sendEmailNotification...`
- `✅ [SendResultEmail] Email sent successfully`

## How to Debug

### Step 1: Open Browser Console
1. Press `F12` or right-click → Inspect
2. Go to **Console** tab
3. Clear console (trash icon)

### Step 2: Take a CBT Exam
1. Fill in student details
2. Answer questions
3. Click "Submit Exam"

### Step 3: Check Console Logs
Look for these indicators:

#### ✅ If Email is Working:
```
📝 [UploadResults] Starting upload process...
📊 [UploadResults] Result data prepared: {...}
💾 [UploadResults] Database save result: SUCCESS
📧 [UploadResults] Sending email notification...
📧 [SendResultEmail] Starting email process...
📨 [SendResultEmail] Recipients: rhemaexpertsolutions@gmail.com, onyevid@gmail.com
📤 [SendResultEmail] Calling sendEmailNotification...
✅ [SendResultEmail] Email sent successfully to: rhemaexpertsolutions@gmail.com, onyevid@gmail.com
✅ [UploadResults] Upload complete
```

#### ❌ If Database Save Fails:
```
📝 [UploadResults] Starting upload process...
📊 [UploadResults] Result data prepared: {...}
💾 [UploadResults] Database save result: FAILED
❌ [UploadResults] Save failed, setting pending result
```
**Action**: Check network connection, database connectivity

#### ❌ If Email Service Fails:
```
💾 [UploadResults] Database save result: SUCCESS
📧 [UploadResults] Sending email notification...
📧 [SendResultEmail] Starting email process...
📤 [SendResultEmail] Calling sendEmailNotification...
❌ [SendResultEmail] Email error: [error message]
```
**Action**: Check environment variables, API route, Gmail credentials

## Common Issues & Solutions

### Issue 1: No Console Logs Appear
**Cause**: Exam might be in practice mode
**Solution**: 
- Check if `purpose === 'practice'`
- Practice tests don't send emails (by design)
- Use "Midterm", "Test", or "Exam" purpose instead

### Issue 2: Database Save Fails
**Possible Causes**:
- Student not found in `jmis_student` table
- Network connectivity issues
- Database permissions

**Solutions**:
1. Verify student exists in database with exact name and class
2. Check internet connection
3. Check Supabase console for errors

### Issue 3: Email Save Succeeds But No Email Sent
**Possible Causes**:
- Missing environment variables
- Invalid Gmail credentials
- API route not working

**Check Environment Variables** (`.env.local`):
```env
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-char-app-password
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Issue 4: Gmail App Password Issues
**Solution**:
1. Go to Google Account Settings
2. Security → 2-Step Verification
3. App Passwords
4. Generate new password for "Mail"
5. Update `.env.local` with new password
6. Restart development server

### Issue 5: API Route Errors
**Check Server Logs**:
```bash
# In terminal where dev server is running
# Look for errors related to /api/send-email
```

**Common API Errors**:
- `Error: Invalid login` → Check Gmail credentials
- `Error: ETIMEDOUT` → Network/firewall issue
- `Error: ECONNREFUSED` → SMTP server unreachable

## Testing Checklist

- [ ] Open browser console (F12)
- [ ] Navigate to CBT exam page
- [ ] Start an exam (NOT practice mode)
- [ ] Answer at least one question
- [ ] Submit the exam
- [ ] Watch console logs carefully
- [ ] Verify you see all expected log messages
- [ ] Check for any error messages (red text)
- [ ] Wait 1-2 minutes for email delivery
- [ ] Check spam folder if email not in inbox

## Manual Test Email

To test if email service is working at all:

1. Open browser console
2. Run this command:
```javascript
import { sendEmailNotification } from './src/api/emailNotificationService.js';
import { supabase } from './src/supabaseClient.js';

sendEmailNotification(
  supabase, 
  'Test Email', 
  'This is a test email from CBT system',
  ['your-email@gmail.com']
);
```

## Next Steps

1. **Run a test exam** and monitor the console logs
2. **Share the console output** if emails still aren't received
3. **Check environment variables** are correctly set
4. **Verify Gmail credentials** are valid
5. **Test with different email addresses** if needed

## Contact Points

If issues persist after debugging:
- Check Supabase logs for database errors
- Review Gmail account security settings
- Verify domain isn't blocked by firewall
- Test on different network if possible

---

**Last Updated**: 2026-01-27  
**Status**: Enhanced logging added for debugging

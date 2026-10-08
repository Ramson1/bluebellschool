# 🔧 FIX: Gmail Authentication Error for CBT Emails

## ❌ Error Message
```
Error: Invalid login: 535-5.7.8 Username and Password not accepted
```

## 🎯 Root Cause
Your Gmail credentials are **missing or incorrect** in the environment variables. The email API cannot authenticate with Gmail's SMTP server.

---

## ✅ SOLUTION: Set Up Gmail App Password

### Step 1: Create `.env.local` File

Create a file named `.env.local` in your project root directory:
```
c:\Users\Black-Box\Documents\build\bluebellschool\.env.local
```

### Step 2: Get Gmail App Password

**IMPORTANT**: You CANNOT use your regular Gmail password. You must generate an **App Password**.

#### Instructions:

1. **Go to Google Account Settings**
   - Visit: https://myaccount.google.com/
   - Or click: [Google Account](https://myaccount.google.com/)

2. **Enable 2-Step Verification** (if not already enabled)
   - Go to **Security** → **2-Step Verification**
   - Follow the setup process
   - This is REQUIRED to use App Passwords

3. **Generate App Password**
   - Go to: https://myaccount.google.com/apppasswords
   - Select app: **Mail**
   - Select device: **Other (Custom name)**
   - Enter name: `BluebellSchool CBT System`
   - Click **Generate**

4. **Copy the App Password**
   - Google will show you a **16-character password** (no spaces)
   - Example: `abcd efgh ijkl mnop` → Remove spaces: `abcdefghijklmnop`
   - ⚠️ **Save this immediately** - you can't see it again!

### Step 3: Add Credentials to `.env.local`

Open `.env.local` and add:

```env
# Gmail SMTP Configuration
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=abcdefghijklmnop

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**Replace**:
- `your-email@gmail.com` → Your actual Gmail address
- `abcdefghijklmnop` → Your 16-char App Password (NO spaces)
- Supabase values → Your actual Supabase credentials

### Step 4: Restart Development Server

**IMPORTANT**: Environment variables only load on server start.

```bash
# Stop the current dev server (Ctrl+C)
# Then restart:
npm run dev
```

### Step 5: Test Email Again

1. Take a CBT exam
2. Submit it
3. Check console logs for: `✅ [SendResultEmail] Email sent successfully`
4. Check your email inbox (and spam folder)

---

## 🔍 Troubleshooting

### Issue: Still Getting Authentication Error

**Possible causes:**

1. **Wrong App Password**
   - Make sure you're using the App Password, NOT your regular Gmail password
   - App Passwords are 16 characters (no spaces)
   - Generate a new one if unsure

2. **Spaces in Password**
   - Remove ALL spaces from the App Password
   - Wrong: `abcd efgh ijkl mnop`
   - Right: `abcdefghijklmnop`

3. **Server Not Restarted**
   - Environment variables don't update automatically
   - MUST restart `npm run dev` after editing `.env.local`

4. **Wrong Gmail Account**
   - Ensure `GMAIL_USER` matches the account you generated the App Password for

5. **2-Step Verification Disabled**
   - App Passwords require 2-Step Verification to be enabled
   - Go to Security settings and enable it

### Issue: Can't Find .env.local

**Location**: 
```
c:\Users\Black-Box\Documents\build\bluebellschool\.env.local
```

**Check if it exists**:
```bash
# In Git Bash or terminal
ls .env.local
```

If it doesn't exist, create it with any text editor (Notepad, VS Code, etc.)

### Issue: Values Not Loading

**Check in browser console**:
```javascript
// After restarting server, test if env vars are accessible
fetch('/api/send-email')
  .then(r => r.json())
  .then(console.log);
```

You should get: `{ message: 'Email API is running' }`

---

## 📋 Complete Example

Here's what your `.env.local` should look like:

```env
# Gmail SMTP Configuration
GMAIL_USER=bluebellschool.admin@gmail.com
GMAIL_APP_PASSWORD=xkcd abcd efgh ijkl

# Supabase Configuration  
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional: Additional settings
NODE_ENV=development
```

⚠️ **NEVER commit `.env.local` to Git!** It's in `.gitignore` for security.

---

## 🔐 Security Best Practices

1. **Never share your App Password**
   - Don't commit it to Git
   - Don't share it in chat
   - Don't post it online

2. **Use a dedicated Gmail account**
   - Create a separate Gmail for school notifications
   - Don't use your personal email

3. **Regenerate periodically**
   - Delete old App Passwords in Google Account settings
   - Generate new ones every few months

4. **Monitor usage**
   - Check Gmail "Recent security activity"
   - Look for suspicious logins

---

## ✅ Verification Checklist

After setting up:

- [ ] Created `.env.local` file in project root
- [ ] Generated Gmail App Password (not regular password)
- [ ] Added `GMAIL_USER` with correct email
- [ ] Added `GMAIL_APP_PASSWORD` (16 chars, no spaces)
- [ ] Restarted development server (`npm run dev`)
- [ ] Tested with a CBT exam submission
- [ ] Checked console logs for success message
- [ ] Received email in inbox

---

## 🆘 Still Having Issues?

### Check These:

1. **Gmail Account Type**
   - Must be a personal Gmail (@gmail.com)
   - Google Workspace accounts may have different settings

2. **Firewall/Antivirus**
   - Some networks block SMTP ports
   - Try on different network (home vs school)

3. **Gmail Storage Full**
   - Check if Gmail account has storage space
   - Delete old emails if needed

4. **Rate Limiting**
   - Gmail limits: ~500 emails/day
   - Wait 24 hours if temporarily blocked

### Get Help:

Share these details:
1. Console error message (full text)
2. Server logs from terminal
3. Confirmation that `.env.local` exists
4. Whether server was restarted

---

**Last Updated**: 2026-01-27  
**Status**: Awaiting Gmail credentials setup

# ⚠️ URGENT SECURITY ACTION REQUIRED

## 🚨 CRITICAL: Exposed Credentials in Git Repository

Your Gmail credentials were accidentally committed to the repository in `.env.local.example`:

```
GMAIL_USER=onyevid@gmail.com
GMAIL_APP_PASSWORD=kraxhveycapmptvv  ← COMPROMISED
```

---

## ✅ STATUS UPDATE

**Good News**: I've already sanitized the template file with placeholder values.

**What You Must Do Now**:

### 🔴 IMMEDIATE (Within Next 30 Minutes)

#### 1. **Revoke Compromised Gmail App Password**

**DO THIS FIRST!**

1. Go to: https://myaccount.google.com/apppasswords
2. Sign in to `onyevid@gmail.com`
3. Find the app password named "BluebellSchool" or similar
4. **Delete/Revoke it immediately**
5. Generate a NEW app password
   - Click "App passwords"
   - Select app: "Mail"
   - Select device: "Other"
   - Name: "BluebellSchool Production 2026"
   - Copy the new 16-character password

#### 2. **Update Vercel Environment Variable**

1. Go to: https://vercel.com/dashboard
2. Select your BluebellSchool project
3. Settings → Environment Variables
4. Find `GMAIL_APP_PASSWORD`
5. Click "Edit"
6. Paste your NEW password
7. Save changes

#### 3. **Remove File from Git History**

Even though I fixed the file, the old version is still in Git history!

Run these commands:

```bash
# Remove the file from git tracking
git rm --cached .env.local.example

# Commit the removal
git commit -m "security: remove sensitive credentials from repository"

# Check if file was previously committed
git log --all --full-history -- .env.local.example

# If it shows commits, you need to rewrite history
# Option 1: If this is a personal project (no collaborators)
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .env.local.example' \
  --prune-empty --tag-name-filter cat -- --all
  
# Then force push
git push --force origin main

# Option 2: Simpler approach with BFG Repo-Cleaner
# Download from: https://rtyley.github.io/bfg-repo-cleaner/
# Run: java -jar bfg.jar --delete-files .env.local*
```

---

### 🟡 WITHIN 24 HOURS

#### 4. **Check for Unauthorized Access**

1. **Review Gmail Security Activity**
   - Go to: https://myaccount.google.com/security
   - Check "Recent security activity"
   - Look for unfamiliar logins or app access
   - Report any suspicious activity

2. **Check Email Logs**
   - Review sent emails for messages you didn't send
   - Check filters and forwarding rules
   - Verify no unauthorized changes

3. **Monitor Account**
   - Enable login notifications
   - Check connected apps: https://myaccount.google.com/permissions
   - Revoke any unknown third-party access

#### 5. **Update All Related Credentials**

Since one credential was exposed, assume others might be at risk:

- [ ] Regenerate Supabase anon key (if it was also exposed)
- [ ] Change Paystack API keys (if committed)
- [ ] Update Flutterwave keys (if committed)
- [ ] Change any other passwords that might have been exposed

#### 6. **Add Security Pre-commit Hook**

Prevent future accidents:

Create `.git/hooks/pre-commit` (executable):

```bash
#!/bin/bash

# Block commits containing sensitive files
if git diff --cached --name-only | grep -q ".env"; then
  echo "❌ ERROR: Attempting to commit .env files!"
  echo "Use .env.local.example as template instead."
  exit 1
fi

# Block commits containing common credential patterns
if git diff --cached --grep="GMAIL_APP_PASSWORD="; then
  echo "❌ ERROR: Detected credential pattern in commit!"
  exit 1
fi

exit 0
```

Make it executable:
```bash
chmod +x .git/hooks/pre-commit
```

---

### 🟢 WITHIN 48 HOURS

#### 7. **Implement Security Best Practices**

#### A. Add to `.gitignore` (Already Done ✅)
Verify these lines exist:
```gitignore
.env*
!.env.local.example
```

#### B. Create Security Scanning

Add a pre-commit scanner script `scripts/check-secrets.sh`:

```bash
#!/bin/bash

echo "🔍 Scanning for exposed secrets..."

# Patterns to check
PATTERNS=(
  "GMAIL_APP_PASSWORD=[^$]"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ"
  "password="
  "secret="
  "api_key="
)

for pattern in "${PATTERNS[@]}"; do
  if git diff --cached --grep="$pattern"; then
    echo "⚠️  WARNING: Potential secret detected: $pattern"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      exit 1
    fi
  fi
done

exit 0
```

#### C. Enable Vercel Secret Scanning

1. Go to Vercel Dashboard
2. Settings → Security
3. Enable "Secret Scanning"
4. Configure alerts

#### D. Consider Using Vercel Secrets CLI

Install:
```bash
npm install -g vercel
```

Add secrets securely:
```bash
vercel secrets add gmail-app-password kraxh...
vercel secrets add supabase-url https://...
```

Reference in code:
```json
{
  "env": {
    "GMAIL_APP_PASSWORD": "@gmail-app-password"
  }
}
```

---

## 📋 VERIFICATION CHECKLIST

After completing all steps:

- [ ] Old Gmail app password revoked
- [ ] New Gmail app password generated
- [ ] Vercel environment variable updated
- [ ] File removed from Git history
- [ ] No unauthorized access detected
- [ ] All related credentials updated
- [ ] Pre-commit hooks installed
- [ ] Security scanning enabled
- [ ] Team notified (if applicable)
- [ ] Security monitoring active

---

## 🎯 DAMAGE ASSESSMENT

### What Could Have Happened

With those credentials, someone could have:

1. **Sent emails as onyevid@gmail.com**
   - Phishing attacks
   - Spam distribution
   - Impersonation

2. **Accessed email account**
   - Read sent/received emails
   - Changed account settings
   - Locked out legitimate owner

3. **Used SMTP quota**
   - Sent up to 500 emails/day
   - Could get account flagged for spam
   - Potential Google account suspension

### Why It's Probably OK

1. **Limited Scope**
   - App passwords only work for SMTP
   - Can't change Google account password
   - Can't access other Google services

2. **Time Window**
   - Credential was exposed briefly
   - Likely not indexed by scanners yet
   - Quick response minimizes risk

3. **Detection Available**
   - Gmail shows recent activity
   - Login alerts available
   - Easy to spot unauthorized use

---

## 🛡️ PREVENTION FOR FUTURE

### Never Commit Secrets Again

#### 1. Use Environment-Specific Files

```
.env.local          ← Local development (gitignored)
.env.production     ← Production values (never committed)
.env.local.example  ← Template only (safe to commit)
```

#### 2. Automated Scanning

Add to CI/CD pipeline:

```yaml
# .github/workflows/security-scan.yml
name: Security Scan
on: [push]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Detect Secrets
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          extra_args: --only-verified
```

#### 3. Code Review Checklist

Before merging any PR:
- [ ] Check for .env files
- [ ] Scan for credential patterns
- [ ] Verify .gitignore is correct
- [ ] Confirm no hardcoded secrets

#### 4. Team Training

If working with others:
- Share this security guide
- Establish credential management policy
- Use password manager for sharing
- Regular security audits

---

## 🆘 IF YOU SUSPECT BREACH

### Immediate Actions

1. **Change Gmail Password**
   - Not just app password, but main password
   - Enable 2FA if not already

2. **Revoke ALL App Passwords**
   - Go to myaccount.google.com/apppasswords
   - Delete every app password
   - Generate new ones only for verified apps

3. **Check Email Forwarding**
   - Gmail Settings → Forwarding and POP/IMAP
   - Remove any unknown forwarding addresses

4. **Review Account Recovery**
   - Gmail Settings → Accounts and Import
   - Check recovery email and phone
   - Ensure they're still yours

5. **Contact Google Support**
   - If you see suspicious activity
   - Report potential compromise
   - Request account review

---

## 📞 RESOURCES

### Google Security
- Account Security: https://myaccount.google.com/security
- App Passwords: https://myaccount.google.com/apppasswords
- Recent Activity: https://myaccount.google.com/notifications

### Vercel Security
- Environment Variables: https://vercel.com/docs/concepts/projects/environment-variables
- Secret Scanning: https://vercel.com/docs/security
- Deployment Logs: https://vercel.com/docs/deployments/logs

### Git Security
- Remove Sensitive Data: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository
- BFG Repo-Cleaner: https://rtyley.github.io/bfg-repo-cleaner/

---

## ✅ SUMMARY

**Right Now:**
1. ✏️ Revoke old Gmail password
2. 🔑 Generate new Gmail password
3. 🔄 Update Vercel
4. 🗑️ Clean Git history

**Next 24 Hours:**
1. 👀 Monitor for unauthorized access
2. 🔄 Update other credentials
3. 🛡️ Install pre-commit hooks

**Next 48 Hours:**
1. 📋 Implement security scanning
2. 📚 Train team (if applicable)
3. ✅ Complete verification checklist

---

**Remember**: Quick action prevents most damage. You're doing the right thing by addressing this immediately!

**Last Updated**: 2026-01-27  
**Priority**: 🔴 CRITICAL  
**Status**: Action Required

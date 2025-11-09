# Removing Sensitive Files from Git History

## The Problem

When you commit sensitive files (passwords, API keys, etc.) to git, they remain in the git history **forever** - even after you delete them. Anyone with access to the repository can view old commits and extract the sensitive data.

## Current Situation

The file `config/edit-config.php` containing default credentials was committed to git history in commit `3ad178d5d0875684d4c82802d304fd22dd32732f` and pushed to GitHub.

**Impact:**
- ❌ File is visible in git history
- ❌ Pushed to public GitHub repository
- ❌ Anyone can view the default password hash
- ❌ Default password should be considered permanently compromised

## Solution: Rewrite Git History

You must **completely remove the file from git history**. This requires rewriting history and force-pushing.

### ⚠️ Important Warnings

Before proceeding:

1. **This rewrites git history** - it changes commit hashes
2. **All collaborators must re-clone** the repository after you force-push
3. **Make a backup first** - just in case something goes wrong
4. **Coordinate with team** - ensure no one is pushing while you do this
5. **Change all passwords** - the old password is already exposed

## Method 1: Using git filter-repo (Recommended)

### Step 1: Install git-filter-repo

```bash
pip3 install git-filter-repo
# or on Mac: brew install git-filter-repo
```

### Step 2: Create Backup

```bash
cd /home/sdkkr/dev
cp -r maps maps-backup-$(date +%Y%m%d-%H%M%S)
```

### Step 3: Remove File from History

```bash
cd /home/sdkkr/dev/maps
git filter-repo --path config/edit-config.php --invert-paths --force
```

This removes ALL occurrences of `config/edit-config.php` from ALL commits.

### Step 4: Re-add Remote

`git filter-repo` removes remote for safety. Add it back:

```bash
git remote add origin git@github.com:stdekker/open-data-maps.git
```

### Step 5: Verify Removal

```bash
git log --all --full-history -- config/edit-config.php
# Should show nothing!
```

### Step 6: Force Push

```bash
# Push all branches
git push origin --force --all

# Push all tags
git push origin --force --tags
```

## Method 2: Using BFG Repo-Cleaner (Faster, Easier)

BFG is faster and simpler for removing files.

### Step 1: Download BFG

```bash
cd /home/sdkkr/dev/maps
curl -L https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar -o bfg.jar
```

### Step 2: Create Backup

```bash
cd /home/sdkkr/dev
cp -r maps maps-backup-$(date +%Y%m%d-%H%M%S)
cd maps
```

### Step 3: Run BFG

```bash
java -jar bfg.jar --delete-files edit-config.php
```

### Step 4: Clean Up

```bash
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

### Step 5: Force Push

```bash
git push origin --force --all
git push origin --force --tags
```

## Method 3: Manual Using git filter-branch (Old Method)

If you can't install the above tools:

```bash
# Create backup
cd /home/sdkkr/dev
cp -r maps maps-backup-$(date +%Y%m%d-%H%M%S)
cd maps

# Remove file from all commits
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch config/edit-config.php" \
  --prune-empty --tag-name-filter cat -- --all

# Clean up
rm -rf .git/refs/original/
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push
git push origin --force --all
git push origin --force --tags
```

## After Rewriting History

### 1. Verify It's Gone

```bash
# Should return nothing:
git log --all --full-history -- config/edit-config.php

# Check GitHub - browse the commit history
# The file should no longer be visible
```

### 2. Notify Collaborators

Send this message to anyone with a clone:

```
I've rewritten git history to remove sensitive files.
Please delete your local clone and re-clone:

rm -rf maps
git clone git@github.com:stdekker/open-data-maps.git
cd maps
cp config/edit-config.default.php config/edit-config.php
# Customize config/edit-config.php with your credentials
```

### 3. Change All Passwords

Even after removing from history:
- Change editor password on all environments
- Consider any exposed credentials permanently compromised
- Rotate any related API keys or secrets

### 4. Verify on GitHub

1. Go to: https://github.com/stdekker/open-data-maps
2. Click on commits
3. Try to view the old commit: `3ad178d5d087...`
4. It should either not exist or not show the config file

## Preventing Future Incidents

### 1. Always Use .gitignore BEFORE Committing

```bash
# Add to .gitignore FIRST, then commit
echo "config/edit-config.php" >> .gitignore
git add .gitignore
git commit -m "Add gitignore for config"

# THEN create your config file
cp config/edit-config.default.php config/edit-config.php
```

### 2. Pre-commit Hooks

Install a pre-commit hook to detect secrets:

```bash
pip3 install detect-secrets
detect-secrets scan > .secrets.baseline
```

### 3. GitHub Secret Scanning

Enable GitHub's secret scanning (if available):
- Go to Settings → Security → Code security and analysis
- Enable "Secret scanning"

### 4. Use Environment Variables

For production, consider using environment variables instead of config files:

```php
// Instead of:
define('API_KEY', 'hardcoded-key');

// Use:
define('API_KEY', getenv('API_KEY'));
```

## If You Can't Rewrite History

If rewriting history is too disruptive (e.g., many collaborators, production deployments):

### Alternative: Accept and Mitigate

1. **Change all passwords immediately** - treat them as permanently exposed
2. **Add security monitoring** - watch access logs for suspicious activity
3. **Document the incident** - note what was exposed and when
4. **Consider starting fresh** - create a new repository if very sensitive
5. **Move sensitive config** - ensure future config is outside git

### Inform Stakeholders

If this was a production password or API key:
- Inform your security team
- Document the incident
- Review access logs
- Consider breach notification requirements

## Resources

- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)
- [git-filter-repo](https://github.com/newren/git-filter-repo)
- [GitHub: Removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [Detecting secrets in git](https://github.com/Yelp/detect-secrets)

## Quick Reference Commands

```bash
# Install tools
pip3 install git-filter-repo

# Backup
cp -r maps maps-backup

# Remove file (filter-repo)
git filter-repo --path config/edit-config.php --invert-paths --force
git remote add origin git@github.com:stdekker/open-data-maps.git

# Force push
git push origin --force --all
git push origin --force --tags

# Verify
git log --all -- config/edit-config.php  # Should be empty
```

## Need Help?

1. Read this guide thoroughly
2. Make a backup before proceeding
3. Test on a clone first if unsure
4. Run the automated scripts (REMOVE-FROM-HISTORY.sh or REMOVE-WITH-BFG.sh)
5. Document what you did for your team


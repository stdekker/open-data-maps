# Security Best Practices

This document outlines security best practices for Open Data Maps, particularly regarding sensitive configuration files.

## Configuration File Security

### ✅ What We Do Right

1. **Config Outside Web Root**
   - All sensitive configuration is in `/config/` directory
   - This directory is outside the `/web/` public directory
   - Even if web server is misconfigured, config files cannot be accessed via HTTP

2. **Template Pattern**
   - Default templates committed to git: `edit-config.default.php`
   - Actual config files ignored: `edit-config.php`
   - Users copy template and customize locally

3. **Password Hashing**
   - Passwords never stored in plain text
   - Uses PHP's `password_hash()` with bcrypt (cost factor 10)
   - Password verification uses timing-safe comparison

4. **Gitignore Protection**
   ```
   config/edit-config.php     # Never committed
   web/config.prod.php        # Never committed
   ```

### 🔐 Setup Process

When setting up a new installation:

1. **Copy template files:**
   ```bash
   cp config/edit-config.default.php config/edit-config.php
   cp web/config.default.php web/config.prod.php
   ```

2. **Customize your config:**
   - Generate strong password hash
   - Set production settings
   - Configure CORS and allowed domains

3. **Verify git ignores them:**
   ```bash
   git status config/edit-config.php
   # Should show: nothing to commit
   ```

### 🚨 If You Accidentally Commit Credentials

If you accidentally commit sensitive files to git:

1. **Add to .gitignore immediately:**
   ```bash
   echo "config/edit-config.php" >> .gitignore
   ```

2. **Remove from git tracking (keeps local file):**
   ```bash
   git rm --cached config/edit-config.php
   git commit -m "Remove config file from tracking"
   ```

3. **Change all passwords immediately:**
   ```bash
   php tools/generate-edit-password.php
   # Update config/edit-config.php with new hash
   ```

4. **For public repositories:**
   - Consider the exposed passwords **permanently compromised**
   - Change them on all environments
   - If pushed to public repo, consider repo history tainted
   - Consider rotating any API keys or tokens

### 📋 Configuration File Checklist

Before deploying to production:

- [ ] `config/edit-config.php` exists and is customized
- [ ] `config/edit-config.php` is in `.gitignore`
- [ ] Default password has been changed
- [ ] `web/config.prod.php` is configured for production
- [ ] `web/config.prod.php` is in `.gitignore`
- [ ] All credentials are different from default templates
- [ ] File permissions are restrictive (600 or 640)
- [ ] `git status` shows no sensitive files staged

### 🔒 File Permissions

Set restrictive permissions on config files:

```bash
# Make config readable only by owner
chmod 600 config/edit-config.php
chmod 600 web/config.prod.php

# Make config directory accessible only by owner
chmod 700 config/
```

For shared hosting, you may need 640 instead of 600.

## Editor Security

### Authentication

1. **Strong Passwords Required**
   - Minimum 12 characters recommended
   - Mix of uppercase, lowercase, numbers, symbols
   - Use password generator for best results

2. **Password Hash Generation**
   ```bash
   php tools/generate-edit-password.php
   ```
   - Generates secure bcrypt hash
   - Shows password strength estimation
   - Provides ready-to-paste config code

3. **Session Security**
   - Session timeout: 1 hour (configurable)
   - Session data stored server-side only
   - CSRF tokens on all state-changing operations

### Access Control

1. **Authentication Required**
   - All editor pages require login
   - All API endpoints check authentication
   - Sessions expire after inactivity

2. **Access Logging**
   - All access attempts logged to `web/edit/access.log`
   - Includes timestamp, username, IP, action
   - Review logs regularly for suspicious activity

3. **IP Whitelisting (Optional)**
   - Consider restricting access to known IP addresses
   - Add to `.htaccess` in production:
   ```apache
   Order deny,allow
   Deny from all
   Allow from 192.168.1.0/24
   Allow from YOUR_OFFICE_IP
   ```

## Data File Security

### Election Data

- Stored in `web/data/elections/`
- Automatic backups before modifications
- Backup retention: last 5 versions per file
- Regular backup schedule recommended

### Backup Strategy

```bash
# Regular backups of entire data directory
tar -czf backup-$(date +%Y%m%d).tar.gz web/data/elections/

# Keep backups off-server
rsync -avz web/data/elections/ backup-server:/backups/odm/
```

## API Security

### Input Validation

All API endpoints use `security.php` functions:

```php
// Validate input format
$code = validateInputRegex($_GET['code'], '/^[a-zA-Z0-9]+$/', 'Invalid code');

// Sanitize for filesystem
$safe = sanitizePathComponent($code);
```

### CORS Configuration

Configure in `web/config.prod.php`:

```php
$CORS_ENABLED = true;
$CORS_ALLOWED_ORIGINS = [
    'https://yourdomain.com',
    'https://maps.yourdomain.com'
];
```

**Never use `*` (wildcard) in production!**

### Rate Limiting

Consider implementing rate limiting:
- At web server level (nginx, Apache)
- At application level for API endpoints
- Using Cloudflare or similar CDN

## HTTPS / SSL

### Production Requirements

1. **Always use HTTPS in production**
   - Protects credentials in transit
   - Prevents session hijacking
   - Required for modern browsers

2. **Force HTTPS in .htaccess:**
   ```apache
   RewriteEngine On
   RewriteCond %{HTTPS} off
   RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
   ```

3. **Use Strong TLS Configuration**
   - TLS 1.2+ only
   - Strong cipher suites
   - HSTS headers

## Dependency Security

### Regular Updates

```bash
# Update PHP dependencies
composer update

# Check for security advisories
composer audit
```

### Version Control

- Lock file (`composer.lock`) committed to git
- Ensures consistent versions across environments
- Review changes when updating dependencies

## Monitoring

### What to Monitor

1. **Access Logs**
   - Failed login attempts
   - Unusual access patterns
   - Unknown IP addresses

2. **Error Logs**
   - PHP errors
   - Failed API calls
   - Security exceptions

3. **File Integrity**
   - Unexpected file modifications
   - Unauthorized data changes
   - Missing backup files

### Alerting

Consider setting up alerts for:
- Multiple failed login attempts
- Access from new IP addresses
- Large data file modifications
- Application errors

## Security Checklist for Deployment

Before deploying to production:

### Configuration
- [ ] All passwords changed from defaults
- [ ] Config files not in git repository
- [ ] Strong passwords used (12+ characters)
- [ ] HTTPS/SSL configured and forced
- [ ] CORS properly configured (no wildcards)

### File Permissions
- [ ] Config files: 600 or 640
- [ ] Web files: 644
- [ ] Directories: 755
- [ ] No world-writable files

### Access Control
- [ ] Editor credentials secured
- [ ] Access logging enabled
- [ ] Session timeout configured
- [ ] Consider IP whitelisting

### Monitoring
- [ ] Access logs reviewed regularly
- [ ] Error logs monitored
- [ ] Backup strategy implemented
- [ ] File integrity checks in place

### Updates
- [ ] Composer dependencies updated
- [ ] PHP version current and supported
- [ ] Web server version current
- [ ] Security patches applied

## Incident Response

If you suspect a security breach:

1. **Immediate Actions**
   - Change all passwords immediately
   - Review access logs for unauthorized access
   - Check file modifications for unauthorized changes
   - Restore from known-good backup if necessary

2. **Investigation**
   - Identify entry point
   - Assess scope of breach
   - Document findings

3. **Remediation**
   - Patch vulnerabilities
   - Update all credentials
   - Implement additional security measures
   - Monitor closely for recurrence

4. **Prevention**
   - Review security practices
   - Update documentation
   - Train team members
   - Implement additional monitoring

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [PHP Security Best Practices](https://www.php.net/manual/en/security.php)
- [Composer Security Advisories](https://github.com/FriendsOfPHP/security-advisories)
- [Let's Encrypt (Free SSL)](https://letsencrypt.org/)

## Contact

For security concerns, review this document and the [security improvements log](security-improvements.md).


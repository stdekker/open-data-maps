# Installation Guide - Stembureau Location Editor

## Prerequisites

- PHP 7.4 or higher
- Apache or Nginx web server
- Write permissions on election data directory
- Mapbox access token (already configured)

## Installation Steps

### 1. Verify File Structure

Ensure all files are in place:

```bash
cd /home/sdkkr/dev/maps/web/edit
ls -la
```

You should see:
- `auth.php`
- `login.php`
- `logout.php`
- `index.php`
- `.htaccess`
- `api/` directory
- `style/` directory
- `src/` directory

### 2. Set File Permissions

```bash
# Make directories writable for backups and logs
chmod 755 /home/sdkkr/dev/maps/web/edit
chmod 755 /home/sdkkr/dev/maps/web/data/elections

# Make election data directories writable for backups
find /home/sdkkr/dev/maps/web/data/elections -type d -exec chmod 755 {} \;

# Make election JSON files writable
find /home/sdkkr/dev/maps/web/data/elections -type f -name "*.json" -exec chmod 644 {} \;

# Create log file if it doesn't exist
touch /home/sdkkr/dev/maps/web/edit/access.log
chmod 644 /home/sdkkr/dev/maps/web/edit/access.log
```

### 3. Create Configuration File

**IMPORTANT:** Create your config file from the template:

```bash
cd /home/sdkkr/dev/maps/config
cp edit-config.default.php edit-config.php
```

### 4. Change Default Password

**IMPORTANT:** Change the default password immediately!

```bash
cd /home/sdkkr/dev/maps
php tools/generate-edit-password.php
```

Follow the prompts to generate a new password hash, then update `/config/edit-config.php`:

```php
define('EDIT_PASSWORD_HASH', 'your_new_hash_here');
```

You can also change the username in `/config/edit-config.php`:

```php
define('EDIT_USERNAME', 'your_username');
```

### 5. Verify PHP Configuration

Ensure PHP sessions are enabled:

```bash
php -i | grep "session.save_path"
```

Make sure the session directory is writable.

### 6. Test Apache Configuration (if using Apache)

Verify `.htaccess` is being read:

```bash
# Check if AllowOverride is enabled in your Apache config
# It should be set to "All" or at least "FileInfo AuthConfig"
```

### 7. Access the Tool

1. Open your browser
2. Navigate to: `http://your-domain/edit/`
3. Login with your credentials
4. You should see the editor interface

## Post-Installation

### Security Checklist

- [ ] Changed default password
- [ ] Verified `.htaccess` is working
- [ ] Tested login/logout
- [ ] Checked that `edit-config.php` is not accessible via web (it's outside web directory)
- [ ] Verified file permissions are correct
- [ ] Reviewed `access.log` location and permissions

### Test the Editor

1. **Test Login:**
   - Navigate to `/edit/`
   - Enter credentials
   - Verify successful login

2. **Test Data Loading:**
   - Select "TK2025" election
   - Select a municipality (e.g., "Utrecht")
   - Click "Load Data"
   - Verify stembureaus appear in list and on map

3. **Test Editing:**
   - Click "Edit" on a stembureau
   - Enter new coordinates
   - Click "Save"
   - Verify the marker moves on the map

4. **Test Saving:**
   - Make a few edits
   - Click "Save All Changes"
   - Verify success message
   - Check that a backup file was created in the data directory

5. **Test Backup Creation:**
   ```bash
   ls -la /home/sdkkr/dev/maps/web/data/elections/TK2025/*.backup.*.json
   ```
   You should see backup files with timestamps

6. **Test Session Timeout:**
   - Login
   - Wait for 1+ hour (or adjust SESSION_TIMEOUT in config.php for testing)
   - Try to perform an action
   - Verify redirect to login page

### Verify Security

1. **Test Configuration Security:**
   - Config file is now outside web directory (`/config/edit-config.php`)
   - It should not be accessible via web browser at all

2. **Test Unauthenticated Access:**
   - Logout or use incognito mode
   - Try accessing: `http://your-domain/edit/index.php`
   - Should redirect to login page

3. **Test API Without Auth:**
   - Logout
   - Try accessing: `http://your-domain/edit/api/list-stembureaus.php?election=TK2025&municipality=GM0317`
   - Should redirect to login page

4. **Review Access Log:**
   ```bash
   tail -f /home/sdkkr/dev/maps/web/edit/access.log
   ```
   Verify all actions are being logged

## Troubleshooting

### Problem: Can't Login

**Solution:**
1. Check credentials in `/config/edit-config.php`
2. Verify PHP sessions are working:
   ```bash
   php -i | grep session
   ```
3. Check file permissions on session directory

### Problem: 403 Forbidden on All Pages

**Solution:**
1. Check `.htaccess` syntax
2. Verify Apache `AllowOverride` is enabled
3. Check file permissions

### Problem: Can't Save Changes

**Solution:**
1. Check write permissions on election data directories
2. Verify PHP can create files:
   ```bash
   sudo -u www-data touch /home/sdkkr/dev/maps/web/data/elections/test.txt
   ```
3. Check PHP error logs

### Problem: Map Not Loading

**Solution:**
1. Verify Mapbox token in `index.php`
2. Check browser console for errors
3. Ensure internet connectivity for Mapbox API

### Problem: Markers Not Appearing

**Solution:**
1. Check that stembureaus have valid coordinates
2. Verify GeoJSON data for municipality exists
3. Check browser console for JavaScript errors

## Maintenance

### Regular Tasks

1. **Review Access Logs:**
   ```bash
   tail -100 /home/sdkkr/dev/maps/web/edit/access.log
   ```

2. **Clean Up Old Backups:**
   - The system automatically keeps the last 5 backups
   - You can manually clean older backups if needed:
   ```bash
   find /home/sdkkr/dev/maps/web/data/elections -name "*.backup.*.json" -mtime +30 -delete
   ```

3. **Monitor Disk Space:**
   ```bash
   du -sh /home/sdkkr/dev/maps/web/data/elections
   ```

### Updating the Tool

When updating the code:
1. Your config file is safe in `/config/edit-config.php` (outside web directory)
2. Update the files
3. Clear browser cache
4. Test all functionality

## Support

If you encounter issues:

1. Check PHP error logs
2. Check browser console
3. Review `access.log`
4. Verify file permissions
5. Test with default credentials (temporarily) to rule out authentication issues

## Security Recommendations

1. **Use HTTPS** - Always access the editor over HTTPS in production
2. **Strong Passwords** - Use passwords with 12+ characters
3. **Limit Access** - Consider IP whitelisting in `.htaccess` if possible
4. **Regular Audits** - Review access logs regularly
5. **Backups** - Keep regular backups of the entire data directory
6. **Updates** - Keep PHP and Apache updated with security patches


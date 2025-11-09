# Quick Start Guide

## First Time Setup (5 minutes)

### 1. Change Default Password
```bash
cd /home/sdkkr/dev/maps
php tools/generate-edit-password.php
```

Copy the generated hash to `/config/edit-config.php`.

### 2. Verify Setup
```bash
php tools/verify-setup.php
```

Should show: ✓ Setup verification PASSED

### 3. Access the Editor
Open browser: `http://your-domain/edit/`

**Default credentials:**
- Username: `admin`
- Password: `changeme` (or your new password)

## Quick Usage

### Load Data
1. Select election (e.g., TK2025)
2. Select municipality (e.g., Utrecht)
3. Click "Load Data"

### Edit Locations

**Drag on map:**
- Simply drag any marker to new position
- Red markers = no location set

**Manual entry:**
1. Click "Edit" on any stembureau
2. Enter latitude/longitude
3. Click "Save"

**Locate:**
- Click "Locate on Map" to zoom to specific stembureau

### Save Changes
- All changes tracked automatically
- Click "Save All Changes" when ready
- Backups created automatically

## Files Overview

```
/config/
└── edit-config.php     # Configuration (outside web directory)

/tools/
└── generate-edit-password.php  # Password generator (outside web directory)

/edit/
├── login.php           # Login page
├── index.php           # Main editor
└── README.md           # Full documentation
```

## Common Tasks

### Change Password
1. Run `php tools/generate-edit-password.php`
2. Copy the generated hash
3. Update `EDIT_PASSWORD_HASH` in `/config/edit-config.php`

### View Access Log
```bash
tail -f /home/sdkkr/dev/maps/web/edit/access.log
```

### Find Backups
```bash
ls -la /home/sdkkr/dev/maps/web/data/elections/TK2025/*.backup.*.json
```

### Restore Backup
```bash
cp GM0317.backup.20250108120000.json GM0317.json
```

## Security Checklist

- [ ] Changed default password
- [ ] Tested login/logout
- [ ] Config is outside web directory (secure)
- [ ] Backups being created
- [ ] Access log working

## Troubleshooting

**Can't login?**
- Check credentials in `/config/edit-config.php` (outside web directory)
- Verify PHP sessions working

**Can't save?**
- Check write permissions on data directory
- Review access.log for errors

**Map not loading?**
- Check browser console
- Verify Mapbox token in `index.php`

## Support

See [README.md](README.md) for complete documentation.
See [installation.md](installation.md) for detailed setup.
See [matching-guide.md](matching-guide.md) for location matching feature.

## Key Features

✓ Secure authentication with session timeout
✓ Dual list/map interface
✓ Drag-and-drop marker editing
✓ Automatic coordinate validation
✓ Backup system before saves
✓ CSRF protection
✓ Access logging
✓ Search/filter stembureaus


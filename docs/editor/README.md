# Stembureau Location Editor

A secure administrative interface for editing polling station (stembureau) geographic coordinates in election data files.

## Access

The edit tool is accessible at: `/edit/`

**Default Credentials:**
- Username: `admin`
- Password: `changeme`

**⚠️ IMPORTANT:** Change these credentials immediately by updating `/config/edit-config.php`

## Features

### Authentication
- Username/password protected access
- Session-based authentication with 1-hour timeout
- CSRF token protection on all data modifications
- Access logging to `access.log`

### User Interface
- **Dual View**: List and map view displayed side-by-side
- **List View**: Shows all stembureaus with their coordinates
  - Search/filter functionality
  - Edit button for manual coordinate entry
  - Visual indicators for located/unlocated stembureaus
- **Map View**: Interactive map with draggable markers
  - Drag markers to update locations
  - Click markers to edit coordinates manually
  - Municipality boundary overlay
  - Red markers indicate missing location data

### Data Management
- Load election data by selecting election and municipality
- Edit coordinates via:
  - Manual entry in modal dialog
  - Dragging markers on the map
  - Both methods sync automatically
- Track unsaved changes
- Batch save all modifications
- Automatic backup creation before saves

### Security Features
1. **Authentication**: PHP session-based login
2. **CSRF Protection**: All POST requests require valid token
3. **Input Validation**: All inputs sanitized and validated
4. **Access Logging**: All actions logged with timestamp, user, and IP
5. **Backup System**: Automatic backups before any modification
6. **File Protection**: `.htaccess` prevents direct access to sensitive files

## Usage

### 1. Login
Navigate to `/edit/` and login with credentials.

### 2. Select Data
1. Choose an election from the dropdown (e.g., TK2025)
2. Choose a municipality from the dropdown
3. Click "Load Data"

### 3. Edit Locations

**Method 1: Using the Map**
- Drag any marker to a new location
- The coordinates update automatically
- Changes are marked as "modified" but not saved yet

**Method 2: Using the List**
- Click "Edit" on any stembureau
- Enter latitude and longitude manually
- Click "Save" in the modal

**Method 3: Locate on Map**
- Click "Locate on Map" to zoom to a specific stembureau
- Then drag the marker or click to edit

**Method 4: Match from Another Election** ⭐ NEW
- Click "📍 Match from Election" button
- Select a source election (e.g., TK2023 to copy locations to TK2025)
- Choose match quality threshold (High/Medium/Low)
- Click "Find Matches" to search for similar names
- Review matched stembureaus with similarity scores
- Select/deselect matches as needed
- Click "Apply Selected Matches" to copy locations

This is especially useful when:
- Polling stations remain in the same locations across elections
- Names are slightly different (e.g., "Stembureau Agnietenkapel" vs "Stembureau de Agnietenkapel (postcode: 2801 GR)")
- You want to quickly populate locations for a new election

### 4. Save Changes
- All modifications are tracked
- Click "Save All Changes" to persist all modifications
- Backups are created automatically
- Success/error notifications confirm the operation

## File Structure

```
/config/
└── edit-config.php         # Configuration and credentials (outside web directory)

/tools/
└── generate-edit-password.php  # Password hash generator (outside web directory)

/web/edit/
├── auth.php                # Authentication helper
├── login.php               # Login page
├── logout.php              # Logout handler
├── index.php               # Main edit interface
├── .htaccess               # Security rules
├── api/
│   ├── list-stembureaus.php  # API to list stembureaus
│   └── save-location.php     # API to save location changes
├── style/
│   └── edit.css            # Styles
└── src/
    └── edit.js             # JavaScript application
```

## Data Files

Election data is stored in: `/web/data/elections/{election}/{municipality}.json`

Each file contains:
- Election metadata
- Contest information
- Reporting units (stembureaus) with:
  - `ReportingUnitIdentifier`: Name of the stembureau
  - `GeoLocation`: `{lat, lon}` coordinates
  - Vote counts and statistics

## Backup System

Before any save operation:
1. A backup is created: `{municipality}.backup.{timestamp}.json`
2. Only the last 5 backups are kept per file
3. Older backups are automatically deleted

To restore from backup:
```bash
cp GM0317.backup.20250108120000.json GM0317.json
```

## Security Notes

### Change Default Credentials

Generate a new password hash:

```bash
cd /home/sdkkr/dev/maps
php tools/generate-edit-password.php
```

Then edit `/config/edit-config.php`:

```php
define('EDIT_USERNAME', 'your_username');
define('EDIT_PASSWORD_HASH', 'your_generated_hash_here');
```

### Access Logging

All access attempts are logged to `access.log`:
```
[2025-01-08 12:00:00] SUCCESS - LOGIN - User: admin - IP: 192.168.1.1
[2025-01-08 12:05:00] SUCCESS - SAVE_LOCATION - TK2025/GM0317 - Stembureau 1 - (52.156, 5.387) - User: admin - IP: 192.168.1.1
```

Review logs regularly for suspicious activity.

### Session Management

- Sessions expire after 1 hour of inactivity
- Users are automatically logged out on timeout
- Session data is stored server-side only

## Troubleshooting

### Can't Login
- Verify credentials in `/config/edit-config.php`
- Check that PHP sessions are enabled
- Ensure write permissions for session directory

### Can't Save Changes
- Check write permissions on election data directory
- Verify CSRF token is being sent (check browser console)
- Review `access.log` for error details

### Markers Not Showing
- Verify Mapbox token in `index.php`
- Check browser console for JavaScript errors
- Ensure municipality has GeoJSON data

### Coordinates Out of Range
- Valid range for Netherlands:
  - Latitude: 50.0 - 54.0
  - Longitude: 3.0 - 8.0

## API Endpoints

### GET `/edit/api/list-stembureaus.php`
**Parameters:**
- `election`: Election ID (e.g., TK2025)
- `municipality`: Municipality code (e.g., GM0317)

**Response:**
```json
{
  "success": true,
  "stembureaus": [
    {
      "index": 0,
      "identifier": "Stembureau 1",
      "hasLocation": true,
      "lat": 52.156,
      "lon": 5.387,
      "cast": 500,
      "totalCounted": 495
    }
  ],
  "total": 100,
  "geocoded": true
}
```

### POST `/edit/api/save-location.php`
**Body:**
```json
{
  "csrf_token": "...",
  "election": "TK2025",
  "municipality": "GM0317",
  "index": 0,
  "lat": 52.156,
  "lon": 5.387
}
```

**Response:**
```json
{
  "success": true,
  "message": "Location updated successfully",
  "backup": "GM0317.backup.20250108120000.json"
}
```

### POST `/edit/api/match-locations.php`
**Body:**
```json
{
  "csrf_token": "...",
  "currentElection": "TK2025",
  "currentMunicipality": "GM0317",
  "sourceElection": "TK2023",
  "threshold": 80,
  "stembureaus": [...]
}
```

**Response:**
```json
{
  "success": true,
  "matches": [
    {
      "index": 0,
      "currentName": "Stembureau de Agnietenkapel (postcode: 2801 GR)",
      "sourceName": "Stembureau Agnietenkapel",
      "lat": 52.156,
      "lon": 5.387,
      "similarity": 95.5
    }
  ],
  "sourceElection": "TK2023",
  "threshold": 80,
  "total": 15
}
```

## Development

The edit tool is completely separate from the public interface:
- No links from public pages to `/edit/`
- Authentication required for all access
- Separate CSS and JavaScript
- Uses same Mapbox token and municipality data

## Support

For issues or questions, check:
1. Browser console for JavaScript errors
2. `access.log` for authentication issues
3. PHP error logs for server-side errors
4. Verify file permissions on data directories


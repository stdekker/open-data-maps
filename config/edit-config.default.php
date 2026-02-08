<?php
/**
 * Edit Tool Configuration Template
 *
 * Copy this file to edit-config.php and customize for your installation
 *
 * IMPORTANT:
 * - Change the default credentials before deploying!
 * - Generate a new password hash using: php tools/generate-edit-password.php
 * - Never commit edit-config.php to version control
 */

// Authentication credentials (hashed)
// Default username: 'admin', password: 'changeme'
// TO CHANGE: Run 'php tools/generate-edit-password.php' and paste the hash below
define('EDIT_USERNAME', 'admin');
define('EDIT_PASSWORD_HASH', '...');

// Session configuration
define('SESSION_TIMEOUT', 3600); // 1 hour in seconds
define('SESSION_NAME', 'odm_edit_session');

// CSRF token settings
define('CSRF_TOKEN_NAME', 'csrf_token');

// Backup settings
define('MAX_BACKUPS_PER_FILE', 5);

// Path to data directory (config is now in /config/, data is in /web/data/)
define('DATA_DIR', __DIR__ . '/../web/data');
define('ELECTIONS_DIR', DATA_DIR . '/elections');

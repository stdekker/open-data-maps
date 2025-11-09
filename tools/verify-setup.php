<?php
/**
 * Setup Verification Script
 * 
 * Run this script to verify the edit tool is properly configured:
 * php verify-setup.php
 */

// Ensure this script is only run from command line
if (php_sapi_name() !== 'cli') {
    die('This script can only be run from the command line');
}

echo "====================================\n";
echo "Stembureau Editor - Setup Verification\n";
echo "====================================\n\n";

$errors = [];
$warnings = [];
$success = [];

// Check 1: Required files exist
echo "Checking required files...\n";
$requiredFiles = [
    'auth.php',
    'login.php',
    'logout.php',
    'index.php',
    '.htaccess',
    'api/list-stembureaus.php',
    'api/save-location.php',
    'style/edit.css',
    'src/edit.js'
];

// Check that config exists outside web directory
$configFile = __DIR__ . '/../config/edit-config.php';
$configTemplate = __DIR__ . '/../config/edit-config.default.php';
if (file_exists($configFile)) {
    $success[] = "✓ Found: config file (outside web directory)";
} else {
    $errors[] = "✗ Missing: config file at {$configFile}";
    if (file_exists($configTemplate)) {
        $warnings[] = "⚠ Copy edit-config.default.php to edit-config.php and customize it";
    } else {
        $errors[] = "✗ Missing: config template at {$configTemplate}";
    }
}

foreach ($requiredFiles as $file) {
    if (file_exists(__DIR__ . '/../web/edit/' . $file)) {
        $success[] = "✓ Found: $file";
    } else {
        $errors[] = "✗ Missing: $file";
    }
}

// Check 2: Configuration
echo "\nChecking configuration...\n";
require_once __DIR__ . '/../config/edit-config.php';

if (defined('EDIT_USERNAME') && defined('EDIT_PASSWORD_HASH')) {
    $success[] = "✓ Credentials configured";
    
    // Check if using default password
    $defaultHash = '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';
    if (EDIT_PASSWORD_HASH === $defaultHash) {
        $warnings[] = "⚠ Using default password - CHANGE THIS IMMEDIATELY!";
    } else {
        $success[] = "✓ Password changed from default";
    }
} else {
    $errors[] = "✗ Credentials not configured";
}

if (defined('SESSION_TIMEOUT')) {
    $success[] = "✓ Session timeout configured (" . SESSION_TIMEOUT . " seconds)";
} else {
    $warnings[] = "⚠ Session timeout not configured";
}

// Check 3: Data directories
echo "\nChecking data directories...\n";

if (defined('DATA_DIR') && file_exists(DATA_DIR)) {
    $success[] = "✓ Data directory exists: " . DATA_DIR;
} else {
    $errors[] = "✗ Data directory not found";
}

if (defined('ELECTIONS_DIR') && file_exists(ELECTIONS_DIR)) {
    $success[] = "✓ Elections directory exists: " . ELECTIONS_DIR;
    
    // Check for election data
    $elections = glob(ELECTIONS_DIR . '/*', GLOB_ONLYDIR);
    if (count($elections) > 0) {
        $success[] = "✓ Found " . count($elections) . " election(s)";
        foreach ($elections as $election) {
            $electionName = basename($election);
            $jsonFiles = glob($election . '/GM*.json');
            $success[] = "  - {$electionName}: " . count($jsonFiles) . " municipalities";
        }
    } else {
        $warnings[] = "⚠ No election data found";
    }
} else {
    $errors[] = "✗ Elections directory not found";
}

// Check 4: Permissions
echo "\nChecking permissions...\n";

if (defined('ELECTIONS_DIR') && file_exists(ELECTIONS_DIR)) {
    if (is_writable(ELECTIONS_DIR)) {
        $success[] = "✓ Elections directory is writable";
    } else {
        $errors[] = "✗ Elections directory is not writable (needed for backups)";
    }
}

// Check for access log
$logFile = __DIR__ . '/../logs/access.log';
if (file_exists($logFile)) {
    if (is_writable($logFile)) {
        $success[] = "✓ Access log exists and is writable";
    } else {
        $warnings[] = "⚠ Access log exists but is not writable";
    }
} else {
    $warnings[] = "⚠ Access log does not exist (will be created on first use)";
}

// Check 5: PHP requirements
echo "\nChecking PHP configuration...\n";

$phpVersion = phpversion();
if (version_compare($phpVersion, '7.4.0', '>=')) {
    $success[] = "✓ PHP version: {$phpVersion}";
} else {
    $errors[] = "✗ PHP version too old: {$phpVersion} (requires 7.4+)";
}

if (function_exists('password_hash')) {
    $success[] = "✓ Password hashing available";
} else {
    $errors[] = "✗ Password hashing not available";
}

if (function_exists('random_bytes')) {
    $success[] = "✓ Secure random available";
} else {
    $errors[] = "✗ Secure random not available";
}

// Check session configuration
$sessionPath = session_save_path();
if (empty($sessionPath)) {
    $sessionPath = sys_get_temp_dir();
}

if (is_writable($sessionPath)) {
    $success[] = "✓ Session directory writable: {$sessionPath}";
} else {
    $errors[] = "✗ Session directory not writable: {$sessionPath}";
}

// Check 6: Test municipality data
echo "\nChecking municipality data...\n";

$gemeentenFile = DATA_DIR . '/gemeenten.json';
if (file_exists($gemeentenFile)) {
    $gemeenten = json_decode(file_get_contents($gemeentenFile), true);
    if ($gemeenten && isset($gemeenten['features'])) {
        $success[] = "✓ Municipality data loaded: " . count($gemeenten['features']) . " municipalities";
    } else {
        $errors[] = "✗ Municipality data file corrupt";
    }
} else {
    $errors[] = "✗ Municipality data file not found: {$gemeentenFile}";
}

// Print results
echo "\n====================================\n";
echo "Results\n";
echo "====================================\n\n";

if (count($success) > 0) {
    echo "SUCCESS (" . count($success) . "):\n";
    foreach ($success as $msg) {
        echo "  $msg\n";
    }
    echo "\n";
}

if (count($warnings) > 0) {
    echo "WARNINGS (" . count($warnings) . "):\n";
    foreach ($warnings as $msg) {
        echo "  $msg\n";
    }
    echo "\n";
}

if (count($errors) > 0) {
    echo "ERRORS (" . count($errors) . "):\n";
    foreach ($errors as $msg) {
        echo "  $msg\n";
    }
    echo "\n";
}

// Final verdict
echo "====================================\n";
if (count($errors) === 0) {
    echo "✓ Setup verification PASSED\n";
    if (count($warnings) > 0) {
        echo "  Please review warnings above\n";
    }
    echo "\nYou can now access the editor at: /edit/\n";
    exit(0);
} else {
    echo "✗ Setup verification FAILED\n";
    echo "  Please fix errors above before using the editor\n";
    exit(1);
}


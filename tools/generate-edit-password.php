<?php
/**
 * Password Hash Generator
 * 
 * Run this script from the command line to generate a new password hash:
 * php generate-password.php
 */

// Ensure this script is only run from command line
if (php_sapi_name() !== 'cli') {
    die('This script can only be run from the command line');
}

echo "====================================\n";
echo "Password Hash Generator\n";
echo "====================================\n\n";

// Get password from user
echo "Enter new password: ";
$password = trim(fgets(STDIN));

if (empty($password)) {
    die("Error: Password cannot be empty\n");
}

// Confirm password
echo "Confirm password: ";
$confirm = trim(fgets(STDIN));

if ($password !== $confirm) {
    die("Error: Passwords do not match\n");
}

// Generate hash
$hash = password_hash($password, PASSWORD_DEFAULT);

echo "\n====================================\n";
echo "Generated Hash:\n";
echo "====================================\n";
echo "$hash\n\n";

echo "Copy this hash to config/edit-config.php:\n";
echo "define('EDIT_PASSWORD_HASH', '$hash');\n\n";

echo "Password strength: ";
$length = strlen($password);
if ($length < 8) {
    echo "WEAK (too short)\n";
} elseif ($length < 12) {
    echo "MODERATE\n";
} else {
    echo "STRONG\n";
}

echo "\n";


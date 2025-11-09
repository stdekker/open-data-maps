<?php
/**
 * Logout Handler
 */

require_once __DIR__ . '/../../config/edit-config.php';
require_once __DIR__ . '/auth.php';

// Log the logout
if (isset($_SESSION['username'])) {
    logAccess('LOGOUT', true);
}

// Destroy the session
session_destroy();

// Redirect to login page
header('Location: login.php');
exit;


<?php
/**
 * Authentication Helper
 * 
 * Include this file at the top of any protected edit page.
 * It will check for valid authentication and redirect to login if needed.
 */

require_once __DIR__ . '/../../config/edit-config.php';

// Start session if not already started
if (session_status() === PHP_SESSION_NONE) {
    session_name(SESSION_NAME);
    session_start();
}

/**
 * Check if user is authenticated
 * @return bool True if authenticated, false otherwise
 */
function isAuthenticated() {
    if (!isset($_SESSION['authenticated']) || $_SESSION['authenticated'] !== true) {
        return false;
    }
    
    // Check session timeout
    if (isset($_SESSION['last_activity'])) {
        $elapsed = time() - $_SESSION['last_activity'];
        if ($elapsed > SESSION_TIMEOUT) {
            // Session expired
            session_destroy();
            return false;
        }
    }
    
    // Update last activity time
    $_SESSION['last_activity'] = time();
    
    return true;
}

/**
 * Require authentication or redirect to login
 */
function requireAuth() {
    if (!isAuthenticated()) {
        header('Location: login.php');
        exit;
    }
}

/**
 * Generate CSRF token
 * @return string The CSRF token
 */
function generateCsrfToken() {
    if (!isset($_SESSION[CSRF_TOKEN_NAME])) {
        $_SESSION[CSRF_TOKEN_NAME] = bin2hex(random_bytes(32));
    }
    return $_SESSION[CSRF_TOKEN_NAME];
}

/**
 * Verify CSRF token
 * @param string $token The token to verify
 * @return bool True if valid, false otherwise
 */
function verifyCsrfToken($token) {
    if (!isset($_SESSION[CSRF_TOKEN_NAME])) {
        return false;
    }
    return hash_equals($_SESSION[CSRF_TOKEN_NAME], $token);
}

/**
 * Log access attempts
 * @param string $action The action being logged
 * @param bool $success Whether the action was successful
 */
function logAccess($action, $success = true) {
    $logFile = __DIR__ . '/../../logs/access.log';
    $timestamp = date('Y-m-d H:i:s');
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $status = $success ? 'SUCCESS' : 'FAILED';
    $username = $_SESSION['username'] ?? 'anonymous';
    
    $logEntry = "[$timestamp] $status - $action - User: $username - IP: $ip\n";
    error_log($logEntry, 3, $logFile);
}

// If this file is included directly, require authentication
// This prevents direct access to this file
if (basename(__FILE__) !== basename($_SERVER['SCRIPT_FILENAME'])) {
    // File is being included, do nothing
} else {
    // File is being accessed directly, redirect to login
    header('Location: login.php');
    exit;
}


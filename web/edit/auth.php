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

/**
 * Check if an IP is currently locked out due to too many failed login attempts
 * @param string $ip The IP address to check
 * @return array ['locked' => bool, 'remaining_time' => int (seconds)]
 */
function isIpLockedOut($ip) {
    $lockoutFile = __DIR__ . '/../../logs/login-attempts.json';
    $lockoutDuration = 900; // 15 minutes in seconds
    $maxAttempts = 5;
    
    if (!file_exists($lockoutFile)) {
        return ['locked' => false, 'remaining_time' => 0];
    }
    
    $data = json_decode(file_get_contents($lockoutFile), true);
    if (!$data || !isset($data[$ip])) {
        return ['locked' => false, 'remaining_time' => 0];
    }
    
    $ipData = $data[$ip];
    $lockoutTime = $ipData['lockout_time'] ?? 0;
    $attempts = $ipData['attempts'] ?? 0;
    
    // Check if lockout has expired
    if ($lockoutTime > 0 && (time() - $lockoutTime) < $lockoutDuration) {
        $remainingTime = $lockoutDuration - (time() - $lockoutTime);
        return ['locked' => true, 'remaining_time' => $remainingTime];
    }
    
    return ['locked' => false, 'remaining_time' => 0];
}

/**
 * Record a failed login attempt for an IP
 * @param string $ip The IP address
 */
function recordFailedLoginAttempt($ip) {
    $lockoutFile = __DIR__ . '/../../logs/login-attempts.json';
    $maxAttempts = 5;
    
    // Ensure logs directory exists
    $logsDir = __DIR__ . '/../../logs';
    if (!is_dir($logsDir)) {
        mkdir($logsDir, 0775, true);
    }
    
    // Load existing data
    $data = [];
    if (file_exists($lockoutFile)) {
        $data = json_decode(file_get_contents($lockoutFile), true) ?: [];
    }
    
    // Initialize or increment attempts
    if (!isset($data[$ip])) {
        $data[$ip] = ['attempts' => 1, 'first_attempt' => time(), 'lockout_time' => 0];
    } else {
        $data[$ip]['attempts']++;
    }
    
    // Lock out if max attempts reached
    if ($data[$ip]['attempts'] >= $maxAttempts) {
        $data[$ip]['lockout_time'] = time();
        logAccess("IP_LOCKOUT - Too many failed attempts", false);
    }
    
    // Clean up old entries (older than 1 hour)
    $data = array_filter($data, function($entry) {
        $lastActivity = max($entry['first_attempt'] ?? 0, $entry['lockout_time'] ?? 0);
        return (time() - $lastActivity) < 3600;
    });
    
    // Save data
    file_put_contents($lockoutFile, json_encode($data, JSON_PRETTY_PRINT));
}

/**
 * Clear failed login attempts for an IP (called on successful login)
 * @param string $ip The IP address
 */
function clearFailedLoginAttempts($ip) {
    $lockoutFile = __DIR__ . '/../../logs/login-attempts.json';
    
    if (!file_exists($lockoutFile)) {
        return;
    }
    
    $data = json_decode(file_get_contents($lockoutFile), true) ?: [];
    
    if (isset($data[$ip])) {
        unset($data[$ip]);
        file_put_contents($lockoutFile, json_encode($data, JSON_PRETTY_PRINT));
    }
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


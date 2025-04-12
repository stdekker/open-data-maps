<?php
/**
 * API Security Helper Functions
 */

/**
 * Set common security HTTP headers.
 * Includes CORS headers if enabled in config.prod.php
 */
function setSecurityHeaders() {
    // Include config for CORS settings
    require_once __DIR__ . '/../config.prod.php';

    // Standard security headers
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    
    // Set CORS headers if enabled in config
    if (isset($CORS_ENABLED) && $CORS_ENABLED === true) {
        // Set allowed origins
        if (!empty($CORS_ALLOWED_ORIGINS)) {
            // If we have a specific list of domains, check against the Origin header
            if (isset($_SERVER['HTTP_ORIGIN'])) {
                $origin = $_SERVER['HTTP_ORIGIN'];
                
                // If the origin is in our allowed list, set it specifically
                if (in_array($origin, $CORS_ALLOWED_ORIGINS, true) || in_array('*', $CORS_ALLOWED_ORIGINS, true)) {
                    header('Access-Control-Allow-Origin: ' . $origin);
                    header('Access-Control-Allow-Credentials: true');
                }
            }
            // If we have * in our allowed origins, allow any origin
            elseif (in_array('*', $CORS_ALLOWED_ORIGINS, true)) {
                header('Access-Control-Allow-Origin: *');
            }
        }
        
        // Set allowed methods
        if (isset($CORS_ALLOWED_METHODS) && $CORS_ALLOWED_METHODS) {
            header('Access-Control-Allow-Methods: ' . $CORS_ALLOWED_METHODS);
        }
        
        // Handle preflight OPTIONS request
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(204); // No content
            exit;
        }
    }
}

/**
 * Validate input based on expected format using regex.
 * Exits with 400 Bad Request on failure.
 *
 * @param string $input The input value to validate.
 * @param string $pattern The regex pattern to match against.
 * @param string $errorMessage The error message to display on failure.
 * @return string The validated input.
 */
function validateInputRegex(?string $input, string $pattern, string $errorMessage): string {
    if ($input === null || !preg_match($pattern, $input)) {
        http_response_code(400);
        // Optional: Log the failed validation attempt
        // error_log("Validation failed: " . $errorMessage . " - Input: " . $input);
        die(json_encode(['error' => $errorMessage]));
    }
    return $input;
}

/**
 * Validate input ensuring it is one of the allowed values.
 * Exits with 400 Bad Request on failure.
 *
 * @param string $input The input value to validate.
 * @param array $allowedValues An array of allowed string values.
 * @param string $errorMessage The error message to display on failure.
 * @return string The validated input.
 */
function validateAllowedValues(?string $input, array $allowedValues, string $errorMessage): string {
    if ($input === null || !in_array($input, $allowedValues, true)) {
        http_response_code(400);
        die(json_encode(['error' => $errorMessage]));
    }
    return $input;
}

/**
 * Sanitize a string intended to be used as a file or directory name component.
 * Uses basename() to prevent path traversal.
 *
 * @param string $component The input string.
 * @return string The sanitized component.
 */
function sanitizePathComponent(string $component): string {
    // Using basename() is a robust way to prevent directory traversal attacks
    return basename($component);
}

?> 
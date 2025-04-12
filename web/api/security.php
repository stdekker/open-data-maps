<?php
/**
 * API Security Helper Functions
 */

/**
 * Set common security HTTP headers.
 */
function setSecurityHeaders() {
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    // Consider adding CORS headers if needed, restrict origins:
    // header('Access-Control-Allow-Origin: https://your-allowed-domain.com');
    // header('Access-Control-Allow-Methods: GET');
    // Content-Security-Policy can be complex, add carefully:
    // header('Content-Security-Policy: default-src \'self\'');
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
<?php
/**
 * API Rate Limiter
 * 
 * Provides IP-based rate limiting for API endpoints to prevent abuse
 */

/**
 * Check if an IP has exceeded the rate limit
 * 
 * @param string $ip The IP address to check
 * @param int $maxRequests Maximum number of requests allowed in the time window
 * @param int $timeWindow Time window in seconds (default: 60 seconds)
 * @param string $endpoint Optional endpoint identifier for per-endpoint limits
 * @return array ['limited' => bool, 'retry_after' => int (seconds), 'remaining' => int]
 */
function checkRateLimit($ip, $maxRequests = 60, $timeWindow = 60, $endpoint = 'default') {
    $rateLimitFile = __DIR__ . '/../../logs/rate-limits.json';
    
    // Ensure logs directory exists
    $logsDir = __DIR__ . '/../../logs';
    if (!is_dir($logsDir)) {
        mkdir($logsDir, 0775, true);
    }
    
    // Load existing rate limit data
    $data = [];
    if (file_exists($rateLimitFile)) {
        $data = json_decode(file_get_contents($rateLimitFile), true) ?: [];
    }
    
    $currentTime = time();
    $key = $endpoint . ':' . $ip;
    
    // Initialize or get existing requests for this IP/endpoint
    if (!isset($data[$key])) {
        $data[$key] = ['requests' => [], 'first_request' => $currentTime];
    }
    
    // Remove requests outside the time window
    $data[$key]['requests'] = array_filter($data[$key]['requests'], function($timestamp) use ($currentTime, $timeWindow) {
        return ($currentTime - $timestamp) < $timeWindow;
    });
    
    // Reindex array after filtering
    $data[$key]['requests'] = array_values($data[$key]['requests']);
    
    // Count requests in the current window
    $requestCount = count($data[$key]['requests']);
    
    // Check if limit is exceeded
    if ($requestCount >= $maxRequests) {
        // Calculate when the oldest request will expire
        $oldestRequest = min($data[$key]['requests']);
        $retryAfter = $timeWindow - ($currentTime - $oldestRequest);
        
        // Clean up old entries for other IPs (keep data from last hour only)
        $data = array_filter($data, function($entry) use ($currentTime) {
            $lastRequest = !empty($entry['requests']) ? max($entry['requests']) : ($entry['first_request'] ?? 0);
            return ($currentTime - $lastRequest) < 3600;
        });
        
        // Save the cleaned data
        file_put_contents($rateLimitFile, json_encode($data, JSON_PRETTY_PRINT));
        
        return [
            'limited' => true,
            'retry_after' => max(1, ceil($retryAfter)),
            'remaining' => 0
        ];
    }
    
    // Record this request
    $data[$key]['requests'][] = $currentTime;
    
    // Clean up old entries for other IPs (keep data from last hour only)
    $data = array_filter($data, function($entry) use ($currentTime) {
        $lastRequest = !empty($entry['requests']) ? max($entry['requests']) : ($entry['first_request'] ?? 0);
        return ($currentTime - $lastRequest) < 3600;
    });
    
    // Save updated data
    file_put_contents($rateLimitFile, json_encode($data, JSON_PRETTY_PRINT));
    
    return [
        'limited' => false,
        'retry_after' => 0,
        'remaining' => $maxRequests - ($requestCount + 1)
    ];
}

/**
 * Enforce rate limiting and send appropriate HTTP response if limit exceeded
 * 
 * @param int $maxRequests Maximum number of requests allowed in the time window
 * @param int $timeWindow Time window in seconds (default: 60 seconds)
 * @param string $endpoint Optional endpoint identifier for per-endpoint limits
 * @return bool True if request is allowed, exits with 429 if rate limited
 */
function enforceRateLimit($maxRequests = 60, $timeWindow = 60, $endpoint = 'default') {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    
    // Don't rate limit unknown IPs (local development, etc.)
    if ($ip === 'unknown' || $ip === '127.0.0.1' || $ip === '::1') {
        return true;
    }
    
    $result = checkRateLimit($ip, $maxRequests, $timeWindow, $endpoint);
    
    // Set rate limit headers
    header('X-RateLimit-Limit: ' . $maxRequests);
    header('X-RateLimit-Remaining: ' . $result['remaining']);
    
    if ($result['limited']) {
        // Log rate limit violation
        $logFile = __DIR__ . '/../../logs/rate-limit-violations.log';
        $timestamp = date('Y-m-d H:i:s');
        $logEntry = "[$timestamp] RATE_LIMITED - Endpoint: $endpoint - IP: $ip - Retry after: {$result['retry_after']}s\n";
        error_log($logEntry, 3, $logFile);
        
        // Send 429 Too Many Requests response
        http_response_code(429);
        header('Retry-After: ' . $result['retry_after']);
        header('Content-Type: application/json');
        
        echo json_encode([
            'error' => 'Too many requests',
            'message' => 'You have exceeded the rate limit. Please try again later.',
            'retry_after' => $result['retry_after']
        ]);
        
        exit;
    }
    
    return true;
}


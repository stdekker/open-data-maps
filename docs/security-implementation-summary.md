# Security Enhancements Implementation Summary

This document summarizes the security enhancements implemented for the Open Data Maps application on **November 9, 2025**.

## Overview

Two critical security features were implemented to protect against automated attacks and API abuse:

1. **Brute-Force Protection** - Prevents attackers from repeatedly guessing login credentials
2. **API Rate Limiting** - Prevents abuse of public API endpoints through excessive requests

---

## 1. Brute-Force Protection for Login

### Implementation Details

**Files Modified:**
- `web/edit/auth.php` - Added brute-force protection functions
- `web/edit/login.php` - Integrated brute-force protection into login flow

**How It Works:**

1. **IP-Based Tracking**: Each failed login attempt is tracked by IP address
2. **Lockout Threshold**: After 5 failed attempts, the IP is locked out for 15 minutes
3. **Automatic Cleanup**: Old entries (>1 hour) are automatically removed to prevent file bloat
4. **Success Reset**: Successful login clears all failed attempts for that IP

**New Functions Added to `auth.php`:**

- `isIpLockedOut($ip)` - Checks if an IP is currently locked out
  - Returns: `['locked' => bool, 'remaining_time' => int]`
  
- `recordFailedLoginAttempt($ip)` - Records a failed login attempt
  - Increments attempt counter
  - Sets lockout timestamp when threshold (5 attempts) is reached
  - Logs lockout events
  
- `clearFailedLoginAttempts($ip)` - Clears failed attempts on successful login

**Data Storage:**

- Location: `logs/login-attempts.json`
- Format:
  ```json
  {
    "192.168.1.100": {
      "attempts": 3,
      "first_attempt": 1699564800,
      "lockout_time": 0
    }
  }
  ```

**User Experience:**

When an IP is locked out, users see:
> "Too many failed login attempts. Please try again in X minute(s)."

**Security Features:**

- ✅ Prevents brute-force password guessing
- ✅ Automatic lockout after 5 failed attempts
- ✅ 15-minute lockout duration
- ✅ All lockout events are logged
- ✅ Session regeneration on successful login (existing feature)
- ✅ CSRF token protection (existing feature)

---

## 2. API Rate Limiting

### Implementation Details

**Files Created:**
- `web/api/rate-limiter.php` - Reusable rate limiting utility

**Files Modified:**
- `web/api/municipality.php` - Added rate limiting
- `web/api/elections.php` - Added rate limiting
- `web/api/postcode6.php` - Added rate limiting
- `web/api/bag.php` - Added rate limiting

**How It Works:**

1. **Sliding Window**: Uses a sliding time window (default: 60 seconds)
2. **Per-Endpoint Limits**: Each API endpoint has its own limit
3. **IP-Based**: Rate limiting is applied per IP address
4. **HTTP 429 Response**: Returns proper "Too Many Requests" status when limit exceeded

**Rate Limits Applied:**

All public APIs are limited to **60 requests per minute** per IP address:
- `municipality` endpoint: 60 req/min
- `elections` endpoint: 60 req/min
- `postcode6` endpoint: 60 req/min
- `bag` endpoint: 60 req/min

**New Functions in `rate-limiter.php`:**

- `checkRateLimit($ip, $maxRequests, $timeWindow, $endpoint)` - Checks if IP has exceeded limit
  - Returns: `['limited' => bool, 'retry_after' => int, 'remaining' => int]`
  
- `enforceRateLimit($maxRequests, $timeWindow, $endpoint)` - Enforces rate limit and exits if exceeded
  - Sends HTTP 429 response if limit exceeded
  - Sets rate limit headers
  - Logs violations

**Data Storage:**

- Location: `logs/rate-limits.json`
- Format:
  ```json
  {
    "municipality:192.168.1.100": {
      "requests": [1699564800, 1699564802, 1699564805],
      "first_request": 1699564800
    }
  }
  ```

**HTTP Headers Added:**

The rate limiter adds standard rate limit headers to all API responses:
- `X-RateLimit-Limit: 60` - Maximum requests allowed
- `X-RateLimit-Remaining: 45` - Requests remaining in current window
- `Retry-After: 30` - Seconds to wait before retrying (when limited)

**Response When Rate Limited:**

HTTP Status: `429 Too Many Requests`

```json
{
  "error": "Too many requests",
  "message": "You have exceeded the rate limit. Please try again later.",
  "retry_after": 30
}
```

**Exemptions:**

Local development IPs are not rate limited:
- `127.0.0.1` (localhost IPv4)
- `::1` (localhost IPv6)
- `unknown` (when IP cannot be determined)

**Security Features:**

- ✅ Prevents API abuse and DoS attacks
- ✅ Per-endpoint rate limiting
- ✅ Automatic cleanup of old entries
- ✅ All violations are logged
- ✅ Standard HTTP 429 responses with Retry-After headers
- ✅ Does not impact legitimate usage (60 req/min is generous)

---

## Log Files

Both features create log files in the `logs/` directory:

1. **`logs/login-attempts.json`** - Tracks failed login attempts and lockouts
2. **`logs/rate-limits.json`** - Tracks API request rates per IP
3. **`logs/rate-limit-violations.log`** - Human-readable log of rate limit violations
4. **`logs/access.log`** - Existing access log (now includes lockout events)

**Log Maintenance:**

Both features automatically clean up old entries:
- Login attempts: Entries older than 1 hour are removed
- Rate limits: Entries older than 1 hour are removed

This prevents log files from growing indefinitely.

---

## Configuration

### Brute-Force Protection Settings

Currently hardcoded in `web/edit/auth.php`:
- `$maxAttempts = 5` - Number of failed attempts before lockout
- `$lockoutDuration = 900` - Lockout duration in seconds (15 minutes)

### Rate Limiting Settings

Applied per endpoint in API files:
- `$maxRequests = 60` - Maximum requests allowed
- `$timeWindow = 60` - Time window in seconds
- `$endpoint` - Unique identifier for the endpoint

**To modify rate limits**, edit the `enforceRateLimit()` call in each API file:

```php
// Example: Lower limit for a specific endpoint
enforceRateLimit(30, 60, 'municipality'); // 30 requests per minute
```

---

## Testing Recommendations

### Test Brute-Force Protection

1. **Test lockout mechanism:**
   - Make 5 failed login attempts from the same IP
   - Verify you receive a lockout message
   - Verify you cannot log in even with correct credentials during lockout
   
2. **Test lockout expiration:**
   - Wait 15 minutes after lockout
   - Verify you can attempt login again
   
3. **Test successful login reset:**
   - Make 2-3 failed attempts
   - Log in successfully
   - Make 2-3 more failed attempts
   - Verify lockout counter was reset (should take 5 total, not 2)

### Test API Rate Limiting

1. **Test rate limit enforcement:**
   - Write a script to make 65 requests to an API endpoint within 1 minute
   - Verify requests 61+ receive HTTP 429 responses
   
2. **Test rate limit headers:**
   - Make a few requests to any API
   - Check response headers for `X-RateLimit-Limit` and `X-RateLimit-Remaining`
   
3. **Test rate limit reset:**
   - Trigger rate limit (make 61 requests)
   - Wait 60 seconds
   - Verify you can make requests again

4. **Test per-endpoint limits:**
   - Make 60 requests to `municipality.php`
   - Verify you can still access `elections.php` (separate limit)

### Test Log Files

1. **Verify log creation:**
   - Trigger both features
   - Check that log files are created in `logs/` directory
   
2. **Verify log cleanup:**
   - Add old test entries (timestamps from >1 hour ago)
   - Trigger the features
   - Verify old entries are removed

---

## Security Considerations

### Strengths

1. **Defense in Depth**: Both features work together to protect different attack vectors
2. **Minimal Impact**: Generous limits that don't affect legitimate users
3. **Proper HTTP Standards**: Uses standard status codes and headers
4. **Automatic Maintenance**: Logs clean themselves up
5. **Detailed Logging**: All security events are logged for analysis

### Limitations

1. **IP-Based Tracking**: 
   - Can be bypassed with multiple IP addresses (VPN, proxy)
   - May impact legitimate users behind NAT (shared IP)
   
2. **File-Based Storage**:
   - May not scale to very high traffic (consider Redis/Memcached for production)
   - File locking could be an issue with concurrent requests (minimal risk for this application)
   
3. **No CAPTCHA**: 
   - Brute-force protection doesn't include CAPTCHA
   - Consider adding after 2-3 failed attempts for additional security

### Recommendations for Production

1. **Monitor Logs**: Regularly review `rate-limit-violations.log` and `access.log`
2. **Adjust Limits**: Monitor usage patterns and adjust limits as needed
3. **Consider Redis**: For high-traffic production, migrate to Redis for rate limiting
4. **Add Alerts**: Set up alerts for suspicious patterns (many lockouts from different IPs)
5. **Add CAPTCHA**: Consider adding CAPTCHA to login form for additional protection

---

## Maintenance

### Adjusting Configuration

To change brute-force protection settings, edit `web/edit/auth.php`:

```php
function isIpLockedOut($ip) {
    // Change these values:
    $lockoutDuration = 900; // 15 minutes
    $maxAttempts = 5;       // 5 failed attempts
    // ...
}
```

To change API rate limits, edit the individual API files:

```php
// In web/api/municipality.php (and others):
enforceRateLimit(60, 60, 'municipality');
//               ^   ^    ^
//               |   |    endpoint identifier
//               |   time window (seconds)
//               max requests
```

### Log Rotation

The application automatically cleans up old entries in JSON log files. However, the text log files (`access.log`, `rate-limit-violations.log`) will continue to grow.

**Recommendation**: Set up log rotation using `logrotate` or similar:

```bash
# Example logrotate config
/home/sdkkr/dev/maps/logs/*.log {
    weekly
    rotate 4
    compress
    missingok
    notifempty
}
```

---

## Summary

Both security features have been successfully implemented and are now active:

✅ **Brute-Force Protection**: Login page is protected against password guessing attacks
✅ **API Rate Limiting**: All public APIs are protected against abuse

The implementation follows security best practices, uses standard HTTP status codes, includes comprehensive logging, and has minimal impact on legitimate users.


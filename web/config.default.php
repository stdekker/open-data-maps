<?php
/**
 * Default configuration file
 * Copy this file to config.prod.php and customize for production
 */

$PROD_SCRIPTS = [
    // Add head scripts here
    'head' => [
        // Google Analytics example
        // '<script async src="https://www.googletagmanager.com/gtag/js?id=YOUR-ID"></script>',
        // '<script>
        //     window.dataLayer = window.dataLayer || [];
        //     function gtag(){dataLayer.push(arguments);}
        //     gtag("js", new Date());
        //     gtag("config", "YOUR-ID");
        // </script>'
    ],
    // Add end-of-body scripts here
    'body' => [
        // Sentry example
        // '<script
        //     src="https://browser.sentry-cdn.com/VERSION/bundle.min.js"
        //     crossorigin="anonymous"
        // ></script>',
        // '<script>
        //     Sentry.init({
        //         dsn: "YOUR-DSN",
        //         environment: "production"
        //     });
        // </script>'
    ]
]; 

// Cache configuration for postcode6 responses (in seconds)
$CACHE_PC6_DURATION = 31536000; // 365 days

// Allowed domains for API endpoints (empty array means any domain is allowed)
$ALLOWED_DOMAINS = [
    // Add your allowed domains here, e.g. 'example.com', 'maps.yourdomain.org'
    // Leave empty to allow any domain (not recommended for production)
];

// CORS (Cross-Origin Resource Sharing) settings
$CORS_ENABLED = false; // Set to true to enable CORS headers
$CORS_ALLOWED_ORIGINS = [
    // Domains that can access the API via CORS
    // Example: 'https://example.com', 'https://subdomain.example.org'
    // Use '*' for any origin (not recommended for production)
    // 'https://maps.ddev.site'
];
$CORS_ALLOWED_METHODS = 'GET, OPTIONS'; // Default methods for API endpoints 
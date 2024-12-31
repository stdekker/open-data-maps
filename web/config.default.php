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
<?php
require_once __DIR__ . '/security.php';

setSecurityHeaders();
header('Content-Type: application/json');

require_once __DIR__ . '/../../vendor/autoload.php';
require_once __DIR__ . '/../config.prod.php';

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;

// Validate and sanitize input
$postcode4 = $_GET['postcode4'] ?? null;
$validatedPostcode4 = validateInputRegex($postcode4, '/^[0-9]{4}$/', 'Invalid postcode4 value. Must be 4 digits');
$sanitizedPostcode4 = sanitizePathComponent($validatedPostcode4);

// Check if CACHE_PC6_DURATION is defined
if (!isset($CACHE_PC6_DURATION)) {
    // Default to 1 day if not defined in config
    $CACHE_PC6_DURATION = 86400;
}

// Define cache directory and cache file path using sanitized input
$cacheDir  = __DIR__ . '/../data/pc6/';
$cacheFile = $cacheDir . $sanitizedPostcode4 . '.json';

// Check if a valid cache exists
if (file_exists($cacheFile) && (filemtime($cacheFile) + $CACHE_PC6_DURATION) > time()) {
    $cachedResponse = file_get_contents($cacheFile);
    if ($cachedResponse !== false) {
        echo $cachedResponse;
        exit;
    }
}

$client = new Client([
    'verify' => false,
    'timeout' => 30,
]);

$filter = sprintf(
    '<Filter xmlns="http://www.opengis.net/fes/2.0"><PropertyIsLike wildCard="*" singleChar="." escapeChar="\\"><PropertyName>postcode6</PropertyName><Literal>%s*</Literal></PropertyIsLike></Filter>',
    $validatedPostcode4
);

$wfsUrl = 'https://service.pdok.nl/cbs/postcode6/2023/wfs/v1_0';
$params = [
    'service' => 'WFS',
    'version' => '2.0.0',
    'request' => 'GetFeature',
    'typeName' => 'postcode6',
    'outputFormat' => 'application/json',
    'srsName' => 'EPSG:4326',
    'filter' => $filter
];

try {
    $response = $client->get($wfsUrl, [
        'query' => $params,
        'headers' => [
            'Accept' => 'application/json'
        ]
    ]);

    // Check if response is JSON
    $contentType = $response->getHeaderLine('Content-Type');
    if (!str_contains($contentType, 'application/json')) {
        http_response_code(500);
        echo json_encode([
            'error' => 'Invalid response type from PDOK service',
            'content_type' => $contentType
        ]);
        exit;
    }

    $body = (string)$response->getBody();
    
    // Try to decode JSON and validate structure
    $data = json_decode($body, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(500);
        echo json_encode([
            'error' => 'Error decoding JSON response',
            'details' => json_last_error_msg()
        ]);
        exit;
    }

    // Validate GeoJSON structure
    if (!isset($data['type']) || $data['type'] !== 'FeatureCollection' || !isset($data['features'])) {
        http_response_code(500);
        echo json_encode([
            'error' => 'Invalid GeoJSON response from PDOK service'
        ]);
        exit;
    }

    if (empty($data['features'])) {
        http_response_code(404);
        echo json_encode([
            'error' => 'No data found for postcode: ' . $validatedPostcode4,
            'type' => 'FeatureCollection',
            'features' => []
        ]);
        exit;
    }

    // Write cached file on successful API response
    if (!is_dir($cacheDir)) {
        mkdir($cacheDir, 0775, true);
    }
    file_put_contents($cacheFile, $body);

    echo $body;

} catch (RequestException $e) {
    $error = ['error' => 'PDOK service request failed'];
    
    if ($e->hasResponse()) {
        $error['status'] = $e->getResponse()->getStatusCode();
    }
    
    http_response_code(500);
    echo json_encode($error);
    exit;
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'An internal server error occurred'
    ]);
    exit;
} 
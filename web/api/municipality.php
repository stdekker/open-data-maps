<?php
require_once __DIR__ . '/../../vendor/autoload.php';
require_once __DIR__ . '/security.php';

setSecurityHeaders();
header('Content-Type: application/json');

// Validate and sanitize input
$code = $_GET['code'] ?? null;
$validatedCode = validateInputRegex($code, '/^[a-zA-Z0-9]+$/', 'Invalid gemeente code');
$sanitizedCode = sanitizePathComponent($validatedCode);

// Function to fetch and save gemeente data
function fetchGemeente($code) {
    // Updated path to store CBS data in a dedicated directory
    $dataDir = __DIR__ . '/../data/cbs/2023';
    $gemeenteFile = $dataDir . '/' . $code . '.json';

    // Create directory structure if it doesn't exist
    if (!is_dir($dataDir)) {
        mkdir($dataDir, 0777, true);
    }

    // Skip if file exists
    if (file_exists($gemeenteFile)) {
        return;
    }

    $baseUrl = 'https://service.pdok.nl/cbs/wijkenbuurten/2024/wfs/v1_0';
    $params = [
        'service' => 'WFS',
        'request' => 'GetFeature',
        'version' => '1.1.0',
        'typeName' => 'wijkenbuurten:buurten',
        'outputFormat' => 'json',
        'srsName' => 'EPSG:4326',
        'filter' => '<ogc:Filter><ogc:And><ogc:PropertyIsEqualTo><ogc:PropertyName>gemeentecode</ogc:PropertyName><ogc:Literal>' . $code . '</ogc:Literal></ogc:PropertyIsEqualTo><ogc:PropertyIsNotEqualTo><ogc:PropertyName>water</ogc:PropertyName><ogc:Literal>JA</ogc:Literal></ogc:PropertyIsNotEqualTo></ogc:And></ogc:Filter>'
    ];

    $url = $baseUrl . '?' . http_build_query($params);
    $response = file_get_contents($url);
    
    if ($response === false) {
        return;
    }

    // Decode and process the data
    $data = json_decode($response, true);

    // Replace -99999999 with null
    array_walk_recursive($data, function (&$item) {
        if ($item === -99999999) {
            $item = null;
        }
    });

    // Save the processed data
    file_put_contents($gemeenteFile, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
}

// Handle web requests
if (!isset($_GET['code'])) {
    header('Content-Type: application/json');
    http_response_code(400);
    echo json_encode(['error' => 'Missing gemeente code']);
    exit;
}

// For web requests, always serve from cache if available
$gemeenteFile = __DIR__ . '/../data/cbs/2023/' . $sanitizedCode . '.json';
fetchGemeente($sanitizedCode);

if (file_exists($gemeenteFile)) {
    header('Content-Type: application/json');
    echo file_get_contents($gemeenteFile);
} else {
    header('Content-Type: application/json');
    http_response_code(404);
    echo json_encode(['error' => 'Gemeente data not found']);
}
<?php
require_once __DIR__ . '/../../vendor/autoload.php';
require_once __DIR__ . '/security.php';

setSecurityHeaders();
header('Content-Type: application/json');

// Validate and sanitize input
$code = $_GET['code'] ?? null;
$type = $_GET['type'] ?? 'buurten'; // Default to 'buurten' if not specified
$validatedCode = validateInputRegex($code, '/^[a-zA-Z0-9]+$/', 'Invalid gemeente code');
$sanitizedCode = sanitizePathComponent($validatedCode);
$validatedType = validateInputRegex($type, '/^(wijken|buurten)$/', 'Invalid type. Must be either "wijken" or "buurten"');
$sanitizedType = sanitizePathComponent($validatedType);

// Function to fetch and save gemeente data
function fetchGemeente($code, $type) {
    // Updated path to store CBS data in a dedicated directory with type-specific naming
    $dataDir = __DIR__ . '/../data/cbs/2023';
    $gemeenteFile = $dataDir . '/' . $code . '-' . $type . '.json';

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
        'typeName' => 'wijkenbuurten:' . $type,
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
$gemeenteFile = __DIR__ . '/../data/cbs/2023/' . $sanitizedCode . '-' . $sanitizedType . '.json';
$oldFormatFile = __DIR__ . '/../data/cbs/2023/' . $sanitizedCode . '.json';

fetchGemeente($sanitizedCode, $sanitizedType);

// First check if the new format file exists
if (file_exists($gemeenteFile)) {
    header('Content-Type: application/json');
    echo file_get_contents($gemeenteFile);
} 
// Then check for old format file (for backward compatibility)
else if (file_exists($oldFormatFile) && $sanitizedType == 'buurten') {
    // If looking for buurten and old format exists, rename it to the new format
    rename($oldFormatFile, $gemeenteFile);
    header('Content-Type: application/json');
    echo file_get_contents($gemeenteFile);
} 
// If no files exist, return error
else {
    header('Content-Type: application/json');
    http_response_code(404);
    echo json_encode(['error' => 'Gemeente data not found']);
}
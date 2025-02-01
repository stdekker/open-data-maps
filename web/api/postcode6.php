<?php
header('Content-Type: application/json');

require_once __DIR__ . '/../../vendor/autoload.php';
require_once __DIR__ . '/../config.prod.php';

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;

// Get postcode4 from query parameter
$postcode4 = $_GET['postcode4'] ?? null;

if (!$postcode4) {
    http_response_code(400);
    echo json_encode(['error' => 'No postcode4 provided']);
    exit;
}

if (!preg_match('/^[0-9]{4}$/', trim($postcode4))) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid postcode4 value. Must be 4 digits']);
    exit;
}

$postcode4 = trim($postcode4);

// Define cache directory and cache file path
$cacheDir  = __DIR__ . '/../data/pc6/';
$cacheFile = $cacheDir . $postcode4 . '.json';

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
    $postcode4
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

    $body = (string)$response->getBody();
    $data = json_decode($body, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(500);
        echo json_encode(['error' => 'Error decoding JSON response']);
        exit;
    }

    if (empty($data['features'])) {
        http_response_code(404);
        echo json_encode(['error' => 'No data found for postcode(s): ' . $postcode4]);
        exit;
    }

    // Write cached file on successful API response
    if (!is_dir($cacheDir)) {
        mkdir($cacheDir, 0777, true);
    }
    file_put_contents($cacheFile, $body);

    echo json_encode($data);

} catch (RequestException $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
    exit;
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
    exit;
} 
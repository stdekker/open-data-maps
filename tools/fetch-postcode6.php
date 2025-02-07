#!/usr/bin/env php
<?php

require_once __DIR__ . '/../vendor/autoload.php';

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;

if ($argc !== 2) {
    echo "Usage: php fetch-postcode6.php <postcode4>\n";
    echo "Example: php fetch-postcode6.php 1011\n";
    exit(1);
}

$postcode4 = $argv[1];
if (!preg_match('/^[0-9]{4}$/', $postcode4)) {
    echo "Error: Invalid postcode4 format. Must be 4 digits\n";
    exit(1);
}

$client = new Client([
    'verify' => false,  // Disable SSL verification for testing
    'timeout' => 30,    // Increase timeout
    'debug' => false     // Enable debug output
]);

$wfsUrl = 'https://service.pdok.nl/cbs/postcode6/2022/wfs/v1_0';
$params = [
    'service' => 'WFS',
    'version' => '2.0.0',
    'request' => 'GetFeature',
    'typeName' => 'postcode6',
    'outputFormat' => 'application/json',
    'srsName' => 'EPSG:4326',
    'filter' => sprintf('<Filter xmlns="http://www.opengis.net/fes/2.0"><PropertyIsLike wildCard="*" singleChar="." escapeChar="\\"><PropertyName>postcode6</PropertyName><Literal>%s*</Literal></PropertyIsLike></Filter>', $postcode4)
];

try {
    echo "Querying PDOK service for postcode4: $postcode4\n";
    echo "URL: $wfsUrl\n";
    echo "Parameters: " . json_encode($params, JSON_PRETTY_PRINT) . "\n";

    $response = $client->get($wfsUrl, [
        'query' => $params,
        'headers' => [
            'Accept' => 'application/json'
        ]
    ]);

    $statusCode = $response->getStatusCode();

    $body = (string)$response->getBody();

    $data = json_decode($body, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        echo "Error decoding JSON: " . json_last_error_msg() . "\n";
        exit(1);
    }

    if (empty($data['features'])) {
        echo "Error: No data found for postcode4: $postcode4\n";
        exit(1);
    }

    // Only output the postcode6 values
    $postcodes = array_map(function($feature) {
        return $feature['properties']['postcode6'];
    }, $data['features']);

    // Output as JSON array
    echo json_encode($postcodes, JSON_PRETTY_PRINT);

} catch (RequestException $e) {
    echo "Request Error: " . $e->getMessage() . "\n";
    if ($e->hasResponse()) {
        echo "Response: " . $e->getResponse()->getBody() . "\n";
    }
    exit(1);
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
    exit(1);
} 
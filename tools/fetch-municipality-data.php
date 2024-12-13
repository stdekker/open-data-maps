<?php

// Ensure this script is only run from command line
if (php_sapi_name() !== 'cli') {
    die('This script can only be run from the command line');
}

// Get gemeentecodes from gemeenten.json or fetch from API if file doesn't exist
$gemeentenFile = __DIR__ . '/../web/data/gemeenten.json';
if (!file_exists($gemeentenFile)) {
    $baseUrl = 'https://service.pdok.nl/cbs/wijkenbuurten/2023/wfs/v1_0';
    $params = [
        'service' => 'WFS',
        'request' => 'GetFeature',
        'version' => '1.1.0',
        'typeName' => 'wijkenbuurten:gemeenten',
        'outputFormat' => 'json',
        'filter' => '<ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>water</ogc:PropertyName><ogc:Literal>NEE</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>'
    ];
    $url = $baseUrl . '?' . http_build_query($params);
    $gemeentenJson = file_get_contents($url);
    
    // Create directory if it doesn't exist
    $dir = dirname($gemeentenFile);
    if (!is_dir($dir)) {
        mkdir($dir, 0777, true);
    }
    
    // Save the fetched data
    file_put_contents($gemeentenFile, $gemeentenJson);
} else {
    $gemeentenJson = file_get_contents($gemeentenFile);
}
$gemeentenData = json_decode($gemeentenJson, true);

// Initialize array to store overview data
$overview = ['gemeenten' => []];

// Extract gemeente names and codes
foreach ($gemeentenData['features'] as $feature) {
    if (isset($feature['properties']['gemeentecode']) && isset($feature['properties']['gemeentenaam'])) {
        $overview['gemeenten'][] = [
            'naam' => $feature['properties']['gemeentenaam'],
            'code' => $feature['properties']['gemeentecode'],
        ];
    }
}

// Sort gemeenten by name
usort($overview['gemeenten'], function($a, $b) {
    return strcmp($a['naam'], $b['naam']);
});

// Save overview data
$outputFile = __DIR__ . '/../web/data/overview.json';
$outputDir = dirname($outputFile);

// Create directory if it doesn't exist
if (!is_dir($outputDir)) {
    mkdir($outputDir, 0777, true);
}

file_put_contents($outputFile, json_encode($overview, JSON_PRETTY_PRINT));

echo "Overview data generated successfully!\n"; 
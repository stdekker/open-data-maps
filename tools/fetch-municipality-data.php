<?php
/**
 * Municipality Data Processing Script
 * 
 * This script fetches and processes municipality (gemeente) data from the Dutch CBS (Central Bureau of Statistics):
 * 1. Checks if municipality data exists locally, if not:
 *    - Fetches data from PDOK WFS service (Dutch public geodata)
 *    - Filters out water bodies using OGC filter
 *    - Saves raw GeoJSON response to gemeenten.json
 */

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
    echo "Municipality data fetched and saved successfully!\n";
} else {
    echo "Municipality data already exists.\n";
} 
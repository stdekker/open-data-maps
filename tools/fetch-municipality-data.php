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

// Check if file exists and ask user if they want to override
if (file_exists($gemeentenFile)) {
    echo "Municipality data already exists.\n";
    echo "Do you want to re-fetch and override the existing data? (y/n): ";
    $handle = fopen("php://stdin", "r");
    $line = fgets($handle);
    fclose($handle);
    
    if (trim(strtolower($line)) !== 'y') {
        echo "Keeping existing data.\n";
        exit(0);
    }
    
    echo "Re-fetching municipality data...\n";
}

// Fetch and process data
$baseUrl = 'https://service.pdok.nl/cbs/wijkenbuurten/2024/wfs/v1_0';
$params = [
    'service' => 'WFS',
    'request' => 'GetFeature',
    'version' => '1.1.0',
    'typeName' => 'wijkenbuurten:gemeenten',
    'outputFormat' => 'json',
    'srsName' => 'EPSG:4326', // Request WGS84 coordinates for Mapbox compatibility
    'filter' => '<ogc:Filter><ogc:PropertyIsEqualTo><ogc:PropertyName>water</ogc:PropertyName><ogc:Literal>NEE</ogc:Literal></ogc:PropertyIsEqualTo></ogc:Filter>'
];
$url = $baseUrl . '?' . http_build_query($params);
$gemeentenJson = file_get_contents($url);

// Create directory if it doesn't exist
$dir = dirname($gemeentenFile);
if (!is_dir($dir)) {
    mkdir($dir, 0777, true);
}

// Save the raw data to a temporary file
$tempFile = $gemeentenFile . '.raw.json';
file_put_contents($tempFile, $gemeentenJson);
echo "Raw data fetched. Simplifying...\n";

// Run mapshaper-php-cli
$mapshaperScript = __DIR__ . '/mapshaper-php-cli/mapshaper.php';
$command = sprintf(
    'php %s -i %s -o %s -p 1%%',
    escapeshellarg($mapshaperScript),
    escapeshellarg($tempFile),
    escapeshellarg($gemeentenFile)
);

exec($command, $output, $returnVar);

// Clean up temp file
if (file_exists($tempFile)) {
    unlink($tempFile);
}

if ($returnVar === 0) {
    echo "Municipality data fetched and simplified successfully!\n";
} else {
    echo "Error simplifying data:\n" . implode("\n", $output) . "\n";
    // Fallback: if simplification failed, save raw data? 
    // Or maybe just fail. Let's fail for now as the user wants simplified data.
    exit(1);
} 
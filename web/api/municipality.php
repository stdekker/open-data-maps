<?php
require_once __DIR__ . '/../../vendor/autoload.php';

// Function to fetch and save gemeente data
function fetchGemeente($code, $force = false, $progress = null) {
    // Updated path to store CBS data in a dedicated directory
    $dataDir = __DIR__ . '/../data/cbs/2023';
    $gemeenteFile = $dataDir . '/' . $code . '.json';

    // Create directory structure if it doesn't exist
    if (!is_dir($dataDir)) {
        mkdir($dataDir, 0777, true);
    }

    $progressStr = $progress ? " ({$progress['current']} of {$progress['total']})" : '';

    // Skip if file exists and not forcing update
    if (!$force && file_exists($gemeenteFile)) {
        if (php_sapi_name() === 'cli') {
            echo "Skipping {$code}{$progressStr} - file exists (use --force to override)\n";
        }
        return;
    }

    $baseUrl = 'https://service.pdok.nl/cbs/wijkenbuurten/2023/wfs/v1_0';
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
        echo "Failed to fetch data for gemeente {$code}{$progressStr}\n";
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
    
    if (php_sapi_name() === 'cli') {    
        echo "Generated data file for gemeente {$code}{$progressStr}\n";
    }
}

// Handle command line usage
if (php_sapi_name() === 'cli') {
    $options = getopt('', ['all', 'force', 'code:']);
    $force = isset($options['force']);

    if (isset($options['all'])) {
        // Updated path to overview.json while maintaining backward compatibility
        $overviewFile = __DIR__ . '/../data/overview.json';
        if (!file_exists($overviewFile)) {
            die("overview.json not found. Please run data-processor.php first.\n");
        }
        
        $overview = json_decode(file_get_contents($overviewFile), true);
        $total = count($overview['gemeenten']);
        $current = 0;

        foreach ($overview['gemeenten'] as $gemeente) {
            $current++;
            fetchGemeente($gemeente['code'], $force, ['current' => $current, 'total' => $total]);
        }
    } elseif (isset($options['code'])) {
        fetchGemeente($options['code'], $force);
    } else {
        echo "Usage: php api/municipality.php [--all] [--force] [--code=GM0363]\n";
        echo "  --all   : Fetch data for all gemeenten\n";
        echo "  --force : Force update existing files\n";
        echo "  --code  : Fetch specific gemeente by code\n";
    }
    exit;
}

// Handle web requests
if (!isset($_GET['code'])) {
    header('Content-Type: application/json');
    http_response_code(400);
    echo json_encode(['error' => 'Missing gemeente code']);
    exit;
}

// For web requests, always serve from cache if available
$gemeenteFile = __DIR__ . '/../data/cbs/2023/' . $_GET['code'] . '.json';
fetchGemeente($_GET['code']);

if (file_exists($gemeenteFile)) {
    header('Content-Type: application/json');
    echo file_get_contents($gemeenteFile);
} else {
    header('Content-Type: application/json');
    http_response_code(404);
    echo json_encode(['error' => 'Gemeente data not found']);
} 
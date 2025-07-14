<?php
require_once __DIR__ . '/security.php';

setSecurityHeaders();

require_once __DIR__ . '/../../vendor/autoload.php';
require_once __DIR__ . '/../config.prod.php';

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;

function fetchPostcodesForMunicipality($municipalityCode) {
    // First try the current municipality data from CBS 2023
    $filePath = __DIR__ . "/../data/cbs/2023/{$municipalityCode}-buurten.json";
    if (!file_exists($filePath)) {
        // Try the old format or wijken data
        $filePath = __DIR__ . "/../data/cbs/2023/{$municipalityCode}.json";
        if (!file_exists($filePath)) {
            // Try wijken as fallback
            $filePath = __DIR__ . "/../data/cbs/2023/{$municipalityCode}-wijken.json";
            if (!file_exists($filePath)) {
                return [];
            }
        }
    }
    
    $geoJsonString = file_get_contents($filePath);
    $geoJsonData = json_decode($geoJsonString, true);

    if (json_last_error() !== JSON_ERROR_NONE || !isset($geoJsonData['features'])) {
        return [];
    }

    $postcodes = [];
    foreach ($geoJsonData['features'] as $feature) {
        if (isset($feature['properties']['meestVoorkomendePostcode'])) {
            $postcode4 = substr($feature['properties']['meestVoorkomendePostcode'], 0, 4);
            if (preg_match('/^[1-9][0-9]{3}$/', $postcode4)) {
                $postcodes[] = $postcode4;
            }
        }
    }

    return array_unique($postcodes);
}

$municipalityCode = $_GET['municipality_code'] ?? null;
$postcode4 = $_GET['postcode4'] ?? null;

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $municipalityCode) {
    $validatedMunicipalityCode = validateInputRegex($municipalityCode, '/^GM[0-9]{4}$/', 'Invalid municipality_code.');
    $sanitizedMunicipalityCode = sanitizePathComponent($validatedMunicipalityCode);

    $cacheDir = __DIR__ . '/../data/bag/';
    if (!is_dir($cacheDir)) {
        mkdir($cacheDir, 0775, true);
    }
    $cacheFile = $cacheDir . $sanitizedMunicipalityCode . '.json';

    $jsonData = file_get_contents('php://input');
    $data = json_decode($jsonData);

    if (json_last_error() === JSON_ERROR_NONE) {
        file_put_contents($cacheFile, $jsonData);
        header('Content-Type: application/json');
        echo json_encode(['status' => 'success', 'message' => 'Cache has been updated.']);
    } else {
        http_response_code(400);
        header('Content-Type: application/json');
        echo json_encode(['status' => 'error', 'message' => 'Invalid JSON data received.']);
    }
    exit;
}

header('Content-Type: application/json');

if ($municipalityCode) {
    $validatedMunicipalityCode = validateInputRegex($municipalityCode, '/^GM[0-9]{4}$/', 'Invalid municipality_code.');
    $sanitizedMunicipalityCode = sanitizePathComponent($validatedMunicipalityCode);

    if (!isset($CACHE_BAG_DURATION)) {
        $CACHE_BAG_DURATION = 86400; // Default to 1 day
    }

    $cacheDir = __DIR__ . '/../data/bag/';
    $cacheFile = $cacheDir . $sanitizedMunicipalityCode . '.json';

    if (file_exists($cacheFile) && (filemtime($cacheFile) + $CACHE_BAG_DURATION) > time()) {
        readfile($cacheFile);
        exit;
    }

    $postcodes = fetchPostcodesForMunicipality($sanitizedMunicipalityCode);
    if (!empty($postcodes)) {
        echo json_encode(['status' => 'fetch_postcodes', 'postcodes' => array_values($postcodes)]);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'No postcodes found for this municipality.']);
    }
    exit;
}

if ($postcode4) {
    $validatedPostcode4 = validateInputRegex($postcode4, '/^[1-9][0-9]{3}$/', 'Invalid postcode4.');
    $sanitizedPostcode4 = sanitizePathComponent($validatedPostcode4);
    
    $client = new Client(['verify' => false, 'timeout' => 180]);

    $filterXmlTemplate = <<<XML
<Filter xmlns="http://www.opengis.net/fes/2.0">
    <And>
        <PropertyIsLike wildCard="*" singleChar="." escapeChar="\">
            <ValueReference>postcode</ValueReference>
            <Literal>%s*</Literal>
        </PropertyIsLike>
        <PropertyIsEqualTo>
            <ValueReference>gebruiksdoel</ValueReference>
            <Literal>woonfunctie</Literal>
        </PropertyIsEqualTo>
    </And>
</Filter>
XML;
    $filterXml = sprintf($filterXmlTemplate, $sanitizedPostcode4);
    $wfsUrl = 'https://service.pdok.nl/lv/bag/wfs/v2_0';

    $allFeatures = [];
    $startIndex = 0;
    $maxFeatures = 1000;
    $keepFetching = true;

    try {
        while ($keepFetching) {
            $params = [
                'service' => 'WFS', 'version' => '2.0.0', 'request' => 'GetFeature',
                'typeName' => 'verblijfsobject', 'outputFormat' => 'application/json',
                'srsName' => 'EPSG:4326', 'FILTER' => $filterXml,
                'maxFeatures' => $maxFeatures, 'startIndex' => $startIndex
            ];

            $response = $client->get($wfsUrl, ['query' => $params, 'headers' => ['Accept' => 'application/json']]);
            $body = (string)$response->getBody();
            $data = json_decode($body, true);

            if (json_last_error() !== JSON_ERROR_NONE || !isset($data['features'])) {
                throw new Exception('Invalid JSON response from PDOK.');
            }

            $featureCount = count($data['features']);
            if ($featureCount > 0) {
                $allFeatures = array_merge($allFeatures, $data['features']);
            }

            if ($featureCount < $maxFeatures) {
                $keepFetching = false;
            } else {
                $startIndex += $maxFeatures;
            }
        }

        foreach ($allFeatures as &$feature) {
            if (isset($feature['properties']['rdf_seealso'])) {
                unset($feature['properties']['rdf_seealso']);
            }
        }
        unset($feature);

        echo json_encode(['type' => 'FeatureCollection', 'features' => $allFeatures]);

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'An internal server error occurred', 'details' => $e->getMessage()]);
    }
    exit;
}

http_response_code(400);
echo json_encode(['error' => 'Invalid request. Provide municipality_code or postcode4.']); 
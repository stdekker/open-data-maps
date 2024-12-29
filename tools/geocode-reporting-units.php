<?php
/**
 * Geocoding Script for Election Reporting Units
 * 
 * This script processes election reporting unit data (polling stations) to add geographic coordinates:
 * 1. Reads reporting unit data from election JSON files
 * 2. For each polling station that has a postcode:
 *    - Extracts the postcode from the reporting unit identifier
 *    - Checks local cache for existing geocoding results
 *    - If not in cache, geocodes using PDOK Locatieserver API and caches result
 *    - Adds latitude/longitude coordinates to the data
 * 3. Updates the JSON files with geocoded locations
 * 
 * Options:
 *   --election       Required. The election ID to process
 *   --municipality   Optional. Process only this municipality code
 *   --delay         Optional. Milliseconds to wait between API calls (default: 200)
 *   --debug         Optional. Enable debug output
 *   --force         Optional. Override existing geocodes
 */

// Ensure this script is only run from command line
if (php_sapi_name() !== 'cli') {
    die('This script can only be run from the command line');
}

// Parse command line arguments
$options = getopt('', ['election:', 'municipality::', 'delay::', 'debug::', 'force::']);
if (!isset($options['election'])) {
    die("Usage: php geocode-reporting-units.php --election=ELECTION_ID [--municipality=GM0000] [--delay=MILLISECONDS] [--debug]\n");
}

$election = $options['election'];
$targetMunicipality = isset($options['municipality']) ? $options['municipality'] : null;
$delay = isset($options['delay']) ? (int)$options['delay'] : 200; // Default 200ms delay
$debug = isset($options['debug']); // Debug mode flag
$force = isset($options['force']); // Force override existing geocodes flag

// Directory paths
$electionDir = __DIR__ . "/../web/data/elections/$election";
$cacheFile = __DIR__ . "/../web/data/postcode-cache.json";

if (!file_exists($electionDir)) {
    die("Election directory not found: $election\n");
}

// Load or create geocoding cache
$geocodeCache = [];
if (file_exists($cacheFile)) {
    $geocodeCache = json_decode(file_get_contents($cacheFile), true) ?: [];
}

function saveCache($cache, $cacheFile) {
    file_put_contents($cacheFile, json_encode($cache, JSON_PRETTY_PRINT));
}

function geocodePostcode($postcode, &$cache, $cacheFile, $debug) {
    if (empty($postcode)) {
        return null;
    }

    // Clean up postcode format (remove spaces)
    $postcode = str_replace(' ', '', strtoupper($postcode));
    
    // Check cache first
    if (isset($cache[$postcode])) {
        if ($debug) {
            echo "Cache hit for $postcode\n";
        }
        return ['coordinates' => $cache[$postcode], 'fromCache' => true];
    }

    // PDOK Locatieserver API endpoint
    $url = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=" . urlencode($postcode) . "&fq=type:postcode";
    
    // Make API request
    $response = @file_get_contents($url);
    if ($response === false) {
        echo "Warning: Failed to geocode postcode: $postcode\n";
        return null;
    }
    
    $data = json_decode($response, true);
    
    if (!isset($data['response']['docs'][0])) {
        echo "Warning: No geocoding results for postcode: $postcode\n";
        return null;
    }
    
    $result = $data['response']['docs'][0];
    
    // Debug the result if debug mode is enabled
    if ($debug) {
        echo "\nDebug response for $postcode:\n";
        echo json_encode($result, JSON_PRETTY_PRINT) . "\n";
    }
    
    // Check if we have valid centroid
    if (!isset($result['centroide_ll']) || empty($result['centroide_ll'])) {
        echo "Warning: No centroid coordinates in response for postcode: $postcode\n";
        return null;
    }
    
    // Parse coordinates from POINT string
    if (preg_match('/POINT\(([\d.]+)\s+([\d.]+)\)/', $result['centroide_ll'], $matches)) {
        $coordinates = [
            'lat' => (float)$matches[2], // Second value is latitude
            'lon' => (float)$matches[1]  // First value is longitude
        ];
        
        // Save to cache
        $cache[$postcode] = $coordinates;
        saveCache($cache, $cacheFile);
        
        return ['coordinates' => $coordinates, 'fromCache' => false];
    }
    
    echo "Warning: Could not parse centroid coordinates for postcode: $postcode\n";
    return null;
}

$totalGeocoded = 0;
$totalSkipped = 0;
$totalFailed = 0;
$cacheHits = 0;

// Get all GM files
$files = glob($electionDir . "/GM*.json");
$totalMunicipalities = count($files);
$processedMunicipalities = 0;

echo "\nProcessing $totalMunicipalities municipalities...\n";

foreach ($files as $file) {
    $municipalityCode = basename($file, '.json');
    
    // Skip if not the target municipality (when specified)
    if ($targetMunicipality !== null && $municipalityCode !== $targetMunicipality) {
        continue;
    }
    
    $processedMunicipalities++;
    echo "\nProcessing $municipalityCode ($processedMunicipalities/$totalMunicipalities)...\n";
    
    // Load municipality data
    $data = json_decode(file_get_contents($file), true);
    $modified = false;
    
    // Skip if file is already fully geocoded
    if (isset($data['@attributes']['geocoded']) && !$force) {
        echo "Skipping $municipalityCode - already fully geocoded (use --force to override)\n";
        $totalSkipped++;
        continue;
    }
    
    // Find ReportingUnitVotes in the data structure
    if (isset($data['Count']['Election']['Contests']['Contest']['ReportingUnitVotes'])) {
        $units = &$data['Count']['Election']['Contests']['Contest']['ReportingUnitVotes'];
        
        // Ensure units is an array of arrays
        if (!isset($units[0])) {
            $units = [$units];
        }
        
        foreach ($units as &$unit) {
            $unitId = $unit['ReportingUnitIdentifier'];
            
            // Skip if already has coordinates
            if (isset($unit['GeoLocation']) && !$force) {
                echo "Skipping {$unitId} - already geocoded (use --force to override)\n";
                $totalSkipped++;
                continue;
            }
            
            // Extract postcode if available
            if (preg_match('/\(postcode:\s*([^)]+)\)/i', $unitId, $matches)) {
                $postcode = trim($matches[1]);
                echo "Geocoding {$postcode}... ";
                
                $result = geocodePostcode($postcode, $geocodeCache, $cacheFile, $debug);
                if ($result) {
                    $unit['GeoLocation'] = $result['coordinates'];
                    if ($result['fromCache']) {
                        echo "Success! (from cache)\n";
                        $cacheHits++;
                    } else {
                        $coordinates = $result['coordinates'];
                        echo "Success! ({$coordinates['lat']}, {$coordinates['lon']})\n";
                    }
                    $totalGeocoded++;
                    $modified = true;
                } else {
                    echo "Failed!\n";
                    $totalFailed++;
                }
                
                // Only delay if we actually made an API call
                if (!$result || !$result['fromCache']) {
                    usleep($delay * 1000);
                }
            } else {
                echo "No postcode found in: $unitId\n";
                $totalSkipped++;
            }
        }
    }
    
    // Save if modified
    if ($modified) {
        // Add geocoded attribute to indicate this file has been processed
        if (isset($data['@attributes'])) {
            $data['@attributes']['geocoded'] = true;
        } else {
            $data['@attributes'] = ['geocoded' => true];
        }
        
        file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT));
        echo "Updated $municipalityCode\n";
    }
}

echo "\nGeocoding complete!\n";
echo "Municipalities processed: $processedMunicipalities/$totalMunicipalities\n";
echo "Total geocoded: $totalGeocoded\n";
echo "Total skipped: $totalSkipped\n";
echo "Total failed: $totalFailed\n";
echo "Cache hits: $cacheHits\n"; 
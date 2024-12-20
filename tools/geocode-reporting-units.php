<?php
/**
 * Geocoding Script for Election Reporting Units
 * 
 * This script processes election reporting unit data (polling stations) to add geographic coordinates:
 * 1. Reads reporting unit data from election JSON files
 * 2. For each polling station that has a postcode:
 *    - Extracts the postcode from the reporting unit identifier
 *    - Geocodes the postcode using PDOK Locatieserver API
 *    - Adds latitude/longitude coordinates to the data
 * 3. Updates the JSON files with geocoded locations
 * 
 */

// Ensure this script is only run from command line
if (php_sapi_name() !== 'cli') {
    die('This script can only be run from the command line');
}

// Parse command line arguments
$options = getopt('', ['election:', 'municipality::', 'delay::', 'debug::']);
if (!isset($options['election'])) {
    die("Usage: php geocode-reporting-units.php --election=ELECTION_ID [--municipality=GM0000] [--delay=MILLISECONDS] [--debug]\n");
}

$election = $options['election'];
$targetMunicipality = isset($options['municipality']) ? $options['municipality'] : null;
$delay = isset($options['delay']) ? (int)$options['delay'] : 200; // Default 200ms delay to respect API limits
$debug = isset($options['debug']); // Debug mode flag

// Directory path
$electionDir = __DIR__ . "/../web/data/elections/$election";

if (!file_exists($electionDir)) {
    die("Election directory not found: $election\n");
}

function geocodePostcode($postcode, $debug) {
    if (empty($postcode)) {
        return null;
    }

    // Clean up postcode format (remove spaces)
    $postcode = str_replace(' ', '', $postcode);
    
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
    
    // The centroide_ll comes as a string like "POINT(4.89789 52.37403)"
    if (preg_match('/POINT\(([\d.]+)\s+([\d.]+)\)/', $result['centroide_ll'], $matches)) {
        return [
            'lat' => (float)$matches[2], // Second value is latitude
            'lon' => (float)$matches[1]  // First value is longitude
        ];
    }
    
    echo "Warning: Could not parse centroid coordinates for postcode: $postcode\n";
    return null;
}

$totalGeocoded = 0;
$totalSkipped = 0;
$totalFailed = 0;

// Get all GM files
$files = glob($electionDir . "/GM*.json");
foreach ($files as $file) {
    $municipalityCode = basename($file, '.json');
    
    // Skip if not the target municipality (when specified)
    if ($targetMunicipality !== null && $municipalityCode !== $targetMunicipality) {
        continue;
    }
    
    echo "\nProcessing $municipalityCode...\n";
    
    // Load municipality data
    $data = json_decode(file_get_contents($file), true);
    $modified = false;
    
    // Skip if file is already fully geocoded
    if (isset($data['@attributes']['geocoded'])) {
        echo "Skipping $municipalityCode - already fully geocoded\n";
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
            if (isset($unit['GeoLocation'])) {
                echo "Skipping {$unitId} - already geocoded\n";
                $totalSkipped++;
                continue;
            }
            
            // Extract postcode if available
            if (preg_match('/\(postcode:\s*([^)]+)\)/i', $unitId, $matches)) {
                $postcode = trim($matches[1]);
                echo "Geocoding {$postcode}... ";
                
                $coordinates = geocodePostcode($postcode, $debug);
                if ($coordinates) {
                    $unit['GeoLocation'] = $coordinates;
                    echo "Success! ({$coordinates['lat']}, {$coordinates['lon']})\n";
                    $totalGeocoded++;
                    $modified = true;
                } else {
                    echo "Failed!\n";
                    $totalFailed++;
                }
                
                // Respect rate limit
                usleep($delay * 1000);
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
echo "Total geocoded: $totalGeocoded\n";
echo "Total skipped: $totalSkipped\n";
echo "Total failed: $totalFailed\n"; 
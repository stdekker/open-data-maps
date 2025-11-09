<?php
/**
 * Match Locations API
 * 
 * Finds matching stembureaus in another election to copy geocoded locations
 */

require_once __DIR__ . '/../../../config/edit-config.php';
require_once __DIR__ . '/../auth.php';

// Require authentication
requireAuth();

// Set JSON header
header('Content-Type: application/json');

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

/**
 * Normalize polling station name for comparison
 */
function normalizePollingStationName($name) {
    // Remove common prefixes and clean up the name
    $name = preg_replace('/^Stembureau\s+/i', '', $name);
    $name = preg_replace('/\s*\(postcode:[^)]+\)/i', '', $name);
    // Remove duplicate "Stembureau" words that sometimes appear
    $name = preg_replace('/^Stembureau\s+/i', '', $name);
    // Remove "de", "het", "the" articles
    $name = preg_replace('/\b(de|het|the)\s+/i', '', $name);
    // Remove any remaining parentheses and their contents
    $name = preg_replace('/\s*\([^)]*\)/', '', $name);
    // Convert to lowercase and trim
    $name = trim(strtolower($name));
    // Remove multiple spaces
    $name = preg_replace('/\s+/', ' ', $name);
    return $name;
}

/**
 * Find matching polling stations
 */
function findMatches($currentStembureaus, $sourceElectionData, $threshold) {
    $matches = [];
    
    // Get source stembureaus
    if (!isset($sourceElectionData['Contests']['Contest']['ReportingUnitVotes'])) {
        return $matches;
    }
    
    $sourceUnits = $sourceElectionData['Contests']['Contest']['ReportingUnitVotes'];
    
    // Ensure it's an array
    if (!isset($sourceUnits[0])) {
        $sourceUnits = [$sourceUnits];
    }
    
    // Process each current stembureau
    foreach ($currentStembureaus as $index => $current) {
        // Skip if already has location
        if ($current['hasLocation']) {
            continue;
        }
        
        $currentNormalized = normalizePollingStationName($current['identifier']);
        
        $bestMatch = null;
        $bestSimilarity = 0;
        $bestSourceUnit = null;
        
        // Find best match in source election
        foreach ($sourceUnits as $sourceUnit) {
            // Skip if source doesn't have location
            if (!isset($sourceUnit['GeoLocation'])) {
                continue;
            }
            
            $sourceNormalized = normalizePollingStationName($sourceUnit['ReportingUnitIdentifier']);
            
            // Check for exact match first
            if ($sourceNormalized === $currentNormalized) {
                $bestMatch = $sourceUnit;
                $bestSimilarity = 100;
                break;
            }
            
            // Calculate similarity
            similar_text($sourceNormalized, $currentNormalized, $percent);
            
            if ($percent >= $threshold && $percent > $bestSimilarity) {
                $bestSimilarity = $percent;
                $bestMatch = $sourceUnit;
            }
        }
        
        // Add match if found
        if ($bestMatch && $bestSimilarity >= $threshold) {
            $matches[] = [
                'index' => $index,
                'currentName' => $current['identifier'],
                'sourceName' => $bestMatch['ReportingUnitIdentifier'],
                'lat' => floatval($bestMatch['GeoLocation']['lat']),
                'lon' => floatval($bestMatch['GeoLocation']['lon']),
                'similarity' => round($bestSimilarity, 1)
            ];
        }
    }
    
    return $matches;
}

try {
    // Verify CSRF token
    if (!isset($input['csrf_token']) || !verifyCsrfToken($input['csrf_token'])) {
        throw new Exception('Invalid CSRF token');
    }
    
    // Validate required parameters
    $currentElection = $input['currentElection'] ?? null;
    $currentMunicipality = $input['currentMunicipality'] ?? null;
    $sourceElection = $input['sourceElection'] ?? null;
    $threshold = isset($input['threshold']) ? floatval($input['threshold']) : 80;
    $currentStembureaus = $input['stembureaus'] ?? null;
    
    if (!$currentElection || !$currentMunicipality || !$sourceElection || !$currentStembureaus) {
        throw new Exception('Missing required parameters');
    }
    
    // Sanitize inputs
    if (!preg_match('/^[a-zA-Z0-9]+$/', $currentElection)) {
        throw new Exception('Invalid election format');
    }
    
    if (!preg_match('/^[a-zA-Z0-9]+$/', $sourceElection)) {
        throw new Exception('Invalid source election format');
    }
    
    if (!preg_match('/^GM[0-9]{4}$/', $currentMunicipality)) {
        throw new Exception('Invalid municipality format');
    }
    
    // Don't allow matching with same election
    if ($currentElection === $sourceElection) {
        throw new Exception('Source election must be different from current election');
    }
    
    // Build file path for source election
    $sourceFilePath = ELECTIONS_DIR . "/{$sourceElection}/{$currentMunicipality}.json";
    
    // Check if source file exists
    if (!file_exists($sourceFilePath)) {
        throw new Exception("No data found for municipality {$currentMunicipality} in election {$sourceElection}");
    }
    
    // Read source election data
    $sourceData = json_decode(file_get_contents($sourceFilePath), true);
    if (!$sourceData) {
        throw new Exception('Failed to parse source election data');
    }
    
    // Find matches
    $matches = findMatches($currentStembureaus, $sourceData, $threshold);
    
    // Log the match attempt
    logAccess("MATCH_LOCATIONS - {$currentElection}/{$currentMunicipality} from {$sourceElection} - Found " . count($matches) . " matches", true);
    
    // Return results
    echo json_encode([
        'success' => true,
        'matches' => $matches,
        'sourceElection' => $sourceElection,
        'threshold' => $threshold,
        'total' => count($matches)
    ]);
    
} catch (Exception $e) {
    http_response_code(400);
    logAccess("MATCH_LOCATIONS_FAILED - " . $e->getMessage(), false);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}


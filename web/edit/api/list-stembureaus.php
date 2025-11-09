<?php
/**
 * List Stembureaus API
 * 
 * Returns a list of polling stations (stembureaus) for a given election and municipality
 */

require_once __DIR__ . '/../../../config/edit-config.php';
require_once __DIR__ . '/../auth.php';

// Require authentication
requireAuth();

// Set JSON header
header('Content-Type: application/json');

// Get parameters
$election = $_GET['election'] ?? null;
$municipality = $_GET['municipality'] ?? null;

try {
    // Validate parameters
    if (!$election || !$municipality) {
        throw new Exception('Election and municipality parameters are required');
    }
    
    // Sanitize inputs
    if (!preg_match('/^[a-zA-Z0-9]+$/', $election)) {
        throw new Exception('Invalid election format');
    }
    
    if (!preg_match('/^GM[0-9]{4}$/', $municipality)) {
        throw new Exception('Invalid municipality format');
    }
    
    // Build file path
    $filePath = ELECTIONS_DIR . "/{$election}/{$municipality}.json";
    
    // Check if file exists
    if (!file_exists($filePath)) {
        throw new Exception("No data found for municipality {$municipality} in election {$election}");
    }
    
    // Read and parse JSON file
    $data = json_decode(file_get_contents($filePath), true);
    if (!$data) {
        throw new Exception('Failed to parse election data');
    }
    
    // Extract reporting units
    $reportingUnits = [];
    if (isset($data['Contests']['Contest']['ReportingUnitVotes'])) {
        $units = $data['Contests']['Contest']['ReportingUnitVotes'];
        
        // Ensure it's an array
        if (!isset($units[0])) {
            $units = [$units];
        }
        
        // Process each unit
        foreach ($units as $index => $unit) {
            $identifier = $unit['ReportingUnitIdentifier'] ?? "Unit {$index}";
            $geoLocation = $unit['GeoLocation'] ?? null;
            
            $reportingUnits[] = [
                'index' => $index,
                'identifier' => $identifier,
                'hasLocation' => $geoLocation !== null,
                'lat' => $geoLocation ? floatval($geoLocation['lat']) : null,
                'lon' => $geoLocation ? floatval($geoLocation['lon']) : null,
                'cast' => isset($unit['Cast']) ? intval($unit['Cast']) : 0,
                'totalCounted' => isset($unit['TotalCounted']) ? intval($unit['TotalCounted']) : 0
            ];
        }
    }
    
    // Log the access
    logAccess("LIST_STEMBUREAUS - {$election}/{$municipality}", true);
    
    // Return the data
    echo json_encode([
        'success' => true,
        'election' => $election,
        'municipality' => $municipality,
        'stembureaus' => $reportingUnits,
        'total' => count($reportingUnits),
        'geocoded' => isset($data['@attributes']['geocoded']) ? $data['@attributes']['geocoded'] : false
    ]);
    
} catch (Exception $e) {
    http_response_code(400);
    logAccess("LIST_STEMBUREAUS_FAILED - " . $e->getMessage(), false);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}


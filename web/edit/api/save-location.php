<?php
/**
 * Save Location API
 * 
 * Updates the geographic location for a specific stembureau (polling station)
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

try {
    // Verify CSRF token
    if (!isset($input['csrf_token']) || !verifyCsrfToken($input['csrf_token'])) {
        throw new Exception('Invalid CSRF token');
    }
    
    // Validate required parameters
    $election = $input['election'] ?? null;
    $municipality = $input['municipality'] ?? null;
    $index = $input['index'] ?? null;
    $lat = $input['lat'] ?? null;
    $lon = $input['lon'] ?? null;
    
    if (!$election || !$municipality || $index === null) {
        throw new Exception('Missing required parameters');
    }
    
    // Sanitize inputs
    if (!preg_match('/^[a-zA-Z0-9]+$/', $election)) {
        throw new Exception('Invalid election format');
    }
    
    if (!preg_match('/^GM[0-9]{4}$/', $municipality)) {
        throw new Exception('Invalid municipality format');
    }
    
    $index = intval($index);
    
    // Validate coordinates (allow null for removal)
    if ($lat !== null && $lon !== null) {
        $lat = floatval($lat);
        $lon = floatval($lon);
        
        // Basic range validation for Netherlands
        if ($lat < 50.0 || $lat > 54.0 || $lon < 3.0 || $lon > 8.0) {
            throw new Exception('Coordinates out of range for Netherlands');
        }
    }
    
    // Build file path
    $filePath = ELECTIONS_DIR . "/{$election}/{$municipality}.json";
    
    // Check if file exists
    if (!file_exists($filePath)) {
        throw new Exception("No data found for municipality {$municipality} in election {$election}");
    }
    
    // Create backup before modifying
    $timestamp = date('YmdHis');
    $backupPath = ELECTIONS_DIR . "/{$election}/{$municipality}.backup.{$timestamp}.json";
    
    if (!copy($filePath, $backupPath)) {
        throw new Exception('Failed to create backup file');
    }
    
    // Clean up old backups (keep only MAX_BACKUPS_PER_FILE)
    $backupPattern = ELECTIONS_DIR . "/{$election}/{$municipality}.backup.*.json";
    $backups = glob($backupPattern);
    if (count($backups) > MAX_BACKUPS_PER_FILE) {
        // Sort by modification time (oldest first)
        usort($backups, function($a, $b) {
            return filemtime($a) - filemtime($b);
        });
        
        // Delete oldest backups
        $toDelete = count($backups) - MAX_BACKUPS_PER_FILE;
        for ($i = 0; $i < $toDelete; $i++) {
            unlink($backups[$i]);
        }
    }
    
    // Read and parse JSON file
    $data = json_decode(file_get_contents($filePath), true);
    if (!$data) {
        throw new Exception('Failed to parse election data');
    }
    
    // Navigate to reporting units
    if (!isset($data['Contests']['Contest']['ReportingUnitVotes'])) {
        throw new Exception('No reporting units found in data');
    }
    
    $units = &$data['Contests']['Contest']['ReportingUnitVotes'];
    
    // Check if we need to convert to indexed array
    if (!isset($units[0])) {
        $units = [$units];
    }
    
    // Validate index
    if (!isset($units[$index])) {
        throw new Exception("Reporting unit at index {$index} not found");
    }
    
    // Update the geolocation
    if ($lat !== null && $lon !== null) {
        $units[$index]['GeoLocation'] = [
            'lat' => strval($lat),
            'lon' => strval($lon)
        ];
    } else {
        // Remove geolocation if coordinates are null
        unset($units[$index]['GeoLocation']);
    }
    
    // Mark file as geocoded if coordinates were added
    if ($lat !== null && $lon !== null) {
        if (!isset($data['@attributes'])) {
            $data['@attributes'] = [];
        }
        $data['@attributes']['geocoded'] = true;
    }
    
    // Write to temporary file first (atomic write)
    $tempPath = $filePath . '.tmp';
    $jsonContent = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    
    if (file_put_contents($tempPath, $jsonContent) === false) {
        throw new Exception('Failed to write temporary file');
    }
    
    // Rename temporary file to actual file
    if (!rename($tempPath, $filePath)) {
        unlink($tempPath);
        throw new Exception('Failed to update file');
    }
    
    // Log the save
    $identifier = $units[$index]['ReportingUnitIdentifier'] ?? "Index {$index}";
    logAccess("SAVE_LOCATION - {$election}/{$municipality} - {$identifier} - ({$lat}, {$lon})", true);
    
    // Return success
    echo json_encode([
        'success' => true,
        'message' => 'Location updated successfully',
        'backup' => basename($backupPath),
        'data' => [
            'index' => $index,
            'identifier' => $identifier,
            'lat' => $lat,
            'lon' => $lon
        ]
    ]);
    
} catch (Exception $e) {
    http_response_code(400);
    logAccess("SAVE_LOCATION_FAILED - " . $e->getMessage(), false);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}


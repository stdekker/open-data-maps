<?php
header('Content-Type: application/json');

function getAvailableElections() {
    $electionsDir = __DIR__ . '/../data/elections';
    $elections = array_filter(scandir($electionsDir), function($dir) use ($electionsDir) {
        return $dir !== '.' && 
               $dir !== '..' && 
               is_dir($electionsDir . '/' . $dir);
    });
    
    // Sort in reverse chronological order (newest first)
    rsort($elections);
    
    return [
        'elections' => array_values($elections),
        // We can add more election metadata here later
        // For example:
        // 'metadata' => [
        //     'TK2023' => ['name' => 'Tweede Kamer 2023', 'date' => '2023-11-22'],
        //     'TK2021' => ['name' => 'Tweede Kamer 2021', 'date' => '2021-03-17']
        // ]
    ];
}

try {
    $data = getAvailableElections();
    echo json_encode($data);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to get election data']);
} 
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

function getMunicipalityVotes($election, $municipalityCode) {
    $filePath = __DIR__ . "/../data/elections/{$election}/{$municipalityCode}.json";
    if (!file_exists($filePath)) {
        throw new Exception("No data found for municipality {$municipalityCode} in election {$election}");
    }
    
    $data = json_decode(file_get_contents($filePath), true);
    if (!$data) {
        throw new Exception("Failed to parse election data");
    }
    
    // Extract vote totals from the data
    $voteSummary = [];
    $sumValidVotes = 0;
    
    if (isset($data['Count']['Election']['Contests']['Contest']['TotalVotes'])) {
        $totalVotes = $data['Count']['Election']['Contests']['Contest']['TotalVotes'];
        
        if (isset($totalVotes['Selection'])) {
            foreach ($totalVotes['Selection'] as $selection) {
                $votes = intval($selection['ValidVotes']);
                $sumValidVotes += $votes;
                $voteSummary[] = [
                    'party' => $selection['AffiliationIdentifier']['Id'],
                    'name' => $selection['AffiliationIdentifier']['Name'],
                    'votes' => $votes
                ];
            }
        }
    }
    
    // Get additional statistics
    $contest = $data['Count']['Election']['Contests']['Contest'];
    $totalVotes = $contest['TotalVotes'];
    
    $totalCounted = isset($totalVotes['TotalCounted']) ? intval($totalVotes['TotalCounted']) : 0;
    $rejectedVotes = [
        'ongeldig' => isset($totalVotes['RejectedVotes'][0]) ? intval($totalVotes['RejectedVotes'][0]) : 0,
        'blanco' => isset($totalVotes['RejectedVotes'][1]) ? intval($totalVotes['RejectedVotes'][1]) : 0
    ];
    
    // Map uncounted votes to their reason codes
    $reasonCodes = [
        'geldige stempassen',
        'geldige volmachtbewijzen',
        'geldige kiezerspassen',
        'toegelaten kiezers',
        'meer getelde stembiljetten',
        'minder getelde stembiljetten',
        'meegenomen stembiljetten',
        'te weinig uitgereikte stembiljetten',
        'te veel uitgereikte stembiljetten',
        'geen verklaring',
        'andere verklaring'
    ];
    
    $uncountedVotes = [];
    if (isset($totalVotes['UncountedVotes'])) {
        foreach ($totalVotes['UncountedVotes'] as $index => $value) {
            if (isset($reasonCodes[$index])) {
                $uncountedVotes[$reasonCodes[$index]] = intval($value);
            }
        }
    }
    
    return [
        'election' => $election,
        'municipality' => $municipalityCode,
        'statistics' => [
            'cast' => isset($totalVotes['Cast']) ? intval($totalVotes['Cast']) : null,
            'totalCounted' => $totalCounted,
            'rejectedVotes' => $rejectedVotes,
            'totalValidVotes' => $sumValidVotes,
            'uncountedVotes' => $uncountedVotes
        ],
        'results' => $voteSummary
    ];
}

function getTotalVotes($election) {
    $electionDir = __DIR__ . "/../data/elections/{$election}";
    if (!is_dir($electionDir)) {
        throw new Exception("Election {$election} not found");
    }
    
    $files = glob($electionDir . "/GM*.json");
    if (empty($files)) {
        throw new Exception("No municipality data found for election {$election}");
    }
    
    $totalStats = [
        'cast' => 0,
        'totalCounted' => 0,
        'rejectedVotes' => [
            'ongeldig' => 0,
            'blanco' => 0
        ],
        'totalValidVotes' => 0,
        'uncountedVotes' => []
    ];
    
    $partyTotals = [];
    
    foreach ($files as $file) {
        $data = json_decode(file_get_contents($file), true);
        if (!$data) continue;
        
        $contest = $data['Count']['Election']['Contests']['Contest'];
        $totalVotes = $contest['TotalVotes'];
        
        // Add up main statistics
        $totalStats['cast'] += isset($totalVotes['Cast']) ? intval($totalVotes['Cast']) : 0;
        $totalStats['totalCounted'] += isset($totalVotes['TotalCounted']) ? intval($totalVotes['TotalCounted']) : 0;
        $totalStats['rejectedVotes']['ongeldig'] += isset($totalVotes['RejectedVotes'][0]) ? intval($totalVotes['RejectedVotes'][0]) : 0;
        $totalStats['rejectedVotes']['blanco'] += isset($totalVotes['RejectedVotes'][1]) ? intval($totalVotes['RejectedVotes'][1]) : 0;
        
        // Add up uncounted votes
        if (isset($totalVotes['UncountedVotes'])) {
            foreach ($totalVotes['UncountedVotes'] as $index => $value) {
                if (!isset($totalStats['uncountedVotes'][$index])) {
                    $totalStats['uncountedVotes'][$index] = 0;
                }
                $totalStats['uncountedVotes'][$index] += intval($value);
            }
        }
        
        // Add up party votes
        if (isset($totalVotes['Selection'])) {
            foreach ($totalVotes['Selection'] as $selection) {
                $partyId = $selection['AffiliationIdentifier']['Id'];
                $votes = intval($selection['ValidVotes']);
                $totalStats['totalValidVotes'] += $votes;
                
                if (!isset($partyTotals[$partyId])) {
                    $partyTotals[$partyId] = [
                        'party' => $partyId,
                        'name' => $selection['AffiliationIdentifier']['Name'],
                        'votes' => 0
                    ];
                }
                $partyTotals[$partyId]['votes'] += $votes;
            }
        }
    }
    
    // Map the uncounted votes to reason codes
    $reasonCodes = [
        'geldige stempassen',
        'geldige volmachtbewijzen',
        'geldige kiezerspassen',
        'toegelaten kiezers',
        'meer getelde stembiljetten',
        'minder getelde stembiljetten',
        'meegenomen stembiljetten',
        'te weinig uitgereikte stembiljetten',
        'te veel uitgereikte stembiljetten',
        'geen verklaring',
        'andere verklaring'
    ];
    
    $mappedUncounted = [];
    foreach ($totalStats['uncountedVotes'] as $index => $value) {
        if (isset($reasonCodes[$index])) {
            $mappedUncounted[$reasonCodes[$index]] = $value;
        }
    }
    $totalStats['uncountedVotes'] = $mappedUncounted;
    
    return [
        'election' => $election,
        'municipality' => 'totals',
        'statistics' => $totalStats,
        'results' => array_values($partyTotals)
    ];
}

function getAllMunicipalityVotes($election) {
    $electionDir = __DIR__ . "/../data/elections/{$election}";
    if (!is_dir($electionDir)) {
        throw new Exception("Election {$election} not found");
    }
    
    $files = glob($electionDir . "/GM*.json");
    if (empty($files)) {
        throw new Exception("No municipality data found for election {$election}");
    }
    
    $municipalities = [];
    foreach ($files as $file) {
        $municipalityCode = basename($file, '.json');
        try {
            $result = getMunicipalityVotes($election, $municipalityCode);
            
            // Simplify party results by removing IDs
            $simplifiedResults = array_map(function($item) {
                return [
                    'name' => $item['name'],
                    'votes' => $item['votes']
                ];
            }, $result['results']);
            
            // Remove redundant election info and restructure
            $municipalities[] = [
                'municipality' => $result['municipality'],
                'statistics' => $result['statistics'],
                'results' => $simplifiedResults
            ];
        } catch (Exception $e) {
            // Skip failed municipalities
            continue;
        }
    }
    
    // Sort by municipality code for consistent ordering
    usort($municipalities, function($a, $b) {
        return strcmp($a['municipality'], $b['municipality']);
    });
    
    return $municipalities;
}

try {
    if (isset($_GET['election'])) {
        if (isset($_GET['municipality'])) {
            if ($_GET['municipality'] === 'all') {
                $data = getAllMunicipalityVotes($_GET['election']);
            } else if ($_GET['municipality'] === 'totals') {
                $data = getTotalVotes($_GET['election']);
            } else {
                $data = getMunicipalityVotes($_GET['election'], $_GET['municipality']);
            }
        } else {
            $data = getAvailableElections();
        }
    } else {
        $data = getAvailableElections();
    }
    echo json_encode($data);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
} 
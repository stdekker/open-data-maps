<?php
require_once __DIR__ . '/security.php';

setSecurityHeaders();
header('Content-Type: application/json');

// Common constants
const REASON_CODES = [
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

function validateElectionPath($election) {
    // Use sanitized path component
    $sanitizedElection = sanitizePathComponent($election);
    $electionDir = __DIR__ . "/../data/elections/{$sanitizedElection}";
    if (!is_dir($electionDir)) {
        throw new Exception("Election {$sanitizedElection} not found");
    }
    return $electionDir;
}

function mapUncountedVotes($uncountedVotes) {
    $mappedUncounted = [];
    foreach ($uncountedVotes as $index => $value) {
        if (isset(REASON_CODES[$index])) {
            $mappedUncounted[REASON_CODES[$index]] = intval($value);
        }
    }
    return $mappedUncounted;
}

function processVoteStatistics($totalVotes) {
    $stats = [
        'cast' => isset($totalVotes['Cast']) ? intval($totalVotes['Cast']) : 0,
        'totalCounted' => isset($totalVotes['TotalCounted']) ? intval($totalVotes['TotalCounted']) : 0,
        'rejectedVotes' => [
            'ongeldig' => isset($totalVotes['RejectedVotes'][0]) ? intval($totalVotes['RejectedVotes'][0]) : 0,
            'blanco' => isset($totalVotes['RejectedVotes'][1]) ? intval($totalVotes['RejectedVotes'][1]) : 0
        ],
        'totalValidVotes' => 0,
        'uncountedVotes' => isset($totalVotes['UncountedVotes']) ? mapUncountedVotes($totalVotes['UncountedVotes']) : []
    ];
    
    return $stats;
}

function processPartyVotes($selections, $affiliations) {
    $voteSummary = [];
    $sumValidVotes = 0;
    
    // Create a lookup map for affiliations for faster access
    $affiliationMap = [];
    foreach ($affiliations as $affiliation) {
        $affiliationMap[$affiliation['Id']] = $affiliation['Name'];
    }

    foreach ($selections as $selection) {
        $votes = intval($selection['ValidVotes']);
        $sumValidVotes += $votes;
        $partyId = $selection['AffiliationId']; // Use AffiliationId
        $partyName = $affiliationMap[$partyId] ?? 'Unknown'; // Lookup name, provide default

        $voteSummary[] = [
            'party' => $partyId,
            'name' => $partyName, 
            'votes' => $votes
        ];
    }
    
    return ['summary' => $voteSummary, 'total' => $sumValidVotes];
}

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
    // Sanitize inputs
    $sanitizedElection = sanitizePathComponent($election);
    $sanitizedMunicipalityCode = sanitizePathComponent($municipalityCode);
    
    $filePath = __DIR__ . "/../data/elections/{$sanitizedElection}/{$sanitizedMunicipalityCode}.json";
    if (!file_exists($filePath)) {
        throw new Exception("No data found for municipality {$sanitizedMunicipalityCode} in election {$sanitizedElection}");
    }
    
    $data = json_decode(file_get_contents($filePath), true);
    if (!$data) {
        throw new Exception("Failed to parse election data");
    }
    
    $contest = $data['Contests']['Contest'];
    $totalVotes = $contest['TotalVotes'];
    
    $stats = processVoteStatistics($totalVotes);
    $partyResults = processPartyVotes($totalVotes['Selection'] ?? [], $contest['Affiliations'] ?? []);
    $stats['totalValidVotes'] = $partyResults['total'];
    
    return [
        'election' => $sanitizedElection,
        'municipality' => $sanitizedMunicipalityCode,
        'statistics' => $stats,
        'results' => $partyResults['summary']
    ];
}

function getTotalVotes($election) {
    // Sanitize election input
    $sanitizedElection = sanitizePathComponent($election);
    $electionDir = validateElectionPath($sanitizedElection);
    
    $files = glob($electionDir . "/GM*.json");
    if (empty($files)) {
        throw new Exception("No municipality data found for election {$sanitizedElection}");
    }
    
    $totalStats = [
        'cast' => 0,
        'totalCounted' => 0,
        'rejectedVotes' => ['ongeldig' => 0, 'blanco' => 0],
        'totalValidVotes' => 0,
        'uncountedVotes' => []
    ];
    
    // Use party name as the primary key for aggregation
    $partyTotalsByName = []; 
    // Store party details (like ID) encountered, keyed by name
    $partyDetails = [];

    foreach ($files as $file) {
        $data = json_decode(file_get_contents($file), true);
        if (!$data) continue;
        
        $contest = $data['Contests']['Contest'];
        $totalVotesData = $contest['TotalVotes']; // Renamed for clarity
        $affiliations = $contest['Affiliations'] ?? [];

        // Create a lookup map for *this municipality's* affiliations
        $currentAffiliationMap = [];
        foreach ($affiliations as $affiliation) {
            $currentAffiliationMap[$affiliation['Id']] = $affiliation['Name'];
        }
        
        // Add up main statistics (excluding totalValidVotes, calculated below)
        $stats = processVoteStatistics($totalVotesData);
        $totalStats['cast'] += $stats['cast'];
        $totalStats['totalCounted'] += $stats['totalCounted'];
        $totalStats['rejectedVotes']['ongeldig'] += $stats['rejectedVotes']['ongeldig'];
        $totalStats['rejectedVotes']['blanco'] += $stats['rejectedVotes']['blanco'];
        
        // Aggregate uncounted votes
        foreach ($stats['uncountedVotes'] as $reason => $count) {
            if (!isset($totalStats['uncountedVotes'][$reason])) {
                $totalStats['uncountedVotes'][$reason] = 0;
            }
            $totalStats['uncountedVotes'][$reason] += $count;
        }
        
        // Aggregate party votes using the party NAME as the key
        if (isset($totalVotesData['Selection'])) {
            $currentMunicipalityValidVotes = 0; // Track valid votes for this municipality

            foreach ($totalVotesData['Selection'] as $selection) {
                $affiliationId = $selection['AffiliationId'];
                $votes = isset($selection['ValidVotes']) ? intval($selection['ValidVotes']) : 0;
                $currentMunicipalityValidVotes += $votes;

                // Ensure ID is usable for lookup
                if (!is_string($affiliationId) && !is_int($affiliationId)) { 
                    // Optional: Log this malformed ID
                    // error_log("Malformed AffiliationId in file $file: " . print_r($affiliationId, true));
                    continue; 
                } 
                
                $partyName = $currentAffiliationMap[$affiliationId] ?? 'Unknown (' . $affiliationId . ')';

                // Ensure $partyName is scalar (string/int) before using as an array key
                if (!is_string($partyName) && !is_int($partyName)) {
                    // Log or handle the error where partyName is not scalar
                    error_log("Non-scalar party name derived for AffiliationId: $affiliationId in file: $file. Skipping entry.");
                    continue; // Skip this entry
                }

                // Initialize or add votes, keyed by party name
                if (!isset($partyTotalsByName[$partyName])) {
                    $partyTotalsByName[$partyName] = 0;
                }
                $partyTotalsByName[$partyName] += $votes;

                // Store party details (Id, Name) the first time we see a party name
                if (!isset($partyDetails[$partyName])) {
                    $partyDetails[$partyName] = [
                        'party' => $affiliationId, // Store the ID from the first file encountered
                        'name' => $partyName
                    ];
                }
            }
            $totalStats['totalValidVotes'] += $currentMunicipalityValidVotes; // Accumulate total valid votes
        }
    }

    // After the loop, format the results
    $finalResults = [];
    foreach ($partyTotalsByName as $name => $totalVotes) {
        // Exclude 'party' ID from the final output for totals
        $finalResults[] = [
            'name' => $name,
            'votes' => $totalVotes
        ];
    }

    // Optional: Sort results (e.g., alphabetically by name)
    usort($finalResults, function($a, $b) {
        return strcmp($a['name'], $b['name']); 
    });
    
    return [
        'election' => $sanitizedElection,
        'municipality' => 'totals',
        'statistics' => $totalStats,
        'results' => $finalResults // Use the newly constructed results
    ];
}

function getAllMunicipalityVotes($election) {
    // Sanitize election input
    $sanitizedElection = sanitizePathComponent($election);
    $electionDir = validateElectionPath($sanitizedElection);
    
    $files = glob($electionDir . "/GM*.json");
    if (empty($files)) {
        throw new Exception("No municipality data found for election {$sanitizedElection}");
    }
    
    $municipalities = [];
    foreach ($files as $file) {
        $municipalityCode = basename($file, '.json');
        try {
            // Call getMunicipalityVotes with already sanitized election
            // $municipalityCode comes from filesystem (basename), considered safe here
            $result = getMunicipalityVotes($sanitizedElection, $municipalityCode);
            
            // Simplify party results by removing IDs
            $simplifiedResults = array_map(function($item) {
                return [
                    'name' => $item['name'],
                    'votes' => $item['votes']
                ];
            }, $result['results']);
            
            $municipalities[] = [
                'municipality' => $result['municipality'],
                'statistics' => $result['statistics'],
                'results' => $simplifiedResults
            ];
        } catch (Exception $e) {
            // Optional: Log exception
            // error_log("Error processing $municipalityCode in $sanitizedElection: " . $e->getMessage());
            continue;
        }
    }
    
    usort($municipalities, function($a, $b) {
        return strcmp($a['municipality'], $b['municipality']);
    });
    
    return $municipalities;
}

try {
    $election = $_GET['election'] ?? null;
    $municipality = $_GET['municipality'] ?? null;

    if ($election) {
        // Validate election format (e.g., alphanumeric, maybe year format like TK2023)
        $validatedElection = validateInputRegex($election, '/^[a-zA-Z0-9]+$/', 'Invalid election format');

        if ($municipality) {
            // Allow specific strings or a GM code format
            if (in_array($municipality, ['all', 'totals'], true)) {
                $validatedMunicipality = $municipality;
            } else {
                $validatedMunicipality = validateInputRegex($municipality, '/^GM[0-9]{4}$/', 'Invalid municipality format');
            }

            if ($validatedMunicipality === 'all') {
                $data = getAllMunicipalityVotes($validatedElection);
            } else if ($validatedMunicipality === 'totals') {
                $data = getTotalVotes($validatedElection);
            } else {
                $data = getMunicipalityVotes($validatedElection, $validatedMunicipality);
            }
        } else {
            // No municipality specified, just get available elections
            $data = getAvailableElections(); // Does not require election param
        }
    } else {
        // No election specified, get available elections
        $data = getAvailableElections();
    }
    echo json_encode($data);
} catch (Exception $e) {
    // Standardized error response
    http_response_code(500);
    // Avoid leaking detailed exception messages in production
    echo json_encode(['error' => 'An internal error occurred']); 
    // Optional: Log the actual error
    // error_log("API Error: " . $e->getMessage());
} 
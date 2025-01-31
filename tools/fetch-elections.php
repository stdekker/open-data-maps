<?php
/**
 * Election Data Processing Script
 * 
 * This script downloads and processes election data from data.overheid.nl:
 * 1. Downloads ZIP files containing election results in EML XML format
 * 2. Extracts the ZIP files
 * 3. Processes each municipality's XML file to:
 *    - Convert election results to simplified JSON format
 * 4. Organizes results by municipality code (GM code)
 */

// Ensure this script is only run from command line
if (php_sapi_name() !== 'cli') {
    die('This script can only be run from the command line');
}

$elections = [
    'GR2022' => [   
        'https://data.overheid.nl/sites/default/files/dataset/08b04bec-3332-4c76-bb0c-68bfaeb5df43/resources/GR2022_2022-03-29T15.14.zip',  
    ],
    'GR2018' => [
        'https://data.overheid.nl/OpenDataSets/verkiezingen2018/GR2018.zip',
    ],
    'TK2021' => [
        'https://data.overheid.nl/sites/default/files/dataset/39e9bad4-4667-453f-ba6a-4733a956f6f8/resources/EML_bestanden_TK2021_deel_1.zip',
        'https://data.overheid.nl/sites/default/files/dataset/39e9bad4-4667-453f-ba6a-4733a956f6f8/resources/EML_bestanden_TK2021_deel_2.zip',
        'https://data.overheid.nl/sites/default/files/dataset/39e9bad4-4667-453f-ba6a-4733a956f6f8/resources/EML_bestanden_TK2021_deel_3.zip'
    ], 
    'TK2023' => [
        'hhttps://data.overheid.nl/sites/default/files/dataset/e3fe6e42-06ab-4559-a466-a32b04247f68/resources/Verkiezingsuitslag%20Tweede%20Kamer%202023%20%28Deel%201%29.zip',
        'https://data.overheid.nl/sites/default/files/dataset/e3fe6e42-06ab-4559-a466-a32b04247f68/resources/Verkiezingsuitslag%20Tweede%20Kamer%202023%20%28Deel%202%29.zip',
        'https://data.overheid.nl/sites/default/files/dataset/e3fe6e42-06ab-4559-a466-a32b04247f68/resources/Verkiezingsuitslag%20Tweede%20Kamer%202023%20%28Deel%203%29.zip'
    ],
    // Add more elections if needed
];

// Command line options
// Set target municipality
$targetMunicipality = null;
$targetMunicipalityCode = null;

// Load gemeenten.json for municipality code lookup
$gemeentenJson = file_get_contents(__DIR__ . '/../web/data/gemeenten.json');
if ($gemeentenJson === false) {
    die("Error: Could not read gemeenten.json file\n");
}
$gemeenten = json_decode($gemeentenJson, true);
if ($gemeenten === null) {
    die("Error: Could not parse gemeenten.json file\n");
}

foreach ($argv as $arg) {
    if (strpos($arg, '--m=') === 0) {
        $targetMunicipality = substr($arg, 4);
        // Look up municipality code
        foreach ($gemeenten['features'] as $feature) {
            if (strcasecmp($feature['properties']['gemeentenaam'], $targetMunicipality) === 0) {
                $targetMunicipalityCode = substr($feature['properties']['gemeentecode'], 2); // Remove 'GM' prefix
                echo "Found municipality code for $targetMunicipality: $targetMunicipalityCode\n";
                break;
            }
        }
        if ($targetMunicipalityCode === null) {
            die("Error: Municipality '$targetMunicipality' not found in gemeenten.json\n");
        }
        break;
    }
}

// Create base directories if they don't exist
if (!file_exists('process')) {
    mkdir('process');
}
if (!file_exists(__DIR__ . '/../web/data/elections')) {
    mkdir(__DIR__ . '/../web/data/elections', 0777, true);
}

foreach ($elections as $election => $urls) {
    // Create election-specific data directory
    if (!file_exists(__DIR__ . "/../web/data/elections/$election")) {
        mkdir(__DIR__ . "/../web/data/elections/$election", 0777, true);
    }
    
    echo "Processing $election...\n";
    
    // Create election-specific directory
    $electionDir = "process/$election";
    if (!file_exists($electionDir)) {
        mkdir($electionDir);
    }
    
    // Check if directory is empty
    $files = scandir($electionDir);
    if (count($files) <= 2) { // Only . and .. present means directory is empty
        foreach ($urls as $url) {
            // Generate unique filename based on URL
            $zipFile = $electionDir . '/' . basename($url);
            
            // Download the zip file
            echo "Downloading " . basename($url) . "...\n";
            exec("curl -L '$url' -o $zipFile");
            
            // Extract directly to election directory
            echo "Extracting files to $electionDir...\n";
            exec("unzip -o $zipFile -d $electionDir");
            
            // Clean up zip file
            unlink($zipFile);
        }
    } else {
        echo "Directory $electionDir is not empty, skipping download...\n";
    }
    // Process XML files
    echo "Converting XML files to JSON...\n";
    $xmlFiles = [];
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($electionDir));
    foreach ($iterator as $file) {
        if (!$file->isFile()) continue;
        
        $filename = $file->getFilename();
        $municipality = null;
        
        // Match TK pattern: Telling_TK2021_gemeente_Eemsdelta.eml.xml
        if (preg_match("/Telling_{$election}_gemeente_(.+)\.eml\.xml$/", $filename, $matches)) {
            $municipality = $matches[1];
        }
        // Match GR pattern: Telling_GR2022_Groningen.eml.xml (updated pattern)
        elseif (preg_match("/Telling_{$election}_(.+)\.eml\.xml$/", $filename, $matches)) {
            $municipality = $matches[1];
        }
        
        if ($municipality !== null) {
            // Load XML to check municipality code
            $xml = simplexml_load_file($file->getPathname());
            if ($xml !== false) {
                $authorityId = (string)$xml->ManagingAuthority->AuthorityIdentifier['Id'];
                if (!empty($authorityId)) {
                    if ($targetMunicipalityCode === null || $authorityId === $targetMunicipalityCode) {
                        $xmlFiles[] = $file->getPathname();
                    }
                }
            }
        }
    }
    $totalFiles = count($xmlFiles);

    if($totalFiles == 0) {
        if ($targetMunicipality !== null) {
            echo "No XML files found for municipality $targetMunicipality in $election\n";
        } else {
            echo "No XML files found for $election\n";
        }
        echo "Would you like to continue processing other elections? (y/n): ";
        $handle = fopen("php://stdin", "r");
        $line = fgets($handle);
        if(trim(strtolower($line)) != 'y'){
            echo "Aborting process...\n";
            exit(1);
        }
        continue;
    }
    
    foreach ($xmlFiles as $i => $xmlFile) {
        $currentFile = $i + 1;
        echo "Processing file $currentFile of $totalFiles: " . basename($xmlFile) . "\n";
        
        $xml = simplexml_load_file($xmlFile);
        if ($xml === false) {
            echo "Failed to parse XML file: $xmlFile\n";
            continue;
        }
        
        // Extract municipality code from AuthorityIdentifier
        $authorityId = (string)$xml->ManagingAuthority->AuthorityIdentifier['Id'];
        if (empty($authorityId)) {
            echo "Warning: No AuthorityIdentifier found in file: " . basename($xmlFile) . "\n";
            continue;
        }

        // Skip if not the target municipality
        if ($targetMunicipalityCode !== null && $authorityId !== $targetMunicipalityCode) {
            continue;
        }

        // Create output filename using GM prefix and authority ID
        $jsonFile = __DIR__ . "/../web/data/elections/$election/GM{$authorityId}.json";
        
        // Always use simplified data
        $data = simplifyElectionData($xml);

        if (file_put_contents($jsonFile, json_encode($data, JSON_PRETTY_PRINT)) === false) {
            echo "Failed to write JSON file: $jsonFile\n";
        } else {
            echo "Created JSON file: $jsonFile\n";
        }
    }
    
    echo "Completed processing $election\n";
}

echo "All elections processed!\n";

// Helper function to simplify the election data
function simplifyElectionData($xml) {
    $data = json_decode(json_encode($xml), true); // Convert SimpleXML to array
    
    // Extract the Election element
    if (isset($data['Count']['Election'])) {
        $data = $data['Count']['Election'];
    }
    
    // Extract affiliations from the first set of selections
    if (isset($data['Contests']['Contest']['TotalVotes']['Selection'])) {
        $affiliations = [];
        foreach ($data['Contests']['Contest']['TotalVotes']['Selection'] as $selection) {
            if (isset($selection['AffiliationIdentifier'])) {
                $id = $selection['AffiliationIdentifier']['@attributes']['Id'];
                $affiliations[$id] = [
                    'Id' => $id,
                    'Name' => $selection['AffiliationIdentifier']['RegisteredName'] ?? null
                ];
            }
        }
        
        // Add affiliations list to Contest
        $data['Contests']['Contest']['Affiliations'] = array_values($affiliations);
        
        // Replace full AffiliationIdentifier objects with just the ID reference
        $replaceAffiliationWithId = function(&$selection) {
            if (isset($selection['AffiliationIdentifier'])) {
                $selection['AffiliationId'] = $selection['AffiliationIdentifier']['@attributes']['Id'];
                unset($selection['AffiliationIdentifier']);
            }
        };
        
        // Process TotalVotes selections
        array_walk($data['Contests']['Contest']['TotalVotes']['Selection'], $replaceAffiliationWithId);
        
        // Process ReportingUnitVotes selections
        if (isset($data['Contests']['Contest']['ReportingUnitVotes'])) {
            foreach ($data['Contests']['Contest']['ReportingUnitVotes'] as &$unit) {
                if (isset($unit['Selection'])) {
                    array_walk($unit['Selection'], $replaceAffiliationWithId);
                }
            }
        }
    }
    
    removeCandidateData($data); // We do not use any candidate data
    return $data;
}

// Recursively remove candidate data and simplify identifiers in array
function removeCandidateData(&$array) {
    if (!is_array($array)) {
        return;
    }
    
    // Simplify identifier structures
    $identifierKeys = ['ContestIdentifier', 'ElectionIdentifier'];
    foreach ($identifierKeys as $key) {
        if (isset($array[$key])) {
            $simplified = [
                'Id' => $array[$key]['@attributes']['Id']
            ];
            // Preserve name if it exists
            if (isset($array[$key]['ContestName'])) {
                $simplified['Name'] = $array[$key]['ContestName'];
            }
            if (isset($array[$key]['ElectionName'])) {
                $simplified['Name'] = $array[$key]['ElectionName'];
            }
            if (isset($array[$key]['RegisteredName'])) {
                $simplified['Name'] = $array[$key]['RegisteredName'];
            }
            $array[$key] = $simplified;
        }
    }
    
    // Remove Candidate elements from Selection arrays
    if (isset($array['Selection'])) {
        // Ensure Selection is always an array
        if (!isset($array['Selection'][0])) {
            $array['Selection'] = [$array['Selection']];
        }
        
        // Filter out entries with Candidate data
        $array['Selection'] = array_filter($array['Selection'], function($item) {
            return !isset($item['Candidate']);
        });
        
        // Re-index array
        $array['Selection'] = array_values($array['Selection']);
    }
    
    // Recursively process all array elements
    foreach ($array as &$value) {
        if (is_array($value)) {
            removeCandidateData($value);
        }
    }
}
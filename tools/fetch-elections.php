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
    /* 'TK2021' => [
        'https://data.overheid.nl/sites/default/files/dataset/39e9bad4-4667-453f-ba6a-4733a956f6f8/resources/EML_bestanden_TK2021_deel_1.zip',
        'https://data.overheid.nl/sites/default/files/dataset/39e9bad4-4667-453f-ba6a-4733a956f6f8/resources/EML_bestanden_TK2021_deel_2.zip',
        'https://data.overheid.nl/sites/default/files/dataset/39e9bad4-4667-453f-ba6a-4733a956f6f8/resources/EML_bestanden_TK2021_deel_3.zip'
    ], */
    'TK2023' => [
        'hhttps://data.overheid.nl/sites/default/files/dataset/e3fe6e42-06ab-4559-a466-a32b04247f68/resources/Verkiezingsuitslag%20Tweede%20Kamer%202023%20%28Deel%201%29.zip',
        'https://data.overheid.nl/sites/default/files/dataset/e3fe6e42-06ab-4559-a466-a32b04247f68/resources/Verkiezingsuitslag%20Tweede%20Kamer%202023%20%28Deel%202%29.zip',
        'https://data.overheid.nl/sites/default/files/dataset/e3fe6e42-06ab-4559-a466-a32b04247f68/resources/Verkiezingsuitslag%20Tweede%20Kamer%202023%20%28Deel%203%29.zip'
    ]
    // Add more elections if needed
];

// Command line options
// Do a full output for debugging
$simplifyOutput = !isset($argv[1]) || $argv[1] !== '--full';

// Set target municipality
$targetMunicipality = null;
foreach ($argv as $arg) {
    if (strpos($arg, '--m=') === 0) {
        $targetMunicipality = substr($arg, 14);
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
        if ($file->isFile() && preg_match("/Telling_{$election}_gemeente_.*\.eml\.xml$/", $file->getFilename())) {
            $municipality = str_replace(['Telling_', $election . '_gemeente_', '.eml.xml'], '', basename($file));
            if ($targetMunicipality === null || $targetMunicipality === $municipality) {
                $xmlFiles[] = $file->getPathname();
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

        // Create output filename using GM prefix and authority ID
        $jsonFile = __DIR__ . "/../web/data/elections/$election/GM{$authorityId}.json";
        
        // Use simplified or full data based on configuration
        $data = $simplifyOutput ? simplifyElectionData($xml) : $xml;

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
    removeCandidateData($data); // We do not use any candidate data
    return $data;
}

// Recursively remove candidate data and simplify identifiers in array
function removeCandidateData(&$array) {
    if (!is_array($array)) {
        return;
    }
    
    // Simplify identifier structures
    $identifierKeys = ['ContestIdentifier', 'ElectionIdentifier', 'AffiliationIdentifier'];
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
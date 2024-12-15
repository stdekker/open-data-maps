<?php

// Ensure this script is only run from command line
if (php_sapi_name() !== 'cli') {
    die('This script can only be run from the command line');
}

$elections = [
    'TK2021' => [
        'https://data.overheid.nl/sites/default/files/dataset/39e9bad4-4667-453f-ba6a-4733a956f6f8/resources/EML_bestanden_TK2021_deel_1.zip',
        'https://data.overheid.nl/sites/default/files/dataset/39e9bad4-4667-453f-ba6a-4733a956f6f8/resources/EML_bestanden_TK2021_deel_2.zip',
        'https://data.overheid.nl/sites/default/files/dataset/39e9bad4-4667-453f-ba6a-4733a956f6f8/resources/EML_bestanden_TK2021_deel_3.zip'
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

// Add at the start of the script, after elections array
$reportingUnits = [];

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
    
    // Use DirectoryIterator instead of RecursiveIteratorIterator for flat directory
    foreach (new DirectoryIterator($electionDir) as $file) {
        if ($file->isFile() && preg_match("/Telling_{$election}_gemeente_.*\.eml\.xml$/", $file->getFilename())) {
            $municipality = str_replace(['Telling_', $election . '_gemeente_', '.eml.xml'], '', $file->getFilename());
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
        
        // Extract municipality name (keep this for reporting units)
        $municipality = str_replace(['Telling_', $election . '_gemeente_', '.eml.xml'], '', basename($xmlFile));
        
        // Process reporting units with minimal memory usage
        if (isset($xml->Count->Election->Contests->Contest->ReportingUnitVotes)) {
            if (!isset($reportingUnits[$authorityId])) {
                $reportingUnits[$authorityId] = [
                    'name' => $municipality,
                    'units' => []
                ];
            }
            
            foreach ($xml->Count->Election->Contests->Contest->ReportingUnitVotes as $reportingUnitVotes) {
                $unitId = (string)$reportingUnitVotes->ReportingUnitIdentifier;
                unset($reportingUnitVotes); // Free memory
                
                if (preg_match('/^Stembureau\s+(.+?)(?:\s*\(postcode:\s*([^)]+)\))?$/i', $unitId, $matches)) {
                    $reportingUnits[$authorityId]['units'][$unitId] = [
                        'original_id' => $unitId,
                        'address' => trim($matches[1]),
                        'postcode' => isset($matches[2]) ? trim($matches[2]) : null
                    ];
                } else {
                    $reportingUnits[$authorityId]['units'][$unitId] = [
                        'original_id' => $unitId,
                        'address' => $unitId,
                        'postcode' => null
                    ];
                }
            }
        }

        // Process and write JSON in chunks
        $jsonFile = __DIR__ . "/../web/data/elections/$election/GM{$authorityId}.json";
        
        if ($simplifyOutput) {
            // Process XML in a memory-efficient way
            $writer = new JsonStreamWriter($jsonFile);
            $writer->start();
            processXmlChunks($xml, $writer);
            $writer->end();
        } else {
            // For full output, still use the direct conversion but with cleanup
            $data = json_decode(json_encode($xml), true);
            file_put_contents($jsonFile, json_encode($data, JSON_PRETTY_PRINT));
            unset($data); // Free memory
        }
        
        // Free up memory
        unset($xml);
        gc_collect_cycles();
        
        echo "Created JSON file: $jsonFile\n";
    }
    
    // After processing all files, save the reporting units data
    $reportingUnitsFile = __DIR__ . "/../web/data/elections/$election/reporting_units.json";
    // Sort municipalities alphabetically
    ksort($reportingUnits);
    foreach ($reportingUnits as &$municipality) {
        // Sort reporting units within each municipality by address
        uasort($municipality['units'], function($a, $b) {
            return strcmp($a['address'], $b['address']);
        });
    }
    if (file_put_contents($reportingUnitsFile, json_encode($reportingUnits, JSON_PRETTY_PRINT)) === false) {
        echo "Failed to write reporting units file\n";
    } else {
        echo "Created reporting units file\n";
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

class JsonStreamWriter {
    private $handle;
    
    public function __construct($filename) {
        $this->handle = fopen($filename, 'w');
    }
    
    public function start() {
        fwrite($this->handle, '{');
    }
    
    public function writeKey($key) {
        fwrite($this->handle, '"' . $key . '":');
    }
    
    public function writeValue($value) {
        fwrite($this->handle, json_encode($value));
    }
    
    public function writeSeparator() {
        fwrite($this->handle, ',');
    }
    
    public function end() {
        fwrite($this->handle, '}');
        fclose($this->handle);
    }
    
    public function startObject() {
        fwrite($this->handle, '{');
    }
    
    public function endObject() {
        fwrite($this->handle, '}');
    }
}

function processXmlChunks($xml, $writer) {
    $isFirst = true;
    $sections = ['ManagingAuthority', 'Count'];
    
    foreach ($sections as $section) {
        if (isset($xml->$section)) {
            if (!$isFirst) {
                $writer->writeSeparator();
            }
            $writer->writeKey($section);
            
            // Process section data in chunks for Count section
            if ($section === 'Count') {
                $writer->startObject();
                
                // Process each child element separately
                foreach ($xml->$section->children() as $childName => $childValue) {
                    if (!$isFirst) {
                        $writer->writeSeparator();
                    }
                    $writer->writeKey($childName);
                    
                    // Special handling for large Election section
                    if ($childName === 'Election') {
                        processElectionSection($childValue, $writer);
                    } else {
                        $data = json_decode(json_encode($childValue), true);
                        $writer->writeValue($data);
                    }
                    
                    $isFirst = false;
                }
                
                $writer->endObject();
            } else {
                // For smaller sections, process normally
                $sectionData = json_decode(json_encode($xml->$section), true);
                $writer->writeValue($sectionData);
            }
            
            $isFirst = false;
        }
    }
}

// Add new helper function to process Election section in chunks
function processElectionSection($election, $writer) {
    $writer->startObject();
    $isFirst = true;
    
    foreach ($election->children() as $childName => $childValue) {
        if (!$isFirst) {
            $writer->writeSeparator();
        }
        $writer->writeKey($childName);
        
        // Special handling for Contests section which contains the bulk of the data
        if ($childName === 'Contests') {
            processContestsSection($childValue, $writer);
        } else {
            $data = json_decode(json_encode($childValue), true);
            $writer->writeValue($data);
        }
        
        $isFirst = false;
    }
    
    $writer->endObject();
}

function processContestsSection($contests, $writer) {
    $writer->startObject();
    $isFirst = true;
    
    foreach ($contests->children() as $childName => $childValue) {
        if (!$isFirst) {
            $writer->writeSeparator();
        }
        $writer->writeKey($childName);
        
        $data = json_decode(json_encode($childValue), true);
        removeCandidateData($data);
        $writer->writeValue($data);
        
        unset($data);
        $isFirst = false;
    }
    
    $writer->endObject();
}
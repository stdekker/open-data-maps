#!/usr/bin/env php
<?php

require_once __DIR__ . '/GeoJSON.php';
require_once __DIR__ . '/Topology.php';
require_once __DIR__ . '/Simplifier.php';

// Argument parsing
$options = getopt("i:o:p:");
$input = $options['i'] ?? null;
$output = $options['o'] ?? null;
$percent = $options['p'] ?? null;

if (!$input || !$output || !$percent) {
    echo "Usage: php mapshaper.php -i input.json -o output.json -p 10%\n";
    exit(1);
}

// Parse percentage
$percent = rtrim($percent, '%');
$percent = floatval($percent) / 100;

echo "Reading $input...\n";
try {
    $data = GeoJSON::read($input);
} catch (Exception $e) {
    echo "Error reading input: " . $e->getMessage() . "\n";
    exit(1);
}

echo "Building topology...\n";
$topology = new Topology($data);
$topology->build();

echo "Simplifying to " . ($percent * 100) . "%...\n";
$simplifier = new Simplifier();
$simplifier->simplify($topology, $percent);

echo "Reconstructing GeoJSON...\n";
$newData = $topology->export($data);

echo "Writing to $output...\n";
try {
    GeoJSON::write($output, $newData);
} catch (Exception $e) {
    echo "Error writing output: " . $e->getMessage() . "\n";
    exit(1);
}

echo "Done.\n";

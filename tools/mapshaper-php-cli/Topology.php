<?php

class Topology {
    public $arcs = []; // Array of arrays of points [[x,y], [x,y], ...]
    public $shapes = []; // Reconstructed shapes structure: [Layer][Shape][Path] -> [ArcID, ArcID...]
    private $points = []; // Flat list of all points
    private $nn = []; // Length of each path
    private $xx = []; // X coordinates
    private $yy = []; // Y coordinates
    
    private $pathIds = []; // Maps point index to path index
    private $pointMap = []; // Maps point index to unique point index
    private $adjacency = []; // Maps unique point index to list of adjacent points (in paths)
    
    public function __construct($geojson) {
        $this->extractPaths($geojson);
    }

    private function extractPaths($geojson) {
        $this->shapes = $this->visitGeometry($geojson);
    }

    private function visitGeometry($geometry) {
        $type = $geometry['type'] ?? null;

        if ($type === 'FeatureCollection') {
            $shapes = [];
            foreach ($geometry['features'] as $feature) {
                $shapes[] = $this->visitGeometry($feature);
            }
            return $shapes;
        }

        if ($type === 'Feature') {
            if (isset($geometry['geometry'])) {
                return $this->visitGeometry($geometry['geometry']);
            }
            return null;
        }

        $coords = $geometry['coordinates'] ?? null;

        if (!$coords) return null;

        if ($type === 'LineString') {
            return [$this->addPath($coords)];
        } elseif ($type === 'Polygon' || $type === 'MultiLineString') {
            $paths = [];
            foreach ($coords as $path) {
                $paths[] = $this->addPath($path);
            }
            return $paths;
        } elseif ($type === 'MultiPolygon') {
            $polygons = [];
            foreach ($coords as $polygon) {
                $polyPaths = [];
                foreach ($polygon as $path) {
                    $polyPaths[] = $this->addPath($path);
                }
                $polygons[] = $polyPaths;
            }
            return $polygons; // Note: Structure is different for MultiPolygon
        }
        return null;
    }

    private function addPath($coords) {
        $len = count($coords);
        if ($len < 2) return -1;
        
        $pathId = count($this->nn);
        $this->nn[] = $len;
        
        foreach ($coords as $point) {
            $this->xx[] = $point[0];
            $this->yy[] = $point[1];
            $this->pathIds[] = $pathId;
        }
        return $pathId;
    }

    public function build() {
        $this->indexPoints();
        $this->findNodesAndArcs();
        // Replace pathIDs in shapes with actual arc IDs
        $this->replacePathIdsWithArcIds();
    }
    
    /**
     * Replace path IDs in the shapes structure with arc IDs from topology
     */
    private function replacePathIdsWithArcIds() {
        $this->shapes = $this->replaceInStructure($this->shapes);
    }
    
    /**
     * Recursively replace path IDs with arc ID arrays in nested structure
     */
    private function replaceInStructure($structure) {
        if (!is_array($structure)) {
            // Base case: if it's a path ID (integer), replace with arc IDs
            if (is_int($structure) && isset($this->pathArcs[$structure])) {
                return $this->pathArcs[$structure];
            }
            return $structure;
        }
        
        // Recursive case: process array elements
        $result = [];
        foreach ($structure as $key => $value) {
            $result[$key] = $this->replaceInStructure($value);
        }
        return $result;
    }

    public function export($originalGeoJSON) {
        return $this->reconstructFeature($originalGeoJSON, $this->shapes);
    }

    private function reconstructFeature($element, &$shapeIter) {
        $type = $element['type'] ?? null;

        if ($type === 'FeatureCollection') {
            if (isset($element['features'])) {
                $newFeatures = [];
                foreach ($element['features'] as $i => $feature) {
                    // shapeIter is an array of shapes for the collection
                    if (isset($shapeIter[$i])) {
                        $newFeatures[] = $this->reconstructFeature($feature, $shapeIter[$i]);
                    } else {
                        $newFeatures[] = $feature; // Should not happen if topology matches
                    }
                }
                $element['features'] = $newFeatures;
            }
            return $element;
        }

        if ($type === 'Feature') {
            if (isset($element['geometry'])) {
                // For a Feature, the shapeIter IS the geometry's shape
                $element['geometry'] = $this->reconstructFeature($element['geometry'], $shapeIter);
            }
            return $element;
        }

        // Geometry types
        if ($type === 'LineString') {
            // shapeIter should be [arcIds] (wrapped in array because visitGeometry returns [addPath])
            // But wait, visitGeometry for LineString returns [$pathId].
            // And we replaced $pathId with [arcIds].
            // So shapeIter is [[arcIds]].
            // reconstructPath expects [arcIds].
            // So we need shapeIter[0].
            if (isset($shapeIter[0])) {
                $element['coordinates'] = $this->reconstructPath($shapeIter[0]);
            }
        } elseif ($type === 'Polygon' || $type === 'MultiLineString') {
            // shapeIter is [[arcIds], [arcIds], ...]
            $coords = [];
            foreach ($shapeIter as $pathArcs) {
                $ring = $this->reconstructPath($pathArcs);
                // For Polygon type, validate ring has at least 4 points
                // For MultiLineString, no validation needed (can have 2+ points)
                if ($type === 'MultiLineString' || count($ring) >= 4) {
                    $coords[] = $ring;
                }
            }
            $element['coordinates'] = $coords;
        } elseif ($type === 'MultiPolygon') {
            // shapeIter is [[[arcIds], ...], ...]
            $coords = [];
            foreach ($shapeIter as $polygonPaths) {
                $polyCoords = [];
                foreach ($polygonPaths as $pathArcs) {
                    $ring = $this->reconstructPath($pathArcs);
                    // Validate: A valid polygon ring must have at least 4 coordinate points
                    // (minimum 3 unique points + closing point that duplicates the first)
                    if (count($ring) >= 4) {
                        $polyCoords[] = $ring;
                    }
                }
                // Only add the polygon if it has at least one valid ring
                if (!empty($polyCoords)) {
                    $coords[] = $polyCoords;
                }
            }
            $element['coordinates'] = $coords;
        }
        
        return $element;
    }

    private function reconstructPath($arcIds) {
        $pathPoints = [];
        if (empty($arcIds)) return [];

        foreach ($arcIds as $i => $arcId) {
            $isReversed = $arcId < 0;
            $realId = $isReversed ? ~$arcId : $arcId;
            
            if (!isset($this->arcs[$realId])) continue;
            
            $arcPoints = $this->arcs[$realId];
            
            if ($isReversed) {
                $arcPoints = array_reverse($arcPoints);
            }
            
            // If not the first arc, skip the first point (it duplicates the last point of previous arc)
            if ($i > 0) {
                array_shift($arcPoints);
            }
            
            foreach ($arcPoints as $pt) {
                $pathPoints[] = $pt;
            }
        }
        
        // Ensure ring closure for Polygons?
        // The arcs should naturally close if the topology is correct.
        // But floating point errors might exist? No, we use exact points.
        
        return $pathPoints;
    }


    private function indexPoints() {
        $map = [];
        $count = count($this->xx);
        $this->pointMap = array_fill(0, $count, 0);
        
        for ($i = 0; $i < $count; $i++) {
            // Use string key for coordinate lookup
            // Precision might be an issue, but for now standard string conversion is used
            $key = (string)$this->xx[$i] . ',' . (string)$this->yy[$i];
            if (isset($map[$key])) {
                $this->pointMap[$i] = $map[$key];
            } else {
                $map[$key] = $i;
                $this->pointMap[$i] = $i;
            }
        }
    }

    private function findNodesAndArcs() {
        $count = count($this->xx);
        $numPaths = count($this->nn);
        
        // 1. Build point instances map (u -> [i1, i2, ...])
        $pointInstances = [];
        for ($i = 0; $i < $count; $i++) {
            $u = $this->pointMap[$i];
            if (!isset($pointInstances[$u])) {
                $pointInstances[$u] = [];
            }
            $pointInstances[$u][] = $i;
        }

        // 2. Identify nodes
        // A point is a node if it has != 2 unique neighbors across all paths
        // OR if it is a path endpoint (which implies degree 1 usually, but we force it)
        $isNode = array_fill(0, $count, false);
        
        // Mark path endpoints as nodes first
        $pathStart = 0;
        for ($p = 0; $p < $numPaths; $p++) {
            $len = $this->nn[$p];
            if ($len > 0) {
                $startI = $pathStart;
                $endI = $pathStart + $len - 1;
                // Mark the unique point as a node, so all instances are nodes
                $uStart = $this->pointMap[$startI];
                $uEnd = $this->pointMap[$endI];
                // We'll mark instances later, just track unique IDs for now?
                // No, let's mark the specific indices, but we need to propagate to all instances of that unique point.
            }
            $pathStart += $len;
        }

        // Check neighbors for every unique point
        $nodeUniqueIds = [];
        foreach ($pointInstances as $u => $instances) {
            $neighbors = [];
            $isEndpoint = false;
            
            foreach ($instances as $i) {
                // Find path for this instance
                // We need to know if $i$ is start or end of its path
                // We can check $this->nn and offsets, or just check neighbors
                // If $i$ is start, prev is null. If end, next is null.
                
                // Helper to find prev/next in current path
                // We need path boundaries. 
                // Let's pre-calculate path boundaries or look them up.
                // $this->pathIds[$i] tells us the path.
                // But we need start/end index of that path.
                // Let's use a simpler check:
                // $i-1 is neighbor if pathIds[$i-1] == pathIds[$i]
                // $i+1 is neighbor if pathIds[$i+1] == pathIds[$i]
                
                $pId = $this->pathIds[$i];
                
                // Check Prev
                if ($i > 0 && $this->pathIds[$i-1] == $pId) {
                    $neighbors[$this->pointMap[$i-1]] = true;
                } else {
                    $isEndpoint = true;
                }
                
                // Check Next
                if ($i < $count - 1 && $this->pathIds[$i+1] == $pId) {
                    $neighbors[$this->pointMap[$i+1]] = true;
                } else {
                    $isEndpoint = true;
                }
            }
            
            $degree = count($neighbors);
            if ($isEndpoint || $degree !== 2) {
                $nodeUniqueIds[$u] = true;
            }
        }
        
        // Mark all instances of node points
        $nodeCount = 0;
        for ($i = 0; $i < $count; $i++) {
            if (isset($nodeUniqueIds[$this->pointMap[$i]])) {
                $isNode[$i] = true;
                $nodeCount++;
            }
        }
        echo "Found $nodeCount node instances out of $count points.\n";

        // 3. Extract Arcs
        $this->arcs = [];
        $arcMap = []; // Key -> ArcID
        $this->pathArcs = []; // PathID -> [ArcID, ...]
        
        $pathStart = 0;
        for ($p = 0; $p < $numPaths; $p++) {
            $len = $this->nn[$p];
            $pathEnd = $pathStart + $len - 1;
            
            $currentPathArcs = [];
            $arcStart = $pathStart;
            
            for ($i = $pathStart; $i < $pathEnd; $i++) {
                // We are at point $i. The segment is $i -> $i+1.
                // If $i is a node (and not start of current arc), we split BEFORE $i?
                // No, nodes are endpoints of arcs.
                // So an arc goes from Node A to Node B.
                // If $i is a node, it starts a new arc (unless it's the end of the path).
                // If $i+1 is a node, the current arc ends at $i+1.
                
                // Logic:
                // Start arc at $arcStart.
                // Walk until we hit a node at $j (where $j > $arcStart).
                // That arc is $arcStart...$j.
                // Then new arc starts at $j.
                
                if ($isNode[$i+1]) {
                    // Arc ends at $i+1
                    $arcEnd = $i+1;
                    $arcPoints = [];
                    $arcKeyIds = []; // For deduplication
                    
                    for ($k = $arcStart; $k <= $arcEnd; $k++) {
                        $arcPoints[] = [$this->xx[$k], $this->yy[$k]];
                        $arcKeyIds[] = $this->pointMap[$k];
                    }
                    
                    // Deduplicate
                    // Canonical key: smallest endpoint first.
                    // If start > end, reverse for key.
                    // If start == end (ring), use lowest index in middle?
                    // For simplicity, let's try direct match and reverse match.
                    
                    $uStart = $arcKeyIds[0];
                    $uEnd = $arcKeyIds[count($arcKeyIds)-1];
                    
                    $isReversed = false;
                    if ($uStart > $uEnd) {
                        $keyIds = array_reverse($arcKeyIds);
                        $isReversed = true;
                    } else {
                        $keyIds = $arcKeyIds;
                    }
                    
                    $key = implode(',', $keyIds);
                    
                    if (isset($arcMap[$key])) {
                        $arcId = $arcMap[$key];
                        // If we found it via reversed key, we need to store it as reversed reference?
                        // Mapshaper uses ~id for reversed.
                        // In our structure, we'll store integer IDs.
                        // If $isReversed, we might want to flag it.
                        // But for simplification, we just need the arc geometry.
                        // The reconstruction needs to know direction.
                        // So we should store signed IDs.
                        if ($isReversed) {
                            $arcId = ~$arcId; // Bitwise NOT for negative-like ID (-id - 1)
                        }
                    } else {
                        $arcId = count($this->arcs);
                        $this->arcs[] = $arcPoints; // Store original direction
                        // If we used the reversed key, it means we are storing the REVERSED version as the canonical one?
                        // No, we constructed the key from the canonical (sorted endpoints) sequence.
                        // But we store the arc points as we found them ($arcPoints).
                        // Wait, if we match a key, we want to use the EXISTING arc.
                        // If $isReversed is true, it means the current arc is B->A, but key is A->B.
                        // If existing arc was A->B, then we match.
                        // So we should store the arc corresponding to the KEY.
                        
                        if ($isReversed) {
                            // The key is A->B. We have B->A.
                            // We should store A->B in $this->arcs so future A->B matches find it.
                            $this->arcs[$arcId] = array_reverse($arcPoints);
                            $arcMap[$key] = $arcId;
                            $arcId = ~$arcId; // We have B->A, so we refer to A->B reversed.
                        } else {
                            $this->arcs[$arcId] = $arcPoints;
                            $arcMap[$key] = $arcId;
                        }
                    }
                    
                    $currentPathArcs[] = $arcId;
                    $arcStart = $i + 1;
                }
            }
            
            // Map the path index to these arcs
            // We need to store this in $this->shapes structure.
            // But $this->shapes is a nested array of path IDs.
            // We need a map: PathID -> [ArcIDs].
            $this->pathArcs[$p] = $currentPathArcs;
            
            $pathStart += $len;
        }
    }
}

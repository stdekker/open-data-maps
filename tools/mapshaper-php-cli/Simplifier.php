<?php

class Simplifier {
    public function simplify($topology, $percentage) {
        // Count total points before simplification
        $totalBefore = 0;
        foreach ($topology->arcs as $arc) {
            $totalBefore += count($arc);
        }
        
        $allPoints = []; // List of ['area' => float, 'arcId' => int, 'idx' => int]
        $totalArcs = count($topology->arcs);
        $processedArcs = 0;
        $lastProgress = 0;

        foreach ($topology->arcs as $arcId => $arc) {
            $areas = $this->calculateArcAreas($arc);
            // Skip endpoints
            for ($i = 1; $i < count($areas) - 1; $i++) {
                $allPoints[] = [
                    'area' => $areas[$i],
                    'arcId' => $arcId,
                    'idx' => $i
                ];
            }
            
            $processedArcs++;
            $progress = floor(($processedArcs / $totalArcs) * 100);
            if ($progress > $lastProgress && $progress % 5 === 0) {
                $lastProgress = $progress;
            }
        }

        if (empty($allPoints)) return;
        
        // Sort by area ascending
        usort($allPoints, function($a, $b) {
            if ($a['area'] == $b['area']) return 0;
            return ($a['area'] < $b['area']) ? -1 : 1;
        });
        
        $totalPoints = count($allPoints);
        $keepCount = floor($totalPoints * $percentage);
        $removeCount = $totalPoints - $keepCount;
        
        // Mark points to remove
        $removeMap = []; // [arcId][idx] => true
        
        $lastProgress = 0;
        for ($i = 0; $i < $removeCount; $i++) {
            $p = $allPoints[$i];
            if (!isset($removeMap[$p['arcId']])) {
                $removeMap[$p['arcId']] = [];
            }
            $removeMap[$p['arcId']][$p['idx']] = true;
            
            // Progress update every 5%
            $progress = floor(($i / $removeCount) * 100);
            if ($progress > $lastProgress && $progress % 5 === 0) {
                $lastProgress = $progress;
            }
        }
        
        // Filter arcs
        foreach ($topology->arcs as $arcId => $arc) {
            $newArc = [];
            $len = count($arc);
            
            // Always keep endpoints
            $newArc[] = $arc[0];
            
            for ($i = 1; $i < $len - 1; $i++) {
                if (!isset($removeMap[$arcId][$i])) {
                    $newArc[] = $arc[$i];
                }
            }
            
            $newArc[] = $arc[$len - 1];
            $topology->arcs[$arcId] = $newArc;
        }
        
        // Count total points after simplification
        $totalAfter = 0;
        foreach ($topology->arcs as $arc) {
            $totalAfter += count($arc);
        }
    }

    private function calculateArcAreas($arc) {
        $len = count($arc);
        $areas = array_fill(0, $len, INF); // Endpoints are infinite
        if ($len < 3) return $areas;

        // Doubly linked list simulation
        $prev = [];
        $next = [];
        for ($i = 0; $i < $len; $i++) {
            $prev[$i] = $i - 1;
            $next[$i] = $i + 1;
        }

        // Initial areas
        $heap = new SplMinHeap();
        $currentAreas = [];

        for ($i = 1; $i < $len - 1; $i++) {
            $area = $this->weightedTriangleArea($arc[$i-1], $arc[$i], $arc[$i+1]);
            $currentAreas[$i] = $area;
            $heap->insert([$area, $i]);
            // echo "Init Heap: Point $i, Area $area\n";
        }

        $minArea = -INF;
        
        // Process heap
        while (!$heap->isEmpty()) {
            list($area, $i) = $heap->extract();
            // echo "Popped: Point $i, Area $area. Current stored: " . $currentAreas[$i] . "\n";
            
            // Lazy deletion check: if stored area is outdated, skip
            if (abs($area - $currentAreas[$i]) > 1e-9) continue;
            
            // Store the effective area before monotonicity enforcement
            $areas[$i] = $area;
            
            // Ensure monotonicity
            if ($area < $minArea) $area = $minArea;
            else $minArea = $area;
            
            $currentAreas[$i] = INF; // Mark as removed

            // Update neighbors
            $p = $prev[$i];
            $n = $next[$i];
            
            if ($p > 0) {
                // Update prev's area using its new neighbor n
                // Prev's prev is $prev[$p]
                $pp = $prev[$p];
                $newArea = $this->weightedTriangleArea($arc[$pp], $arc[$p], $arc[$n]);
                $currentAreas[$p] = $newArea;
                $heap->insert([$newArea, $p]);
                $next[$p] = $n;
            }
            
            if ($n < $len - 1) {
                // Update next's area using its new neighbor p
                // Next's next is $next[$n]
                $nn = $next[$n];
                $newArea = $this->weightedTriangleArea($arc[$p], $arc[$n], $arc[$nn]);
                $currentAreas[$n] = $newArea;
                $heap->insert([$newArea, $n]);
                $prev[$n] = $p;
            }
        }
        
        return $areas;
    }

    private function triangleArea($a, $b, $c) {
        return abs(
            $a[0] * ($b[1] - $c[1]) +
            $b[0] * ($c[1] - $a[1]) +
            $c[0] * ($a[1] - $b[1])
        ) / 2;
    }
    
    /**
     * Calculate cosine of the angle at point b
     */
    private function cosine($a, $b, $c) {
        $abx = $a[0] - $b[0];
        $aby = $a[1] - $b[1];
        $cbx = $c[0] - $b[0];
        $cby = $c[1] - $b[1];
        
        $dot = $abx * $cbx + $aby * $cby;
        $magAB = sqrt($abx * $abx + $aby * $aby);
        $magCB = sqrt($cbx * $cbx + $cby * $cby);
        
        if ($magAB == 0 || $magCB == 0) return 0;
        
        return $dot / ($magAB * $magCB);
    }
    
    /**
     * Weighted triangle area using angle-based weighting
     * Weighting coefficient k=0.7 (default in mapshaper)
     * Formula: area * (-cos * k + 1)
     * This favors removing sharp angles and keeping straighter lines
     */
    private function weightedTriangleArea($a, $b, $c) {
        $area = $this->triangleArea($a, $b, $c);
        $cos = $this->cosine($a, $b, $c);
        $k = 0.7;
        $weight = -$cos * $k + 1;
        return $weight * $area;
    }
}

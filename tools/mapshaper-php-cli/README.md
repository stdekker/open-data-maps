# Mapshaper PHP CLI

A pure PHP implementation of the Visvalingam-Whyatt simplification algorithm for GeoJSON files. This tool performs topology-preserving simplification of geographic geometries.

## Features

- **Topology-preserving**: Maintains shared boundaries between adjacent polygons
- **Visvalingam-Whyatt algorithm**: Uses effective area calculation for intelligent point removal
- **Pure PHP**: No external dependencies required
- **Progress tracking**: Real-time progress updates during processing

## Requirements

- PHP 7.0 or higher
- No additional extensions required

## Usage

```bash
php mapshaper.php -i <input.json> -o <output.json> -p <percentage>
```

### Parameters

- `-i` : Input GeoJSON file path
- `-o` : Output GeoJSON file path  
- `-p` : Percentage of points to retain (e.g., `10%`, `50%`)

### Examples

**Simplify to 10% of original points:**
```bash
php tools/mapshaper-php-cli/mapshaper.php \
  -i web/data/gemeenten.json \
  -o web/data/gemeenten_simplified.json \
  -p 10%
```

**Simplify to 50% of original points:**
```bash
php tools/mapshaper-php-cli/mapshaper.php \
  -i input.json \
  -o output.json \
  -p 50%
```

## How It Works

1. **Topology Building**: Identifies shared edges between polygons and creates arc-node topology
2. **Area Calculation**: Computes effective area for each point using the Visvalingam-Whyatt algorithm
3. **Simplification**: Removes points with smallest effective areas while preserving topology
4. **Reconstruction**: Exports simplified geometry back to GeoJSON format

The Visvalingam-Whyatt algorithm removes points based on their "effective area" - the area of the triangle formed with neighboring points. Points forming smaller triangles (less visually significant) are removed first.

## Files

- `mapshaper.php` - Main CLI script
- `GeoJSON.php` - GeoJSON reader/writer
- `Topology.php` - Topology builder and reconstruction
- `Simplifier.php` - Visvalingam-Whyatt implementation

## Output

The tool provides progress updates during processing:

```
Reading input.json...
Building topology...
Found 4784 node instances out of 1437046 points.
Simplifying to 10%...
Calculating effective areas for 2513 arcs...
Calculating areas: 100%
Total points to simplify: 1105780. Target: Keep 110578, Remove 995202.
Marking for removal: 100%
Reconstructing GeoJSON...
Writing to output.json...
Done.
```

## Performance

For large datasets (1M+ points), expect processing times of several minutes depending on geometry complexity and target percentage.

## License

This implementation is based on the Visvalingam-Whyatt algorithm for line simplification.

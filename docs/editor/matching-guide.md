# Location Matching Guide

## Overview

The location matching feature allows you to quickly copy stembureau (polling station) locations from one election to another by matching similar names. This is extremely useful because polling stations often remain in the same physical locations across elections, even if their names vary slightly.

## When to Use Matching

Use the matching feature when:
- Setting up a new election and want to use locations from a previous election
- Many stembureaus have missing location data
- Polling stations are in the same venues as previous elections
- Names differ slightly but refer to the same location

## How Matching Works

### Name Normalization

The system normalizes stembureau names before comparing them:
- Removes "Stembureau" prefix
- Removes postcode information: `(postcode: 2801 GR)`
- Removes duplicate words
- Removes articles: "de", "het", "the"
- Converts to lowercase
- Removes extra spaces

**Examples:**
- `"Stembureau Stembureau de Agnietenkapel (postcode: 2801 GR)"` 
  → `"agnietenkapel"`
- `"Stembureau Het Oude Raadhuis"`
  → `"oude raadhuis"`

### Similarity Matching

The system uses text similarity algorithms to find matches:
- **100%** = Exact match after normalization
- **90-99%** = Very high similarity (minor differences)
- **80-89%** = High similarity (recommended threshold)
- **70-79%** = Medium similarity (may include false positives)
- **< 70%** = Low similarity (not matched by default)

## Step-by-Step Guide

### 1. Load Your Election Data

First, load the election and municipality you want to edit:
- Select election: `TK2025`
- Select municipality: `Utrecht`
- Click "Load Data"

### 2. Open the Matching Tool

Click the **"📍 Match from Election"** button in the list panel.

### 3. Select Source Election

Choose which election to copy locations from:
- Source elections are elections OTHER than the one you're editing
- Typically select the most recent previous election
- Example: If editing TK2025, select TK2023 as source

### 4. Choose Match Quality

Select the match quality threshold:
- **High (90%+)**: Only very close matches (safest, fewer matches)
- **Medium (80%+)**: Good balance (recommended)
- **Low (70%+)**: More matches but may include false positives

### 5. Find Matches

Click **"Find Matches"** button.

The system will:
- Load source election data for the same municipality
- Compare all stembureaus without locations
- Find the best match for each based on name similarity
- Display results with similarity scores

### 6. Review Results

Each match shows:
- **Current name**: The stembureau name in your election
- **Match quality**: Color-coded similarity score
  - 🟢 Green (90%+) = High confidence
  - 🟡 Yellow (80-89%) = Medium confidence
  - 🔴 Red (70-79%) = Low confidence
- **Source name**: The matched stembureau from source election
- **Coordinates**: Latitude and longitude that will be copied
- **Checkbox**: Select/deselect this match

### 7. Select/Deselect Matches

Review each match carefully:
- **Select All**: Check all matches at once
- **Deselect All**: Uncheck all matches
- **Individual**: Click checkboxes to toggle specific matches

**Tips for review:**
- High similarity (90%+) matches are usually safe to accept
- Medium similarity (80-89%) should be reviewed
- Low similarity (70-79%) should be verified carefully

### 8. Apply Matches

Click **"Apply Selected Matches"** to copy the locations.

The selected coordinates will be:
- Applied to your stembureaus
- Marked as "modified" (unsaved)
- Visible on the map

### 9. Save Changes

After applying matches:
- Review the updated locations on the map
- Make any manual adjustments if needed
- Click **"Save All Changes"** to persist to files

## Examples

### Example 1: Identical Names

**Current (TK2025):** `"Stembureau Basisschool De Regenboog"`
**Source (TK2023):** `"Stembureau Basisschool De Regenboog"`
**Result:** 100% match ✓

### Example 2: Name with Postcode Added

**Current (TK2025):** `"Stembureau Sporthal De Toekomst (postcode: 1234 AB)"`
**Source (TK2023):** `"Stembureau Sporthal De Toekomst"`
**Result:** 95% match ✓

### Example 3: Article Differences

**Current (TK2025):** `"Stembureau Stembureau de Agnietenkapel"`
**Source (TK2023):** `"Stembureau Agnietenkapel"`
**Result:** 100% match (after normalization) ✓

### Example 4: Different Stembureaus (Should Not Match)

**Current (TK2025):** `"Stembureau Gemeentehuis Zuid"`
**Source (TK2023):** `"Stembureau Gemeentehuis Noord"`
**Result:** 85% match ⚠️ (Review carefully - might be different locations)

## Best Practices

### 1. Start with High Threshold
- Begin with 90% threshold
- Lower if you need more matches
- Prevents false positives

### 2. Review Medium/Low Matches
- Always verify matches below 90%
- Check if names actually refer to same location
- Deselect questionable matches

### 3. Use Most Recent Source
- Choose the most recent previous election
- More likely to have accurate, updated locations
- Example: For TK2025, use TK2023 over TK2021

### 4. Check Map After Applying
- Zoom to applied locations on map
- Verify markers are in correct area
- Make manual adjustments if needed

### 5. Work Iteratively
- Apply high-confidence matches first
- Save those changes
- Return to match again with lower threshold if needed

## Troubleshooting

### No Matches Found

**Causes:**
- Source election doesn't have location data
- Names are very different between elections
- Threshold is too high

**Solutions:**
- Try a different source election
- Lower the threshold to 70%
- Check if source election has geocoded data

### Too Many Low-Quality Matches

**Causes:**
- Threshold too low
- Generic stembureau names
- Different naming convention

**Solutions:**
- Increase threshold to 90%
- Review each match individually
- Use manual editing for problematic cases

### Wrong Locations Applied

**Prevention:**
- Review matches before applying
- Start with high threshold
- Check map after applying

**Fix:**
- Don't save changes yet
- Reload the data to reset
- Or manually correct the locations

## Performance Tips

- Matching is fast (< 1 second for most municipalities)
- Process is done server-side
- Only sends stembureau names (not full data)
- Safe to match multiple times

## Technical Details

### Algorithm

1. **Normalize both names** (remove prefixes, postcodes, articles)
2. **Compare exact match** (100% if identical after normalization)
3. **Calculate similarity** (using similar_text PHP function)
4. **Select best match** (highest similarity above threshold)
5. **Return matches** (with similarity scores)

### Name Normalization Rules

```php
- Remove: /^Stembureau\s+/i
- Remove: /\s*\(postcode:[^)]+\)/i
- Remove: /\b(de|het|the)\s+/i
- Remove: /\s*\([^)]*\)/
- Trim and lowercase
- Remove multiple spaces
```

### API Endpoint

```
POST /edit/api/match-locations.php
```

See [README.md](README.md) for full API documentation.

## Related Features

- **Manual Editing**: Edit individual coordinates
- **Drag on Map**: Move markers visually
- **Batch Save**: Save all changes at once
- **Backup System**: Automatic backups before saving

## Support

If you encounter issues with matching:
1. Check that source election has geocoded data
2. Try different threshold levels
3. Review access.log for errors
4. Manually edit problematic stembureaus
5. Report persistent issues


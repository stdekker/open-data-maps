# Application Architecture

Open Data Maps (ODM) is designed to be simple and easy to deploy on standard LAMP stack web hosting. This means it works without requiring npm, Node.js, webpack, or database servers. The goal is to make the code easy to understand and modify, even for novice developers.

## How It Works

ODM is a **single-page application** (SPA) that shows Dutch municipality data on an interactive map. Here's the basic flow:

1. **User visits** `web/index.php` - The main page loads
2. **Browser downloads** JavaScript modules from `web/src/`
3. **JavaScript initializes** the Mapbox map and loads data
4. **User interacts** with the map - clicking, searching, toggling views
5. **PHP APIs** serve data files when requested (elections, statistics, etc.)

## Project Directory Structure

```
/
├── docs/              # All project documentation
├── config/            # Configuration files (outside web root for security)
│   └── edit-config.php
├── tools/             # Data processing and admin CLI scripts
├── process/           # Additional processing scripts
├── vendor/            # Composer dependencies (PHP packages)
├── .ddev/             # DDEV local development environment
└── web/               # Public web directory (this is what users access)
    ├── index.php      # Main application entry point
    ├── config.prod.php    # Production configuration
    ├── config.default.php # Configuration template
    ├── favicon.svg    # Site icon
    ├── api/           # PHP API endpoints
    ├── data/          # Data files (GeoJSON, election data)
    ├── src/           # Frontend JavaScript code
    ├── style/         # CSS stylesheets
    ├── content/       # Content files (help text, etc.)
    └── edit/          # Admin editor tool (login required)
```

## Web Directory (The Public Application)

The `web/` directory contains everything that users can access through their browser.

### Root Files

- **`index.php`** - The main application page. This is what loads when you visit the site.
- **`config.prod.php`** - Production settings (analytics, caching, CORS)
- **`config.default.php`** - Template for production config
- **`favicon.svg`** - The site icon shown in browser tabs

### `web/api/` - Backend API Endpoints

These PHP files serve data to the frontend:

- **`municipality.php`** - Fetches neighborhood and district data from CBS (Statistics Netherlands)
- **`elections.php`** - Serves election result data
- **`postcode6.php`** - Returns postal code data with caching
- **`bag.php`** - Provides building address data (BAG = Dutch address database)
- **`security.php`** - Security functions (input validation, headers)

### `web/data/` - Data Storage

```
data/
├── gemeenten.json         # Municipality boundary GeoJSON
├── postcode-cache.json    # Cached postal code data
├── elections/             # Election results by year
│   ├── TK2021/           # Election folder (e.g., Parliamentary 2021)
│   ├── TK2023/
│   └── TK2025/
├── cbs/                   # Statistics Netherlands data
│   └── 2023/             # Year-specific stats
├── pc6/                   # Postal code data
└── bag/                   # Building/address data
```

### `web/src/` - Frontend JavaScript

The JavaScript code is organized into modules (ES6 modules):

```
src/
├── main.js              # Main entry point - initializes everything
├── config.js            # Frontend configuration (Mapbox token, etc.)
└── modules/             # Organized feature modules
    ├── state.js         # Application state management
    ├── urlParams.js     # URL parameter handling
    ├── mobileHandler.js # Mobile-responsive behavior
    ├── UIFeatureInfoBox.js       # Info box component
    ├── UIFeatureSelectList.js    # Feature selection list
    ├── UIShared.js      # Shared UI utilities
    ├── services/        # Service modules (data, colors, etc.)
    │   ├── dataService.js      # Fetch and load data
    │   ├── layerService.js     # Map layer management
    │   ├── colorService.js     # Color schemes and styling
    │   ├── electionService.js  # Election data handling
    │   ├── modalService.js     # Modal dialogs (popups)
    │   ├── searchService.js    # Municipality search
    │   └── cacheService.js     # Client-side caching
    └── layers/          # Map layer implementations
        ├── municipalityLayer.js  # Municipality boundaries
        ├── postcodeLayer.js      # Postal code areas
        ├── electionsLayer.js     # Election reporting units
        └── bagLayer.js           # Building/address layer
```

### `web/style/` - Stylesheets

- **`main.css`** - All CSS styles for the main application

### `web/content/` - Content Files

- **`help.php`** - Help text content (loaded into modals)

### `web/edit/` - Admin Editor Tool

A separate authenticated application for editing polling station locations:

```
edit/
├── index.php         # Editor main page
├── login.php         # Login page
├── logout.php        # Logout handler
├── auth.php          # Authentication functions
├── api/              # Editor API endpoints
│   ├── list-stembureaus.php
│   ├── match-locations.php
│   └── save-location.php
├── src/
│   └── edit.js       # Editor JavaScript
├── style/
│   └── edit.css      # Editor styles
└── *.md              # Documentation files
``` 

## What the Application Does

ODM visualizes Dutch geographic, demographic and political data on an interactive map.

### Main Features

1. **Interactive Map**
   - Uses [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/) for smooth, fast rendering
   - Shows municipalities across the Netherlands
   - Colors regions (municipalities, neigbourhoods or postcodes) based on selected statistics
   - Hover over areas to see info
   - Click areas for detailed popups

2. **View Modes**
   - **National View**: See all municipalities at once with colored statistics
   - **Municipal View**: Zoom into one municipality to see neighborhoods, districts, or election data

3. **Data Layers (Toggleable)**
   - **Municipalities**: Boundary lines and statistics
   - **Neighborhoods (Buurten)**: Detailed neighborhood boundaries
   - **Districts (Wijken)**: District-level boundaries  
   - **Postal Codes (PC6)**: 6-digit postal code areas
   - **Buildings (BAG)**: Individual building footprints
   - **Election Data**: Polling station reporting units

4. **Statistics Display**
   - Population counts
   - Household statistics
   - Age distributions
   - Demographics
   - And more, based on available (processed) CBS data

5. **Search Functionality**
   - Search for municipalities by name
   - Autocomplete suggestions as you type
   - Jump directly to searched location

6. **Mobile-Friendly**
   - Responsive design works on phones and tablets
   - Collapsible sidebar for more map space

7. **URL State Sharing**
   - Current view saved in URL
   - Share links to specific municipalities or views
   - Browser back/forward buttons work

## How the Code is Organized

### Configuration Files

**For Production**
- `web/config.prod.php` - Analytics, caching duration, allowed domains, CORS settings
- `web/config.default.php` - Template showing what you can configure
- `web/src/config.js` - Frontend settings (Mapbox token, map center, default zoom)

**For Editor (Admin Tool)**  
- `config/edit-config.php` - Editor login credentials

**For Development**
- `.ddev/config.yaml` - DDEV local environment settings

### The JavaScript Structure

The frontend code uses **ES6 modules** - each file imports what it needs from other files.

#### Starting Point: `main.js`

This file is the "brain" of the application. It:
1. Imports all the services and components
2. Initializes the Mapbox map
3. Sets up event listeners (clicks, searches, toggles)
4. Manages switching between National and Municipal views
5. Coordinates all the modules to work together

#### Services (`web/src/modules/services/`)

Services are reusable functions that handle specific tasks:

- **`dataService.js`** - Fetch JSON data from APIs with error handling
- **`layerService.js`** - Add, remove, and style map layers
- **`colorService.js`** - Generate color schemes for data visualization (uses Chroma.js)
- **`electionService.js`** - Load and display election data
- **`modalService.js`** - Show popup dialogs (settings, help, etc.)
- **`searchService.js`** - Municipality search with autocomplete
- **`cacheService.js`** - Cache data locally to reduce API calls

#### Layers (`web/src/modules/layers/`)

Each layer module knows how to display a specific type of geographic data:

- **`municipalityLayer.js`** - Municipality boundaries and statistics
- **`postcodeLayer.js`** - 6-digit postal code areas
- **`electionsLayer.js`** - Election reporting units (polling stations)
- **`bagLayer.js`** - Building footprints from Dutch address database

#### UI Components

- **`UIFeatureInfoBox.js`** - The info box that shows municipality name and stats
- **`UIFeatureSelectList.js`** - Dropdown menus for selecting statistics
- **`UIShared.js`** - Shared UI utilities
- **`mobileHandler.js`** - Makes sidebar collapsible on mobile
- **`urlParams.js`** - Reads and updates URL parameters
- **`state.js`** - Stores current application state (selected municipality, view mode, etc.)

## How Data Flows Through the Application

Here's what happens when you click on a municipality:

```
1. User clicks on map
   ↓
2. main.js detects the click event
   ↓
3. main.js identifies which municipality was clicked
   ↓
4. dataService.js fetches that municipality's data
   ↓
5. layerService.js adds neighborhood/district layers to map
   ↓
6. colorService.js calculates colors based on statistics
   ↓
7. UIFeatureInfoBox.js updates the info box with name and stats
   ↓
8. urlParams.js updates the URL so you can share the link
   ↓
9. User sees the municipality view with colored neighborhoods
```

## Backend (PHP) API Endpoints

The PHP files in `web/api/` handle data requests:

**`municipality.php`**
- Fetches neighborhood (buurten) or district (wijken) data from CBS
- Caches the data locally in `web/data/cbs/`
- Returns GeoJSON with boundaries and statistics

**`elections.php`**  
- Serves election data for a specific municipality
- Returns JSON with polling station data

**`postcode6.php`**
- Returns postal code boundaries
- Implements caching to speed up repeated requests

**`bag.php`**
- Provides building footprint data
- Shows individual buildings on the map

**`security.php`**
- Security utility functions used by other APIs
- Validates and sanitizes input
- Sets security headers (CORS, content-type, etc.)

## Data Storage

All data is stored as **JSON files** in `web/data/`:

- **`gemeenten.json`** - All municipality boundaries (simplified GeoJSON)
- **`elections/`** - Election results organized by year and municipality
- **`cbs/`** - Statistics from CBS (fetched on-demand and cached)
- **`pc6/`** - Postal code data
- **`bag/`** - Building/address data

This approach means:
- ✅ No database required
- ✅ Fast loading (files served directly)
- ✅ Easy to update (just replace JSON files)
- ✅ Works on basic shared hosting

## For Developers: Where to Start

### Making Your First Change

**Want to change how the map looks?**
- Edit `web/src/config.js` - Change map center, zoom level, or Mapbox style

**Want to modify the UI?**
- Edit `web/style/main.css` - Change colors, fonts, layouts
- Edit `web/index.php` - Change HTML structure

**Want to add a new statistic?**
- Look at `web/src/modules/UIFeatureSelectList.js` - This is where statistics options are defined
- The data comes from the CBS GeoJSON files in `web/data/cbs/`

**Want to change how data is displayed?**
- Edit `web/src/main.js` - Main logic for displaying data
- Edit relevant service files in `web/src/modules/services/`

### Development Workflow

1. **Setup**: Use DDEV for local development
   ```bash
   ddev start
   ddev launch
   ```

2. **Make Changes**: Edit files in `web/src/` or `web/style/`

3. **Test**: Refresh your browser to see changes
   - JavaScript modules load dynamically (no build step!)
   - Clear cache if changes don't appear

4. **Deploy**: Upload changed files to your web server

### Understanding the Module System

The application uses **ES6 modules**. This means:

```javascript
// In main.js, you import from other files:
import { fetchData } from './modules/services/dataService.js';

// Then you can use the imported function:
const data = await fetchData('api/elections.php');
```

Benefits:
- Code is organized into logical files
- Each module has a clear purpose
- Easy to find where functionality lives
- No build step required (modern browsers support this natively)

### Key Files to Understand

If you're new to the codebase, read these files in order:

1. **`web/index.php`** - See the HTML structure
2. **`web/src/config.js`** - Understand the configuration
3. **`web/src/main.js`** (first 100 lines) - See how the map initializes
4. **`web/src/modules/services/dataService.js`** - Simple example of a service
5. **`web/src/modules/state.js`** - See how state is managed

### Common Tasks

**Add a new data source:**
1. Create a new PHP file in `web/api/` (copy `municipality.php` as a template)
2. Add a function in `dataService.js` to fetch from your new endpoint
3. Create a new layer module in `web/src/modules/layers/` if needed
4. Update `main.js` to use your new data

**Add a new toggle button:**
1. Add HTML for the toggle in `web/index.php`
2. Add event listener in `main.js`
3. Create a function to handle the toggle logic
4. Use `layerService.js` to show/hide the layer

**Modify colors:**
1. Edit `web/src/modules/services/colorService.js`
2. Look for the `getColorStops()` function
3. Modify the color scheme (uses Chroma.js library)

### Debugging Tips

**Open browser DevTools (F12):**
- **Console tab** - See JavaScript errors and logs
- **Network tab** - See which API calls are being made
- **Sources tab** - Set breakpoints in JavaScript code

**Common issues:**
- Data not loading? Check Network tab for failed requests
- Map not appearing? Check Console for Mapbox token errors
- Colors wrong? Check Console for data parsing errors

### Architecture Principles

This application follows these principles:

1. **Separation of Concerns**: UI, data, and map logic are in separate modules
2. **Service Pattern**: Reusable services (data, layer, color) used throughout
3. **No Build Step**: ES6 modules load directly in browser
4. **Progressive Enhancement**: Basic features work, advanced features add on
5. **Data-Driven**: Configuration in JSON files, not hardcoded

## Technology Stack

### Frontend
- **Mapbox GL JS 3.11** - Map rendering and interactions
- **Chroma.js** - Color manipulation for data visualization
- **Vanilla JavaScript (ES6+)** - No framework needed!
- **CSS3** - Modern layouts with flexbox and grid

### Backend
- **PHP 7.4+** - Simple API endpoints
- **No database** - JSON file storage
- **Composer** - PHP dependency management

### Development
- **DDEV** - Local development environment
- **Git** - Version control

### External Data Sources
- **CBS (Statistics Netherlands)** - Demographic data via WFS API
- **Kiesraad** - Election results (EML files processed to JSON)
- **PDOK** - Postal codes and building data

## Performance Considerations

### What Makes It Fast

1. **JSON Files**: Served directly by web server (very fast)
2. **Client-side Caching**: Reduces repeated API calls
3. **Server-side Caching**: PHP caches data from external APIs
4. **Simplified GeoJSON**: Municipality boundaries simplified to 1% for faster rendering
5. **Lazy Loading**: Data loaded only when needed
6. **Mapbox Vector Tiles**: Efficient map rendering

### What Could Be Optimized

- Large municipalities (like Amsterdam) load slowly due to many neighborhoods
- All election data loaded at once (could be split)
- No service worker for offline capabilities
- Could use CDN for static assets

## Editor Tool (Admin)

The editor at `/edit/` is a **separate application** for administrators to edit polling station locations. See [Editor Documentation](editor/README.md) for details.

Key differences:
- Requires login (username/password)
- Different JavaScript and CSS
- Own API endpoints
- Saves changes back to JSON files

## Security

### What's Secure

- ✅ Editor config outside web root (`/config/edit-config.php`)
- ✅ Input validation on all API endpoints (`security.php`)
- ✅ CSRF protection in editor
- ✅ Session-based authentication
- ✅ Access logging

### What to Watch

- Update dependencies regularly (`composer update`)
- Use HTTPS in production
- Set strong passwords for editor
- Configure CORS properly in `config.prod.php`
- Review access logs periodically

## Contributing

To contribute to this project:

1. Read this architecture document
2. Set up DDEV locally
3. Make your changes
4. Test thoroughly
5. Document new features
6. Submit changes

## Questions?

- Read the [full documentation](README.md)
- Check [editor documentation](editor/README.md) for editor questions
- Look at code comments in individual files
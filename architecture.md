# Application Architecture

The aim for this application is to be easy to deploy on shared hosting webservers. Most of them have a classic LAMP stack. And users are not allowed to install software. Therefore ODM is buit without npm, node, webpack or advanced database tools. The aim is also to make the code easy to understand and modify.

## Directory Structure 

The application is organized into the following main directories:

- `web/`: Contains the frontend application and PHP backend
- `tools/`: Contains PHP scripts for data processing
- `process/`: Contains additional processing scripts
- `vendor/`: Composer dependencies
- `.ddev/`: DDEV configuration for local development

### Web Directory Structure

- `web/src/`: Frontend JavaScript source code
- `web/content/`: Content files
- `web/css/` and `web/style/`: Stylesheets
- `web/api/`: Backend API endpoints
- `web/data/`: Data files

## Application Functionality

The application is an interactive mapping platform for Dutch municipalities with the following key features:

### Map Visualization
- Interactive map interface using Mapbox GL
- Municipality boundary visualization
- Dynamic color-coding based on selected statistics
- Support for both national and municipal level views

### Data Visualization
- Comprehensive demographic statistics including:
  - Population and household data
  - Age group distributions
  - Marital status statistics
  - Household compositions
  - Population origin/heritage data
  - Area measurements

### Election Data Integration
- Toggle between statistical and election data views
- Election results visualization by reporting units
- Support for multiple election datasets

### User Interface Features
- Municipality search with autocomplete
- Interactive hover effects on map regions
- Feature name box for selected areas
- Mobile-responsive design
- Popup information for selected regions

### Data Management
- Local storage for user preferences
- Postcode data caching
- Dynamic GeoJSON data loading
- Multiple data layer support (municipalities, postcodes, reporting units)
- URL parameter support for direct linking

## Key Components

### Configuration

- `.ddev/config.yaml`: DDEV configuration for local development environment
- `web/config.prod.php`: Production configuration
- `web/config.default.php`: Default configuration template
- `web/src/config.js`: Frontend configuration constants

### Data Processing

The `tools/` directory contains PHP scripts for fetching and processing data:

- `fetch-municipality-data.php`: Fetches and processes municipality data
- `fetch-elections.php`: Fetches and processes election data

### Frontend Structure

#### Entry Points

- `web/index.php`: Main application entry point
- `web/src/main.js`: Main JavaScript entry point

#### Core Modules

The `web/src/modules/` directory contains the core functionality:

1. **Layer Drawing Service** (`layerDrawingService.js`)
   - Handles map layer management and visualization
   - Manages feature highlighting and interaction

2. **Data Service** (`dataService.js`)
   - Manages data fetching and processing

3. **Election Service** (`electionService.js`)
   - Handles election-specific data and functionality

4. **Modal Service** (`modalService.js`)
   - Manages modal dialogs and popups

5. **Mobile Handler** (`mobileHandler.js`)
   - Handles mobile-specific functionality

6. **URL Parameters** (`urlParams.js`)
   - Manages URL parameter handling and routing 
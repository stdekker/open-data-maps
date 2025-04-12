# Application Architecture

The aim for this application is to be easy to deploy on shared hosting webservers. Most of them have a classic LAMP stack. And users are not allowed to install software. Therefore ODM is buit without npm, node, webpack or advanced database tools. The aim is also to make the code easy to understand and modify.

## Directory Structure 

The application is organized into the following main directories:

- `web/`: Contains the frontend application and PHP data api
- `tools/`: Contains PHP scripts for data processing
- `process/`: Contains additional processing scripts
- `vendor/`: Composer dependencies
- `.ddev/`: DDEV configuration for local development

### Web Directory Structure

- `web/src/`: Frontend JavaScript source code
- `web/content/`: Content files, like the text in the help popup
- `web/style/`: Stylesheets
- `web/api/`: API enpoints to handle static files on the LAMP server
- `web/data/`: Data files 

## Application Functionality

The application provides geodata visualisation or Dutch municipalities with the following key features:

### Map Visualization
- Interactive map interface using Mapbox GL 3.11
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

- `web/config.prod.php`: Production configuration
- `web/config.default.php`: Default configuration template
- `web/src/config.js`: Frontend configuration constants
- `.ddev/config.yaml`: DDEV configuration for local development environment

### Data Processing

The `tools/` directory contains PHP scripts for fetching and processing data:

- `fetch-municipality-data.php`: Fetches and processes municipality data
- `fetch-elections.php`: Fetches and processes election data

### Frontend Structure

#### Entry Points

- `web/index.php`: Main application entry point
- `web/src/main.js`: Main JavaScript entry point that orchestrates application initialization, handles view switching, and manages application state

#### Core Modules

The `web/src/modules/` directory contains the core functionality:

1. **Layer Service** (`layerService.js`)
   - Central service for managing map layers and sources
   - Provides utilities for adding, removing, and styling map layers
   - Handles layer cleanup and source management
   - Supports dynamic color styling and layer ordering

2. **Data Service** (`dataService.js`)
   - Provides standardized data fetching with error handling
   - Manages JSON data retrieval and parsing
   - Implements retry logic and error reporting

3. **Modal Service** (`modalService.js`)
   - Manages modal dialogs and popups
   - Controls modal visibility, content, and interaction
   - Provides consistent UI for dialogs across the application

4. **Color Service** (`colorService.js`)
   - Manages color schemes and styling for map features
   - Implements dynamic color scaling and balancing
   - Handles color stops and gradients for data visualization

5. **Mobile Handler** (`mobileHandler.js`)
   - Manages responsive UI behavior for mobile devices
   - Handles sidebar collapse/expand functionality
   - Controls touch interactions and mobile-specific layouts

6. **URL Parameters** (`urlParams.js`)
   - Manages application state through URL parameters
   - Handles parameter reading and updating
   - Supports direct linking and state persistence

7. **UI Feature Info Box** (`UIFeatureInfoBox.js`)
   - Manages feature information display
   - Handles statistics selection and population
   - Controls feature data presentation

8. **Election Service** (`electionService.js`)
   - Manages election reporting unit visualization
   - Handles election data popups and interactions
   - Controls election data display and toggling

#### Layer Modules

The `web/src/modules/layers/` directory contains specialized layer implementations:

1. **Municipality Layer** (`municipalityLayer.js`)
   - Handles municipality boundary visualization
   - Manages municipality-specific interactions and styling
   - Controls municipality data display and filtering

2. **Postcode Layer** (`postcodeLayer.js`)
   - Manages postcode area visualization
   - Handles postcode-specific data loading and caching
   - Controls postcode boundary styling and interactions

3. **Elections Layer** (`electionsLayer.js`)
   - Manages election reporting unit visualization
   - Handles election-specific data display and interactions
   - Controls election data coloring and filtering

#### Configuration

- **Configuration** (`config.js`)
   - Stores application-wide constants and settings
   - Manages map configuration and defaults
   - Controls API keys and environment settings
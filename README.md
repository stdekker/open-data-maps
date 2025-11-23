# Open Data Maps

ODM is a web-based geographic data visualization tool that gives insights into demographic and electoral data for Dutch municipalities. It combines detailed statistical information with an simple map navigation interface. 

It was designed to be a web application that is easy to deploy on what I consider a "classic shared hosting" environment. 

## Documentation

📖 **[View Full Documentation](docs/README.md)** - Complete documentation index

### Quick Links
- **[Architecture](docs/architecture.md)** - Application design and structure
- **[Editor Documentation](docs/editor/README.md)** - Stembureau location editor guide
- **[Security Improvements](docs/security-improvements.md)** - Recent security changes

## Features

### Main Application
- Interactive map with Mapbox GL
- Dutch municipality demographic data
- Election results visualization
- Responsive mobile design

### Editor Tool (Admin)
- Secure polling station location editor at `/edit/`
- Drag-and-drop marker editing
- Location matching between elections
- See [Editor Quick Start](docs/editor/quick-start.md)

## AI Coded 

This project was developed with significant assistance from AI coding tools. While this approach enabled rapid development and extensive rewrites of existing tooling, it's important to note:

- Code quality and reliability may vary
- Performance may not be optimal
- Security considerations may need additional review

Please use this code with appropriate caution and testing in production environments.

## Installation

1. Install Composer if you haven't already:
   - Windows: Download and run the installer from https://getcomposer.org/download/
   - Linux/Mac: Run `curl -sS https://getcomposer.org/installer | php` and move to PATH
2. Navigate to the project directory in your terminal
3. Run `composer install` to install all dependencies defined in composer.json
4. If you're using DDEV, you can run `ddev composer install` instead

## Data

Source gemeenten GeoJSon
https://www.pdok.nl/introductie/-/article/cbs-wijken-en-buurten

## Data processing

PDOK GeoJSON simplified with an PHP-cli adaptation of:
https://mapshaper.org/
Github: https://github.com/mbloch/mapshaper

## Development

### DDEV

This project uses DDEV to make local development easier. DDEV is a tool for creating local PHP development environments. You can download it from the [DDEV GitHub releases page](https://github.com/drud/ddev/releases). Follow the instructions for your operating system to install it.

### Project Structure

```
/
├── docs/              # 📖 All documentation
├── config/            # Configuration files (outside web root)
├── tools/             # Data processing and admin scripts
├── web/               # Public web directory
│   ├── edit/          # Admin editor (requires authentication)
│   ├── api/           # Data API endpoints
│   ├── src/           # Frontend JavaScript
│   └── data/          # Data files
└── vendor/            # Composer dependencies
```

## License

This code is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Attribution  

This app is based on an original project that was created by [Benjamin W. Broersma](https://www.broersma.com) and [Bob van Vliet](www.bvvlt.nl). Although the code for this application is completely rebuilt from scratch, I have borrowed many good ideas and original concepts from their original project. 

### Data attribution

All data used in this project is provided by the Dutch government and is available under the [Open Data License](https://www.pdok.nl/nl/over-pdok/open-data/open-data-licenties/open-data-licentie-gemeenten-wijken-buurten-2023).

The EML files from the Dutch electoral office (Kiesraad) can be found here: https://data.overheid.nl/community/organization/kiesraad
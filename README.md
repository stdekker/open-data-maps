# Open Data Maps

Open Data Maps (ODM) is a web-based geographic data visualization tool that gives insights into local demographic and electoral data for their work Dutch municipalities. It combines detailed statistical information from various sources with an simple map navigation interface. 

It was designed for easy deployment on what I consider a "classic shared hosting" environment.

## Donate
ODM was built in my spare time, but you can help
💸 [fund the development](https://bunq.me/stijndekker) of this project

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
├── docs/              # Full documentation
├── config/            # Configuration files (outside web root)
├── tools/             # Data processing and admin scripts
├── web/               # Public web directory
│   ├── edit/          # Polling station location editor (requires authentication to be set up)
│   ├── api/           # Data API endpoints
│   ├── src/           # Frontend JavaScript
│   └── data/          # Data files
└── vendor/            # Composer dependencies
```

## License

This code is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Attribution  

ODM is based on an application that was designed and created by [Benjamin W. Broersma](https://www.broersma.com) and [Bob van Vliet](https://www.bobvanvliet.nl/) in 2012 for the [Socialist Party of the Netherlands](https://www.sp.nl), where I worked at the time. Although the code is completely rebuilt from scratch, I have borrowed quite a lot of ideas from their inspirational work. 

### Data attribution

All data used in this project is provided by the Dutch government and is available under the [Open Data License](https://www.pdok.nl/nl/over-pdok/open-data/open-data-licenties/open-data-licentie-gemeenten-wijken-buurten-2023).

The EML files from the Dutch electoral office (Kiesraad) can be found here: https://data.overheid.nl/community/organization/kiesraad
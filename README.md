# Open Data Maps

ODM is a web-based geographic data visualization tool that gives insights into demographic and electoral data for Dutch municipalities. It combines detailed statistical information with an simple map navigation interface. 

## Architecture

The aim for this application is to be easy to deploy on shared hosting webservers.
See [architecture.md](architecture.md) for more information.

## AI Coded 

This project was developed with significant assistance from AI coding tools. While this approach enabled rapid development, it's important to note:

- Code quality and reliability may vary
- Edge cases and error handling might not always be comprehensive
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
https://nationaalgeoregister.nl/geonetwork/srv/dut/catalog.search#/metadata/70c52fd8-6b2e-42aa-873a-742711903243

https://service.pdok.nl/cbs/wijkenbuurten/2022/wfs/v1_0?request=GetFeature&service=WFS&version=1.1.0&outputFormat=application%2Fjson%3B%20subtype%3Dgeojson&typeName=wijkenbuurten:gemeenten

gemeenten.json GeoJSON simplified with:

https://mapshaper.org/

Simplify: 1%
https://github.com/mbloch/mapshaper

## DDEV

This project uses DDEV to make local development easier. DDEV is a tool for creating local PHP development environments. You can download it from the [DDEV GitHub releases page](https://github.com/drud/ddev/releases). Follow the instructions for your operating system to install it.

## License

This code is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Atrtribution  

This app is based on an original project that was created by [Benjamin W. Broersma](https://www.broersma.com) and [Bob van Vliet](www.bvvlt.nl). Although the code for this application is completely rebuilt from scratch, I have borrowed many good idea's and original concepts from their original project. 

### Data attribution

All data used in this project is provided by the Dutch government and is available under the [Open Data License](https://www.pdok.nl/nl/over-pdok/open-data/open-data-licenties/open-data-licentie-gemeenten-wijken-buurten-2022).

And the EML files from the Dutch electoral office (Kiesraad) can be found here: https://data.overheid.nl/community/organization/kiesraad
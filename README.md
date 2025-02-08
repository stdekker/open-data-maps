# Open Data Maps

ODM is a web-based geographic data visualization tool that gives insights into demographic and electoral data for Dutch municipalities. It combines detailed statistical information with an simple map navigation interface. 

## Architecture

The aim for this application is to be easy to deploy on shared hosting webservers.
See [architecture.md](architecture.md) for more information.

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

## Atrtribution  

This app is based on an original project that was created by [Benjamin W. Broersma](https://www.broersma.com) and [Bob van Vliet](www.bvvlt.nl). Although this code is completely rebuilt from scratch, with a lot of AI assistance, I have borrowed many concepts from their original project.

## License

This code is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

### Data attribution


All data used in this project is provided by the Dutch government and is available under the [Open Data License](https://www.pdok.nl/nl/over-pdok/open-data/open-data-licenties/open-data-licentie-gemeenten-wijken-buurten-2022).

And the EML files from the Dutch electoral office (Kiesraad) can be found here: https://data.overheid.nl/community/organization/kiesraad

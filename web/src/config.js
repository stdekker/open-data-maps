// Configuration file for storing constants and settings

// Mapbox access token
export const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1Ijoic2Rla2tlciIsImEiOiJjaXF4cjI1ZTAwMDRxaHVubmgwOHJjajJ1In0.w7ja8Yc35uk3yXCd7wXFhg';

// Map style
export const MAP_STYLE = 'mapbox://styles/mapbox/light-v11';

// Default map center and zoom
export const MAP_CENTER = [5.387, 52.156];
export const MAP_ZOOM = 7;

// Default municipality
export const DEFAULT_MUNICIPALITY = 'Amersfoort';
export const DEFAULT_MENU_ITEM = 'municipal-view';

// Statistics configuration
export const STATISTICS_CONFIG = {
    groups: {
        'Basis': [
            'aantalInwoners',
            'aantalHuishoudens',
            'omgevingsadressendichtheid',
            'stedelijkheidAdressenPerKm2',
            'bevolkingsdichtheidInwonersPerKm2',
            'mannen',
            'vrouwen'
        ],
        'Leeftijdsgroepen': [
            'percentagePersonen0Tot15Jaar',
            'percentagePersonen15Tot25Jaar',
            'percentagePersonen25Tot45Jaar',
            'percentagePersonen45Tot65Jaar',
            'percentagePersonen65JaarEnOuder'
        ],
        'Burgerlijke staat': [
            'percentageOngehuwd',
            'percentageGehuwd',
            'percentageGescheid',
            'percentageVerweduwd'
        ],
        'Huishoudens': [
            'percentageEenpersoonshuishoudens',
            'percentageHuishoudensZonderKinderen',
            'percentageHuishoudensMetKinderen',
            'gemiddeldeHuishoudsgrootte'
        ],
        'Herkomst': [
            'percentageMetHerkomstlandNederland',
            'percentageMetHerkomstlandUitEuropaExclNl',
            'percentageMetHerkomstlandBuitenEuropa'
        ],
        'Oppervlakte': [
            'oppervlakteTotaalInHa',
            'oppervlakteLandInHa'
        ]
    },
    labels: {
        'aantalInwoners': { display: 'Inwoners', unit: 'inwoners' },
        'aantalHuishoudens': { display: 'Huishoudens', unit: 'huishoudens' },
        'omgevingsadressendichtheid': { display: 'Omgevingsadressendichtheid', unit: 'adressen/km²' },
        'stedelijkheidAdressenPerKm2': { display: 'Stedelijkheid (adressen/km²)', unit: 'adressen/km²' },
        'bevolkingsdichtheidInwonersPerKm2': { display: 'Bevolkingsdichtheid (inw/km²)', unit: 'inw/km²' },
        'mannen': { display: 'Mannen', unit: 'mannen' },
        'vrouwen': { display: 'Vrouwen', unit: 'vrouwen' },
        'percentagePersonen0Tot15Jaar': { display: '0-15 jaar (%)', unit: '% 0-15 jaar' },
        'percentagePersonen15Tot25Jaar': { display: '15-25 jaar (%)', unit: '% 15-25 jaar' },
        'percentagePersonen25Tot45Jaar': { display: '25-45 jaar (%)', unit: '% 25-45 jaar' },
        'percentagePersonen45Tot65Jaar': { display: '45-65 jaar (%)', unit: '% 45-65 jaar' },
        'percentagePersonen65JaarEnOuder': { display: '65+ jaar (%)', unit: '% 65+ jaar' },
        'percentageOngehuwd': { display: 'Ongehuwd (%)', unit: '% ongehuwd' },
        'percentageGehuwd': { display: 'Gehuwd (%)', unit: '% gehuwd' },
        'percentageGescheid': { display: 'Gescheiden (%)', unit: '% gescheiden' },
        'percentageVerweduwd': { display: 'Verweduwd (%)', unit: '% verweduwd' },
        'percentageEenpersoonshuishoudens': { display: 'Eenpersoonshuishoudens (%)', unit: '% eenpersoons' },
        'percentageHuishoudensZonderKinderen': { display: 'Huishoudens zonder kinderen (%)', unit: '% zonder kinderen' },
        'percentageHuishoudensMetKinderen': { display: 'Huishoudens met kinderen (%)', unit: '% met kinderen' },
        'gemiddeldeHuishoudsgrootte': { display: 'Gemiddelde huishoudgrootte', unit: 'personen/huishouden' },
        'percentageMetHerkomstlandNederland': { display: 'Nederlands (%)', unit: '% NL' },
        'percentageMetHerkomstlandUitEuropaExclNl': { display: 'Europees (excl. NL) (%)', unit: '% EU (excl. NL)' },
        'percentageMetHerkomstlandBuitenEuropa': { display: 'Buiten Europa (%)', unit: '% buiten EU' },
        'oppervlakteTotaalInHa': { display: 'Totaal (ha)', unit: 'ha totaal' },
        'oppervlakteLandInHa': { display: 'Land (ha)', unit: 'ha land' }
    }
};
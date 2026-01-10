# Planpresso

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![GitHub Pages](https://img.shields.io/badge/demo-GitHub%20Pages-blue)](https://crempa.github.io/planpresso)

> Plan, visualize & share your trips

![Planpresso Screenshot](assets/screenshot.svg)

**[Live Demo](https://crempa.github.io/planpresso)**

## Features

- Interactive map with numbered markers and geodesic route lines
- JSON-based trip configuration - define your entire trip in a simple JSON format
- URL sharing with LZString compression - share your trip with a single link
- LocalStorage persistence - your trip is saved automatically
- PNG export - download your trip map as an image
- Responsive design - works on desktop and mobile
- Start/End markers - visually distinguish trip start and end points
- Automatic marker offset - overlapping locations are automatically separated
- Czech validation messages - user-friendly error reporting

## Getting Started

1. Open `index.html` in your browser (or visit the [live demo](https://crempa.github.io/planpresso))
2. Paste your JSON trip definition into the input field
3. Click "Načíst plán" (Load Plan)

That's it! Your trip will be displayed on the map with all stops connected.

## JSON Schema

### Main Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `nazev` | string | Yes | Trip name displayed in the header |
| `emoji` | string | No | Emoji icon shown before the trip name |
| `datumOd` | string | Yes | Start date (flexible format: "15. 1. 2025", "2025-01-15", "15. ledna 2025") |
| `datumDo` | string | Yes | End date (same flexible format as datumOd) |
| `zastavky` | array | Yes | Array of stop objects |

### Stop Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `nazev` | string | Yes | Place name |
| `lat` | number | Yes | Latitude (-90 to 90) |
| `lng` | number | Yes | Longitude (-180 to 180) |
| `popisek` | string | No | Custom label for the map (defaults to `nazev`) |
| `datumy` | string | No | Date range for this stop (e.g., "15. 1. – 25. 1.") |
| `noci` | number | No | Number of nights at this location |
| `poznamky` | string | No | Notes, transfer info, tips, etc. |
| `typ` | string | No | `"start"` for green marker, `"cil"` for red end marker, omit for default |

## Example

See [examples/malaysia-trip.json](examples/malaysia-trip.json) for a complete example.

```json
{
  "nazev": "Weekend in Prague",
  "emoji": "🏰",
  "datumOd": "1. 3. 2025",
  "datumDo": "3. 3. 2025",
  "zastavky": [
    {
      "nazev": "Prague - Old Town",
      "lat": 50.0875,
      "lng": 14.4214,
      "datumy": "1. 3. – 2. 3.",
      "noci": 2,
      "typ": "start"
    },
    {
      "nazev": "Karlštejn Castle",
      "lat": 49.9394,
      "lng": 14.1883,
      "datumy": "2. 3.",
      "poznamky": "Day trip"
    },
    {
      "nazev": "Prague Airport",
      "lat": 50.1008,
      "lng": 14.2600,
      "datumy": "3. 3.",
      "typ": "cil"
    }
  ]
}
```

## Tech Stack

- [Leaflet.js](https://leafletjs.com/) - Interactive maps
- [Leaflet.Geodesic](https://github.com/henrythasler/Leaflet.Geodesic) - Curved geodesic route lines
- [LZString](https://pieroxy.net/blog/pages/lz-string/index.html) - URL compression for sharing
- [html2canvas](https://html2canvas.hertzen.com/) - PNG export functionality
- [CartoDB Voyager](https://carto.com/basemaps/) - Beautiful light map tiles
- [Inter Font](https://rsms.me/inter/) - Clean typography

## Contributing

Contributions are welcome! Here's how you can help:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Acknowledgments

- [Leaflet](https://leafletjs.com/) team for the amazing mapping library
- [CARTO](https://carto.com/) for the beautiful Voyager map tiles
- [pieroxy](https://github.com/pieroxy) for LZString compression library
- [Niklas von Hertzen](https://hertzen.com/) for html2canvas

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

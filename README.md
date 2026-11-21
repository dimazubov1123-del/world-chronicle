# World Chronicle

A browser-based alternate-history grand strategy prototype inspired by the broad sandbox structure of Pax Historia. This is an original project: independent name, interface, code, and game content.

## Current prototype
- Interactive world map with selectable countries
- Scenario and start-year selection
- Country overview: government, economy, population, stability and military
- Time controls with pause and turn advancement
- Event feed and basic country actions
- Responsive dark strategy interface

## Run locally
This first version is static and needs no build step.

```bash
python -m http.server 8080
```

Open http://localhost:8080.

The map uses Leaflet and public map tiles / country boundaries loaded from external CDNs, so an internet connection is required for the full map.

## Roadmap
1. World map and country selection
2. Playable scenarios and country data
3. Turn simulation and event engine
4. Diplomacy, economy, laws and armed forces
5. Save/load games and scenario editor
6. Server-side accounts and persistent campaigns

## License
Prototype source code is provided for this project. Third-party map libraries, tiles and datasets retain their respective licenses and attribution requirements.

(() => {
  const washingtonCenter = [-120.7, 47.4];
  const washingtonZoom = 6.6;

  const map = new maplibregl.Map({
    container: 'map',
    style: {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors'
        }
      },
      layers: [{
        id: 'osm-light-basemap',
        type: 'raster',
        source: 'osm',
        paint: {
          'raster-opacity': 0.88,
          'raster-saturation': -0.45,
          'raster-brightness-min': 0.08,
          'raster-brightness-max': 0.95
        }
      }]
    },
    center: washingtonCenter,
    zoom: washingtonZoom,
    minZoom: 5.5,
    maxZoom: 13
  });

  map.addControl(new maplibregl.NavigationControl());

  let washingtonCountyGeojson = null;

  const selectedLocationText = document.getElementById('selected-location-text');
  const countySelect = document.getElementById('county-select');
  const incidentPanel = document.getElementById('incident-panel');

  const recenterButton = document.getElementById('recenter-map-btn');
  if (recenterButton) {
    recenterButton.addEventListener('click', () => {
      map.flyTo({
        center: washingtonCenter,
        zoom: washingtonZoom,
        speed: 0.9
      });
    });
  }

  function getCountyName(feature) {
    return (
      feature.properties.JURISDICT_NM ||
      feature.properties.NAME ||
      feature.properties.name ||
      feature.properties.COUNTY ||
      feature.properties.county
    );
  }

  function normalizeCountyName(name) {
    if (!name) return '';
    return name.includes('County') ? name : `${name} County`;
  }

  function highlightCounty(countyName) {
    if (!map.getLayer('county-fill')) return;

    map.setPaintProperty('county-fill', 'fill-color', [
      'case',
      ['==', ['get', 'JURISDICT_NM'], countyName],
      '#f04a23',
      '#f6c98f'
    ]);

    map.setPaintProperty('county-fill', 'fill-opacity', [
      'case',
      ['==', ['get', 'JURISDICT_NM'], countyName],
      0.45,
      0.22
    ]);
  }

  function updateSelectedCounty(countyName) {
    const normalizedCounty = normalizeCountyName(countyName);

    if (selectedLocationText) {
      selectedLocationText.textContent =
        normalizedCounty || 'No county selected yet';
    }

    if (countySelect && normalizedCounty) {
      countySelect.value = normalizedCounty;
    }

    if (incidentPanel && normalizedCounty) {
      incidentPanel.classList.remove('hidden-panel');
    }

    highlightCounty(normalizedCounty);
  }

  function findCountyForPoint(lng, lat) {
    if (!washingtonCountyGeojson || !window.turf) return null;

    const point = turf.point([lng, lat]);

    for (const feature of washingtonCountyGeojson.features) {
      if (turf.booleanPointInPolygon(point, feature)) {
        return getCountyName(feature);
      }
    }

    return null;
  }

  async function loadWashingtonCounties() {
    try {
      const countyResponse = await fetch('data/wa_counties.geojson');

      if (!countyResponse.ok) {
        throw new Error(
          'wa_counties.geojson was not found. Add it to docs/data/wa_counties.geojson'
        );
      }

      washingtonCountyGeojson = await countyResponse.json();

      map.addSource('wa-counties', {
        type: 'geojson',
        data: washingtonCountyGeojson
      });

      map.addLayer({
        id: 'county-fill',
        type: 'fill',
        source: 'wa-counties',
        paint: {
          'fill-color': '#f6c98f',
          'fill-opacity': 0.22
        }
      });

      map.addLayer({
        id: 'county-outline',
        type: 'line',
        source: 'wa-counties',
        paint: {
          'line-color': '#ffffff',
          'line-width': 1.2
        }
      });

      map.on('mousemove', 'county-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', 'county-fill', () => {
        map.getCanvas().style.cursor = '';
      });

      map.on('click', 'county-fill', (e) => {
        const countyName = getCountyName(e.features[0]);
        updateSelectedCounty(countyName);
      });

    } catch (error) {
      console.warn(error.message);

      if (selectedLocationText) {
        selectedLocationText.textContent =
          'County layer not loaded yet. Add docs/data/wa_counties.geojson.';
      }
    }
  }

  map.on('load', loadWashingtonCounties);

  window.findCountyForPoint = findCountyForPoint;
  window.updateSelectedCounty = updateSelectedCounty;
  window.reportMap = map;
})();
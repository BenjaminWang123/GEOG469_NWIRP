(() => {
  const API_BASE = '';

  const washingtonCenter = [-120.7, 47.4];
  const washingtonZoom = 6.3;
  const cityZoomThreshold = 7.5;

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
      layers: [
        {
          id: 'osm-light-basemap',
          type: 'raster',
          source: 'osm',
          paint: {
            'raster-opacity': 0.88,
            'raster-saturation': -0.45,
            'raster-brightness-min': 0.08,
            'raster-brightness-max': 0.95
          }
        }
      ]
    },
    center: washingtonCenter,
    zoom: washingtonZoom,
    minZoom: 5.2,
    maxZoom: 13
  });

  map.addControl(new maplibregl.NavigationControl());

  let countyGeojson = null;
  let cityGeojson = null;
  let reportRows = [];

  const selectedLocationText = document.getElementById('selected-location-text');
  const countySelect = document.getElementById('county-select');
  const citySelect = document.getElementById('city-select');
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

  function escapeHTML(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function normalizeCountyName(name) {
    if (!name) return '';
    const value = String(name).trim();
    return value.includes('County') ? value : `${value} County`;
  }

  function normalizeCityName(name) {
    if (!name) return '';
    return String(name).trim();
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

  function getCityName(feature) {
    return (
      feature.properties.CITY_DISSOLVE ||
      feature.properties.CITY ||
      feature.properties.NAME ||
      feature.properties.name
    );
  }

  function countReportsByCounty(rows) {
    const counts = {};

    rows.forEach((report) => {
      const county = normalizeCountyName(report.county);
      if (!county) return;
      counts[county] = (counts[county] || 0) + 1;
    });

    return counts;
  }

  function countReportsByCity(rows) {
    const counts = {};

    rows.forEach((report) => {
      const city = normalizeCityName(report.city);
      if (!city) return;
      counts[city] = (counts[city] || 0) + 1;
    });

    return counts;
  }

  function findCountyForPoint(lng, lat) {
    if (!countyGeojson || !window.turf) return null;

    const point = turf.point([lng, lat]);

    for (const feature of countyGeojson.features) {
      if (turf.booleanPointInPolygon(point, feature)) {
        return normalizeCountyName(getCountyName(feature));
      }
    }

    return null;
  }

  function ensureCityOption(cityInfo) {
    if (!citySelect || !cityInfo.city) return;

    let option = [...citySelect.options].find((item) => item.value === cityInfo.city);

    if (!option) {
      option = document.createElement('option');
      option.value = cityInfo.city;
      option.textContent = cityInfo.city;
      citySelect.appendChild(option);
    }

    option.dataset.county = cityInfo.county || '';
    option.dataset.lat = cityInfo.city_lat || '';
    option.dataset.lng = cityInfo.city_lng || '';
  }

  function highlightCity(cityName) {
    if (!map.getLayer('city-fill')) return;

    map.setPaintProperty('city-fill', 'fill-color', [
      'case',
      ['==', ['get', 'CITY_DISSOLVE'], cityName],
      '#f04a23',
      [
        'interpolate',
        ['linear'],
        ['coalesce', ['get', 'report_count'], 0],
        0, '#fff7ec',
        1, '#fdd49e',
        3, '#fdbb84',
        5, '#fc8d59',
        10, '#e34a33',
        20, '#b30000'
      ]
    ]);
  }

  function updateSelectedCity(cityInfo) {
    if (!cityInfo || !cityInfo.city) return;

    ensureCityOption(cityInfo);

    citySelect.value = cityInfo.city;

    if (countySelect && cityInfo.county) {
      countySelect.value = cityInfo.county;
    }

    if (selectedLocationText) {
      selectedLocationText.textContent = cityInfo.county
        ? `${cityInfo.city}, ${cityInfo.county}`
        : cityInfo.city;
    }

    if (incidentPanel) {
      incidentPanel.classList.remove('hidden-panel');
    }

    highlightCity(cityInfo.city);
  }

  function findCityForPoint(lng, lat) {
    if (!cityGeojson || !window.turf) return null;

    const point = turf.point([lng, lat]);

    for (const feature of cityGeojson.features) {
      if (turf.booleanPointInPolygon(point, feature)) {
        const city = normalizeCityName(getCityName(feature));
        const county = findCountyForPoint(lng, lat);
        const centroid = turf.centroid(feature);
        const [cityLng, cityLat] = centroid.geometry.coordinates;

        return {
          city,
          county,
          city_lat: cityLat,
          city_lng: cityLng
        };
      }
    }

    return null;
  }

  function updateCountyCounts() {
    if (!countyGeojson || !map.getSource('wa-counties')) return;

    const counts = countReportsByCounty(reportRows);

    countyGeojson.features.forEach((feature) => {
      const countyName = normalizeCountyName(getCountyName(feature));
      feature.properties.report_count = counts[countyName] || 0;
    });

    map.getSource('wa-counties').setData(countyGeojson);
  }

  function updateCityCounts() {
    if (!cityGeojson || !map.getSource('wa-cities')) return;

    const counts = countReportsByCity(reportRows);

    cityGeojson.features.forEach((feature) => {
      const cityName = normalizeCityName(getCityName(feature));
      feature.properties.report_count = counts[cityName] || 0;
    });

    map.getSource('wa-cities').setData(cityGeojson);
  }

  async function loadReports() {
    try {
      const response = await fetch(API_BASE + '/api/get-reports');
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to load reports.');
      }

      reportRows = result.rows || [];

      updateCountyCounts();
      updateCityCounts();
    } catch (error) {
      console.warn('Report data could not load:', error.message);
    }
  }

  function populateCityDropdownFromGeojson(cityGeojson) {
    if (!citySelect || !cityGeojson) return;

    const cityNames = [
      ...new Set(
        cityGeojson.features
          .map((feature) => getCityName(feature))
          .filter(Boolean)
          .map((name) => String(name).trim())
      )
    ].sort();

    citySelect.innerHTML = '<option value="">Select a city</option>';

    cityNames.forEach((cityName) => {
      const option = document.createElement('option');
      option.value = cityName;
      option.textContent = cityName;
      citySelect.appendChild(option);
    });
  }

  async function loadBoundaries() {
    const countyResponse = await fetch('data/wa_counties.geojson');
    const cityResponse = await fetch('data/City_Boundaries.geojson');

    if (!countyResponse.ok) {
      throw new Error('Missing docs/data/wa_counties.geojson');
    }

    if (!cityResponse.ok) {
      throw new Error('Missing docs/data/City_Boundaries.geojson');
    }

    countyGeojson = await countyResponse.json();
    cityGeojson = await cityResponse.json();
    populateCityDropdownFromGeojson(cityGeojson);

    map.addSource('wa-counties', {
      type: 'geojson',
      data: countyGeojson
    });

    map.addSource('wa-cities', {
      type: 'geojson',
      data: cityGeojson
    });

    map.addLayer({
      id: 'county-fill',
      type: 'fill',
      source: 'wa-counties',
      maxzoom: cityZoomThreshold,
      paint: {
        'fill-color': [
          'interpolate',
          ['linear'],
          ['coalesce', ['get', 'report_count'], 0],
          0, '#d8f3f0',
          1, '#7bd6cf',
          3, '#21a7a0',
          5, '#f6a04d',
          10, '#f04a23',
          20, '#b8321a'
        ],
        'fill-opacity': [
          'case',
          ['>', ['coalesce', ['get', 'report_count'], 0], 0],
          0.78,
          0.42
        ]
      }
    });

    map.addLayer({
      id: 'county-outline',
      type: 'line',
      source: 'wa-counties',
      maxzoom: cityZoomThreshold,
      paint: {
        'line-color': '#ffffff',
        'line-width': 1.2
      }
    });

    map.addLayer({
      id: 'city-fill',
      type: 'fill',
      source: 'wa-cities',
      minzoom: cityZoomThreshold,
      paint: {
        'line-color': '#004b4e',
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          7.5, 1.2,
          10, 2.2
        ],
        'line-opacity': 0.9
      }
    });

    map.addLayer({
      id: 'city-outline',
      type: 'line',
      source: 'wa-cities',
      minzoom: cityZoomThreshold,
      paint: {
        'line-color': '#ffffff',
        'line-width': 0.9
      }
    });

    map.on('click', 'county-fill', (event) => {
      const feature = event.features[0];
      const countyName = normalizeCountyName(getCountyName(feature));
      const reportCount = feature.properties.report_count || 0;

      if (countySelect) {
        countySelect.value = countyName;
      }

      if (selectedLocationText) {
        selectedLocationText.textContent = `${countyName}. Zoom in to select a city.`;
      }

      map.flyTo({
        center: event.lngLat,
        zoom: cityZoomThreshold + 0.6,
        speed: 0.8
      });

      new maplibregl.Popup()
        .setLngLat(event.lngLat)
        .setHTML(`
          <strong>${escapeHTML(countyName)}</strong><br>
          ${reportCount} report(s)<br>
          <small>Zooming in for city selection.</small>
        `)
        .addTo(map);
    });

    map.on('click', 'city-fill', (event) => {
      const feature = event.features[0];
      const cityName = normalizeCityName(getCityName(feature));
      const reportCount = feature.properties.report_count || 0;
      const center = turf.centroid(feature);
      const [lng, lat] = center.geometry.coordinates;
      const countyName = findCountyForPoint(lng, lat);

      const cityInfo = {
        city: cityName,
        county: countyName,
        city_lat: lat,
        city_lng: lng
      };

      updateSelectedCity(cityInfo);

      new maplibregl.Popup()
        .setLngLat(event.lngLat)
        .setHTML(`
          <strong>${escapeHTML(cityName)}</strong><br>
          ${escapeHTML(countyName || 'County not detected')}<br>
          ${reportCount} report(s)<br>
          <small>This city is selected for your report.</small>
        `)
        .addTo(map);
    });

    map.on('mouseenter', 'county-fill', () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'county-fill', () => {
      map.getCanvas().style.cursor = '';
    });

    map.on('mouseenter', 'city-fill', () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'city-fill', () => {
      map.getCanvas().style.cursor = '';
    });

    await loadReports();
  }

  map.on('load', async () => {
    try {
      await loadBoundaries();
    } catch (error) {
      console.error(error);

      if (selectedLocationText) {
        selectedLocationText.textContent = error.message;
      }
    }
  });

  window.findCountyForPoint = findCountyForPoint;
  window.findCityForPoint = findCityForPoint;
  window.updateSelectedCity = updateSelectedCity;
  window.reportMap = map;
})();
(() => {
  const API_BASE = '';
  const washingtonCenter = [-120.7, 47.4];
  const washingtonZoom = 6.6;
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
    minZoom: 5.5,
    maxZoom: 13
  });

  map.addControl(new maplibregl.NavigationControl());

  let washingtonCountyGeojson = null;
  let washingtonCityGeojson = null;
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
    return String(name).includes('County') ? String(name) : `${name} County`;
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

  function findCountyForPoint(lng, lat) {
    if (!washingtonCountyGeojson || !window.turf) return null;

    const point = turf.point([lng, lat]);

    for (const feature of washingtonCountyGeojson.features) {
      if (turf.booleanPointInPolygon(point, feature)) {
        return normalizeCountyName(getCountyName(feature));
      }
    }

    return null;
  }

  function findCityForPoint(lng, lat) {
    if (!washingtonCityGeojson || !window.turf) return null;

    const point = turf.point([lng, lat]);

    for (const feature of washingtonCityGeojson.features) {
      if (turf.booleanPointInPolygon(point, feature)) {
        const city = normalizeCityName(getCityName(feature));
        const county = findCountyForPoint(lng, lat);
        const centroid = turf.centroid(feature);
        const [cityLng, cityLat] = centroid.geometry.coordinates;

        return {
          city,
          county,
          city_lng: cityLng,
          city_lat: cityLat
        };
      }
    }

    return null;
  }

  function ensureCityOption(cityInfo) {
    if (!citySelect || !cityInfo || !cityInfo.city) return;

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

    map.setPaintProperty('city-fill', 'fill-opacity', [
      'case',
      ['==', ['get', 'CITY_DISSOLVE'], cityName],
      0.82,
      0.5
    ]);
  }

  function updateSelectedCity(cityInfo) {
    if (!cityInfo || !cityInfo.city) return;

    ensureCityOption(cityInfo);

    if (citySelect) {
      citySelect.value = cityInfo.city;
    }

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

  function buildCountyVisualization() {
    if (!washingtonCountyGeojson) return;

    const counts = countReportsByCounty(reportRows);

    washingtonCountyGeojson.features.forEach((feature) => {
      const countyName = normalizeCountyName(getCountyName(feature));
      feature.properties.report_count = counts[countyName] || 0;
    });

    if (map.getSource('wa-counties')) {
      map.getSource('wa-counties').setData(washingtonCountyGeojson);
    }
  }

  function buildCityVisualization() {
    if (!washingtonCityGeojson) return;

    const counts = countReportsByCity(reportRows);

    washingtonCityGeojson.features.forEach((feature) => {
      const cityName = normalizeCityName(getCityName(feature));
      feature.properties.report_count = counts[cityName] || 0;
    });

    if (map.getSource('wa-cities')) {
      map.getSource('wa-cities').setData(washingtonCityGeojson);
    }
  }

  async function loadReportsFromDatabase() {
    try {
      const response = await fetch(API_BASE + '/api/get-reports');
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to load reports.');
      }

      reportRows = result.rows || [];
      buildCountyVisualization();
      buildCityVisualization();
    } catch (error) {
      console.warn('Could not load report data:', error.message);
    }
  }

  async function loadMapLayers() {
    try {
      const countyResponse = await fetch('data/wa_counties.geojson');
      const cityResponse = await fetch('data/City_Boundaries.geojson');

      if (!countyResponse.ok) {
        throw new Error('wa_counties.geojson was not found.');
      }

      if (!cityResponse.ok) {
        throw new Error('City_Boundaries.geojson was not found.');
      }

      washingtonCountyGeojson = await countyResponse.json();
      washingtonCityGeojson = await cityResponse.json();

      map.addSource('wa-counties', {
        type: 'geojson',
        data: washingtonCountyGeojson
      });

      map.addSource('wa-cities', {
        type: 'geojson',
        data: washingtonCityGeojson
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
            0, '#f6c98f',
            5, '#f4b36b',
            15, '#ef8a3a',
            30, '#d94b27'
          ],
          'fill-opacity': 0.28
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
          'fill-color': [
            'interpolate',
            ['linear'],
            ['coalesce', ['get', 'report_count'], 0],
            0, '#fff7ec',
            1, '#fdd49e',
            3, '#fdbb84',
            5, '#fc8d59',
            10, '#e34a33',
            20, '#b30000'
          ],
          'fill-opacity': 0.5
        }
      });

      map.addLayer({
        id: 'city-outline',
        type: 'line',
        source: 'wa-cities',
        minzoom: cityZoomThreshold,
        paint: {
          'line-color': '#ffffff',
          'line-width': 0.8
        }
      });

      map.on('click', 'county-fill', (e) => {
        const countyName = normalizeCountyName(getCountyName(e.features[0]));
        const count = e.features[0].properties.report_count || 0;

        if (selectedLocationText) {
          selectedLocationText.textContent = `${countyName} selected. Zoom in and click a city to submit city-level report.`;
        }

        if (countySelect) {
          countySelect.value = countyName;
        }

        new maplibregl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`
            <strong>${escapeHTML(countyName)}</strong><br>
            ${count} report(s)<br>
            <small>Zoom in to select a city.</small>
          `)
          .addTo(map);
      });

      map.on('click', 'city-fill', (e) => {
        const feature = e.features[0];
        const cityName = normalizeCityName(getCityName(feature));
        const count = feature.properties.report_count || 0;
        const centroid = turf.centroid(feature);
        const [lng, lat] = centroid.geometry.coordinates;
        const countyName = findCountyForPoint(lng, lat);

        const cityInfo = {
          city: cityName,
          county: countyName,
          city_lat: lat,
          city_lng: lng
        };

        updateSelectedCity(cityInfo);

        new maplibregl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`
            <strong>${escapeHTML(cityName)}</strong><br>
            ${escapeHTML(countyName || 'County not detected')}<br>
            ${count} report(s)
          `)
          .addTo(map);
      });

      map.on('mousemove', 'county-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', 'county-fill', () => {
        map.getCanvas().style.cursor = '';
      });

      map.on('mousemove', 'city-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', 'city-fill', () => {
        map.getCanvas().style.cursor = '';
      });

      await loadReportsFromDatabase();
    } catch (error) {
      console.warn(error.message);

      if (selectedLocationText) {
        selectedLocationText.textContent = 'City boundary layer was not loaded. Check docs/data/City_Boundaries.geojson.';
      }
    }
  }

  map.on('load', loadMapLayers);

  window.findCountyForPoint = findCountyForPoint;
  window.findCityForPoint = findCityForPoint;
  window.updateSelectedCity = updateSelectedCity;
  window.reportMap = map;
})();
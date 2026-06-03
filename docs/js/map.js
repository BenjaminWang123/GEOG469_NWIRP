(() => {
  const API_BASE = '';

  const washingtonCenter = [-120.7, 47.4];
  const washingtonZoom = 6.4;

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
  let cityLookup = {};

  const selectedLocationText = document.getElementById('selected-location-text');
  const countySelect = document.getElementById('county-select');
  const citySelect = document.getElementById('city-select');
  const incidentPanel = document.getElementById('incident-panel');
  const recenterButton = document.getElementById('recenter-map-btn');
  const currentLocationCard = document.querySelector('[data-method="current-location"]');

  let currentLocationMarker = null;

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

  function buildCityLookup() {
    cityLookup = {};

    cityGeojson.features.forEach((feature) => {
      const city = normalizeCityName(getCityName(feature));

      if (!city) return;

      const centroid = turf.centroid(feature);
      const [lng, lat] = centroid.geometry.coordinates;
      const county = findCountyForPoint(lng, lat);

      feature.properties.city_name = city;
      feature.properties.county_name = county;

      cityLookup[city] = {
        city,
        county,
        city_lat: lat,
        city_lng: lng
      };
    });
  }

  function populateCityDropdown(selectedCounty = '') {
    if (!citySelect) return;

    citySelect.innerHTML = '<option value="">Select a city</option>';

    Object.values(cityLookup)
      .filter((item) => !selectedCounty || item.county === selectedCounty)
      .sort((a, b) => a.city.localeCompare(b.city))
      .forEach((item) => {
        const option = document.createElement('option');

        option.value = item.city;
        option.textContent = item.city;
        option.dataset.county = item.county || '';
        option.dataset.lat = item.city_lat || '';
        option.dataset.lng = item.city_lng || '';

        citySelect.appendChild(option);
      });
  }

  function highlightSelectedCity(cityName) {
    if (!map.getLayer('city-fill')) return;

    map.setPaintProperty('city-fill', 'fill-color', [
      'case',
      ['==', ['get', 'city_name'], cityName],
      '#f04a23',
      '#006c70'
    ]);

    map.setPaintProperty('city-fill', 'fill-opacity', [
      'case',
      ['==', ['get', 'city_name'], cityName],
      0.35,
      0.15
    ]);

    map.setPaintProperty('city-outline', 'line-color', [
      'case',
      ['==', ['get', 'city_name'], cityName],
      '#f04a23',
      '#004b4e'
    ]);

    map.setPaintProperty('city-outline', 'line-width', [
      'case',
      ['==', ['get', 'city_name'], cityName],
      2.8,
      1.1
    ]);
  }

  function updateSelectedCity(cityInfo) {
    if (!cityInfo || !cityInfo.city) return;

    if (countySelect && cityInfo.county) {
      countySelect.value = cityInfo.county;
    }

    populateCityDropdown(cityInfo.county);

    if (citySelect) {
      citySelect.value = cityInfo.city;
    }

    if (selectedLocationText) {
      selectedLocationText.textContent = cityInfo.county
        ? `${cityInfo.city}, ${cityInfo.county}`
        : cityInfo.city;
    }

    if (incidentPanel) {
      incidentPanel.classList.remove('hidden-panel');
    }

    highlightSelectedCity(cityInfo.city);
  }

  function zoomToCity(cityName) {
    const cityInfo = cityLookup[cityName];

    if (!cityInfo) return;

    map.flyTo({
      center: [cityInfo.city_lng, cityInfo.city_lat],
      zoom: 9.5,
      speed: 0.9
    });

    updateSelectedCity(cityInfo);
  }

  function findNearestCity(lng, lat) {
    if (!cityGeojson || !window.turf) return null;

    const userPoint = turf.point([lng, lat]);

    let nearestCity = null;
    let shortestDistance = Infinity;

    Object.values(cityLookup).forEach((item) => {
      if (!Number.isFinite(item.city_lng) || !Number.isFinite(item.city_lat)) return;

      const cityPoint = turf.point([item.city_lng, item.city_lat]);
      const distance = turf.distance(userPoint, cityPoint, { units: 'miles' });

      if (distance < shortestDistance) {
        shortestDistance = distance;
        nearestCity = item;
      }
    });

    return nearestCity;
  }

  function showCurrentLocationOnMap(lng, lat) {
    if (currentLocationMarker) {
      currentLocationMarker.remove();
    }

    currentLocationMarker = new maplibregl.Marker({
      color: '#f04a23'
    })
      .setLngLat([lng, lat])
      .setPopup(
        new maplibregl.Popup().setHTML(
          '<strong>Your approximate location</strong><br><small>Used only to estimate city/county.</small>'
        )
      )
      .addTo(map);
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      if (selectedLocationText) {
        selectedLocationText.textContent = 'Your browser does not support current location.';
      }

      return;
    }

    if (selectedLocationText) {
      selectedLocationText.textContent = 'Detecting your approximate location...';
    }

    if (incidentPanel) {
      incidentPanel.classList.remove('hidden-panel');
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        const county = findCountyForPoint(lng, lat);
        const nearestCity = findNearestCity(lng, lat);

        map.flyTo({
          center: [lng, lat],
          zoom: 10,
          speed: 0.9
        });

        showCurrentLocationOnMap(lng, lat);

        if (nearestCity) {
          updateSelectedCity({
            ...nearestCity,
            county: county || nearestCity.county
          });
        } else if (county) {
          if (countySelect) {
            countySelect.value = county;
          }

          populateCityDropdown(county);

          if (selectedLocationText) {
            selectedLocationText.textContent = county;
          }
        } else if (selectedLocationText) {
          selectedLocationText.textContent =
            'Location detected, but it is outside the supported Washington city/county data.';
        }
      },
      (error) => {
        console.warn('Current location could not be detected:', error.message);

        if (selectedLocationText) {
          selectedLocationText.textContent =
            'Location permission was denied or unavailable. Please click the map or select a city manually.';
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  }

  if (currentLocationCard) {
    currentLocationCard.addEventListener('click', useCurrentLocation);
  }

  function countReportsByCity(rows) {
    const counts = {};

    rows.forEach((report) => {
      const city = normalizeCityName(report.city);

      if (!city) return;

      const lookup = cityLookup[city] || {};

      if (!counts[city]) {
        counts[city] = {
          city,
          county: report.county || lookup.county || '',
          lat: Number(report.city_lat || lookup.city_lat),
          lng: Number(report.city_lng || lookup.city_lng),
          report_count: 0
        };
      }

      counts[city].report_count += 1;
    });

    return counts;
  }

  function updateCityReportCircles() {
    if (!map.getSource('city-report-points')) return;

    const cityCounts = countReportsByCity(reportRows);

    const cityPointGeojson = {
      type: 'FeatureCollection',
      features: Object.values(cityCounts)
        .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng))
        .map((item) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [item.lng, item.lat]
          },
          properties: item
        }))
    };

    map.getSource('city-report-points').setData(cityPointGeojson);
  }

  async function loadReports() {
    try {
      const response = await fetch(API_BASE + '/api/get-reports');
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to load reports.');
      }

      reportRows = result.rows || [];
      updateCityReportCircles();
    } catch (error) {
      console.warn('Report data could not load:', error.message);
    }
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

    buildCityLookup();
    populateCityDropdown();

    map.addSource('wa-cities', {
      type: 'geojson',
      data: cityGeojson
    });

    map.addSource('city-report-points', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      }
    });

    map.addLayer({
      id: 'city-fill',
      type: 'fill',
      source: 'wa-cities',
      paint: {
        'fill-color': '#006c70',
        'fill-opacity': 0.15
      }
    });

    map.addLayer({
      id: 'city-outline',
      type: 'line',
      source: 'wa-cities',
      paint: {
        'line-color': '#004b4e',
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          5, 0.7,
          8, 1.2,
          11, 2
        ],
        'line-opacity': 0.95
      }
    });

    map.addLayer({
      id: 'city-report-circles',
      type: 'circle',
      source: 'city-report-points',
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['get', 'report_count'],
          1, 9,
          3, 14,
          6, 20,
          12, 28,
          25, 40
        ],
        'circle-color': '#f04a23',
        'circle-opacity': 0.78,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2
      }
    });

    map.on('click', 'city-fill', (event) => {
      const feature = event.features[0];
      const city = normalizeCityName(feature.properties.city_name || getCityName(feature));
      const cityInfo = cityLookup[city];

      if (!cityInfo) return;

      updateSelectedCity(cityInfo);

      new maplibregl.Popup()
        .setLngLat(event.lngLat)
        .setHTML(`
          <strong>${escapeHTML(cityInfo.city)}</strong><br>
          ${escapeHTML(cityInfo.county || 'County not detected')}<br>
          <small>This city is selected for your report.</small>
        `)
        .addTo(map);
    });

    map.on('click', 'city-report-circles', (event) => {
      const props = event.features[0].properties;

      const cityInfo = {
        city: props.city,
        county: props.county,
        city_lat: props.lat,
        city_lng: props.lng
      };

      updateSelectedCity(cityInfo);

      new maplibregl.Popup()
        .setLngLat(event.lngLat)
        .setHTML(`
          <strong>${escapeHTML(props.city)}</strong><br>
          ${escapeHTML(props.county || '')}<br>
          ${props.report_count} report(s)
        `)
        .addTo(map);
    });

    map.on('mouseenter', 'city-fill', () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'city-fill', () => {
      map.getCanvas().style.cursor = '';
    });

    map.on('mouseenter', 'city-report-circles', () => {
      map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'city-report-circles', () => {
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
  window.updateSelectedCity = updateSelectedCity;
  window.populateCityDropdown = populateCityDropdown;
  window.zoomToCity = zoomToCity;
  window.useCurrentLocation = useCurrentLocation;
  window.reportMap = map;
})();
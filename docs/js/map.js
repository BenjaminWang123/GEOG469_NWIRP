
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
  let reportRows = [];

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
      [
        'interpolate',
        ['linear'],
        ['coalesce', ['get', 'report_count'], 0],
        0, '#f6c98f',
        5, '#f4b36b',
        15, '#ef8a3a',
        30, '#d94b27'
      ]
    ]);

    map.setPaintProperty('county-fill', 'fill-opacity', [
      'case',
      ['==', ['get', 'JURISDICT_NM'], countyName],
      0.55,
      0.28
    ]);
  }

  function updateSelectedCounty(countyName) {
    const normalizedCounty = normalizeCountyName(countyName);

    if (selectedLocationText) {
      selectedLocationText.textContent = normalizedCounty || 'No county selected yet';
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

  function countReportsByCounty(rows) {
    const counts = {};

    rows.forEach((report) => {
      const county = normalizeCountyName(report.county);
      if (!county) return;
      counts[county] = (counts[county] || 0) + 1;
    });

    return counts;
  }

  function buildCityVisualization() {
    const cityCounts = {};

    reportRows.forEach((report) => {
      if (!report.city || !report.city_lat || !report.city_lng) return;

      const key = `${report.city}, ${report.county}`;

      if (!cityCounts[key]) {
        cityCounts[key] = {
          city: report.city,
          county: report.county,
          lat: Number(report.city_lat),
          lng: Number(report.city_lng),
          report_count: 0
        };
      }

      cityCounts[key].report_count += 1;
    });

    const cityGeojson = {
      type: 'FeatureCollection',
      features: Object.values(cityCounts).map((item) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [item.lng, item.lat]
        },
        properties: item
      }))
    };

    if (map.getSource('city-report-points')) {
      map.getSource('city-report-points').setData(cityGeojson);
      return;
    }

    map.addSource('city-report-points', {
      type: 'geojson',
      data: cityGeojson
    });

    map.addLayer({
      id: 'city-report-circles',
      type: 'circle',
      source: 'city-report-points',
      minzoom: 7,
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['get', 'report_count'],
          1, 8,
          5, 14,
          15, 22
        ],
        'circle-color': '#006c70',
        'circle-opacity': 0.82,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2
      }
    });

    map.on('click', 'city-report-circles', (e) => {
      const props = e.features[0].properties;

      new maplibregl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(`
          <strong>${props.city}</strong><br>
          ${props.county}<br>
          ${props.report_count} report(s)
        `)
        .addTo(map);
    });
  }

  function getCountyCentroidFeature(feature) {
    const countyName = getCountyName(feature);
    const count = feature.properties.report_count || 0;
    const centroid = turf.centroid(feature);

    centroid.properties = {
      county: countyName,
      report_count: count
    };

    return centroid;
  }

  function buildCountyVisualization() {
    if (!washingtonCountyGeojson || !window.turf) return;

    const counts = countReportsByCounty(reportRows);

    washingtonCountyGeojson.features.forEach((feature) => {
      const countyName = normalizeCountyName(getCountyName(feature));
      feature.properties.report_count = counts[countyName] || 0;
    });

    const centroidGeojson = {
      type: 'FeatureCollection',
      features: washingtonCountyGeojson.features
        .filter((feature) => (feature.properties.report_count || 0) > 0)
        .map(getCountyCentroidFeature)
    };

    if (map.getSource('wa-counties')) {
      map.getSource('wa-counties').setData(washingtonCountyGeojson);
    }

    if (map.getSource('county-report-centroids')) {
      map.getSource('county-report-centroids').setData(centroidGeojson);
    } else {
      map.addSource('county-report-centroids', {
        type: 'geojson',
        data: centroidGeojson
      });

      map.addLayer({
        id: 'county-report-circles',
        type: 'circle',
        source: 'county-report-centroids',
        maxzoom: 7,
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['get', 'report_count'],
            1, 9,
            5, 15,
            15, 24,
            30, 36
          ],
          'circle-color': '#f04a23',
          'circle-opacity': 0.78,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2
        }
      });

      // map.addLayer({
      //   id: 'county-report-labels',
      //   type: 'symbol',
      //   source: 'county-report-centroids',
      //   layout: {
      //     'text-field': ['to-string', ['get', 'report_count']],
      //     'text-size': 13,
      //     'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold']
      //   },
      //   paint: {
      //     'text-color': '#ffffff'
      //   }
      // });

      map.on('click', 'county-report-circles', (e) => {
        const props = e.features[0].properties;
        updateSelectedCounty(props.county);

        new maplibregl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`
            <strong>${props.county}</strong><br>
            ${props.report_count} report(s)<br>
            <small>Click county or use Blog page to review details.</small>
          `)
          .addTo(map);
      });

      map.on('mouseenter', 'county-report-circles', () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', 'county-report-circles', () => {
        map.getCanvas().style.cursor = '';
      });
    }
  }

  async function loadReportsFromDatabase() {
    try {
      const response = await fetch('https://geog469-nwirp-1rtx.onrender.com/api/get-reports');
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

  async function loadWashingtonCounties() {
    try {
      const countyResponse = await fetch('data/wa_counties.geojson');

      if (!countyResponse.ok) {
        throw new Error('wa_counties.geojson was not found. Add it to docs/data/wa_counties.geojson');
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
        const count = e.features[0].properties.report_count || 0;

        updateSelectedCounty(countyName);

        new maplibregl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`
            <strong>${normalizeCountyName(countyName)}</strong><br>
            ${count} report(s) in database
          `)
          .addTo(map);
      });

      await loadReportsFromDatabase();
    } catch (error) {
      console.warn(error.message);

      if (selectedLocationText) {
        selectedLocationText.textContent = 'County layer not loaded yet. Add docs/data/wa_counties.geojson.';
      }
    }
  }

  map.on('load', loadWashingtonCounties);

  window.findCountyForPoint = findCountyForPoint;
  window.updateSelectedCounty = updateSelectedCounty;
  window.reportMap = map;
})();
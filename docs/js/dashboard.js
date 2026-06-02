(() => {
  const API_BASE = '';

  const washingtonCenter = [-120.7, 47.4];
  const washingtonZoom = 6.1;
  const cityZoomThreshold = 7.5;

  const keywordFilter = document.getElementById('dashboard-keyword-filter');
  const countyFilter = document.getElementById('dashboard-county-filter');
  const impactFilter = document.getElementById('dashboard-impact-filter');
  const locationLevelFilter = document.getElementById('dashboard-location-level-filter');
  const cityFilter = document.getElementById('dashboard-city-filter');

  const statLocationLabel = document.getElementById('stat-location-label');
  const statTopLocationLabel = document.getElementById('stat-top-location-label');

  const totalReportsEl = document.getElementById('stat-total-reports');
  const totalCountiesEl = document.getElementById('stat-total-counties');
  const topImpactEl = document.getElementById('stat-top-impact');
  const topCountyEl = document.getElementById('stat-top-county');

  const countyChart = document.getElementById('county-count-chart');
  const impactChart = document.getElementById('impact-area-chart');
  const incidentChart = document.getElementById('incident-type-chart');
  const timelineChart = document.getElementById('timeline-chart');

  let reports = [];
  let countyGeojson = null;
  let cityGeojson = null;
  let dashboardMap = null;

  function getLocationKey() {
    return locationLevelFilter.value === 'city' ? 'city' : 'county';
  }

  function normalizeCountyName(name) {
    if (!name) return '';
    return name.includes('County') ? name : `${name} County`;
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

  function escapeHTML(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function countBy(rows, key) {
    const counts = {};

    rows.forEach((row) => {
      const value = row[key] || 'Unknown';
      counts[value] = (counts[value] || 0) + 1;
    });

    return counts;
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

  function getDateKey(report) {
    const value = report.event_date || report.created_at;
    if (!value) return 'Unknown Date';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return date.toISOString().slice(0, 10);
  }

  function getFilteredReports() {
    const keyword = keywordFilter.value.trim().toLowerCase();
    const selectedCounty = countyFilter.value;
    const selectedCity = cityFilter.value;
    const selectedImpact = impactFilter.value;
    const selectedLevel = locationLevelFilter.value;

    return reports.filter((report) => {
      const searchableText = [
        report.county,
        report.city,
        report.impact_area,
        report.incident_type,
        report.description,
        report.event_date
      ].join(' ').toLowerCase();

      const matchesKeyword = !keyword || searchableText.includes(keyword);

      const matchesLocation =
        selectedLevel === 'county'
          ? selectedCounty === 'All' || report.county === selectedCounty
          : selectedCity === 'All' || report.city === selectedCity;

      const matchesImpact =
        selectedImpact === 'All' || report.impact_area === selectedImpact;

      return matchesKeyword && matchesLocation && matchesImpact;
    });
  }

  function populateCountyFilter(rows) {
    const counties = [...new Set(rows.map((report) => report.county).filter(Boolean))].sort();

    counties.forEach((county) => {
      const option = document.createElement('option');
      option.value = county;
      option.textContent = county;
      countyFilter.appendChild(option);
    });
  }

  function populateCityFilter(rows) {
    const cities = [...new Set(rows.map((report) => report.city).filter(Boolean))].sort();

    cities.forEach((city) => {
      const option = document.createElement('option');
      option.value = city;
      option.textContent = city;
      cityFilter.appendChild(option);
    });
  }

  function getTopEntry(counts) {
    const entries = Object.entries(counts);
    if (!entries.length) return ['—', 0];
    return entries.sort((a, b) => b[1] - a[1])[0];
  }

  function renderPieChart(container, counts) {
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    if (!entries.length) {
      container.innerHTML = '<p class="chart-empty">No data available.</p>';
      return;
    }

    const total = entries.reduce((sum, entry) => sum + entry[1], 0);
    let currentPercent = 0;

    const colors = ['#f04a23', '#ff8a4c', '#006c70', '#f6c98f', '#b9b0d9', '#7f8c8d'];

    const gradientParts = entries.map(([label, value], index) => {
      const percent = (value / total) * 100;
      const start = currentPercent;
      const end = currentPercent + percent;
      currentPercent = end;
      return `${colors[index % colors.length]} ${start}% ${end}%`;
    });

    container.innerHTML = `
      <div class="pie-chart-layout">
        <div class="pie-chart-circle" style="background: conic-gradient(${gradientParts.join(', ')});">
          <div class="pie-chart-center">
            <strong>${total}</strong>
            <span>Reports</span>
          </div>
        </div>

        <div class="pie-chart-legend">
          ${entries.map(([label, value], index) => {
            const percent = ((value / total) * 100).toFixed(1);
            return `
              <div class="pie-legend-row">
                <span class="pie-legend-color" style="background:${colors[index % colors.length]}"></span>
                <span class="pie-legend-label">${escapeHTML(label)}</span>
                <span class="pie-legend-value">${value} (${percent}%)</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  function renderBarChart(container, counts, limit = 10) {
    const entries = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    if (!entries.length) {
      container.innerHTML = '<p class="chart-empty">No data available.</p>';
      return;
    }

    const maxValue = Math.max(...entries.map((entry) => entry[1]));

    container.innerHTML = entries.map(([label, value]) => {
      const width = maxValue ? (value / maxValue) * 100 : 0;

      return `
        <div class="bar-row">
          <div class="bar-label">${escapeHTML(label)}</div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${width}%"></div>
          </div>
          <div class="bar-value">${value}</div>
        </div>
      `;
    }).join('');
  }

  function renderTimelineChart(rows) {
    const counts = {};

    rows.forEach((report) => {
      const key = getDateKey(report);
      counts[key] = (counts[key] || 0) + 1;
    });

    const entries = Object.entries(counts)
      .filter(([date]) => date !== 'Unknown Date')
      .sort((a, b) => new Date(a[0]) - new Date(b[0]));

    if (!entries.length) {
      timelineChart.innerHTML = '<p class="chart-empty">No timeline data available.</p>';
      return;
    }

    const maxValue = Math.max(...entries.map((entry) => entry[1]));
    const width = Math.max(700, entries.length * 70);
    const height = 260;
    const padding = 42;

    const points = entries.map(([date, value], index) => {
      const x = padding + (index / Math.max(entries.length - 1, 1)) * (width - padding * 2);
      const y = height - padding - (value / maxValue) * (height - padding * 2);
      return { date, value, x, y };
    });

    const polyline = points.map((point) => `${point.x},${point.y}`).join(' ');

    timelineChart.innerHTML = `
      <div class="timeline-scroll-wrap">
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" class="axis-line" />
          <polyline points="${polyline}" class="timeline-line" />
          ${points.map((point) => `
            <circle cx="${point.x}" cy="${point.y}" r="5" class="timeline-dot">
              <title>${escapeHTML(point.date)}: ${point.value} report(s)</title>
            </circle>
            <text x="${point.x}" y="${height - 14}" text-anchor="middle" class="timeline-label">
              ${escapeHTML(point.date.slice(5))}
            </text>
          `).join('')}
        </svg>
      </div>
    `;
  }

  function updateStats(rows) {
    const locationKey = getLocationKey();
    const locationCounts = countBy(rows, locationKey);
    const impactCounts = countBy(rows, 'impact_area');

    const [topLocation] = getTopEntry(locationCounts);
    const [topImpact] = getTopEntry(impactCounts);

    totalReportsEl.textContent = rows.length;
    totalCountiesEl.textContent = Object.keys(locationCounts).filter((x) => x !== 'Unknown').length;
    topImpactEl.textContent = topImpact;
    topCountyEl.textContent = topLocation;

    statLocationLabel.textContent =
      locationKey === 'city' ? 'Cities Represented' : 'Counties Represented';

    statTopLocationLabel.textContent =
      locationKey === 'city' ? 'Top City' : 'Top County';
  }

  function updateCountyChoropleth(rows) {
    if (!dashboardMap || !countyGeojson || !dashboardMap.getSource('dashboard-counties')) return;

    const counts = countReportsByCounty(rows);

    countyGeojson.features.forEach((feature) => {
      const countyName = normalizeCountyName(getCountyName(feature));
      feature.properties.report_count = counts[countyName] || 0;
    });

    dashboardMap.getSource('dashboard-counties').setData(countyGeojson);
  }

  function updateCityChoropleth(rows) {
    if (!dashboardMap || !cityGeojson || !dashboardMap.getSource('dashboard-cities')) return;

    const counts = countReportsByCity(rows);

    cityGeojson.features.forEach((feature) => {
      const cityName = normalizeCityName(getCityName(feature));
      feature.properties.report_count = counts[cityName] || 0;
    });

    dashboardMap.getSource('dashboard-cities').setData(cityGeojson);
  }

  function updateDashboard() {
    const filteredReports = getFilteredReports();

    updateStats(filteredReports);
    renderPieChart(impactChart, countBy(filteredReports, 'impact_area'));
    renderBarChart(countyChart, countBy(filteredReports, getLocationKey()), 12);
    renderBarChart(incidentChart, countBy(filteredReports, 'incident_type'), 12);
    renderTimelineChart(filteredReports);

    updateCountyChoropleth(filteredReports);
    updateCityChoropleth(filteredReports);
  }

  async function initializeMap() {
    dashboardMap = new maplibregl.Map({
      container: 'dashboard-map',
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
              'raster-opacity': 0.86,
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
      maxZoom: 12
    });

    dashboardMap.addControl(new maplibregl.NavigationControl());

    document.getElementById('dashboard-recenter-btn').addEventListener('click', () => {
      dashboardMap.flyTo({
        center: washingtonCenter,
        zoom: washingtonZoom,
        speed: 0.9
      });
    });

    dashboardMap.on('load', async () => {
      const countyResponse = await fetch('data/wa_counties.geojson');
      const cityResponse = await fetch('data/City_Boundaries.geojson');

      countyGeojson = await countyResponse.json();
      cityGeojson = await cityResponse.json();

      dashboardMap.addSource('dashboard-counties', {
        type: 'geojson',
        data: countyGeojson
      });

      dashboardMap.addSource('dashboard-cities', {
        type: 'geojson',
        data: cityGeojson
      });

      dashboardMap.addLayer({
        id: 'dashboard-county-fill',
        type: 'fill',
        source: 'dashboard-counties',
        maxzoom: cityZoomThreshold,
        paint: {
          'fill-color': [
            'interpolate',
            ['linear'],
            ['coalesce', ['get', 'report_count'], 0],
            0, '#fff1d6',
            1, '#f7c77d',
            3, '#f49a47',
            6, '#e85f2a',
            10, '#b8321a'
          ],
          'fill-opacity': 0.68
        }
      });

      dashboardMap.addLayer({
        id: 'dashboard-county-outline',
        type: 'line',
        source: 'dashboard-counties',
        maxzoom: cityZoomThreshold,
        paint: {
          'line-color': '#ffffff',
          'line-width': 1.2
        }
      });

      dashboardMap.addLayer({
        id: 'dashboard-city-fill',
        type: 'fill',
        source: 'dashboard-cities',
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
          'fill-opacity': 0.72
        }
      });

      dashboardMap.addLayer({
        id: 'dashboard-city-outline',
        type: 'line',
        source: 'dashboard-cities',
        minzoom: cityZoomThreshold,
        paint: {
          'line-color': '#ffffff',
          'line-width': 0.9
        }
      });

      dashboardMap.on('click', 'dashboard-county-fill', (event) => {
        const feature = event.features[0];
        const countyName = normalizeCountyName(getCountyName(feature));
        const reportCount = feature.properties.report_count || 0;

        new maplibregl.Popup()
          .setLngLat(event.lngLat)
          .setHTML(`<strong>${escapeHTML(countyName)}</strong><br>${reportCount} report(s)`)
          .addTo(dashboardMap);
      });

      dashboardMap.on('click', 'dashboard-city-fill', (event) => {
        const feature = event.features[0];
        const cityName = normalizeCityName(getCityName(feature));
        const reportCount = feature.properties.report_count || 0;

        new maplibregl.Popup()
          .setLngLat(event.lngLat)
          .setHTML(`<strong>${escapeHTML(cityName)}</strong><br>${reportCount} report(s)`)
          .addTo(dashboardMap);
      });

      dashboardMap.on('mouseenter', 'dashboard-county-fill', () => {
        dashboardMap.getCanvas().style.cursor = 'pointer';
      });

      dashboardMap.on('mouseleave', 'dashboard-county-fill', () => {
        dashboardMap.getCanvas().style.cursor = '';
      });

      dashboardMap.on('mouseenter', 'dashboard-city-fill', () => {
        dashboardMap.getCanvas().style.cursor = 'pointer';
      });

      dashboardMap.on('mouseleave', 'dashboard-city-fill', () => {
        dashboardMap.getCanvas().style.cursor = '';
      });

      updateDashboard();
    });
  }

  async function loadReports() {
    const response = await fetch(API_BASE + '/api/get-reports');
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || 'Failed to load reports.');
    }

    reports = result.rows || [];
    populateCountyFilter(reports);
    populateCityFilter(reports);
    updateDashboard();
  }

  function attachEvents() {
    keywordFilter.addEventListener('input', updateDashboard);
    countyFilter.addEventListener('change', updateDashboard);
    impactFilter.addEventListener('change', updateDashboard);
    locationLevelFilter.addEventListener('change', updateDashboard);
    cityFilter.addEventListener('change', updateDashboard);
  }

  async function init() {
    try {
      attachEvents();
      await initializeMap();
      await loadReports();
    } catch (error) {
      console.error(error);
    }
  }

  init();
})();
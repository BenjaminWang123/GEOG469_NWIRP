
(() => {
  // Same-domain deployment on Render can use an empty API base.
  // For local testing with Live Server, use:
  // const API_BASE = 'https://geog469-nwirp-1rtx.onrender.com';
  const API_BASE = '';

  const washingtonCenter = [-120.7, 47.4];
  const washingtonZoom = 6.1;

  const keywordFilter = document.getElementById('dashboard-keyword-filter');
  const countyFilter = document.getElementById('dashboard-county-filter');
  const impactFilter = document.getElementById('dashboard-impact-filter');

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
  let dashboardMap = null;

  function normalizeCountyName(name) {
    if (!name) return '';
    return name.includes('County') ? name : `${name} County`;
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

  function escapeHTML(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function getDateKey(report) {
    const value = report.event_date || report.created_at;
    if (!value) return 'Unknown Date';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return date.toISOString().slice(0, 10);
  }

  function countBy(rows, key) {
    const counts = {};

    rows.forEach((row) => {
      const value = row[key] || 'Unknown';
      counts[value] = (counts[value] || 0) + 1;
    });

    return counts;
  }

  function getFilteredReports() {
    const keyword = keywordFilter.value.trim().toLowerCase();
    const selectedCounty = countyFilter.value;
    const selectedImpact = impactFilter.value;

    return reports.filter((report) => {
      const searchableText = [
        report.county,
        report.impact_area,
        report.incident_type,
        report.description,
        report.event_date
      ].join(' ').toLowerCase();

      const matchesKeyword = !keyword || searchableText.includes(keyword);
      const matchesCounty = selectedCounty === 'All' || report.county === selectedCounty;
      const matchesImpact = selectedImpact === 'All' || report.impact_area === selectedImpact;

      return matchesKeyword && matchesCounty && matchesImpact;
    });
  }

  function getTopEntry(counts) {
    const entries = Object.entries(counts);
    if (!entries.length) return ['—', 0];
    return entries.sort((a, b) => b[1] - a[1])[0];
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
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Timeline chart">
          <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" class="axis-line" />
          <polyline points="${polyline}" class="timeline-line" />
          ${points.map((point) => `
            <circle cx="${point.x}" cy="${point.y}" r="5" class="timeline-dot">
              <title>${escapeHTML(point.date)}: ${point.value} report(s)</title>
            </circle>
            <text x="${point.x}" y="${height - 14}" text-anchor="middle" class="timeline-label">${escapeHTML(point.date.slice(5))}</text>
          `).join('')}
        </svg>
      </div>
    `;
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

  function updateStats(rows) {
    const countyCounts = countBy(rows, 'county');
    const impactCounts = countBy(rows, 'impact_area');

    const [topCounty] = getTopEntry(countyCounts);
    const [topImpact] = getTopEntry(impactCounts);

    totalReportsEl.textContent = rows.length;
    totalCountiesEl.textContent = Object.keys(countyCounts).filter((county) => county !== 'Unknown').length;
    topImpactEl.textContent = topImpact;
    topCountyEl.textContent = topCounty;
  }

  function updateChoropleth(rows) {
    if (!dashboardMap || !countyGeojson || !dashboardMap.getSource('dashboard-counties')) return;

    const counts = {};

    rows.forEach((report) => {
      const county = normalizeCountyName(report.county);
      if (!county) return;
      counts[county] = (counts[county] || 0) + 1;
    });

    countyGeojson.features.forEach((feature) => {
      const countyName = normalizeCountyName(getCountyName(feature));
      feature.properties.report_count = counts[countyName] || 0;
    });

    dashboardMap.getSource('dashboard-counties').setData(countyGeojson);
  }

  function updateDashboard() {
    const filteredReports = getFilteredReports();

    updateStats(filteredReports);
    renderBarChart(impactChart, countBy(filteredReports, 'impact_area'), 6);
    renderBarChart(countyChart, countBy(filteredReports, 'county'), 12);
    renderBarChart(incidentChart, countBy(filteredReports, 'incident_type'), 12);
    renderTimelineChart(filteredReports);
    updateChoropleth(filteredReports);
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
      maxZoom: 10
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
      countyGeojson = await countyResponse.json();

      dashboardMap.addSource('dashboard-counties', {
        type: 'geojson',
        data: countyGeojson
      });

      dashboardMap.addLayer({
        id: 'dashboard-county-fill',
        type: 'fill',
        source: 'dashboard-counties',
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
        paint: {
          'line-color': '#ffffff',
          'line-width': 1.2
        }
      });

      dashboardMap.on('click', 'dashboard-county-fill', (event) => {
        const feature = event.features[0];
        const countyName = normalizeCountyName(getCountyName(feature));
        const reportCount = feature.properties.report_count || 0;

        new maplibregl.Popup()
          .setLngLat(event.lngLat)
          .setHTML(`
            <strong>${escapeHTML(countyName)}</strong><br>
            ${reportCount} report(s)
          `)
          .addTo(dashboardMap);
      });

      dashboardMap.on('mouseenter', 'dashboard-county-fill', () => {
        dashboardMap.getCanvas().style.cursor = 'pointer';
      });

      dashboardMap.on('mouseleave', 'dashboard-county-fill', () => {
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
    updateDashboard();
  }

  function attachEvents() {
    keywordFilter.addEventListener('input', updateDashboard);
    countyFilter.addEventListener('change', updateDashboard);
    impactFilter.addEventListener('change', updateDashboard);
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
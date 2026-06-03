(() => {
  const API_BASE = '';

  const cityFilter = document.getElementById('blog-city-filter');
  const blogList = document.getElementById('blog-list');
  const resultSummary = document.getElementById('blog-result-summary');
  const keywordFilter = document.getElementById('blog-keyword-filter');
  const countyFilter = document.getElementById('blog-county-filter');
  const impactFilter = document.getElementById('blog-impact-filter');
  const sortFilter = document.getElementById('blog-sort-filter');
  const categoryTabs = document.getElementById('blog-category-tabs');

  let reports = [];

  function escapeHTML(value) {
    if (value === null || value === undefined) return '';

    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatDate(value) {
    if (!value) return 'Date not provided';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  function getImpactClass(impactArea) {
    if (impactArea === 'Economic') return 'economic-box';
    if (impactArea === 'Health') return 'health-box';
    if (impactArea === 'Education') return 'education-box';
    if (impactArea === 'Social Stability') return 'social-box';
    return 'unknown-box';
  }

  function getTagClass(impactArea) {
    if (impactArea === 'Economic') return 'economic';
    if (impactArea === 'Health') return 'health';
    if (impactArea === 'Education') return 'education';
    if (impactArea === 'Social Stability') return 'social';
    return 'unknown';
  }

  function generateBlogTitle(report) {
    const location = report.city || report.county || 'Washington';
    const incidentType = report.incident_type || 'Community impact';
    return `${incidentType} reported in ${location}`;
  }

  function generateBlogExcerpt(report) {
    if (report.description && report.description.trim()) {
      return report.description;
    }

    return `A community member submitted an anonymized ${report.impact_area || 'community impact'} report related to ${report.incident_type || 'local enforcement impacts'}.`;
  }

  function populateCountyFilter(rows) {
    const counties = [
      ...new Set(rows.map((report) => report.county).filter(Boolean))
    ].sort();

    counties.forEach((county) => {
      const option = document.createElement('option');
      option.value = county;
      option.textContent = county;
      countyFilter.appendChild(option);
    });
  }

  function populateCityFilter(rows) {
    const selectedCounty = countyFilter.value;

    const cities = [
      ...new Set(
        rows
          .filter((report) => {
            return selectedCounty === 'All' || report.county === selectedCounty;
          })
          .map((report) => report.city)
          .filter(Boolean)
      )
    ].sort();

    cityFilter.innerHTML = '<option value="All">All Cities</option>';

    cities.forEach((city) => {
      const option = document.createElement('option');
      option.value = city;
      option.textContent = city;
      cityFilter.appendChild(option);
    });
  }

  function getFilteredReports() {
    const keyword = keywordFilter.value.trim().toLowerCase();
    const selectedCounty = countyFilter.value;
    const selectedCity = cityFilter.value;
    const selectedImpact = impactFilter.value;

    let filtered = reports.filter((report) => {
      const searchableText = [
        report.county,
        report.city,
        report.impact_area,
        report.incident_type,
        report.description,
        report.event_date
      ].join(' ').toLowerCase();

      const matchesKeyword =
        !keyword || searchableText.includes(keyword);

      const matchesCounty =
        selectedCounty === 'All' || report.county === selectedCounty;

      const matchesCity =
        selectedCity === 'All' || report.city === selectedCity;

      const matchesImpact =
        selectedImpact === 'All' || report.impact_area === selectedImpact;

      return matchesKeyword && matchesCounty && matchesCity && matchesImpact;
    });

    if (sortFilter.value === 'oldest') {
      filtered.sort((a, b) => new Date(a.event_date || a.created_at) - new Date(b.event_date || b.created_at));
    }

    if (sortFilter.value === 'newest') {
      filtered.sort((a, b) => new Date(b.event_date || b.created_at) - new Date(a.event_date || a.created_at));
    }

    if (sortFilter.value === 'county') {
      filtered.sort((a, b) => String(a.county || '').localeCompare(String(b.county || '')));
    }

    if (sortFilter.value === 'impact') {
      filtered.sort((a, b) => String(a.impact_area || '').localeCompare(String(b.impact_area || '')));
    }

    return filtered;
  }

  function renderReports() {
    const filteredReports = getFilteredReports();

    resultSummary.textContent =
      `${filteredReports.length} report(s) shown from ${reports.length} total report(s).`;

    if (!filteredReports.length) {
      blogList.innerHTML = `
        <div class="empty-blog-message">
          <h3>No reports found</h3>
          <p>Try changing the county, city, impact area, keyword, or sorting filters.</p>
        </div>
      `;
      return;
    }

    blogList.innerHTML = filteredReports
      .map((report) => {
        const impactArea = report.impact_area || 'Unknown';
        const boxClass = getImpactClass(impactArea);
        const tagClass = getTagClass(impactArea);
        const title = generateBlogTitle(report);
        const excerpt = generateBlogExcerpt(report);

        return `
          <article class="blog-box ${boxClass}">
            <div>
              <div class="blog-box-header">
                <span class="tag ${tagClass}">
                  ${escapeHTML(impactArea)}
                </span>

                <small>
                  ${escapeHTML(report.city || 'Unknown City')}, ${escapeHTML(report.county || 'Unknown County')}
                  ${escapeHTML(formatDate(report.event_date || report.created_at))}
                </small>
              </div>

              <h2>${escapeHTML(title)}</h2>

              <p>${escapeHTML(excerpt)}</p>

              ${
                report.image_url
                  ? `
                    <img
                      src="${escapeHTML(report.image_url)}"
                      class="blog-report-image"
                      alt="Uploaded report image"
                    >
                  `
                  : ''
              }
            </div>
          </article>
        `;
      })
      .join('');
  }

  function attachFilterEvents() {
    cityFilter.addEventListener('change', renderReports);
    keywordFilter.addEventListener('input', renderReports);

    countyFilter.addEventListener('change', () => {
      populateCityFilter(reports);
      cityFilter.value = 'All';
      renderReports();
    });

    impactFilter.addEventListener('change', renderReports);
    sortFilter.addEventListener('change', renderReports);

    categoryTabs.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) return;

      categoryTabs
        .querySelectorAll('button')
        .forEach((tab) => tab.classList.remove('active-tab'));

      button.classList.add('active-tab');

      impactFilter.value = button.dataset.impact;
      renderReports();
    });
  }

  async function loadReports() {
    try {
      const response = await fetch(API_BASE + '/api/get-reports');
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to load reports.');
      }

      reports = result.rows || [];

      populateCountyFilter(reports);
      populateCityFilter(reports);
      renderReports();
    } catch (error) {
      console.error(error);

      resultSummary.textContent = 'Unable to load reports.';

      blogList.innerHTML = `
        <div class="empty-blog-message">
          <h3>Unable to load reports</h3>
          <p>Please check the backend connection or try again later.</p>
        </div>
      `;
    }
  }

  attachFilterEvents();
  loadReports();
})();
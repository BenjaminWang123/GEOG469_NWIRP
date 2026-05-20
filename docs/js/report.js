(() => {
  // Change this later when your backend is deployed.
  // Local testing uses the same server, so this can stay empty.
  const API_BASE = '';

  const form = document.querySelector('.incident-form');
  const privacyCheck = document.getElementById('privacy-confirmation-check');
  const submitButton = document.getElementById('submit-report-btn');
  const incidentPanel = document.getElementById('incident-panel');
  const methodCards = document.querySelectorAll('.method-card');
  const selectedLocationText = document.getElementById('selected-location-text');
  const countySelect = document.getElementById('county-select');
  const incidentTypeSelect = document.getElementById('incident-type-select');

  if (privacyCheck && submitButton) {
    privacyCheck.addEventListener('change', () => {
      submitButton.disabled = !privacyCheck.checked;
    });
  }

  methodCards.forEach((card) => {
    card.addEventListener('click', () => {
      methodCards.forEach((item) => item.classList.remove('active-method'));
      card.classList.add('active-method');

      const method = card.dataset.method;

      if (method === 'map-click') {
        if (incidentPanel) incidentPanel.classList.add('hidden-panel');
        if (selectedLocationText) {
          selectedLocationText.textContent = 'Click a county on the map to begin reporting';
        }
        alert('Click a Washington county on the map. The county will be filled automatically.');
      }

      if (method === 'county-input') {
        if (incidentPanel) incidentPanel.classList.remove('hidden-panel');
        if (selectedLocationText) {
          selectedLocationText.textContent = countySelect.value || 'Choose a county from the dropdown';
        }
        if (countySelect) countySelect.focus();
      }

      if (method === 'current-location') {
        if (incidentPanel) incidentPanel.classList.remove('hidden-panel');
        if (selectedLocationText) {
          selectedLocationText.textContent = 'Finding your county from your general location...';
        }

        if (!navigator.geolocation) {
          selectedLocationText.textContent = 'Geolocation is not supported by this browser. Please choose a county manually.';
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            const lng = position.coords.longitude;
            const lat = position.coords.latitude;

            if (window.findCountyForPoint) {
              const county = window.findCountyForPoint(lng, lat);

              if (county && window.updateSelectedCounty) {
                window.updateSelectedCounty(county);
              } else {
                selectedLocationText.textContent = 'Could not match your location to a Washington county. Please choose a county manually.';
              }
            }
          },
          () => {
            selectedLocationText.textContent = 'Location permission was denied. Please choose a county manually.';
          }
        );
      }
    });
  });

  if (countySelect) {
    countySelect.addEventListener('change', () => {
      const selectedCounty = countySelect.value;

      if (window.updateSelectedCounty && selectedCounty) {
        window.updateSelectedCounty(selectedCounty);
      }

      if (selectedLocationText) {
        selectedLocationText.textContent = selectedCounty || 'No county selected yet';
      }

      if (incidentPanel && selectedCounty) {
        incidentPanel.classList.remove('hidden-panel');
      }
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const dateInput = form.querySelector('input[type="date"]');
      const timeInput = form.querySelector('input[type="time"]');
      const textareas = form.querySelectorAll('textarea');

      const report = {
        county: countySelect ? countySelect.value : '',
        incident_type: incidentTypeSelect ? incidentTypeSelect.value : '',
        description: textareas[0] ? textareas[0].value : '',
        event_date: dateInput ? dateInput.value : '',
        event_time: timeInput ? timeInput.value : '',
        image_url: ''
      };

      if (!report.county) {
        alert('Please select a county before submitting.');
        return;
      }

      if (!report.incident_type) {
        alert('Please select an incident type before submitting.');
        return;
      }

      try {
        const response = await fetch(API_BASE + '/api/add-report', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(report)
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Failed to submit report.');
        }

        alert('Report submitted successfully. Thank you.');
        form.reset();
        submitButton.disabled = true;

        if (selectedLocationText) {
          selectedLocationText.textContent = 'No county selected yet';
        }
      } catch (error) {
        console.error(error);
        alert('Something went wrong while submitting the report. Please check your backend connection.');
      }
    });
  }
})();
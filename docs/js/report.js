(() => {
  const API_BASE = '';

  const form = document.querySelector('.incident-form');
  const privacyCheck = document.getElementById('privacy-confirmation-check');
  const submitButton = document.getElementById('submit-report-btn');
  const incidentPanel = document.getElementById('incident-panel');
  const methodCards = document.querySelectorAll('.method-card');
  const selectedLocationText = document.getElementById('selected-location-text');
  const countySelect = document.getElementById('county-select');
  const citySelect = document.getElementById('city-select');
  const incidentTypeSelect = document.getElementById('incident-type-select');
  const imageInput = document.getElementById('incident-image');
  const selectedImageName = document.getElementById('selected-image-name');
  const imagePreview = document.getElementById('image-preview');

  if (imageInput) {
    imageInput.addEventListener('change', () => {
      const file = imageInput.files[0];

      if (!file) {
        selectedImageName.textContent = 'No image selected';
        imagePreview.classList.add('hidden-panel');
        imagePreview.src = '';
        return;
      }

      selectedImageName.textContent = `Selected: ${file.name}`;
      imagePreview.src = URL.createObjectURL(file);
      imagePreview.classList.remove('hidden-panel');
    });
  }

  function getImpactAreaFromIncidentType(incidentType) {
    const economicTypes = [
      'Missed work or lost wages',
      'Workplace absence due to enforcement fear',
      'Business disruption',
      'Transportation disruption affecting work',
      'Housing or rent instability'
    ];

    const healthTypes = [
      'Missed medical appointment',
      'Avoided clinic, hospital, or pharmacy',
      'Mental health stress or fear',
      'Delayed emergency care',
      'Difficulty accessing health services'
    ];

    const educationTypes = [
      'Student missed school',
      'Parent avoided school pickup/dropoff',
      'Interrupted ESL or adult education',
      'School event or program disruption',
      'Fear affecting student attendance'
    ];

    const socialTypes = [
      'ICE presence or sighting',
      'Raid, arrest, or detention',
      'Checkpoint or traffic stop',
      'Surveillance or suspicious activity',
      'Community fear or avoidance of public spaces',
      'Other community impact'
    ];

    if (economicTypes.includes(incidentType)) return 'Economic';
    if (healthTypes.includes(incidentType)) return 'Health';
    if (educationTypes.includes(incidentType)) return 'Education';
    if (socialTypes.includes(incidentType)) return 'Social Stability';

    return null;
  }

  async function uploadImageIfSelected() {
    if (!imageInput || imageInput.files.length === 0) {
      return '';
    }

    const imageFormData = new FormData();
    imageFormData.append('image', imageInput.files[0]);

    const uploadResponse = await fetch(API_BASE + '/api/upload-image', {
      method: 'POST',
      body: imageFormData
    });

    const uploadResult = await uploadResponse.json();

    if (!uploadResponse.ok || !uploadResult.success) {
      throw new Error(uploadResult.error || 'Image upload failed.');
    }

    return uploadResult.image_url;
  }

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
          selectedLocationText.textContent = 'Zoom in and click a city polygon on the map to begin reporting.';
        }

        alert('Zoom in and click a city on the map. The city and county will be filled automatically.');
      }

      if (method === 'county-input') {
        if (incidentPanel) incidentPanel.classList.remove('hidden-panel');

        if (selectedLocationText) {
          selectedLocationText.textContent =
            citySelect.value && countySelect.value
              ? `${citySelect.value}, ${countySelect.value}`
              : 'Choose a city from the dropdown';
        }

        if (citySelect) citySelect.focus();
      }

      if (method === 'current-location') {
        if (incidentPanel) incidentPanel.classList.remove('hidden-panel');

        if (selectedLocationText) {
          selectedLocationText.textContent = 'Finding your city or county from your general location...';
        }

        if (!navigator.geolocation) {
          selectedLocationText.textContent = 'Geolocation is not supported by this browser. Please choose a city manually.';
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            const lng = position.coords.longitude;
            const lat = position.coords.latitude;

            if (window.findCityForPoint) {
              const cityInfo = window.findCityForPoint(lng, lat);

              if (cityInfo && window.updateSelectedCity) {
                window.updateSelectedCity(cityInfo);
                return;
              }
            }

            if (window.findCountyForPoint) {
              const county = window.findCountyForPoint(lng, lat);

              if (county && countySelect) {
                countySelect.value = county;
                selectedLocationText.textContent = `${county} detected. Please choose the closest city manually.`;
              } else {
                selectedLocationText.textContent = 'Could not match your location. Please choose a city manually.';
              }
            }
          },
          () => {
            selectedLocationText.textContent = 'Location permission was denied. Please choose a city manually.';
          }
        );
      }
    });
  });

  if (countySelect) {
    countySelect.addEventListener('change', () => {
      const selectedCounty = countySelect.value;

      if (window.populateCityDropdown) {
        window.populateCityDropdown(selectedCounty);
      }

      if (citySelect) {
        citySelect.value = '';
      }

      if (selectedLocationText) {
        selectedLocationText.textContent = selectedCounty
          ? `${selectedCounty} selected. Now choose a city.`
          : 'No city selected yet';
      }

      if (incidentPanel && selectedCounty) {
        incidentPanel.classList.remove('hidden-panel');
      }
    });
  }

  if (citySelect) {
    citySelect.addEventListener('change', () => {
      const selectedOption = citySelect.options[citySelect.selectedIndex];

      const city = citySelect.value;
      const county = selectedOption.dataset.county || countySelect.value;

      if (countySelect && county) {
        countySelect.value = county;
      }

      if (selectedLocationText) {
        selectedLocationText.textContent =
          city && county ? `${city}, ${county}` : 'No city selected yet';
      }

      if (window.zoomToCity && city) {
        window.zoomToCity(city);
      }

      if (incidentPanel && city) {
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

      const selectedIncidentType = incidentTypeSelect ? incidentTypeSelect.value : '';
      const impactArea = getImpactAreaFromIncidentType(selectedIncidentType);

      if (!citySelect.value || !countySelect.value) {
        alert('Please select a city before submitting.');
        return;
      }

      if (!selectedIncidentType) {
        alert('Please select an incident type before submitting.');
        return;
      }

      if (!impactArea) {
        alert('The selected incident type could not be categorized.');
        return;
      }

      try {
        submitButton.disabled = true;
        submitButton.textContent = 'Submitting...';

        const imageUrl = await uploadImageIfSelected();
        const selectedCityOption = citySelect.options[citySelect.selectedIndex];

        const report = {
          county: countySelect.value,
          city: citySelect.value,
          city_lat: selectedCityOption.dataset.lat || null,
          city_lng: selectedCityOption.dataset.lng || null,
          impact_area: impactArea,
          incident_type: selectedIncidentType,
          description: textareas[0] ? textareas[0].value : '',
          event_date: dateInput ? dateInput.value : '',
          event_time: timeInput ? timeInput.value : '',
          image_url: imageUrl
        };

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

        if (selectedImageName) selectedImageName.textContent = 'No image selected';
        if (imagePreview) {
          imagePreview.classList.add('hidden-panel');
          imagePreview.src = '';
        }

        if (selectedLocationText) {
          selectedLocationText.textContent = 'No city selected yet';
        }

        if (incidentPanel) {
          incidentPanel.classList.add('hidden-panel');
        }

        submitButton.textContent = 'Submit Report';
        submitButton.disabled = true;
      } catch (error) {
        console.error(error);
        alert(error.message || 'Something went wrong while submitting the report.');

        submitButton.textContent = 'Submit Report';
        submitButton.disabled = !privacyCheck.checked;
      }
    });
  }
})();
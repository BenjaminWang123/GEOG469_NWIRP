
const map = new maplibregl.Map({
  container: 'map',
  style: 'https://api.maptiler.com/maps/backdrop/style.json?key=RfRL9v7ZGFEpggF4P3Fp',
  center: [-120.7, 47.4],
  zoom: 6.7,
  minZoom: 5.5,
  maxZoom: 13
});

map.addControl(new maplibregl.NavigationControl());

const individualReports = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        title: 'Healthcare Access Issue'
      },
      geometry: {
        type: 'Point',
        coordinates: [-122.3321, 47.6062]
      }
    }
  ]
};

const countyAggregation = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        county: 'King',
        reports: 214
      },
      geometry: {
        type: 'Point',
        coordinates: [-121.9, 47.5]
      }
    }
  ]
};

map.on('load', () => {

  map.addSource('individual-reports', {
    type: 'geojson',
    data: individualReports
  });

  map.addSource('county-aggregation', {
    type: 'geojson',
    data: countyAggregation
  });

  // Individual report points
  map.addLayer({
    id: 'report-points',
    type: 'circle',
    source: 'individual-reports',
    minzoom: 8,
    paint: {
      'circle-radius': 5,
      'circle-color': '#f04a23',
      'circle-stroke-width': 1,
      'circle-stroke-color': '#ffffff'
    }
  });

  // County aggregation circles
  map.addLayer({
    id: 'county-circles',
    type: 'circle',
    source: 'county-aggregation',
    maxzoom: 8,
    paint: {
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['get', 'reports'],
        10, 15,
        250, 45
      ],
      'circle-color': '#f04a23',
      'circle-opacity': 0.75,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff'
    }
  });

  map.addLayer({
    id: 'county-labels',
    type: 'symbol',
    source: 'county-aggregation',
    maxzoom: 8,
    layout: {
      'text-field': ['get', 'reports'],
      'text-size': 14
    },
    paint: {
      'text-color': '#ffffff'
    }
  });

});
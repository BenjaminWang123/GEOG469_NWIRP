const form = document.getElementById('report-form');

form.addEventListener('submit', async (e) => {

  e.preventDefault();

  const report = {
    category: document.getElementById('category').value,
    event_date: document.getElementById('event_date').value,
    county: document.getElementById('county').value,
    description: document.getElementById('description').value,
    email: document.getElementById('email').value
  };

  console.log(report);

  alert('Prototype submission successful.');

});
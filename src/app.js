const express = require('express');
const cors = require('cors');

const app = express();

// During development, allow all origins.
// Later, replace this with your real GitHub Pages / Vercel URL.
app.use(cors());

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const index = require('./routes/index');
const reportRoutes = require('./routes/report.routes');

app.use(index);
app.use('/api/', reportRoutes);

app.use('/', express.static('docs'));

module.exports = app;
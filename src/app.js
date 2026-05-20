const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const index = require('./routes/index');
const reportRoutes = require('./routes/report.routes');
const uploadRoutes = require('./routes/upload.routes');

app.use(index);
app.use('/api', reportRoutes);
app.use('/api', uploadRoutes);

app.use('/', express.static('docs'));

module.exports = app;
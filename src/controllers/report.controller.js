const db = require('../config/database');

exports.getReports = async(req, res) => {

  const response = await db.query(
    'SELECT * FROM "tblImpactReports" ORDER BY id ASC'
  );

  res.status(200).send(response.rows);
};

exports.addReport = async(req, res) => {

  const {
    category,
    event_date,
    county,
    description,
    email
  } = req.body;

  await db.query(
    'INSERT INTO "tblImpactReports"(category, event_date, county, description, email) VALUES ($1, $2, $3, $4, $5)',
    [category, event_date, county, description, email]
  );

  res.status(200).send({
    message: 'Report submitted successfully.'
  });
};
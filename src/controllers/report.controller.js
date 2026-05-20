const db = require('../config/database');

exports.getReports = async (req, res) => {
  try {
    const response = await db.query(
      'SELECT * FROM "tblImpactReports" ORDER BY created_at DESC'
    );

    res.status(200).send({
      success: true,
      rows: response.rows
    });
  } catch (error) {
    console.error('Error getting reports:', error);

    res.status(500).send({
      success: false,
      message: 'Failed to retrieve reports.'
    });
  }
};

exports.addReport = async (req, res) => {
  try {
    let {
      county,
      incident_type,
      description,
      event_date,
      event_time,
      image_url
    } = req.body;

    if (!county || !incident_type) {
      return res.status(400).send({
        success: false,
        message: 'County and incident type are required.'
      });
    }

    event_date = event_date || null;
    event_time = event_time || null;
    description = description || null;
    image_url = image_url || null;

    const response = await db.query(
      `INSERT INTO "tblImpactReports"
        (county, incident_type, description, event_date, event_time, image_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [county, incident_type, description, event_date, event_time, image_url]
    );

    res.status(201).send({
      success: true,
      message: 'Report submitted successfully.',
      report: response.rows[0]
    });
  } catch (error) {
    console.error('Error adding report:', error);

    res.status(500).send({
      success: false,
      message: error.message
    });
  }
};
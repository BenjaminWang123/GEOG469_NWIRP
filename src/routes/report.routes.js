const router = require('express-promise-router')();
const reportController = require('../controllers/report.controller');

router.get('/get-reports', reportController.getReports);
router.post('/add-report', reportController.addReport);

module.exports = router;
'use strict';

const { Router } = require('express');
const controller = require('../../controllers/adminDashboardController');
const jwtAuth    = require('../../middleware/jwtAuth');

const router = Router();
router.use(jwtAuth);

router.get('/', controller.overview);

module.exports = router;

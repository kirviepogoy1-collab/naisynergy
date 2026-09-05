const express = require('express');

const router = express.Router();

router.use('/users', require('./users'));
router.use('/employees', require('./employees'));
router.use('/rooms', require('./rooms'));
router.use('/inventory', require('./inventory'));
router.use('/personnel', require('./personnel'));
router.use('/records', require('./records'));

module.exports = router;

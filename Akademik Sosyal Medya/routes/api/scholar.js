const express = require('express');
const router = express.Router();
const scholarController = require('../../controllers/scholarController');

// Tek makale özeti
router.get('/abstract', scholarController.getAbstract);

// Toplu özet güncelle
router.post('/update-abstracts', scholarController.updateAbstracts);

module.exports = router;

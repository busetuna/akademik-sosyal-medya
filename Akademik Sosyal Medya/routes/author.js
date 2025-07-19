const express = require('express');
const router = express.Router();
const authorController = require('../controllers/authorController');

router.get('/', authorController.home);
router.get('/author', authorController.authorPage);
router.get('/author/:id', authorController.getAuthorById);
router.get('/search-author', authorController.searchAuthor);
router.get('/compare/:id', authorController.comparePage);

module.exports = router;

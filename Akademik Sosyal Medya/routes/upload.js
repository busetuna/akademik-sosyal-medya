const express = require('express');
const router = express.Router();
const multer = require('../config/multer');
const { extractAbstract } = require('../utils/extractAbstract');
const fs = require('fs');
const pdfParse = require('pdf-parse');

// GET /upload - Sayfayı yükle
router.get('/', (req, res) => {
  res.render('upload', { abstracts: [] });
});

// POST /upload - Dosyaları işle
router.post('/', multer.array('pdfs', 10), async (req, res) => {
  const files = req.files;
  if (!files || files.length === 0) {
    return res.status(400).send('Dosya yüklenmedi.');
  }

  try {
    const abstracts = [];

    for (const file of files) {
      const dataBuffer = fs.readFileSync(file.path);
      const pdfData = await pdfParse(dataBuffer);
      const text = pdfData.text;
      const abstract = extractAbstract(text);
      abstracts.push(abstract);
    }

    res.render('upload', { abstracts });
  } catch (err) {
    console.error(err);
    res.status(500).send('Sunucu hatası.');
  }
});

module.exports = router;

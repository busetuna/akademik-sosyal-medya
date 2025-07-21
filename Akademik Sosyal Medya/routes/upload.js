const express = require('express');
const router = express.Router();
const multer = require('../config/multer');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const axios = require('axios');
const { extractAbstract } = require('../utils/extractAbstract');
const buildPrompt = require('../utils/buildPrompt');

router.get('/', (req, res) => {
  res.render('upload'); // views/upload.ejs varsa
});

// Çoklu PDF dosyası için multer
router.post('/', multer.array('pdfs', 10), async (req, res) => {
  const files = req.files;
  const myAbstract = req.body.myAbstract;

  if (!files || files.length === 0 || !myAbstract) {
    return res.status(400).send('Eksik veri: PDF ve kendi abstract gerekli.');
  }

  try {
    // Her PDF için özet çıkar
    const compareAbstracts = [];

    for (const file of files) {
      const buffer = fs.readFileSync(file.path);
      const pdfData = await pdfParse(buffer);
      const text = pdfData.text;
      const abstract = extractAbstract(text);
      compareAbstracts.push(abstract);
    }

    // LLaMA için prompt oluştur
    const prompt = buildPrompt(myAbstract, compareAbstracts);

    // LLaMA’ya isteği gönder
    const response = await axios.post('http://localhost:11434/api/generate', {
      model: "llama3",
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.7,
        top_k: 40,
        top_p: 0.9,
        repeat_penalty: 1.1,
        num_predict: 2000
      }
    });

    const output = response.data.response;

    res.render('result', {
      myAbstract,
      compareAbstracts,
      result: output
    });
  } catch (error) {
    console.error('Karşılaştırma hatası:', error);
    res.status(500).send('Sunucu hatası oluştu.');
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const axios = require('axios');
const buildPrompt = require('../../utils/buildPrompt'); // bu dosyanın yolu senin yapına göre değişebilir

router.post('/', async (req, res) => {
  const myAbstract = req.body.myAbstract;
  let compareAbstracts = [];

  try {
    // JSON string olarak gelen abstract dizisini parse et
    compareAbstracts = JSON.parse(req.body.compareAbstracts);
  } catch (err) {
    console.error("compareAbstracts JSON hatası:", err.message);
    return res.status(400).send("Geçersiz abstract verisi.");
  }

  // Prompt oluştur
  const prompt = buildPrompt(myAbstract, compareAbstracts);

  try {
    // LLaMA modeline istek gönder
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

    const result = response.data.response;

    // Sonucu HTML olarak render et (views/result.ejs)
    res.render('result', {
      myAbstract,
      compareAbstracts,
      result
    });

  } catch (error) {
    console.error("LLaMA karşılaştırma hatası:", error.message);
    res.status(500).send("Karşılaştırma işlemi sırasında hata oluştu.");
  }
});

module.exports = router;

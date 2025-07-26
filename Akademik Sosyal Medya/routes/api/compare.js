const express = require('express');
const router = express.Router();
const axios = require('axios');
const buildPrompt = require('../../utils/buildPrompt');

router.post('/', async (req, res) => {
  // Debug için gelen veriyi logla
  console.log("📥 Gelen request body:", JSON.stringify(req.body, null, 2));
  console.log("📥 compareAbstracts tipi:", typeof req.body.compareAbstracts);
  console.log("📥 compareAbstracts değeri:", req.body.compareAbstracts);
  
  const { myAbstract, compareAbstracts: compareAbstractsRaw } = req.body;
  
  // Input validation
  if (!myAbstract || typeof myAbstract !== 'string') {
    return res.status(400).json({ 
      error: "myAbstract gerekli ve string tipinde olmalı" 
    });
  }

  if (!compareAbstractsRaw) {
    return res.status(400).json({ 
      error: "compareAbstracts gerekli" 
    });
  }

  let compareAbstracts = [];

  try {
    // Eğer zaten array ise, parse etme
    if (Array.isArray(compareAbstractsRaw)) {
      compareAbstracts = compareAbstractsRaw;
    } else if (typeof compareAbstractsRaw === 'string') {
      // String ise JSON parse et
      compareAbstracts = JSON.parse(compareAbstractsRaw);
    } else {
      return res.status(400).json({ 
        error: "compareAbstracts array veya JSON string olmalı" 
      });
    }
    
    // Array kontrolü
    if (!Array.isArray(compareAbstracts)) {
      return res.status(400).json({ 
        error: "compareAbstracts bir dizi olmalı" 
      });
    }

    // Boş dizi kontrolü
    if (compareAbstracts.length === 0) {
      return res.status(400).json({ 
        error: "En az bir karşılaştırma abstract'ı gerekli" 
      });
    }

  } catch (err) {
    console.error("❌ compareAbstracts JSON hatası:", err.message);
    return res.status(400).json({ 
      error: "Geçersiz JSON formatı", 
      detail: err.message 
    });
  }

  // Prompt oluştur
  let prompt;
  try {
    prompt = buildPrompt(myAbstract, compareAbstracts);
    
    if (!prompt || typeof prompt !== 'string') {
      throw new Error("Prompt oluşturulamadı");
    }
  } catch (err) {
    console.error("❌ Prompt oluşturma hatası:", err.message);
    return res.status(500).json({ 
      error: "Prompt oluşturma hatası", 
      detail: err.message 
    });
  }

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
    }, {
      timeout: 30000 // 30 saniye timeout
    });

    // Response kontrolü
    if (!response.data || !response.data.response) {
      throw new Error("LLaMA'dan geçersiz yanıt");
    }

    const result = response.data.response;

    // JSON olarak yanıt dön
    res.json({
      success: true,
      result: result,
      metadata: {
        inputLength: prompt.length,
        comparedAbstracts: compareAbstracts.length,
        model: "llama3"
      }
    });

  } catch (error) {
    console.error("❌ LLaMA karşılaştırma hatası:", error);
    
    // Axios hata türüne göre farklı mesajlar
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        success: false,
        error: "LLaMA servisi bağlantı hatası. Servis çalışıyor mu?",
        detail: "localhost:11434 bağlantısı reddedildi"
      });
    }
    
    if (error.code === 'ETIMEDOUT') {
      return res.status(504).json({
        success: false,
        error: "İstek zaman aşımına uğradı",
        detail: "LLaMA servisi yanıt vermedi"
      });
    }

    res.status(500).json({
      success: false,
      error: "Karşılaştırma işlemi sırasında bir hata oluştu",
      detail: error.message || "Sunucu hatası"
    });
  }
});

module.exports = router;
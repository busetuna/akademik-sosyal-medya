const express = require('express');
const router = express.Router();
const axios = require('axios');
const buildPrompt = require('../../utils/buildPrompt');
const { validateAndCleanAbstract } = require('../../utils/extractAbstract');

router.post('/', async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log('🚀 Karşılaştırma isteği alındı');
    console.log('📥 Request body keys:', Object.keys(req.body));
    
    const { myAbstract, compareAbstracts, options = {} } = req.body;

    // ✅ myAbstract doğrulama
    console.log('🔍 myAbstract kontrol ediliyor...');
    console.log('myAbstract type:', typeof myAbstract);
    console.log('myAbstract length:', myAbstract?.length);
    
    if (!myAbstract || typeof myAbstract !== 'string' || myAbstract.trim() === '') {
      return res.status(400).json({
        success: false,
        error: "myAbstract parametresi gerekli ve string tipinde olmalı.",
        code: "INVALID_MY_ABSTRACT",
        debug: {
          type: typeof myAbstract,
          length: myAbstract?.length,
          isEmpty: !myAbstract || myAbstract.trim() === ''
        }
      });
    }

    // ✅ compareAbstracts işleme (DÜZELTME: Object problem çözümü)
    console.log('🔍 compareAbstracts kontrol ediliyor...');
    console.log('compareAbstracts type:', typeof compareAbstracts);
    console.log('compareAbstracts isArray:', Array.isArray(compareAbstracts));
    
    let abstracts = [];

    try {
      if (Array.isArray(compareAbstracts)) {
        console.log('📝 Array formatında:', compareAbstracts.length, 'element');
        abstracts = compareAbstracts;
      } 
      else if (typeof compareAbstracts === 'string') {
        console.log('📝 String formatında, parse deneniyor...');
        try {
          const parsed = JSON.parse(compareAbstracts);
          abstracts = Array.isArray(parsed) ? parsed : [parsed];
        } catch (jsonError) {
          console.log('⚠️ JSON parse başarısız, tek element olarak ekleniyor');
          abstracts = [compareAbstracts];
        }
      } 
      else if (compareAbstracts && typeof compareAbstracts === 'object') {
        console.log('📝 Object formatında, array\'e çevriliyor...');
        // Object ise, özellikleri kontrol et
        if (compareAbstracts.text) {
          abstracts = [compareAbstracts.text];
        } else if (compareAbstracts.abstract) {
          abstracts = [compareAbstracts.abstract];
        } else if (compareAbstracts.content) {
          abstracts = [compareAbstracts.content];
        } else {
          // Object'in string representation'ını al
          abstracts = [JSON.stringify(compareAbstracts)];
        }
      } 
      else {
        return res.status(400).json({
          success: false,
          error: "compareAbstracts parametresi gerekli.",
          detail: "Array, JSON string veya object formatında olmalı.",
          code: "MISSING_COMPARE_ABSTRACTS",
          debug: {
            type: typeof compareAbstracts,
            value: compareAbstracts
          }
        });
      }

      console.log('📊 İşlenen abstracts sayısı:', abstracts.length);

      // ✅ Her abstract'ı string'e çevir ve doğrula
      const validatedAbstracts = [];
      
      for (let i = 0; i < abstracts.length; i++) {
        let abstract = abstracts[i];
        
        console.log(`🔍 Abstract ${i + 1} kontrol ediliyor...`);
        console.log(`Type: ${typeof abstract}, Length: ${abstract?.length}`);
        
        // Object ise string'e çevir
        if (typeof abstract === 'object' && abstract !== null) {
          if (abstract.text) {
            abstract = abstract.text;
          } else if (abstract.abstract) {
            abstract = abstract.abstract;
          } else if (abstract.content) {
            abstract = abstract.content;
          } else {
            abstract = JSON.stringify(abstract);
          }
        }
        
        // String'e çevir
        if (typeof abstract !== 'string') {
          abstract = String(abstract);
        }
        
        // Temizle ve doğrula
        const cleaned = validateAndCleanAbstract(abstract);
        
        if (cleaned && cleaned.length > 30) {
          validatedAbstracts.push(cleaned);
          console.log(`✅ Abstract ${i + 1} geçerli: ${cleaned.length} karakter`);
        } else {
          console.log(`❌ Abstract ${i + 1} geçersiz veya çok kısa`);
        }
      }

      abstracts = validatedAbstracts;

      if (abstracts.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Geçerli karşılaştırma abstract'ı bulunamadı.",
          detail: "Tüm abstract'lar çok kısa veya geçersiz.",
          code: "NO_VALID_ABSTRACTS"
        });
      }

      console.log('✅ Toplam geçerli abstract:', abstracts.length);

    } catch (processingError) {
      console.error("❌ compareAbstracts işleme hatası:", processingError.message);
      return res.status(400).json({
        success: false,
        error: "Abstract verisi işlenirken hata oluştu.",
        detail: processingError.message,
        code: "PROCESSING_ERROR"
      });
    }

    // ✅ Prompt oluştur
    let prompt;
    try {
      console.log('📝 Prompt oluşturuluyor...');
      prompt = buildPrompt(myAbstract, abstracts, options);
      
      if (!prompt || prompt.trim() === '') {
        throw new Error("Prompt oluşturulamadı");
      }
      
      console.log('✅ Prompt hazır:', prompt.length, 'karakter');
      
    } catch (promptError) {
      console.error("❌ Prompt oluşturma hatası:", promptError.message);
      return res.status(500).json({
        success: false,
        error: "Prompt oluşturulurken hata oluştu.",
        detail: promptError.message,
        code: "PROMPT_ERROR"
      });
    }

    // ✅ LLaMA'ya istek gönder
    try {
      console.log('🤖 LLaMA\'ya istek gönderiliyor...');
      
      const response = await axios.post('http://localhost:11434/api/generate', {
        model: options.model || "llama3",
        prompt: prompt,
        stream: false,
        options: {
          temperature: options.temperature || 0.7,
          top_k: options.top_k || 40,
          top_p: options.top_p || 0.9,
          repeat_penalty: options.repeat_penalty || 1.1,
          num_predict: options.max_tokens || 2000
        }
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 0 // Süre sınırı kaldırıldı (sınırsız bekleme)
      });

      if (!response.data || !response.data.response) {
        throw new Error("LLaMA modelinden geçersiz yanıt alındı");
      }

      const result = response.data.response;
      console.log('✅ LLaMA yanıtı alındı:', result.length, 'karakter');
      
      // 🔍 DEBUG: Result tipini kontrol et
      console.log('🔍 Result type:', typeof result);
      console.log('🔍 Result constructor:', result.constructor.name);
      console.log('🔍 Result ilk 200 karakter:', result.substring(0, 200));
      
      // 🛠️ Result'ı kesinlikle string'e çevir
      const resultText = typeof result === 'string' ? result : JSON.stringify(result);
      
      return res.json({
        success: true,
        result: {
          text: resultText,
          length: resultText.length,
          wordCount: resultText.split(/\s+/).filter(word => word.length > 0).length,
          type: 'llama_analysis'
        },
        metadata: {
          inputLength: prompt.length,
          myAbstractLength: myAbstract.length,
          comparedAbstractsCount: abstracts.length,
          totalComparedLength: abstracts.reduce((sum, abs) => sum + (abs?.length || 0), 0),
          model: options.model || "llama3",
          responseTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      });

    } catch (llamaError) {
      console.error("❌ LLaMA hatası:", llamaError.message);
      
      // Fallback mekanizması
      try {
        console.log("⚠️ Fallback mekanizması devreye giriyor...");
        
        const fallbackResult = createSimpleFallback(myAbstract, abstracts);
        
        return res.json({
          success: true,
          result: fallbackResult,
          metadata: {
            fallbackUsed: true,
            originalError: llamaError.message,
            myAbstractLength: myAbstract.length,
            comparedAbstractsCount: abstracts.length,
            responseTime: Date.now() - startTime,
            timestamp: new Date().toISOString()
          },
          info: {
            message: "LLaMA servisi kullanılamadığı için fallback analizi kullanıldı.",
            suggestion: "Daha detaylı analiz için LLaMA servisinin çalıştığından emin olun."
          }
        });

      } catch (fallbackError) {
        console.error("❌ Fallback hatası:", fallbackError.message);
        
        return res.status(500).json({
          success: false,
          error: "Hem LLaMA hem fallback servisi başarısız oldu.",
          detail: {
            llamaError: llamaError.message,
            fallbackError: fallbackError.message
          },
          code: "ALL_SERVICES_FAILED"
        });
      }
    }

  } catch (globalError) {
    console.error("❌ Global hata:", globalError.message);
    return res.status(500).json({
      success: false,
      error: "Sunucu hatası oluştu.",
      detail: globalError.message,
      code: "INTERNAL_SERVER_ERROR"
    });
  }
});

// ✅ Basit fallback fonksiyonu
function createSimpleFallback(myAbstract, compareAbstracts) {
  try {
    const results = [];
    const myWords = myAbstract.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    
    compareAbstracts.forEach((abstract, index) => {
      const compareWords = abstract.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const commonWords = myWords.filter(word => compareWords.includes(word));
      const similarity = (commonWords.length / Math.max(myWords.length, compareWords.length)) * 100;
      
      results.push({
        index: index + 1,
        similarity: Math.round(similarity * 100) / 100,
        commonWords: commonWords.slice(0, 5),
        abstractLength: abstract.length
      });
    });

    const avgSimilarity = results.reduce((sum, r) => sum + r.similarity, 0) / results.length;
    
    const analysisText = [
      "📊 BASIT KARŞILAŞTIRMA ANALİZİ",
      "=" .repeat(40),
      "",
      `📈 Ortalama benzerlik: %${Math.round(avgSimilarity * 100) / 100}`,
      `📝 Karşılaştırılan çalışma sayısı: ${results.length}`,
      "",
      "DETAYLAR:",
      ...results.map(r => 
        `📄 Çalışma ${r.index}: %${r.similarity} benzerlik` +
        `\n   → Ortak kelimeler: ${r.commonWords.join(', ')}`
      ),
      "",
      "⚠️ Bu basit bir kelime bazlı analizdir."
    ].join('\n');

    return {
      text: analysisText,
      type: "simple_fallback",
      results: results,
      summary: {
        averageSimilarity: Math.round(avgSimilarity * 100) / 100,
        totalComparisons: results.length
      }
    };

  } catch (error) {
    return {
      text: `❌ Fallback analizi yapılamadı: ${error.message}`,
      type: "fallback_error",
      error: error.message
    };
  }
}

module.exports = router;
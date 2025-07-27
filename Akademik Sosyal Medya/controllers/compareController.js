const { compareWithLLaMA, fallbackComparison } = require('../services/comparisonService');
const { buildPrompt } = require('../utils/prompts');

exports.compareAbstracts = async (req, res) => {
  const { myAbstract, compareAbstracts } = req.body;

  // compareAbstracts'ı geçerli format'a çevirelim
  let abstracts = [];
  
  try {
    if (Array.isArray(compareAbstracts)) {
      // Zaten array ise direkt kullan
      abstracts = compareAbstracts;
    } else if (typeof compareAbstracts === 'string') {
      // String ise önce JSON parse etmeyi dene
      try {
        abstracts = JSON.parse(compareAbstracts);
      } catch (jsonError) {
        // JSON parse başarısız olursa, string'i tek element olarak array'e çevir
        console.warn("⚠️ JSON parse başarısız, string'i array'e çeviriliyor:", jsonError.message);
        abstracts = [compareAbstracts];
      }
    } else if (compareAbstracts && typeof compareAbstracts === 'object') {
      // Object ise array'e çevir
      abstracts = [compareAbstracts];
    } else {
      // Hiçbiri değilse boş array
      abstracts = [];
    }

    // Boş array kontrolü
    if (abstracts.length === 0) {
      return res.status(400).json({ 
        error: "Karşılaştırılacak abstract bulunamadı.",
        detail: "compareAbstracts parametresi boş veya geçersiz."
      });
    }

  } catch (err) {
    console.error("❌ compareAbstracts işleme hatası:", err.message);
    return res.status(400).json({ 
      error: "Abstract verisi işlenirken hata oluştu.", 
      detail: err.message 
    });
  }

  // myAbstract kontrolü
  if (!myAbstract || typeof myAbstract !== 'string' || myAbstract.trim() === '') {
    return res.status(400).json({ 
      error: "myAbstract parametresi gerekli ve boş olamaz." 
    });
  }

  const prompt = buildPrompt(myAbstract, abstracts);

  try {
    const result = await compareWithLLaMA(prompt);
    
    return res.json({
      success: true,
      result: result,
      myAbstract,
      compareAbstracts: abstracts
    });
  } catch (err) {
    console.error("❌ LLaMA karşılaştırma hatası:", err.message);
    
    try {
      const fallback = fallbackComparison(myAbstract, abstracts);
      
      return res.json({
        success: false,
        result: fallback,
        myAbstract,
        compareAbstracts: abstracts,
        error: "LLaMA servisi başarısız, fallback kullanıldı.",
        detail: err.message
      });
    } catch (fallbackErr) {
      console.error("❌ Fallback karşılaştırma hatası:", fallbackErr.message);
      
      return res.status(500).json({
        success: false,
        error: "Hem ana hem fallback karşılaştırma servisi başarısız.",
        detail: {
          llamaError: err.message,
          fallbackError: fallbackErr.message
        }
      });
    }
  }
};
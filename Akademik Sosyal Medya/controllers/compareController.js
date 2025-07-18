const { compareWithLLaMA, fallbackComparison } = require('../services/comparisonService');
const { buildPrompt } = require('../utils/prompts');

exports.compareAbstracts = async (req, res) => {
  const { myAbstract, compareAbstracts } = req.body;

  if (!myAbstract || !Array.isArray(compareAbstracts) || compareAbstracts.length === 0) {
    return res.status(400).json({ error: 'Eksik veri: Abstract ve karşılaştırma metinleri gerekli' });
  }

  const prompt = buildPrompt(myAbstract, compareAbstracts);

  try {
    const result = await compareWithLLaMA(prompt);
    res.json({ success: true, result, meta: { comparedCount: compareAbstracts.length } });
  } catch (error) {
    const fallback = fallbackComparison(myAbstract, compareAbstracts);
    res.json({ success: false, result: fallback, warning: 'LLaMA başarısız oldu, fallback sonucu döndürüldü.' });
  }
};

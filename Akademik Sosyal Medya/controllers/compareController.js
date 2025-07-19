const { compareWithLLaMA, fallbackComparison } = require('../services/comparisonService');
const { buildPrompt } = require('../utils/prompts');

exports.compareAbstracts = async (req, res) => {
  const { myAbstract, compareAbstracts } = req.body;

  const abstracts = Array.isArray(compareAbstracts)
    ? compareAbstracts
    : [compareAbstracts];

  const prompt = buildPrompt(myAbstract, abstracts);

  try {
    const result = await compareWithLLaMA(prompt);
    return res.render('result', {
      result,
      myAbstract,
      compareAbstracts: abstracts
    });
  } catch (err) {
    const fallback = fallbackComparison(myAbstract, abstracts);
    return res.render('result', {
      result: fallback,
      myAbstract,
      compareAbstracts: abstracts
    });
  }
};

const { sendToLLaMA } = require('./llamaService');
const { generateAdvancedComparison } = require('../utils/prompts');

exports.compareWithLLaMA = async (prompt) => {
  return await sendToLLaMA(prompt);
};

exports.fallbackComparison = (myAbstract, compareAbstracts) => {
  return generateAdvancedComparison(myAbstract, compareAbstracts);
};

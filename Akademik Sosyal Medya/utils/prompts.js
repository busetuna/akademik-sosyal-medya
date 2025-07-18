function buildPrompt(myAbstract, compareAbstracts) {
  return `
You are an academic researcher writing a literature review chapter. Compare the following abstract with others:

MY STUDY:
${myAbstract}

RELATED STUDIES:
${compareAbstracts.map((a, i) => `[${i + 1}] ${a}`).join('\n\n')}

Write a detailed comparison highlighting:
- Objectives
- Methodology
- Unique contributions
- Differences and similarities
- Application domains

Use academic English and logical grouping.
  `;
}

function generateAdvancedComparison(myAbstract, compareAbstracts) {
  const keywords = extractKeywords(myAbstract);
  const topic = extractMainTopic(myAbstract);

  let text = `This study focuses on ${topic} using ${keywords.join(', ') || 'computational methods'}.\n\n`;

  compareAbstracts.forEach((abs, i) => {
    const otherKeywords = extractKeywords(abs);
    const otherTopic = extractMainTopic(abs);

    text += `Study [${i + 1}] focuses on ${otherTopic}. It employs ${otherKeywords.join(', ') || 'other techniques'}.\n`;
  });

  text += `\nCompared to related work, our study uniquely addresses ${topic} with a novel approach.`;

  return text;
}

function extractKeywords(abstract) {
  return abstract.toLowerCase().match(/\b(blockchain|ai|ocr|classification|retrieval|mining|distributed|immutable)\b/g) || [];
}

function extractMainTopic(abstract) {
  const match = abstract.toLowerCase().match(/(blockchain|image classification|text mining|archival|retrieval|model|system|application)/);
  return match ? match[0] : 'the proposed topic';
}

module.exports = {
  buildPrompt,
  generateAdvancedComparison,
  extractKeywords,
  extractMainTopic,
};

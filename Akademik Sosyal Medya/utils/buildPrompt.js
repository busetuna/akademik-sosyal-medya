function buildPrompt(myAbstract, compareAbstracts) {
  return `
You are an academic reviewer. Compare the following main abstract with related studies.
Please provide an academic style comparison focusing on:
- similarities and differences
- methodology
- objectives
- unique contributions
- grouped logically by topics

Main Abstract:
"""${myAbstract}"""

Related Studies:
${compareAbstracts.map((abs, i) => `[${i + 1}] ${abs}`).join('\n\n')}

Write a detailed, well-structured literature review comparison.
  `.trim();
}

module.exports = buildPrompt;

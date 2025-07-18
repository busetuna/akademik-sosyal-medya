const fs = require('fs');
const pdf = require('pdf-parse');
const { extractAbstract } = require('../utils/extractAbstract');

exports.extractAbstractFromPDF = async (filePath) => {
  const dataBuffer = fs.readFileSync(filePath);
  const pdfData = await pdf(dataBuffer);
  return extractAbstract(pdfData.text);
};

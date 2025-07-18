const { extractAbstractFromPDF } = require('../services/pdfService');

exports.handleUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('PDF dosyası eksik');
    }

    const abstract = await extractAbstractFromPDF(req.file.path);
    res.render('upload', {
      title: 'PDF Yükle',
      abstract: abstract
    });
  } catch (err) {
    console.error('❌ PDF Özet çıkarma hatası:', err);
    res.status(500).send('Sunucu hatası');
  }
};

const { getArticleAbstract, updateArticleAbstracts } = require('../services/scholar/abstractService');

exports.getAbstract = async (req, res) => {
  const url = req.query.url;
  if (!url || !url.includes('scholar.google.com')) {
    return res.status(400).json({ error: 'Geçerli bir Google Scholar URL gerekli' });
  }

  try {
    const abstract = await getArticleAbstract(url);
    if (abstract) {
      res.json({ success: true, abstract, url });
    } else {
      res.json({ success: false, message: 'Abstract çekilemedi', url });
    }
  } catch (error) {
    console.error('getAbstract Hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
};
exports.updateAbstracts = async (req, res) => {
  console.log('🔥 /api/scholar/update-abstracts çalıştı');

  const { articles } = req.body;
  console.log('Gelen makale sayısı:', articles?.length);

  if (!Array.isArray(articles)) {
    console.log('❌ Geçersiz makale listesi:', articles);
    return res.status(400).json({ error: 'Geçersiz makale listesi' });
  }

  try {
    const updatedArticles = await updateArticleAbstracts(articles);
    console.log('✅ Güncellenen makale sayısı:', updatedArticles.length);

    res.json({
      success: true,
      articles: updatedArticles,
      message: `${updatedArticles.length} makale işlendi`
    });
  } catch (error) {
    console.error('❌ HATA - update-abstracts:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
};

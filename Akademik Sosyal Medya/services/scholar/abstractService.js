const { getAbstractWithAxios, getAbstractWithPuppeteer } = require('../../utils/extractAbstract');

exports.getArticleAbstract = async (url) => {
  let abstract = await getAbstractWithAxios(url);

  if (!abstract) {
    console.log('[Scrape] Axios başarısız, Puppeteer deneniyor...');
    abstract = await getAbstractWithPuppeteer(url);
  }

  return abstract || null;
};
exports.updateArticleAbstracts = async (articles) => {
  const updatedArticles = [];

  for (const article of articles) {
    try {
      if (!article.link) {
        updatedArticles.push({ ...article, abstract: 'Link eksik' });
        continue;
      }

      console.log(`🔍 Abstract çekiliyor: ${article.title} (${article.link})`);

      const abstract = await exports.getArticleAbstract(article.link);
      updatedArticles.push({
        ...article,
        abstract: abstract || 'Özet bilgisi çekilemedi'
      });

      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err) {
      console.error(`❌ Abstract hatası [${article.title}]`, err);
      updatedArticles.push({
        ...article,
        abstract: 'Sunucu hatası'
      });
    }
  }

  return updatedArticles;
};

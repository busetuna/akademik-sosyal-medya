const { fetchAuthorDetails, searchAuthorId } = require('../services/scholar/authorService');

exports.home = (req, res) => {
  res.render('home/home', { title: 'Ana Sayfa' });
};

exports.authorPage = (req, res) => {
  res.render('author/author', { title: 'Yazar Sayfası' });
};

exports.getAuthorById = async (req, res) => {
  try {
    const authorId = req.params.id;
    const data = await fetchAuthorDetails(authorId);

    res.render('author/author', {
      title: data.author.name,
      author: data.author,
      citations: data.cited_by,
      articles: data.articles,
      nextPageUrl: data.serpapi_pagination?.next || null
    });
  } catch (error) {
    console.error("Yazar verisi alınamadı:", error.message);
    res.status(500).send("Yazar verisi alınırken hata oluştu.");
  }
};

exports.searchAuthor = async (req, res) => {
  const query = req.query.q;
  try {
    const authorId = await searchAuthorId(query);
    if (authorId) {
      res.json({ author_id: authorId });
    } else {
      res.status(404).send('Yazar bulunamadı.');
    }
  } catch (error) {
    console.error("SerpAPI Hatası:", error);
    res.status(500).send("Bir hata oluştu.");
  }
};

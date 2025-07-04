// Environment variables'ı yükle
require('dotenv').config();

const express = require('express');
const path = require('path');
const axios = require('axios');
const { URL } = require('url');

const app = express();

const apiKey = process.env.SERPAPI_KEY || '23eb2da7d73a45b970d593b487ac29c1e864bdb50dcf2286489aa34a9c35a440';
const port = process.env.PORT || 3000;

// API anahtarının varlığını kontrol et
if (!apiKey) {
  console.error('API anahtarı eksik! .env dosyasını kontrol edin.');
  process.exit(1);
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// EJS ayarları
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Ana sayfa route
app.get('/', (req, res) => {
  res.render('home/home', { title: 'Ana Sayfa' });
});

// Yazar arama route
app.get('/search-author', async (req, res) => {
  const query = req.query.q;

  try {
    const response = await axios.get('https://serpapi.com/search.json', {
      params: {
        engine: 'google_scholar',
        q: query,
        api_key: apiKey
      }
    });

    const authorId = response.data?.profiles?.authors?.[0]?.author_id;

    if (authorId) {
      console.log('Bulunan author_id:', authorId);
      return res.json({ author_id: authorId });
    } else {
      console.log('Yazar bulunamadı.');
      return res.send('Yazar bulunamadı.');
    }

  } catch (err) {
    console.error('SerpApi Hatası:', err);
    return res.status(500).send('Bir hata oluştu.');
  }
});

// Author sayfası route
app.get('/author', (req, res) => {
  res.render('author/author', { title: 'Yazar Sayfası' });
});

// Belirli author'ın detayları
app.get('/author/:id', async (req, res) => {
  const authorId = req.params.id;

  try {
    const response = await axios.get('https://serpapi.com/search.json', {
      params: {
        engine: 'google_scholar_author',
        author_id: authorId,
        hl: 'tr',
        api_key: apiKey
      }
    });

    const authorData = response.data;

    console.log("SerpApi'den gelen author JSON:", authorData);

    res.render('author/author', {
      title: authorData.author.name,
      author: authorData.author,
      citations: authorData.cited_by,
      articles: authorData.articles,
      nextPageUrl: authorData.serpapi_pagination?.next || null
    });

  } catch (err) {
    console.error("Yazar verisi alınırken hata:", err.message);
    res.status(500).send("Yazar verisi alınamadı.");
  }
});

// Sayfalama için daha fazla makale yükleme
app.get('/load-more-paginated', async (req, res) => {
  const nextUrl = req.query.url;
  if (!nextUrl) return res.status(400).json({ error: "URL eksik" });

  try {
    const urlObj = new URL(nextUrl);

    if (urlObj.searchParams.get("engine") !== "google_scholar_author") {
      urlObj.searchParams.set("engine", "google_scholar_author");
    }

    urlObj.searchParams.set("api_key", apiKey);
    urlObj.searchParams.set("num", "100");

    const response = await axios.get(urlObj.toString());

    const articles = response.data.articles || [];
    const newNextUrl = response.data.serpapi_pagination?.next || null;

    res.json({ articles, nextUrl: newNextUrl });

  } catch (err) {
    console.error("Makale çekme hatası:", err.response?.data || err.message);
    res.status(500).json({ error: "Makale alınamadı." });
  }
});

app.post('/compare-abstracts', async (req, res) => {
  const { myAbstract, compareAbstracts } = req.body;

  if (!myAbstract || !Array.isArray(compareAbstracts) || compareAbstracts.length === 0) {
    return res.status(400).json({ error: 'Eksik veri' });
  }

  const prompt = buildPrompt(myAbstract, compareAbstracts); // dışarıda tanımlanmalı

  try {
    const response = await axios.post('http://localhost:11434/api/generate', {
      model: "llama3",
      prompt,
      stream: false
    });

    const output = response.data.response;
    
    // ✔️ LLaMA başarılı çalıştıysa logla
    console.log("[LLaMA] Model başarıyla cevap verdi.");
    
    res.json({ result: output });

  } catch (error) {
    // ❌ HATA: LLaMA başarısız olduysa detaylı logla
    console.error("[LLaMA HATASI] Modelden yanıt alınamadı!");
    console.error("Hata Detayı:", error.message || error);

    // Basit fallback üret
    const simpleComparison = generateSimpleComparison(myAbstract, compareAbstracts);
    res.json({ 
      result: simpleComparison,
      warning: 'LLaMA yanıt veremedi, basit karşılaştırma yapıldı.'
    });
  }
});
// utils/buildPrompt.js
function buildPrompt(myAbstract, articles) {
  return `Özet: ${myAbstract} \n\nKarşılaştırılacak Makaleler: ${articles.join('\n')}`;
}

module.exports = buildPrompt;


// Basit karşılaştırma fonksiyonu
function generateSimpleComparison(myAbstract, compareAbstracts) {
  let comparison = `This study focuses on ${extractMainTopic(myAbstract)}.\n\n`;

  comparison += "Comparison with related studies:\n\n";

  compareAbstracts.forEach((abstract, index) => {
    const refNum = index + 1;
    comparison += `Study [${refNum}] focuses on ${extractMainTopic(abstract)}. `;
    comparison += `Unlike our work, this study emphasizes different aspects of the problem domain.\n\n`;
  });

  comparison += "The key contribution of our work lies in its unique approach to the problem, ";
  comparison += "which differentiates it from the existing literature mentioned above.";

  return comparison;
}

// Basit konu çıkarma
function extractMainTopic(abstract) {
  const keywords = abstract.toLowerCase().match(/\b(system|application|method|approach|algorithm|model|framework|technology|blockchain|archival|proofpoint)\b/g);
  return keywords ? keywords[0] : "the proposed solution";
}

// Karşılaştırma sayfası
app.get('/compare', (req, res) => {
  res.render('compare/compare', { title: 'Abstract Karşılaştırması' });
});

// Sunucuyu başlat
app.listen(port, () => {
  console.log(`Sunucu http://localhost:${port} adresinde çalışıyor.`);
  // Sunucu başlatmadan önce LLaMA testi
axios.post('http://localhost:11434/api/generate', {
  model: "llama3",
  prompt: "Ping",
  stream: false
}).then(() => {
  console.log("✅ LLaMA servisi aktif.");
}).catch(() => {
  console.error("❌ LLaMA servisine bağlanılamıyor! 'localhost:11434' çalışıyor mu?");
});

});

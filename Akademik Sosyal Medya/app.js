// Environment variables'ı yükle
require('dotenv').config();

const express = require('express');
const path = require('path');
const axios = require('axios');
const { URL } = require('url');

const app = express();

// Environment variables'dan al veya default değerler kullan
const port = process.env.PORT || 3000;
const apiKey = process.env.SERPAPI_KEY || '23eb2da7d73a45b970d593b487ac29c1e864bdb50dcf2286489aa34a9c35a440';
const huggingFaceApiKey = process.env.HUGGINGFACE_API_KEY || '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';

// API anahtarlarının varlığını kontrol et
if (!apiKey || !huggingFaceApiKey) {
  console.error('API anahtarları eksik! .env dosyasını kontrol edin.');
  process.exit(1);
}

// Middleware
app.use(express.json()); // JSON body verilerini alabilmek için gerekli
app.use(express.static(path.join(__dirname, 'public'))); // Statik dosya servisi

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

// Abstract karşılaştırma route
app.post('/compare-abstracts', async (req, res) => {
  const { myAbstract, compareAbstracts } = req.body;

  if (!myAbstract || !Array.isArray(compareAbstracts) || compareAbstracts.length === 0) {
    return res.status(400).json({ error: 'Eksik veri' });
  }

  // Daha detaylı prompt hazırla
  const prompt = `For a literature review chapter I need to compare my study with the other studies. If there are similar works in the related studies, you can group them and compare with my work as a group. In the text please give the reference numbers in brackets.

My paper's abstract:
${myAbstract}

The abstracts for the other studies are given below with a reference number:
${compareAbstracts.map((abs, i) => `[${i + 1}] ${abs}`).join('\n\n')}

Please provide a detailed comparison highlighting similarities, differences, and unique contributions of my work compared to the related studies.`;

  try {
    // Text generation için Hugging Face API kullan
    const response = await axios.post(
      'https://api-inference.huggingface.co/models/facebook/bart-large-cnn',
      { 
        inputs: prompt,
        parameters: {
          max_length: 1000,
          min_length: 100,
          do_sample: true,
          temperature: 0.7
        }
      },
      {
        headers: {
          Authorization: `Bearer ${huggingFaceApiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log("HF Cevap:", response.data);

    // Cevabı işle
    let result = '';
    if (Array.isArray(response.data) && response.data.length > 0) {
      result = response.data[0]?.summary_text || response.data[0]?.generated_text || 'Model cevap döndüremedi.';
    } else {
      result = 'Model cevap döndüremedi.';
    }

    res.json({ result });

  } catch (error) {
    console.error("Hugging Face API hatası:", error.response?.data || error.message);
    
    // Hata durumunda basit bir karşılaştırma yap
    const simpleComparison = generateSimpleComparison(myAbstract, compareAbstracts);
    res.json({ 
      result: simpleComparison,
      warning: 'AI model kullanılamadı, basit karşılaştırma yapıldı.'
    });
  }
});

// Basit karşılaştırma fonksiyonu (fallback)
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

// Basit konu çıkarma fonksiyonu
function extractMainTopic(abstract) {
  const keywords = abstract.toLowerCase().match(/\b(system|application|method|approach|algorithm|model|framework|technology|blockchain|archival|proofpoint)\b/g);
  return keywords ? keywords[0] : "the proposed solution";
}

// Karşılaştırma sayfası route
app.get('/compare', (req, res) => {
  res.render('compare/compare', { title: 'Abstract Karşılaştırması' });
});

// Sunucuyu başlat
app.listen(port, () => {
  console.log(`Sunucu http://localhost:${port} adresinde çalışıyor.`);
  console.log(`Ana sayfa: http://localhost:${port}`);
  console.log(`Karşılaştırma sayfası: http://localhost:${port}/compare`);
});
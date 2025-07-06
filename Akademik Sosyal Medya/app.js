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


// Google Scholar makale detay sayfasından abstract çekme

const puppeteer = require('puppeteer');

const cheerio = require('cheerio');

// Method 1: Puppeteer ile JavaScript render edilen sayfa scraping
async function getAbstractWithPuppeteer(url) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // User-Agent ayarla (bot detection'dan kaçınmak için)
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Sayfaya git
    await page.goto(url, { waitUntil: 'networkidle0' });
    
    // Abstract bölümünü bekle ve çek
    const abstract = await page.evaluate(() => {
      // Açıklama alanını bul
      const abstractElement = document.querySelector('div[data-sh="true"]') || 
                             document.querySelector('.gsh_csp') ||
                             document.querySelector('#gsc_oci_merged_snippet');
      
      if (abstractElement) {
        return abstractElement.innerText.trim();
      }
      
      // Alternatif selector'lar
      const altSelectors = [
        'div[id*="snippet"]',
        'div[class*="snippet"]',
        'div[class*="abstract"]',
        '.gsh_small'
      ];
      
      for (const selector of altSelectors) {
        const element = document.querySelector(selector);
        if (element && element.innerText.length > 100) {
          return element.innerText.trim();
        }
      }
      
      return null;
    });
    
    return abstract;
    
  } catch (error) {
    console.error('Puppeteer hatası:', error);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Method 2: Axios + Cheerio ile basit scraping (JavaScript olmayan kısımlar için)
async function getAbstractWithAxios(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.8,en-US;q=0.5,en;q=0.3',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    
    // Farklı selector'ları dene
    const possibleSelectors = [
      'div[data-sh="true"]',
      '.gsh_csp',
      '#gsc_oci_merged_snippet',
      'div[id*="snippet"]',
      'div[class*="snippet"]',
      '.gsh_small'
    ];
    
    for (const selector of possibleSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        const text = element.text().trim();
        if (text.length > 50) { // Minimum uzunluk kontrolü
          return text;
        }
      }
    }
    
    return null;
    
  } catch (error) {
    console.error('Axios scraping hatası:', error);
    return null;
  }
}

// Method 3: SerpAPI ile Google Scholar makale detayı çekme
async function getAbstractWithSerpAPI(citationId) {
  try {
    const response = await axios.get('https://serpapi.com/search.json', {
      params: {
        engine: 'google_scholar_cite',
        q: citationId,
        api_key: process.env.SERPAPI_KEY
      }
    });
    
    // SerpAPI'den gelen veriyi kontrol et
    if (response.data && response.data.citations) {
      // Abstract bilgisini bul
      const abstract = response.data.snippet || response.data.abstract;
      return abstract;
    }
    
    return null;
    
  } catch (error) {
    console.error('SerpAPI hatası:', error);
    return null;
  }
}

// Ana fonksiyon: Önce basit yöntem, sonra Puppeteer
async function getArticleAbstract(url) {
  console.log(`Abstract çekiliyor: ${url}`);
  
  // Önce basit yöntem dene
  let abstract = await getAbstractWithAxios(url);
  
  if (!abstract) {
    console.log('Basit yöntem başarısız, Puppeteer deneniyor...');
    abstract = await getAbstractWithPuppeteer(url);
  }
  
  if (abstract) {
    console.log('Abstract başarıyla çekildi');
    return abstract;
  } else {
    console.log('Abstract çekilemedi');
    return null;
  }
}

// Express route'unuzda kullanım
app.get('/get-abstract', async (req, res) => {
  const url = req.query.url;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parametresi gerekli' });
  }
  
  // URL'nin Google Scholar olduğunu kontrol et
  if (!url.includes('scholar.google.com')) {
    return res.status(400).json({ error: 'Sadece Google Scholar linkleri desteklenir' });
  }
  
  try {
    const abstract = await getArticleAbstract(url);
    
    if (abstract) {
      res.json({ 
        success: true, 
        abstract: abstract,
        url: url
      });
    } else {
      res.json({ 
        success: false, 
        message: 'Abstract çekilemedi',
        url: url
      });
    }
    
  } catch (error) {
    console.error('Abstract çekme hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Mevcut author sayfanızdaki makaleler için abstract güncelleme
app.post('/update-abstracts', async (req, res) => {
  const { articles } = req.body;
  
  if (!Array.isArray(articles)) {
    return res.status(400).json({ error: 'Geçersiz makale listesi' });
  }
  
  const updatedArticles = [];
  
  for (const article of articles) {
    if (article.link) {
      try {
        const abstract = await getArticleAbstract(article.link);
        
        updatedArticles.push({
          ...article,
          abstract: abstract || article.abstract || 'Özet bilgisi çekilemedi'
        });
        
        // Rate limiting için bekle
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`Makale abstract hatası: ${article.title}`, error);
        updatedArticles.push({
          ...article,
          abstract: article.abstract || 'Özet bilgisi çekilemedi'
        });
      }
    } else {
      updatedArticles.push(article);
    }
  }
  
  res.json({ 
    success: true, 
    articles: updatedArticles,
    message: `${updatedArticles.length} makale işlendi`
  });
});

module.exports = {
  getArticleAbstract,
  getAbstractWithPuppeteer,
  getAbstractWithAxios
};

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
    return res.status(400).json({ error: 'Eksik veri: Abstract ve karşılaştırma metinleri gerekli' });
  }

  // Geliştirilmiş prompt oluştur
  const prompt = buildPrompt(myAbstract, compareAbstracts);

  try {
    const response = await axios.post('http://localhost:11434/api/generate', {
      model: "llama3",
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.7,
        top_k: 40,
        top_p: 0.9,
        repeat_penalty: 1.1,
        num_predict: 2000 // Daha uzun yanıt için
      }
    });

    const output = response.data.response;
    
    console.log("[LLaMA] Model başarıyla cevap verdi.");
    
    res.json({ 
      result: output,
      success: true,
      metadata: {
        comparedStudies: compareAbstracts.length,
        promptLength: prompt.length
      }
    });

  } catch (error) {
    console.error("[LLaMA HATASI] Modelden yanıt alınamadı!");
    console.error("Hata Detayı:", error.message || error);

    // Geliştirilmiş fallback
    const advancedComparison = generateAdvancedComparison(myAbstract, compareAbstracts);
    res.json({ 
      result: advancedComparison,
      success: false,
      warning: 'LLaMA yanıt veremedi, geliştirilmiş karşılaştırma yapıldı.'
    });
  }
});
function generateAdvancedComparison(myAbstract, compareAbstracts) {
  const myKeywords = extractKeywords(myAbstract);
  const myObjective = extractObjective(myAbstract);
  const myMethodology = extractMethodology(myAbstract);
  
  let comparison = `This study focuses on ${myObjective}, utilizing ${myMethodology} as the primary approach.\n\n`;

  // Çalışmaları grupla
  const groupedStudies = groupStudiesByTopic(compareAbstracts);

  comparison += "**Comparison with Related Studies:**\n\n";

  // Her grup için karşılaştırma
  Object.keys(groupedStudies).forEach(topic => {
    const studies = groupedStudies[topic];
    
    comparison += `**${topic} Studies:**\n`;
    comparison += `Studies ${studies.map(s => `[${s.index + 1}]`).join(', ')} focus on ${topic.toLowerCase()}. `;
    
    // Metodoloji karşılaştırması
    const methodologies = studies.map(s => extractMethodology(s.abstract));
    comparison += `These works primarily employ ${methodologies.join(', ')} methodologies. `;
    
    // Fark vurgusu
    comparison += `Unlike our blockchain-based approach, these studies concentrate on different aspects of the problem domain.\n\n`;
  });

  // Benzersiz katkı
  comparison += "**Unique Contribution:**\n";
  comparison += `The key contribution of this work lies in its novel application of ${myMethodology} for ${myObjective}. `;
  comparison += "While existing studies focus on document processing, retrieval, and classification, ";
  comparison += "our research addresses the fundamental challenge of ensuring data integrity and immutability in archival systems. ";
  comparison += "This represents a paradigm shift from improving document accessibility to guaranteeing long-term data authenticity.\n\n";

  // Uygulama alanları
  comparison += "**Application Domain Differences:**\n";
  comparison += "The application areas of existing studies primarily focus on improving document retrieval and classification efficiency. ";
  comparison += "In contrast, our study addresses a different problem space by providing a reliable and verifiable archival system, ";
  comparison += "making it particularly relevant in legal, journalistic, and governmental applications where data integrity is paramount.\n\n";

  comparison += "**Conclusion:**\n";
  comparison += "This research introduces blockchain as a novel solution in archival systems, filling a gap that previous studies have not addressed. ";
  comparison += "While existing works optimize document processing techniques, they do not ensure the immutability and authenticity of stored data. ";
  comparison += "Thus, this study represents a significant advancement in securing digital archives, complementing existing document processing techniques.";

  return comparison;
}

// Yardımcı fonksiyonlar
function extractKeywords(abstract) {
  const keywords = abstract.toLowerCase().match(/\b(blockchain|immutable|distributed|archival|system|application|security|integrity|verification|ledger|storage|technology)\b/g);
  return keywords ? [...new Set(keywords)] : [];
}

function extractObjective(abstract) {
  const objectivePatterns = [
    /develop\s+(.+?)\s+application/i,
    /primary\s+objective\s+.*?is\s+to\s+(.+?)\./i,
    /aims?\s+to\s+(.+?)\./i,
    /designed\s+to\s+(.+?)\./i
  ];
  
  for (const pattern of objectivePatterns) {
    const match = abstract.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  return "the proposed solution";
}

function extractMethodology(abstract) {
  const methodologies = {
    'blockchain': 'blockchain technology',
    'machine learning': 'machine learning',
    'deep learning': 'deep learning',
    'optical character recognition': 'OCR',
    'text mining': 'text mining',
    'pattern recognition': 'pattern recognition',
    'artificial intelligence': 'artificial intelligence',
    'distributed': 'distributed systems'
  };
  
  for (const [key, value] of Object.entries(methodologies)) {
    if (abstract.toLowerCase().includes(key)) {
      return value;
    }
  }
  return "computational methods";
}

function groupStudiesByTopic(abstracts) {
  const groups = {
    'Document Processing': [],
    'Image Classification': [],
    'Text Mining': [],
    'Information Retrieval': [],
    'Other': []
  };

  abstracts.forEach((abstract, index) => {
    const lowerAbstract = abstract.toLowerCase();
    
    if (lowerAbstract.includes('document') && (lowerAbstract.includes('classification') || lowerAbstract.includes('processing'))) {
      groups['Document Processing'].push({ abstract, index });
    } else if (lowerAbstract.includes('image') && lowerAbstract.includes('classification')) {
      groups['Image Classification'].push({ abstract, index });
    } else if (lowerAbstract.includes('text') && (lowerAbstract.includes('mining') || lowerAbstract.includes('search'))) {
      groups['Text Mining'].push({ abstract, index });
    } else if (lowerAbstract.includes('retrieval') || lowerAbstract.includes('search')) {
      groups['Information Retrieval'].push({ abstract, index });
    } else {
      groups['Other'].push({ abstract, index });
    }
  });

  // Boş grupları kaldır
  Object.keys(groups).forEach(key => {
    if (groups[key].length === 0) {
      delete groups[key];
    }
  });

  return groups;
}

// Template karşılaştırma fonksiyonu (örnekteki gibi)
function generateTemplateComparison(myAbstract, compareAbstracts) {
  const template = `
This study focuses on the development of the ProofPoint application, which leverages blockchain technology to ensure the immutable and distributed storage of information. The primary contribution of your work lies in the application of blockchain for archival purposes, ensuring data integrity, security, and verifiability.

**Comparison with Studies on Document Image Processing**

Document image processing has been extensively studied to improve access, retrieval, and classification of digital archives. Various methodologies have been proposed to enhance the efficiency of document management systems.

Studies ${compareAbstracts.map((_, i) => `[${i + 1}]`).join(', ')} primarily focus on document image processing, retrieval, and classification. While these works contribute significantly to the field of digital archives, they primarily employ techniques such as Optical Character Recognition (OCR), text-based search, and deep learning-based classification.

Unlike these studies, your work does not focus on extracting, classifying, or searching document images but rather on ensuring the immutability and verifiability of stored information using blockchain technology. This represents a fundamental difference in approach: whereas prior studies aim to enhance document retrieval and classification efficiency, your study ensures the long-term integrity and authenticity of archived data.

**Security and Data Integrity Considerations**

Ensuring data security and integrity is a crucial challenge in digital archiving. The risk of data tampering, loss, or unauthorized modifications necessitates robust solutions for preserving the authenticity of stored information.

Your study emphasizes the security, integrity, and unalterability of archived information, leveraging blockchain as a means to prevent data manipulation.

Studies such as ${compareAbstracts.map((_, i) => `[${i + 1}]`).join(', ')} do not address issues of tamper-proof storage but rather focus on document access, classification, and searchability.

Your study contributes by ensuring that archived documents cannot be altered post-entry, which is critical in preventing misinformation and legal disputes.

**Application Domain Differences**

Different application domains demand distinct approaches to document management, whether through classification, retrieval, or security mechanisms. Understanding these differences is key to identifying the unique value of blockchain-based archival systems.

The application areas of existing studies primarily focus on improving document retrieval, classification, and workflow efficiency.

In contrast, your study addresses a different problem space by providing a reliable and verifiable archival system, making it particularly relevant in legal, journalistic, and governmental applications where data integrity is paramount.

**Conclusion**

Your research introduces blockchain as a novel solution in archival systems, filling a gap that previous studies have not addressed. While existing works optimize document retrieval and classification, they do not ensure the immutability and authenticity of stored data. Thus, your study represents a significant advancement in securing digital archives, complementing existing document processing techniques.
  `;

  return template;
}

module.exports = {
  buildPrompt,
  generateAdvancedComparison,
  generateTemplateComparison,
  extractKeywords,
  extractObjective,
  extractMethodology,
  groupStudiesByTopic
};
function buildPrompt(myAbstract, compareAbstracts) {
  const prompt = `
You are an academic researcher writing a literature review chapter. You need to compare the given study with other related studies in a comprehensive and professional manner.

INSTRUCTIONS:
1. Write a detailed comparison highlighting similarities and differences
2. Group similar studies together when appropriate
3. Use reference numbers in brackets [1], [2], etc.
4. Write in academic style with proper transitions
5. Focus on methodology, objectives, and contributions
6. Highlight the unique aspects of the main study
7. Structure the comparison into logical sections (methodology, objectives, applications, etc.)

MY STUDY'S ABSTRACT:
${myAbstract}

RELATED STUDIES TO COMPARE:
${compareAbstracts.map((abstract, index) => `[${index + 1}] ${abstract}`).join('\n\n')}

Please provide a comprehensive literature review comparison that:
- Identifies the main focus and contribution of my study
- Groups related studies by their approach or methodology
- Compares and contrasts the objectives and methods
- Highlights the unique value proposition of my work
- Discusses application domains and their differences
- Concludes with the significance of my contribution

Write the comparison in academic English, suitable for a literature review chapter.
`;

  return prompt;
}


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

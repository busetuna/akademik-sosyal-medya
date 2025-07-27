const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

// ✅ PDF'ten abstract çıkarma (geliştirilmiş)
function extractAbstract(text) {
  console.log('📄 PDF text uzunluğu:', text?.length);
  
  if (!text || typeof text !== 'string') {
    console.error('❌ Geçersiz text parametresi:', typeof text);
    return null;
  }

  const cleanText = text.replace(/\s+/g, ' ').trim();
  const lower = cleanText.toLowerCase();
  
  // Farklı abstract başlık varyasyonları
  const abstractPatterns = [
    /\babstract\b/i,
    /\bözet\b/i,
    /\bsummary\b/i,
    /\bresume\b/i
  ];
  
  let abstractStart = -1;
  let usedPattern = null;
  
  // İlk bulunan pattern'i kullan
  for (const pattern of abstractPatterns) {
    const match = lower.search(pattern);
    if (match !== -1) {
      abstractStart = match;
      usedPattern = pattern;
      break;
    }
  }
  
  if (abstractStart === -1) {
    console.warn('⚠️ Abstract başlığı bulunamadı');
    return null;
  }
  
  console.log('✅ Abstract başlangıcı bulundu:', usedPattern, 'pozisyon:', abstractStart);
  
  // Abstract'ın başlangıcından sonraki kısmı al
  const fromAbstract = cleanText.slice(abstractStart);
  
  // Abstract'ın bittiği yeri bul
  const endPatterns = [
    /\b(?:introduction|1\.|keywords|key words|özet|giriş|anahtar kelimeler|methodology|method|background)\b/i,
    /\n\s*\n/,  // İki satır arası
    /\.(\s*[A-Z]){2,}/ // Nokta ve ardından büyük harflerle başlayan kelimeler
  ];
  
  let abstractEnd = fromAbstract.length;
  let endReason = 'end_of_text';
  
  for (const pattern of endPatterns) {
    const match = fromAbstract.search(pattern);
    if (match !== -1 && match > 50 && match < abstractEnd) { // En az 50 karakter olmalı
      abstractEnd = match;
      endReason = pattern.toString();
      break;
    }
  }
  
  let extracted = fromAbstract.slice(0, abstractEnd).trim();
  
  // "Abstract" kelimesini baştan çıkar
  extracted = extracted.replace(/^(abstract|özet|summary|resume)\s*:?\s*/i, '');
  
  // Minimum uzunluk kontrolü
  if (extracted.length < 50) {
    console.warn('⚠️ Çıkarılan abstract çok kısa:', extracted.length, 'karakter');
    return null;
  }
  
  // Maksimum uzunluk sınırı
  if (extracted.length > 3000) {
    extracted = extracted.slice(0, 3000) + '...';
    console.warn('⚠️ Abstract kesildi, çok uzun');
  }
  
  console.log('✅ Abstract çıkarıldı:', extracted.length, 'karakter');
  console.log('📄 İlk 100 karakter:', extracted.substring(0, 100) + '...');
  
  return extracted;
}

// ✅ URL'den abstract çekme (geliştirilmiş)
async function getAbstractFromUrl(url) {
  console.log('🔗 URL\'den abstract çekiliyor:', url);
  
  if (!url || typeof url !== 'string' || !isValidUrl(url)) {
    console.error('❌ Geçersiz URL:', url);
    return null;
  }
  
  // Önce axios ile dene
  let abstract = await getAbstractWithAxios(url);
  
  if (!abstract) {
    console.log('⚠️ Axios başarısız, Puppeteer deneniyor...');
    abstract = await getAbstractWithPuppeteer(url);
  }
  
  if (!abstract) {
    console.error('❌ Her iki yöntem de başarısız oldu');
    return null;
  }
  
  return validateAndCleanAbstract(abstract);
}

// ✅ Axios ile abstract çekme (iyileştirilmiş)
async function getAbstractWithAxios(url) {
  try {
    console.log('📡 Axios ile istek gönderiliyor...');
    
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    
    if (!response.data) {
      console.error('❌ Boş response');
      return null;
    }
    
    const $ = cheerio.load(response.data);
    let abstract = null;
    
    // Farklı selector'ları dene
    const selectors = [
      'div.gs_rs',          // Google Scholar
      '.abstract',          // Genel abstract class
      '#abstract',          // Genel abstract id
      'div[class*="abstract"]', // Abstract içeren class'lar
      'p[class*="abstract"]',   // Abstract içeren p tag'ları
      '.description',       // Açıklama field'ları
      '.summary',           // Özet field'ları
      'meta[name="description"]', // Meta description
      'meta[property="og:description"]' // OpenGraph description
    ];
    
    for (const selector of selectors) {
      const element = $(selector);
      if (element.length > 0) {
        let text = '';
        
        if (selector.includes('meta')) {
          text = element.attr('content') || '';
        } else {
          text = element.text().trim();
        }
        
        if (text && text.length > 50) {
          abstract = text;
          console.log('✅ Abstract bulundu selector ile:', selector);
          break;
        }
      }
    }
    
    // Eğer hiçbir selector işe yaramazsa, sayfa içinde "abstract" ara
    if (!abstract) {
      const pageText = $('body').text().toLowerCase();
      const abstractIndex = pageText.indexOf('abstract');
      
      if (abstractIndex !== -1) {
        const afterAbstract = $('body').text().slice(abstractIndex, abstractIndex + 1000);
        abstract = afterAbstract.split(/introduction|keywords|method/i)[0];
        console.log('✅ Abstract sayfa taramasıyla bulundu');
      }
    }
    
    return abstract;
    
  } catch (error) {
    console.error('❌ Axios hatası:', error.message);
    return null;
  }
}

// ✅ Puppeteer ile abstract çekme (iyileştirilmiş)
async function getAbstractWithPuppeteer(url) {
  let browser = null;
  
  try {
    console.log('🚀 Puppeteer başlatılıyor...');
    
    browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    const page = await browser.newPage();
    
    // User agent ayarla
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Viewport ayarla
    await page.setViewport({ width: 1920, height: 1080 });
    
    console.log('📄 Sayfa yükleniyor...');
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const abstract = await page.evaluate(() => {
      // Farklı selector'ları dene
      const selectors = [
        'div.gs_rs',
        '.abstract',
        '#abstract',
        'div[class*="abstract"]',
        'p[class*="abstract"]',
        '.description',
        '.summary'
      ];
      
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && element.innerText.trim().length > 50) {
          return element.innerText.trim();
        }
      }
      
      // Metin içinde "abstract" ara
      const bodyText = document.body.innerText.toLowerCase();
      const abstractIndex = bodyText.indexOf('abstract');
      
      if (abstractIndex !== -1) {
        const afterAbstract = document.body.innerText.slice(abstractIndex, abstractIndex + 1000);
        return afterAbstract.split(/introduction|keywords|method/i)[0];
      }
      
      return null;
    });
    
    console.log('✅ Puppeteer ile abstract alındı');
    return abstract;
    
  } catch (error) {
    console.error('❌ Puppeteer hatası:', error.message);
    return null;
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔒 Puppeteer kapatıldı');
    }
  }
}

// ✅ Abstract doğrulama ve temizleme
function validateAndCleanAbstract(abstract) {
  if (!abstract || typeof abstract !== 'string') {
    console.error('❌ Geçersiz abstract tipi:', typeof abstract);
    return null;
  }
  
  // Temizleme işlemleri
  let cleaned = abstract
    .replace(/\s+/g, ' ')           // Fazla boşlukları tek boşluğa çevir
    .replace(/\n+/g, ' ')           // Satır başlarını boşluğa çevir
    .replace(/\t+/g, ' ')           // Tab'ları boşluğa çevir
    .replace(/[^\w\s.,;:!?()-]/g, '') // Özel karakterleri temizle
    .trim();
  
  // "Abstract" kelimesini baştan çıkar
  cleaned = cleaned.replace(/^(abstract|özet|summary|resume)\s*:?\s*/i, '');
  
  // Minimum uzunluk kontrolü
  if (cleaned.length < 30) {
    console.warn('⚠️ Abstract çok kısa:', cleaned.length, 'karakter');
    return null;
  }
  
  // Maksimum uzunluk kontrolü
  if (cleaned.length > 2000) {
    console.warn('⚠️ Abstract çok uzun, kesiliyor');
    cleaned = cleaned.substring(0, 2000) + '...';
  }
  
  console.log('✅ Abstract doğrulandı ve temizlendi:', cleaned.length, 'karakter');
  return cleaned;
}

// ✅ URL doğrulama
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

// ✅ Batch abstract çekme (birden fazla URL için)
async function extractMultipleAbstracts(sources) {
  console.log('📚 Toplu abstract çekme başlıyor:', sources.length, 'kaynak');
  
  if (!Array.isArray(sources)) {
    console.error('❌ Kaynaklar array olmalı');
    return [];
  }
  
  const results = [];
  
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    console.log(`\n📖 ${i + 1}/${sources.length} işleniyor...`);
    
    let abstract = null;
    
    try {
      if (typeof source === 'string') {
        // URL ise
        if (isValidUrl(source)) {
          abstract = await getAbstractFromUrl(source);
        } 
        // Düz metin ise
        else {
          abstract = validateAndCleanAbstract(source);
        }
      } 
      // Object ise (PDF text, title vs.)
      else if (source && typeof source === 'object') {
        if (source.text) {
          abstract = extractAbstract(source.text);
        } else if (source.url) {
          abstract = await getAbstractFromUrl(source.url);
        } else if (source.content) {
          abstract = validateAndCleanAbstract(source.content);
        }
      }
      
      if (abstract) {
        results.push({
          index: i,
          abstract: abstract,
          source: typeof source === 'string' ? source : source.url || 'unknown',
          length: abstract.length,
          success: true
        });
        console.log(`✅ ${i + 1}. abstract başarılı:`, abstract.length, 'karakter');
      } else {
        results.push({
          index: i,
          abstract: null,
          source: typeof source === 'string' ? source : source.url || 'unknown',
          length: 0,
          success: false,
          error: 'Abstract çıkarılamadı'
        });
        console.log(`❌ ${i + 1}. abstract başarısız`);
      }
      
    } catch (error) {
      console.error(`❌ ${i + 1}. abstract işlenirken hata:`, error.message);
      results.push({
        index: i,
        abstract: null,
        source: typeof source === 'string' ? source : 'unknown',
        length: 0,
        success: false,
        error: error.message
      });
    }
    
    // Rate limiting - istekler arası bekleme
    if (i < sources.length - 1) {
      console.log('⏳ Rate limiting - 2 saniye bekleme...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  console.log(`\n📊 Toplu işlem tamamlandı: ${successCount}/${sources.length} başarılı`);
  
  return results;
}

// ✅ Debug fonksiyonu
function debugAbstractExtraction(text, options = {}) {
  console.log('\n🔍 DEBUG: Abstract Extraction');
  console.log('─'.repeat(50));
  console.log('Input type:', typeof text);
  console.log('Input length:', text?.length);
  console.log('First 200 chars:', text?.substring(0, 200));
  
  if (options.showPatterns) {
    const lower = text.toLowerCase();
    console.log('\nPattern matches:');
    console.log('- "abstract":', lower.indexOf('abstract'));
    console.log('- "özet":', lower.indexOf('özet'));
    console.log('- "summary":', lower.indexOf('summary'));
  }
  
  const result = extractAbstract(text);
  console.log('\nExtraction result:', result ? 'SUCCESS' : 'FAILED');
  console.log('Result length:', result?.length);
  console.log('Result preview:', result?.substring(0, 100));
  console.log('─'.repeat(50));
  
  return result;
}

module.exports = {
  extractAbstract,
  getAbstractFromUrl,
  getAbstractWithAxios,
  getAbstractWithPuppeteer,
  validateAndCleanAbstract,
  extractMultipleAbstracts,
  debugAbstractExtraction,
  isValidUrl
};
// utils/extractAbstract.js

const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

// ✅ PDF'ten plain text ile abstract ayıklamak için (yüklenen dosyalar için)
function extractAbstract(text) {
  const lower = text.toLowerCase();
  const start = lower.indexOf('abstract');
  if (start === -1) return 'Abstract bulunamadı.';

  const sliced = text.slice(start, start + 2000); // ilk 2000 karakteri al
  const endMatch = sliced.match(/(introduction|1\.|keywords|özet)/i);
  return endMatch ? sliced.slice(0, endMatch.index) : sliced;
}

// ✅ Google Scholar gibi sayfalardan axios ile abstract çekmeye çalış
async function getAbstractWithAxios(url) {
  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const text = $('div.gs_rs').text().trim(); // genelde abstract'lar bu class içinde oluyor
    return text || null;
  } catch (err) {
    console.error('[Axios Abstract] Hata:', err);
    return null;
  }
}

// ✅ Eğer axios başarısız olursa, Puppeteer ile çekmeye çalış
async function getAbstractWithPuppeteer(url) {
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });

    const abstract = await page.evaluate(() => {
      const el = document.querySelector('div.gs_rs');
      return el ? el.innerText.trim() : null;
    });

    await browser.close();
    return abstract;
  } catch (err) {
    console.error('[Puppeteer Abstract] Hata:', err);
    return null;
  }
}

// ✅ Tüm fonksiyonları dışa aktar
module.exports = {
  extractAbstract,
  getAbstractWithAxios,
  getAbstractWithPuppeteer
};

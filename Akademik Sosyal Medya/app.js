require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// EJS Ayarları
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Route'lar
const authorRoutes = require('./routes/author');
const scholarRoutes = require('./routes/api/scholar');
const compareRoutes = require('./routes/api/compare');
const uploadRoutes = require('./routes/upload');
// app.use('/api', uploadRoutes);
// app.use('/api/upload', uploadRoutes);

app.use('/', authorRoutes);
app.use('/upload', uploadRoutes);
app.use('/api/scholar', scholarRoutes);
app.use('/compare', compareRoutes); //bunu ya da alttaki api/compare'ı dene. bot zannetti beni yine.
//app.use('/api/compare', compareRoutes);


// LLaMA bağlantı kontrolü (başlangıçta sadece bilgi amaçlı)
const { LLAMA_API_URL } = require('./config/constants');
axios.post(LLAMA_API_URL, {
  model: "llama3",
  prompt: "Ping",
  stream: false
}).then(() => {
  console.log("✅ LLaMA servisi aktif.");
}).catch(() => {
  console.error("❌ LLaMA servisine bağlanılamıyor! 'localhost:11434' çalışıyor mu?");
});

// 404 Hatası
app.use((req, res) => {
  res.status(404).send('Sayfa bulunamadı.');
});

app.use((err, req, res, next) => {
  console.error('🔥 Sunucu Hatası:', err);
  res.status(500).send('Sunucu hatası!');
});

app.use('/upload', (req, res, next) => {
  console.log(">>> /upload isteği geldi");
  next();
});

// Sunucuyu başlat
app.listen(port, () => {
  console.log(`🚀 Sunucu http://localhost:${port} adresinde çalışıyor.`);
});

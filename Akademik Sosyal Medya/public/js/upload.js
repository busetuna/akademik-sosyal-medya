document.getElementById('uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const form = e.target;
  const fileInput = document.getElementById('pdfFile');
  const resultDiv = document.getElementById('result');
  const loadingDiv = document.getElementById('loading');
  
  if (fileInput.files.length === 0) return;
  
  // Loading göster
  loadingDiv.classList.remove('hidden');
  resultDiv.classList.add('hidden');
  
  try {
    const formData = new FormData(form);
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    // Sonuçları göster
    document.getElementById('abstractContent').textContent = data.abstract;
    resultDiv.classList.remove('hidden');
    
    // Abstract'i session storage'a kaydet
    sessionStorage.setItem('currentAbstract', data.abstract);
    
  } catch (error) {
    alert(`Hata: ${error.message}`);
  } finally {
    loadingDiv.classList.add('hidden');
  }
});

// Karşılaştırma butonu
document.getElementById('compareBtn').addEventListener('click', () => {
  window.location.href = '/compare';
});
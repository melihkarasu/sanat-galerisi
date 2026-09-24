// Global Sanat Galerisi - Standalone Sürüm (The Met Museum API Direct)
const STORAGE_KEY = 'sanat_gallery_v1';
let currentArtworks = [];
let currentModalArt = null;
let currentZoom = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let startX = 0;
let startY = 0;

// 1. Eserleri Getir (The Met API - Direct)
async function fetchArtworks(query, type = 'artist') {
  showLoading(true);
  const titleEl = document.getElementById('gallery-topic-title');
  if (titleEl) titleEl.innerText = `"${query}" Seçkisi`;

  try {
    const searchUrl = `https://collectionapi.metmuseum.org/public/collection/v1/search?q=${encodeURIComponent(query)}&hasImages=true`;
    const sRes = await fetch(searchUrl);
    const sData = await sRes.json();

    if (!sData.objectIDs || sData.objectIDs.length === 0) {
      renderArtworks([]);
      return;
    }

    // En iyi ilk 16 eserin detaylarını çek
    const targetIds = sData.objectIDs.slice(0, 16);
    const detailed = await Promise.all(
      targetIds.map(async id => {
        try {
          const res = await fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
          if (!res.ok) return null;
          return await res.json();
        } catch(e) {
          return null;
        }
      })
    );

    const validArt = detailed.filter(item => item && (item.primaryImageSmall || item.primaryImage));
    currentArtworks = validArt;
    renderArtworks(validArt);
  } catch(err) {
    console.error(err);
    renderArtworks([]);
  }
}

function searchArt() {
  const input = document.getElementById('input-art-search');
  const q = input ? input.value.trim() : '';
  if (!q) return;
  fetchArtworks(q, 'keyword');
}

function showLoading(show) {
  const spinner = document.getElementById('loading-spinner');
  const grid = document.getElementById('artworks-grid');
  const emptyEl = document.getElementById('empty-state');
  const countEl = document.getElementById('results-count');
  
  if (!spinner) return;
  
  if (show) {
    spinner.className = 'py-16 text-center text-mistral-slate text-sm flex flex-col items-center gap-3';
    if (grid) grid.innerHTML = '';
    if (emptyEl) emptyEl.classList.add('hidden');
    if (countEl) countEl.innerText = 'Arşiv taranıyor...';
  } else {
    spinner.className = 'hidden';
  }
}

// 2. Eser Kartlarını Çiz
function renderArtworks(list) {
  showLoading(false);
  const grid = document.getElementById('artworks-grid');
  const countEl = document.getElementById('results-count');
  const emptyEl = document.getElementById('empty-state');

  if (!list || list.length === 0) {
    if (grid) grid.innerHTML = '';
    if (countEl) countEl.innerText = '0 eser bulundu';
    if (emptyEl) emptyEl.classList.remove('hidden');
    return;
  }

  if (emptyEl) emptyEl.classList.add('hidden');
  if (countEl) countEl.innerText = `${list.length} başyapıt sergileniyor`;

  if (grid) {
    grid.innerHTML = list.map(item => {
      const img = item.primaryImageSmall || item.primaryImage;
      const artist = item.artistDisplayName || 'Anonim Sanatçı';
      const date = item.objectDate || '';

      return `
        <div class="art-card p-4 rounded-3xl bg-white border border-mistral-hairline hover:border-purple-500/50 transition-all duration-300 shadow-xl flex flex-col justify-between group">
          <div class="cursor-pointer" onclick="openDeepZoomModal(${item.objectID})">
            <div class="relative w-full aspect-[4/5] rounded-2xl overflow-hidden mb-3 bg-mistral-canvas shadow-md">
              <img src="${img}" alt="${item.title}" loading="lazy" class="w-full h-full object-cover transition-transform duration-500">
              <div class="absolute inset-0 bg-white from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition flex items-end p-3">
                <span class="text-white text-xs font-semibold flex items-center gap-1.5">
                  <span>🔍</span> Derin İncele
                </span>
              </div>
            </div>

            <h3 class="font-bold text-sm text-mistral-ink group-hover:text-purple-400 transition truncate">${item.title}</h3>
            <p class="text-xs text-purple-400/90 font-medium truncate mt-0.5">${artist}</p>
            <p class="text-[11px] text-mistral-slate font-mono mt-0.5 truncate">${date || item.medium || 'The Met'}</p>
          </div>

          <div class="pt-3 border-t border-mistral-hairline flex items-center justify-between mt-3">
            <button onclick="openDeepZoomModal(${item.objectID})" class="text-xs text-purple-400 hover:text-purple-300 font-semibold transition">
              Detayları Gör &rarr;
            </button>
            <button onclick="quickSaveArt(${item.objectID}, '${item.title.replace(/'/g, "\\'")}', '${artist.replace(/'/g, "\\'")}', '${img}', '${date}')" class="text-xs text-mistral-slate hover:text-amber-400 transition p-1" title="Koleksiyonuma Kaydet">
              🔖
            </button>
          </div>
        </div>
      `;
    }).join('');
  }
}

// 3. Derin Yakınlaştırma (Deep Zoom & Pan Modal)
async function openDeepZoomModal(id) {
  showToast('Eser ve yüksek çözünürlüklü detaylar yükleniyor...');
  try {
    let item = currentArtworks.find(a => a.objectID === id);
    if (!item) {
      const res = await fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
      item = await res.json();
    }

    if (!item) return;
    currentModalArt = item;

    const highResImg = item.primaryImage || item.primaryImageSmall;
    const modalImg = document.getElementById('modal-zoom-img');
    if (modalImg) modalImg.src = highResImg;

    const titleEl = document.getElementById('modal-art-title');
    const artistEl = document.getElementById('modal-art-artist');
    const dateEl = document.getElementById('modal-art-date');
    const mediumEl = document.getElementById('modal-art-medium');
    const dimsEl = document.getElementById('modal-art-dims');
    const linkEl = document.getElementById('modal-art-met-link');

    if (titleEl) titleEl.innerText = item.title;
    if (artistEl) artistEl.innerText = item.artistDisplayName || 'Anonim';
    if (dateEl) dateEl.innerText = item.objectDate || '';
    if (mediumEl) mediumEl.innerText = item.medium || 'Sanat Eseri';
    if (dimsEl) dimsEl.innerText = item.dimensions || '';
    if (linkEl) linkEl.href = item.objectURL || 'https://www.metmuseum.org';

    resetZoom();
    updateModalSaveButtonState();
    const modal = document.getElementById('zoom-modal');
    if (modal) modal.classList.remove('hidden');
  } catch(e) {
    console.error(e);
    showToast('Eser yüklenirken hata oluştu.');
  }
}

function closeZoomModal() {
  const modal = document.getElementById('zoom-modal');
  if (modal) modal.classList.add('hidden');
  currentModalArt = null;
}

function changeZoom(delta) {
  currentZoom = Math.min(4, Math.max(0.75, currentZoom + delta));
  updateTransform();
}

function resetZoom() {
  currentZoom = 1;
  panX = 0;
  panY = 0;
  updateTransform();
}

function updateTransform() {
  const img = document.getElementById('modal-zoom-img');
  if (img) img.style.transform = `translate(${panX}px, ${panY}px) scale(${currentZoom})`;
  const zoomText = document.getElementById('zoom-level-text');
  if (zoomText) zoomText.innerText = Math.round(currentZoom * 100) + '%';
}

function handleWheel(e) {
  e.preventDefault();
  const delta = e.deltaY < 0 ? 0.15 : -0.15;
  changeZoom(delta);
}

function startPan(e) {
  isPanning = true;
  startX = e.clientX - panX;
  startY = e.clientY - panY;
}

function doPan(e) {
  if (!isPanning) return;
  panX = e.clientX - startX;
  panY = e.clientY - startY;
  updateTransform();
}

function endPan() {
  isPanning = false;
}

// 4. Kişisel Sanat Koleksiyonum (LocalStorage)
function getSavedArt() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter(m => m && (m.title || m.artist)) : [];
  } catch(e) {
    return [];
  }
}

function quickSaveArt(id, title, artist, img, date) {
  let list = getSavedArt();
  const exists = list.some(m => m && m.id === id);

  if (exists) {
    list = list.filter(m => m && m.id !== id);
    showToast('Eser koleksiyondan çıkarıldı.');
  } else {
    list.unshift({ id, title, artist, img, date });
    showToast(`✓ "${title}" koleksiyonunuza kaydedildi!`);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  updateModalSaveButtonState();
  renderSavedArt();
}

function updateModalSaveButtonState() {
  if (!currentModalArt) return;
  const list = getSavedArt();
  const exists = list.some(m => m && m.id === currentModalArt.objectID);
  const icon = document.getElementById('modal-art-save-icon');
  const text = document.getElementById('modal-art-save-text');

  if (icon && text) {
    if (exists) {
      icon.innerText = '✓';
      text.innerText = 'Koleksiyonda Kayıtlı';
    } else {
      icon.innerText = '🔖';
      text.innerText = 'Koleksiyona Ekle';
    }
  }
}

function toggleModalSaved() {
  if (!currentModalArt) return;
  quickSaveArt(
    currentModalArt.objectID,
    currentModalArt.title,
    currentModalArt.artistDisplayName,
    currentModalArt.primaryImage || currentModalArt.primaryImageSmall,
    currentModalArt.objectDate
  );
}

function renderSavedArt() {
  const grid = document.getElementById('saved-art-grid');
  const empty = document.getElementById('saved-art-empty');
  if (!grid) return;
  const list = getSavedArt();

  if (list.length === 0) {
    grid.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    return;
  }

  if (empty) empty.classList.add('hidden');
  grid.innerHTML = list.map(m => `
    <div class="p-3 rounded-xl bg-white border border-mistral-hairline hover:border-purple-500/50 transition cursor-pointer flex flex-col justify-between" onclick="openDeepZoomModal(${m.id})">
      <div>
        <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-mistral-cream text-mistral-ink border border-mistral-beige-deep">${m.date || 'The Met'}</span>
        <h4 class="font-bold text-xs text-mistral-ink truncate mt-2 hover:text-purple-400">${m.title}</h4>
        <p class="text-[10px] text-mistral-slate truncate mt-0.5">${m.artist}</p>
      </div>
      <div class="pt-2 border-t border-mistral-hairline flex items-center justify-between mt-2.5 text-xs">
        <span class="text-purple-400 font-bold text-[10px]">🔍 Detay &rarr;</span>
        <button onclick="event.stopPropagation(); removeSavedArt(${m.id})" class="text-mistral-slate hover:text-rose-500 text-xs">✕</button>
      </div>
    </div>
  `).join('');
}

function removeSavedArt(id) {
  if (!id) return;
  let list = getSavedArt();
  list = list.filter(m => m && m.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  updateModalSaveButtonState();
  renderSavedArt();
}

function clearAllSavedArt() {
  if (!confirm('Koleksiyonunuzdaki tüm kayıtları silmek istediğinize emin misiniz?')) return;
  localStorage.removeItem(STORAGE_KEY);
  updateModalSaveButtonState();
  renderSavedArt();
  showToast('Koleksiyon temizlendi.');
}

function showToast(msg) {
  const toast = document.getElementById('sanat-toast');
  if (!toast) return;
  toast.innerText = msg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3500);
}

document.addEventListener('DOMContentLoaded', () => {
  renderSavedArt();
  fetchArtworks('Van Gogh', 'artist');
});

// Window globals for inline onclicks
window.fetchArtworks = fetchArtworks;
window.searchArt = searchArt;
window.openDeepZoomModal = openDeepZoomModal;
window.closeZoomModal = closeZoomModal;
window.changeZoom = changeZoom;
window.resetZoom = resetZoom;
window.handleWheel = handleWheel;
window.startPan = startPan;
window.doPan = doPan;
window.endPan = endPan;
window.quickSaveArt = quickSaveArt;
window.toggleModalSaved = toggleModalSaved;
window.renderSavedArt = renderSavedArt;
window.removeSavedArt = removeSavedArt;
window.clearAllSavedArt = clearAllSavedArt;

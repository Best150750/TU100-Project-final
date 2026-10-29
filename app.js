'use strict';

/* ============================================================
   1) ข้อมูลสถานที่
   แก้ชื่อ พิกัด หรือหมวดหมู่ของจุดต่าง ๆ ได้จากรายการนี้
   category ใช้ค่า motorcycle สำหรับวิน และ van สำหรับท่ารถตู้
   ============================================================ */
// พิกัดทั้งหมดเป็นข้อมูลที่ผู้พัฒนาให้มา ไม่ใช่ข้อมูลตำแหน่งรถแบบเรียลไทม์
const places = [
  { id: 1, name: 'หน้าท่ารถตู้', category: 'motorcycle', lat: 14.0673894, lng: 100.6080944 },
  { id: 2, name: 'ตึก SC (คณะวิทยาศาสตร์และเทคโนโลยี)', category: 'motorcycle', lat: 14.069334, lng: 100.604373 },
  { id: 3, name: 'กรีนแคนทีน (Green Canteen)', category: 'motorcycle', lat: 14.072941, lng: 100.601140 },
  { id: 4, name: 'หอในโซน C', category: 'motorcycle', lat: 14.076438, lng: 100.596649 },
  { id: 5, name: 'ตรงข้าม HOW', category: 'motorcycle', lat: 14.0757640, lng: 100.6014810 },
  { id: 6, name: 'หน้ารพ.ธรรมศาสตร์', category: 'motorcycle', lat: 14.074546, lng: 100.616276 },
  { id: 7, name: 'หน้าคณะแพทย์', category: 'motorcycle', lat: 14.072143, lng: 100.613329 },
  { id: 8, name: 'หอในโซน B', category: 'motorcycle', lat: 14.077262, lng: 100.595160 },
  { id: 9, name: 'ตรงข้าม บร.4 (อาคารบรรยายรวม 4)', category: 'motorcycle', lat: 14.072046, lng: 100.608037 },
  { id: 10, name: 'สะพานข้าม TU Dome', category: 'motorcycle', lat: 14.066071, lng: 100.600375 },
  { id: 11, name: 'ประตูเชียงราก 1 (รังสิต 2)', category: 'motorcycle', lat: 14.066066, lng: 100.60498 },
  { id: 12, name: 'ธรรมศาสตร์รังสิต - อนุสาวรีย์ชัยสมรภูมิ', category: 'van', lat: 14.0671374, lng: 100.6080639 }
];

/* 2) ข้อมูลแสดงผลของแต่ละหมวดหมู่: ชื่อ ไอคอน และสี */
const categoryInfo = {
  motorcycle: { label: 'วินมอไซค์', icon: '🛵', color: '#ed3157' },
  van: { label: 'ท่ารถตู้', icon: '🚐', color: '#2878e8' }
};
/* 3) ค่าตั้งต้นของแผนที่และตัวแปรที่ใช้ร่วมกัน */
const campusCenter = [14.0718, 100.6058];
let activeFilter = 'all';
let selectedId = null;
let userMarker = null;
let userAccuracy = null;
// เก็บพิกัดล่าสุดจาก GPS เพื่อส่งตำแหน่งต้นทางที่ถูกต้องไปยัง Google Maps
let currentUserPosition = null;
let watchId = null;
let toastTimer = null;
const markerById = new Map();

// ตัวช่วยเลือก element ในหน้าเว็บด้วย CSS selector
const $ = (selector) => document.querySelector(selector);

/* 4) สร้างแผนที่ Leaflet และโหลดแผนที่พื้นหลังจาก OpenStreetMap */
const map = L.map('map', { zoomControl: false, preferCanvas: true }).setView(campusCenter, 16);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'
}).addTo(map);
L.control.zoom({ position: 'bottomright' }).addTo(map);

/* 5) สร้างหมุดแบบกำหนดดีไซน์เอง
   เปลี่ยน HTML ในส่วนนี้ได้ หากอยากเปลี่ยนไอคอนหรือรูปทรงหมุด */
function makeIcon(place) {
  const cls = place.category === 'van' ? 'van' : 'motorcycle';
  const symbol = place.category === 'van' ? '🚐' : '🛵';
  return L.divIcon({
    className: 'custom-map-marker',
    html: `<div class="marker-pin ${cls}" aria-label="${escapeHtml(place.name)}"><span class="marker-emoji">${symbol}</span></div>`,
    iconSize: [42, 48],
    iconAnchor: [21, 43],
    popupAnchor: [0, -40]
  });
}

// ป้องกันอักขระพิเศษในชื่อสถานที่ไม่ให้กลายเป็น HTML
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

/* 6) เนื้อหากล่องข้อมูลที่แสดงเมื่อผู้ใช้กดหมุด */
function popupContent(place) {
  // ลิงก์จะคำนวณต้นทางใหม่ตอนคลิก เพื่อใช้ GPS ล่าสุด ไม่ใช่พิกัดที่อ่านไว้ตอนโหลดหน้าเว็บ
  const directionsUrl = makeDirectionsUrl(place);
  return `<div class="popup-title">${escapeHtml(place.name)}</div>` +
    `<div class="popup-meta">${categoryInfo[place.category].label}</div>` +
    `<a class="popup-directions" data-place-id="${place.id}" href="${directionsUrl}" target="_blank" rel="noopener" aria-label="เปิดเส้นทางไป ${escapeHtml(place.name)} ใน Google Maps">` +
      `<span class="popup-directions-icon" aria-hidden="true">↗</span><span>นำทางด้วย Google Maps</span></a>`;
}

/* สร้าง URL นำทาง: ถ้ามี GPS จากเว็บ จะส่งทั้งต้นทางและปลายทางให้ Google Maps
   ถ้ายังไม่มี GPS จะส่งเฉพาะปลายทาง ให้ Google Maps ใช้ตำแหน่งปัจจุบันของตัวเอง */
function makeDirectionsUrl(place) {
  const params = new URLSearchParams({ api: '1', destination: `${place.lat},${place.lng}` });
  if (currentUserPosition) {
    params.set('origin', `${currentUserPosition.lat},${currentUserPosition.lng}`);
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

// เปิดเส้นทางจากคลิกของผู้ใช้ และใช้พิกัด GPS ล่าสุดที่เว็บไซต์ได้รับ
function openDirections(place, event) {
  if (event) event.preventDefault();
  if (!place) return;
  const url = makeDirectionsUrl(place);
  window.open(url, '_blank', 'noopener,noreferrer');
}

/* 7) วนสร้างหมุดให้ครบทุกสถานที่ และเก็บไว้เพื่อใช้กรอง/เลือกภายหลัง */
places.forEach((place) => {
  const marker = L.marker([place.lat, place.lng], { icon: makeIcon(place), title: place.name, alt: place.name });
  marker.bindPopup(popupContent(place));
  marker.on('click', () => selectPlace(place.id, false));
  marker.addTo(map);
  markerById.set(place.id, marker);
});

/* 8) คำนวณรายการที่ควรแสดงตามคำค้นและหมวดหมู่ที่เลือก */
function getVisiblePlaces() {
  const query = $('#searchInput').value.trim().toLocaleLowerCase('th');
  return places.filter((place) => {
    const matchesCategory = activeFilter === 'all' || place.category === activeFilter;
    const matchesSearch = !query || place.name.toLocaleLowerCase('th').includes(query) || categoryInfo[place.category].label.includes(query);
    return matchesCategory && matchesSearch;
  });
}

/* 9) วาดรายการสถานที่ในแถบด้านข้าง พร้อมซ่อน/แสดงหมุดตามตัวกรอง */
function renderPlaces() {
  const visible = getVisiblePlaces();
  const list = $('#placesList');
  $('#resultsCount').textContent = visible.length;
  $('#resultsTitle').textContent = activeFilter === 'all' ? 'สถานที่ทั้งหมด' : categoryInfo[activeFilter].label;
  $('#clearSearch').hidden = !$('#searchInput').value;
  list.innerHTML = '';
  if (!visible.length) {
    list.innerHTML = '<div class="empty-state">ไม่พบสถานที่ที่ตรงกับคำค้น<br>ลองใช้คำค้นอื่นดูนะ</div>';
  } else {
    visible.forEach((place) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `place-row${selectedId === place.id ? ' selected' : ''}`;
      button.setAttribute('aria-label', `ดูตำแหน่ง ${place.name} บนแผนที่`);
      const symbol = place.category === 'van' ? '🚐' : '🛵';
      button.innerHTML = `<span class="place-symbol ${place.category}">${symbol}</span>` +
        `<span class="place-copy"><span class="place-name">${escapeHtml(place.name)}</span>` +
        `<span class="place-category">${categoryInfo[place.category].label}</span></span>` +
        '<span class="place-arrow" aria-hidden="true">›</span>';
      button.addEventListener('click', () => {
        selectPlace(place.id, true);
        
      });
      list.appendChild(button);
    });
  }
  markerById.forEach((marker, id) => {
    const place = places.find((item) => item.id === id);
    const isVisible = visible.some((item) => item.id === id);
    if (isVisible && !map.hasLayer(marker)) marker.addTo(map);
    if (!isVisible && map.hasLayer(marker)) map.removeLayer(marker);
  });
  /* 13) ตัวจัดการปุ่มกรอง ค้นหา ล้างคำค้น แสดงทั้งหมด และ GPS */
document.querySelectorAll('[data-filter]').forEach((button) => {
    button.classList.toggle('active', button.dataset.filter === activeFilter);
    button.setAttribute('aria-pressed', String(button.dataset.filter === activeFilter));
  });
}

/* 10) เลือกสถานที่: อัปเดตการ์ดรายละเอียด ไฮไลต์หมุด และซูมแผนที่ */
function selectPlace(id, moveMap) {
  const place = places.find((item) => item.id === id);
  if (!place) return;
  selectedId = id;
  const marker = markerById.get(id);
  // เอาสถานะเลือกออกจากหมุดเดิม แล้วเน้นหมุดที่กำลังเลือก
  markerById.forEach((item) => {
    const pin = item.getElement()?.querySelector('.marker-pin');
    if (pin) pin.classList.toggle('selected', item === marker);
  });
  if (moveMap) map.flyTo([place.lat, place.lng], Math.max(map.getZoom(), 17), { duration: .65 });
  if (marker && map.hasLayer(marker)) marker.openPopup();
  const icon = $('#selectedIcon');
  icon.className = `selected-icon${place.category === 'van' ? ' van' : ''}`;
  icon.textContent = categoryInfo[place.category].icon;
  $('#selectedName').textContent = place.name;
  $('#selectedCategory').textContent = categoryInfo[place.category].label;
  $('#directionsLink').href = makeDirectionsUrl(place);
  $('#selectedCard').hidden = false;
  $('#statusMessage').textContent = `เลือกแล้ว: ${place.name}`;
  renderPlaces();
}

/* 11) แสดงข้อความแจ้งเตือนชั่วคราวด้านล่างหน้าจอ */
function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 3800);
}

/* 12) ขอสิทธิ์ GPS จากผู้ใช้ และเริ่มติดตามตำแหน่งเมื่อได้รับอนุญาต */
function locateUser() {
  if (!('geolocation' in navigator)) {
    showToast('เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง');
    return;
  }
  if (!window.isSecureContext && location.hostname !== 'localhost') {
    showToast('การระบุตำแหน่งต้องเปิดเว็บผ่าน HTTPS หรือ localhost');
    return;
  }
  $('#locateBtn').disabled = true;
  $('#statusMessage').textContent = 'กำลังขอตำแหน่งจากอุปกรณ์…';
  navigator.geolocation.getCurrentPosition((position) => {
    updateUserPosition(position);
    $('#locateBtn').disabled = false;
    if (watchId === null && navigator.geolocation.watchPosition) {
      watchId = navigator.geolocation.watchPosition(updateUserPosition, handleLocationError, {
        enableHighAccuracy: true,
        maximumAge: 0, // ขอข้อมูลใหม่ ไม่ใช้ตำแหน่งที่เบราว์เซอร์เก็บค้างไว้
        timeout: 30000
      });
    }
  }, (error) => {
    $('#locateBtn').disabled = false;
    handleLocationError(error);
  }, {
    enableHighAccuracy: true,
    maximumAge: 0, // ขอข้อมูลใหม่ ไม่ใช้ตำแหน่งที่เบราว์เซอร์เก็บค้างไว้
    timeout: 30000
  });
}

// อัปเดตหมุดตำแหน่งผู้ใช้และวงกลมแสดงความคลาดเคลื่อนของ GPS
function updateUserPosition(position) {
  const latlng = [position.coords.latitude, position.coords.longitude];
  // เก็บพิกัด พร้อมค่าความคลาดเคลื่อนและเวลาที่วัดได้
  // makeDirectionsUrl จะใช้เป็นต้นทางเฉพาะเมื่อความแม่นยำไม่เกิน 25 เมตรและอายุไม่เกิน 30 วินาที
  const measuredAt = Number.isFinite(position.timestamp) ? position.timestamp : Date.now();
  currentUserPosition = {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : Infinity,
    timestamp: measuredAt
  };
  if (selectedId !== null) {
    const selectedPlace = places.find((item) => item.id === selectedId);
    if (selectedPlace) $('#directionsLink').href = makeDirectionsUrl(selectedPlace);
  }
  const accuracy = Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : 0;
  if (!userMarker) {
    userMarker = L.marker(latlng, {
      icon: L.divIcon({ className: 'custom-map-marker', html: '<div class="user-marker" aria-label="ตำแหน่งของคุณ"></div>', iconSize: [20, 20], iconAnchor: [10, 10] }),
      title: 'ตำแหน่งของคุณ', zIndexOffset: 1000
    }).addTo(map).bindPopup('<strong>ตำแหน่งของคุณ</strong><br><small>ตำแหน่งจากอุปกรณ์ของคุณ</small>');
    userAccuracy = L.circle(latlng, { radius: accuracy, color: '#2878e8', weight: 1, fillColor: '#2878e8', fillOpacity: .08 }).addTo(map);
  } else {
    userMarker.setLatLng(latlng);
    userAccuracy.setLatLng(latlng);
    userAccuracy.setRadius(accuracy);
  }
  $('#statusMessage').textContent = `อัปเดตตำแหน่งแล้ว · คลาดเคลื่อนประมาณ ${Math.round(accuracy)} ม.`;
  if (accuracy > 25) {
    showToast('ตำแหน่งยังคลาดเคลื่อนอยู่ ลองรอสักครู่ในที่โล่งเพื่อรับ GPS ที่แม่นยำขึ้น');
  }
}

// แปลงข้อผิดพลาดจาก Geolocation API เป็นข้อความภาษาไทยที่เข้าใจง่าย
function handleLocationError(error) {
  const messages = {
    1: 'ยังไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง กรุณาอนุญาต Location ในเบราว์เซอร์',
    2: 'ไม่สามารถระบุตำแหน่งได้ในขณะนี้ ลองเปิด GPS หรือเช็กการเชื่อมต่อ',
    3: 'การระบุตำแหน่งใช้เวลานานเกินไป ลองอีกครั้ง'
  };
  const message = messages[error && error.code] || 'เกิดข้อผิดพลาดขณะระบุตำแหน่ง';
  $('#statusMessage').textContent = message;
  showToast(message);
}

/* 13) ตัวจัดการปุ่มกรอง ค้นหา ล้างคำค้น แสดงทั้งหมด และ GPS */
document.querySelectorAll('[data-filter]').forEach((button) => {
  button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    renderPlaces();
    const visible = getVisiblePlaces();
    if (visible.length) {
      if (visible.length === 1) selectPlace(visible[0].id, true);
      else map.fitBounds(L.featureGroup(visible.map((place) => markerById.get(place.id))).getBounds().pad(.15), { maxZoom: 16 });
    }
  });
});

$('#searchInput').addEventListener('input', () => {
  renderPlaces();
  const visible = getVisiblePlaces();
  if (visible.length === 1) selectPlace(visible[0].id, true);
});
$('#searchForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const visible = getVisiblePlaces();
  if (visible.length) selectPlace(visible[0].id, true);
  else showToast('ไม่พบสถานที่ที่ตรงกับคำค้น');
});
$('#clearSearch').addEventListener('click', () => {
  $('#searchInput').value = '';
  renderPlaces();
  $('#searchInput').focus();
});
$('#showAllBtn').addEventListener('click', () => {
  activeFilter = 'all';
  $('#searchInput').value = '';
  renderPlaces();
  map.fitBounds(L.featureGroup(places.map((place) => markerById.get(place.id))).getBounds().pad(.12));
});
$('#locateBtn').addEventListener('click', locateUser);

// อัปเดต URL ณ เวลาคลิก เพื่อไม่ให้ใช้ตำแหน่งเก่าที่ถูกสร้างไว้ก่อน GPS พร้อม
$('#directionsLink').addEventListener('click', (event) => {
  if (selectedId === null) return;
  openDirections(places.find((place) => place.id === selectedId), event);
});
// Popup ของ Leaflet ถูกสร้างใหม่ตามจุดที่กด จึงใช้ event delegation
document.addEventListener('click', (event) => {
  const link = event.target.closest('.popup-directions');
  if (!link) return;
  const placeId = Number(link.dataset.placeId);
  openDirections(places.find((place) => place.id === placeId), event);
});
$('#closeSelected').addEventListener('click', () => { $('#selectedCard').hidden = true; selectedId = null; renderPlaces(); });
$('#mobileListBtn').addEventListener('click', () => $('#placesPanel').classList.toggle('collapsed'));

/* 14) สลับธีมสีขาว/สีดำ และจดจำค่าที่เลือกไว้ในเบราว์เซอร์ */
function setTheme(theme) {
  const isDark = theme === 'dark';
  document.body.dataset.theme = isDark ? 'dark' : 'light';
  // อัปเดตสถานะของสวิตช์ให้ตรงกับธีมปัจจุบัน (ใช้ได้กับ screen reader ด้วย)
  $('#themeToggle').setAttribute('aria-checked', String(isDark));
  $('#themeToggle').setAttribute('aria-label', isDark ? 'เปลี่ยนเป็นธีมสีขาว' : 'เปลี่ยนเป็นธีมสีดำ');
  $('#themeToggle').title = isDark ? 'ธีมสีดำอยู่ · กดเพื่อเปลี่ยนเป็นธีมสีขาว' : 'ธีมสีขาวอยู่ · กดเพื่อเปลี่ยนเป็นธีมสีดำ';
  try { localStorage.setItem('thammasat-map-theme', isDark ? 'dark' : 'light'); } catch (_) { /* ใช้งานต่อได้แม้ปิดการเก็บข้อมูล */ }
}
$('#themeToggle').addEventListener('click', () => {
  setTheme(document.body.dataset.theme === 'dark' ? 'light' : 'dark');
});
try {
  setTheme(localStorage.getItem('thammasat-map-theme') || 'light');
} catch (_) {
  setTheme('light');
}

/* 15) เริ่มต้นหน้าเว็บ: วาดรายการและจัดกรอบแผนที่ให้เห็นทุกจุด */
renderPlaces();
map.fitBounds(L.featureGroup(places.map((place) => markerById.get(place.id))).getBounds().pad(.12));
window.addEventListener('resize', () => map.invalidateSize());

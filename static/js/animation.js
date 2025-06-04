const SERVER_BASE_URL = 'http://59.124.31.142:5000';

// 全局設定的預設值，如果從後端獲取失敗則使用這些
const DEFAULT_INTERVALS = {
  header_interval: 5000,   // 頁首預設 5 秒
  carousel_interval: 6000, // 中間輪播預設 6 秒
  footer_interval: 7000    // 頁尾預設 7 秒
};

// 輔助函數：初始化通用輪播動畫 (適用於任何包含 .carousel-item 的容器)
// 接收容器元素和輪播間隔時間
function initializeGenericCarousel(containerElement, slideInterval) {
  if (!containerElement) return;
  const inner = containerElement.querySelector(".carousel-inner");
  if (!inner) return;
  const items = inner.querySelectorAll(".carousel-item");

  // 清除舊的計時器，避免重複運行
  if (containerElement.slideTimer) {
    clearInterval(containerElement.slideTimer);
    containerElement.slideTimer = null;
  }

  // 如果沒有項目或只有一個項目，則不進行輪播
  if (items.length <= 1) {
    inner.style.transition = "none";
    inner.style.transform = "translateX(0)";
    inner.querySelectorAll('.cloned-item').forEach(clone => clone.remove()); // 移除所有複製項
    return;
  }

  // 重置位置
  inner.style.transition = "none";
  inner.style.transform = "translateX(0)";
  let currentIndex = 0;

  // 移除舊的複製項
  inner.querySelectorAll('.cloned-item').forEach(clone => clone.remove());

  // 複製第一個項目到末尾，實現無縫循環
  const firstClone = items[0].cloneNode(true);
  firstClone.classList.add('cloned-item');
  inner.appendChild(firstClone);

  let isResetting = false; // 防止在重置期間觸發滑動

  const slide = () => {
    if (isResetting) return;

    currentIndex++;
    inner.style.transition = "transform 0.5s ease"; // 滑動動畫
    inner.style.transform = `translateX(-${currentIndex * 100}%)`;

    // 當滑動到複製的項目時，立即跳回第一個項目（無動畫）
    if (currentIndex === items.length) {
      isResetting = true;
      setTimeout(() => {
        inner.style.transition = "none"; // 移除動畫
        inner.style.transform = "translateX(0)"; // 立即跳回
        currentIndex = 0;
        isResetting = false; // 解除重置鎖
      }, 500); // 0.5 秒是 slide transition 的時間
    }
  };
  containerElement.slideTimer = setInterval(slide, slideInterval);
}


// 更新所有區塊 (現在接收媒體數據和設定)
function updateAllSections(data) {
  const mediaItems = data.media;
  const settings = data.settings || {}; // 如果沒有設定，則為空對象

  // 將後端設定與預設值合併
  const currentIntervals = {
    header_interval: settings.header_interval !== undefined ? settings.header_interval * 1000 : DEFAULT_INTERVALS.header_interval,
    carousel_interval: settings.carousel_interval !== undefined ? settings.carousel_interval * 1000 : DEFAULT_INTERVALS.carousel_interval,
    footer_interval: settings.footer_interval !== undefined ? settings.footer_interval * 1000 : DEFAULT_INTERVALS.footer_interval
  };

  if (mediaItems && mediaItems.length > 0) {
    updateHeaderContent(mediaItems, currentIntervals.header_interval); // 傳入設定
    updateFooterContent(mediaItems, currentIntervals.footer_interval); // 傳入設定
    updateCarousel(mediaItems, 'carousel_top_left', 'carousel-top-left-inner', currentIntervals.carousel_interval); // 傳入設定
    updateCarousel(mediaItems, 'carousel_top_right', 'carousel-top-right-inner', currentIntervals.carousel_interval);
    updateCarousel(mediaItems, 'carousel_bottom_left', 'carousel-bottom-left-inner', currentIntervals.carousel_interval);
    updateCarousel(mediaItems, 'carousel_bottom_right', 'carousel-bottom-right-inner', currentIntervals.carousel_interval);
  } else {
    console.log('沒有從伺服器獲取到媒體資料，或資料為空，將清空所有動態區塊。');
    // 清空所有動態區塊內容
    updateHeaderContent([], 0); 
    updateFooterContent([], 0);
    const carouselInnerIds = [
      'carousel-top-left-inner', 
      'carousel-top-right-inner', 
      'carousel-bottom-left-inner', 
      'carousel-bottom-right-inner'
    ];
    carouselInnerIds.forEach(id => {
      const innerElement = document.getElementById(id);
      if (innerElement) {
        const container = innerElement.closest('.carousel-container');
        if (container) {
          innerElement.innerHTML = '';
          initializeGenericCarousel(container, 0); // 清空後不需要輪播，間隔設為0
        }
      }
    });
  }
}

// 修改 fetchMediaData 以獲取設定
async function fetchMediaData() {
  try {
    // 更改 API 端點
    const response = await fetch(`${SERVER_BASE_URL}/api/media_with_settings`);
    if (!response.ok) {
      throw new Error(`獲取媒體資料和設定失敗: ${response.status} ${response.statusText}`);
    }
    const data = await response.json(); // 返回的 JSON 包含 media 和 settings 兩個鍵
    console.log('成功獲取媒體資料和設定:', data);
    return data;
  } catch (error) {
    console.error('fetchMediaData 錯誤:', error);
    // 返回空數據和預設設定
    return { media: [], settings: DEFAULT_INTERVALS };
  }
}

// 通用函數：填充並初始化指定區塊的內容 (圖片或影片，可輪播)
function populateSectionContent(containerId, sectionKey, mediaItems, slideInterval) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // 清除舊內容和定時器
    container.innerHTML = '';
    if (container.slideTimer) {
        clearInterval(container.slideTimer);
        container.slideTimer = null;
    }

    const sectionContent = mediaItems.filter(item => item.section_key === sectionKey);

    if (sectionContent.length > 0) {
        // 為多個項目創建一個內部輪播容器
        const innerCarousel = document.createElement('div');
        innerCarousel.classList.add('carousel-inner'); // 使用 carousel-inner class
        innerCarousel.style.display = 'flex'; // 確保 flex 佈局
        innerCarousel.style.width = '100%';
        innerCarousel.style.height = '100%'; // 讓內容填滿容器

        sectionContent.forEach(itemData => {
            const itemWrapper = document.createElement('figure'); // 使用 figure 作為項目包裝
            itemWrapper.classList.add('image', 'is-16by9', 'carousel-item'); // Bulma responsive image and carousel item class
            itemWrapper.style.flex = '0 0 100%'; // 確保每個項目佔滿視窗寬度
            itemWrapper.style.position = 'relative'; // 為內容定位

            if (itemData.type === 'video') {
                const videoElement = document.createElement('video');
                videoElement.classList.add('has-ratio'); // Bulma has-ratio class
                videoElement.style.position = 'absolute';
                videoElement.style.top = '0';
                videoElement.style.left = '0';
                videoElement.style.width = '100%';
                videoElement.style.height = '100%';
                videoElement.autoplay = true;
                videoElement.loop = true;
                videoElement.muted = true;
                videoElement.playsInline = true;
                const sourceElement = document.createElement('source');
                sourceElement.src = `${SERVER_BASE_URL}${itemData.url}`;
                sourceElement.type = 'video/mp4';
                videoElement.appendChild(sourceElement);
                videoElement.appendChild(document.createTextNode('您的瀏覽器不支持 HTML5 視頻。'));
                itemWrapper.appendChild(videoElement);
            } else if (itemData.type === 'image') {
                const imgElement = document.createElement('img');
                imgElement.src = `${SERVER_BASE_URL}${itemData.url}`;
                imgElement.alt = itemData.filename || '圖片';
                imgElement.style.position = 'absolute';
                imgElement.style.top = '0';
                imgElement.style.left = '0';
                imgElement.style.width = '100%';
                imgElement.style.height = '100%';
                imgElement.style.objectFit = 'cover'; // 確保圖片覆蓋整個區域
                itemWrapper.appendChild(imgElement);
            } else {
                itemWrapper.textContent = `不支援的媒體類型: ${itemData.type}`;
            }
            innerCarousel.appendChild(itemWrapper);
        });

        container.appendChild(innerCarousel);
        
        // 對於頁首和頁尾，我們將它們的容器變成一個可以進行輪播的元素
        // 頁首和頁尾的父容器已經是 column is-full p-0
        // 將其視為 carousel-container，因為 initializeGenericCarousel 需要這個 class
        // 或者為它們創建一個新的包裝 div
        const wrapperDiv = document.createElement('div');
        wrapperDiv.classList.add('carousel-container'); // 添加 carousel-container class
        wrapperDiv.style.width = '100%';
        wrapperDiv.style.height = '100%';
        wrapperDiv.style.overflow = 'hidden';
        wrapperDiv.style.position = 'relative';

        wrapperDiv.appendChild(innerCarousel); // 将 innerCarousel 放入 wrapperDiv
        container.appendChild(wrapperDiv); // 将 wrapperDiv 放入原始容器

        // 初始化輪播動畫
        if (sectionContent.length > 1 && slideInterval > 0) { // 只有多個項目且間隔大於0才輪播
          initializeGenericCarousel(wrapperDiv, slideInterval);
          console.log(`區塊 ${sectionKey} 已啟用輪播，間隔 ${slideInterval / 1000} 秒`);
        } else if (sectionContent.length === 1) {
          console.log(`區塊 ${sectionKey} 顯示單一內容。`);
          // 如果是單一影片，確保它自動播放
          const videoElement = innerCarousel.querySelector('video');
          if (videoElement) {
              videoElement.play().catch(e => console.error(`影片 ${sectionKey} 自動播放失敗:`, e));
          }
        } else {
            console.log(`區塊 ${sectionKey} 沒有內容。`);
        }

    } else {
        console.log(`沒有找到區塊 ${sectionKey} 的媒體資料。`);
    }
}


// 更新頁首內容 (現在也支持輪播)
function updateHeaderContent(mediaItems, headerInterval) {
  // 將 header-video-player 視為一個輪播容器
  const headerPlayerContainer = document.getElementById('header-video-player').closest('.column'); // 獲取其父級 column
  // 如果原始的 video player 是一個 figure，我們可能需要找到它的容器
  // 在 index.html 中 header-video-player 是 video 標籤，其父級是 figure
  // 我們需要找到 figure 的父級 div.column，並將其視為 carousel-container
  // 或者直接對 header-video-player 的父級 figure 進行改造
  // 為了簡化，我們直接為它創建一個新的包裝 div
  populateSectionContent('header-content-container', 'header_video', mediaItems, headerInterval); // 使用 header-content-container ID
}

// 更新頁尾內容 (現在也支持輪播)
function updateFooterContent(mediaItems, footerInterval) {
  populateSectionContent('footer-content-container', 'footer_content', mediaItems, footerInterval);
}


// 更新中間輪播區塊 (使用通用輪播函數)
function updateCarousel(mediaItems, sectionKey, carouselInnerId, carouselInterval) {
  const carouselInnerElement = document.getElementById(carouselInnerId);
  if (!carouselInnerElement) return;
  carouselInnerElement.innerHTML = ''; // 清除舊內容

  const carouselItemsData = mediaItems.filter(item => item.section_key === sectionKey);

  if (carouselItemsData.length > 0) {
    carouselItemsData.forEach(itemData => {
      const figureElement = document.createElement('figure');
      figureElement.classList.add('image', 'carousel-item', 'is-16by9'); // 添加 is-16by9
      const imgElement = document.createElement('img');
      imgElement.src = `${SERVER_BASE_URL}${itemData.url}`;
      imgElement.alt = itemData.filename || '輪播圖片'; 
      figureElement.appendChild(imgElement);
      carouselInnerElement.appendChild(figureElement);
    });
  }
  const carouselContainer = carouselInnerElement.closest('.carousel-container');
  if (carouselContainer) {
    initializeGenericCarousel(carouselContainer, carouselInterval); // 使用傳入的間隔
  }
}

// WebSocket 初始化 (需要額外處理 settings_updated 事件)
function initializeWebSocket() {
  const socket = io(SERVER_BASE_URL, {
    transports: ['websocket', 'polling'] 
  });
  socket.on('connect', () => {
    console.log('成功連接到 WebSocket 伺服器 (Socket.IO)');
  });
  socket.on('disconnect', (reason) => {
    console.log(`與 WebSocket 伺服器斷開連線: ${reason}`);
    if (reason === 'io server disconnect') {
        socket.connect();
    }
  });
  socket.on('connect_error', (error) => {
    console.error('WebSocket 連線錯誤:', error);
  });
  socket.on('media_updated', (data) => {
    console.log('收到 "media_updated" 事件:', data);
    console.log('將重新獲取媒體資料和設定並更新頁面...');
    fetchMediaData().then(data => { // fetchMediaData 現在返回 { media, settings }
      updateAllSections(data);
    });
  });
  // 新增：監聽設定更新事件
  socket.on('settings_updated', (settings_data) => {
    console.log('收到 "settings_updated" 事件:', settings_data);
    console.log('將重新獲取媒體資料並應用新設定...');
    fetchMediaData().then(data => { // fetchMediaData 現在返回 { media, settings }
      updateAllSections(data); // 這會重新初始化所有區塊，並應用新設定
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  fetchMediaData().then(data => { // fetchMediaData 現在返回 { media, settings }
    updateAllSections(data);
  });
  initializeWebSocket(); 
});
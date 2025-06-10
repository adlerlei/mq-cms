const SERVER_BASE_URL = window.location.origin; // 自动使用当前页面的协议和主机

// 全局設定的預設值，如果從後端獲取失敗則使用這些
const DEFAULT_INTERVALS = {
  header_interval: 5000,   // 頁首預設 5 秒
  carousel_interval: 6000, // 中間輪播預設 6 秒
  footer_interval: 7000    // 頁尾預設 7 秒
};

// 輔助函數：初始化通用輪播動畫
function initializeGenericCarousel(containerElement, slideInterval) {
  if (!containerElement) {
    console.warn("initializeGenericCarousel: 傳入的容器元素為 null");
    return;
  }
  const inner = containerElement.querySelector(".carousel-inner");
  if (!inner) {
    // console.warn(`initializeGenericCarousel: 在容器 ${containerElement.id || '未命名容器'} 中找不到 .carousel-inner`);
    return;
  }
  const items = inner.querySelectorAll(".carousel-item");

  if (containerElement.slideTimer) {
    clearInterval(containerElement.slideTimer);
    containerElement.slideTimer = null;
  }

  if (items.length <= 1) {
    inner.style.transition = "none";
    inner.style.transform = "translateX(0)";
    inner.querySelectorAll('.cloned-item').forEach(clone => clone.remove());
    // 如果只有一個影片，確保它播放
    if (items.length === 1) {
        const singleVideo = items[0].querySelector('video');
        if (singleVideo) {
            singleVideo.play().catch(e => {
                if (e.name !== 'AbortError') { // AbortError 通常是瀏覽器因用戶未互動而阻止自動播放
                    console.warn(`單一影片 ${singleVideo.src} 自動播放失敗:`, e.name, e.message);
                }
            });
        }
    }
    return;
  }

  inner.style.transition = "none";
  inner.style.transform = "translateX(0)";
  let currentIndex = 0;
  inner.querySelectorAll('.cloned-item').forEach(clone => clone.remove());

  const firstClone = items[0].cloneNode(true);
  firstClone.classList.add('cloned-item');
  inner.appendChild(firstClone);
  
  // 確保複製後的項目也能正確顯示，特別是影片
  const clonedVideo = firstClone.querySelector('video');
  if (clonedVideo) {
    clonedVideo.muted = true; // 複製的影片也應靜音
    clonedVideo.playsInline = true;
    // clonedVideo.play().catch(e => console.warn("Cloned video play failed:", e)); // 通常不需要複製的影片自動播放
  }


  let isResetting = false;

  const slide = () => {
    if (isResetting) return;
    currentIndex++;
    inner.style.transition = "transform 0.5s ease";
    inner.style.transform = `translateX(-${currentIndex * 100}%)`;

    if (currentIndex === items.length) {
      isResetting = true;
      setTimeout(() => {
        inner.style.transition = "none";
        inner.style.transform = "translateX(0)";
        currentIndex = 0;
        isResetting = false;
      }, 500);
    }
  };
  containerElement.slideTimer = setInterval(slide, slideInterval);
}


// 更新所有區塊
function updateAllSections(data) {
  const mediaItems = data.media || []; // 確保 mediaItems 始終是陣列
  const settings = data.settings || {};

  const currentIntervals = {
    header_interval: settings.header_interval !== undefined ? parseInt(settings.header_interval, 10) * 1000 : DEFAULT_INTERVALS.header_interval,
    carousel_interval: settings.carousel_interval !== undefined ? parseInt(settings.carousel_interval, 10) * 1000 : DEFAULT_INTERVALS.carousel_interval,
    footer_interval: settings.footer_interval !== undefined ? parseInt(settings.footer_interval, 10) * 1000 : DEFAULT_INTERVALS.footer_interval
  };
  console.log("當前使用的輪播間隔 (毫秒):", currentIntervals);


  updateHeaderContent(mediaItems, currentIntervals.header_interval);
  updateFooterContent(mediaItems, currentIntervals.footer_interval);
  updateCarousel(mediaItems, 'carousel_top_left', 'carousel-top-left-inner', currentIntervals.carousel_interval);
  updateCarousel(mediaItems, 'carousel_top_right', 'carousel-top-right-inner', currentIntervals.carousel_interval);
  updateCarousel(mediaItems, 'carousel_bottom_left', 'carousel-bottom-left-inner', currentIntervals.carousel_interval);
  updateCarousel(mediaItems, 'carousel_bottom_right', 'carousel-bottom-right-inner', currentIntervals.carousel_interval);
}

// 獲取媒體數據和設定
async function fetchMediaData() {
  try {
    const response = await fetch(`${SERVER_BASE_URL}/api/media_with_settings`);
    if (!response.ok) {
      throw new Error(`獲取媒體資料和設定失敗: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    console.log('成功獲取媒體資料和設定:', data);
    return data;
  } catch (error) {
    console.error('fetchMediaData 錯誤:', error);
    return { media: [], settings: DEFAULT_INTERVALS }; // 返回包含預設值的物件
  }
}

// 通用函數：填充並初始化指定區塊的內容
function populateSectionContent(containerId, sectionKey, mediaItems, slideInterval) {
  try {
    const container = document.getElementById(containerId);
    if (!container) {
      console.warn(`找不到容器元素: ${containerId}`);
      return;
    }
    container.innerHTML = ''; // 清空容器
    if (container.slideTimer) {
      clearInterval(container.slideTimer);
      container.slideTimer = null;
    }

    const sectionContent = mediaItems.filter(item => item.section_key === sectionKey);

    if (sectionContent.length > 0) {
      // 為頁首和頁尾創建 wrapperDiv 和 innerCarousel
      // 中間輪播區塊的 innerCarousel 已經在 HTML 中
      let targetInnerCarousel;
      let wrapperToInitialize; // 用於 initializeGenericCarousel 的目標元素

      if (sectionKey === 'header_video' || sectionKey === 'footer_content') {
        const wrapperDiv = document.createElement('div');
        wrapperDiv.classList.add('carousel-container'); // 確保有這個 class
        wrapperDiv.style.width = '100%';
        wrapperDiv.style.height = '100%'; // 讓 wrapperDiv 填滿父容器（例如固定高度的 footerContainer）
        wrapperDiv.style.position = 'relative'; // 確保 wrapper 是定位基準

        targetInnerCarousel = document.createElement('div');
        targetInnerCarousel.classList.add('carousel-inner');
        wrapperDiv.appendChild(targetInnerCarousel);
        container.appendChild(wrapperDiv);
        wrapperToInitialize = wrapperDiv;
      } else {
        // 對於中間輪播區塊，直接使用 HTML 中的 inner 元素
        targetInnerCarousel = container.querySelector('.carousel-inner');
        if (!targetInnerCarousel) {
             console.warn(`在 ${containerId} 中找不到 .carousel-inner 給 ${sectionKey}`);
             return;
        }
        wrapperToInitialize = container; // 中間輪播的容器是 .carousel-container
      }
      
      targetInnerCarousel.innerHTML = ''; // 再次清空，確保

      sectionContent.forEach(itemData => {
        const itemWrapper = document.createElement('figure');
        itemWrapper.classList.add('carousel-item');
        // figure 元素預設就有一定的 display 屬性，這裡不需要 is-16by9 等
        // 具體的長寬比和 object-fit 由 CSS 控制

        let mediaElement;
        if (itemData.type === 'video') {
          mediaElement = document.createElement('video');
          // videoElement.style.position = 'absolute'; // 由CSS控制
          // videoElement.style.top = '0';
          // videoElement.style.left = '0';
          // videoElement.style.width = '100%';
          // videoElement.style.height = '100%'; // << 建議改為 100%
          // videoElement.style.objectFit = 'cover'; // 由CSS控制
          mediaElement.autoplay = true;
          mediaElement.loop = true;
          mediaElement.muted = true;
          mediaElement.playsInline = true;
          // videoElement.controls = false; // << 修改：預設不顯示控制項
          const sourceElement = document.createElement('source');
          sourceElement.src = `${SERVER_BASE_URL}${itemData.url}`;
          sourceElement.type = 'video/mp4'; // 或根據實際影片類型
          mediaElement.appendChild(sourceElement);
          mediaElement.appendChild(document.createTextNode('您的瀏覽器不支持 HTML5 視頻。'));
        } else if (itemData.type === 'image') {
          mediaElement = document.createElement('img');
          mediaElement.src = `${SERVER_BASE_URL}${itemData.url}`;
          mediaElement.alt = itemData.filename || '圖片';
          // imgElement.style.position = 'absolute'; // 由CSS控制
          // imgElement.style.top = '0';
          // imgElement.style.left = '0';
          // imgElement.style.width = '100%';
          // imgElement.style.height = '100%';
          // imgElement.style.objectFit = (sectionKey === 'header_video' || sectionKey === 'footer_content') ? 'cover' : 'contain'; // 由CSS控制
        } else {
          mediaElement = document.createElement('div');
          mediaElement.textContent = `不支援的媒體類型: ${itemData.type}`;
        }
        itemWrapper.appendChild(mediaElement);
        targetInnerCarousel.appendChild(itemWrapper);
      });

      if (sectionContent.length > 0 && slideInterval > 0) {
        initializeGenericCarousel(wrapperToInitialize, slideInterval);
        console.log(`區塊 ${sectionKey} 已啟用輪播，間隔 ${slideInterval / 1000} 秒，項目數: ${sectionContent.length}`);
      } else if (sectionContent.length === 1) {
         console.log(`區塊 ${sectionKey} 顯示單一內容。`);
         // 確保單一影片播放 (已在 initializeGenericCarousel 中處理)
          const singleVideo = targetInnerCarousel.querySelector('video');
            if (singleVideo) {
                singleVideo.play().catch(e => {
                    if (e.name !== 'AbortError') {
                        console.warn(`單一影片 ${sectionKey} 自動播放失敗:`, e.name, e.message);
                    }
                });
            }
      }

    } else {
      console.log(`沒有找到區塊 ${sectionKey} 的媒體資料。`);
      if (container.querySelector('.carousel-inner')) {
          container.querySelector('.carousel-inner').innerHTML = ''; // 如果有 inner 也清空
      }
    }
  } catch (error) {
    console.error(`填充區塊 ${sectionKey} (${containerId}) 內容時發生錯誤: ${error.message}\n${error.stack}`);
  }
}


// 更新頁首內容
function updateHeaderContent(mediaItems, headerInterval) {
  populateSectionContent('header-content-container', 'header_video', mediaItems, headerInterval);
}

// 更新頁尾內容
function updateFooterContent(mediaItems, footerInterval) {
  populateSectionContent('footer-content-container', 'footer_content', mediaItems, footerInterval);
}


// 更新中間輪播區塊
function updateCarousel(mediaItems, sectionKey, carouselInnerId, carouselInterval) {
  const carouselInnerElement = document.getElementById(carouselInnerId);
  if (!carouselInnerElement) {
    console.warn(`找不到輪播內容元素: ${carouselInnerId}`);
    return;
  }
  const carouselContainer = carouselInnerElement.closest('.carousel-container');
  if (!carouselContainer) {
      console.warn(`找不到 ${carouselInnerId} 的父層 .carousel-container`);
      return;
  }

  carouselInnerElement.innerHTML = ''; // 清除舊內容
  if (carouselContainer.slideTimer) { // 清除舊的計時器
    clearInterval(carouselContainer.slideTimer);
    carouselContainer.slideTimer = null;
  }

  const carouselItemsData = mediaItems.filter(item => item.section_key === sectionKey);

  if (carouselItemsData.length > 0) {
    carouselItemsData.forEach(itemData => {
      const itemWrapper = document.createElement('figure'); // 使用 figure
      itemWrapper.classList.add('carousel-item');

      // 中間區塊仍然使��� .carousel-image-container 來包裹 img 以控制比例
      const imageContainer = document.createElement('div');
      imageContainer.classList.add('carousel-image-container'); // 保持這個結構

      const imgElement = document.createElement('img');
      imgElement.src = `${SERVER_BASE_URL}${itemData.url}`;
      imgElement.alt = itemData.filename || '輪播圖片';
      // imgElement 的樣式由 .carousel-image-container img 在 CSS 中定義

      imageContainer.appendChild(imgElement);
      itemWrapper.appendChild(imageContainer);
      carouselInnerElement.appendChild(itemWrapper);
    });
  }

  if (carouselItemsData.length > 0 && carouselInterval > 0) {
    initializeGenericCarousel(carouselContainer, carouselInterval);
    console.log(`中間輪播 ${sectionKey} 已啟用，間隔 ${carouselInterval / 1000} 秒，項目數: ${carouselItemsData.length}`);
  } else if (carouselItemsData.length === 1) {
     console.log(`中間輪播 ${sectionKey} 顯示單一內容。`);
  } else {
    console.log(`中間輪播 ${sectionKey} 無內容。`);
  }
}

// WebSocket 初始化
function initializeWebSocket() {
  const socket = io({
    transports: ['websocket', 'polling']
  });
  
  socket.on('connect', () => console.log('成功連接到 WebSocket 伺服器 (Socket.IO)'));
  
  socket.on('disconnect', (reason) => {
    console.log(`與 WebSocket 伺服器斷開連線: ${reason}`);
    if (reason === 'io server disconnect') socket.connect();
  });
  
  socket.on('connect_error', (error) => console.error('WebSocket 連線錯誤:', error));

  socket.on('media_updated', (data) => {
    console.log('收到 "media_updated" 事件:', data.message || data);
    fetchMediaData().then(updateAllSections);
  });
  
  socket.on('settings_updated', (settings_data) => {
    console.log('收到 "settings_updated" 事件:', settings_data);
    fetchMediaData().then(updateAllSections);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  fetchMediaData().then(updateAllSections);
  initializeWebSocket();
});
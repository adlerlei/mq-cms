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
  const { assignments, materials, groups, settings, available_sections } = data;
  
  // 設定輪播間隔
  const currentIntervals = {
    header_interval: settings.header_interval !== undefined ? parseInt(settings.header_interval, 10) * 1000 : DEFAULT_INTERVALS.header_interval,
    carousel_interval: settings.carousel_interval !== undefined ? parseInt(settings.carousel_interval, 10) * 1000 : DEFAULT_INTERVALS.carousel_interval,
    footer_interval: settings.footer_interval !== undefined ? parseInt(settings.footer_interval, 10) * 1000 : DEFAULT_INTERVALS.footer_interval
  };
  console.log("當前使用的輪播間隔 (毫秒):", currentIntervals);

  // 更新所有區塊
  updateSection('header_video', data, 'header-content-container', currentIntervals.header_interval);
  updateSection('carousel_top_left', data, 'carousel-top-left-inner', currentIntervals.carousel_interval);
  updateSection('carousel_top_right', data, 'carousel-top-right-inner', currentIntervals.carousel_interval);
  updateSection('carousel_bottom_left', data, 'carousel-bottom-left-inner', currentIntervals.carousel_interval);
  updateSection('carousel_bottom_right', data, 'carousel-bottom-right-inner', currentIntervals.carousel_interval);
  updateSection('footer_content', data, 'footer-content-container', currentIntervals.footer_interval);
}

// 獲取媒體數據和設定
async function fetchMediaData() {
  try {
    // 獲取完整的媒體資料包含指派、素材、群組和設定
    const response = await fetch(`${SERVER_BASE_URL}/api/media_with_settings`);
    if (!response.ok) {
      throw new Error(`獲取媒體資料失敗: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    console.log('成功獲取完整媒體資料:', data);
    
    return data;
  } catch (error) {
    console.error('fetchMediaData 錯誤:', error);
    return {
      assignments: [],
      materials: [],
      groups: [],
      settings: DEFAULT_INTERVALS,
      available_sections: {}
    };
  }
}

function getFileType(filename) {
  const ext = filename.toLowerCase().split('.').pop();
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  const videoExts = ['mp4', 'webm', 'mov', 'avi'];
  
  if (imageExts.includes(ext)) return 'image';
  if (videoExts.includes(ext)) return 'video';
  return 'unknown';
}

// 核心渲染函式：更新指定區塊
function updateSection(sectionKey, data, containerId, slideInterval) {
  try {
    const { assignments, materials, groups } = data;
    
    // 根據 containerId 找到容器元素
    let container;
    if (containerId === 'carousel-top-left-inner' || containerId === 'carousel-top-right-inner' || 
        containerId === 'carousel-bottom-left-inner' || containerId === 'carousel-bottom-right-inner') {
      // 對於中間輪播，containerId 是 inner 元素的 id
      container = document.getElementById(containerId);
    } else {
      // 對於頁首和頁尾，containerId 是外層容器的 id
      container = document.getElementById(containerId);
    }
    
    if (!container) {
      console.warn(`找不到容器元素: ${containerId}`);
      return;
    }
    
    // 清空容器並停止舊的計時器
    if (containerId === 'carousel-top-left-inner' || containerId === 'carousel-top-right-inner' || 
        containerId === 'carousel-bottom-left-inner' || containerId === 'carousel-bottom-right-inner') {
      // 對於中間輪播，需要找到父層容器來停止計時器
      const parentContainer = container.closest('.carousel-container');
      if (parentContainer && parentContainer.slideTimer) {
        clearInterval(parentContainer.slideTimer);
        parentContainer.slideTimer = null;
      }
      container.innerHTML = '';
    } else {
      // 對於頁首和頁尾
      container.innerHTML = '';
      if (container.slideTimer) {
        clearInterval(container.slideTimer);
        container.slideTimer = null;
      }
    }
    
    // 篩選出對應這個區塊的指派
    const sectionAssignments = assignments.filter(assignment => assignment.section_key === sectionKey);
    
    if (sectionAssignments.length === 0) {
      console.log(`沒有找到區塊 ${sectionKey} 的指派資料。`);
      return;
    }
    
    // 準備內容陣列
    const contentItems = [];
    
    // 根據指派類型處理內容
    sectionAssignments.forEach(assignment => {
      if (assignment.content_type === 'single_media') {
        // 單一媒體
        const material = materials.find(m => m.id === assignment.content_id);
        if (material) {
          contentItems.push({
            type: material.type,
            url: material.url,
            filename: material.filename
          });
        }
      } else if (assignment.content_type === 'group_reference') {
        // 群組引用
        const group = groups.find(g => g.id === assignment.content_id);
        if (group && group.materials) {
          // 將群組中的所有媒體加入內容陣列
          group.materials.forEach(material => {
            contentItems.push({
              type: material.type,
              url: material.url,
              filename: material.filename
            });
          });
        }
      }
    });
    
    if (contentItems.length === 0) {
      console.log(`區塊 ${sectionKey} 沒有有效的內容。`);
      return;
    }
    
    // 創建內容結構
    let targetInnerCarousel;
    let wrapperToInitialize;
    
    if (sectionKey === 'header_video' || sectionKey === 'footer_content') {
      // 頁首和頁尾：創建輪播結構
      const wrapperDiv = document.createElement('div');
      wrapperDiv.classList.add('carousel-container');
      wrapperDiv.style.width = '100%';
      wrapperDiv.style.height = '100%';
      wrapperDiv.style.position = 'relative';
      
      targetInnerCarousel = document.createElement('div');
      targetInnerCarousel.classList.add('carousel-inner');
      wrapperDiv.appendChild(targetInnerCarousel);
      container.appendChild(wrapperDiv);
      wrapperToInitialize = wrapperDiv;
    } else {
      // 中間輪播：使用現有的結構
      targetInnerCarousel = container;
      const parentContainer = container.closest('.carousel-container');
      wrapperToInitialize = parentContainer;
    }
    
    // 生成媒體元素
    contentItems.forEach(item => {
      const itemWrapper = document.createElement('figure');
      itemWrapper.classList.add('carousel-item');
      
      let mediaElement;
      if (item.type === 'video') {
        mediaElement = document.createElement('video');
        mediaElement.autoplay = true;
        mediaElement.loop = true;
        mediaElement.muted = true;
        mediaElement.playsInline = true;
        
        const sourceElement = document.createElement('source');
        sourceElement.src = item.url;
        sourceElement.type = 'video/mp4';
        mediaElement.appendChild(sourceElement);
        mediaElement.appendChild(document.createTextNode('您的瀏覽器不支持 HTML5 視頻。'));
      } else if (item.type === 'image') {
        mediaElement = document.createElement('img');
        mediaElement.src = item.url;
        mediaElement.alt = item.filename || '圖片';
        
        // 對於中間輪播，需要包裝在 carousel-image-container 中
        if (sectionKey.startsWith('carousel_')) {
          const imageContainer = document.createElement('div');
          imageContainer.classList.add('carousel-image-container');
          imageContainer.appendChild(mediaElement);
          itemWrapper.appendChild(imageContainer);
        } else {
          itemWrapper.appendChild(mediaElement);
        }
      } else {
        mediaElement = document.createElement('div');
        mediaElement.textContent = `不支援的媒體類型: ${item.type}`;
        itemWrapper.appendChild(mediaElement);
      }
      
      if (item.type !== 'image' || !sectionKey.startsWith('carousel_')) {
        itemWrapper.appendChild(mediaElement);
      }
      
      targetInnerCarousel.appendChild(itemWrapper);
    });
    
    // 初始化輪播
    if (contentItems.length > 0 && slideInterval > 0) {
      initializeGenericCarousel(wrapperToInitialize, slideInterval);
      console.log(`區塊 ${sectionKey} 已啟用輪播，間隔 ${slideInterval / 1000} 秒，項目數: ${contentItems.length}`);
    } else if (contentItems.length === 1) {
      console.log(`區塊 ${sectionKey} 顯示單一內容。`);
      // 確保單一影片播放
      const singleVideo = targetInnerCarousel.querySelector('video');
      if (singleVideo) {
        singleVideo.play().catch(e => {
          if (e.name !== 'AbortError') {
            console.warn(`單一影片 ${sectionKey} 自動播放失敗:`, e.name, e.message);
          }
        });
      }
    }
    
  } catch (error) {
    console.error(`更新區塊 ${sectionKey} 時發生錯誤:`, error);
  }
}

// WebSocket 初始化
function initializeWebSocket() {
  try {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log('🔌 正在連接 WebSocket:', wsUrl);
    
    const socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
      console.log('✅ WebSocket 連接成功');
    };
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 收到 WebSocket 訊息:', data);
        
        if (data.type === 'playlist_updated' || data.type === 'media_updated') {
          console.log('🔄 媒體更新，重新載入...');
          fetchMediaData().then(updateAllSections);
        } else if (data.content) {
          // 顯示廣播訊息（如果有廣播訊息元素的話）
          console.log('📢 收到廣播訊息:', data.content);
        }
      } catch (error) {
        console.error('❌ WebSocket 訊息解析失敗:', error);
      }
    };
    
    socket.onclose = () => {
      console.log('❌ WebSocket 連接關閉');
      // 5秒後重新連接
      setTimeout(initializeWebSocket, 5000);
    };
    
    socket.onerror = (error) => {
      console.error('❌ WebSocket 錯誤:', error);
    };
    
  } catch (error) {
    console.error('WebSocket 初始化失敗:', error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  fetchMediaData().then(updateAllSections);
  initializeWebSocket();
});
// Instagram Post Extractor - Main Application Logic
// v1.1.0

// Type definitions for CDN globals assumed to be loaded
// lucide, Tesseract

// Initialize Lucide icons
function initIcons() {
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Wait for Lucide to load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initIcons);
} else {
    initIcons();
}

// Elements
const igUrlInput = document.getElementById('ig-url');
const extractBtn = document.getElementById('extract-btn');
const resultSection = document.getElementById('result-container');
const postImage = document.getElementById('post-image');
const imagePlaceholder = document.getElementById('image-placeholder');
const imageLoader = document.getElementById('image-loader');
const carouselContainer = document.getElementById('carousel-container');
const postDescription = document.getElementById('post-description');
const ocrText = document.getElementById('ocr-text');
const runOcrBtn = document.getElementById('run-ocr-btn');
const ocrStatus = document.getElementById('ocr-status');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const copyBtns = document.querySelectorAll('.copy-btn');

// State
let currentImages = [];
let activeImageIndex = 0;

// Tab switching logic
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        tabContents.forEach(content => {
            content.classList.add('hidden');
            if (content.id === `${tabId}-tab`) {
                content.classList.remove('hidden');
            }
        });
    });
});

// Copy logic
copyBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
        const targetId = btn.dataset.target;
        if (!targetId) return;
        const textarea = document.getElementById(targetId);
        if (!textarea.value) return;

        try {
            await navigator.clipboard.writeText(textarea.value);
            const span = btn.querySelector('span');
            if (span) {
                const originalText = span.textContent;
                span.textContent = 'Copied!';
                setTimeout(() => {
                    span.textContent = originalText;
                }, 2000);
            }
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    });
});

/**
 * Detects if a URL is a direct image link or from a known media proxy
 */
function isDirectImageUrl(url) {
    const directImageRegex = /\.(jpg|jpeg|png|webp|gif|avif|heic)/i;
    const commonHosts = /unsplash\.com|picsum\.photos|fastdl\.app/i;
    return directImageRegex.test(url) || commonHosts.test(url);
}

/**
 * Returns a proxied URL to bypass CORS for images
 */
function getProxiedUrl(url) {
    if (!url) return '';
    // Use AllOrigins RAW for best compatibility with images
    return `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
}

// Instagram Data Extraction with Retry and Fallback
async function fetchIGDataWithProxy(url, retries = 2) {
    const urls = url.split(/[\s,]+/).filter(u => u.length > 5);

    // If we have multiple URLs or direct image URLs, process them differently
    if (urls.length > 1 || isDirectImageUrl(urls[0])) {
        const images = urls.filter(u => isDirectImageUrl(u));
        if (images.length > 0) {
            return {
                images: images,
                description: 'Direct image extraction. No Instagram metadata available.'
            };
        }
    }

    const cleanUrl = urls[0].split('?')[0];
    if (!cleanUrl.includes('instagram.com/p/') && !cleanUrl.includes('instagram.com/reels/')) {
        throw new Error('Please enter a valid Instagram post or reel URL.');
    }

    // List of proxies to try
    let proxies = [
        {
            name: 'CodeTabs',
            url: (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
            parse: (res) => res
        },
        {
            name: 'AllOrigins (RAW)',
            url: (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}&ts=${Date.now()}`,
            parse: (res) => res
        },
        {
            name: 'AllOrigins (GET)',
            url: (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}&ts=${Date.now()}`,
            parse: (res) => res.contents
        },
        {
            name: 'YACDN',
            url: (u) => `https://yacdn.org/proxy/${encodeURIComponent(u)}`,
            parse: (res) => res
        }
    ];

    // Persistence: Prioritize the last successful proxy
    const lastSuccess = localStorage.getItem('last_success_proxy');
    if (lastSuccess) {
        const index = proxies.findIndex(p => p.name === lastSuccess);
        if (index > 0) {
            const [successProxy] = proxies.splice(index, 1);
            proxies.unshift(successProxy);
            console.log(`Prioritizing last successful proxy: ${lastSuccess}`);
        }
    }

    let lastError;

    for (let i = 0; i < retries; i++) {
        for (const proxy of proxies) {
            try {
                console.log(`Trying proxy: ${proxy.name} (Attempt ${i + 1})`);
                const response = await fetch(proxy.url(cleanUrl));

                if (!response.ok) {
                    console.warn(`${proxy.name} failed with status: ${response.status}`);
                    continue;
                }

                let content;
                const contentType = response.headers.get('content-type');

                if (contentType && contentType.includes('application/json')) {
                    const data = await response.json();
                    content = proxy.parse(data);
                } else {
                    content = await response.text();
                }

                if (!content || typeof content !== 'string' || content.length < 200) {
                    console.warn(`${proxy.name} returned invalid or suspicious content (length: ${content?.length || 0}).`);
                    continue;
                }

                const parser = new DOMParser();
                const doc = parser.parseFromString(content, 'text/html');

                const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
                const ogDescription = doc.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
                    doc.querySelector('meta[name="description"]')?.getAttribute('content');

                if (ogImage) {
                    // Check if we got redirected to the login page (common for bots)
                    const title = doc.querySelector('title')?.textContent || '';
                    const isLoginPage = title.toLowerCase().includes('login') ||
                        (ogDescription && ogDescription.toLowerCase().includes('log in')) ||
                        ogImage.includes('gsyc6v');

                    if (!isLoginPage) {
                        localStorage.setItem('last_success_proxy', proxy.name);
                        return {
                            images: [ogImage],
                            description: ogDescription || 'No description found.'
                        };
                    } else {
                        console.warn(`${proxy.name} hit the Instagram login wall.`);
                    }
                }
            } catch (err) {
                console.error(`${proxy.name} fetch error:`, err);
                lastError = err;
            }
        }
        console.log(`Retry ${i + 1} exhausted. Waiting 3s...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    throw new Error('All extraction attempts failed. This can happen if the proxy services are overloaded or the post is private.');
}

// Inline Message System (Replacing alert per Zero Pop-up Policy)
function showMessage(msg, type = 'info') {
    const statusDiv = document.createElement('div');
    statusDiv.className = `inline-message ${type}`;
    statusDiv.textContent = msg;

    const container = document.querySelector('.input-section');
    const existing = container.querySelector('.inline-message');
    if (existing) existing.remove();

    container.appendChild(statusDiv);
    setTimeout(() => {
        statusDiv.style.opacity = '0';
        setTimeout(() => statusDiv.remove(), 500);
    }, 5000);
}

// OCR Logic
async function runOCR(imageSrc) {
    ocrStatus.innerHTML = '<span class="loader-sm"></span><span>Running OCR...</span>';
    runOcrBtn.disabled = true;
    ocrText.value = '';

    try {
        const result = await Tesseract.recognize(imageSrc, 'eng', {
            logger: (m) => {
                if (m.status === 'recognizing text') {
                    const span = ocrStatus.querySelector('span:last-child');
                    if (span) span.textContent = `Scanning: ${Math.round(m.progress * 100)}%`;
                }
            }
        });

        ocrText.value = result.data.text;
        ocrStatus.innerHTML = '<i data-lucide="check-circle"></i><span>OCR Complete</span>';
        initIcons();
    } catch (err) {
        console.error('OCR Error:', err);
        ocrStatus.innerHTML = '<span class="error">OCR failed. Image may have CORS restrictions.</span>';
    } finally {
        runOcrBtn.disabled = false;
    }
}

/**
 * Updates the main preview image and UI state
 */
function updateActiveImage(index) {
    if (!currentImages[index]) return;

    activeImageIndex = index;
    const url = currentImages[index];

    imageLoader.classList.remove('hidden');
    postImage.classList.add('hidden');
    imagePlaceholder.classList.add('hidden');

    // Reset OCR status when switching images
    ocrStatus.innerHTML = '<i data-lucide="scan"></i><span>Click extract to start OCR</span>';
    ocrText.value = '';
    initIcons();

    const proxiedImg = getProxiedUrl(url);
    postImage.src = proxiedImg;

    postImage.onload = () => {
        imageLoader.classList.add('hidden');
        postImage.classList.remove('hidden');
        runOcrBtn.disabled = false;
    };

    postImage.onerror = () => {
        imageLoader.classList.add('hidden');
        imagePlaceholder.classList.remove('hidden');
        imagePlaceholder.innerHTML = '<i data-lucide="alert-circle"></i><span>Image Proxy Error</span>';
        initIcons();
        showMessage('Could not load this image via proxy.', 'error');
    };

    // Update thumbnail selection
    document.querySelectorAll('.carousel-thumb').forEach((thumb, i) => {
        thumb.classList.toggle('active', i === index);
    });
}

/**
 * Renders multiple thumbnails if a post has multiple images
 */
function renderCarousel(images) {
    carouselContainer.innerHTML = '';
    if (images.length <= 1) {
        carouselContainer.classList.add('hidden');
        return;
    }

    carouselContainer.classList.remove('hidden');
    images.forEach((url, index) => {
        const thumb = document.createElement('div');
        thumb.className = `carousel-thumb ${index === 0 ? 'active' : ''}`;
        thumb.innerHTML = `<img src="${getProxiedUrl(url)}" alt="Thumb ${index + 1}">`;
        thumb.addEventListener('click', () => updateActiveImage(index));
        carouselContainer.appendChild(thumb);
    });
}

// Extraction Trigger
extractBtn.addEventListener('click', async () => {
    const url = igUrlInput.value.trim();
    if (!url) return;

    extractBtn.disabled = true;
    resultSection.classList.remove('hidden');
    imageLoader.classList.remove('hidden');
    postImage.classList.add('hidden');
    imagePlaceholder.classList.add('hidden');
    carouselContainer.classList.add('hidden');
    postDescription.value = '';
    ocrText.value = '';
    runOcrBtn.disabled = true;

    try {
        const data = await fetchIGDataWithProxy(url);

        currentImages = data.images;
        postDescription.value = data.description;

        renderCarousel(currentImages);
        updateActiveImage(0);

        extractBtn.disabled = false;

    } catch (err) {
        console.error('Extraction Error:', err);
        showMessage(err.message || 'An error occurred.', 'error');
        resultSection.classList.add('hidden');
        extractBtn.disabled = false;
    }
});

// Keyboard Trigger (Enter Key)
igUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        extractBtn.click();
    }
});

runOcrBtn.addEventListener('click', () => {
    const imageUrl = currentImages[activeImageIndex];
    if (imageUrl) {
        runOCR(getProxiedUrl(imageUrl));
    }
});

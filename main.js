/**
 * Instagram Post Extractor — Main Application Logic
 * v0.0.1 (Beta) — Rebuilt from scratch
 *
 * Features:
 *   - Instagram post/reel metadata extraction via CORS proxies
 *   - Direct image URL support (with comma-separated multi-URL input)
 *   - Carousel UI for multi-image posts
 *   - OCR via Tesseract.js
 *   - Inline messaging (zero pop-up policy)
 *   - Proxy persistence via localStorage
 */

// ──────────────────────────────────────────────
// Icon Initialization
// ──────────────────────────────────────────────

/** Safely initialize Lucide icons */
function initIcons() {
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initIcons);
} else {
    initIcons();
}

// ──────────────────────────────────────────────
// DOM References
// ──────────────────────────────────────────────

const dom = {
    urlInput: document.getElementById('ig-url'),
    extractBtn: document.getElementById('extract-btn'),
    resultContainer: document.getElementById('result-container'),
    postImage: document.getElementById('post-image'),
    imagePlaceholder: document.getElementById('image-placeholder'),
    imageLoader: document.getElementById('image-loader'),
    carouselContainer: document.getElementById('carousel-container'),
    postDescription: document.getElementById('post-description'),
    ocrText: document.getElementById('ocr-text'),
    runOcrBtn: document.getElementById('run-ocr-btn'),
    ocrStatus: document.getElementById('ocr-status'),
    inputSection: document.getElementById('input-section'),
    // FastDL Helper
    fastdlHelper: document.getElementById('fastdl-helper'),
    fastdlOpenBtn: document.getElementById('fastdl-open-btn'),
    fastdlUrls: document.getElementById('fastdl-urls'),
    fastdlLoadBtn: document.getElementById('fastdl-load-btn'),
};

const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const copyBtns = document.querySelectorAll('.btn-copy');

// ──────────────────────────────────────────────
// Application State
// ──────────────────────────────────────────────

let currentImages = [];
let activeImageIndex = 0;

// ──────────────────────────────────────────────
// Tab Switching
// ──────────────────────────────────────────────

tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;

        tabBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        tabContents.forEach((content) => {
            content.classList.toggle('hidden', content.id !== `${tabId}-tab`);
        });
    });
});

// ──────────────────────────────────────────────
// Copy to Clipboard
// ──────────────────────────────────────────────

copyBtns.forEach((btn) => {
    btn.addEventListener('click', async () => {
        const targetId = btn.dataset.target;
        if (!targetId) return;

        const textarea = document.getElementById(targetId);
        if (!textarea || !textarea.value) return;

        try {
            await navigator.clipboard.writeText(textarea.value);
            const label = btn.querySelector('span');
            if (label) {
                const original = label.textContent;
                label.textContent = 'Copied!';
                setTimeout(() => { label.textContent = original; }, 2000);
            }
        } catch (err) {
            console.error('Clipboard write failed:', err);
        }
    });
});

// ──────────────────────────────────────────────
// URL Helpers
// ──────────────────────────────────────────────

/**
 * Detects whether a URL points directly to an image file
 * or is served from a known image proxy/CDN.
 * @param {string} url
 * @returns {boolean}
 */
function isDirectImageUrl(url) {
    const imageExtPattern = /\.(jpg|jpeg|png|webp|gif|avif|heic)/i;
    const knownImageHosts = /unsplash\.com|picsum\.photos|fastdl\.app/i;
    return imageExtPattern.test(url) || knownImageHosts.test(url);
}

/**
 * Wraps a URL through AllOrigins RAW to bypass CORS for images.
 * @param {string} url
 * @returns {string}
 */
function getProxiedUrl(url) {
    if (!url) return '';
    return `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
}

// ──────────────────────────────────────────────
// Inline Message System (Zero Pop-up Policy)
// ──────────────────────────────────────────────

/**
 * Displays a dismissable inline message below the input section.
 * @param {string} message
 * @param {'info'|'error'|'success'} type
 */
function showMessage(message, type = 'info') {
    // Remove any existing message first
    const existing = dom.inputSection.querySelector('.inline-msg');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.className = `inline-msg inline-msg--${type}`;
    el.textContent = message;

    dom.inputSection.appendChild(el);

    setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 500);
    }, 5000);
}

// ──────────────────────────────────────────────
// Instagram Data Extraction
// ──────────────────────────────────────────────

/** CORS proxy definitions */
const PROXIES = [
    {
        name: 'CodeTabs',
        buildUrl: (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
        parse: (res) => res,
    },
    {
        name: 'AllOrigins (RAW)',
        buildUrl: (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}&ts=${Date.now()}`,
        parse: (res) => res,
    },
    {
        name: 'AllOrigins (GET)',
        buildUrl: (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}&ts=${Date.now()}`,
        parse: (res) => res.contents,
    },
    {
        name: 'YACDN',
        buildUrl: (u) => `https://yacdn.org/proxy/${encodeURIComponent(u)}`,
        parse: (res) => res,
    },
];

/**
 * Extracts Instagram post metadata through CORS proxies with retry logic.
 * Supports direct image URLs and comma-separated multi-URL input.
 *
 * @param {string} rawInput - User-entered URL string
 * @param {number} retries  - Number of retry passes over all proxies
 * @returns {Promise<{images: string[], description: string}>}
 */
async function fetchIGDataWithProxy(rawInput, retries = 2) {
    const urls = rawInput.split(/[\s,]+/).filter((u) => u.length > 5);

    // Direct image mode: skip proxy scraping entirely
    if (urls.length > 1 || isDirectImageUrl(urls[0])) {
        const images = urls.filter(isDirectImageUrl);
        if (images.length > 0) {
            return {
                images,
                description: 'Direct image extraction — no Instagram metadata available.',
            };
        }
    }

    // Validate Instagram URL
    const cleanUrl = urls[0].split('?')[0];
    if (!cleanUrl.includes('instagram.com/p/') && !cleanUrl.includes('instagram.com/reels/')) {
        throw new Error('Please enter a valid Instagram post or reel URL.');
    }

    // Build ordered proxy list, prioritizing last successful proxy
    const proxies = [...PROXIES];
    const lastSuccess = localStorage.getItem('ipe_last_proxy');
    if (lastSuccess) {
        const idx = proxies.findIndex((p) => p.name === lastSuccess);
        if (idx > 0) {
            const [preferred] = proxies.splice(idx, 1);
            proxies.unshift(preferred);
            console.log(`[Proxy] Prioritizing: ${lastSuccess}`);
        }
    }

    let lastError;

    for (let attempt = 0; attempt < retries; attempt++) {
        for (const proxy of proxies) {
            try {
                console.log(`[Proxy] Trying ${proxy.name} (attempt ${attempt + 1})`);
                const response = await fetch(proxy.buildUrl(cleanUrl));

                if (!response.ok) {
                    console.warn(`[Proxy] ${proxy.name} → HTTP ${response.status}`);
                    continue;
                }

                // Parse response based on content type
                let content;
                const ct = response.headers.get('content-type');

                if (ct && ct.includes('application/json')) {
                    const data = await response.json();
                    content = proxy.parse(data);
                } else {
                    content = await response.text();
                }

                if (!content || typeof content !== 'string' || content.length < 200) {
                    console.warn(`[Proxy] ${proxy.name} → suspicious response (${content?.length || 0} chars)`);
                    continue;
                }

                // Extract OG meta tags
                const doc = new DOMParser().parseFromString(content, 'text/html');
                const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
                const ogDesc = doc.querySelector('meta[property="og:description"]')?.getAttribute('content')
                    || doc.querySelector('meta[name="description"]')?.getAttribute('content');

                if (ogImage) {
                    // Detect Instagram login wall
                    const title = doc.querySelector('title')?.textContent || '';
                    const isLoginWall = title.toLowerCase().includes('login')
                        || (ogDesc && ogDesc.toLowerCase().includes('log in'))
                        || ogImage.includes('gsyc6v');

                    if (!isLoginWall) {
                        localStorage.setItem('ipe_last_proxy', proxy.name);
                        return {
                            images: [ogImage],
                            description: ogDesc || 'No description found.',
                        };
                    }
                    console.warn(`[Proxy] ${proxy.name} → hit Instagram login wall`);
                }
            } catch (err) {
                console.error(`[Proxy] ${proxy.name} error:`, err);
                lastError = err;
            }
        }

        console.log(`[Proxy] Attempt ${attempt + 1} exhausted. Waiting 3s…`);
        await new Promise((r) => setTimeout(r, 3000));
    }

    throw new Error(
        'FASTDL_FALLBACK::' + cleanUrl
    );
}

// ──────────────────────────────────────────────
// OCR Engine
// ──────────────────────────────────────────────

/**
 * Runs Tesseract OCR on the given image source.
 * @param {string} imageSrc - URL of the image to scan
 */
async function runOCR(imageSrc) {
    dom.ocrStatus.innerHTML = '<span class="loader-sm"></span><span>Running OCR…</span>';
    dom.runOcrBtn.disabled = true;
    dom.ocrText.value = '';

    try {
        const result = await Tesseract.recognize(imageSrc, 'eng', {
            logger: (m) => {
                if (m.status === 'recognizing text') {
                    const span = dom.ocrStatus.querySelector('span:last-child');
                    if (span) span.textContent = `Scanning: ${Math.round(m.progress * 100)}%`;
                }
            },
        });

        dom.ocrText.value = result.data.text;
        dom.ocrStatus.innerHTML = '<i data-lucide="check-circle"></i><span>OCR Complete</span>';
        initIcons();
    } catch (err) {
        console.error('OCR error:', err);
        dom.ocrStatus.innerHTML = '<span class="error">OCR failed — image may have CORS restrictions.</span>';
    } finally {
        dom.runOcrBtn.disabled = false;
    }
}

// ──────────────────────────────────────────────
// Carousel
// ──────────────────────────────────────────────

/**
 * Updates the main preview to show the image at the given index.
 * @param {number} index
 */
function updateActiveImage(index) {
    if (!currentImages[index]) return;

    activeImageIndex = index;
    const url = currentImages[index];

    dom.imageLoader.classList.remove('hidden');
    dom.postImage.classList.add('hidden');
    dom.imagePlaceholder.classList.add('hidden');

    // Reset OCR state
    dom.ocrStatus.innerHTML = '<i data-lucide="scan"></i><span>Run OCR to extract text from the image</span>';
    dom.ocrText.value = '';
    initIcons();

    const proxiedUrl = getProxiedUrl(url);
    dom.postImage.src = proxiedUrl;

    dom.postImage.onload = () => {
        dom.imageLoader.classList.add('hidden');
        dom.postImage.classList.remove('hidden');
        dom.runOcrBtn.disabled = false;
    };

    dom.postImage.onerror = () => {
        dom.imageLoader.classList.add('hidden');
        dom.imagePlaceholder.classList.remove('hidden');
        dom.imagePlaceholder.innerHTML =
            '<i data-lucide="alert-circle"></i><span>Could not load image</span>';
        initIcons();
        showMessage('Could not load this image via the proxy.', 'error');
    };

    // Update thumbnail highlights
    document.querySelectorAll('.carousel-thumb').forEach((thumb, i) => {
        thumb.classList.toggle('active', i === index);
    });
}

/**
 * Renders carousel thumbnails when multiple images are available.
 * @param {string[]} images
 */
function renderCarousel(images) {
    dom.carouselContainer.innerHTML = '';

    if (images.length <= 1) {
        dom.carouselContainer.classList.add('hidden');
        return;
    }

    dom.carouselContainer.classList.remove('hidden');

    images.forEach((url, i) => {
        const thumb = document.createElement('div');
        thumb.className = `carousel-thumb${i === 0 ? ' active' : ''}`;
        thumb.innerHTML = `<img src="${getProxiedUrl(url)}" alt="Image ${i + 1}" />`;
        thumb.addEventListener('click', () => updateActiveImage(i));
        dom.carouselContainer.appendChild(thumb);
    });
}

// ──────────────────────────────────────────────
// Event Handlers
// ──────────────────────────────────────────────

/**
 * Shows the FastDL helper card with a pre-filled link to FastDL.
 * @param {string} igUrl - The original Instagram URL the user entered
 */
function showFastDLHelper(igUrl) {
    const fastdlUrl = `https://fastdl.app/en2?url=${encodeURIComponent(igUrl)}`;
    dom.fastdlOpenBtn.href = fastdlUrl;
    dom.fastdlHelper.classList.remove('hidden');
    dom.fastdlUrls.value = '';
    dom.fastdlUrls.focus();
    initIcons();
}

/** Hides the FastDL helper card */
function hideFastDLHelper() {
    dom.fastdlHelper.classList.add('hidden');
}

/**
 * Processes URLs pasted into the FastDL helper input.
 * Accepts comma-separated image URLs from FastDL or any source.
 */
function loadFastDLImages() {
    const raw = dom.fastdlUrls.value.trim();
    if (!raw) return;

    const urls = raw.split(/[\s,]+/).filter((u) => u.startsWith('http'));
    if (urls.length === 0) {
        showMessage('No valid URLs found. Paste the image addresses from FastDL.', 'error');
        return;
    }

    hideFastDLHelper();

    currentImages = urls;
    dom.postDescription.value = `Extracted ${urls.length} image(s) via FastDL helper.`;
    dom.resultContainer.classList.remove('hidden');

    renderCarousel(currentImages);
    updateActiveImage(0);
    showMessage(`Loaded ${urls.length} image(s) successfully.`, 'success');
}

/** Main extraction trigger */
dom.extractBtn.addEventListener('click', async () => {
    const url = dom.urlInput.value.trim();
    if (!url) return;

    hideFastDLHelper();
    dom.extractBtn.disabled = true;
    dom.resultContainer.classList.remove('hidden');
    dom.imageLoader.classList.remove('hidden');
    dom.postImage.classList.add('hidden');
    dom.imagePlaceholder.classList.add('hidden');
    dom.carouselContainer.classList.add('hidden');
    dom.postDescription.value = '';
    dom.ocrText.value = '';
    dom.runOcrBtn.disabled = true;

    try {
        const data = await fetchIGDataWithProxy(url);

        currentImages = data.images;
        dom.postDescription.value = data.description;

        renderCarousel(currentImages);
        updateActiveImage(0);
    } catch (err) {
        console.error('Extraction error:', err);

        // Check if this is a FastDL fallback trigger
        if (err.message && err.message.startsWith('FASTDL_FALLBACK::')) {
            const igUrl = err.message.replace('FASTDL_FALLBACK::', '');
            dom.resultContainer.classList.add('hidden');
            showFastDLHelper(igUrl);
            showMessage('Proxy extraction failed — use FastDL to extract images manually.', 'info');
        } else {
            showMessage(err.message || 'An unexpected error occurred.', 'error');
            dom.resultContainer.classList.add('hidden');
        }
    } finally {
        dom.extractBtn.disabled = false;
    }
});

/** Enter key triggers extraction */
dom.urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        dom.extractBtn.click();
    }
});

/** Run OCR on the currently active image */
dom.runOcrBtn.addEventListener('click', () => {
    const imageUrl = currentImages[activeImageIndex];
    if (imageUrl) {
        runOCR(getProxiedUrl(imageUrl));
    }
});

/** FastDL helper: Load Images button */
dom.fastdlLoadBtn.addEventListener('click', loadFastDLImages);

/** FastDL helper: Enter key triggers load */
dom.fastdlUrls.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loadFastDLImages();
});

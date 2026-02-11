// Instagram Post Extractor - Main Application Logic
// v1.0.1

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
const postDescription = document.getElementById('post-description');
const ocrText = document.getElementById('ocr-text');
const runOcrBtn = document.getElementById('run-ocr-btn');
const ocrStatus = document.getElementById('ocr-status');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const copyBtns = document.querySelectorAll('.copy-btn');

// State
let currentImageUrl = '';

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

// Instagram Data Extraction with Retry and Fallback
async function fetchIGDataWithProxy(url, retries = 2) {
    const cleanUrl = url.split('?')[0];
    if (!cleanUrl.includes('instagram.com/p/') && !cleanUrl.includes('instagram.com/reels/')) {
        throw new Error('Please enter a valid Instagram post or reel URL.');
    }

    // List of proxies to try
    const proxies = [
        {
            name: 'AllOrigins (GET)',
            url: (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}&ts=${Date.now()}`,
            parse: (res) => res.contents
        },
        {
            name: 'AllOrigins (RAW)',
            url: (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}&ts=${Date.now()}`,
            parse: (res) => res
        },
        {
            name: 'CORSProxy.io',
            url: (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
            parse: (res) => res
        },
        {
            name: 'CodeTabs',
            url: (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
            parse: (res) => res
        },
        {
            name: 'ThingProxy',
            url: (u) => `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(u)}`,
            parse: (res) => res
        }
    ];

    let lastError;

    for (let i = 0; i < retries; i++) {
        for (const proxy of proxies) {
            try {
                console.log(`Trying proxy: ${proxy.name}`);
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

                if (!content || typeof content !== 'string' || content.length < 100) {
                    console.warn(`${proxy.name} returned invalid or too short content.`);
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
                        return {
                            imageUrl: ogImage,
                            description: ogDescription || 'No description found.'
                        };
                    }
                }
            } catch (err) {
                lastError = err;
            }
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
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

// Extraction Trigger
extractBtn.addEventListener('click', async () => {
    const url = igUrlInput.value.trim();
    if (!url) return;

    extractBtn.disabled = true;
    resultSection.classList.remove('hidden');
    imageLoader.classList.remove('hidden');
    postImage.classList.add('hidden');
    imagePlaceholder.classList.add('hidden');
    postDescription.value = '';
    ocrText.value = '';
    runOcrBtn.disabled = true;

    try {
        const data = await fetchIGDataWithProxy(url);

        currentImageUrl = data.imageUrl;
        postDescription.value = data.description;

        const proxiedImg = `https://api.allorigins.win/raw?url=${encodeURIComponent(data.imageUrl)}`;
        postImage.src = proxiedImg;

        postImage.onload = () => {
            imageLoader.classList.add('hidden');
            postImage.classList.remove('hidden');
            runOcrBtn.disabled = false;
            extractBtn.disabled = false;
        };

        postImage.onerror = () => {
            imageLoader.classList.add('hidden');
            imagePlaceholder.classList.remove('hidden');
            imagePlaceholder.innerHTML = '<i data-lucide="alert-circle"></i><span>Image Proxy Error</span>';
            initIcons();
            extractBtn.disabled = false;
            showMessage('Could not load the image via proxy.', 'error');
        };

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
    if (currentImageUrl) {
        const proxiedImg = `https://api.allorigins.win/raw?url=${encodeURIComponent(currentImageUrl)}`;
        runOCR(proxiedImg);
    }
});

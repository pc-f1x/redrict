// Global variables
let username = '';
let userIP = '';
let videosLeft = 10;
let model = null;
let currentVideo = null;
let detectedObjects = [];
let videoHistory = [];
let isProcessing = false;
let settings = {
    detectionThreshold: 0.6,
    detectionFrequency: 5,
    highlightColor: '#FF0000',
    searchEngine: 'google',
    openNewTab: true,
    maxThreads: 4,
    useGPU: true,
    darkMode: false
};

// DOM elements
const loginContainer = document.getElementById('login-container');
const mainContainer = document.getElementById('main-container');
const usernameInput = document.getElementById('username-input');
const loginButton = document.getElementById('login-button');
const usernameDisplay = document.getElementById('username-display');
const videosLeftDisplay = document.getElementById('videos-left');
const videoUpload = document.getElementById('video-upload');
const videoElement = document.getElementById('video-element');
const detectionCanvas = document.getElementById('detection-canvas');
const progressContainer = document.querySelector('.progress-container');
const progressFill = document.querySelector('.progress-fill');
const progressText = document.querySelector('.progress-text');
const resultsContainer = document.querySelector('.results-container');
const objectsContainer = document.getElementById('objects-container');
const playButton = document.getElementById('play-button');
const pauseButton = document.getElementById('pause-button');
const videoScrubber = document.getElementById('video-scrubber');
const filterObjects = document.getElementById('filter-objects');
const sortObjects = document.getElementById('sort-objects');
const exportPresentation = document.getElementById('export-presentation');
const exportPDF = document.getElementById('export-pdf');
const historyList = document.getElementById('history-list');

// Navigation elements
const navHome = document.getElementById('nav-home');
const navHistory = document.getElementById('nav-history');
const navSettings = document.getElementById('nav-settings');
const homeSection = document.getElementById('home-section');
const historySection = document.getElementById('history-section');
const settingsSection = document.getElementById('settings-section');

// Settings elements
const detectionThreshold = document.getElementById('detection-threshold');
const thresholdValue = document.getElementById('threshold-value');
const detectionFrequency = document.getElementById('detection-frequency');
const frequencyValue = document.getElementById('frequency-value');
const highlightColor = document.getElementById('highlight-color');
const searchEngine = document.getElementById('search-engine');
const openNewTab = document.getElementById('open-new-tab');
const maxThreads = document.getElementById('max-processing-threads');
const threadsValue = document.getElementById('threads-value');
const useGPU = document.getElementById('use-gpu');
const darkMode = document.getElementById('dark-mode');
const saveSettings = document.getElementById('save-settings');
const resetSettings = document.getElementById('reset-settings');

// Initialize the application
async function init() {
    // Show loading screen animation
    const loadingScreen = document.getElementById('loading-screen');
    const loadingProgress = document.querySelector('.loading-progress');
    
    // Simulate progress for better user experience
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += Math.random() * 10;
        if (progress > 80) {
            clearInterval(progressInterval);
        }
        loadingProgress.style.width = `${Math.min(progress, 80)}%`;
    }, 300);
    
    // Get user's IP address (for demo purposes using a mock API)
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        userIP = data.ip;
    } catch (error) {
        console.error('Could not get IP address:', error);
        userIP = 'unknown';
    }

    // Check if user is already logged in (via localStorage)
    const savedUsername = localStorage.getItem('username');
    const savedIP = localStorage.getItem('userIP');
    
    if (savedUsername && savedIP === userIP) {
        username = savedUsername;
        login();
    }
    
    // Load video processing quota
    const lastReset = localStorage.getItem('quotaResetTime');
    const savedVideosLeft = localStorage.getItem('videosLeft');
    
    if (lastReset) {
        const resetTime = new Date(lastReset);
        const now = new Date();
        const hoursDiff = (now - resetTime) / (1000 * 60 * 60);
        
        if (hoursDiff >= 48) {
            // Reset quota after 48 hours
            videosLeft = 10;
            localStorage.setItem('quotaResetTime', now.toISOString());
            localStorage.setItem('videosLeft', videosLeft);
        } else if (savedVideosLeft) {
            videosLeft = parseInt(savedVideosLeft);
        }
    } else {
        localStorage.setItem('quotaResetTime', new Date().toISOString());
        localStorage.setItem('videosLeft', videosLeft);
    }
    
    // Load settings
    loadSettings();
    
    // Load history
    loadHistory();
    
    // Initialize TensorFlow.js model
    await loadModel();

    // Set up event listeners
    setupEventListeners();
    
    // Complete loading screen and hide it
    loadingProgress.style.width = '100%';
    setTimeout(() => {
        loadingScreen.style.display = 'none';
    }, 1000);
}

// Load TensorFlow.js model
async function loadModel() {
    try {
        // Configure TensorFlow.js to use GPU if available and enabled in settings
        if (settings.useGPU) {
            await tf.setBackend('webgl');
        } else {
            await tf.setBackend('cpu');
        }
        
        // Load COCO-SSD model
        console.log('Loading COCO-SSD model...');
        model = await cocoSsd.load();
        console.log('Model loaded successfully');
    } catch (error) {
        console.error('Error loading model:', error);
        alert('Error loading object detection model. Please try again later.');
    }
}

// Set up event listeners
function setupEventListeners() {
    // Login
    loginButton.addEventListener('click', () => {
        if (usernameInput.value.trim() !== '') {
            username = usernameInput.value.trim();
            localStorage.setItem('username', username);
            localStorage.setItem('userIP', userIP);
            login();
        } else {
            alert('Please enter a username');
        }
    });
    
    // Allow enter key for login
    usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && usernameInput.value.trim() !== '') {
            username = usernameInput.value.trim();
            localStorage.setItem('username', username);
            localStorage.setItem('userIP', userIP);
            login();
        }
    });
    
    // Navigation
    navHome.addEventListener('click', (e) => {
        e.preventDefault();
        showSection(homeSection);
        setActiveNav(navHome);
    });
    
    navHistory.addEventListener('click', (e) => {
        e.preventDefault();
        showSection(historySection);
        setActiveNav(navHistory);
        renderHistory();
    });
    
    navSettings.addEventListener('click', (e) => {
        e.preventDefault();
        showSection(settingsSection);
        setActiveNav(navSettings);
    });

    // Video upload
    videoUpload.addEventListener('change', handleVideoUpload);
    
    // Drag and drop for video upload
    const uploadBox = document.querySelector('.upload-box');
    
    uploadBox.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadBox.style.borderColor = 'var(--primary-color)';
        uploadBox.style.backgroundColor = 'rgba(66, 133, 244, 0.08)';
    });
    
    uploadBox.addEventListener('dragleave', () => {
        uploadBox.style.borderColor = 'var(--medium-gray)';
        uploadBox.style.backgroundColor = '';
    });
    
    uploadBox.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadBox.style.borderColor = 'var(--medium-gray)';
        uploadBox.style.backgroundColor = '';
        
        if (e.dataTransfer.files.length > 0 && e.dataTransfer.files[0].type.startsWith('video/')) {
            videoUpload.files = e.dataTransfer.files;
            handleVideoUpload();
        } else {
            alert('Please upload a supported video format');
        }
    });
    
    // Video controls
    videoElement.addEventListener('loadedmetadata', () => {
        videoScrubber.max = videoElement.duration;
    });
    
    videoElement.addEventListener('timeupdate', () => {
        videoScrubber.value = videoElement.currentTime;
        drawDetections(videoElement.currentTime);
    });
    
    playButton.addEventListener('click', () => {
        videoElement.play();
    });
    
    pauseButton.addEventListener('click', () => {
        videoElement.pause();
    });
    
    videoScrubber.addEventListener('input', () => {
        videoElement.currentTime = videoScrubber.value;
        drawDetections(videoElement.currentTime);
    });

    // Object filtering and sorting
    filterObjects.addEventListener('input', renderObjects);
    sortObjects.addEventListener('change', renderObjects);
    
    // Export options
    exportPresentation.addEventListener('click', exportToPresentation);
    exportPDF.addEventListener('click', exportToPDF);
    
    // Settings controls
    detectionThreshold.addEventListener('input', () => {
        thresholdValue.textContent = detectionThreshold.value;
    });
    
    detectionFrequency.addEventListener('input', () => {
        frequencyValue.textContent = detectionFrequency.value;
    });
    
    maxThreads.addEventListener('input', () => {
        threadsValue.textContent = maxThreads.value;
    });
    
    darkMode.addEventListener('change', () => {
        document.body.classList.toggle('dark-mode', darkMode.checked);
    });
    
    saveSettings.addEventListener('click', saveUserSettings);
    resetSettings.addEventListener('click', resetUserSettings);
}

// Handle login
function login() {
    loginContainer.classList.add('hidden');
    mainContainer.classList.remove('hidden');
    
    usernameDisplay.textContent = `Hello, ${username}`;
    videosLeftDisplay.textContent = `${videosLeft} videos left`;
    
    // Apply dark mode if enabled
    document.body.classList.toggle('dark-mode', settings.darkMode);
}

// Show selected section
function showSection(section) {
    homeSection.classList.add('hidden');
    historySection.classList.add('hidden');
    settingsSection.classList.add('hidden');
    
    section.classList.remove('hidden');
}

// Set active navigation
function setActiveNav(navItem) {
    navHome.classList.remove('active');
    navHistory.classList.remove('active');
    navSettings.classList.remove('active');
    
    navItem.classList.add('active');
}

// Handle video upload
function handleVideoUpload() {
    if (isProcessing) {
        alert('Please wait until the current processing is complete');
        return;
    }
    
    if (videosLeft <= 0) {
        alert('You have reached the maximum number of videos to process in the last 48 hours. Please try again later.');
        return;
    }
    
    const file = videoUpload.files[0];
    
    if (!file) {
        return;
    }
    
    if (!file.type.startsWith('video/')) {
        alert('Please upload a supported video format');
        return;
    }

    // Create URL for the video
    currentVideo = {
        file: file,
        url: URL.createObjectURL(file),
        name: file.name,
        timestamp: new Date()
    };
    
    // Set video source
    videoElement.src = currentVideo.url;
    
    // Show progress
    progressContainer.classList.remove('hidden');
    progressFill.style.width = '0%';
    progressText.textContent = 'Processing... 0%';
    isProcessing = true;
    
    // Process video
    processVideo(file);
}

// Process video for object detection
async function processVideo(videoFile) {
    if (!model) {
        alert('Object detection model did not load successfully. Please refresh the page and try again.');
        isProcessing = false;
        return;
    }
    
    try {
        // Clear previous detections
        detectedObjects = [];
        
        // Create a video element for processing
        const processingVideo = document.createElement('video');
        processingVideo.src = URL.createObjectURL(videoFile);
        processingVideo.muted = true;
        
        // Wait for video metadata to load
        await new Promise((resolve) => {
            processingVideo.onloadedmetadata = resolve;
        });
        
        // Get video dimensions and duration
        const videoWidth = processingVideo.videoWidth;
        const videoHeight = processingVideo.videoHeight;
        const videoDuration = processingVideo.duration;
        const frameCount = Math.floor(videoDuration * 30); // Assuming 30fps
        
        // Set up canvas for frame extraction
        const canvas = document.createElement('canvas');
        canvas.width = videoWidth;
        canvas.height = videoHeight;
        const ctx = canvas.getContext('2d');
        
        // Process frames at intervals based on settings
        const interval = parseInt(settings.detectionFrequency);
        const framesToProcess = Math.floor(frameCount / interval);
        
        for (let i = 0; i < framesToProcess; i++) {
            // Update progress
            const progress = Math.floor((i / framesToProcess) * 100);
            progressFill.style.width = `${progress}%`;
            progressText.textContent = `Processing... ${progress}%`;
            
            // Set video position
            const frameTime = (i * interval / 30);
            processingVideo.currentTime = frameTime;
            
            // Wait for seeked event
            await new Promise((resolve) => {
                processingVideo.onseeked = resolve;
            });
            
            // Draw frame to canvas
            ctx.drawImage(processingVideo, 0, 0, videoWidth, videoHeight);
            
            // Get frame data
            const imageData = ctx.getImageData(0, 0, videoWidth, videoHeight);
            
            // Run object detection
            const predictions = await model.detect(canvas, settings.detectionThreshold);
            
            // Process predictions
            for (const prediction of predictions) {
                // Extract object image
                const [x, y, width, height] = prediction.bbox;
                const objectCanvas = document.createElement('canvas');
                objectCanvas.width = width;
                objectCanvas.height = height;
                const objectCtx = objectCanvas.getContext('2d');
                objectCtx.drawImage(canvas, x, y, width, height, 0, 0, width, height);
                
                // Save object data
                detectedObjects.push({
                    type: prediction.class,
                    confidence: prediction.score,
                    time: frameTime,
                    timeFormatted: formatTime(frameTime),
                    image: objectCanvas.toDataURL('image/png'),
                    bbox: prediction.bbox
                });
            }
        }
        
        // Complete progress
        progressFill.style.width = '100%';
        progressText.textContent = 'Processing complete!';
        
        // Show results
        setTimeout(() => {
            progressContainer.classList.add('hidden');
            resultsContainer.classList.remove('hidden');
            
            // Set up canvas for live detection overlay
            const canvasContext = detectionCanvas.getContext('2d');
            detectionCanvas.width = videoWidth;
            detectionCanvas.height = videoHeight;
            
            // Verify and log objects
            console.log(`Processing complete. Found ${detectedObjects.length} objects.`);
            
            // Force DOM update before rendering objects
            requestAnimationFrame(() => {
                // Render detected objects
                renderObjects();
                
                // Update video quota
                videosLeft--;
                videosLeftDisplay.textContent = `${videosLeft} videos left`;
                localStorage.setItem('videosLeft', videosLeft);
                
                // Add to history
                addToHistory();
                
                isProcessing = false;
            });
        }, 1000);
        
    } catch (error) {
        console.error('Error processing video:', error);
        alert('An error occurred while processing the video. Please try again.');
        isProcessing = false;
    }
}

// Render detected objects
function renderObjects() {
    const filterValue = filterObjects.value.toLowerCase();
    const sortValue = sortObjects.value;
    
    // Debug info
    console.log(`Rendering ${detectedObjects.length} detected objects`);
    
    // Filter objects
    let filtered = detectedObjects;
    
    if (filterValue) {
        filtered = filtered.filter(obj => 
            obj.type.toLowerCase().includes(filterValue)
        );
    }
    
    // Sort objects
    switch (sortValue) {
        case 'confidence':
            filtered.sort((a, b) => b.confidence - a.confidence);
            break;
        case 'time':
            filtered.sort((a, b) => a.time - b.time);
            break;
        case 'type':
            filtered.sort((a, b) => a.type.localeCompare(b.type));
            break;
    }
    
    // Clear container
    objectsContainer.innerHTML = '';
    
    // Render objects
    if (filtered.length === 0) {
        objectsContainer.innerHTML = '<div class="no-objects">No objects match your search</div>';
        return;
    }
    
    console.log(`Displaying ${filtered.length} filtered objects`);
    
    // Render each object
    filtered.forEach((obj, index) => {
        const objectCard = document.createElement('div');
        objectCard.className = 'object-card';
        
        // Ensure the image data is valid
        let imgSrc = obj.image;
        if (!imgSrc || imgSrc === 'undefined' || imgSrc === 'null') {
            imgSrc = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNlMGUwZTAiLz48dGV4dCB4PSI1MCIgeT0iNTAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMCIgZmlsbD0iIzY2NjY2NiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSI+SW1hZ2UgTm90IEF2YWlsYWJsZTwvdGV4dD48L3N2Zz4='; // Fallback image
        }
        
        objectCard.innerHTML = `
            <img src="${imgSrc}" class="object-image" alt="${obj.type}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNlMGUwZTAiLz48dGV4dCB4PSI1MCIgeT0iNTAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMCIgZmlsbD0iIzY2NjY2NiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSI+SW1hZ2UgTm90IEF2YWlsYWJsZTwvdGV4dD48L3N2Zz4=';">
            <div class="object-info">
                <div class="object-type">${obj.type}</div>
                <div class="object-confidence">Confidence: ${Math.round(obj.confidence * 100)}%</div>
                <div class="object-time">Time: ${obj.timeFormatted}</div>
                <div class="object-actions">
                    <button class="search-object" data-index="${index}">Search Online</button>
                    <button class="jump-to-object" data-time="${obj.time}">Jump to Frame</button>
                </div>
            </div>
        `;
        
        objectsContainer.appendChild(objectCard);
        
        // Add event listeners to buttons
        objectCard.querySelector('.search-object').addEventListener('click', () => {
            searchObjectOnline(obj.image);
        });
        
        objectCard.querySelector('.jump-to-object').addEventListener('click', (e) => {
            const time = parseFloat(e.target.dataset.time);
            videoElement.currentTime = time;
            videoElement.pause();
        });
    });
}


// Draw detections on canvas for current video time
function drawDetections(currentTime) {
    const canvas = detectionCanvas;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Find objects at current time (with a small tolerance)
    const tolerance = 0.1; // seconds
    const relevantObjects = detectedObjects.filter(obj => 
        Math.abs(obj.time - currentTime) <= tolerance
    );
    
    // Draw bounding boxes
    ctx.strokeStyle = settings.highlightColor;
    ctx.lineWidth = 3;
    ctx.font = '16px Arial';
    ctx.fillStyle = settings.highlightColor;
    
    relevantObjects.forEach(obj => {
        const [x, y, width, height] = obj.bbox;
        
        // Draw rectangle
        ctx.strokeRect(x, y, width, height);
        
        // Draw label
        const labelText = `${obj.type} (${Math.round(obj.confidence * 100)}%)`;
        ctx.fillRect(x, y - 20, ctx.measureText(labelText).width + 10, 20);
        ctx.fillStyle = 'white';
        ctx.fillText(labelText, x + 5, y - 5);
        ctx.fillStyle = settings.highlightColor;
    });
}

// Search object image online
function searchObjectOnline(imageDataUrl) {
    const searchEngines = {
        google: 'https://www.google.com/searchbyimage?image_url=',
        bing: 'https://www.bing.com/images/search?view=detailv2&iss=sbi&form=SBIVSP&q=imgurl:',
        yandex: 'https://yandex.com/images/search?rpt=imageview&url='
    };
    
    // For demonstration, create a temporary link to use
    // In a real application, you'd need to upload the image to a server first
    
    // Get base search URL
    const searchUrl = searchEngines[settings.searchEngine];
    
    // Alert the user about the limitation
    alert('In a real application, the image would be uploaded to a server first, then searched. For this demo, we will just open the search engine.');
    
    // Open search engine
    if (settings.openNewTab) {
        window.open(searchUrl, '_blank');
    } else {
        window.location.href = searchUrl;
    }
}

// Add current video to history
function addToHistory() {
    const historyItem = {
        id: Date.now(),
        timestamp: new Date(),
        videoName: currentVideo.name,
        thumbnail: detectedObjects.length > 0 ? detectedObjects[0].image : null,
        objectCount: detectedObjects.length,
        objects: detectedObjects.map(obj => ({
            type: obj.type,
            confidence: obj.confidence,
            time: obj.time,
            timeFormatted: obj.timeFormatted,
            image: obj.image,
            bbox: obj.bbox
        }))
    };
    
    videoHistory.push(historyItem);
    
    // Save to localStorage
    localStorage.setItem('videoHistory', JSON.stringify(videoHistory));
}

// Render history
function renderHistory() {
    historyList.innerHTML = '';
    
    if (videoHistory.length === 0) {
        historyList.innerHTML = '<div class="no-history">No items in history</div>';
        return;
    }
    
    videoHistory.forEach(item => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        
        // Format date
        const date = new Date(item.timestamp);
        const dateString = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        
        historyItem.innerHTML = `
            <img src="${item.thumbnail || 'placeholder.jpg'}" class="history-thumbnail" alt="Thumbnail">
            <div class="history-info">
                <div class="history-filename">${item.videoName}</div>
                <div class="history-date">${dateString}</div>
                <div class="history-objects">Found ${item.objectCount} objects</div>
                <div class="history-actions">
                    <button class="view-history" data-id="${item.id}">View</button>
                    <button class="export-history" data-id="${item.id}">Export</button>
                    <button class="delete-history" data-id="${item.id}">Delete</button>
                </div>
            </div>
        `;
        
        historyList.appendChild(historyItem);
        
        // Add event listeners
        historyItem.querySelector('.view-history').addEventListener('click', () => {
            viewHistoryItem(item.id);
        });
        
        historyItem.querySelector('.export-history').addEventListener('click', () => {
            exportHistoryItem(item.id);
        });
        
        historyItem.querySelector('.delete-history').addEventListener('click', () => {
            deleteHistoryItem(item.id);
        });
    });
}

// View history item
function viewHistoryItem(id) {
    const item = videoHistory.find(item => item.id === id);
    
    if (!item) return;
    
    console.log(`Viewing history item with ID ${id}, contains ${item.objects.length} objects`);
    
    // Load objects from history
    detectedObjects = item.objects.map(obj => ({...obj})); // Make a deep copy
    
    // Show home section
    showSection(homeSection);
    setActiveNav(navHome);
    
    // Show results container
    resultsContainer.classList.remove('hidden');
    
    // Set up canvas for detection overlay
    const canvasContext = detectionCanvas.getContext('2d');
    detectionCanvas.width = 640;
    detectionCanvas.height = 360;
    
    // Add placeholder info to video element
    videoElement.src = '';
    const videoWrapper = document.querySelector('.video-wrapper');
    let placeholderMessage = videoWrapper.querySelector('.placeholder-message');
    
    if (!placeholderMessage) {
        placeholderMessage = document.createElement('div');
        placeholderMessage.className = 'placeholder-message';
        placeholderMessage.textContent = 'History view - detected objects shown below';
        videoWrapper.appendChild(placeholderMessage);
    }
    
    // Force a browser reflow before rendering objects
    objectsContainer.offsetHeight;
    
    // Trigger object rendering
    console.log("About to render objects from history");
    renderObjects();
}

// Export history item
function exportHistoryItem(id) {
    const item = videoHistory.find(item => item.id === id);
    
    if (!item) return;
    
    // Create export options dialog
    const dialog = document.createElement('div');
    dialog.className = 'export-dialog';
    dialog.innerHTML = `
        <div class="export-dialog-content">
            <h3>Export Item</h3>
            <button id="export-ppt">PowerPoint Presentation</button>
            <button id="export-pdf-dialog">PDF</button>
            <button id="cancel-export">Cancel</button>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Add event listeners
    dialog.querySelector('#export-ppt').addEventListener('click', () => {
        exportToPresentation(item.objects);
        document.body.removeChild(dialog);
    });
    
    dialog.querySelector('#export-pdf-dialog').addEventListener('click', () => {
        exportToPDF(item.objects);
        document.body.removeChild(dialog);
    });
    
    dialog.querySelector('#cancel-export').addEventListener('click', () => {
        document.body.removeChild(dialog);
    });
}

// Delete history item
function deleteHistoryItem(id) {
    if (confirm('Are you sure you want to delete this item from history?')) {
        videoHistory = videoHistory.filter(item => item.id !== id);
        localStorage.setItem('videoHistory', JSON.stringify(videoHistory));
        renderHistory();
    }
}

// Export to PowerPoint presentation
function exportToPresentation(objectsToExport = detectedObjects) {
    // Create new presentation
    const pptx = new PptxGenjs();
    
    // Add title slide
    const titleSlide = pptx.addSlide();
    titleSlide.addText('Object Detection', { x: 1, y: 1, w: 8, h: 1, fontSize: 24, bold: true, align: 'center' });
    titleSlide.addText(`Date: ${new Date().toLocaleDateString()}`, { x: 1, y: 2, w: 8, h: 0.5, fontSize: 14, align: 'center' });
    titleSlide.addText(`Found ${objectsToExport.length} objects`, { x: 1, y: 3, w: 8, h: 0.5, fontSize: 14, align: 'center' });
    
    // Group objects by type
    const objectsByType = {};
    objectsToExport.forEach(obj => {
        if (!objectsByType[obj.type]) {
            objectsByType[obj.type] = [];
        }
        objectsByType[obj.type].push(obj);
    });
    
    // Add slides for each object type
    for (const type in objectsByType) {
        const slide = pptx.addSlide();
        slide.addText(`Object: ${type}`, { x: 1, y: 0.5, w: 8, h: 0.5, fontSize: 18, bold: true, align: 'center' });
        
        // Add object images (up to 4 per slide for better quality)
        const objects = objectsByType[type];
        const objPerSlide = 4;
        const rows = 2;
        const cols = 2;
        
        for (let i = 0; i < Math.min(objects.length, objPerSlide); i++) {
            const obj = objects[i];
            const row = Math.floor(i / cols);
            const col = i % cols;
            
            // Adjust positioning for larger images
            const x = 1 + col * 4;
            const y = 1.2 + row * 4;
            
            // Add larger image with higher quality
            slide.addImage({
                data: obj.image,
                x: x,
                y: y,
                w: 3.5,
                h: 3.5,
                sizing: { type: 'contain', w: 3.5, h: 3.5 }
            });
            
            // Add info
            slide.addText(`Confidence: ${Math.round(obj.confidence * 100)}%\nTime: ${obj.timeFormatted}`, {
                x: x,
                y: y + 3.6,
                w: 3.5,
                h: 0.5,
                fontSize: 12,
                align: 'center'
            });
        }
        
        // If more than 4 objects, create additional slides
        if (objects.length > objPerSlide) {
            for (let i = objPerSlide; i < objects.length; i += objPerSlide) {
                const additionalSlide = pptx.addSlide();
                additionalSlide.addText(`Object: ${type} (continued)`, { x: 1, y: 0.5, w: 8, h: 0.5, fontSize: 18, bold: true, align: 'center' });
                
                for (let j = 0; j < Math.min(objPerSlide, objects.length - i); j++) {
                    const obj = objects[i + j];
                    const row = Math.floor(j / cols);
                    const col = j % cols;
                    
                    // Adjust positioning for larger images
                    const x = 1 + col * 4;
                    const y = 1.2 + row * 4;
                    
                    // Add larger image with higher quality
                    additionalSlide.addImage({
                        data: obj.image,
                        x: x,
                        y: y,
                        w: 3.5,
                        h: 3.5,
                        sizing: { type: 'contain', w: 3.5, h: 3.5 }
                    });
                    
                    // Add info
                    additionalSlide.addText(`Confidence: ${Math.round(obj.confidence * 100)}%\nTime: ${obj.timeFormatted}`, {
                        x: x,
                        y: y + 3.6,
                        w: 3.5,
                        h: 0.5,
                        fontSize: 12,
                        align: 'center'
                    });
                }
            }
        }
    }
    
    // Save presentation
    pptx.writeFile({ fileName: `Object-Detection-${new Date().toISOString().split('T')[0]}.pptx` });
}

// Export to PDF
function exportToPDF(objectsToExport = detectedObjects) {
    // Create new PDF
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });
    
    // Add title
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(24);
    pdf.text('Object Detection', 105, 20, { align: 'center' });
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(12);
    pdf.text(`Date: ${new Date().toLocaleDateString()}`, 105, 30, { align: 'center' });
    pdf.text(`Found ${objectsToExport.length} objects`, 105, 40, { align: 'center' });
    
    // Group objects by type
    const objectsByType = {};
    objectsToExport.forEach(obj => {
        if (!objectsByType[obj.type]) {
            objectsByType[obj.type] = [];
        }
        objectsByType[obj.type].push(obj);
    });
    
    let y = 60;
    let page = 1;
    
    // Add objects to PDF
    for (const type in objectsByType) {
        if (y > 250) {
            pdf.addPage();
            y = 20;
            page++;
        }
        
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(16);
        pdf.text(`Object: ${type}`, 105, y, { align: 'center' });
        y += 10;
        
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(12);
        
        const objects = objectsByType[type];
        for (let i = 0; i < objects.length; i++) {
            const obj = objects[i];
            
            if (y > 250) {
                pdf.addPage();
                y = 20;
                page++;
            }
            
            // Add image (as base64)
            try {
                pdf.addImage(obj.image, 'PNG', 70, y, 70, 70);
                
                // Add info
                pdf.text(`Confidence: ${Math.round(obj.confidence * 100)}%`, 105, y + 80, { align: 'center' });
                pdf.text(`Time: ${obj.timeFormatted}`, 105, y + 90, { align: 'center' });
                
                y += 100;
            } catch (error) {
                console.error('Error adding image to PDF:', error);
            }
        }
        
        y += 10;
    }
    
    // Save PDF
    pdf.save(`Object-Detection-${new Date().toISOString().split('T')[0]}.pdf`);
}

// Load settings from localStorage
function loadSettings() {
    const savedSettings = localStorage.getItem('settings');
    
    if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        settings = { ...settings, ...parsedSettings };
    }
    
    // Apply settings to UI
    detectionThreshold.value = settings.detectionThreshold;
    thresholdValue.textContent = settings.detectionThreshold;
    
    detectionFrequency.value = settings.detectionFrequency;
    frequencyValue.textContent = settings.detectionFrequency;
    
    highlightColor.value = settings.highlightColor;
    
    searchEngine.value = settings.searchEngine;
    
    openNewTab.checked = settings.openNewTab;
    
    maxThreads.value = settings.maxThreads;
    threadsValue.textContent = settings.maxThreads;
    
    useGPU.checked = settings.useGPU;
    
    darkMode.checked = settings.darkMode;
}

// Save user settings
function saveUserSettings() {
    settings.detectionThreshold = parseFloat(detectionThreshold.value);
    settings.detectionFrequency = parseInt(detectionFrequency.value);
    settings.highlightColor = highlightColor.value;
    settings.searchEngine = searchEngine.value;
    settings.openNewTab = openNewTab.checked;
    settings.maxThreads = parseInt(maxThreads.value);
    settings.useGPU = useGPU.checked;
    settings.darkMode = darkMode.checked;
    
    // Apply dark mode
    document.body.classList.toggle('dark-mode', settings.darkMode);
    
    // Save to localStorage
    localStorage.setItem('settings', JSON.stringify(settings));
    
    alert('Settings saved successfully');
}

// Reset user settings
function resetUserSettings() {
    if (confirm('Are you sure you want to reset all settings?')) {
        settings = {
            detectionThreshold: 0.6,
            detectionFrequency: 5,
            highlightColor: '#FF0000',
            searchEngine: 'google',
            openNewTab: true,
            maxThreads: 4,
            useGPU: true,
            darkMode: false
        };
        
        // Apply settings to UI
        detectionThreshold.value = settings.detectionThreshold;
        thresholdValue.textContent = settings.detectionThreshold;
        
        detectionFrequency.value = settings.detectionFrequency;
        frequencyValue.textContent = settings.detectionFrequency;
        
        highlightColor.value = settings.highlightColor;
        
        searchEngine.value = settings.searchEngine;
        
        openNewTab.checked = settings.openNewTab;
        
        maxThreads.value = settings.maxThreads;
        threadsValue.textContent = settings.maxThreads;
        
        useGPU.checked = settings.useGPU;
        
        darkMode.checked = settings.darkMode;
        
        // Apply dark mode
        document.body.classList.toggle('dark-mode', settings.darkMode);
        
        // Save to localStorage
        localStorage.setItem('settings', JSON.stringify(settings));
        
        alert('Settings reset successfully');
    }
}

// Load history from localStorage
function loadHistory() {
    const savedHistory = localStorage.getItem('videoHistory');
    
    if (savedHistory) {
        videoHistory = JSON.parse(savedHistory);
    }
}

// Format time as MM:SS
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Initialize the application
window.addEventListener('load', init);
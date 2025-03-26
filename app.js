// app.js - Main application logic

document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const tabs = document.querySelectorAll('[data-tab]');
    const tabContents = document.querySelectorAll('.tab-content');
    const loginContainer = document.getElementById('login-container');
    const mainContainer = document.getElementById('main-container');
    const loginBtn = document.getElementById('login-btn');
    const usernameInput = document.getElementById('username');
    const userGreeting = document.getElementById('user-greeting');
    const quotaInfo = document.getElementById('quota-info');
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    const analyzeBtn = document.getElementById('analyze-btn');
    const processingInfo = document.querySelector('.processing-info');
    const progress = document.getElementById('progress');
    const resultsContainer = document.querySelector('.results-container');
    const videoPlayer = document.getElementById('video-player');
    const objectsContainer = document.getElementById('objects-container');
    const downloadBtn = document.getElementById('download-btn');
    const newAnalysisBtn = document.getElementById('new-analysis-btn');
    const historyContainer = document.getElementById('history-container');
    const objectModal = document.getElementById('object-modal');
    const modalClose = document.querySelector('.close-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalImage = document.getElementById('modal-image');
    const modalType = document.getElementById('modal-type');
    const modalConfidence = document.getElementById('modal-confidence');
    const searchGoogleBtn = document.getElementById('search-google-btn');
    const searchBingBtn = document.getElementById('search-bing-btn');
    const searchYandexBtn = document.getElementById('search-yandex-btn');
    
    // Current data
    let currentUser = null;
    let currentFile = null;
    let currentAnalysisResults = null;
    let currentObjectData = null;
    
    // Check if user exists for this IP
    const checkUser = () => {
        currentUser = storageManager.getUserByIP();
        
        if (currentUser) {
            // User exists, show main container
            loginContainer.classList.add('hidden');
            mainContainer.classList.remove('hidden');
            
            // Update user information
            userGreeting.textContent = `שלום, ${currentUser.username}`;
            updateQuotaInfo();
            
            // Load history
            loadHistory();
        } else {
            // User doesn't exist, show login
            loginContainer.classList.remove('hidden');
            mainContainer.classList.add('hidden');
        }
    };
    
    // Update quota information
    const updateQuotaInfo = () => {
        if (!currentUser) return;
        
        const resetDate = new Date(currentUser.quota.resetTime);
        const resetDateStr = resetDate.toLocaleDateString('he-IL');
        const resetTimeStr = resetDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
        
        quotaInfo.textContent = `נותרו ${currentUser.quota.remaining} ניתוחים עד ${resetDateStr} ${resetTimeStr}`;
    };
    
    // Load history items
    const loadHistory = () => {
        const history = storageManager.getHistory();
        
        if (history.length === 0) {
            historyContainer.innerHTML = '<p class="empty-state">אין ניתוחים קודמים להצגה</p>';
            return;
        }
        
        historyContainer.innerHTML = '';
        
        history.forEach(item => {
            const date = new Date(item.date);
            const dateStr = date.toLocaleDateString('he-IL');
            const timeStr = date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
            
            const historyCard = document.createElement('div');
            historyCard.className = 'history-card';
            historyCard.dataset.id = item.id;
            
            historyCard.innerHTML = `
                <img src="${item.thumbnail}" alt="תמונה ממוזערת" class="history-thumbnail">
                <div class="history-details">
                    <h3>${item.fileName}</h3>
                    <p>נמצאו ${item.objectCount} אובייקטים</p>
                    <p class="history-date">${dateStr} ${timeStr}</p>
                </div>
            `;
            
            historyCard.addEventListener('click', () => {
                loadHistoryItem(item.id);
            });
            
            historyContainer.appendChild(historyCard);
        });
    };
    
    // Load history item
    const loadHistoryItem = (id) => {
        const item = storageManager.getHistoryItem(id);
        
        if (!item) return;
        
        // Set as current analysis
        currentAnalysisResults = item;
        
        // Switch to home tab
        document.querySelector('[data-tab="home"]').click();
        
        // Show results
        showAnalysisResults(item);
    };
    
    // Show analysis results
    const showAnalysisResults = (results) => {
        // Hide processing, show results
        processingInfo.classList.add('hidden');
        resultsContainer.classList.remove('hidden');
        
        // Update video player (if available)
        if (currentFile) {
            videoPlayer.src = URL.createObjectURL(currentFile);
        }
        
        // Clear previous objects
        objectsContainer.innerHTML = '';
        
        // Add object cards
        results.objects.forEach(object => {
            const objectCard = document.createElement('div');
            objectCard.className = 'object-card';
            
            objectCard.innerHTML = `
                <img src="${object.image}" alt="${object.class}" class="object-image">
                <div class="object-details">
                    <div class="object-type">${object.class}</div>
                    <div class="object-confidence">${Math.round(object.score * 100)}% ביטחון</div>
                </div>
            `;
            
            objectCard.addEventListener('click', () => {
                showObjectModal(object);
            });
            
            objectsContainer.appendChild(objectCard);
        });
    };
    
    // Show object modal
    const showObjectModal = (object) => {
        currentObjectData = object;
        
        modalTitle.textContent = object.class;
        modalImage.src = object.image;
        modalType.textContent = object.class;
        modalConfidence.textContent = Math.round(object.score * 100);
        
        // Update search buttons visibility based on settings
        const searchSettings = settingsManager.getSearchSettings();
        searchGoogleBtn.style.display = searchSettings.google ? 'flex' : 'none';
        searchBingBtn.style.display = searchSettings.bing ? 'flex' : 'none';
        searchYandexBtn.style.display = searchSettings.yandex ? 'flex' : 'none';
        
        objectModal.classList.remove('hidden');
    };
    
    // Tab switching
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked tab
            tab.classList.add('active');
            
            // Show corresponding content
            const tabName = tab.dataset.tab;
            document.getElementById(tabName).classList.add('active');
        });
    });
    
    // Login
    loginBtn.addEventListener('click', () => {
        const username = usernameInput.value.trim();
        
        if (username.length < 2) {
            alert('אנא הכנס שם משתמש תקין (לפחות 2 תווים)');
            return;
        }
        
        currentUser = storageManager.createUser(username);
        checkUser();
    });
    
    // File drop area
    dropArea.addEventListener('click', () => {
        fileInput.click();
    });
    
    dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropArea.classList.add('active');
    });
    
    dropArea.addEventListener('dragleave', () => {
        dropArea.classList.remove('active');
    });
    
    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dropArea.classList.remove('active');
        
        if (e.dataTransfer.files.length) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    });
    
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) {
            handleFileSelect(fileInput.files[0]);
        }
    });
    
    // Handle file selection
    const handleFileSelect = (file) => {
        // Check if it's a video file
        if (!file.type.startsWith('video/')) {
            alert('אנא בחר קובץ וידאו תקין');
            return;
        }
        
        currentFile = file;
        
        // Update UI
        dropArea.innerHTML = `
            <i class="fas fa-file-video"></i>
            <p>${file.name}</p>
        `;
        
        analyzeBtn.disabled = false;
    };
    
    // Analyze button
    analyzeBtn.addEventListener('click', () => {
        if (!currentFile || !currentUser) return;
        
        // Check quota
        if (currentUser.quota.remaining <= 0) {
            alert('חריגה ממכסת הניתוחים. אנא המתן עד לאיפוס המכסה.');
            return;
        }
        
        // Update quota
        if (!storageManager.updateUserQuota()) {
            alert('שגיאה בעדכון המכסה. אנא נסה שוב מאוחר יותר.');
            return;
        }
        
        updateQuotaInfo();
        
        // Show processing UI
        resultsContainer.classList.add('hidden');
        processingInfo.classList.remove('hidden');
        
        // Process the video
        objectDetector.processVideo(
            currentFile,
            // Progress callback
            (progressPercent) => {
                progress.textContent = `${Math.round(progressPercent)}%`;
            },
            // Completion callback
            (results) => {
                currentAnalysisResults = results;
                
                // Add to history
                storageManager.addToHistory(results);
                
                // Update history tab
                loadHistory();
                
                // Show results
                showAnalysisResults(results);
            }
        );
    });
    
    // Download button
    downloadBtn.addEventListener('click', () => {
        if (!currentAnalysisResults) return;
        
        objectDetector.generatePresentationExport(currentAnalysisResults);
    });
    
    // New analysis button
    newAnalysisBtn.addEventListener('click', () => {
        // Reset UI for new analysis
        currentFile = null;
        currentAnalysisResults = null;
        
        dropArea.innerHTML = `
            <i class="fas fa-cloud-upload-alt"></i>
            <p>גרור סרטון לכאן או לחץ לבחירת קובץ</p>
        `;
        
        analyzeBtn.disabled = true;
        resultsContainer.classList.add('hidden');
        processingInfo.classList.add('hidden');
    });
    
    // Modal close button
    modalClose.addEventListener('click', () => {
        objectModal.classList.add('hidden');
    });
    
    // Close modal when clicking outside
    objectModal.addEventListener('click', (e) => {
        if (e.target === objectModal) {
            objectModal.classList.add('hidden');
        }
    });
    
    // חיפוש בגוגל לפי תמונה
    searchGoogleBtn.addEventListener('click', () => {
        if (!currentObjectData) return;
        
        // שמור את התמונה באופן זמני וחפש עם גוגל
        const imageUrl = currentObjectData.image;
        saveImageAndSearch(imageUrl, 'google');
    });

    // חיפוש בבינג לפי תמונה
    searchBingBtn.addEventListener('click', () => {
        if (!currentObjectData) return;
        
        // שמור את התמונה באופן זמני וחפש עם בינג
        const imageUrl = currentObjectData.image;
        saveImageAndSearch(imageUrl, 'bing');
    });

    // חיפוש ביאנדקס לפי תמונה
    searchYandexBtn.addEventListener('click', () => {
        if (!currentObjectData) return;
        
        // שמור את התמונה באופן זמני וחפש עם יאנדקס
        const imageUrl = currentObjectData.image;
        saveImageAndSearch(imageUrl, 'yandex');
    });

    // פונקציה המאפשרת חיפוש לפי תמונה במנועי חיפוש
    function saveImageAndSearch(imageUrl, searchEngine) {
        // שלב 1: הורד את הקובץ בצורה זמנית
        fetch(imageUrl)
            .then(response => response.blob())
            .then(blob => {
                // שלב 2: העבר את המשתמש לדף החיפוש המתאים לפי התמונה
                
                // הכן שם קובץ מתאים
                const fileName = `object-image-${currentObjectData.class}-${Date.now()}.jpg`;
                
                // הורד את התמונה למחשב המשתמש
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = fileName;
                a.click();
                
                // חכה קצת להורדה
                setTimeout(() => {
                    // פתח את חיפוש התמונה בטאב חדש
                    if (searchEngine === 'google') {
                        window.open('https://images.google.com/searchbyimage', '_blank');
                        alert('הועברת לדף חיפוש תמונה בגוגל. אנא העלה את התמונה שנשמרה למחשבך (בדוק בתיקיית ההורדות).');
                    } 
                    else if (searchEngine === 'bing') {
                        window.open('https://www.bing.com/images/discover?FORM=ILPMFT', '_blank');
                        alert('הועברת לדף חיפוש תמונה בבינג. לחץ על סמל המצלמה והעלה את התמונה שנשמרה למחשבך.');
                    } 
                    else if (searchEngine === 'yandex') {
                        window.open('https://yandex.com/images/', '_blank');
                        alert('הועברת לדף חיפוש תמונה ביאנדקס. לחץ על סמל המצלמה והעלה את התמונה שנשמרה למחשבך.');
                    }
                    
                    // נקה את ה-URL
                    URL.revokeObjectURL(blobUrl);
                }, 500);
            })
            .catch(error => {
                console.error('שגיאה בחיפוש תמונה:', error);
                alert('שגיאה בעיבוד התמונה לחיפוש. אנא נסה שוב.');
            });
    }
    
    // Initialize
    checkUser();
});
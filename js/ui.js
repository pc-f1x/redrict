/**
 * טיפול בממשק משתמש, אירועים ואינטראקציות
 */
const UI = {
    // נתוני מצב
    state: {
        activeTab: 'uploadTab',
        isProcessing: false,
        videoSelected: false,
        currentSettings: null
    },
    
    /**
     * אתחול ממשק המשתמש
     * @returns {void}
     */
    init: function() {
        console.log('מאתחל ממשק משתמש...');
        
        // טעינת הגדרות ברירת מחדל אם CONFIG קיים
        if (window.CONFIG) {
            this.state.currentSettings = { ...CONFIG.defaults };
        } else {
            // הגדרות בסיסיות אם CONFIG חסר
            this.state.currentSettings = {
                confidenceThreshold: 0.6,
                frameSkip: 3,
                imageQuality: 'high',
                modelType: 'accurate',
                imageEnhancement: 'advanced',
                boundingBoxPadding: 15,
                deviceOptimization: true
            };
        }
        
        // חיבור מאזיני אירועים
        this.attachEventListeners();
        this.setupTabSystem();
        this.setupFileInput();
        this.setupSettingsUI();
        
        // אם UTILS קיים, השתמש בו לקבלת מידע מכשיר
        if (window.UTILS) {
            this.updateDeviceInfo();
            
            // בדיקת אופטימיזציה למכשיר
            const device = UTILS.detectDevice();
            if (device.isMobile) {
                this.applyMobileOptimizations();
            }
        } else {
            // עדכון מידע מערכת בסיסי
            document.getElementById('deviceInfoContent').textContent = 
                `דפדפן: ${navigator.userAgent}\nמסך: ${window.innerWidth}x${window.innerHeight}`;
        }
        
        console.log('ממשק משתמש אותחל בהצלחה');
    },
    
    /**
     * הוספת מאזיני אירועים
     * @returns {void}
     */
    attachEventListeners: function() {
        // כפתורי לשוניות
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.getAttribute('data-tab');
                this.openTab(tabName);
            });
        });
        
        // טיפול בהתראות
        document.querySelector('.notification-close').addEventListener('click', () => {
            this.hideNotification();
        });
        
        // כפתורי התחברות ועיבוד
        document.getElementById('loginButton').addEventListener('click', () => {
            if (window.APP && typeof APP.registerUser === 'function') {
                APP.registerUser();
            } else {
                // גישה ישירה אם APP לא קיים
                handleLogin();
            }
        });
        
        document.getElementById('processButton').addEventListener('click', () => {
            if (window.APP && typeof APP.processVideo === 'function') {
                APP.processVideo();
            } else {
                this.showNotification('לא ניתן לבצע עיבוד - מודול העיבוד לא נטען', 'error');
            }
        });
        
        document.getElementById('clearButton').addEventListener('click', () => {
            this.clearVideoSelection();
        });
        
        // כפתורי ייצוא
        document.getElementById('exportPdfBtn').addEventListener('click', () => {
            if (window.EXPORTS && typeof EXPORTS.generatePDF === 'function') {
                EXPORTS.generatePDF();
            } else {
                this.showNotification('מודול הייצוא לא נטען כראוי', 'error');
            }
        });
        
        document.getElementById('exportPptxBtn').addEventListener('click', () => {
            if (window.EXPORTS && typeof EXPORTS.generatePPTX === 'function') {
                EXPORTS.generatePPTX();
            } else {
                this.showNotification('מודול הייצוא לא נטען כראוי', 'error');
            }
        });
        
        document.getElementById('exportJsonBtn').addEventListener('click', () => {
            if (window.EXPORTS && typeof EXPORTS.exportJSON === 'function') {
                EXPORTS.exportJSON();
            } else {
                this.showNotification('מודול הייצוא לא נטען כראוי', 'error');
            }
        });
        
        // כפתורי הגדרות
        document.getElementById('resetSettingsBtn').addEventListener('click', () => {
            this.resetSettings();
        });
        
        document.getElementById('saveSettingsBtn').addEventListener('click', () => {
            this.saveSettings();
        });
        
        // מעבר ללשונית העלאה
        document.querySelector('[data-action="goto-upload"]').addEventListener('click', () => {
            this.openTab('uploadTab');
        });
        
        // אפקט Ripple לכפתורים
        document.querySelectorAll('.btn').forEach(btn => {
            btn.addEventListener('click', this.createRippleEffect);
        });
    },
    
    /**
     * הגדרת מערכת הלשוניות
     * @returns {void}
     */
    setupTabSystem: function() {
        // התאמת סליידר הלשוניות
        this.updateTabSlider();
        
        // התאמה בעת שינוי גודל חלון
        window.addEventListener('resize', () => {
            this.updateTabSlider();
        });
    },
    
    /**
     * עדכון סליידר הלשוניות
     * @returns {void}
     */
    updateTabSlider: function() {
        const activeTab = document.querySelector('.tab.active');
        const slider = document.querySelector('.tab-slider');
        
        if (activeTab && slider && window.innerWidth > 600) {
            slider.style.width = `${activeTab.offsetWidth}px`;
            slider.style.left = `${activeTab.offsetLeft}px`;
        }
    },
    
    /**
     * הגדרת שדה העלאת קבצים
     * @returns {void}
     */
    setupFileInput: function() {
        const dropArea = document.getElementById('fileDropArea');
        const videoInput = document.getElementById('videoInput');
        const videoPreview = document.getElementById('videoPreview');
        
        // מניעת התנהגות ברירת מחדל של גרירה
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, this.preventDefaults, false);
        });
        
        // עיצוב גרירה
        ['dragenter', 'dragover'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => {
                dropArea.style.backgroundColor = 'var(--primary-light)';
                dropArea.style.borderColor = 'var(--primary)';
            });
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => {
                dropArea.style.backgroundColor = 'rgba(255, 255, 255, 0.6)';
                dropArea.style.borderColor = 'var(--neutral-lighter)';
            });
        });
        
        // טיפול בקובץ שהועלה בגרירה
        dropArea.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            
            if (files.length > 0 && files[0].type.startsWith('video/')) {
                const maxSize = (window.CONFIG && CONFIG.app.maxVideoSize) || (500 * 1024 * 1024);
                
                if (files[0].size > maxSize) {
                    this.showNotification('הקובץ גדול מדי. גודל מקסימלי: 500MB', 'error');
                    return;
                }
                
                videoInput.files = files;
                this.handleVideoFile(files[0]);
            } else {
                this.showNotification('אנא העלה קובץ וידאו תקין', 'error');
            }
        });
        
        // טיפול בשינוי קובץ רגיל
        videoInput.addEventListener('change', () => {
            if (videoInput.files.length > 0) {
                const maxSize = (window.CONFIG && CONFIG.app.maxVideoSize) || (500 * 1024 * 1024);
                
                if (videoInput.files[0].size > maxSize) {
                    this.showNotification('הקובץ גדול מדי. גודל מקסימלי: 500MB', 'error');
                    videoInput.value = '';
                    return;
                }
                
                this.handleVideoFile(videoInput.files[0]);
            }
        });
    },
    
    /**
     * הגדרת ממשק הגדרות
     * @returns {void}
     */
    setupSettingsUI: function() {
        // טעינת הגדרות שמורות
        let savedSettings = null;
        
        if (window.UTILS && typeof UTILS.loadFromStorage === 'function') {
            savedSettings = UTILS.loadFromStorage('settings', this.state.currentSettings);
        } else {
            // ניסיון לטעון מלוקל סטורג' ישירות
            try {
                const storedSettings = localStorage.getItem('ai_vision_pro_settings');
                if (storedSettings) {
                    savedSettings = JSON.parse(storedSettings);
                }
            } catch (e) {
                console.warn('שגיאה בטעינת הגדרות:', e);
            }
        }
        
        if (savedSettings) {
            this.state.currentSettings = { ...this.state.currentSettings, ...savedSettings };
        }
        
        // עדכון ממשק המשתמש עם ההגדרות השמורות
        document.getElementById('confidenceThreshold').value = this.state.currentSettings.confidenceThreshold;
        document.getElementById('confidenceValue').textContent = this.state.currentSettings.confidenceThreshold;
        
        document.getElementById('frameSkip').value = this.state.currentSettings.frameSkip;
        document.getElementById('frameSkipValue').textContent = this.state.currentSettings.frameSkip;
        
        document.getElementById('boundingBoxPadding').value = this.state.currentSettings.boundingBoxPadding;
        document.getElementById('paddingValue').textContent = this.state.currentSettings.boundingBoxPadding;
        
        document.getElementById('imageQuality').value = this.state.currentSettings.imageQuality;
        document.getElementById('modelType').value = this.state.currentSettings.modelType;
        document.getElementById('imageEnhancement').value = this.state.currentSettings.imageEnhancement;
        document.getElementById('deviceOptimization').checked = this.state.currentSettings.deviceOptimization;
        
        // מאזיני אירועים להגדרות
        document.getElementById('confidenceThreshold').addEventListener('input', (e) => {
            document.getElementById('confidenceValue').textContent = e.target.value;
            this.state.currentSettings.confidenceThreshold = parseFloat(e.target.value);
        });
        
        document.getElementById('frameSkip').addEventListener('input', (e) => {
            document.getElementById('frameSkipValue').textContent = e.target.value;
            this.state.currentSettings.frameSkip = parseInt(e.target.value);
        });
        
        document.getElementById('boundingBoxPadding').addEventListener('input', (e) => {
            document.getElementById('paddingValue').textContent = e.target.value;
            this.state.currentSettings.boundingBoxPadding = parseInt(e.target.value);
        });
        
        document.getElementById('imageQuality').addEventListener('change', (e) => {
            this.state.currentSettings.imageQuality = e.target.value;
        });
        
        document.getElementById('modelType').addEventListener('change', (e) => {
            this.state.currentSettings.modelType = e.target.value;
        });
        
        document.getElementById('imageEnhancement').addEventListener('change', (e) => {
            this.state.currentSettings.imageEnhancement = e.target.value;
        });
        
        document.getElementById('deviceOptimization').addEventListener('change', (e) => {
            this.state.currentSettings.deviceOptimization = e.target.checked;
        });
    },
    
    /**
     * מניעת התנהגות ברירת מחדל
     * @param {Event} e אירוע
     * @returns {void}
     */
    preventDefaults: function(e) {
        e.preventDefault();
        e.stopPropagation();
    },
    
    /**
     * טיפול בקובץ וידאו שהועלה
     * @param {File} file קובץ וידאו
     * @returns {void}
     */
    handleVideoFile: function(file) {
        const url = URL.createObjectURL(file);
        const videoPreview = document.getElementById('videoPreview');
        videoPreview.src = url;
        videoPreview.style.display = 'block';
        
        // צפייה מקדימה במסגרת אזור הגרירה
        const dropArea = document.getElementById('fileDropArea');
        const icon = dropArea.querySelector('.file-input-icon');
        const text = dropArea.querySelector('.file-input-text');
        const subtext = dropArea.querySelector('.file-input-subtext');
        
        icon.style.display = 'none';
        text.style.display = 'none';
        subtext.style.display = 'none';
        
        // הצגת וידאו
        const videoContainer = document.getElementById('videoContainer');
        videoContainer.style.display = 'block';
        const video = document.getElementById('video');
        video.src = url;
        
        this.state.videoSelected = true;
        this.showNotification('וידאו נטען בהצלחה - לחץ על "נתח סרטון" להתחלת הזיהוי', 'success');
    },
    
    /**
     * ניקוי בחירת וידאו
     * @returns {void}
     */
    clearVideoSelection: function() {
        const videoInput = document.getElementById('videoInput');
        const videoPreview = document.getElementById('videoPreview');
        const dropArea = document.getElementById('fileDropArea');
        const videoContainer = document.getElementById('videoContainer');
        
        // איפוס קלט הקובץ
        videoInput.value = '';
        videoPreview.src = '';
        videoPreview.style.display = 'none';
        
        // איפוס אזור הגרירה
        const icon = dropArea.querySelector('.file-input-icon');
        const text = dropArea.querySelector('.file-input-text');
        const subtext = dropArea.querySelector('.file-input-subtext');
        
        icon.style.display = 'block';
        text.style.display = 'block';
        subtext.style.display = 'block';
        
        // הסתרת וידאו
        videoContainer.style.display = 'none';
        
        this.state.videoSelected = false;
        this.showNotification('הוידאו נוקה בהצלחה', 'info');
    },
    
    /**
     * אפקט גלים בלחיצה על כפתור
     * @param {Event} e אירוע
     * @returns {void}
     */
    createRippleEffect: function(e) {
        if (this.classList.contains('btn-text') || this.disabled) return;
        
        const circle = document.createElement('span');
        const diameter = Math.max(this.clientWidth, this.clientHeight);
        
        circle.style.width = circle.style.height = `${diameter}px`;
        circle.style.left = `${e.clientX - this.offsetLeft - diameter/2}px`;
        circle.style.top = `${e.clientY - this.offsetTop - diameter/2}px`;
        circle.classList.add('btn-ripple');
        
        this.appendChild(circle);
        
        setTimeout(() => {
            circle.remove();
        }, 600);
    },
    
    /**
     * פתיחת לשונית
     * @param {string} tabName שם הלשונית
     * @returns {void}
     */
    openTab: function(tabName) {
        // הסרת האקטיביות מכל הטאבים
        const tabs = document.querySelectorAll('.tab');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabs.forEach(tab => tab.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        // הפעלת הלשונית הנבחרת
        document.getElementById(tabName).classList.add('active');
        document.querySelector(`.tab[data-tab="${tabName}"]`).classList.add('active');
        
        this.state.activeTab = tabName;
            
        // עדכון סליידר
        this.updateTabSlider();
    },
    
    /**
     * הצגת התראה למשתמש
     * @param {string} message הודעה
     * @param {string} type סוג ההתראה (info, success, error)
     * @returns {void}
     */
    showNotification: function(message, type = 'info') {
        const notification = document.getElementById('notification');
        if (!notification) return;
        
        const notificationIcon = notification.querySelector('.notification-icon');
        const notificationTitle = notification.querySelector('.notification-title');
        const notificationMessage = notification.querySelector('.notification-message');
        
        // הגדרת סוג ההתראה
        notificationIcon.className = 'notification-icon';
        
        switch(type) {
            case 'success':
                notificationIcon.classList.add('success');
                notificationIcon.innerHTML = '<i class="fas fa-check"></i>';
                notificationTitle.textContent = 'הצלחה';
                break;
            case 'error':
                notificationIcon.classList.add('error');
                notificationIcon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
                notificationTitle.textContent = 'שגיאה';
                break;
            case 'info':
            default:
                notificationIcon.classList.add('info');
                notificationIcon.innerHTML = '<i class="fas fa-info"></i>';
                notificationTitle.textContent = 'עדכון';
        }
        
        notificationMessage.textContent = message;
        
        // הצגת ההתראה עם אנימציה
        notification.classList.add('show');
        
        // הסתרה אוטומטית לאחר 5 שניות
        setTimeout(() => {
            this.hideNotification();
        }, 5000);
    },
    
    /**
     * הסתרת התראה
     * @returns {void}
     */
    hideNotification: function() {
        const notification = document.getElementById('notification');
        if (notification) {
            notification.classList.remove('show');
        }
    },
    
    /**
     * עדכון תצוגת ההתקדמות
     * @param {number} percent אחוז התקדמות
     * @param {string} status הודעת סטטוס
     * @returns {void}
     */
    updateProgress: function(percent, status) {
        const progressContainer = document.getElementById('progressContainer');
        const progressBar = document.getElementById('progressBar');
        const progressPercent = document.getElementById('progressPercent');
        const progressStatus = document.getElementById('progressStatus');
        
        if (!progressContainer || !progressBar || !progressPercent || !progressStatus) return;
        
        // הצגת מחוון ההתקדמות
        progressContainer.style.display = 'block';
        
        // עדכון ערכים
        progressBar.style.width = `${percent}%`;
        progressPercent.textContent = `${Math.round(percent)}%`;
        progressStatus.textContent = status;
    },
    
    /**
     * הפעלת מחוון עיבוד (לודר)
     * @param {boolean} show האם להציג
     * @returns {void}
     */
    toggleLoader: function(show) {
        const loader = document.getElementById('loader');
        if (loader) {
            loader.style.display = show ? 'block' : 'none';
        }
    },
    
    /**
     * הצגת תוצאות הזיהוי
     * @param {Array} objects מערך אובייקטים שזוהו
     * @returns {void}
     */
    displayResults: function(objects) {
        const objectsList = document.getElementById('objectsList');
        const emptyResults = document.getElementById('emptyResults');
        const totalObjects = document.getElementById('totalObjects');
        
        if (!objectsList || !emptyResults || !totalObjects) return;
        
        // עדכון מספר אובייקטים
        totalObjects.textContent = objects.length;
        
        // הצגת אזור ריק אם אין תוצאות
        if (objects.length === 0) {
            emptyResults.style.display = 'block';
            objectsList.innerHTML = '';
            return;
        }
        
        emptyResults.style.display = 'none';
        objectsList.innerHTML = '';
        
        // הצגת האובייקטים
        objects.forEach((object, index) => {
            // יצירת כרטיס אובייקט
            const objectElement = document.createElement('div');
            objectElement.className = 'object-card';
            
            // שם אובייקט רפינד (אם יש)
            const displayName = object.refinedClassName || object.className;
            
            // יצירת קישור לחיפוש גוגל עם תמונה
            let googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(displayName)}`;
            
            // אם UTILS קיים, השתמש בו ליצירת קישור חיפוש תמונה
            if (window.UTILS && typeof UTILS.createGoogleLensUrl === 'function') {
                googleSearchUrl = UTILS.createGoogleLensUrl(object.thumbnail);
            }
            
            objectElement.innerHTML = `
                <div class="object-image-container">
                    <div class="object-badge">${(object.confidence * 100).toFixed(0)}% ביטחון</div>
                    <img src="${object.thumbnail}" alt="${displayName}" class="object-image">
                </div>
                <div class="object-info">
                    <div class="object-name">
                        <i class="fas fa-cube object-name-icon"></i>
                        ${displayName}
                    </div>
                    <div class="object-meta">
                        <div class="object-meta-item">
                            <i class="fas fa-clock object-meta-icon"></i>
                            ${typeof UTILS !== 'undefined' ? UTILS.formatTime(object.frameTime) : Math.round(object.frameTime) + 's'}
                        </div>
                    </div>
                    <div class="object-actions">
                        <a href="${googleSearchUrl}" target="_blank" class="object-action">
                            <i class="fas fa-search object-action-icon"></i>
                            חפש בגוגל
                        </a>
                        <a href="https://he.wikipedia.org/wiki/${encodeURIComponent(displayName)}" target="_blank" class="object-action">
                            <i class="fas fa-info-circle object-action-icon"></i>
                            מידע נוסף
                        </a>
                    </div>
                </div>
            `;
            
            objectsList.appendChild(objectElement);
            
            // אנימציה לכרטיס
            objectElement.style.opacity = '0';
            objectElement.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                objectElement.style.transition = 'all 0.5s ease';
                objectElement.style.opacity = '1';
                objectElement.style.transform = 'translateY(0)';
            }, 50 * index);
        });
        
        // מעבר ללשונית תוצאות
        this.openTab('resultTab');
    },
    
    /**
     * שמירת הגדרות
     * @returns {void}
     */
    saveSettings: function() {
        if (window.UTILS && typeof UTILS.saveToStorage === 'function') {
            UTILS.saveToStorage('settings', this.state.currentSettings);
        } else {
            // שמירה ישירה ללוקל סטורג'
            try {
                localStorage.setItem('ai_vision_pro_settings', JSON.stringify(this.state.currentSettings));
            } catch (e) {
                console.warn('שגיאה בשמירת הגדרות:', e);
            }
        }
        
        this.showNotification('ההגדרות נשמרו בהצלחה', 'success');
    },
    
    /**
     * איפוס הגדרות
     * @returns {void}
     */
    resetSettings: function() {
        // הגדרות ברירת מחדל
        const defaults = (window.CONFIG && CONFIG.defaults) || {
            confidenceThreshold: 0.6,
            frameSkip: 3,
            imageQuality: 'high',
            modelType: 'accurate',
            imageEnhancement: 'advanced',
            boundingBoxPadding: 15,
            deviceOptimization: true
        };
        
        this.state.currentSettings = { ...defaults };
        
        // עדכון ממשק המשתמש
        document.getElementById('confidenceThreshold').value = defaults.confidenceThreshold;
        document.getElementById('confidenceValue').textContent = defaults.confidenceThreshold;
        
        document.getElementById('frameSkip').value = defaults.frameSkip;
        document.getElementById('frameSkipValue').textContent = defaults.frameSkip;
        
        document.getElementById('boundingBoxPadding').value = defaults.boundingBoxPadding;
        document.getElementById('paddingValue').textContent = defaults.boundingBoxPadding;
        
        document.getElementById('imageQuality').value = defaults.imageQuality;
        document.getElementById('modelType').value = defaults.modelType;
        document.getElementById('imageEnhancement').value = defaults.imageEnhancement;
        document.getElementById('deviceOptimization').checked = defaults.deviceOptimization;
        
        // הסרה מהאחסון
        if (window.UTILS && typeof UTILS.saveToStorage === 'function') {
            UTILS.saveToStorage('settings', defaults);
        } else {
            try {
                localStorage.setItem('ai_vision_pro_settings', JSON.stringify(defaults));
            } catch (e) {
                console.warn('שגיאה באיפוס הגדרות:', e);
            }
        }
        
        this.showNotification('ההגדרות אופסו לברירת המחדל', 'success');
    },
    
    /**
     * עדכון מידע על המכשיר
     * @returns {void}
     */
    updateDeviceInfo: function() {
        if (!window.UTILS) return;
        
        const deviceInfoContent = document.getElementById('deviceInfoContent');
        if (deviceInfoContent) {
            deviceInfoContent.textContent = UTILS.getSystemInfo();
        }
    },
    
    /**
     * החלת אופטימיזציות למכשירים ניידים
     * @returns {void}
     */
    applyMobileOptimizations: function() {
        if (!this.state.currentSettings.deviceOptimization || !window.UTILS) {
            return;
        }
        
        const device = UTILS.detectDevice();
        const optimizationType = device.optimization || 'mobile';
        let optimizations = null;
        
        if (window.CONFIG && CONFIG.deviceOptimizations) {
            optimizations = CONFIG.deviceOptimizations[optimizationType];
        } else {
            // הגדרות ברירת מחדל אם CONFIG חסר
            const mobileOptimizations = {
                frameSkip: 10,
                imageQuality: 'medium',
                modelType: 'lite',
                imageEnhancement: 'basic'
            };
            
            const lowPowerOptimizations = {
                frameSkip: 15,
                imageQuality: 'medium',
                modelType: 'lite',
                imageEnhancement: 'none'
            };
            
            optimizations = (optimizationType === 'lowPower') ? 
                lowPowerOptimizations : mobileOptimizations;
        }
        
        if (optimizations) {
            // התאמת הגדרות לפי סוג המכשיר
            const adaptedSettings = { ...this.state.currentSettings };
            
            for (const key in optimizations) {
                adaptedSettings[key] = optimizations[key];
            }
            
            // עדכון הממשק והגדרות
            this.state.currentSettings = adaptedSettings;
            
            // עדכון ממשק משתמש
            document.getElementById('frameSkip').value = adaptedSettings.frameSkip;
            document.getElementById('frameSkipValue').textContent = adaptedSettings.frameSkip;
            document.getElementById('imageQuality').value = adaptedSettings.imageQuality;
            document.getElementById('modelType').value = adaptedSettings.modelType;
            document.getElementById('imageEnhancement').value = adaptedSettings.imageEnhancement;
            
            this.showNotification('הגדרות הותאמו אוטומטית למכשיר הנייד שלך לביצועים אופטימליים', 'info');
        }
    }
};

// הרישום של UI כמודול גלובלי, גם אם הוא נטען בצורה שונה
window.UI = UI;

// אם יש פונקציית אתחול חיצונית, נפעיל אותה
if (typeof initUIComplete === 'function') {
    initUIComplete();
}

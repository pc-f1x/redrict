/**
 * פונקציות עזר שימושיות למערכת זיהוי האובייקטים
 */
const UTILS = {
    /**
     * יצירת מזהה ייחודי עבור המשתמש
     * @returns {string} מזהה ייחודי
     */
    generateUniqueId: function() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    },
    
    /**
     * השגת כתובת IP של המשתמש
     * @returns {Promise<string>} כתובת IP
     */
    getUserIP: async function() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            console.warn("שגיאה בהשגת כתובת IP:", error);
            return "unknown-" + this.generateUniqueId();
        }
    },
    
    /**
     * המרת זמן בשניות לפורמט מתאים
     * @param {number} timeInSeconds זמן בשניות
     * @returns {string} פורמט זמן מוצג
     */
    formatTime: function(timeInSeconds) {
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    },
    
    /**
     * שמירת נתונים באחסון מקומי
     * @param {string} key מפתח
     * @param {any} value ערך
     */
    saveToStorage: function(key, value) {
        try {
            const fullKey = CONFIG.app.storagePrefix + key;
            localStorage.setItem(fullKey, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('שגיאה בשמירת נתונים:', error);
            return false;
        }
    },
    
    /**
     * טעינת נתונים מאחסון מקומי
     * @param {string} key מפתח
     * @param {any} defaultValue ערך ברירת מחדל אם לא נמצא
     * @returns {any} הערך שנטען
     */
    loadFromStorage: function(key, defaultValue = null) {
        try {
            const fullKey = CONFIG.app.storagePrefix + key;
            const data = localStorage.getItem(fullKey);
            return data ? JSON.parse(data) : defaultValue;
        } catch (error) {
            console.error('שגיאה בטעינת נתונים:', error);
            return defaultValue;
        }
    },
    
    /**
     * התאמת איכות ורזולוציה של התמונה לפי הגדרות
     * @param {HTMLCanvasElement} canvas אלמנט קנבס
     * @param {string} quality רמת איכות
     * @param {number} originalWidth רוחב מקורי
     * @param {number} originalHeight גובה מקורי
     * @returns {Object} מידות החדשות
     */
    adjustCanvasResolution: function(canvas, quality, originalWidth, originalHeight) {
        const resolution = CONFIG.resolutions[quality] || CONFIG.resolutions.high;
        
        // חישוב יחס תמונה ושמירה עליו
        const aspectRatio = originalWidth / originalHeight;
        let targetWidth = resolution.width;
        let targetHeight = resolution.height;
        
        if (aspectRatio > targetWidth / targetHeight) {
            targetHeight = Math.round(targetWidth / aspectRatio);
        } else {
            targetWidth = Math.round(targetHeight * aspectRatio);
        }
        
        // הגדרת גודל חדש לקנבס
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        return {
            width: targetWidth,
            height: targetHeight,
            aspectRatio
        };
    },
    
    /**
     * זיהוי סוג המכשיר והתאמת הגדרות
     * @returns {Object} מידע על המכשיר והגדרות מותאמות
     */
    detectDevice: function() {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isTablet = /iPad|tablet|Nexus (7|9)/i.test(navigator.userAgent) || (isMobile && Math.min(window.innerWidth, window.innerHeight) > 768);
        
        // ניסיון לזהות ביצועי מערכת
        const lowPerformance = isMobile && 
            ((navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || 
             (navigator.deviceMemory && navigator.deviceMemory <= 4));
             
        const highPerformance = !isMobile && 
            ((navigator.hardwareConcurrency && navigator.hardwareConcurrency >= 8) || 
             (navigator.deviceMemory && navigator.deviceMemory >= 8));
        
        let deviceType = 'desktop';
        let optimization = null;
        
        if (isMobile && !isTablet) {
            deviceType = 'mobile';
            optimization = lowPerformance ? 'lowPower' : 'mobile';
        } else if (isTablet) {
            deviceType = 'tablet';
            optimization = 'mobile';
        } else if (highPerformance) {
            optimization = 'highPerformance';
        }
        
        return {
            type: deviceType,
            isMobile,
            isTablet,
            optimization,
            specs: {
                cores: navigator.hardwareConcurrency || 'unknown',
                memory: navigator.deviceMemory || 'unknown',
                connection: navigator.connection ? navigator.connection.effectiveType : 'unknown'
            }
        };
    },
    
    /**
     * יצירת קישור לחיפוש תמונה בגוגל
     * @param {string} imageDataUrl תמונה בפורמט Data URL
     * @returns {string} קישור לחיפוש
     */
    createGoogleLensUrl: function(imageDataUrl) {
        // בסביבה אמיתית, היינו משתמשים בשרת proxy או בAPI של גוגל
        return CONFIG.search.googleLens;
    },
    
    /**
     * שינוי גודל תמונה/וידאו לריבוע מרכזי (crop center square)
     * @param {HTMLCanvasElement|HTMLVideoElement} element אלמנט המקור
     * @param {HTMLCanvasElement} targetCanvas קנבס יעד 
     * @param {number} size גודל הריבוע הרצוי
     */
    cropCenterSquare: function(element, targetCanvas, size) {
        const ctx = targetCanvas.getContext('2d');
        targetCanvas.width = size;
        targetCanvas.height = size;
        
        const width = element.width || element.videoWidth;
        const height = element.height || element.videoHeight;
        
        // חישוב הגודל של הריבוע
        const minDimension = Math.min(width, height);
        const sx = (width - minDimension) / 2;
        const sy = (height - minDimension) / 2;
        
        ctx.drawImage(element, sx, sy, minDimension, minDimension, 0, 0, size, size);
        
        return targetCanvas;
    },
    
    /**
     * בדיקה האם Web Workers זמינים בדפדפן זה
     * @returns {boolean} האם נתמך
     */
    isWebWorkerSupported: function() {
        return typeof Worker !== 'undefined';
    },
    
    /**
     * בדיקה האם WebGL זמין בדפדפן זה
     * @returns {boolean} האם נתמך
     */
    isWebGLSupported: function() {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && 
                (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
        } catch (e) {
            return false;
        }
    },
    
    /**
     * בדיקה האם TensorFlow.js בוצע אופטימיזציה לחומרה
     * @returns {boolean} האם יש תמיכה בהאצת חומרה
     */
    isTFHardwareAccelerated: function() {
        return window.tf && window.tf.ENV.getBool('HAS_WEBGL');
    },
    
    /**
     * איסוף מידע מפורט על יכולות המערכת
     * @returns {string} מחרוזת מידע
     */
    getSystemInfo: function() {
        const device = this.detectDevice();
        const webgl = this.isWebGLSupported();
        const webworker = this.isWebWorkerSupported();
        
        return `מכשיר: ${device.type}
מעבדים: ${device.specs.cores}
זיכרון: ${device.specs.memory} GB
חיבור רשת: ${device.specs.connection}
WebGL: ${webgl ? 'נתמך' : 'לא נתמך'}
Web Workers: ${webworker ? 'נתמכים' : 'לא נתמכים'}
האצת חומרה: ${this.isTFHardwareAccelerated() ? 'פעילה' : 'לא פעילה'}
דפדפן: ${navigator.userAgent}`;
    },
    
    /**
     * המרת גודל קובץ לפורמט אנושי
     * @param {number} bytes גודל בבייטים
     * @returns {string} גודל בפורמט אנושי
     */
    formatFileSize: function(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
};
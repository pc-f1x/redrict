/**
 * הגדרות ותצורה גלובלית של מערכת זיהוי האובייקטים
 */
const CONFIG = {
    // הגבלות שימוש
    usage: {
        limit: 5,                           // הגבלת מספר שימושים
        timeframe: 48 * 60 * 60 * 1000      // זמן איפוס (48 שעות במילישניות)
    },
    
    // ברירות מחדל להגדרות
    defaults: {
        confidenceThreshold: 0.6,           // סף ביטחון מינימלי לזיהוי (0-1)
        frameSkip: 3,                       // דילוג פריימים בעיבוד וידאו
        imageQuality: 'high',               // איכות תמונה (medium, high, ultra)
        modelType: 'accurate',              // סוג מודל (lite, standard, accurate)
        imageEnhancement: 'advanced',       // שיפור תמונה (none, basic, advanced)
        boundingBoxPadding: 15,             // שוליים נוספים לאובייקט (פיקסלים)
        deviceOptimization: true            // אופטימיזציה אוטומטית למכשיר
    },
    
    // מיפוי רזולוציות לפי הגדרת איכות
    resolutions: {
        medium: { width: 1280, height: 720 },
        high: { width: 1920, height: 1080 },
        ultra: { width: 3840, height: 2160 }
    },
    
    // הגדרות מודל לפי סוג
    models: {
        lite: { 
            base: 'lite_mobilenet_v2',
            options: { enableSmoothing: true }
        },
        standard: { 
            base: 'mobilenet_v2',
            options: { enableSmoothing: true }
        },
        accurate: { 
            base: 'efficientdet/d2',
            options: { enableSmoothing: true, scoreThreshold: 0.3 }
        }
    },
    
    // מיפויי עבור חיפוש ויזואלי
    search: {
        googleLens: 'https://lens.google.com/',
        imageSearch: 'https://images.google.com/searchbyimage'
    },
    
    // הגדרות עבודת אפליקציה
    app: {
        storagePrefix: 'ai_vision_pro_',    // תחילית לאחסון מקומי
        workerTimeout: 3000,                // זמן מקסימלי להמתנה לעובד (מילישניות)
        maxVideoSize: 500 * 1024 * 1024,    // גודל וידאו מקסימלי (500MB)
        autosaveInterval: 30000,            // שמירה אוטומטית של תוצאות (30 שניות)
        enabledOCR: false                   // זיהוי טקסט (לא פעיל כברירת מחדל)
    },
    
    // אופטימיזציות לפי סוגי מכשירים
    deviceOptimizations: {
        mobile: {
            frameSkip: 10,
            imageQuality: 'medium',
            modelType: 'lite',
            imageEnhancement: 'basic'
        },
        lowPower: {
            frameSkip: 15,
            imageQuality: 'medium',
            modelType: 'lite',
            imageEnhancement: 'none'
        },
        highPerformance: {
            frameSkip: 2,
            imageQuality: 'high',
            modelType: 'accurate',
            imageEnhancement: 'advanced'
        }
    }
};
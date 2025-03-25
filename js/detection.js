/**
 * טיפול בזיהוי אובייקטים ועיבוד סרטונים
 */
const DETECTION = {
    // נתוני מצב
    state: {
        model: null,
        secondaryModel: null,
        worker: null,
        detectedObjects: [],
        uniqueObjectsMap: new Map(),
        processingVideo: false
    },
    
    /**
     * טעינת מודלים לזיהוי אובייקטים
     * @param {Object} settings הגדרות זיהוי
     * @returns {Promise} הבטחה שמתממשת כאשר המודלים נטענים
     */
    loadModels: async function(settings) {
        UI.toggleLoader(true);
        UI.showNotification('טוען מודלי זיהוי AI... אנא המתן', 'info');
        
        try {
            // בחירת מודל לפי הגדרות
            const modelConfig = CONFIG.models[settings.modelType] || CONFIG.models.standard;
            
            if (!this.state.model) {
                this.state.model = await cocoSsd.load(modelConfig);
                
                // טעינת מודל משני במידת הצורך
                if (settings.modelType === 'accurate' && window.mobilenet) {
                    try {
                        this.state.secondaryModel = await mobilenet.load();
                    } catch (err) {
                        console.warn('שגיאה בטעינת מודל משני:', err);
                    }
                }
                
                UI.showNotification('מודלי הזיהוי נטענו בהצלחה', 'success');
            }
        } catch (error) {
            console.error('שגיאה בטעינת מודל:', error);
            UI.showNotification('שגיאה בטעינת מודל הזיהוי, מנסה מודל ברירת מחדל', 'error');
            
            try {
                this.state.model = await cocoSsd.load();
                UI.showNotification('מודל ברירת מחדל נטען בהצלחה', 'info');
            } catch (innerError) {
                UI.showNotification('שגיאה קריטית בטעינת מודל הזיהוי', 'error');
                console.error('שגיאה בטעינת מודל ברירת מחדל:', innerError);
                throw innerError;
            }
        } finally {
            UI.toggleLoader(false);
        }
        
        return this.state.model;
    },
    
    /**
     * עיבוד סרטון לזיהוי אובייקטים
     * @param {HTMLVideoElement} video אלמנט וידאו
     * @param {Object} settings הגדרות זיהוי
     * @returns {Promise} הבטחה עם תוצאות הזיהוי
     */
    processVideo: async function(video, settings) {
        if (this.state.processingVideo) {
            UI.showNotification('עיבוד סרטון כבר מתבצע, אנא המתן', 'error');
            return;
        }
        
        this.state.processingVideo = true;
        this.state.detectedObjects = [];
        this.state.uniqueObjectsMap.clear();
        
        // טעינת מודל אם צריך
        if (!this.state.model) {
            await this.loadModels(settings);
        }
        
        try {
            UI.showNotification('מתחיל בניתוח הסרטון...', 'info');
            
            // הכנת קנבס לעיבוד
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            // קנבס לאובייקטים
            const objectCanvas = document.getElementById('objectCanvas');
            
            // התאמת רזולוציה לפי הגדרות
            const { width: targetWidth, height: targetHeight } = UTILS.adjustCanvasResolution(
                objectCanvas,
                settings.imageQuality,
                video.videoWidth,
                video.videoHeight
            );
            
            // עיבוד הסרטון פריים אחרי פריים
            await this.processVideoFrames(video, canvas, objectCanvas, settings);
            
            // עיבוד התוצאות
            this.state.detectedObjects = Array.from(this.state.uniqueObjectsMap.values());
            
            // מיון לפי רמת ביטחון
            this.state.detectedObjects.sort((a, b) => b.confidence - a.confidence);
            
            UI.showNotification('עיבוד הסרטון הושלם בהצלחה!', 'success');
            
            return this.state.detectedObjects;
        } catch (error) {
            console.error('שגיאה בעיבוד הסרטון:', error);
            UI.showNotification('שגיאה בעיבוד הסרטון', 'error');
            throw error;
        } finally {
            this.state.processingVideo = false;
        }
    },
    
    /**
     * עיבוד פריימים מסרטון
     * @param {HTMLVideoElement} video אלמנט וידאו
     * @param {HTMLCanvasElement} canvas קנבס לעיבוד
     * @param {HTMLCanvasElement} objectCanvas קנבס לאובייקטים
     * @param {Object} settings הגדרות
     * @returns {Promise} הבטחה שמתממשת עם סיום העיבוד
     */
    processVideoFrames: async function(video, canvas, objectCanvas, settings) {
        const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
        const objectCtx = objectCanvas.getContext('2d', { alpha: false });
        
        // הגדרות
        const confidenceThreshold = settings.confidenceThreshold;
        const frameSkip = settings.frameSkip;
        const padding = settings.boundingBoxPadding;
        const enhancementMethod = settings.imageEnhancement;
        
        // הגדרות ביצועים
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        objectCtx.imageSmoothingEnabled = true;
        objectCtx.imageSmoothingQuality = 'high';
        
        return new Promise((resolve) => {
            let currentTime = 0;
            const duration = video.duration;
            const frameStep = frameSkip / 30; // בשניות
            
            // פונקציה לעיבוד פריים בודד
            const processCurrentFrame = async () => {
                if (currentTime >= duration) {
                    // סיום העיבוד
                    resolve();
                    return;
                }
                
                // עדכון זמן הסרטון
                video.currentTime = currentTime;
                
                try {
                    // המתנה להתעדכנות הפריים
                    await new Promise(resolve => {
                        video.onseeked = resolve;
                    });
                    
                    // ציור הפריים בקנבס
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    
                    // זיהוי אובייקטים בפריים
                    const predictions = await this.state.model.detect(canvas);
                    
                    // עיבוד האובייקטים שזוהו
                    for (const prediction of predictions) {
                        let { class: className, score, bbox } = prediction;
                        
                        // בדיקת סף ביטחון
                        if (score >= confidenceThreshold) {
                            // מזהה ייחודי לאובייקט
                            const objectKey = className.toLowerCase();
                            
                            // אם האובייקט קיים כבר עם ביטחון גבוה יותר - נדלג
                            if (this.state.uniqueObjectsMap.has(objectKey) && 
                                score <= this.state.uniqueObjectsMap.get(objectKey).confidence) {
                                continue;
                            }
                            
                            // חיתוך תמונת האובייקט
                            let [x, y, width, height] = bbox;
                            
                            // הוספת שוליים
                            x = Math.max(0, x - padding);
                            y = Math.max(0, y - padding);
                            width = Math.min(canvas.width - x, width + padding * 2);
                            height = Math.min(canvas.height - y, height + padding * 2);
                            
                            // יצירת תמונה ברזולוציה גבוהה
                            objectCtx.clearRect(0, 0, objectCanvas.width, objectCanvas.height);
                            
                            // התאמת גדלים לשמירת יחס תמונה
                            const aspectRatio = width / height;
                            let targetWidth = objectCanvas.width;
                            let targetHeight = objectCanvas.height;
                            
                            if (aspectRatio > targetWidth / targetHeight) {
                                targetHeight = Math.round(targetWidth / aspectRatio);
                            } else {
                                targetWidth = Math.round(targetHeight * aspectRatio);
                            }
                            
                            // ציור האובייקט בקנבס המיועד
                            objectCtx.drawImage(
                                canvas, 
                                x, y, width, height,
                                (objectCanvas.width - targetWidth) / 2, 
                                (objectCanvas.height - targetHeight) / 2, 
                                targetWidth, targetHeight
                            );
                            
                            // שיפור איכות תמונה אם נדרש
                            if (enhancementMethod !== 'none') {
                                await IMAGE_PROCESSING.applyImageEnhancement(objectCtx, enhancementMethod);
                            }
                            
                            // זיהוי משני מדויק יותר אם זמין
                            let additionalInfo = {};
                            if (this.state.secondaryModel) {
                                try {
                                    const secondaryPrediction = await this.state.secondaryModel.classify(objectCanvas);
                                    if (secondaryPrediction && secondaryPrediction.length > 0) {
                                        additionalInfo = {
                                            refinedClassName: secondaryPrediction[0].className.split(',')[0],
                                            subcategories: secondaryPrediction.slice(0, 3).map(p => ({
                                                name: p.className.split(',')[0],
                                                probability: p.probability
                                            }))
                                        };
                                    }
                                } catch (e) {
                                    console.warn('שגיאה בזיהוי משני:', e);
                                }
                            }
                            
                            // שמירת תמונת האובייקט
                            const objectThumbnail = objectCanvas.toDataURL('image/png');
                            
                            // הוספה למפת האובייקטים
                            this.state.uniqueObjectsMap.set(objectKey, {
                                className,
                                confidence: score,
                                thumbnail: objectThumbnail,
                                frameTime: currentTime,
                                bbox: [x, y, width, height],
                                ...additionalInfo
                            });
                        }
                    }
                    
                    // עדכון התקדמות
                    const progressPercent = (currentTime / duration) * 100;
                    UI.updateProgress(
                        progressPercent,
                        `מנתח סרטון... (${Math.round(currentTime)}/${Math.round(duration)} שניות)`
                    );
                    
                    // התקדמות לפריים הבא
                    currentTime += frameStep;
                    
                    // שימוש ב-setTimeout כדי לא לחסום את הרנדור
                    setTimeout(processCurrentFrame, 0);
                    
                } catch (error) {
                    console.error('שגיאה בעיבוד פריים:', error);
                    // נמשיך לפריים הבא אם הייתה שגיאה
                    currentTime += frameStep;
                    setTimeout(processCurrentFrame, 0);
                }
            };
            
            // התחלת עיבוד
            processCurrentFrame();
        });
    },
    
    /**
     * בדיקה האם אובייקט זה זהה או דומה לאובייקט קיים
     * @param {Object} obj1 אובייקט ראשון
     * @param {Object} obj2 אובייקט שני
     * @returns {boolean} האם האובייקטים דומים
     */
    areSimilarObjects: function(obj1, obj2) {
        // אם מדובר באותו סוג אובייקט, נבדוק אם הם באותו אזור
        if (obj1.className !== obj2.className) {
            return false;
        }
        
        // חישוב מרכזי הבאונדינג בוקס
        const center1 = {
            x: obj1.bbox[0] + obj1.bbox[2] / 2,
            y: obj1.bbox[1] + obj1.bbox[3] / 2
        };
        
        const center2 = {
            x: obj2.bbox[0] + obj2.bbox[2] / 2,
            y: obj2.bbox[1] + obj2.bbox[3] / 2
        };
        
        // חישוב מרחק יוקלידי בין המרכזים
        const distance = Math.sqrt(
            Math.pow(center1.x - center2.x, 2) + 
            Math.pow(center1.y - center2.y, 2)
        );
        
        // חישוב סף מרחק כפונקציה של גודל האובייקט
        const threshold = Math.max(obj1.bbox[2], obj1.bbox[3]) * 0.5;
        
        return distance < threshold;
    },
    
    /**
     * קבלת תוצאות הזיהוי הנוכחיות
     * @returns {Array} מערך האובייקטים שזוהו
     */
    getDetectedObjects: function() {
        return this.state.detectedObjects;
    },
    
    /**
     * ניקוי תוצאות זיהוי ואיפוס
     * @returns {void}
     */
    clearResults: function() {
        this.state.detectedObjects = [];
        this.state.uniqueObjectsMap.clear();
    }
};
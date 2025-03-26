// detection.js - גרסה מתקדמת עם אמינות מרבית ודיבוג

class ObjectDetector {
    constructor(settingsManager) {
        this.settingsManager = settingsManager;
        this.model = null;
        this.isModelLoaded = false;
        this.isProcessing = false;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.debugElement = this.createDebugElement();
        this.enableDebug = true; // אפשר דיבוג מפורט
        this.retryOnFailure = true; // נסה שוב עם פרמטרים אחרים במקרה של כישלון
        this.loadModel();
    }

    // יצירת אלמנט דיבוג שיוצג בדף במצב פיתוח
    createDebugElement() {
        const debugDiv = document.createElement('div');
        debugDiv.style.position = 'fixed';
        debugDiv.style.bottom = '10px';
        debugDiv.style.left = '10px';
        debugDiv.style.backgroundColor = 'rgba(0,0,0,0.7)';
        debugDiv.style.color = 'white';
        debugDiv.style.padding = '10px';
        debugDiv.style.borderRadius = '5px';
        debugDiv.style.maxWidth = '300px';
        debugDiv.style.maxHeight = '200px';
        debugDiv.style.overflow = 'auto';
        debugDiv.style.fontSize = '12px';
        debugDiv.style.fontFamily = 'monospace';
        debugDiv.style.zIndex = '9999';
        debugDiv.style.display = 'none';
        
        if (this.enableDebug) {
            document.body.appendChild(debugDiv);
        }
        
        return debugDiv;
    }

    // פונקציית רישום לוג מתקדמת
    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const formattedMessage = `[${timestamp}] ${message}`;
        
        // רישום לקונסול
        if (type === 'error') {
            console.error(formattedMessage);
        } else if (type === 'warn') {
            console.warn(formattedMessage);
        } else {
            console.log(formattedMessage);
        }
        
        // הוסף למסך דיבוג
        if (this.enableDebug) {
            const logLine = document.createElement('div');
            logLine.textContent = formattedMessage;
            
            if (type === 'error') {
                logLine.style.color = '#ff5555';
            } else if (type === 'warn') {
                logLine.style.color = '#ffaa55';
            }
            
            this.debugElement.appendChild(logLine);
            this.debugElement.scrollTop = this.debugElement.scrollHeight;
            this.debugElement.style.display = 'block';
            
            // הסר הודעות ישנות אם יש יותר מדי
            while (this.debugElement.childNodes.length > 50) {
                this.debugElement.removeChild(this.debugElement.firstChild);
            }
        }
    }

    // טעינת מודל זיהוי אובייקטים
    async loadModel() {
        try {
            this.log('טוען מודל COCO-SSD...');
            
            // נסה ראשית עם המודל המהיר יותר - קל יותר על הזיכרון
            try {
                this.model = await cocoSsd.load({
                    base: 'lite_mobilenet_v2'
                });
                this.log('מודל lite_mobilenet_v2 נטען בהצלחה');
            } catch (e) {
                this.log(`שגיאה בטעינת מודל קל: ${e.message}`, 'warn');
                
                // נסה עם המודל הרגיל
                this.model = await cocoSsd.load();
                this.log('מודל רגיל נטען בהצלחה');
            }
            
            this.isModelLoaded = true;
            this.log('המודל נטען בהצלחה, מוכן לזיהוי אובייקטים');
            
            // הפעל בדיקת יציבות אם דיבוג מופעל
            if (this.enableDebug) {
                await this.testModelStability();
            }
        } catch (error) {
            this.log(`שגיאה קריטית בטעינת המודל: ${error.message}`, 'error');
            alert('שגיאה בטעינת מודל זיהוי האובייקטים. אנא רענן את הדף ונסה שוב.');
        }
    }
    
    // בדיקת יציבות המודל אחרי הטעינה
    async testModelStability() {
        try {
            // צור תמונת בדיקה פשוטה
            const testCanvas = document.createElement('canvas');
            testCanvas.width = 300;
            testCanvas.height = 300;
            const testCtx = testCanvas.getContext('2d');
            testCtx.fillStyle = 'gray';
            testCtx.fillRect(0, 0, 300, 300);
            
            // נסה לזהות - לא אמור להיות שום דבר בתמונה הזו, רק בדיקת יציבות
            this.log('בודק יציבות מודל...');
            await this.model.detect(testCanvas);
            this.log('בדיקת יציבות עברה בהצלחה');
        } catch (e) {
            this.log(`אזהרה: בדיקת יציבות נכשלה: ${e.message}`, 'warn');
        }
    }

    // עיבוד ראשי של הוידאו
    async processVideo(videoFile, progressCallback, completionCallback) {
        if (this.isProcessing) {
            alert('עיבוד וידאו כבר מתבצע. אנא המתן.');
            return;
        }

        this.isProcessing = true;
        this.log(`התחלת עיבוד קובץ וידאו: ${videoFile.name} (${Math.round(videoFile.size / 1024 / 1024 * 100) / 100} MB)`);
        
        // מבנה תוצאות שנחזיר בסוף
        const detectionResults = {
            fileName: videoFile.name,
            duration: 0,
            thumbnail: null,
            objectCount: 0,
            objects: []
        };
        
        // מציג את אלמנט הדיבוג אם הדיבוג מופעל
        if (this.enableDebug) {
            this.debugElement.style.display = 'block';
        }
        
        try {
            // וודא שהמודל טעון
            if (!this.isModelLoaded) {
                this.log('ממתין לטעינת המודל...', 'warn');
                await this.waitForModel();
            }
            
            // יצירת אלמנט וידאו זמני
            const video = document.createElement('video');
            video.muted = true;
            video.playsInline = true;
            
            // טען את הוידאו
            const videoUrl = URL.createObjectURL(videoFile);
            video.src = videoUrl;
            
            // המתן לטעינת מידע על הוידאו
            await new Promise(resolve => {
                video.onloadedmetadata = resolve;
            });
            
            // קבל את משך הוידאו
            const duration = video.duration;
            detectionResults.duration = duration;
            this.log(`אורך וידאו: ${duration.toFixed(2)} שניות`);
            
            // בחר נקודות זמן לדגימה
            const timePoints = this.calculateSamplingPoints(duration);
            this.log(`יבצע דגימה ב-${timePoints.length} נקודות זמן לאורך הוידאו`);
            
            // מעבד כל פריים
            let totalDetections = 0;
            const allDetections = [];
            
            // כתוב זמן הרץ נוכחי
            let lastProgressUpdate = Date.now();
            
            // עיבוד פריים אחר פריים
            for (let i = 0; i < timePoints.length; i++) {
                try {
                    const currentTime = timePoints[i];
                    
                    // עדכון התקדמות רק כל 200ms כדי לא להעמיס על הממשק
                    const now = Date.now();
                    if (now - lastProgressUpdate > 200) {
                        progressCallback(Math.min(95, Math.round((i + 1) / timePoints.length * 100)));
                        lastProgressUpdate = now;
                    }
                    
                    // הכן את הפריים
                    await this.seekVideoToTime(video, currentTime);
                    
                    // צייר על הקנבס
                    this.canvas.width = video.videoWidth;
                    this.canvas.height = video.videoHeight;
                    this.ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
                    
                    // שמור תמונה ממוזערת מהפריים הראשון
                    if (i === 0) {
                        detectionResults.thumbnail = this.canvas.toDataURL('image/jpeg', 0.7);
                    }
                    
                    // זהה אובייקטים
                    const frameDetections = await this.detectObjectsInCurrentFrame(currentTime);
                    
                    // רשום תוצאות
                    if (frameDetections.length > 0) {
                        this.log(`נמצאו ${frameDetections.length} אובייקטים בזמן ${currentTime.toFixed(2)} שניות`);
                        totalDetections += frameDetections.length;
                        allDetections.push(...frameDetections);
                    }
                    
                    // אפשר לדפדפן להתעדכן
                    await new Promise(r => setTimeout(r, 5));
                    
                } catch (frameError) {
                    this.log(`שגיאה בעיבוד פריים: ${frameError.message}`, 'warn');
                    // המשך לפריים הבא במקרה של שגיאה
                }
            }
            
            // בדיקת תוצאות
            this.log(`סה"כ נמצאו ${totalDetections} אובייקטים לפני סינון`);
            
            // בדיקה אם נמצאו אובייקטים - אם לא, נסה שוב עם הגדרות מקלות
            if (totalDetections === 0 && this.retryOnFailure) {
                this.log('לא נמצאו אובייקטים, מנסה שוב עם הגדרות מקלות...', 'warn');
                
                // נסה שוב עם סף ביטחון נמוך יותר
                const extraDetections = await this.retryDetectionWithLowerThreshold(video);
                if (extraDetections.length > 0) {
                    this.log(`נמצאו ${extraDetections.length} אובייקטים בניסיון השני`);
                    allDetections.push(...extraDetections);
                    totalDetections += extraDetections.length;
                } else {
                    this.log('לא נמצאו אובייקטים גם בניסיון השני', 'warn');
                }
            }
            
            // עיבוד אחרי-דגימה
            progressCallback(97);
            
            // סנן כפילויות
            const uniqueObjects = this.filterAndImproveDetections(allDetections);
            detectionResults.objects = uniqueObjects;
            detectionResults.objectCount = uniqueObjects.length;
            
            this.log(`אחרי סינון: ${uniqueObjects.length} אובייקטים ייחודיים`);
            
            // ניקוי
            URL.revokeObjectURL(videoUrl);
            video.src = '';
            
            // סיום
            this.isProcessing = false;
            progressCallback(100);
            
            // הסתר את אלמנט הדיבוג
            if (this.enableDebug) {
                setTimeout(() => {
                    this.debugElement.style.display = 'none';
                }, 3000);
            }
            
            // החזר תוצאות
            this.log('עיבוד הסתיים בהצלחה!');
            completionCallback(detectionResults);
            
        } catch (error) {
            this.log(`שגיאה כללית בעיבוד: ${error.message}`, 'error');
            this.isProcessing = false;
            
            // נסה להחזיר תוצאות חלקיות אם יש
            if (detectionResults.objects && detectionResults.objects.length > 0) {
                this.log('מחזיר תוצאות חלקיות', 'warn');
                alert('העיבוד הושלם חלקית. מציג את האובייקטים שזוהו בהצלחה.');
                completionCallback(detectionResults);
            } else {
                alert(`שגיאה בעיבוד הוידאו: ${error.message}`);
                progressCallback(0);
            }
        }
    }
    
    // המתנה לטעינת המודל
    async waitForModel() {
        return new Promise(resolve => {
            const checkModel = () => {
                if (this.isModelLoaded) {
                    resolve();
                } else {
                    this.log('ממתין לטעינת המודל...');
                    setTimeout(checkModel, 500);
                }
            };
            checkModel();
        });
    }
    
    // קפיצה לנקודת זמן בוידאו
    async seekVideoToTime(video, timePosition) {
        video.currentTime = Math.min(timePosition, video.duration - 0.1);
        
        // המתן לסיום הקפיצה
        return new Promise(resolve => {
            const seekHandler = () => {
                video.removeEventListener('seeked', seekHandler);
                resolve();
            };
            video.addEventListener('seeked', seekHandler);
        });
    }
    
    // חישוב נקודות זמן אופטימליות לדגימה
    calculateSamplingPoints(duration) {
        const points = [];
        
        // תמיד דגום את הפריים הראשון
        points.push(0);
        
        // התאם את קצב הדגימה לאורך הסרטון
        let samplingRate;
        if (duration < 10) {
            samplingRate = 0.5; // כל חצי שנייה לסרטונים קצרים מאוד
        } else if (duration < 30) {
            samplingRate = 1;   // כל שנייה לסרטונים קצרים
        } else if (duration < 60) {
            samplingRate = 2;   // כל 2 שניות לסרטונים בינוניים
        } else if (duration < 300) {
            samplingRate = 5;   // כל 5 שניות לסרטונים ארוכים
        } else {
            samplingRate = 10;  // כל 10 שניות לסרטונים ארוכים מאוד
        }
        
        // הוסף נקודות בקצב קבוע לאורך כל הסרטון
        for (let t = samplingRate; t < duration; t += samplingRate) {
            points.push(t);
        }
        
        // תמיד דגום את הפריים האחרון
        if (duration > 1 && points[points.length - 1] < duration - 1) {
            points.push(duration - 1);
        }
        
        return points;
    }
    
    // זיהוי אובייקטים בפריים הנוכחי
    async detectObjectsInCurrentFrame(currentTime) {
        if (!this.isModelLoaded) {
            this.log('המודל לא טעון, מדלג על זיהוי בפריים הנוכחי', 'warn');
            return [];
        }
        
        try {
            // קבל הגדרות מהמשתמש
            const settings = this.settingsManager.getDetectionSettings();
            
            // השתמש בסף ביטחון נמוך יותר מההגדרות כדי לזהות יותר אובייקטים
            const confidenceThreshold = Math.max(0.25, settings.confidenceThreshold * 0.7);
            
            // הפעל את מודל הזיהוי
            const predictions = await this.model.detect(
                this.canvas, 
                null, 
                confidenceThreshold
            );
            
            // סנן תוצאות לפי סף הביטחון
            const filteredPredictions = predictions
                .filter(pred => pred.score >= confidenceThreshold)
                .slice(0, Math.min(settings.maxDetections, 20));
            
            // עבד כל אובייקט
            const results = [];
            
            for (const prediction of filteredPredictions) {
                try {
                    // חלץ תמונה לכל אובייקט
                    const objectImage = this.extractAndEnhanceObjectImage(prediction);
                    
                    // הוסף לתוצאות
                    results.push({
                        class: prediction.class,
                        score: prediction.score,
                        bbox: prediction.bbox,
                        image: objectImage,
                        time: currentTime
                    });
                } catch (err) {
                    this.log(`שגיאה בעיבוד אובייקט: ${err.message}`, 'warn');
                }
            }
            
            return results;
            
        } catch (error) {
            this.log(`שגיאה בזיהוי אובייקטים: ${error.message}`, 'error');
            return [];
        }
    }
    
    // ניסיון שני עם סף ביטחון נמוך יותר
    async retryDetectionWithLowerThreshold(video) {
        try {
            // בחר נקודות זמן מייצגות
            const timePoints = [0, video.duration / 2, Math.max(0, video.duration - 1)];
            const allDetections = [];
            
            // עבור על נקודות הזמן
            for (const time of timePoints) {
                // קפוץ לזמן
                await this.seekVideoToTime(video, time);
                
                // צייר על הקנבס
                this.canvas.width = video.videoWidth;
                this.canvas.height = video.videoHeight;
                this.ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
                
                // נסה עם סף נמוך מאוד
                try {
                    const predictions = await this.model.detect(this.canvas, null, 0.1);
                    
                    // עבד את התוצאות
                    for (const prediction of predictions) {
                        if (prediction.score >= 0.1) {
                            const objectImage = this.extractAndEnhanceObjectImage(prediction);
                            
                            allDetections.push({
                                class: prediction.class,
                                score: prediction.score,
                                bbox: prediction.bbox,
                                image: objectImage,
                                time: time
                            });
                        }
                    }
                } catch (e) {
                    this.log(`שגיאה בניסיון השני: ${e.message}`, 'warn');
                }
            }
            
            return allDetections;
            
        } catch (error) {
            this.log(`שגיאה בניסיון שני: ${error.message}`, 'warn');
            return [];
        }
    }
    
    // חילוץ ושיפור תמונת אובייקט
    extractAndEnhanceObjectImage(prediction) {
        const [x, y, width, height] = prediction.bbox;
        
        // יצירת קנבס לאובייקט
        const objectCanvas = document.createElement('canvas');
        const objectCtx = objectCanvas.getContext('2d');
        
        // הוסף שוליים יחסיים לגודל האובייקט
        const marginRatio = 0.15;
        const marginX = Math.max(10, width * marginRatio);
        const marginY = Math.max(10, height * marginRatio);
        
        // קבע מימדים עם שוליים
        objectCanvas.width = width + marginX * 2;
        objectCanvas.height = height + marginY * 2;
        
        // חשב מיקום מקור
        const sourceX = Math.max(0, x - marginX);
        const sourceY = Math.max(0, y - marginY);
        const sourceWidth = Math.min(this.canvas.width - sourceX, width + marginX * 2);
        const sourceHeight = Math.min(this.canvas.height - sourceY, height + marginY * 2);
        
        // צייר את האובייקט
        objectCtx.drawImage(
            this.canvas, 
            sourceX, sourceY, sourceWidth, sourceHeight,
            0, 0, objectCanvas.width, objectCanvas.height
        );
        
        // שפר את התמונה
        this.enhanceObjectImage(objectCtx, objectCanvas.width, objectCanvas.height);
        
        // החזר תמונה באיכות גבוהה
        return objectCanvas.toDataURL('image/jpeg', 0.9);
    }
    
    // שיפור איכות תמונת אובייקט
    enhanceObjectImage(ctx, width, height) {
        try {
            // קבל את נתוני הפיקסלים
            const imageData = ctx.getImageData(0, 0, width, height);
            const data = imageData.data;
            
            // שיפור ניגודיות
            let min = 255, max = 0;
            
            // חישוב ערכים מינימליים ומקסימליים
            for (let i = 0; i < data.length; i += 4) {
                const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                if (avg < min) min = avg;
                if (avg > max) max = avg;
            }
            
            // אם יש טווח מספיק, שפר ניגודיות
            if (max > min + 30) {
                const contrast = 220 / (max - min);
                
                for (let i = 0; i < data.length; i += 4) {
                    // שיפור ניגודיות
                    for (let c = 0; c < 3; c++) {
                        const newValue = (data[i + c] - min) * contrast + 20;
                        data[i + c] = Math.max(0, Math.min(255, newValue));
                    }
                }
            }
            
            // הוסף קצת חדות
            const sharpenedData = new Uint8ClampedArray(data);
            
            // החל פילטר חידוד פשוט
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    const idx = (y * width + x) * 4;
                    
                    for (let c = 0; c < 3; c++) {
                        // למד את הסביבה
                        const center = data[idx + c];
                        const top = data[(y - 1) * width * 4 + x * 4 + c];
                        const bottom = data[(y + 1) * width * 4 + x * 4 + c];
                        const left = data[y * width * 4 + (x - 1) * 4 + c];
                        const right = data[y * width * 4 + (x + 1) * 4 + c];
                        
                        // חישוב הבדל ממוצע
                        const avgNeighbor = (top + bottom + left + right) / 4;
                        const diff = center - avgNeighbor;
                        
                        // הגבר את ההבדל אבל רק באופן מתון
                        sharpenedData[idx + c] = Math.max(0, Math.min(255, center + diff * 0.6));
                    }
                }
            }
            
            // שמירת השינויים
            ctx.putImageData(new ImageData(sharpenedData, width, height), 0, 0);
            
            // הוסף מסגרת עדינה
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.lineWidth = 1;
            ctx.strokeRect(0, 0, width, height);
            
        } catch (err) {
            this.log(`שגיאה בשיפור תמונה: ${err.message}`, 'warn');
            // התעלם משגיאות בשיפור - עדיף תמונה לא משופרת מאשר שום תמונה
        }
    }
    
    // סינון ושיפור התוצאות הסופיות
    filterAndImproveDetections(allDetections) {
        if (allDetections.length === 0) {
            return [];
        }
        
        try {
            // מיין לפי רמת ביטחון
            allDetections.sort((a, b) => b.score - a.score);
            
            // קבץ לפי סוג אובייקט
            const objectsByClass = {};
            
            for (const detection of allDetections) {
                const className = detection.class;
                
                if (!objectsByClass[className]) {
                    objectsByClass[className] = [];
                }
                
                objectsByClass[className].push(detection);
            }
            
            // בחר את האובייקטים הטובים ביותר מכל סוג
            const uniqueObjects = [];
            
            for (const className in objectsByClass) {
                const objectsOfClass = objectsByClass[className];
                
                // מיין לפי רמת ביטחון
                objectsOfClass.sort((a, b) => b.score - a.score);
                
                // בחר את המופעים הייחודיים מכל סוג
                const uniqueInstancesOfClass = this.filterUniqueInstances(objectsOfClass);
                
                // הוסף את האובייקטים הייחודיים לרשימה הסופית
                uniqueObjects.push(...uniqueInstancesOfClass);
            }
            
            // סדר סופי לפי רמת ביטחון
            uniqueObjects.sort((a, b) => b.score - a.score);
            
            return uniqueObjects;
            
        } catch (err) {
            this.log(`שגיאה בסינון אובייקטים: ${err.message}`, 'warn');
            // במקרה של שגיאה, החזר את כל האובייקטים בלי סינון
            return allDetections;
        }
    }
    
    // סינון מופעים ייחודיים של אותו אובייקט
    filterUniqueInstances(objectsOfSameClass) {
        if (objectsOfSameClass.length <= 1) {
            return objectsOfSameClass;
        }
        
        const uniqueObjects = [];
        const positionGroups = new Map();
        
        // הערכת מרחק מינימלי בין אובייקטים ייחודיים
        const GRID_SIZE = 30;
        
        for (const obj of objectsOfSameClass) {
            const [x, y, width, height] = obj.bbox;
            
            // חלוקה לרשת גסה כדי לקבץ אובייקטים דומים
            const gridX = Math.floor(x / GRID_SIZE);
            const gridY = Math.floor(y / GRID_SIZE);
            const gridW = Math.floor(width / GRID_SIZE);  
            const key = `${gridX}_${gridY}_${gridW}`;
            
            // בדוק אם יש כבר אובייקט באזור זה
            if (!positionGroups.has(key)) {
                positionGroups.set(key, obj);
                uniqueObjects.push(obj);
            } else {
                // אם יש כבר אובייקט במיקום דומה, שמור את האובייקט עם הביטחון הגבוה יותר
                const existingObj = positionGroups.get(key);
                if (obj.score > existingObj.score) {
                    // החלף את האובייקט הקיים באובייקט טוב יותר
                    const index = uniqueObjects.indexOf(existingObj);
                    if (index !== -1) {
                        uniqueObjects[index] = obj;
                        positionGroups.set(key, obj);
                    }
                }
            }
        }
        
        return uniqueObjects;
    }

    // ייצוא מצגת איכותית
    generatePresentationExport(analysisData) {
        const objects = analysisData.objects;
        const title = `זיהוי אובייקטים - ${analysisData.fileName}`;
        
        let html = `
        <!DOCTYPE html>
        <html lang="he" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>${title}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 0;
                    background-color: #f0f0f0;
                }
                .slide {
                    width: 800px;
                    height: 600px;
                    margin: 20px auto;
                    background-color: white;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                    padding: 40px;
                    position: relative;
                    page-break-after: always;
                }
                .title-slide {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    text-align: center;
                }
                h1 {
                    color: #4285f4;
                    font-size: 36px;
                    margin-bottom: 20px;
                }
                h2 {
                    color: #4285f4;
                    font-size: 24px;
                    margin-bottom: 20px;
                }
                .object-image {
                    max-width: 80%;
                    max-height: 400px;
                    display: block;
                    margin: 0 auto 20px;
                    border: 1px solid #eee;
                }
                .info {
                    font-size: 18px;
                    margin-bottom: 10px;
                }
                .confidence {
                    color: #666;
                }
                .slide-number {
                    position: absolute;
                    bottom: 20px;
                    right: 20px;
                    font-size: 14px;
                    color: #999;
                }
                .time-info {
                    color: #888;
                    font-size: 14px;
                    margin-top: 10px;
                }
                @media print {
                    body {
                        background-color: white;
                    }
                    .slide {
                        box-shadow: none;
                        margin: 0;
                        height: 100vh;
                    }
                }
            </style>
        </head>
        <body>
            <!-- Title Slide -->
            <div class="slide title-slide">
                <h1>${title}</h1>
                <p>נמצאו ${objects.length} אובייקטים</p>
                <p>משך הסרטון: ${Math.round(analysisData.duration)} שניות</p>
                <p>תאריך: ${new Date().toLocaleDateString('he-IL')}</p>
                <div class="slide-number">1/${objects.length + 1}</div>
            </div>
        `;
        
        // הוסף שקופית לכל אובייקט
        objects.forEach((object, index) => {
            // המר זמן סרטון לפורמט דקות:שניות
            const minutes = Math.floor(object.time / 60);
            const seconds = Math.floor(object.time % 60);
            const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            html += `
            <div class="slide">
                <h2>אובייקט ${index + 1}: ${object.class}</h2>
                <img src="${object.image}" alt="${object.class}" class="object-image">
                <p class="info">סוג: <strong>${object.class}</strong></p>
                <p class="info confidence">רמת ביטחון: ${Math.round(object.score * 100)}%</p>
                <p class="time-info">זמן בסרטון: ${timeStr}</p>
                <div class="slide-number">${index + 2}/${objects.length + 1}</div>
            </div>
            `;
        });
        
        html += `
        </body>
        </html>
        `;
        
        // צור Blob וקישור להורדה
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `object-detection-${Date.now()}.html`;
        a.click();
        
        // ניקוי
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }
}

const objectDetector = new ObjectDetector(settingsManager);
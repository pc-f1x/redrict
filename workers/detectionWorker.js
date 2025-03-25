/**
 * Web Worker לזיהוי אובייקטים - מאפשר זיהוי מקבילי של אובייקטים ללא חסימת התהליך הראשי
 * 
 * הערה: בגלל שטעינת TensorFlow.js ב-Worker מורכבת, עובד זה מיועד בעיקר לעיבוד תמונה מקדים
 * ולא לזיהוי עצמו שנשאר בתהליך הראשי.
 */

self.onmessage = function(e) {
    try {
        const { action, data } = e.data;
        
        switch(action) {
            case 'prepareFrame':
                const processedFrame = prepareFrameForDetection(data.imageData, data.width, data.height);
                self.postMessage({
                    processedFrame: processedFrame.buffer,
                    width: data.width,
                    height: data.height
                }, [processedFrame.buffer]);
                break;
                
            case 'trackObject':
                const trackResult = trackObjectInFrames(data.prevFrame, data.currentFrame, 
                    data.bbox, data.width, data.height);
                self.postMessage({
                    bbox: trackResult.bbox,
                    confidence: trackResult.confidence
                });
                break;
                
            default:
                self.postMessage({
                    error: `פעולה לא מוכרת: ${action}`
                });
        }
        
    } catch (error) {
        self.postMessage({
            error: error.message
        });
    }
};

/**
 * הכנת פריים לזיהוי - נירמול והפחתת רעש
 * @param {ArrayBuffer} imageDataBuffer נתוני תמונה כבאפר
 * @param {number} width רוחב תמונה
 * @param {number} height גובה תמונה
 * @returns {Uint8ClampedArray} נתוני תמונה מעובדים
 */
function prepareFrameForDetection(imageDataBuffer, width, height) {
    const data = new Uint8ClampedArray(imageDataBuffer);
    const result = new Uint8ClampedArray(data.length);
    
    // העתקת ערוץ אלפא
    for (let i = 0; i < data.length; i += 4) {
        result[i + 3] = 255;
    }
    
    // נירמול וייצוב תאורה
    let avgBrightness = 0;
    for (let i = 0; i < data.length; i += 4) {
        avgBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
    }
    avgBrightness /= (data.length / 4);
    
    const targetBrightness = 128;
    const brightnessRatio = targetBrightness / Math.max(1, avgBrightness);
    
    // הפחתת רעש ויציבות אור
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4;
            
            for (let c = 0; c < 3; c++) {
                // מסנן ממוצע 3x3 להפחתת רעש
                let sum = 0;
                
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const neighbor = ((y + dy) * width + (x + dx)) * 4 + c;
                        sum += data[neighbor];
                    }
                }
                
                // ממוצע + התאמת בהירות
                let value = (sum / 9) * brightnessRatio;
                result[idx + c] = Math.max(0, Math.min(255, value));
            }
        }
    }
    
    return result;
}

/**
 * מעקב אחר אובייקט בין פריימים
 * @param {ArrayBuffer} prevFrameBuffer פריים קודם
 * @param {ArrayBuffer} currentFrameBuffer פריים נוכחי
 * @param {Array} bbox תיבת גבולות קודמת [x, y, width, height]
 * @param {number} width רוחב תמונה
 * @param {number} height גובה תמונה
 * @returns {Object} תיבת גבולות מעודכנת וביטחון
 */
function trackObjectInFrames(prevFrameBuffer, currentFrameBuffer, bbox, width, height) {
    const prevFrame = new Uint8ClampedArray(prevFrameBuffer);
    const currentFrame = new Uint8ClampedArray(currentFrameBuffer);
    
    // מיקום ומימדי האובייקט הקודמים
    let [x, y, w, h] = bbox;
    
    // אזור חיפוש מורחב
    const searchMargin = Math.max(10, Math.floor(Math.max(w, h) * 0.2));
    const searchX = Math.max(0, x - searchMargin);
    const searchY = Math.max(0, y - searchMargin);
    const searchW = Math.min(width - searchX, w + 2 * searchMargin);
    const searchH = Math.min(height - searchY, h + 2 * searchMargin);
    
    // מצא את ההתאמה הטובה ביותר באזור החיפוש
    let bestMatch = { x, y, similarity: 0 };
    
    // התאמת תבניות פשוטה
    for (let ty = searchY; ty <= searchY + searchH - h; ty++) {
        for (let tx = searchX; tx <= searchX + searchW - w; tx++) {
            let similarity = 0;
            let count = 0;
            
            // דגימת פיקסלים מהאובייקט לחישוב התאמה
            for (let sy = 0; sy < h; sy += 2) {
                for (let sx = 0; sx < w; sx += 2) {
                    const origIdx = ((y + sy) * width + (x + sx)) * 4;
                    const checkIdx = ((ty + sy) * width + (tx + sx)) * 4;
                    
                    // חישוב התאמת צבע
                    for (let c = 0; c < 3; c++) {
                        const diff = 255 - Math.abs(prevFrame[origIdx + c] - currentFrame[checkIdx + c]);
                        similarity += diff;
                    }
                    
                    count += 3;
                }
            }
            
            // התאמה ממוצעת
            similarity /= count;
            
            if (similarity > bestMatch.similarity) {
                bestMatch = { x: tx, y: ty, similarity };
            }
        }
    }
    
    // נרמול ביטחון לטווח 0-1
    const confidence = bestMatch.similarity / 255;
    
    // תיבת גבולות חדשה
    const newBbox = [bestMatch.x, bestMatch.y, w, h];
    
    return {
        bbox: newBbox,
        confidence
    };
}
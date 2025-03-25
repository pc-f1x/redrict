/**
 * פונקציות לעיבוד ושיפור תמונה
 */
const IMAGE_PROCESSING = {
    /**
     * החלת שיפורי איכות תמונה
     * @param {CanvasRenderingContext2D} ctx קונטקסט קנבס
     * @param {string} level רמת שיפור (none, basic, advanced, ultra)
     * @returns {Promise} הבטחה שמתממשת כאשר העיבוד הסתיים
     */
    applyImageEnhancement: async function(ctx, level) {
        if (level === 'none') return;
        
        const canvas = ctx.canvas;
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // בדיקה אם Web Workers זמינים ומותרים
        if (UTILS.isWebWorkerSupported() && level !== 'basic') {
            return this.applyEnhancementWithWorker(ctx, imageData, level);
        } else {
            // עיבוד בתהליך הראשי
            this.enhanceImageData(imageData, level);
            ctx.putImageData(imageData, 0, 0);
            return Promise.resolve();
        }
    },
    
    /**
     * החלת שיפור תמונה באמצעות Web Worker
     * @param {CanvasRenderingContext2D} ctx קונטקסט קנבס
     * @param {ImageData} imageData נתוני תמונה
     * @param {string} level רמת שיפור
     * @returns {Promise} הבטחה שמתממשת כאשר העיבוד הסתיים
     */
    applyEnhancementWithWorker: function(ctx, imageData, level) {
        return new Promise((resolve, reject) => {
            // יצירת Worker לעיבוד תמונה
            const worker = new Worker('workers/imageEnhancementWorker.js');
            
            // הגדרת טיימאאוט למקרה שהעובד נתקע
            const timeoutId = setTimeout(() => {
                worker.terminate();
                console.warn('עיבוד תמונה באמצעות worker נכשל בגלל טיימאאוט');
                
                // ננסה לעבד בתהליך הראשי במקום
                this.enhanceImageData(imageData, level);
                ctx.putImageData(imageData, 0, 0);
                resolve();
            }, CONFIG.app.workerTimeout);
            
            // מאזין לתשובה מהעובד
            worker.onmessage = function(e) {
                clearTimeout(timeoutId);
                
                if (e.data.error) {
                    console.error('שגיאה בעיבוד תמונה:', e.data.error);
                    reject(e.data.error);
                } else {
                    const enhancedData = new ImageData(
                        new Uint8ClampedArray(e.data.enhancedData), 
                        imageData.width, 
                        imageData.height
                    );
                    ctx.putImageData(enhancedData, 0, 0);
                    resolve();
                }
                
                worker.terminate();
            };
            
            // שליחת הנתונים לעובד
            worker.postMessage({
                imageData: imageData.data.buffer,
                width: imageData.width,
                height: imageData.height,
                level: level
            }, [imageData.data.buffer]); // העברת הבאפר בלי העתקה
        });
    },
    
    /**
     * שיפור נתוני תמונה (בתהליך הראשי)
     * @param {ImageData} imageData נתוני תמונה
     * @param {string} level רמת שיפור
     * @returns {void}
     */
    enhanceImageData: function(imageData, level) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        
        switch(level) {
            case 'basic':
                this.applyBasicEnhancement(data);
                break;
                
            case 'advanced':
                this.applyAdvancedEnhancement(data, width, height);
                break;
                
            case 'ultra':
                this.applyUltraEnhancement(data, width, height);
                break;
        }
    },
    
    /**
     * שיפור בסיסי - ניגודיות ורוויה פשוטה
     * @param {Uint8ClampedArray} data נתוני פיקסלים
     * @returns {void}
     */
    applyBasicEnhancement: function(data) {
        const contrast = 1.15; // מקדם ניגודיות
        const saturation = 1.2; // מקדם רוויה
        
        for (let i = 0; i < data.length; i += 4) {
            // הגברת ניגודיות
            for (let c = 0; c < 3; c++) {
                const newVal = (data[i + c] - 128) * contrast + 128;
                data[i + c] = Math.max(0, Math.min(255, newVal));
            }
            
            // הגברת רוויה
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const gray = 0.3 * r + 0.59 * g + 0.11 * b;
            
            data[i] = Math.max(0, Math.min(255, gray + saturation * (r - gray)));
            data[i + 1] = Math.max(0, Math.min(255, gray + saturation * (g - gray)));
            data[i + 2] = Math.max(0, Math.min(255, gray + saturation * (b - gray)));
        }
    },
    
    /**
     * שיפור מתקדם - חידוד, הפחתת רעש וכיול צבע
     * @param {Uint8ClampedArray} data נתוני פיקסלים
     * @param {number} width רוחב תמונה
     * @param {number} height גובה תמונה
     * @returns {void}
     */
    applyAdvancedEnhancement: function(data, width, height) {
        // עותק של הנתונים המקוריים
        const originalData = new Uint8ClampedArray(data);
        
        // מסנן חידוד - עבור כל פיקסל מלבד השוליים
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = (y * width + x) * 4;
                
                // החלת מסנן חידוד לכל ערוץ
                for (let c = 0; c < 3; c++) {
                    // קרנל חידוד 3x3
                    const val = 
                        -originalData[idx - width * 4 - 4 + c] * 0.1 +
                        -originalData[idx - width * 4 + c] * 0.15 +
                        -originalData[idx - width * 4 + 4 + c] * 0.1 +
                        -originalData[idx - 4 + c] * 0.15 +
                        originalData[idx + c] * 2.0 +
                        -originalData[idx + 4 + c] * 0.15 +
                        -originalData[idx + width * 4 - 4 + c] * 0.1 +
                        -originalData[idx + width * 4 + c] * 0.15 +
                        -originalData[idx + width * 4 + 4 + c] * 0.1;
                        
                    data[idx + c] = Math.max(0, Math.min(255, val));
                }
            }
        }
        
        // הגברת ניגודיות ורוויה
        const contrast = 1.15;
        const saturation = 1.3;
        
        for (let i = 0; i < data.length; i += 4) {
            // ניגודיות
            for (let c = 0; c < 3; c++) {
                const newVal = (data[i + c] - 128) * contrast + 128;
                data[i + c] = Math.max(0, Math.min(255, newVal));
            }
            
            // רוויה
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const gray = 0.3 * r + 0.59 * g + 0.11 * b;
            
            data[i] = Math.max(0, Math.min(255, gray + saturation * (r - gray)));
            data[i + 1] = Math.max(0, Math.min(255, gray + saturation * (g - gray)));
            data[i + 2] = Math.max(0, Math.min(255, gray + saturation * (b - gray)));
        }
    },
    
    /**
     * שיפור אולטרה - חידוד מתקדם, הפחתת רעש מתקדמת ושיפור פרטים
     * @param {Uint8ClampedArray} data נתוני פיקסלים
     * @param {number} width רוחב תמונה
     * @param {number} height גובה תמונה
     * @returns {void}
     */
    applyUltraEnhancement: function(data, width, height) {
        // עותק של הנתונים המקוריים
        const originalData = new Uint8ClampedArray(data);
        
        // שלב 1: הפחתת רעש באמצעות מסנן בילטרלי מפושט
        const denoised = this.applySimplifiedBilateralFilter(originalData, width, height);
        
        // שלב 2: חידוד עם Unsharp Mask
        const blurred = this.applyGaussianBlur(denoised, width, height, 1.5);
        
        // שלב 3: החלת Unsharp Mask וניגודיות
        const sharpenAmount = 1.25;
        const contrast = 1.25;
        const saturation = 1.35;
        
        for (let i = 0; i < data.length; i += 4) {
            // החלת חידוד
            for (let c = 0; c < 3; c++) {
                const original = denoised[i + c];
                const blur = blurred[i + c];
                const diff = original - blur;
                
                let newVal = original + diff * sharpenAmount;
                newVal = (newVal - 128) * contrast + 128;
                data[i + c] = Math.max(0, Math.min(255, newVal));
            }
            
            // הגברת רוויה
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const gray = 0.3 * r + 0.59 * g + 0.11 * b;
            
            data[i] = Math.max(0, Math.min(255, gray + saturation * (r - gray)));
            data[i + 1] = Math.max(0, Math.min(255, gray + saturation * (g - gray)));
            data[i + 2] = Math.max(0, Math.min(255, gray + saturation * (b - gray)));
        }
        
        // שלב 4: התאמת רמות אור אוטומטית
        this.applyAutoLevels(data);
    },
    
    /**
     * החלת מסנן גאוסי פשוט
     * @param {Uint8ClampedArray} data נתוני פיקסלים
     * @param {number} width רוחב התמונה
     * @param {number} height גובה התמונה
     * @param {number} sigma סיגמא של הגאוסיאן
     * @returns {Uint8ClampedArray} נתוני התמונה המטושטשת
     */
    applyGaussianBlur: function(data, width, height, sigma) {
        const result = new Uint8ClampedArray(data.length);
        const size = Math.max(3, Math.ceil(sigma * 3) | 1);
        const halfSize = Math.floor(size / 2);
        
        // יצירת קרנל גאוסי
        const kernel = [];
        let sum = 0;
        
        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                const x = i - halfSize;
                const y = j - halfSize;
                const value = Math.exp(-(x*x + y*y) / (2 * sigma * sigma));
                kernel.push(value);
                sum += value;
            }
        }
        
        // נרמול הקרנל
        for (let i = 0; i < kernel.length; i++) {
            kernel[i] /= sum;
        }
        
        // העתקת ערוץ אלפא
        for (let i = 0; i < data.length; i += 4) {
            result[i + 3] = data[i + 3];
        }
        
        // החלת הקרנל על התמונה
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                
                for (let c = 0; c < 3; c++) {
                    let sum = 0;
                    let kernelSum = 0;
                    
                    for (let ky = -halfSize; ky <= halfSize; ky++) {
                        for (let kx = -halfSize; kx <= halfSize; kx++) {
                            const pixelY = Math.min(height - 1, Math.max(0, y + ky));
                            const pixelX = Math.min(width - 1, Math.max(0, x + kx));
                            const pixelIdx = (pixelY * width + pixelX) * 4;
                            const kernelIdx = (ky + halfSize) * size + (kx + halfSize);
                            
                            sum += data[pixelIdx + c] * kernel[kernelIdx];
                            kernelSum += kernel[kernelIdx];
                        }
                    }
                    
                    result[idx + c] = sum / kernelSum;
                }
            }
        }
        
        return result;
    },
    
    /**
     * החלת מסנן בילטרלי מפושט להפחתת רעש תוך שמירה על קצוות
     * @param {Uint8ClampedArray} data נתוני פיקסלים
     * @param {number} width רוחב התמונה
     * @param {number} height גובה התמונה
     * @returns {Uint8ClampedArray} נתוני התמונה המשופרת
     */
    applySimplifiedBilateralFilter: function(data, width, height) {
        const result = new Uint8ClampedArray(data.length);
        const radius = 2;
        const sigmaSpace = 2.0;
        const sigmaColor = 25.0;
        
        // העתקת ערוץ אלפא
        for (let i = 0; i < data.length; i += 4) {
            result[i + 3] = data[i + 3];
        }
        
        // החלת המסנן
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                
                const centerR = data[idx];
                const centerG = data[idx + 1];
                const centerB = data[idx + 2];
                
                let sumR = 0, sumG = 0, sumB = 0;
                let totalWeight = 0;
                
                for (let ky = -radius; ky <= radius; ky++) {
                    for (let kx = -radius; kx <= radius; kx++) {
                        const pixelY = Math.min(height - 1, Math.max(0, y + ky));
                        const pixelX = Math.min(width - 1, Math.max(0, x + kx));
                        const pixelIdx = (pixelY * width + pixelX) * 4;
                        
                        const r = data[pixelIdx];
                        const g = data[pixelIdx + 1];
                        const b = data[pixelIdx + 2];
                        
                        // חישוב מרחק מרחבי
                        const spatialDist = kx * kx + ky * ky;
                        const spatialWeight = Math.exp(-spatialDist / (2 * sigmaSpace * sigmaSpace));
                        
                        // חישוב הבדל צבעים
                        const colorDist = Math.pow(r - centerR, 2) + 
                                          Math.pow(g - centerG, 2) + 
                                          Math.pow(b - centerB, 2);
                        const colorWeight = Math.exp(-colorDist / (2 * sigmaColor * sigmaColor));
                        
                        // משקל כולל
                        const weight = spatialWeight * colorWeight;
                        
                        sumR += r * weight;
                        sumG += g * weight;
                        sumB += b * weight;
                        totalWeight += weight;
                    }
                }
                
                result[idx] = Math.round(sumR / totalWeight);
                result[idx + 1] = Math.round(sumG / totalWeight);
                result[idx + 2] = Math.round(sumB / totalWeight);
            }
        }
        
        return result;
    },
    
    /**
     * התאמת רמות אור אוטומטית
     * @param {Uint8ClampedArray} data נתוני פיקסלים
     * @returns {void}
     */
    applyAutoLevels: function(data) {
        let minR = 255, minG = 255, minB = 255;
        let maxR = 0, maxG = 0, maxB = 0;
        
        // מציאת ערכי מינימום ומקסימום בכל ערוץ
        for (let i = 0; i < data.length; i += 4) {
            minR = Math.min(minR, data[i]);
            minG = Math.min(minG, data[i + 1]);
            minB = Math.min(minB, data[i + 2]);
            
            maxR = Math.max(maxR, data[i]);
            maxG = Math.max(maxG, data[i + 1]);
            maxB = Math.max(maxB, data[i + 2]);
        }
        
        // בדיקה אם יש צורך בהתאמה
        if (minR === maxR) minR = 0;
        if (minG === maxG) minG = 0;
        if (minB === maxB) minB = 0;
        
        // התאמת רמות
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 255 * (data[i] - minR) / (maxR - minR);
            data[i + 1] = 255 * (data[i + 1] - minG) / (maxG - minG);
            data[i + 2] = 255 * (data[i + 2] - minB) / (maxB - minB);
        }
    }
};
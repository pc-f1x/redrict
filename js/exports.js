/**
 * טיפול בייצוא נתונים (PDF, PPTX, JSON)
 */
const EXPORTS = {
    /**
     * יצירת PDF עם תוצאות הזיהוי
     * @returns {void}
     */
    generatePDF: function() {
        const objects = DETECTION.getDetectedObjects();
        
        if (objects.length === 0) {
            UI.showNotification('אין אובייקטים מזוהים. נא לנתח סרטון תחילה.', 'error');
            return;
        }
        
        // בדיקה שספריית pdfMake נטענה
        if (!window.pdfMake) {
            UI.showNotification('טוען ספריית PDF...', 'info');
            
            Promise.all([
                loadScript('https://cdn.jsdelivr.net/npm/pdfmake@0.2.7/build/pdfmake.min.js'),
                loadScript('https://cdn.jsdelivr.net/npm/pdfmake@0.2.7/build/vfs_fonts.js')
            ]).then(() => {
                this.generatePDF();
            });
            
            return;
        }
        
        UI.showNotification('מייצר PDF, אנא המתן...', 'info');
        
        // הגדרת מסמך PDF
        const documentDefinition = {
            rtl: true,
            pageSize: 'A4',
            pageMargins: [40, 60, 40, 60],
            info: {
                title: 'דוח זיהוי אובייקטים',
                author: userName,
                subject: 'AI Vision Pro - תוצאות ניתוח'
            },
            content: [
                {
                    text: 'דוח זיהוי אובייקטים',
                    style: 'header',
                    alignment: 'center',
                    margin: [0, 0, 0, 20]
                },
                {
                    text: `תאריך הפקה: ${new Date().toLocaleDateString('he-IL')}`,
                    alignment: 'center',
                    margin: [0, 0, 0, 5]
                },
                {
                    text: `סה"כ אובייקטים שזוהו: ${objects.length}`,
                    alignment: 'center',
                    margin: [0, 0, 0, 20]
                },
                {
                    canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1 }],
                    margin: [0, 0, 0, 20]
                }
            ],
            styles: {
                header: {
                    fontSize: 24,
                    bold: true,
                    color: '#3563E9'
                },
                objectTitle: {
                    fontSize: 18,
                    bold: true,
                    color: '#242731',
                    margin: [0, 10, 0, 5]
                },
                objectMeta: {
                    fontSize: 12,
                    color: '#5F6165',
                    margin: [0, 0, 0, 10]
                },
                objectLink: {
                    fontSize: 12,
                    color: '#3563E9',
                    decoration: 'underline'
                }
            },
            defaultStyle: {
                font: 'Roboto'
            }
        };
        
        // הוספת האובייקטים שזוהו
        objects.forEach((object, index) => {
            const displayName = object.refinedClassName || object.className;
            
            // הוספת מידע על אובייקט
            const objectContent = {
                columns: [
                    {
                        width: '65%',
                        stack: [
                            { text: displayName, style: 'objectTitle' },
                            { text: `רמת ביטחון: ${(object.confidence * 100).toFixed(1)}%`, style: 'objectMeta' },
                            { text: `זמן בסרטון: ${UTILS.formatTime(object.frameTime)}`, style: 'objectMeta' },
                            { 
                                text: 'חפש בגוגל', 
                                style: 'objectLink',
                                link: `https://www.google.com/search?q=${encodeURIComponent(displayName)}`,
                                margin: [0, 10, 0, 0]
                            }
                        ]
                    },
                    {
                        width: '35%',
                        image: object.thumbnail,
                        fit: [150, 150]
                    }
                ],
                margin: [0, 0, 0, 20]
            };
            
            documentDefinition.content.push(objectContent);
            
            // הוספת קו מפריד, אך לא אחרי האובייקט האחרון
            if (index < objects.length - 1) {
                documentDefinition.content.push({
                    canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 0.5, dash: { length: 2 } }],
                    margin: [0, 0, 0, 20]
                });
            }
        });
        
        // יצירת והורדת ה-PDF
        try {
            pdfMake.createPdf(documentDefinition).download(`דוח_זיהוי_אובייקטים_${new Date().toLocaleDateString('he-IL').replace(/\//g, '-')}`);
            UI.showNotification('ה-PDF נוצר בהצלחה!', 'success');
        } catch (error) {
            console.error('שגיאה ביצירת PDF:', error);
            UI.showNotification('שגיאה ביצירת PDF', 'error');
        }
    },
    
    /**
     * יצירת מצגת PowerPoint
     * @returns {void}
     */
    generatePPTX: function() {
        const objects = DETECTION.getDetectedObjects();
        
        if (objects.length === 0) {
            UI.showNotification('אין אובייקטים מזוהים. נא לנתח סרטון תחילה.', 'error');
            return;
        }
        
        // בדיקה שספריית pptxgenjs נטענה
        if (!window.PptxGenJS) {
            UI.showNotification('טוען ספריית PPTX...', 'info');
            
            loadScript('https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.min.js')
                .then(() => {
                    this.generatePPTX();
                });
            
            return;
        }
        
        UI.showNotification('מייצר מצגת, אנא המתן...', 'info');
        
        try {
            // יצירת מצגת חדשה
            const pptx = new PptxGenJS();
            
            // הגדרת נושא למצגת
            pptx.layout = 'LAYOUT_WIDE';
            pptx.rtl = true;
            
            // הגדרת עיצוב כללי
            pptx.defineSlideMaster({
                title: 'MAIN_THEME',
                background: { color: 'FFFFFF' },
                objects: [
                    // כותרת עליונה
                    { rect: { x: 0, y: 0, w: '100%', h: '8%', fill: { color: '3563E9' } } },
                    // פס תחתון
                    { rect: { x: 0, y: '95%', w: '100%', h: '5%', fill: { color: '3563E9' } } }
                ]
            });
            
            // שקופית כותרת
            const titleSlide = pptx.addSlide({ masterName: 'MAIN_THEME' });
            
            titleSlide.addText('דוח זיהוי אובייקטים', {
                x: '5%',
                y: '40%',
                w: '90%',
                h: '10%',
                align: 'center',
                fontSize: 44,
                bold: true,
                color: '3563E9',
                fontFace: 'Arial'
            });
            
            titleSlide.addText(`נוצר על ידי AI Vision Pro | ${new Date().toLocaleDateString('he-IL')}`, {
                x: '5%',
                y: '52%',
                w: '90%',
                h: '5%',
                align: 'center',
                fontSize: 18,
                color: '5F6165',
                fontFace: 'Arial'
            });
            
            // שקופית סיכום
            const summarySlide = pptx.addSlide({ masterName: 'MAIN_THEME' });
            
            summarySlide.addText('סיכום ממצאים', {
                x: '5%',
                y: '12%',
                w: '90%',
                h: '10%',
                fontSize: 32,
                bold: true,
                color: '242731',
                fontFace: 'Arial'
            });
            
            // יצירת מידע סטטיסטי
            summarySlide.addText(`סה"כ אובייקטים שזוהו: ${objects.length}`, {
                x: '5%',
                y: '25%',
                w: '90%',
                h: '5%',
                fontSize: 18,
                color: '242731',
                fontFace: 'Arial'
            });
            
            // יצירת דיאגרמת אובייקטים לפי קטגוריות
            const categories = {};
            objects.forEach(obj => {
                if (!categories[obj.className]) {
                    categories[obj.className] = 0;
                }
                categories[obj.className]++;
            });
            
            // הכנת נתונים לתרשים
            const chartData = [];
            const labels = [];
            const values = [];
            
            Object.keys(categories).forEach(category => {
                labels.push(category);
                values.push(categories[category]);
            });
            
            // הוספת תרשים אם יש מספיק נתונים
            if (labels.length > 0) {
                summarySlide.addChart(pptx.ChartType.pie, 
                    [{
                        name: 'אובייקטים',
                        labels,
                        values
                    }], 
                    {
                        x: '20%',
                        y: '35%',
                        w: '60%',
                        h: '50%',
                        chartColors: ['3563E9', '34C759', 'FF605C', 'FBBC05', '9C27B0', 'FF9800'],
                        showLegend: true,
                        legendPos: 'r',
                        legendFontSize: 12,
                        dataLabelFontSize: 10,
                        showTitle: true,
                        title: 'התפלגות אובייקטים לפי סוג',
                        titleFontSize: 16,
                        titleColor: '242731',
                        showValue: true
                    }
                );
            }
            
            // שקופיות לכל אובייקט
            objects.forEach((object, index) => {
                const objectSlide = pptx.addSlide({ masterName: 'MAIN_THEME' });
                const displayName = object.refinedClassName || object.className;
                
                // כותרת
                objectSlide.addText(displayName, {
                    x: '5%',
                    y: '12%',
                    w: '90%',
                    h: '8%',
                    fontSize: 32,
                    bold: true,
                    color: '242731',
                    fontFace: 'Arial'
                });
                
                // תמונה
                objectSlide.addImage({
                    data: object.thumbnail,
                    x: '5%',
                    y: '25%',
                    w: '45%',
                    h: '60%'
                });
                
                // מידע
                objectSlide.addText([
                    { text: 'פרטי הזיהוי', options: { bold: true, fontSize: 20, breakLine: true, color: '3563E9' } },
                    { text: `רמת ביטחון: ${(object.confidence * 100).toFixed(1)}%`, options: { fontSize: 16, breakLine: true, color: '5F6165' } },
                    { text: `זמן בסרטון: ${UTILS.formatTime(object.frameTime)}`, options: { fontSize: 16, breakLine: true, color: '5F6165' } },
                    { text: ' ', options: { breakLine: true } }, // מרווח
                    { text: 'קישורים', options: { bold: true, fontSize: 20, breakLine: true, color: '3563E9' } },
                    { text: 'חיפוש בגוגל', options: { fontSize: 16, color: '3563E9', hyperlink: { url: `https://www.google.com/search?q=${encodeURIComponent(displayName)}` } } }
                ], {
                    x: '55%',
                    y: '25%',
                    w: '40%',
                    h: '60%',
                    fontFace: 'Arial'
                });
                
                // מספר עמוד
                objectSlide.addText(`${index + 1} / ${objects.length}`, {
                    x: '5%',
                    y: '88%',
                    w: '90%',
                    h: '5%',
                    align: 'center',
                    fontSize: 12,
                    color: 'FFFFFF',
                    fontFace: 'Arial'
                });
            });
            
            // שמירת המצגת
            pptx.writeFile({ fileName: `מצגת_זיהוי_אובייקטים_${new Date().toLocaleDateString('he-IL').replace(/\//g, '-')}.pptx` })
                .then(() => {
                    UI.showNotification('המצגת נוצרה בהצלחה!', 'success');
                })
                .catch(error => {
                    console.error('שגיאה ביצירת המצגת:', error);
                    UI.showNotification('שגיאה ביצירת המצגת', 'error');
                });
        } catch (error) {
            console.error('שגיאה ביצירת PPTX:', error);
            UI.showNotification('שגיאה ביצירת המצגת', 'error');
        }
    },
    
    /**
     * ייצוא קובץ JSON עם תוצאות הזיהוי
     * @returns {void}
     */
    exportJSON: function() {
        const objects = DETECTION.getDetectedObjects();
        
        if (objects.length === 0) {
            UI.showNotification('אין אובייקטים מזוהים. נא לנתח סרטון תחילה.', 'error');
            return;
        }
        
        // הכנת אובייקט נתונים
        const exportData = {
            metadata: {
                date: new Date().toISOString(),
                objectCount: objects.length,
                user: userName,
                software: 'AI Vision Pro',
                version: '1.0'
            },
            settings: UI.state.currentSettings,
            objects: objects.map(obj => ({
                className: obj.className,
                refinedClassName: obj.refinedClassName || null,
                confidence: obj.confidence,
                frameTime: obj.frameTime,
                bbox: obj.bbox || null,
                subcategories: obj.subcategories || null,
                thumbnail: obj.thumbnail
            }))
        };
        
        // המרה למחרוזת JSON
        const jsonString = JSON.stringify(exportData, null, 2);
        
        // יצירת קובץ להורדה
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `זיהוי_אובייקטים_${new Date().toISOString().replace(/:/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        UI.showNotification('קובץ JSON יוצא בהצלחה!', 'success');
    }
};
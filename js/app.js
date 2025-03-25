/**
 * מודול ראשי - טיפול בפונקציונליות מרכזית של האפליקציה
 */
const APP = {
    // נתוני מצב
    state: {
        userIP: '',
        userName: '',
        usageCount: 0,
        videoFile: null,
        isProcessing: false
    },
    
    /**
     * אתחול האפליקציה
     * @returns {void}
     */
    init: function() {
        // אתחול ממשק משתמש
        UI.init();
        
        // בדיקת סטטוס התחברות
        this.checkLoginStatus();
        
        // שמירה אוטומטית של תוצאות
        setInterval(() => {
            if (DETECTION.getDetectedObjects().length > 0) {
                UTILS.saveToStorage('latestResults', DETECTION.getDetectedObjects());
            }
        }, CONFIG.app.autosaveInterval);
        
        // טעינת תוצאות שמורות אם ישנן
        const savedResults = UTILS.loadFromStorage('latestResults', []);
        if (savedResults.length > 0) {
            DETECTION.state.detectedObjects = savedResults;
            UI.displayResults(savedResults);
        }
    },
    
    /**
     * בדיקת סטטוס התחברות
     * @returns {void}
     */
    checkLoginStatus: function() {
        const userData = UTILS.loadFromStorage('userData', {});
        const session = UTILS.loadFromStorage('currentSession', {});
        
        if (session.userName && session.userIP) {
            this.state.userName = session.userName;
            this.state.userIP = session.userIP;
            
            if (userData[this.state.userIP]) {
                // בדיקה אם 48 שעות עברו מאז איפוס אחרון
                const lastReset = userData[this.state.userIP].lastReset;
                if (Date.now() - lastReset > CONFIG.usage.timeframe) {
                    userData[this.state.userIP].usageCount = 0;
                    userData[this.state.userIP].lastReset = Date.now();
                    UTILS.saveToStorage('userData', userData);
                }
                
                this.state.usageCount = userData[this.state.userIP].usageCount;
                document.getElementById('usageCount').textContent = CONFIG.usage.limit - this.state.usageCount;
                document.getElementById('mainApp').style.display = 'block';
                document.getElementById('loginSection').style.display = 'none';
            }
        }
    },
    
    /**
     * רישום משתמש חדש
     * @returns {Promise} הבטחה שמתממשת עם סיום הרישום
     */
    registerUser: async function() {
        this.state.userName = document.getElementById('userName').value;
        
        if (!this.state.userName || this.state.userName.trim() === '') {
            document.getElementById('loginStatus').textContent = "נא להזין שם משתמש";
            return;
        }
        
        document.getElementById('loginButton').disabled = true;
        
        try {
            // השגת IP
            this.state.userIP = await UTILS.getUserIP();
            
            // שמירת נתוני משתמש
            const userData = UTILS.loadFromStorage('userData', {});
            
            if (!userData[this.state.userIP]) {
                userData[this.state.userIP] = {
                    name: this.state.userName,
                    usageCount: 0,
                    lastReset: Date.now(),
                    firstLogin: Date.now()
                };
            } else {
                // בדיקה אם 48 שעות עברו מאז איפוס אחרון
                const lastReset = userData[this.state.userIP].lastReset;
                if (Date.now() - lastReset > CONFIG.usage.timeframe) {
                    userData[this.state.userIP].usageCount = 0;
                    userData[this.state.userIP].lastReset = Date.now();
                }
                userData[this.state.userIP].name = this.state.userName;
            }
            
            this.state.usageCount = userData[this.state.userIP].usageCount;
            UTILS.saveToStorage('userData', userData);
            
            // שמירת סשן
            UTILS.saveToStorage('currentSession', {
                userName: this.state.userName,
                userIP: this.state.userIP,
                loginTime: Date.now()
            });
            
            document.getElementById('usageCount').textContent = CONFIG.usage.limit - this.state.usageCount;
            document.getElementById('loginStatus').textContent = '';
            document.getElementById('mainApp').style.display = 'block';
            document.getElementById('loginSection').style.display = 'none';
            
            // אנימציית כניסה
            document.getElementById('mainApp').animate([
                { opacity: 0, transform: 'translateY(20px)' },
                { opacity: 1, transform: 'translateY(0)' }
            ], {
                duration: 500,
                easing: 'ease-out',
                fill: 'forwards'
            });
            
            UI.showNotification(`ברוך הבא, ${this.state.userName}!`, 'success');
            
            // טעינת מודל מראש אם יש גישה לרשת וכוח עיבוד מספיק
            if (navigator.onLine && !UI.state.currentSettings.deviceOptimization || !UTILS.detectDevice().isMobile) {
                DETECTION.loadModels(UI.state.currentSettings);
            }
        } catch (error) {
            console.error('שגיאה ברישום:', error);
            document.getElementById('loginButton').disabled = false;
            document.getElementById('loginStatus').textContent = 'שגיאה ברישום, נסה שוב';
        }
    },
    
    /**
     * עיבוד סרטון
     * @returns {Promise} הבטחה שמתממשת עם סיום העיבוד
     */
    processVideo: async function() {
        // בדיקת ספריות TensorFlow
        if (window.tf === undefined) {
            UI.showNotification('טוען ספריות עיבוד...', 'info');
            window.pendingVideoProcessing = true;
            return;
        }
        
        // בדיקת הגבלת שימוש
        const userData = UTILS.loadFromStorage('userData', {});
        
        if (userData[this.state.userIP] && userData[this.state.userIP].usageCount >= CONFIG.usage.limit) {
            UI.showNotification(`הגעת למגבלת השימושים (${CONFIG.usage.limit}) ב-48 שעות האחרונות`, 'error');
            return;
        }
        
        const videoInput = document.getElementById('videoInput');
        
        if (!videoInput.files || videoInput.files.length === 0) {
            UI.showNotification('נא לבחור סרטון תחילה', 'error');
            return;
        }
        
        if (this.state.isProcessing) {
            UI.showNotification('עיבוד סרטון כבר מתבצע, אנא המתן', 'error');
            return;
        }
        
        this.state.isProcessing = true;
        
        try {
            // עדכון מונה שימושים
            userData[this.state.userIP].usageCount += 1;
            this.state.usageCount = userData[this.state.userIP].usageCount;
            UTILS.saveToStorage('userData', userData);
            document.getElementById('usageCount').textContent = CONFIG.usage.limit - this.state.usageCount;
            
            const videoFile = videoInput.files[0];
            const videoURL = URL.createObjectURL(videoFile);
            const video = document.getElementById('video');
            
            // ניקוי תוצאות קודמות
            DETECTION.clearResults();
            UI.toggleLoader(true);
            
            // טעינת הסרטון
            video.src = videoURL;
            
            // המתנה לטעינת הסרטון
            await new Promise(resolve => {
                video.onloadedmetadata = () => {
                    resolve();
                };
            });
            
            // עיבוד הסרטון
            const results = await DETECTION.processVideo(video, UI.state.currentSettings);
            
            // הצגת תוצאות
            UI.displayResults(results);
            
            UI.showNotification('עיבוד הסרטון הושלם בהצלחה!', 'success');
            
            // שמירת התוצאות באחסון מקומי
            UTILS.saveToStorage('latestResults', results);
        } catch (error) {
            console.error('שגיאה בעיבוד הסרטון:', error);
            UI.showNotification('שגיאה בעיבוד הסרטון', 'error');
        } finally {
            this.state.isProcessing = false;
            UI.toggleLoader(false);
        }
    }
};

// אתחול האפליקציה כאשר המסמך נטען
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        APP.init();
    }, 100);
});
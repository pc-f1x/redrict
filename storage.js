// storage.js - Handles user data, history, and quotas

class StorageManager {
    constructor() {
        this.storageKey = 'objectDetectionApp';
        this.ipAddress = null;
        this.initializeStorage();
        this.getIPAddress();
    }

    async getIPAddress() {
        try {
            // For demo purposes, we'll simulate getting an IP
            // In a real app, you might use a service like ipify API
            this.ipAddress = '192.168.1.' + Math.floor(Math.random() * 255);
            console.log('IP Address:', this.ipAddress);
        } catch (error) {
            console.error('Error getting IP address:', error);
            this.ipAddress = 'unknown';
        }
    }

    initializeStorage() {
        if (!localStorage.getItem(this.storageKey)) {
            const initialData = {
                users: {},
                settings: this.getDefaultSettings()
            };
            localStorage.setItem(this.storageKey, JSON.stringify(initialData));
        }
    }

    getDefaultSettings() {
        return {
            detection: {
                confidenceThreshold: 0.6,
                maxDetections: 20
            },
            display: {
                showBoundingBoxes: true,
                showLabels: true,
                boxColor: '#FF0000'
            },
            search: {
                google: true,
                bing: true,
                yandex: true
            }
        };
    }

    getData() {
        return JSON.parse(localStorage.getItem(this.storageKey));
    }

    saveData(data) {
        localStorage.setItem(this.storageKey, JSON.stringify(data));
    }

    getUserByIP() {
        const data = this.getData();
        return data.users[this.ipAddress];
    }

    createUser(username) {
        const data = this.getData();
        
        data.users[this.ipAddress] = {
            username: username,
            quota: {
                remaining: 10,
                resetTime: Date.now() + 48 * 60 * 60 * 1000 // 48 hours from now
            },
            history: []
        };
        
        this.saveData(data);
        return data.users[this.ipAddress];
    }

    updateUserQuota() {
        const data = this.getData();
        const user = data.users[this.ipAddress];
        
        if (user) {
            // Reset quota if needed
            if (Date.now() > user.quota.resetTime) {
                user.quota.remaining = 10;
                user.quota.resetTime = Date.now() + 48 * 60 * 60 * 1000;
            }
            
            // Decrease quota if videos remaining
            if (user.quota.remaining > 0) {
                user.quota.remaining--;
                this.saveData(data);
                return true;
            }
        }
        
        return false;
    }

    getSettings() {
        const data = this.getData();
        return data.settings;
    }

    saveSettings(settings) {
        const data = this.getData();
        data.settings = settings;
        this.saveData(data);
    }

    resetSettings() {
        const data = this.getData();
        data.settings = this.getDefaultSettings();
        this.saveData(data);
        return data.settings;
    }

    addToHistory(analysisData) {
        const data = this.getData();
        const user = data.users[this.ipAddress];
        
        if (user) {
            // Add new analysis to history
            user.history.unshift({
                id: Date.now().toString(),
                date: new Date().toISOString(),
                thumbnail: analysisData.thumbnail,
                fileName: analysisData.fileName,
                objectCount: analysisData.objectCount,
                duration: analysisData.duration,
                objects: analysisData.objects
            });
            
            // Limit history to 20 items
            if (user.history.length > 20) {
                user.history = user.history.slice(0, 20);
            }
            
            this.saveData(data);
        }
    }

    getHistory() {
        const user = this.getUserByIP();
        return user ? user.history : [];
    }

    getHistoryItem(id) {
        const history = this.getHistory();
        return history.find(item => item.id === id);
    }
}

const storageManager = new StorageManager();
// settings.js - Handles application settings

class SettingsManager {
    constructor(storageManager) {
        this.storageManager = storageManager;
        this.settings = storageManager.getSettings();
        this.initEventListeners();
    }

    initEventListeners() {
        // Wait for DOM to be fully loaded
        document.addEventListener('DOMContentLoaded', () => {
            this.loadSettingsToUI();
            
            // Confidence threshold
            const confidenceThreshold = document.getElementById('confidence-threshold');
            const confidenceValue = document.getElementById('confidence-value');
            
            confidenceThreshold.addEventListener('input', () => {
                confidenceValue.textContent = confidenceThreshold.value;
            });
            
            // Save settings button
            document.getElementById('save-settings').addEventListener('click', () => {
                this.saveSettingsFromUI();
            });
            
            // Reset settings button
            document.getElementById('reset-settings').addEventListener('click', () => {
                this.resetSettings();
            });
        });
    }

    loadSettingsToUI() {
        // Detection settings
        document.getElementById('confidence-threshold').value = this.settings.detection.confidenceThreshold;
        document.getElementById('confidence-value').textContent = this.settings.detection.confidenceThreshold;
        document.getElementById('max-detections').value = this.settings.detection.maxDetections;
        
        // Display settings
        document.getElementById('show-bounding-boxes').checked = this.settings.display.showBoundingBoxes;
        document.getElementById('show-labels').checked = this.settings.display.showLabels;
        document.getElementById('box-color').value = this.settings.display.boxColor;
        
        // Search settings
        document.getElementById('search-google').checked = this.settings.search.google;
        document.getElementById('search-bing').checked = this.settings.search.bing;
        document.getElementById('search-yandex').checked = this.settings.search.yandex;
    }

    saveSettingsFromUI() {
        const newSettings = {
            detection: {
                confidenceThreshold: parseFloat(document.getElementById('confidence-threshold').value),
                maxDetections: parseInt(document.getElementById('max-detections').value)
            },
            display: {
                showBoundingBoxes: document.getElementById('show-bounding-boxes').checked,
                showLabels: document.getElementById('show-labels').checked,
                boxColor: document.getElementById('box-color').value
            },
            search: {
                google: document.getElementById('search-google').checked,
                bing: document.getElementById('search-bing').checked,
                yandex: document.getElementById('search-yandex').checked
            }
        };
        
        this.storageManager.saveSettings(newSettings);
        this.settings = newSettings;
        alert('ההגדרות נשמרו בהצלחה!');
    }

    resetSettings() {
        this.settings = this.storageManager.resetSettings();
        this.loadSettingsToUI();
        alert('ההגדרות אופסו להגדרות ברירת המחדל!');
    }

    getDetectionSettings() {
        return this.settings.detection;
    }

    getDisplaySettings() {
        return this.settings.display;
    }

    getSearchSettings() {
        return this.settings.search;
    }
}

const settingsManager = new SettingsManager(storageManager);
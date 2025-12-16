/**
 * Cookie & LocalStorage 同步管理器 (简化版)
 * 基于Pass系统的开放式服务器同步
 */

class SyncManager {
    constructor() {
        this.config = {
            serverUrl: '',
            userPass: '',           // 用户Pass ID
            encryptionKey: '',      // 客户端加密密钥
            enableEncryption: false,
            syncInterval: 5,        // 分钟
            maxVersions: 5,
            minServerVersions: 2    // 最少保留的服务器版本数
        };
        
        this.domainConfigs = new Map(); // 域名级别配置
        this.versionCache = new Map();  // 版本缓存
        this.syncTimer = null;
        this.isInitialized = false;
    }

    /**
     * 初始化同步管理器
     */
    async initialize() {
        try {
            await this.loadConfig();
            await this.loadDomainConfigs();
            await this.loadVersionCache();
            this.startAutoSync();
            this.isInitialized = true;
            console.log('同步管理器初始化完成');
        } catch (error) {
            console.error('同步管理器初始化失败:', error);
            this.isInitialized = false;
            throw error;
        }
    }

    /**
     * 服务器配置管理
     */
    async updateServerConfig(config) {
        this.config = { ...this.config, ...config };
        
        if (typeof chrome !== 'undefined' && chrome.storage) {
            await chrome.storage.local.set({ syncConfig: this.config });
        }
        
        // 如果没有Pass ID，自动创建一个
        if (config.serverUrl && !this.config.userPass) {
            await this.createUserPass();
        }
    }

    async testServerConnection() {
        try {
            const response = await fetch(`${this.config.serverUrl}/health`);
            if (response.ok) {
                const data = await response.json();
                return { success: true, data };
            }
            return { success: false, error: 'Server not responding' };
        } catch (error) {
            console.error('服务器连接测试失败:', error);
            return { success: false, error: error.message };
        }
    }

    async createUserPass() {
        try {
            if (!this.config.serverUrl) {
                throw new Error('服务器地址未配置');
            }
            
            const response = await fetch(`${this.config.serverUrl}/api/pass/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            
            if (response.ok) {
                const data = await response.json();
                this.config.userPass = data.pass;
                
                if (typeof chrome !== 'undefined' && chrome.storage) {
                    await chrome.storage.local.set({ syncConfig: this.config });
                }
                
                return data.pass;
            }
            
            const errorText = await response.text();
            throw new Error(`创建Pass失败: ${response.status} ${errorText}`);
        } catch (error) {
            console.error('创建用户Pass失败:', error);
            throw error;
        }
    }

    /**
     * 验证用户Pass ID是否存在
     * @returns {Promise<boolean>} Pass ID是否存在
     */
    async validateUserPass() {
        if (!this.config.userPass) {
            console.log('没有配置Pass ID');
            return false;
        }
        
        try {
            const response = await fetch(`${this.config.serverUrl}/api/pass/${this.config.userPass}/check`);
            if (response.ok) {
                const data = await response.json();
                console.log(`Pass ID验证结果:`, data.exists);
                return data.exists;
            } else {
                console.warn(`Pass ID验证失败: ${response.status}`);
                return false;
            }
        } catch (error) {
            console.error('验证用户Pass失败:', error);
            return false;
        }
    }

    /**
     * 确保用户Pass ID存在，如果不存在则自动创建
     * @returns {Promise<string>} 有效的Pass ID
     */
    async ensureUserPassExists() {
        // 如果没有Pass ID，直接创建
        if (!this.config.userPass) {
            console.log('没有Pass ID，正在创建新的...');
            return await this.createUserPass();
        }
        
        // 验证现有Pass ID是否存在
        const isValid = await this.validateUserPass();
        if (isValid) {
            console.log('现有Pass ID有效');
            return this.config.userPass;
        }
        
        // Pass ID无效，创建新的
        console.log('现有Pass ID无效，正在创建新的...');
        const newPassId = await this.createUserPass();
        console.log('新Pass ID已创建:', newPassId);
        return newPassId;
    }

    /**
     * 域名同步配置
     */
    async updateDomainConfig(domain, config) {
        this.domainConfigs.set(domain, config);
        
        if (typeof chrome !== 'undefined' && chrome.storage) {
            await chrome.storage.local.set({ 
                domainConfigs: Object.fromEntries(this.domainConfigs) 
            });
        }
    }

    getDomainConfig(domain) {
        return this.domainConfigs.get(domain) || {
            enableCookieSync: false,
            enableStorageSync: false,
            lastSyncTime: null,
            syncSource: 'local'
        };
    }

    /**
     * 版本管理
     */
    async createSnapshot(domain, type, data, source = 'local') {
        const snapshot = {
            id: this.generateUUID(),
            domain,
            type, // 'cookie' | 'localStorage'
            source, // 'local' | 'server'
            timestamp: new Date().toISOString(),
            data: this.config.enableEncryption ? this.encrypt(data) : data,
            encrypted: this.config.enableEncryption,
            hash: await this.calculateHash(data)
        };

        await this.addVersionToCache(domain, type, snapshot);
        return snapshot;
    }

    async addVersionToCache(domain, type, snapshot) {
        const key = `${domain}:${type}`;
        let versions = this.versionCache.get(key) || [];
        
        // 添加新版本
        versions.unshift(snapshot);
        
        // 版本管理：保持最多5个版本，至少2个服务器版本
        versions = this.manageVersions(versions);
        
        this.versionCache.set(key, versions);
        
        if (typeof chrome !== 'undefined' && chrome.storage) {
            await chrome.storage.local.set({ 
                versionCache: Object.fromEntries(this.versionCache) 
            });
        }
    }

    manageVersions(versions) {
        if (versions.length <= this.config.maxVersions) {
            return versions;
        }

        const serverVersions = versions.filter(v => v.source === 'server');
        const localVersions = versions.filter(v => v.source === 'local');

        // 保留最新的2个服务器版本
        const keepServerVersions = serverVersions.slice(0, this.config.minServerVersions);
        
        // 保留最新的3个本地版本
        const keepLocalVersions = localVersions.slice(0, this.config.maxVersions - this.config.minServerVersions);

        return [...keepServerVersions, ...keepLocalVersions]
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, this.config.maxVersions);
    }

    /**
     * 同步逻辑 (简化版)
     */
    async syncDomain(domain) {
        const config = this.getDomainConfig(domain);
        
        if (!config.enableCookieSync && !config.enableStorageSync) {
            return { success: false, reason: 'Sync disabled for domain' };
        }

        if (!this.config.serverUrl || !this.config.userPass) {
            return { success: false, reason: 'Server not configured' };
        }

        try {
            // 1. 获取本地数据
            const localData = await this.getLocalData(domain);
            
            // 2. 获取服务器数据
            const serverData = await this.getServerData(domain);
            
            // 3. 决定同步方向
            const syncResult = await this.decideSyncDirection(localData, serverData, config);
            
            // 4. 执行同步
            if (syncResult.action === 'upload') {
                await this.uploadToServer(domain, localData);
            } else if (syncResult.action === 'download') {
                await this.downloadFromServer(domain, serverData);
            }
            
            // 5. 更新同步状态
            config.lastSyncTime = new Date().toISOString();
            config.syncSource = syncResult.action === 'download' ? 'server' : 'local';
            await this.updateDomainConfig(domain, config);
            
            return { success: true, action: syncResult.action };
            
        } catch (error) {
            console.error(`域名 ${domain} 同步失败:`, error);
            return { success: false, error: error.message };
        }
    }

    async getServerData(domain) {
        try {
            const url = `${this.config.serverUrl}/api/data/${this.config.userPass}?domain=${encodeURIComponent(domain)}`;
            const response = await fetch(url);
            
            if (response.status === 404) {
                return null; // 服务器没有数据
            }
            
            if (!response.ok) {
                throw new Error(`服务器请求失败: ${response.status}`);
            }
            
            const result = await response.json();
            
            // 解密数据
            if (this.config.enableEncryption && this.config.encryptionKey) {
                result.data = this.decrypt(result.data);
            }
            
            return {
                data: typeof result.data === 'string' ? JSON.parse(result.data) : result.data,
                timestamp: result.timestamp
            };
            
        } catch (error) {
            if (error.message.includes('404')) {
                return null;
            }
            throw error;
        }
    }

    async decideSyncDirection(localData, serverData, config) {
        // 如果服务器没有数据，上传本地数据
        if (!serverData) {
            return { action: 'upload', reason: 'No server data' };
        }
        
        // 如果本地没有同步记录，下载服务器数据
        if (!config.lastSyncTime) {
            return { action: 'download', reason: 'First sync' };
        }
        
        // 比较数据哈希，如果相同则无需同步
        const localHash = await this.calculateHash(localData);
        const serverHash = await this.calculateHash(serverData.data);
        
        if (localHash === serverHash) {
            return { action: 'none', reason: 'Data identical' };
        }
        
        // 比较时间戳，新的优先
        const serverTime = new Date(serverData.timestamp);
        const localTime = new Date(config.lastSyncTime);
        
        if (serverTime > localTime) {
            return { action: 'download', reason: 'Server newer' };
        } else {
            return { action: 'upload', reason: 'Local newer' };
        }
    }

    /**
     * 数据获取
     */
    async getLocalData(domain) {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.tabs && chrome.scripting) {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0]) {
                        const currentDomain = new URL(tabs[0].url).hostname;
                        console.log(`当前页面域名: ${currentDomain}, 目标域名: ${domain}`);
                        
                        // 并行获取Cookie和LocalStorage
                        Promise.all([
                            this.getCookiesForDomain(tabs[0], domain),
                            this.getLocalStorageForTab(tabs[0])
                        ]).then(([cookies, localStorage]) => {
                            const data = {
                                cookies: cookies || {},
                                localStorage: localStorage || {},
                                timestamp: new Date().toISOString()
                            };
                            console.log('合并后的数据:', data);
                            resolve(data);
                        }).catch(error => {
                            console.error('获取数据失败:', error);
                            resolve({ cookies: {}, localStorage: {}, timestamp: new Date().toISOString() });
                        });
                    } else {
                        resolve({ cookies: {}, localStorage: {}, timestamp: new Date().toISOString() });
                    }
                });
            } else {
                console.warn('Chrome tabs/scripting API不可用，返回空数据');
                resolve({ cookies: {}, localStorage: {}, timestamp: new Date().toISOString() });
            }
        });
    }

    // 获取Cookie数据（使用Chrome API，与Cookie页面相同的方法）
    async getCookiesForDomain(tab, domain) {
        return new Promise((resolve) => {
            // 使用与Cookie页面相同的逻辑
            const domains = [domain];
            
            // 添加点开头的域名（用于匹配子域名）
            if (!domain.startsWith('.')) {
                domains.push('.' + domain);
            }
            
            // 如果域名包含点，尝试获取根域名的Cookie
            if (domain.includes('.')) {
                const parts = domain.split('.');
                if (parts.length > 2) {
                    const rootDomain = parts.slice(1).join('.');
                    domains.push(rootDomain);
                    domains.push('.' + rootDomain);
                    
                    if (domain.startsWith('www.')) {
                        const nonWwwDomain = domain.substring(4);
                        domains.push(nonWwwDomain);
                        domains.push('.' + nonWwwDomain);
                    }
                }
            }

            // 首先获取当前URL的所有Cookie
            chrome.cookies.getAll({ url: tab.url }, (urlCookies) => {
                if (chrome.runtime.lastError) {
                    console.warn('获取URL Cookie失败:', chrome.runtime.lastError.message);
                    resolve({});
                    return;
                }

                // 获取所有域名的Cookie
                const cookiePromises = domains.map(d => {
                    return new Promise(resolvePromise => {
                        chrome.cookies.getAll({ domain: d }, (cookies) => {
                            if (chrome.runtime.lastError) {
                                console.warn(`获取域名 ${d} 的Cookie失败:`, chrome.runtime.lastError.message);
                                resolvePromise([]);
                            } else {
                                resolvePromise(cookies);
                            }
                        });
                    });
                });

                Promise.all(cookiePromises).then(results => {
                    // 合并所有Cookie并去重
                    const allCookies = [];
                    const cookieMap = new Map();
                    
                    // 首先添加URL匹配的Cookie
                    urlCookies.forEach(cookie => {
                        const key = `${cookie.name}|${cookie.domain}|${cookie.path}`;
                        if (!cookieMap.has(key)) {
                            cookieMap.set(key, cookie);
                            allCookies.push(cookie);
                        }
                    });
                    
                    // 然后添加域名匹配的Cookie
                    results.forEach(cookies => {
                        cookies.forEach(cookie => {
                            const key = `${cookie.name}|${cookie.domain}|${cookie.path}`;
                            if (!cookieMap.has(key)) {
                                cookieMap.set(key, cookie);
                                allCookies.push(cookie);
                            }
                        });
                    });

                    // 转换为简单的键值对格式
                    const cookieData = {};
                    allCookies.forEach(cookie => {
                        cookieData[cookie.name] = cookie.value;
                    });

                    console.log(`获取到 ${allCookies.length} 个Cookie:`, cookieData);
                    resolve(cookieData);
                }).catch(error => {
                    console.error('合并Cookie失败:', error);
                    resolve({});
                });
            });
        });
    }

    // 获取LocalStorage数据（使用注入脚本，与Storage页面相同的方法）
    async getLocalStorageForTab(tab) {
        return new Promise(async (resolve) => {
            // 获取长度设置（与Storage页面保持一致）
            const maxLength = await this.getMaxValueLength();
            
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    // 使用与Storage页面相同的逻辑
                    const storage = {};
                    try {
                        for (let i = 0; i < localStorage.length; i++) {
                            const key = localStorage.key(i);
                            if (key) {
                                storage[key] = localStorage.getItem(key) || '';
                            }
                        }
                    } catch (error) {
                        console.error('获取localStorage失败:', error);
                    }
                    return storage;
                }
            }, (results) => {
                if (chrome.runtime.lastError) {
                    console.error('注入LocalStorage脚本失败:', chrome.runtime.lastError);
                    resolve({});
                    return;
                }
                
                const storageData = results[0]?.result || {};
                
                // 应用长度过滤（与Storage页面保持一致）
                const filteredData = this.filterStorageByLength(storageData, maxLength);
                
                const totalCount = Object.keys(storageData).length;
                const filteredCount = Object.keys(filteredData).length;
                const filteredOutCount = totalCount - filteredCount;
                
                console.log(`获取到 ${totalCount} 个LocalStorage项，过滤后 ${filteredCount} 项${filteredOutCount > 0 ? `（已过滤 ${filteredOutCount} 个超长项）` : ''}`);
                
                resolve(filteredData);
            });
        });
    }

    // 获取最大值长度设置（与Storage页面保持一致）
    async getMaxValueLength() {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                const result = await chrome.storage.local.get(['maxValueLength']);
                return parseInt(result.maxValueLength) || 500;
            }
            return 500; // 默认值
        } catch (error) {
            console.error('获取长度设置失败:', error);
            return 500; // 默认值
        }
    }

    // 根据长度过滤Storage数据（与Storage页面保持一致）
    filterStorageByLength(storageData, maxLength) {
        const filtered = {};
        for (const [key, value] of Object.entries(storageData)) {
            if (value.length <= maxLength) {
                filtered[key] = value;
            }
        }
        return filtered;
    }

    // 在页面上下文中执行的函数
    extractDomainData() {
        const data = {
            cookies: {},
            localStorage: {},
            timestamp: new Date().toISOString()
        };

        try {
            // 提取Cookie
            if (document.cookie) {
                document.cookie.split(';').forEach(cookie => {
                    const trimmed = cookie.trim();
                    if (trimmed) {
                        const equalIndex = trimmed.indexOf('=');
                        if (equalIndex > 0) {
                            const name = trimmed.substring(0, equalIndex);
                            const value = trimmed.substring(equalIndex + 1);
                            data.cookies[name] = value;
                        }
                    }
                });
            }

            // 提取LocalStorage
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key) {
                        const value = localStorage.getItem(key);
                        // 保留所有值，包括空字符串，与extractAllLocalStorage保持一致
                        data.localStorage[key] = value || '';
                    }
                }
            } catch (e) {
                console.warn('无法访问localStorage:', e);
            }
        } catch (error) {
            console.error('提取数据时出错:', error);
        }

        console.log('提取的数据:', data);
        return data;
    }

    /**
     * 服务器通信 (简化版)
     */
    async uploadToServer(domain, data) {
        let dataToUpload = JSON.stringify(data);
        
        // 客户端加密
        if (this.config.enableEncryption && this.config.encryptionKey) {
            dataToUpload = this.encrypt(dataToUpload);
        }

        const url = `${this.config.serverUrl}/api/data/${this.config.userPass}?domain=${encodeURIComponent(domain)}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                data: dataToUpload
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`上传失败: ${error.error || response.status}`);
        }

        return await response.json();
    }

    async downloadFromServer(domain, serverData) {
        // 应用到当前页面
        await this.applyDataToPage(domain, serverData.data);
        return serverData;
    }

    async applyDataToPage(domain, data) {
        if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.scripting) {
            console.warn('Chrome tabs/scripting API不可用，无法应用数据到页面');
            return;
        }

        // 获取当前标签页
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]) return;

        const currentDomain = new URL(tabs[0].url).hostname;
        if (currentDomain !== domain) {
            console.log(`当前域名 ${currentDomain} 与同步域名 ${domain} 不匹配，跳过应用`);
            return;
        }

        // 注入脚本应用数据
        await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: this.applyDataToPageScript,
            args: [data]
        });
    }

    // 在页面上下文中执行的函数
    applyDataToPageScript(data) {
        try {
            // 应用Cookie
            if (data.cookies) {
                Object.entries(data.cookies).forEach(([name, value]) => {
                    document.cookie = `${name}=${value}; path=/`;
                });
            }

            // 应用LocalStorage
            if (data.localStorage) {
                Object.entries(data.localStorage).forEach(([key, value]) => {
                    localStorage.setItem(key, value);
                });
            }

            console.log('数据已应用到页面');
        } catch (error) {
            console.error('应用数据到页面失败:', error);
        }
    }

    /**
     * 快捷功能
     */
    async generateQuickAccessUrl(domain) {
        if (!this.config.serverUrl || !this.config.userPass) {
            throw new Error('服务器未配置');
        }

        const baseUrl = `${this.config.serverUrl}/api/quick/${this.config.userPass}`;
        const params = new URLSearchParams();
        
        params.set('domain', domain);
        
        // 如果有加密密钥，自动包含在URL中以便解密
        if (this.config.encryptionKey) {
            params.set('key', this.config.encryptionKey);
        }
        
        params.set('format', 'html');
        
        return `${baseUrl}?${params.toString()}`;
    }

    async copyQuickAccessUrl(domain) {
        try {
            const url = await this.generateQuickAccessUrl(domain);
            
            // 复制到剪贴板
            await navigator.clipboard.writeText(url);
            
            return { success: true, url };
        } catch (error) {
            console.error('复制快捷访问URL失败:', error);
            return { success: false, error: error.message };
        }
    }

    async getVersionHistory(domain, limit = 5) {
        if (!this.config.serverUrl || !this.config.userPass) {
            return [];
        }

        try {
            const url = `${this.config.serverUrl}/api/data/${this.config.userPass}/versions?domain=${encodeURIComponent(domain)}&limit=${limit}`;
            const response = await fetch(url);
            
            if (response.ok) {
                const result = await response.json();
                return result.versions;
            }
            
            return [];
        } catch (error) {
            console.error('获取版本历史失败:', error);
            return [];
        }
    }

    /**
     * 工具函数
     */

    encrypt(data) {
        // 对称加密实现，支持Unicode字符
        if (!this.config.encryptionKey) return data;
        
        try {
            const jsonStr = JSON.stringify(data);
            
            // 使用简单的XOR对称加密 + Base64编码
            const encrypted = this.xorEncrypt(jsonStr, this.config.encryptionKey);
            
            // 安全的Base64编码，支持Unicode
            return this.safeBase64Encode(encrypted);
        } catch (error) {
            console.error('加密失败:', error);
            return data;
        }
    }

    decrypt(encryptedData) {
        if (!this.config.encryptionKey) return encryptedData;
        
        try {
            // 安全的Base64解码
            const encrypted = this.safeBase64Decode(encryptedData);
            
            // XOR解密
            const jsonStr = this.xorDecrypt(encrypted, this.config.encryptionKey);
            
            return JSON.parse(jsonStr);
        } catch (error) {
            console.error('解密失败:', error);
            return encryptedData;
        }
    }

    // XOR对称加密
    xorEncrypt(text, key) {
        let result = '';
        for (let i = 0; i < text.length; i++) {
            const textChar = text.charCodeAt(i);
            const keyChar = key.charCodeAt(i % key.length);
            result += String.fromCharCode(textChar ^ keyChar);
        }
        return result;
    }

    // XOR对称解密（与加密相同）
    xorDecrypt(encryptedText, key) {
        return this.xorEncrypt(encryptedText, key); // XOR的特性：加密和解密是同一个操作
    }

    // 安全的Base64编码，支持Unicode
    safeBase64Encode(str) {
        try {
            // 先转换为UTF-8字节序列，再进行Base64编码
            return btoa(unescape(encodeURIComponent(str)));
        } catch (error) {
            console.error('Base64编码失败:', error);
            // 降级方案：直接返回原始字符串
            return str;
        }
    }

    // 安全的Base64解码，支持Unicode
    safeBase64Decode(str) {
        try {
            // Base64解码后，再从UTF-8字节序列转换为Unicode字符串
            return decodeURIComponent(escape(atob(str)));
        } catch (error) {
            console.error('Base64解码失败:', error);
            // 降级方案：直接返回原始字符串
            return str;
        }
    }

    async calculateHash(data) {
        const jsonStr = JSON.stringify(data);
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(jsonStr);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * 自动同步
     */
    startAutoSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
        }

        this.syncTimer = setInterval(() => {
            this.performAutoSync();
        }, this.config.syncInterval * 60 * 1000);
    }

    async performAutoSync() {
        if (typeof chrome === 'undefined' || !chrome.tabs) {
            console.warn('Chrome tabs API不可用，跳过自动同步');
            return;
        }

        // 获取当前域名
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
            try {
                const domain = new URL(tabs[0].url).hostname;
                await this.syncDomain(domain);
            } catch (error) {
                console.error('自动同步失败:', error);
            }
        }
    }

    /**
     * 配置加载
     */
    async loadConfig() {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                const result = await chrome.storage.local.get(['syncConfig']);
                if (result.syncConfig) {
                    this.config = { ...this.config, ...result.syncConfig };
                }
            } else {
                console.warn('Chrome storage API不可用，使用默认配置');
            }
        } catch (error) {
            console.error('加载同步配置失败:', error);
        }
    }

    async loadDomainConfigs() {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                const result = await chrome.storage.local.get(['domainConfigs']);
                if (result.domainConfigs) {
                    this.domainConfigs = new Map(Object.entries(result.domainConfigs));
                }
            } else {
                console.warn('Chrome storage API不可用，使用空域名配置');
            }
        } catch (error) {
            console.error('加载域名配置失败:', error);
        }
    }

    async loadVersionCache() {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                const result = await chrome.storage.local.get(['versionCache']);
                if (result.versionCache) {
                    this.versionCache = new Map(Object.entries(result.versionCache));
                } else {
                    this.versionCache = new Map();
                }
            } else {
                console.warn('Chrome storage API不可用，使用空版本缓存');
                this.versionCache = new Map();
            }
        } catch (error) {
            console.error('加载版本缓存失败:', error);
            this.versionCache = new Map();
        }
    }
}

// 将SyncManager类暴露到全局作用域
window.SyncManager = SyncManager;
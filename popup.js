/**
 * Cookie Manager Popup Script
 * 处理popup界面的交互逻辑
 */

/**
 * 格式化相对时间显示
 * 根据时间差智能显示格式：秒/分钟/具体时间
 * @param {string} timestamp - ISO时间戳
 * @returns {string} 格式化后的时间字符串
 */
function formatRelativeTime(timestamp) {
    if (!timestamp) return '从未';
    
    const now = new Date();
    const syncTime = new Date(timestamp);
    const diffMs = now - syncTime;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    
    // 10分钟内显示相对时间
    if (diffSeconds < 60) {
        return `${diffSeconds}秒前`;
    } else if (diffMinutes < 10) {
        return `${diffMinutes}分钟前`;
    }
    // 超过10分钟显示具体时间
    else {
        return syncTime.toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

// 当DOM加载完成时执行
document.addEventListener('DOMContentLoaded', function() {
    initializePopup();
});

/**
 * 初始化popup界面
 */
function initializePopup() {
    console.log('initializePopup 开始执行');
    
    // 初始化标签页切换
    initializeTabs();
    
    // 获取当前标签页信息
    getCurrentTabInfo();
    
    // 绑定事件监听器
    bindEventListeners();
    
    // 启动动态时间更新定时器
    startTimeUpdateTimer();
    
    // 自动加载LocalStorage数据（如果Storage标签页是活动的）
    setTimeout(() => {
        const activeTab = document.querySelector('.tab.active');
        if (activeTab && activeTab.getAttribute('data-tab') === 'storage') {
            getAllStorage();
        }
    }, 500);
    
    // 如果默认是同步标签页，也要加载LocalStorage数据以备后用
    setTimeout(() => {
        const storageTab = document.querySelector('.tab[data-tab="storage"]');
        if (storageTab) {
            // 预加载LocalStorage数据但不显示
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                if (tabs[0]) {
                    const urlInfo = parseTabUrl(tabs[0]);
                    if (urlInfo.isValid && !urlInfo.isSpecialPage) {
                        // 静默获取LocalStorage数据，不显示状态消息
                        chrome.scripting.executeScript({
                            target: { tabId: tabs[0].id },
                            func: extractAllLocalStorage
                        }, function(results) {
                            // 数据已获取，当用户切换到Storage标签时会立即显示
                            if (results && results[0] && results[0].result) {
                                // 缓存数据以供后续使用
                                window.cachedStorageData = results[0].result;
                            }
                        });
                    }
                }
            });
        }
    }, 1000);
    
    // 默认加载所有Cookie
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        console.log('chrome.tabs.query 返回:', tabs);
        
        if (tabs[0]) {
            const urlInfo = parseTabUrl(tabs[0]);
            console.log('URL解析结果:', urlInfo);
            
            if (!urlInfo.isValid) {
                console.log('URL解析失败:', urlInfo.error);
                showStatus(urlInfo.error, 'error');
                return;
            }
            
            if (urlInfo.isSpecialPage) {
                console.log('检测到特殊页面');
                showStatus('无法在特殊页面获取Cookie', 'info');
                return;
            }
            
            console.log('提取的域名:', urlInfo.domain);
            
            // 先检查权限状态
            console.log('准备检查权限状态');
            checkPermissionsAndShowStatus(urlInfo.domain);
            
            // 尝试获取所有Cookie
            console.log('开始尝试获取Cookie，初始化加载');
            tryGetAllCookies(tabs[0], urlInfo.domain, true); // 传入true表示是初始化加载
        } else {
            console.error('没有找到活动标签页');
            showStatus('没有找到活动标签页', 'error');
        }
    });
}

/**
 * 获取当前标签页信息
 */
function getCurrentTabInfo() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs[0]) {
            const urlInfo = parseTabUrl(tabs[0]);
            
            if (!urlInfo.isValid) {
                document.getElementById('currentDomain').textContent = `当前页面: ${urlInfo.error}`;
                return;
            }
            
            if (urlInfo.isSpecialPage) {
                document.getElementById('currentDomain').textContent = `当前页面: 特殊页面`;
                return;
            }
            
            document.getElementById('currentDomain').textContent = `当前域名: ${urlInfo.domain}`;
        } else {
            document.getElementById('currentDomain').textContent = `当前页面: 无活动标签页`;
        }
    });
}

/**
 * 初始化标签页切换功能
 */
function initializeTabs() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            
            // 移除所有活动状态
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // 添加当前活动状态
            this.classList.add('active');
            document.getElementById(targetTab + '-tab').classList.add('active');
            
            // 如果切换到Storage标签页，自动加载数据
            if (targetTab === 'storage') {
                setTimeout(getAllStorage, 100);
            }
            
            // 如果切换到同步标签页，更新状态显示
            if (targetTab === 'sync') {
                setTimeout(() => {
                    updateCurrentDomainDisplay();
                    updateSyncStatusDisplay();
                }, 100);
            }
        });
    });
}

/**
 * 绑定事件监听器
 */
function bindEventListeners() {
    console.log('bindEventListeners 开始执行');
    
    // 获取所有Cookie按钮
    const getAllCookiesBtn = document.getElementById('getAllCookies');
    console.log('获取所有Cookie按钮:', getAllCookiesBtn);
    if (getAllCookiesBtn) {
        getAllCookiesBtn.addEventListener('click', getAllCookies);
    }
    
    // 获取指定Cookie按钮
    const getSpecificCookieBtn = document.getElementById('getSpecificCookie');
    console.log('获取指定Cookie按钮:', getSpecificCookieBtn);
    if (getSpecificCookieBtn) {
        getSpecificCookieBtn.addEventListener('click', toggleSpecificCookieInput);
    }
    
    // 读取指定Cookie按钮
    const readSpecificCookieBtn = document.getElementById('readSpecificCookie');
    console.log('读取指定Cookie按钮:', readSpecificCookieBtn);
    if (readSpecificCookieBtn) {
        readSpecificCookieBtn.addEventListener('click', getSpecificCookie);
    }
    
    // 申请权限按钮
    const requestPermissionBtn = document.getElementById('requestPermissionBtn');
    console.log('申请权限按钮:', requestPermissionBtn);
    if (requestPermissionBtn) {
        requestPermissionBtn.addEventListener('click', requestPermissionAndLoadCookies);
    }
    
    // 申请权限按钮组
    const requestPermissionGroup = document.getElementById('requestPermissionGroup');
    console.log('申请权限按钮组:', requestPermissionGroup);
    console.log('申请权限按钮组是否隐藏:', requestPermissionGroup ? requestPermissionGroup.classList.contains('hidden') : '元素不存在');
    
    // 复制Cookie按钮
    const copyCookiesBtn = document.getElementById('copyCookies');
    console.log('复制Cookie按钮:', copyCookiesBtn);
    if (copyCookiesBtn) {
        copyCookiesBtn.addEventListener('click', copyCookiesToClipboard);
    }
    
    // 清空显示按钮
    const clearDisplayBtn = document.getElementById('clearDisplay');
    console.log('清空显示按钮:', clearDisplayBtn);
    if (clearDisplayBtn) {
        clearDisplayBtn.addEventListener('click', clearCookieDisplay);
    }
    
    // 设置Cookie按钮
    const setCookieBtn = document.getElementById('setCookie');
    console.log('设置Cookie按钮:', setCookieBtn);
    if (setCookieBtn) {
        setCookieBtn.addEventListener('click', setNewCookie);
    }
    
    // 清除所有权限按钮
    const clearAllPermissionsBtn = document.getElementById('clearAllPermissions');
    if (clearAllPermissionsBtn) {
        clearAllPermissionsBtn.addEventListener('click', clearAllPermissions);
    }
    
    // 刷新扩展按钮
    const refreshExtensionBtn = document.getElementById('refreshExtension');
    if (refreshExtensionBtn) {
        refreshExtensionBtn.addEventListener('click', refreshExtension);
    }
    
    // LocalStorage相关按钮
    const getAllStorageBtn = document.getElementById('getAllStorage');
    if (getAllStorageBtn) {
        getAllStorageBtn.addEventListener('click', getAllStorage);
    }
    
    const getSpecificStorageBtn = document.getElementById('getSpecificStorage');
    if (getSpecificStorageBtn) {
        getSpecificStorageBtn.addEventListener('click', toggleSpecificStorageInput);
    }
    
    const readSpecificStorageBtn = document.getElementById('readSpecificStorage');
    if (readSpecificStorageBtn) {
        readSpecificStorageBtn.addEventListener('click', getSpecificStorage);
    }
    
    const copyStorageBtn = document.getElementById('copyStorage');
    if (copyStorageBtn) {
        copyStorageBtn.addEventListener('click', copyStorageToClipboard);
    }
    
    const clearStorageDisplayBtn = document.getElementById('clearStorageDisplay');
    if (clearStorageDisplayBtn) {
        clearStorageDisplayBtn.addEventListener('click', clearStorageDisplay);
    }
    
    // 加载保存的过滤设置
    loadStorageSettings();
    
    // 同步相关按钮
    const testServerBtn = document.getElementById('testServer');
    if (testServerBtn) {
        testServerBtn.addEventListener('click', testServerConnection);
    }
    
    const saveServerConfigBtn = document.getElementById('saveServerConfig');
    if (saveServerConfigBtn) {
        saveServerConfigBtn.addEventListener('click', saveServerConfig);
    }
    
    const saveDomainConfigBtn = document.getElementById('saveDomainConfig');
    if (saveDomainConfigBtn) {
        saveDomainConfigBtn.addEventListener('click', saveDomainConfig);
    }
    
    const syncNowBtn = document.getElementById('syncNow');
    if (syncNowBtn) {
        syncNowBtn.addEventListener('click', syncNow);
    }
    
    const uploadToServerBtn = document.getElementById('uploadToServer');
    if (uploadToServerBtn) {
        uploadToServerBtn.addEventListener('click', uploadToServer);
    }
    
    const downloadFromServerBtn = document.getElementById('downloadFromServer');
    if (downloadFromServerBtn) {
        downloadFromServerBtn.addEventListener('click', downloadFromServer);
    }
    
    const refreshVersionsBtn = document.getElementById('refreshVersions');
    if (refreshVersionsBtn) {
        refreshVersionsBtn.addEventListener('click', refreshVersionHistory);
    }
    
    // 新增的同步功能按钮
    const copyUserPassBtn = document.getElementById('copyUserPass');
    if (copyUserPassBtn) {
        copyUserPassBtn.addEventListener('click', copyUserPassToClipboard);
    }
    
    const generateQuickUrlBtn = document.getElementById('generateQuickUrl');
    if (generateQuickUrlBtn) {
        generateQuickUrlBtn.addEventListener('click', generateQuickAccessUrl);
    }
    
    const copyQuickUrlBtn = document.getElementById('copyQuickUrl');
    if (copyQuickUrlBtn) {
        copyQuickUrlBtn.addEventListener('click', copyQuickUrlToClipboard);
    }
    
    const openQuickUrlBtn = document.getElementById('openQuickUrl');
    if (openQuickUrlBtn) {
        openQuickUrlBtn.addEventListener('click', openQuickAccessUrl);
    }
    
    // 生成随机密钥按钮
    const generateRandomKeyBtn = document.getElementById('generateRandomKey');
    if (generateRandomKeyBtn) {
        generateRandomKeyBtn.addEventListener('click', generateRandomEncryptionKey);
    }
    
    // 页面设置自动保存
    const enableCookieSyncCheckbox = document.getElementById('enableCookieSync');
    if (enableCookieSyncCheckbox) {
        enableCookieSyncCheckbox.addEventListener('change', saveDomainConfig);
    }
    
    const enableStorageSyncCheckbox = document.getElementById('enableStorageSync');
    if (enableStorageSyncCheckbox) {
        enableStorageSyncCheckbox.addEventListener('change', saveDomainConfig);
    }
    
    const syncIntervalSelect = document.getElementById('syncInterval');
    if (syncIntervalSelect) {
        syncIntervalSelect.addEventListener('change', saveDomainConfig);
    }
    
    // 监听加密密钥变化，控制随机按钮状态
    const encryptionKeyInput = document.getElementById('encryptionKey');
    if (encryptionKeyInput) {
        encryptionKeyInput.addEventListener('input', updateRandomKeyButtonState);
    }
    
    // 加载同步配置
    loadSyncConfig();
    
    // 启动定时器，每秒更新最后同步时间显示
    startTimeUpdateTimer();
    
    console.log('bindEventListeners 执行完成');
}

/**
 * 获取当前页面的所有Cookie
 */
function getAllCookies() {
    showStatus('正在获取Cookie...', 'info');
    
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs[0]) {
            const urlInfo = parseTabUrl(tabs[0]);
            if (!urlInfo.isValid) {
                showStatus(urlInfo.error, 'error');
                return;
            }
            
            if (urlInfo.isSpecialPage) {
                showStatus('无法在特殊页面获取Cookie', 'info');
                return;
            }
            
            // 先检查权限状态
            checkPermissionsAndShowStatus(urlInfo.domain);
            
            // 直接尝试获取Cookie，如果没有权限Chrome会返回错误
            tryGetAllCookies(tabs[0], urlInfo.domain, false);
        } else {
            showStatus('没有找到活动标签页', 'error');
        }
    });
}

/**
 * 尝试获取所有Cookie，处理权限问题
 * @param {object} tab - 当前标签页对象
 * @param {string} domain - 当前域名
 * @param {boolean} isInitialLoad - 是否是初始化加载
 */
function tryGetAllCookies(tab, domain, isInitialLoad = false) {
    console.log('tryGetAllCookies 被调用', { tab, domain, isInitialLoad });
    
    // 无论是否是初始化加载，都先显示申请权限按钮（如果需要）
    const permissionGroup = document.getElementById('requestPermissionGroup');
    console.log('申请权限按钮组元素:', permissionGroup);
    
    // 使用更全面的方法获取Cookie
    // 1. 首先获取当前URL的所有Cookie
    chrome.cookies.getAll({ url: tab.url }, function(urlCookies) {
        if (chrome.runtime.lastError) {
            // 检查是否是权限错误
            const errorMessage = chrome.runtime.lastError.message;
            console.log('chrome.cookies.getAll 返回错误:', errorMessage);
            
            if (errorMessage.includes('No host permissions') || 
                errorMessage.includes('permission') || 
                errorMessage.includes('not allowed') ||
                errorMessage.includes('access')) {
                console.log('检测到权限错误, isInitialLoad:', isInitialLoad);
                
                // 无论是否是初始化加载，都显示申请权限按钮
                console.log('显示申请权限按钮');
                showStatus('需要权限才能访问Cookie', 'info');
                
                if (permissionGroup) {
                    permissionGroup.classList.remove('hidden');
                    console.log('已显示申请权限按钮组');
                } else {
                    console.error('找不到申请权限按钮组元素');
                }
                
                // 如果是用户主动点击，也尝试申请权限
                if (!isInitialLoad) {
                    console.log('用户主动点击，尝试申请权限');
                    requestPermissionAndRetry(domain, () => tryGetAllCookies(tab, domain, false));
                }
                return;
            }
            showStatus('获取Cookie失败: ' + errorMessage, 'error');
            return;
        }
        
        // 2. 获取所有可能的域名变体（包括子域名）
        const domains = [domain];
        
        // 添加点开头的域名（用于匹配子域名）
        if (!domain.startsWith('.')) {
            domains.push('.' + domain);
        }
        
        // 如果域名包含点，尝试获取根域名的Cookie
        if (domain.includes('.')) {
            const parts = domain.split('.');
            if (parts.length > 2) {
                // 获取根域名（例如，从 www.xiaohongshu.com 获取 xiaohongshu.com）
                const rootDomain = parts.slice(1).join('.');
                domains.push(rootDomain);
                domains.push('.' + rootDomain);
                
                // 如果当前域名是www开头，也添加不带www的域名
                if (domain.startsWith('www.')) {
                    const nonWwwDomain = domain.substring(4);
                    domains.push(nonWwwDomain);
                    domains.push('.' + nonWwwDomain);
                }
            }
        }
        
        // 3. 使用Promise.all获取所有域名的Cookie
        const cookiePromises = domains.map(d => {
            return new Promise(resolve => {
                chrome.cookies.getAll({ domain: d }, function(cookies) {
                    if (chrome.runtime.lastError) {
                        // 如果是权限错误，返回空数组而不是抛出错误
                        console.warn(`获取域名 ${d} 的Cookie失败:`, chrome.runtime.lastError.message);
                        resolve([]);
                    } else {
                        resolve(cookies);
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
            
            if (allCookies.length === 0) {
                showStatus('当前域名没有找到Cookie', 'info');
                return;
            }
            
            // 格式化Cookie显示
            const cookieString = formatCookiesForDisplay(allCookies);
            displayCookies(cookieString);
            showStatus(`成功获取 ${allCookies.length} 个Cookie`, 'success');
            
            // Cookie获取成功，隐藏申请权限按钮
            const permissionGroup = document.getElementById('requestPermissionGroup');
            if (permissionGroup) {
                permissionGroup.classList.add('hidden');
                console.log('Cookie获取成功，隐藏申请权限按钮组');
            }
        }).catch(error => {
            showStatus('获取Cookie失败: ' + error.message, 'error');
        });
    });
}

/**
 * 切换指定Cookie输入框的显示
 */
function toggleSpecificCookieInput() {
    const inputGroup = document.getElementById('specificCookieInput');
    inputGroup.classList.toggle('hidden');
    
    if (!inputGroup.classList.contains('hidden')) {
        document.getElementById('cookieName').focus();
    }
}

/**
 * 获取指定的Cookie
 */
function getSpecificCookie() {
    const cookieName = document.getElementById('cookieName').value.trim();
    
    if (!cookieName) {
        showStatus('请输入Cookie名称', 'error');
        return;
    }
    
    showStatus('正在获取指定Cookie...', 'info');
    
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs[0]) {
            const urlInfo = parseTabUrl(tabs[0]);
            if (!urlInfo.isValid) {
                showStatus(urlInfo.error, 'error');
                return;
            }
            
            if (urlInfo.isSpecialPage) {
                showStatus('无法在特殊页面获取Cookie', 'info');
                return;
            }
            
            // 直接尝试获取Cookie，如果没有权限Chrome会返回错误
            tryGetSpecificCookie(tabs[0], urlInfo.domain, cookieName);
        } else {
            showStatus('没有找到活动标签页', 'error');
        }
    });
}

/**
 * 尝试获取指定Cookie，处理权限问题
 * @param {object} tab - 当前标签页对象
 * @param {string} domain - 当前域名
 * @param {string} cookieName - 要获取的Cookie名称
 */
function tryGetSpecificCookie(tab, domain, cookieName) {
    // 使用更全面的方法获取Cookie
    // 1. 首先获取当前URL的所有Cookie
    chrome.cookies.getAll({ url: tab.url }, function(urlCookies) {
        if (chrome.runtime.lastError) {
            // 检查是否是权限错误
            const errorMessage = chrome.runtime.lastError.message;
            if (errorMessage.includes('No host permissions') || 
                errorMessage.includes('permission') || 
                errorMessage.includes('not allowed') ||
                errorMessage.includes('access')) {
                requestPermissionAndRetry(domain, () => tryGetSpecificCookie(tab, domain, cookieName));
                return;
            }
            showStatus('获取Cookie失败: ' + errorMessage, 'error');
            return;
        }
        
        // 2. 获取所有可能的域名变体（包括子域名）
        const domains = [domain];
        
        // 添加点开头的域名（用于匹配子域名）
        if (!domain.startsWith('.')) {
            domains.push('.' + domain);
        }
        
        // 如果域名包含点，尝试获取根域名的Cookie
        if (domain.includes('.')) {
            const parts = domain.split('.');
            if (parts.length > 2) {
                // 获取根域名（例如，从 www.xiaohongshu.com 获取 xiaohongshu.com）
                const rootDomain = parts.slice(1).join('.');
                domains.push(rootDomain);
                domains.push('.' + rootDomain);
                
                // 如果当前域名是www开头，也添加不带www的域名
                if (domain.startsWith('www.')) {
                    const nonWwwDomain = domain.substring(4);
                    domains.push(nonWwwDomain);
                    domains.push('.' + nonWwwDomain);
                }
            }
        }
        
        // 3. 使用Promise.all获取所有域名的指定Cookie
        const cookiePromises = domains.map(d => {
            return new Promise(resolve => {
                chrome.cookies.getAll({ domain: d, name: cookieName }, function(cookies) {
                    if (chrome.runtime.lastError) {
                        // 如果是权限错误，返回空数组而不是抛出错误
                        console.warn(`获取域名 ${d} 的Cookie失败:`, chrome.runtime.lastError.message);
                        resolve([]);
                    } else {
                        resolve(cookies);
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
                if (cookie.name === cookieName) {
                    const key = `${cookie.name}|${cookie.domain}|${cookie.path}`;
                    if (!cookieMap.has(key)) {
                        cookieMap.set(key, cookie);
                        allCookies.push(cookie);
                    }
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
            
            if (allCookies.length === 0) {
                showStatus(`没有找到名为 "${cookieName}" 的Cookie`, 'info');
                return;
            }
            
            // 格式化Cookie显示
            const cookieString = formatCookiesForDisplay(allCookies);
            displayCookies(cookieString);
            showStatus(`成功获取Cookie "${cookieName}"`, 'success');
            
            // Cookie获取成功，隐藏申请权限按钮
            const permissionGroup = document.getElementById('requestPermissionGroup');
            if (permissionGroup) {
                permissionGroup.classList.add('hidden');
                console.log('指定Cookie获取成功，隐藏申请权限按钮组');
            }
        }).catch(error => {
            showStatus('获取Cookie失败: ' + error.message, 'error');
        });
    });
}

/**
 * 格式化Cookie用于显示
 * @param {Array} cookies - Cookie数组
 * @returns {string} 格式化后的Cookie字符串
 */
function formatCookiesForDisplay(cookies) {
    return cookies.map(cookie => {
        return `${cookie.name}=${cookie.value};`;
    }).join(' ');
}

/**
 * 显示Cookie
 * @param {string} cookieString - Cookie字符串
 */
function displayCookies(cookieString) {
    const display = document.getElementById('cookieDisplay');
    const actions = document.getElementById('cookieActions');
    
    display.textContent = cookieString;
    display.classList.remove('hidden');
    actions.classList.remove('hidden');
    
    // 保存Cookie字符串到data属性，便于复制
    display.setAttribute('data-cookie-string', cookieString);
}

/**
 * 复制Cookie到剪贴板
 */
function copyCookiesToClipboard() {
    const display = document.getElementById('cookieDisplay');
    const cookieString = display.getAttribute('data-cookie-string');
    
    if (!cookieString) {
        showStatus('没有可复制的Cookie', 'error');
        return;
    }
    
    // 创建临时文本区域来复制
    const textarea = document.createElement('textarea');
    textarea.value = cookieString;
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
        document.execCommand('copy');
        showStatus('Cookie已复制到剪贴板', 'success');
    } catch (err) {
        showStatus('复制失败: ' + err.message, 'error');
    }
    
    document.body.removeChild(textarea);
}

/**
 * 清空Cookie显示
 */
function clearCookieDisplay() {
    const display = document.getElementById('cookieDisplay');
    const actions = document.getElementById('cookieActions');
    
    display.textContent = '';
    display.classList.add('hidden');
    actions.classList.add('hidden');
    display.removeAttribute('data-cookie-string');
}

/**
 * 设置新的Cookie
 */
function setNewCookie() {
    const name = document.getElementById('newCookieName').value.trim();
    const value = document.getElementById('newCookieValue').value.trim();
    
    if (!name || !value) {
        showStatus('请填写Cookie名称和值', 'error');
        return;
    }
    
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs[0]) {
            const urlInfo = parseTabUrl(tabs[0]);
            if (!urlInfo.isValid) {
                showStatus(urlInfo.error, 'error');
                return;
            }
            
            if (urlInfo.isSpecialPage) {
                showStatus('无法在特殊页面设置Cookie', 'info');
                return;
            }
            
            const domain = document.getElementById('newCookieDomain').value.trim() || urlInfo.domain;
            const path = document.getElementById('newCookiePath').value.trim() || '/';
            const expirationInput = document.getElementById('newCookieExpiration').value.trim();
            
            // 检查是否有权限访问该域名的Cookie
            checkAndRequestPermission(domain)
                .then(hasPermission => {
                    if (!hasPermission) {
                        showStatus('没有权限访问该域名的Cookie', 'error');
                        return;
                    }
                    
                    // 处理过期时间
                    let expirationDate = null;
                    if (expirationInput) {
                        expirationDate = new Date(expirationInput).getTime() / 1000;
                        if (isNaN(expirationDate)) {
                            showStatus('过期时间格式不正确', 'error');
                            return;
                        }
                    }
                    
                    // 构建Cookie对象
                    const cookieDetails = {
                        url: tabs[0].url,
                        name: name,
                        value: value,
                        domain: domain,
                        path: path,
                        secure: urlInfo.url.protocol === 'https:',
                        httpOnly: false
                    };
                    
                    if (expirationDate) {
                        cookieDetails.expirationDate = expirationDate;
                    }
                    
                    // 设置Cookie
                    chrome.cookies.set(cookieDetails, function(cookie) {
                        if (chrome.runtime.lastError) {
                            showStatus('设置Cookie失败: ' + chrome.runtime.lastError.message, 'error');
                            return;
                        }
                        
                        showStatus(`Cookie "${name}" 设置成功`, 'success');
                        
                        // 清空输入框
                        document.getElementById('newCookieName').value = '';
                        document.getElementById('newCookieValue').value = '';
                        document.getElementById('newCookieDomain').value = '';
                        document.getElementById('newCookiePath').value = '';
                        document.getElementById('newCookieExpiration').value = '';
                    });
                })
                .catch(error => {
                    showStatus('权限检查失败: ' + error.message, 'error');
                });
        } else {
            showStatus('没有找到活动标签页', 'error');
        }
    });
}

/**
 * 检查并申请权限
 * @param {string} domain - 要检查的域名
 * @returns {Promise<boolean>} 是否有权限
 */
function checkAndRequestPermission(domain) {
    return new Promise((resolve, reject) => {
        // 构建域名模式
        const originPattern = `*://${domain}/*`;
        
        // 显示权限检查状态
        showStatus('正在检查权限...', 'info');
        
        // 检查权限
        chrome.runtime.sendMessage({
            action: 'checkPermissions',
            permissions: ['cookies'],
            origins: [originPattern]
        }, function(response) {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            
            if (response.allGranted) {
                showStatus('权限检查通过', 'success');
                resolve(true);
                return;
            }
            
            // 显示权限申请状态
            showStatus('正在申请访问权限，请在弹出窗口中授权...', 'info');
            
            // 申请权限
            chrome.runtime.sendMessage({
                action: 'requestPermission',
                permissions: ['cookies'],
                origins: [originPattern]
            }, function(response) {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                
                if (response.success) {
                    showStatus('权限申请成功', 'success');
                } else {
                    showStatus('权限申请被拒绝，无法访问Cookie', 'error');
                }
                
                resolve(response.success);
            });
        });
    });
}

/**
 * 申请权限并加载Cookie
 */
function requestPermissionAndLoadCookies() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs[0]) {
            const urlInfo = parseTabUrl(tabs[0]);
            if (!urlInfo.isValid) {
                showStatus(urlInfo.error, 'error');
                return;
            }
            
            if (urlInfo.isSpecialPage) {
                showStatus('无法在特殊页面获取Cookie', 'info');
                return;
            }
            
            // 隐藏申请权限按钮
            document.getElementById('requestPermissionGroup').classList.add('hidden');
            
            // 申请权限并重试获取Cookie
            requestPermissionAndRetry(urlInfo.domain, () => {
                // 权限申请成功后，再次检查权限状态
                checkPermissionsAndShowStatus(urlInfo.domain);
                // 然后获取Cookie
                tryGetAllCookies(tabs[0], urlInfo.domain, false);
            });
        } else {
            showStatus('没有找到活动标签页', 'error');
        }
    });
}

/**
 * 检查权限状态并显示相关信息
 * @param {string} domain - 要检查权限的域名
 */
function checkPermissionsAndShowStatus(domain) {
    console.log('检查权限状态，域名:', domain);
    
    // 构建域名模式，包括当前域名和根域名
    const origins = [`*://${domain}/*`];
    
    // 如果域名包含点，尝试添加根域名的权限
    if (domain.includes('.')) {
        const parts = domain.split('.');
        if (parts.length > 2) {
            // 获取根域名（例如，从 www.xiaohongshu.com 获取 xiaohongshu.com）
            const rootDomain = parts.slice(1).join('.');
            origins.push(`*://${rootDomain}/*`);
            origins.push(`*://*.${rootDomain}/*`);
        }
    }
    
    console.log('检查权限的域名列表:', origins);
    
    // 先检查申请权限按钮是否存在
    const permissionGroup = document.getElementById('requestPermissionGroup');
    console.log('申请权限按钮组元素:', permissionGroup);
    if (permissionGroup) {
        console.log('申请权限按钮组当前是否隐藏:', permissionGroup.classList.contains('hidden'));
    }
    
    // 直接在popup中检查权限
    chrome.permissions.contains({
        permissions: ['cookies'],
        origins: origins
    }, function(hasPermissions) {
        if (chrome.runtime.lastError) {
            console.error('检查权限时出错:', chrome.runtime.lastError.message);
            showStatus('检查权限状态失败', 'error');
            return;
        }
        
        console.log('权限检查结果:', hasPermissions);
        
        if (hasPermissions) {
            showStatus('已有访问权限', 'success');
            
            // 隐藏申请权限按钮
            if (permissionGroup) {
                permissionGroup.classList.add('hidden');
                console.log('已有权限，隐藏申请权限按钮组');
            }
        } else {
            showStatus('需要申请权限才能访问Cookie', 'info');
            
            // 显示申请权限按钮
            if (permissionGroup) {
                permissionGroup.classList.remove('hidden');
                console.log('已显示申请权限按钮组');
                console.log('申请权限按钮组现在是否隐藏:', permissionGroup.classList.contains('hidden'));
            } else {
                console.error('找不到申请权限按钮组元素');
            }
        }
    });
}

/**
 * 申请权限并重试操作
 * @param {string} domain - 要申请权限的域名
 * @param {function} retryCallback - 权限申请成功后要重试的回调函数
 */
function requestPermissionAndRetry(domain, retryCallback) {
    // 构建域名模式，包括当前域名和根域名
    const origins = [`*://${domain}/*`];
    
    // 如果域名包含点，尝试添加根域名的权限
    if (domain.includes('.')) {
        const parts = domain.split('.');
        if (parts.length > 2) {
            // 获取根域名（例如，从 www.xiaohongshu.com 获取 xiaohongshu.com）
            const rootDomain = parts.slice(1).join('.');
            origins.push(`*://${rootDomain}/*`);
            origins.push(`*://*.${rootDomain}/*`);
        }
    }
    
    console.log('申请权限的域名列表:', origins);
    
    // 显示权限申请状态
    showStatus('正在申请访问权限，请在弹出窗口中授权...', 'info');
    
    // 直接在popup中申请权限，确保是用户手势的直接响应
    chrome.permissions.request({
        permissions: ['cookies'],
        origins: origins
    }, function(granted) {
        if (chrome.runtime.lastError) {
            showStatus('权限申请失败: ' + chrome.runtime.lastError.message, 'error');
            console.error('权限申请失败:', chrome.runtime.lastError);
            
            // 权限申请失败，显示申请权限按钮
            const permissionGroup = document.getElementById('requestPermissionGroup');
            if (permissionGroup) {
                permissionGroup.classList.remove('hidden');
                console.log('权限申请失败，已显示申请权限按钮组');
            }
            return;
        }
        
        if (granted) {
            showStatus('权限申请成功，正在重试...', 'success');
            
            // 权限申请成功，隐藏申请权限按钮
            const permissionGroup = document.getElementById('requestPermissionGroup');
            if (permissionGroup) {
                permissionGroup.classList.add('hidden');
                console.log('权限申请成功，隐藏申请权限按钮组');
            }
            
            // 权限申请成功，执行重试回调
            setTimeout(retryCallback, 500); // 延迟500ms确保权限生效
        } else {
            showStatus('权限申请被拒绝，无法访问Cookie', 'error');
            
            // 权限申请被拒绝，显示申请权限按钮
            const permissionGroup = document.getElementById('requestPermissionGroup');
            if (permissionGroup) {
                permissionGroup.classList.remove('hidden');
                console.log('权限申请被拒绝，已显示申请权限按钮组');
            }
        }
    });
}

/**
 * 显示状态消息
 * @param {string} message - 消息内容
 * @param {string} type - 消息类型 (success, error, info)
 */
function showStatus(message, type) {
    const statusElement = document.getElementById('statusMessage');
    
    // 设置消息内容和样式
    statusElement.textContent = message;
    statusElement.className = 'status-message ' + type;
    statusElement.classList.remove('hidden');
    
    // 3秒后自动隐藏消息
    setTimeout(() => {
        statusElement.classList.add('hidden');
    }, 3000);
}

// 监听指定Cookie输入框的回车键
document.getElementById('cookieName').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        getSpecificCookie();
    }
});

/**
 * 清除所有权限
 */
function clearAllPermissions() {
    showStatus('正在清除所有权限...', 'info');
    
    // 获取所有已授权的权限
    chrome.permissions.getAll(function(permissions) {
        if (chrome.runtime.lastError) {
            showStatus('获取权限列表失败: ' + chrome.runtime.lastError.message, 'error');
            return;
        }
        
        // 过滤出可选的主机权限（不包括必需的权限）
        const optionalOrigins = permissions.origins.filter(origin => 
            origin !== '<all_urls>' && !origin.includes('chrome-extension://')
        );
        
        if (optionalOrigins.length === 0) {
            showStatus('没有可清除的权限', 'info');
            return;
        }
        
        // 移除可选权限
        chrome.permissions.remove({
            origins: optionalOrigins
        }, function(removed) {
            if (chrome.runtime.lastError) {
                showStatus('清除权限失败: ' + chrome.runtime.lastError.message, 'error');
                return;
            }
            
            if (removed) {
                showStatus(`已清除 ${optionalOrigins.length} 个网站的权限`, 'success');
                
                // 清除Cookie显示
                clearCookieDisplay();
                
                // 显示申请权限按钮
                const permissionGroup = document.getElementById('requestPermissionGroup');
                if (permissionGroup) {
                    permissionGroup.classList.remove('hidden');
                }
            } else {
                showStatus('权限清除失败', 'error');
            }
        });
    });
}

/**
 * 刷新扩展
 */
function refreshExtension() {
    showStatus('正在刷新扩展...', 'info');
    
    // 清除所有显示内容
    clearCookieDisplay();
    
    // 重新获取当前标签页信息
    getCurrentTabInfo();
    
    // 重新检查权限状态
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs[0]) {
            const urlInfo = parseTabUrl(tabs[0]);
            
            if (!urlInfo.isValid) {
                showStatus('扩展已刷新', 'success');
                return;
            }
            
            if (urlInfo.isSpecialPage) {
                showStatus('当前页面已刷新', 'success');
                return;
            }
            
            checkPermissionsAndShowStatus(urlInfo.domain);
            showStatus('扩展已刷新', 'success');
        } else {
            showStatus('扩展已刷新', 'success');
        }
    });
}

// ==================== 工具函数 ====================

/**
 * 解析标签页URL
 * @param {object} tab - 标签页对象
 * @returns {object} 解析结果
 */
function parseTabUrl(tab) {
    const result = {
        isValid: false,
        isSpecialPage: false,
        domain: null,
        url: null,
        error: null
    };
    
    try {
        // 检查tab和url是否存在
        if (!tab || !tab.url) {
            result.error = '无法获取当前页面信息';
            return result;
        }
        
        const urlString = tab.url;
        console.log('正在解析URL:', urlString);
        
        // 检查URL格式
        if (!urlString.startsWith('http://') && !urlString.startsWith('https://') && 
            !urlString.startsWith('chrome://') && !urlString.startsWith('chrome-extension://') &&
            !urlString.startsWith('moz-extension://') && !urlString.startsWith('file://')) {
            result.error = '不支持的URL格式: ' + urlString;
            return result;
        }
        
        const url = new URL(urlString);
        result.url = url;
        
        // 检查是否是特殊页面
        const specialProtocols = ['chrome:', 'chrome-extension:', 'moz-extension:', 'file:'];
        if (specialProtocols.includes(url.protocol)) {
            result.isSpecialPage = true;
            result.isValid = true;
            return result;
        }
        
        // 检查是否是有效的网页
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            result.error = '只支持HTTP/HTTPS协议的网页';
            return result;
        }
        
        // 检查域名
        if (!url.hostname) {
            result.error = '无法获取域名信息';
            return result;
        }
        
        result.domain = url.hostname;
        result.isValid = true;
        
        console.log('URL解析成功:', result);
        return result;
        
    } catch (error) {
        console.error('URL解析异常:', error);
        result.error = `URL解析失败: ${error.message}`;
        return result;
    }
}

// ==================== LocalStorage 功能 ====================

/**
 * 获取所有LocalStorage数据
 */
function getAllStorage() {
    // 如果有缓存数据，直接使用
    if (window.cachedStorageData) {
        const storageData = window.cachedStorageData;
        const maxLength = getMaxValueLength();
        const filteredData = filterStorageByLength(storageData, maxLength);
        
        if (Object.keys(filteredData).length === 0) {
            showStatus('当前页面没有LocalStorage数据或所有数据都被过滤', 'info');
            return;
        }
        
        const storageString = formatStorageForDisplay(filteredData);
        displayStorage(storageString);
        
        const totalCount = Object.keys(storageData).length;
        const filteredCount = Object.keys(filteredData).length;
        const filteredOutCount = totalCount - filteredCount;
        
        let statusMsg = `成功获取 ${filteredCount} 个LocalStorage项`;
        if (filteredOutCount > 0) {
            statusMsg += ` (已过滤 ${filteredOutCount} 个超长项)`;
        }
        showStatus(statusMsg, 'success');
        return;
    }
    
    showStatus('正在获取LocalStorage...', 'info');
    
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs[0]) {
            const urlInfo = parseTabUrl(tabs[0]);
            if (!urlInfo.isValid) {
                showStatus(urlInfo.error, 'error');
                return;
            }
            
            if (urlInfo.isSpecialPage) {
                showStatus('无法在特殊页面获取LocalStorage', 'info');
                return;
            }
            
            // 注入内容脚本获取localStorage
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: extractAllLocalStorage
            }, function(results) {
                    if (chrome.runtime.lastError) {
                        showStatus('获取LocalStorage失败: ' + chrome.runtime.lastError.message, 'error');
                        return;
                    }
                    
                    if (results && results[0] && results[0].result) {
                        const storageData = results[0].result;
                        // 缓存数据
                        window.cachedStorageData = storageData;
                        
                        const maxLength = getMaxValueLength();
                        const filteredData = filterStorageByLength(storageData, maxLength);
                        
                        if (Object.keys(filteredData).length === 0) {
                            showStatus('当前页面没有LocalStorage数据或所有数据都被过滤', 'info');
                            return;
                        }
                        
                        const storageString = formatStorageForDisplay(filteredData);
                        displayStorage(storageString);
                        
                        const totalCount = Object.keys(storageData).length;
                        const filteredCount = Object.keys(filteredData).length;
                        const filteredOutCount = totalCount - filteredCount;
                        
                        let statusMsg = `成功获取 ${filteredCount} 个LocalStorage项`;
                        if (filteredOutCount > 0) {
                            statusMsg += ` (已过滤 ${filteredOutCount} 个超长项)`;
                        }
                        showStatus(statusMsg, 'success');
                    } else {
                        showStatus('当前页面没有LocalStorage数据', 'info');
                    }
                });
        } else {
            showStatus('没有找到活动标签页', 'error');
        }
    });
}

/**
 * 切换指定Storage输入框的显示
 */
function toggleSpecificStorageInput() {
    const inputGroup = document.getElementById('specificStorageInput');
    inputGroup.classList.toggle('hidden');
    
    if (!inputGroup.classList.contains('hidden')) {
        document.getElementById('storageKey').focus();
    }
}

/**
 * 获取指定的LocalStorage项
 */
function getSpecificStorage() {
    const storageKey = document.getElementById('storageKey').value.trim();
    
    if (!storageKey) {
        showStatus('请输入Storage键名', 'error');
        return;
    }
    
    showStatus('正在获取指定LocalStorage...', 'info');
    
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs[0]) {
            const urlInfo = parseTabUrl(tabs[0]);
            if (!urlInfo.isValid) {
                showStatus(urlInfo.error, 'error');
                return;
            }
            
            if (urlInfo.isSpecialPage) {
                showStatus('无法在特殊页面获取LocalStorage', 'info');
                return;
            }
            
            // 注入内容脚本获取指定localStorage
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: extractSpecificLocalStorage,
                args: [storageKey]
            }, function(results) {
                    if (chrome.runtime.lastError) {
                        showStatus('获取LocalStorage失败: ' + chrome.runtime.lastError.message, 'error');
                        return;
                    }
                    
                    if (results && results[0] && results[0].result !== null) {
                        const value = results[0].result;
                        const maxLength = getMaxValueLength();
                        
                        if (value.length > maxLength) {
                            showStatus(`Storage项 "${storageKey}" 的值长度 (${value.length}) 超过设置的最大长度 (${maxLength})，已被过滤`, 'info');
                            return;
                        }
                        
                        const storageData = { [storageKey]: value };
                        const storageString = formatStorageForDisplay(storageData);
                        displayStorage(storageString);
                        showStatus(`成功获取Storage项 "${storageKey}"`, 'success');
                    } else {
                        showStatus(`没有找到名为 "${storageKey}" 的LocalStorage项`, 'info');
                    }
                });
        } else {
            showStatus('没有找到活动标签页', 'error');
        }
    });
}

/**
 * 复制Storage到剪贴板
 */
function copyStorageToClipboard() {
    const display = document.getElementById('storageDisplay');
    const storageString = display.getAttribute('data-storage-string');
    
    if (!storageString) {
        showStatus('没有可复制的Storage数据', 'error');
        return;
    }
    
    // 创建临时文本区域来复制
    const textarea = document.createElement('textarea');
    textarea.value = storageString;
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
        document.execCommand('copy');
        showStatus('Storage数据已复制到剪贴板', 'success');
    } catch (err) {
        showStatus('复制失败: ' + err.message, 'error');
    }
    
    document.body.removeChild(textarea);
}

/**
 * 清空Storage显示
 */
function clearStorageDisplay() {
    const display = document.getElementById('storageDisplay');
    const actions = document.getElementById('storageActions');
    
    display.textContent = '';
    display.classList.add('hidden');
    actions.classList.add('hidden');
    display.removeAttribute('data-storage-string');
}

/**
 * 显示Storage数据
 * @param {string} storageString - Storage字符串
 */
function displayStorage(storageString) {
    const display = document.getElementById('storageDisplay');
    const actions = document.getElementById('storageActions');
    
    display.textContent = storageString;
    display.classList.remove('hidden');
    actions.classList.remove('hidden');
    
    // 保存Storage字符串到data属性，便于复制
    display.setAttribute('data-storage-string', storageString);
}

/**
 * 格式化Storage数据用于显示
 * @param {Object} storageData - Storage数据对象
 * @returns {string} 格式化后的Storage字符串
 */
function formatStorageForDisplay(storageData) {
    return Object.entries(storageData).map(([key, value]) => {
        // 如果值太长，截断显示
        const displayValue = value.length > 100 ? value.substring(0, 100) + '...' : value;
        return `${key}: ${displayValue}`;
    }).join('\n');
}

/**
 * 根据长度过滤Storage数据
 * @param {Object} storageData - 原始Storage数据
 * @param {number} maxLength - 最大长度
 * @returns {Object} 过滤后的Storage数据
 */
function filterStorageByLength(storageData, maxLength) {
    const filtered = {};
    for (const [key, value] of Object.entries(storageData)) {
        if (value.length <= maxLength) {
            filtered[key] = value;
        }
    }
    return filtered;
}

/**
 * 获取最大值长度设置
 * @returns {number} 最大长度
 */
function getMaxValueLength() {
    const input = document.getElementById('maxValueLength');
    const value = parseInt(input.value) || 500;
    
    // 保存设置
    chrome.storage.local.set({ maxValueLength: value });
    
    return value;
}

/**
 * 加载Storage设置
 */
function loadStorageSettings() {
    chrome.storage.local.get(['maxValueLength'], function(result) {
        if (result.maxValueLength) {
            document.getElementById('maxValueLength').value = result.maxValueLength;
        }
    });
}

// ==================== 内容脚本函数 ====================

/**
 * 提取所有LocalStorage数据 (在页面上下文中执行)
 * @returns {Object} LocalStorage数据对象
 */
function extractAllLocalStorage() {
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

/**
 * 提取指定的LocalStorage项 (在页面上下文中执行)
 * @param {string} key - 要获取的键名
 * @returns {string|null} 对应的值或null
 */
function extractSpecificLocalStorage(key) {
    try {
        return localStorage.getItem(key);
    } catch (error) {
        console.error('获取localStorage失败:', error);
        return null;
    }
}

// 监听指定Storage输入框的回车键
document.addEventListener('DOMContentLoaded', function() {
    const storageKeyInput = document.getElementById('storageKey');
    if (storageKeyInput) {
        storageKeyInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                getSpecificStorage();
            }
        });
    }
    
    // 监听最大长度设置变化
    const maxLengthInput = document.getElementById('maxValueLength');
    if (maxLengthInput) {
        maxLengthInput.addEventListener('change', function() {
            const value = parseInt(this.value) || 500;
            chrome.storage.local.set({ maxValueLength: value });
        });
    }
});
// ==================== 同步功能 ====================

// 同步管理器实例
let syncManager = null;

// 初始化同步管理器
async function initializeSyncManager() {
    try {
        console.log('开始初始化同步管理器...');
        
        // 检查SyncManager是否已加载
        if (typeof SyncManager === 'undefined') {
            console.error('SyncManager类未定义，请确保sync-manager.js已正确加载');
            updateSyncStatus('error', 'SyncManager类未定义');
            syncManager = null;
            return;
        }
        
        console.log('SyncManager类已找到，创建实例...');
        syncManager = new SyncManager();
        
        console.log('开始初始化同步管理器实例...');
        await syncManager.initialize();
        
        console.log('同步管理器初始化成功');
        updateSyncStatus('connected', '同步管理器已就绪');
    } catch (error) {
        console.error('同步管理器初始化失败:', error);
        updateSyncStatus('error', `初始化失败: ${error.message}`);
        syncManager = null;
    }
}

/**
 * 测试服务器连接
 */
async function testServerConnection() {
    const serverUrl = document.getElementById('serverUrl').value.trim();
    
    if (!serverUrl) {
        showStatus('请输入服务器地址', 'error');
        return { success: false, error: '服务器地址为空' };
    }
    
    showStatus('正在测试服务器连接...', 'info');
    updateGlobalConnectionStatus('connecting', '连接中...');
    
    try {
        const response = await fetch(`${serverUrl}/health`);
        if (response.ok) {
            const data = await response.json();
            showStatus(`服务器连接成功 (${data.version || 'unknown'})`, 'success');
            updateGlobalConnectionStatus('online', '已连接');
            updateSyncStatus('connected', '服务器连接正常');
            return { success: true, data };
        } else {
            showStatus('服务器连接失败', 'error');
            updateGlobalConnectionStatus('offline', '连接失败');
            updateSyncStatus('disconnected', '服务器连接失败');
            return { success: false, error: '服务器响应错误' };
        }
    } catch (error) {
        showStatus(`连接失败: ${error.message}`, 'error');
        updateGlobalConnectionStatus('offline', `连接失败: ${error.message}`);
        updateSyncStatus('disconnected', `连接失败: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * 保存服务器配置
 */
async function saveServerConfig() {
    const serverUrl = document.getElementById('serverUrl').value.trim();
    const encryptionKey = document.getElementById('encryptionKey').value.trim();
    
    if (!serverUrl) {
        showStatus('请输入服务器地址', 'error');
        return;
    }
    
    try {
        showStatus('正在保存配置...', 'info');
        updateGlobalConnectionStatus('connecting', '连接中...');
        
        const config = {
            serverUrl,
            encryptionKey,
            enableEncryption: !!encryptionKey
        };
        
        // 保存到本地存储
        await chrome.storage.local.set({ syncConfig: config });
        
        // 如果有同步管理器，更新配置
        if (syncManager) {
            await syncManager.updateServerConfig(config);
        }
        
        showStatus('服务器配置已保存', 'success');
        
        // 测试连接
        const connectionResult = await testServerConnection();
        
        if (connectionResult && connectionResult.success) {
            // 连接成功，确保Pass ID存在
            if (syncManager) {
                showStatus('正在验证用户标识...', 'info');
                try {
                    const passId = await syncManager.ensureUserPassExists();
                    console.log('ensureUserPassExists返回的Pass ID:', passId);
                    displayUserPass(passId);
                    showStatus('用户标识已就绪', 'success');
                    
                    // 重要：使用syncManager的最新配置来确保userPass包含在localStorage中
                    const latestConfig = syncManager.config;
                    if (latestConfig && latestConfig.userPass) {
                        await chrome.storage.local.set({ syncConfig: latestConfig });
                        console.log('Pass ID已保存到localStorage (使用syncManager配置):', latestConfig.userPass);
                    } else {
                        console.error('syncManager配置中没有userPass:', latestConfig);
                    }
                } catch (error) {
                    showStatus(`用户标识处理失败: ${error.message}`, 'error');
                }
            }
        }
        
    } catch (error) {
        showStatus(`保存配置失败: ${error.message}`, 'error');
        updateGlobalConnectionStatus('offline', '连接失败');
    }
}

/**
 * 保存域名配置
 */
async function saveDomainConfig() {
    const enableCookieSync = document.getElementById('enableCookieSync').checked;
    const enableStorageSync = document.getElementById('enableStorageSync').checked;
    const syncInterval = parseInt(document.getElementById('syncInterval').value) || 5;
    
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]) {
            showStatus('无法获取当前域名', 'error');
            return;
        }
        
        const urlInfo = parseTabUrl(tabs[0]);
        if (!urlInfo.isValid || urlInfo.isSpecialPage) {
            showStatus('当前页面不支持同步', 'error');
            return;
        }
        
        const domain = urlInfo.domain;
        const config = {
            enableCookieSync,
            enableStorageSync,
            syncInterval,
            lastSyncTime: null,
            syncSource: 'local'
        };
        
        // 保存域名配置
        const domainConfigs = await chrome.storage.local.get(['domainConfigs']) || {};
        domainConfigs.domainConfigs = domainConfigs.domainConfigs || {};
        domainConfigs.domainConfigs[domain] = config;
        
        await chrome.storage.local.set(domainConfigs);
        
        // 如果有同步管理器，更新配置
        if (syncManager) {
            await syncManager.updateDomainConfig(domain, config);
            
            // 确保Pass ID存在（切换域名时验证）
            if (syncManager.config.serverUrl) {
                try {
                    await syncManager.ensureUserPassExists();
                    console.log(`域名 ${domain} 配置保存时，Pass ID 验证通过`);
                } catch (error) {
                    console.warn(`域名 ${domain} 配置保存时，Pass ID 验证失败:`, error);
                    // 不显示错误给用户，因为这不是关键操作
                }
            }
        }
        
        showStatus(`域名 ${domain} 配置已保存`, 'success');
        
    } catch (error) {
        showStatus(`保存域名配置失败: ${error.message}`, 'error');
    }
}

/**
 * 立即同步
 */
async function syncNow() {
    if (!syncManager || !syncManager.isInitialized) {
        showStatus('同步管理器未初始化', 'error');
        // 尝试重新初始化
        await initializeSyncManager();
        if (!syncManager || !syncManager.isInitialized) {
            showStatus('同步管理器初始化失败', 'error');
            return;
        }
    }
    
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]) {
            showStatus('无法获取当前域名', 'error');
            return;
        }
        
        const urlInfo = parseTabUrl(tabs[0]);
        if (!urlInfo.isValid || urlInfo.isSpecialPage) {
            showStatus('当前页面不支持同步', 'error');
            return;
        }
        
        const domain = urlInfo.domain;
        
        showStatus('正在同步...', 'info');
        updateSyncStatus('syncing', '同步中...');
        
        const result = await syncManager.syncDomain(domain);
        
        if (result.success) {
            showStatus(`同步成功 (${result.action})`, 'success');
            updateSyncStatus('connected', '同步完成');
            updateSyncDirection(result.action, new Date().toISOString());
            
            // 刷新版本历史
            await refreshVersionHistory();
            
            // 更新同步状态显示
            await updateSyncStatusDisplay();
        } else {
            showStatus(`同步失败: ${result.error || result.reason}`, 'error');
            updateSyncStatus('error', `同步失败: ${result.error || result.reason}`);
        }
        
    } catch (error) {
        showStatus(`同步失败: ${error.message}`, 'error');
        updateSyncStatus('error', `同步失败: ${error.message}`);
    }
}

/**
 * 上传到服务器
 */
async function uploadToServer() {
    console.log('uploadToServer 被调用');
    console.log('syncManager 状态:', syncManager);
    console.log('syncManager.isInitialized:', syncManager ? syncManager.isInitialized : 'syncManager为null');
    
    if (!syncManager || !syncManager.isInitialized) {
        showStatus('同步管理器未初始化，正在尝试初始化...', 'info');
        // 尝试重新初始化
        await initializeSyncManager();
        if (!syncManager || !syncManager.isInitialized) {
            showStatus('同步管理器初始化失败，请检查配置', 'error');
            return;
        }
    }
    
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]) return;
        
        const urlInfo = parseTabUrl(tabs[0]);
        if (!urlInfo.isValid || urlInfo.isSpecialPage) {
            showStatus('当前页面不支持同步', 'error');
            return;
        }
        
        const domain = urlInfo.domain;
        
        // 检查域名同步配置
        const domainConfig = syncManager.getDomainConfig(domain);
        if (!domainConfig.enableCookieSync && !domainConfig.enableStorageSync) {
            showStatus('请先在"页面"标签中启用Cookie或LocalStorage同步', 'error');
            return;
        }
        
        showStatus('正在上传数据...', 'info');
        
        // 获取本地数据
        const localData = await syncManager.getLocalData(domain);
        console.log('准备上传的本地数据:', localData);
        
        // 检查是否有数据
        const hasCookies = localData.cookies && Object.keys(localData.cookies).length > 0;
        const hasLocalStorage = localData.localStorage && Object.keys(localData.localStorage).length > 0;
        
        if (!hasCookies && !hasLocalStorage) {
            showStatus('没有找到可上传的数据（Cookie或LocalStorage）', 'info');
            return;
        }
        
        showStatus(`正在上传数据... (Cookie: ${hasCookies ? Object.keys(localData.cookies).length : 0}项, LocalStorage: ${hasLocalStorage ? Object.keys(localData.localStorage).length : 0}项)`, 'info');
        
        // 上传到服务器
        await syncManager.uploadToServer(domain, localData);
        
        showStatus('数据上传成功', 'success');
        updateSyncDirection('upload', new Date().toISOString());
        
        // 更新域名配置
        const config = syncManager.getDomainConfig(domain);
        config.lastSyncTime = new Date().toISOString();
        config.syncSource = 'local';
        await syncManager.updateDomainConfig(domain, config);
        
        // 刷新显示
        await refreshVersionHistory();
        await updateSyncStatusDisplay();
        
    } catch (error) {
        showStatus(`上传失败: ${error.message}`, 'error');
    }
}

/**
 * 从服务器下载
 */
async function downloadFromServer() {
    if (!syncManager || !syncManager.isInitialized) {
        showStatus('同步管理器未初始化', 'error');
        // 尝试重新初始化
        await initializeSyncManager();
        if (!syncManager || !syncManager.isInitialized) {
            showStatus('同步管理器初始化失败', 'error');
            return;
        }
    }
    
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]) return;
        
        const urlInfo = parseTabUrl(tabs[0]);
        if (!urlInfo.isValid || urlInfo.isSpecialPage) {
            showStatus('当前页面不支持同步', 'error');
            return;
        }
        
        const domain = urlInfo.domain;
        
        showStatus('正在下载数据...', 'info');
        
        // 从服务器获取数据
        const serverData = await syncManager.getServerData(domain);
        
        if (!serverData) {
            showStatus('服务器没有该域名的数据', 'info');
            return;
        }
        
        // 应用到当前页面
        await syncManager.downloadFromServer(domain, serverData);
        
        showStatus('数据下载并应用成功', 'success');
        updateSyncDirection('download', new Date().toISOString());
        
        // 更新域名配置
        const config = syncManager.getDomainConfig(domain);
        config.lastSyncTime = new Date().toISOString();
        config.syncSource = 'server';
        await syncManager.updateDomainConfig(domain, config);
        
        // 刷新显示
        await refreshVersionHistory();
        await updateSyncStatusDisplay();
        
    } catch (error) {
        showStatus(`下载失败: ${error.message}`, 'error');
    }
}

/**
 * 刷新版本历史
 */
async function refreshVersionHistory() {
    if (!syncManager) {
        showStatus('同步管理器未初始化', 'error');
        return;
    }
    
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]) return;
        
        const urlInfo = parseTabUrl(tabs[0]);
        if (!urlInfo.isValid || urlInfo.isSpecialPage) {
            renderVersionHistory([]);
            return;
        }
        
        const domain = urlInfo.domain;
        showStatus('正在获取版本历史...', 'info');
        
        const versions = await syncManager.getVersionHistory(domain);
        renderVersionHistory(versions);
        
        if (versions.length > 0) {
            showStatus(`获取到 ${versions.length} 个版本`, 'success');
        } else {
            showStatus('暂无版本历史', 'info');
        }
        
    } catch (error) {
        console.error('刷新版本历史失败:', error);
        showStatus(`获取版本历史失败: ${error.message}`, 'error');
        renderVersionHistory([]);
    }
}

/**
 * 格式化相对时间显示
 * 根据时间差智能显示格式：秒/分钟/具体时间
 * @param {string} timestamp - ISO时间戳
 * @returns {string} 格式化后的时间字符串
 */
function formatRelativeTime(timestamp) {
    if (!timestamp) return '从未';
    
    const now = new Date();
    const syncTime = new Date(timestamp);
    const diffMs = now - syncTime;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    // 10分钟内显示相对时间
    if (diffSeconds < 60) {
        return `${diffSeconds}秒前`;
    } else if (diffMinutes < 10) {
        return `${diffMinutes}分钟前`;
    }
    // 超过10分钟显示具体时间
    else {
        return syncTime.toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

/**
 * 启动时间更新定时器
 * 每秒更新一次最后同步时间显示
 */
function startTimeUpdateTimer() {
    // 立即更新一次
    updateLastSyncTimeDisplay();
    
    // 设置定时器，每秒更新一次
    setInterval(updateLastSyncTimeDisplay, 1000);
}

/**
 * 更新最后同步时间显示
 * 从当前域名的配置中获取最后同步时间并更新显示
 */
async function updateLastSyncTimeDisplay() {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]) return;
        
        const urlInfo = parseTabUrl(tabs[0]);
        if (!urlInfo.isValid || urlInfo.isSpecialPage) return;
        
        const domain = urlInfo.domain;
        
        // 获取域名配置
        const domainConfigs = await chrome.storage.local.get(['domainConfigs']);
        const config = domainConfigs.domainConfigs?.[domain] || {};
        
        // 更新最后同步时间显示
        const lastSyncElement = document.getElementById('lastSyncTime');
        if (lastSyncElement) {
            const relativeTime = formatRelativeTime(config.lastSyncTime);
            lastSyncElement.textContent = relativeTime;
        }
    } catch (error) {
        // 静默处理错误，避免频繁报错
        console.debug('更新最后同步时间显示失败:', error);
    }
}

/**
 * 更新同步状态显示
 */
function updateSyncStatus(status, message) {
    const statusText = document.getElementById('syncStatusText');
    if (statusText) {
        statusText.textContent = message;
        statusText.className = `status-${status}`;
    }
}

/**
 * 更新同步方向显示
 */
function updateSyncDirection(action, timestamp) {
    const syncIcon = document.getElementById('syncDirection');
    const lastSyncTime = document.getElementById('lastSyncTime');
    
    if (syncIcon && lastSyncTime) {
        let icon = '-';
        let className = '';
        
        switch (action) {
            case 'upload':
                icon = '⬆️';
                className = 'upload';
                break;
            case 'download':
                icon = '⬇️';
                className = 'download';
                break;
            case 'sync':
                icon = '🔄';
                className = 'sync';
                break;
        }
        
        syncIcon.textContent = icon;
        syncIcon.className = `sync-icon ${className}`;
        
        if (timestamp) {
            const relativeTime = formatRelativeTime(timestamp);
            lastSyncTime.textContent = relativeTime;
        }
    }
}

/**
 * 更新同步状态详细信息
 */
async function updateSyncStatusDisplay() {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]) return;
        
        const urlInfo = parseTabUrl(tabs[0]);
        if (!urlInfo.isValid || urlInfo.isSpecialPage) return;
        
        const domain = urlInfo.domain;
        
        // 获取域名配置
        const domainConfigs = await chrome.storage.local.get(['domainConfigs']);
        const config = domainConfigs.domainConfigs?.[domain] || {};
        
        // 更新最后同步时间
        const lastSyncElement = document.getElementById('lastSyncTime');
        if (lastSyncElement) {
            const relativeTime = formatRelativeTime(config.lastSyncTime);
            lastSyncElement.textContent = relativeTime;
        }
        
        // 更新数据来源
        const dataSourceElement = document.getElementById('dataSource');
        if (dataSourceElement) {
            const source = config.syncSource === 'server' ? '服务器' : '本地';
            dataSourceElement.textContent = `数据来源: ${source}`;
        }
        
    } catch (error) {
        console.error('更新同步状态显示失败:', error);
    }
}

/**
 * 加载同步配置
 */
async function loadSyncConfig() {
    try {
        // 加载服务器配置
        const syncConfig = await chrome.storage.local.get(['syncConfig']);
        if (syncConfig.syncConfig) {
            const config = syncConfig.syncConfig;
            
            const serverUrlInput = document.getElementById('serverUrl');
            if (serverUrlInput) {
                serverUrlInput.value = config.serverUrl || '';
            }
            
            const encryptionKeyInput = document.getElementById('encryptionKey');
            if (encryptionKeyInput) {
                encryptionKeyInput.value = config.encryptionKey || '';
            }
            
            // 如果有Pass ID，显示它
            if (config.userPass) {
                displayUserPass(config.userPass);
            }
        }
        
        // 加载当前域名配置
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
            const urlInfo = parseTabUrl(tabs[0]);
            if (urlInfo.isValid && !urlInfo.isSpecialPage) {
                const domain = urlInfo.domain;
                
                const domainConfigs = await chrome.storage.local.get(['domainConfigs']);
                const config = domainConfigs.domainConfigs?.[domain] || {};
                
                const enableCookieSyncInput = document.getElementById('enableCookieSync');
                if (enableCookieSyncInput) {
                    enableCookieSyncInput.checked = config.enableCookieSync || false;
                }
                
                const enableStorageSyncInput = document.getElementById('enableStorageSync');
                if (enableStorageSyncInput) {
                    enableStorageSyncInput.checked = config.enableStorageSync || false;
                }
                
                const syncIntervalInput = document.getElementById('syncInterval');
                if (syncIntervalInput) {
                    syncIntervalInput.value = config.syncInterval || 5;
                }
            }
        }
        
        // 初始化同步管理器
        await initializeSyncManager();
        
        // 更新状态显示
        await updateSyncStatusDisplay();
        
        // 如果有服务器配置，测试连接
        if (syncConfig.syncConfig && syncConfig.syncConfig.serverUrl) {
            await testServerConnection();
        }
        
        // 更新随机密钥按钮状态
        updateRandomKeyButtonState();
        
    } catch (error) {
        console.error('加载同步配置失败:', error);
        // 即使配置加载失败，也要尝试初始化同步管理器
        try {
            await initializeSyncManager();
        } catch (initError) {
            console.error('同步管理器初始化失败:', initError);
        }
    }
}

/**
 * 复制用户Pass到剪贴板
 */
async function copyUserPassToClipboard() {
    const passDisplay = document.getElementById('userPassDisplay');
    const passId = passDisplay.textContent;
    
    if (!passId || passId === '未生成') {
        showStatus('没有可复制的Pass ID', 'error');
        return;
    }
    
    try {
        await navigator.clipboard.writeText(passId);
        showStatus('Pass ID已复制到剪贴板', 'success');
    } catch (error) {
        // 降级方案
        const textarea = document.createElement('textarea');
        textarea.value = passId;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showStatus('Pass ID已复制到剪贴板', 'success');
    }
}

/**
 * 生成快捷访问URL
 */
async function generateQuickAccessUrl() {
    if (!syncManager || !syncManager.isInitialized) {
        showStatus('同步管理器未初始化', 'error');
        return;
    }
    
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]) {
            showStatus('无法获取当前页面', 'error');
            return;
        }
        
        const urlInfo = parseTabUrl(tabs[0]);
        if (!urlInfo.isValid || urlInfo.isSpecialPage) {
            showStatus('当前页面不支持生成快捷访问链接', 'error');
            return;
        }
        
        const domain = urlInfo.domain;
        const quickUrl = await syncManager.generateQuickAccessUrl(domain);
        
        // 显示URL
        const urlDisplay = document.getElementById('quickUrlDisplay');
        const urlInput = document.getElementById('quickUrlInput');
        const copyBtn = document.getElementById('copyQuickUrl');
        
        urlInput.value = quickUrl;
        urlDisplay.style.display = 'block';
        copyBtn.disabled = false;
        
        showStatus('快捷访问链接已生成', 'success');
        
    } catch (error) {
        showStatus(`生成链接失败: ${error.message}`, 'error');
    }
}

/**
 * 复制快捷访问URL到剪贴板
 */
async function copyQuickUrlToClipboard() {
    const urlInput = document.getElementById('quickUrlInput');
    const url = urlInput.value;
    
    if (!url) {
        showStatus('没有可复制的链接', 'error');
        return;
    }
    
    try {
        await navigator.clipboard.writeText(url);
        showStatus('快捷访问链接已复制到剪贴板', 'success');
    } catch (error) {
        // 降级方案
        urlInput.select();
        document.execCommand('copy');
        showStatus('快捷访问链接已复制到剪贴板', 'success');
    }
}

/**
 * 打开快捷访问URL
 */
async function openQuickAccessUrl() {
    if (!syncManager || !syncManager.isInitialized) {
        showStatus('同步管理器未初始化', 'error');
        return;
    }
    
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]) {
            showStatus('无法获取当前页面', 'error');
            return;
        }
        
        const urlInfo = parseTabUrl(tabs[0]);
        if (!urlInfo.isValid || urlInfo.isSpecialPage) {
            showStatus('当前页面不支持快捷访问', 'error');
            return;
        }
        
        const domain = urlInfo.domain;
        const quickUrl = await syncManager.generateQuickAccessUrl(domain);
        
        // 在新标签页中打开链接
        chrome.tabs.create({ url: quickUrl });
        showStatus('已在新标签页中打开数据页面', 'success');
        
    } catch (error) {
        showStatus(`打开链接失败: ${error.message}`, 'error');
    }
}

/**
 * 生成随机加密密钥
 */
function generateRandomEncryptionKey() {
    const encryptionKeyInput = document.getElementById('encryptionKey');
    
    // 如果已有密钥，需要用户确认
    if (encryptionKeyInput && encryptionKeyInput.value.trim()) {
        if (!confirm('已存在加密密钥，确定要生成新的随机密钥吗？这将替换现有密钥。')) {
            return;
        }
    }
    
    try {
        // 使用加密安全的随机数生成器
        const array = new Uint8Array(24); // 24 bytes = 32 base64 characters
        crypto.getRandomValues(array);
        
        // 转换为base64字符串
        const result = btoa(String.fromCharCode.apply(null, array))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
        
        if (encryptionKeyInput) {
            encryptionKeyInput.value = result;
            encryptionKeyInput.type = 'text'; // 临时显示密钥
            
            // 2秒后隐藏密钥
            setTimeout(() => {
                encryptionKeyInput.type = 'password';
                updateRandomKeyButtonState(); // 更新按钮状态
            }, 2000);
            
            showStatus('安全随机加密密钥已生成', 'success');
            updateRandomKeyButtonState(); // 立即更新按钮状态
        }
    } catch (error) {
        // 降级到普通随机数生成器
        console.warn('使用降级随机数生成器:', error);
        
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
        let result = '';
        for (let i = 0; i < 32; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        if (encryptionKeyInput) {
            encryptionKeyInput.value = result;
            encryptionKeyInput.type = 'text';
            
            setTimeout(() => {
                encryptionKeyInput.type = 'password';
                updateRandomKeyButtonState();
            }, 2000);
            
            showStatus('随机加密密钥已生成', 'success');
            updateRandomKeyButtonState();
        }
    }
}

/**
 * 更新随机密钥按钮状态
 */
function updateRandomKeyButtonState() {
    const encryptionKeyInput = document.getElementById('encryptionKey');
    const generateRandomKeyBtn = document.getElementById('generateRandomKey');
    
    if (encryptionKeyInput && generateRandomKeyBtn) {
        const hasKey = encryptionKeyInput.value.trim().length > 0;
        
        if (hasKey) {
            generateRandomKeyBtn.textContent = '🔄 重新生成';
            generateRandomKeyBtn.title = '重新生成随机密钥（将替换现有密钥）';
        } else {
            generateRandomKeyBtn.textContent = '🎲 随机';
            generateRandomKeyBtn.title = '生成随机密钥';
        }
    }
}

/**
 * 更新全局连接状态
 */
function updateGlobalConnectionStatus(status, message) {
    const statusDot = document.getElementById('connectionStatus');
    const statusText = document.getElementById('connectionText');
    
    if (statusDot && statusText) {
        statusDot.className = `status-dot ${status}`;
        statusText.textContent = message;
    }
}

/**
 * 显示用户Pass信息
 */
function displayUserPass(passId) {
    const userPassSection = document.getElementById('userPassSection');
    const userPassDisplay = document.getElementById('userPassDisplay');
    
    // 调试日志：确认函数调用情况
    console.log('displayUserPass函数被调用:', {
        passId: passId,
        userPassSectionExists: !!userPassSection,
        userPassDisplayExists: !!userPassDisplay,
        currentDisplayText: userPassDisplay ? userPassDisplay.textContent : '元素不存在'
    });
    
    if (userPassSection && userPassDisplay) {
        userPassDisplay.textContent = passId;
        userPassSection.style.display = 'block';
        console.log('Pass ID已设置到界面:', passId);
    } else {
        console.error('Pass ID显示元素不存在:', {
            userPassSectionExists: !!userPassSection,
            userPassDisplayExists: !!userPassDisplay
        });
    }
}

/**
 * 更新当前域名显示
 */
function updateCurrentDomainDisplay() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        const syncDomainSpan = document.getElementById('currentSyncDomain');
        const pageDomainSpan = document.getElementById('currentPageDomain');
        
        if (tabs[0]) {
            const urlInfo = parseTabUrl(tabs[0]);
            const domainText = urlInfo.isValid && !urlInfo.isSpecialPage ? urlInfo.domain : '不支持的页面';
            
            if (syncDomainSpan) {
                syncDomainSpan.textContent = domainText;
            }
            if (pageDomainSpan) {
                pageDomainSpan.textContent = domainText;
            }
        }
    });
}

/**
 * 版本回滚功能
 */
let selectedVersionId = null;

async function rollbackToVersion() {
    if (!selectedVersionId) {
        showStatus('请先选择要回滚的版本', 'error');
        return;
    }
    
    if (!confirm('确定要回滚到选中的版本吗？当前数据将被覆盖！')) {
        return;
    }
    
    try {
        showStatus('正在回滚版本...', 'info');
        
        // 这里应该实现版本回滚逻辑
        // 由于当前版本存储在本地，这里只是一个示例
        showStatus('版本回滚功能开发中...', 'info');
        
    } catch (error) {
        showStatus(`版本回滚失败: ${error.message}`, 'error');
    }
}

/**
 * 渲染版本历史列表
 */
function renderVersionHistory(versions) {
    const historyDiv = document.getElementById('versionHistory');
    
    if (!historyDiv) return;
    
    if (!versions || versions.length === 0) {
        historyDiv.innerHTML = '<p style="color: #6c757d; font-size: 12px; text-align: center; padding: 20px;">暂无版本历史</p>';
        return;
    }
    
    // 按时间排序，最新的在前
    const sortedVersions = [...versions].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    const historyHtml = sortedVersions.map((version, index) => {
        const date = new Date(version.timestamp).toLocaleString();
        const size = version.size ? (version.size / 1024).toFixed(1) + 'KB' : '-';
        
        // 根据实际数据判断来源，如果没有source字段，根据索引推测
        let source = version.source;
        if (!source) {
            // 假设前2个是服务器版本，后面的是本地版本
            source = index < 2 ? 'server' : 'local';
        }
        
        const sourceText = source === 'server' ? '服务器' : '本地';
        const versionNumber = index + 1;
        
        return `
            <div class="version-item" data-version-id="${version.id}">
                <div class="version-info">
                    <div class="version-header">
                        <span class="version-id">版本 ${versionNumber}</span>
                        <span class="version-source ${source}">${sourceText}</span>
                    </div>
                    <div class="version-meta">${date} • ${size}</div>
                </div>
                <div class="version-actions">
                    <button class="rollback-btn" onclick="rollbackToVersion('${version.id}', event)" title="回滚到此版本">
                        回滚
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    historyDiv.innerHTML = historyHtml;
}

/**
 * 选择版本
 */
function selectVersion(versionId, element) {
    selectedVersionId = versionId;
    
    // 更新选中状态
    document.querySelectorAll('.version-item').forEach(item => {
        item.classList.remove('selected');
    });
    element.classList.add('selected');
}

/**
 * 版本回滚功能
 */
async function rollbackToVersion(versionId, event) {
    event.stopPropagation(); // 阻止事件冒泡
    
    if (!confirm('确定要回滚到这个版本吗？当前数据将被覆盖！')) {
        return;
    }
    
    if (!syncManager || !syncManager.isInitialized) {
        showStatus('同步管理器未初始化', 'error');
        return;
    }
    
    try {
        showStatus('正在回滚版本...', 'info');
        
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]) {
            showStatus('无法获取当前页面', 'error');
            return;
        }
        
        const urlInfo = parseTabUrl(tabs[0]);
        if (!urlInfo.isValid || urlInfo.isSpecialPage) {
            showStatus('当前页面不支持版本回滚', 'error');
            return;
        }
        
        const domain = urlInfo.domain;
        
        // 从服务器获取指定版本的数据
        const url = `${syncManager.config.serverUrl}/api/data/${syncManager.config.userPass}/version/${versionId}?domain=${encodeURIComponent(domain)}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`获取版本数据失败: ${response.status}`);
        }
        
        const versionData = await response.json();
        
        // 解密数据（如果需要）
        let data = versionData.data;
        if (syncManager.config.enableEncryption && syncManager.config.encryptionKey) {
            data = syncManager.decrypt(data);
        }
        
        if (typeof data === 'string') {
            data = JSON.parse(data);
        }
        
        // 应用数据到当前页面
        await syncManager.applyDataToPage(domain, data);
        
        showStatus('版本回滚成功', 'success');
        
        // 更新同步状态
        const config = syncManager.getDomainConfig(domain);
        config.lastSyncTime = new Date().toISOString();
        config.syncSource = 'server';
        await syncManager.updateDomainConfig(domain, config);
        
        // 刷新显示
        await updateSyncStatusDisplay();
        updateSyncDirection('download', new Date().toISOString());
        
    } catch (error) {
        console.error('版本回滚失败:', error);
        showStatus(`版本回滚失败: ${error.message}`, 'error');
    }
}

// 在DOM加载完成后初始化同步功能
document.addEventListener('DOMContentLoaded', function() {
    // 延迟加载同步功能，确保其他功能先初始化
    setTimeout(() => {
        loadSyncConfig();
        updateCurrentDomainDisplay();
        
        // 如果当前是同步标签页，刷新版本历史
        const activeTab = document.querySelector('.tab.active');
        if (activeTab && activeTab.getAttribute('data-tab') === 'sync') {
            setTimeout(refreshVersionHistory, 500);
        }
    }, 100);
});

/**
 * 启动动态时间更新定时器
 * 每秒更新一次最后同步时间显示，确保时间显示是动态的
 */
function startTimeUpdateTimer() {
    // 立即更新一次
    updateLastSyncTimeDisplay();
    
    // 每秒更新一次时间显示
    setInterval(() => {
        updateLastSyncTimeDisplay();
    }, 1000);
}

/**
 * 更新最后同步时间显示
 */
async function updateLastSyncTimeDisplay() {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]) return;
        
        const urlInfo = parseTabUrl(tabs[0]);
        if (!urlInfo.isValid || urlInfo.isSpecialPage) return;
        
        const domain = urlInfo.domain;
        
        // 获取域名配置
        const domainConfigs = await chrome.storage.local.get(['domainConfigs']);
        const config = domainConfigs.domainConfigs?.[domain] || {};
        
        // 更新最后同步时间显示
        const lastSyncElement = document.getElementById('lastSyncTime');
        if (lastSyncElement) {
            const relativeTime = formatRelativeTime(config.lastSyncTime);
            lastSyncElement.textContent = relativeTime;
        }
    } catch (error) {
        // 静默处理错误，避免频繁报错
        console.debug('更新最后同步时间显示失败:', error);
    }
}
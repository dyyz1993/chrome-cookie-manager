/**
 * Cookie Manager Popup Script
 * 处理popup界面的交互逻辑
 */

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
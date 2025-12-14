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
    
    // 获取当前标签页信息
    getCurrentTabInfo();
    
    // 绑定事件监听器
    bindEventListeners();
    
    // 默认加载所有Cookie
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        console.log('chrome.tabs.query 返回:', tabs);
        
        if (tabs[0]) {
            // 检查是否是有效的URL
            try {
                const url = new URL(tabs[0].url);
                console.log('解析的URL:', url);
                
                // 检查是否是特殊页面（如chrome://页面）
                if (url.protocol === 'chrome:' || url.protocol === 'chrome-extension:' || url.protocol === 'moz-extension:') {
                    console.log('检测到特殊页面，协议:', url.protocol);
                    showStatus('无法在特殊页面获取Cookie', 'info');
                    return;
                }
                
                const domain = url.hostname;
                console.log('提取的域名:', domain);
                
                // 先检查权限状态
                console.log('准备检查权限状态');
                checkPermissionsAndShowStatus(domain);
                
                // 尝试获取所有Cookie
                console.log('开始尝试获取Cookie，初始化加载');
                tryGetAllCookies(tabs[0], domain, true); // 传入true表示是初始化加载
            } catch (error) {
                console.error('URL解析错误:', error);
                showStatus('无法解析当前页面URL', 'error');
            }
        } else {
            console.error('没有找到活动标签页');
        }
    });
}

/**
 * 获取当前标签页信息
 */
function getCurrentTabInfo() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs[0]) {
            try {
                const url = new URL(tabs[0].url);
                
                // 检查是否是特殊页面
                if (url.protocol === 'chrome:' || url.protocol === 'chrome-extension:' || url.protocol === 'moz-extension:') {
                    document.getElementById('currentDomain').textContent = `当前页面: 特殊页面`;
                    return;
                }
                
                const domain = url.hostname;
                document.getElementById('currentDomain').textContent = `当前域名: ${domain}`;
            } catch (error) {
                document.getElementById('currentDomain').textContent = `当前页面: 无法解析`;
                console.error('URL解析错误:', error);
            }
        }
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
    
    console.log('bindEventListeners 执行完成');
}

/**
 * 获取当前页面的所有Cookie
 */
function getAllCookies() {
    showStatus('正在获取Cookie...', 'info');
    
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs[0]) {
            try {
                const url = new URL(tabs[0].url);
                
                // 检查是否是特殊页面
                if (url.protocol === 'chrome:' || url.protocol === 'chrome-extension:' || url.protocol === 'moz-extension:') {
                    showStatus('无法在特殊页面获取Cookie', 'info');
                    return;
                }
                
                const domain = url.hostname;
                
                // 先检查权限状态
                checkPermissionsAndShowStatus(domain);
                
                // 直接尝试获取Cookie，如果没有权限Chrome会返回错误
                tryGetAllCookies(tabs[0], domain, false);
            } catch (error) {
                showStatus('无法解析当前页面URL', 'error');
                console.error('URL解析错误:', error);
            }
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
            try {
                const url = new URL(tabs[0].url);
                
                // 检查是否是特殊页面
                if (url.protocol === 'chrome:' || url.protocol === 'chrome-extension:' || url.protocol === 'moz-extension:') {
                    showStatus('无法在特殊页面获取Cookie', 'info');
                    return;
                }
                
                const domain = url.hostname;
                
                // 直接尝试获取Cookie，如果没有权限Chrome会返回错误
                tryGetSpecificCookie(tabs[0], domain, cookieName);
            } catch (error) {
                showStatus('无法解析当前页面URL', 'error');
                console.error('URL解析错误:', error);
            }
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
            try {
                const url = new URL(tabs[0].url);
                
                // 检查是否是特殊页面
                if (url.protocol === 'chrome:' || url.protocol === 'chrome-extension:' || url.protocol === 'moz-extension:') {
                    showStatus('无法在特殊页面设置Cookie', 'info');
                    return;
                }
                
                const domain = document.getElementById('newCookieDomain').value.trim() || url.hostname;
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
                        secure: url.protocol === 'https:',
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
            } catch (error) {
                showStatus('无法解析当前页面URL', 'error');
                console.error('URL解析错误:', error);
            }
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
            try {
                const url = new URL(tabs[0].url);
                
                // 检查是否是特殊页面
                if (url.protocol === 'chrome:' || url.protocol === 'chrome-extension:' || url.protocol === 'moz-extension:') {
                    showStatus('无法在特殊页面获取Cookie', 'info');
                    return;
                }
                
                const domain = url.hostname;
                
                // 隐藏申请权限按钮
                document.getElementById('requestPermissionGroup').classList.add('hidden');
                
                // 申请权限并重试获取Cookie
                requestPermissionAndRetry(domain, () => {
                    // 权限申请成功后，再次检查权限状态
                    checkPermissionsAndShowStatus(domain);
                    // 然后获取Cookie
                    tryGetAllCookies(tabs[0], domain, false);
                });
            } catch (error) {
                showStatus('无法解析当前页面URL', 'error');
                console.error('URL解析错误:', error);
            }
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
/**
 * Background Script for Cookie Manager
 * 处理动态权限申请和后台任务
 */

/**
 * 监听插件安装事件
 */
chrome.runtime.onInstalled.addListener(function(details) {
    if (details.reason === 'install') {
        console.log('Cookie Manager 插件已安装');
    } else if (details.reason === 'update') {
        console.log('Cookie Manager 插件已更新');
    }
});

/**
 * 监听来自popup的消息
 */
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'requestPermission') {
        // 动态申请权限
        requestPermissions(request.permissions, request.origins)
            .then(granted => {
                sendResponse({ success: granted });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        return true; // 保持消息通道开放
    }
    
    if (request.action === 'checkPermissions') {
        // 检查权限状态
        checkPermissions(request.permissions, request.origins)
            .then(result => {
                sendResponse(result);
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        return true; // 保持消息通道开放
    }
});

/**
 * 动态申请权限
 * @param {Array} permissions - 要申请的权限列表
 * @param {Array} origins - 要申请的域名列表
 * @returns {Promise<boolean>} 是否成功获取权限
 */
async function requestPermissions(permissions, origins) {
    try {
        const hasPermissions = await checkPermissions(permissions, origins);
        
        if (hasPermissions.allGranted) {
            return true;
        }
        
        // 构建权限申请对象
        const permissionsToRequest = {};
        
        if (permissions && permissions.length > 0) {
            permissionsToRequest.permissions = permissions;
        }
        
        if (origins && origins.length > 0) {
            permissionsToRequest.origins = origins;
        }
        
        // 申请权限
        const granted = await chrome.permissions.request(permissionsToRequest);
        return granted;
        
    } catch (error) {
        console.error('权限申请失败:', error);
        throw error;
    }
}

/**
 * 检查权限状态
 * @param {Array} permissions - 要检查的权限列表
 * @param {Array} origins - 要检查的域名列表
 * @returns {Promise<Object>} 权限检查结果
 */
async function checkPermissions(permissions, origins) {
    try {
        const result = {
            allGranted: true,
            permissions: {},
            origins: {}
        };
        
        // 检查API权限
        if (permissions && permissions.length > 0) {
            for (const permission of permissions) {
                const hasPermission = await chrome.permissions.contains({
                    permissions: [permission]
                });
                result.permissions[permission] = hasPermission;
                if (!hasPermission) {
                    result.allGranted = false;
                }
            }
        }
        
        // 检查域名权限
        if (origins && origins.length > 0) {
            for (const origin of origins) {
                const hasPermission = await chrome.permissions.contains({
                    origins: [origin]
                });
                result.origins[origin] = hasPermission;
                if (!hasPermission) {
                    result.allGranted = false;
                }
            }
        }
        
        return result;
        
    } catch (error) {
        console.error('权限检查失败:', error);
        throw error;
    }
}

/**
 * 获取当前活动标签页的域名
 * @returns {Promise<string>} 当前标签页的域名
 */
async function getCurrentTabDomain() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url) {
            const url = new URL(tab.url);
            return url.hostname;
        }
        return null;
    } catch (error) {
        console.error('获取当前标签页域名失败:', error);
        return null;
    }
}

/**
 * 为当前域名申请Cookie权限
 * @returns {Promise<boolean>} 是否成功获取权限
 */
async function requestCookiePermissionForCurrentDomain() {
    try {
        const domain = await getCurrentTabDomain();
        if (!domain) {
            throw new Error('无法获取当前域名');
        }
        
        // 构建域名模式
        const originPattern = `*://${domain}/*`;
        
        return await requestPermissions(['cookies'], [originPattern]);
        
    } catch (error) {
        console.error('为当前域名申请Cookie权限失败:', error);
        throw error;
    }
}

/**
 * 检查当前域名的Cookie权限
 * @returns {Promise<boolean>} 是否有权限
 */
async function checkCookiePermissionForCurrentDomain() {
    try {
        const domain = await getCurrentTabDomain();
        if (!domain) {
            return false;
        }
        
        // 构建域名模式
        const originPattern = `*://${domain}/*`;
        
        const result = await checkPermissions(['cookies'], [originPattern]);
        return result.allGranted;
        
    } catch (error) {
        console.error('检查当前域名Cookie权限失败:', error);
        return false;
    }
}

// 导出函数供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        requestPermissions,
        checkPermissions,
        getCurrentTabDomain,
        requestCookiePermissionForCurrentDomain,
        checkCookiePermissionForCurrentDomain
    };
}
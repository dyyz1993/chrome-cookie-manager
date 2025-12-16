#!/usr/bin/env python3
"""
Cookie Manager 开放式服务器
简单的数据存储服务，支持Pass系统和加密数据存储
"""

from flask import Flask, request, jsonify, render_template_string, render_template, session, redirect, url_for, make_response, Response
from flask_cors import CORS
from flask_restx import Api, Resource, fields, Namespace
import sqlite3
import secrets
import string
import base64
import json
import os
import hashlib
import time
from datetime import datetime, timedelta
from contextlib import contextmanager

app = Flask(__name__)
CORS(app)

# 初始化 Flask-RESTX API
api = Api(
    app,
    version='1.0',
    title='Cookie Manager API',
    description='Cookie Manager 开放式服务器 API 文档',
    doc='/swagger/',
    prefix='/api'
)

# 配置
DATABASE_PATH = os.environ.get('DATABASE_PATH', 'database.db')
MAX_DATA_SIZE = int(os.environ.get('MAX_DATA_SIZE', 1048576))  # 1MB
MAX_VERSIONS = int(os.environ.get('MAX_VERSIONS', 10))

# 管理后台安全配置
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin')
app.secret_key = os.environ.get('SECRET_KEY', secrets.token_hex(32))

# IP限制配置
failed_attempts = {}  # {ip: {'count': int, 'last_attempt': datetime, 'blocked_until': datetime}}
MAX_FAILED_ATTEMPTS = 5
BLOCK_DURATION_MINUTES = 5

def init_database():
    """初始化数据库"""
    with sqlite3.connect(DATABASE_PATH) as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS passes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pass_id TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        conn.execute('''
            CREATE TABLE IF NOT EXISTS data_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pass_id TEXT NOT NULL,
                domain TEXT NOT NULL,
                data TEXT NOT NULL,
                size INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (pass_id) REFERENCES passes(pass_id)
            )
        ''')
        
        conn.execute('CREATE INDEX IF NOT EXISTS idx_pass_domain ON data_entries(pass_id, domain)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_created_at ON data_entries(created_at DESC)')
        conn.commit()

# ==================== API 文档配置 ====================

# 创建命名空间
ns_pass = Namespace('pass', description='Pass ID 管理相关接口')
ns_data = Namespace('data', description='数据存储相关接口')
ns_admin = Namespace('admin', description='管理员接口')

# 定义数据模型
pass_model = api.model('Pass', {
    'pass_id': fields.String(description='Pass ID'),
    'created_at': fields.String(description='创建时间'),
    'domains': fields.List(fields.String(), description='关联的域名列表')
})

data_model = api.model('Data', {
    'domain': fields.String(required=True, description='域名'),
    'data': fields.String(required=True, description='加密的数据'),
    'size': fields.Integer(description='数据大小'),
    'created_at': fields.String(description='创建时间')
})

create_pass_model = api.model('CreatePass', {
    'domain': fields.String(description='关联的域名（可选）')
})

store_data_model = api.model('StoreData', {
    'data': fields.String(required=True, description='要存储的数据'),
    'domain': fields.String(required=True, description='域名')
})

# 注册命名空间
api.add_namespace(ns_pass)
api.add_namespace(ns_data)
api.add_namespace(ns_admin)

# ==================== 安全功能 ====================

def get_client_ip():
    """获取客户端真实IP地址"""
    if request.headers.get('X-Forwarded-For'):
        return request.headers.get('X-Forwarded-For').split(',')[0].strip()
    elif request.headers.get('X-Real-IP'):
        return request.headers.get('X-Real-IP')
    else:
        return request.remote_addr

def is_ip_blocked(ip):
    """检查IP是否被阻止"""
    if ip not in failed_attempts:
        return False
    
    attempt_info = failed_attempts[ip]
    if 'blocked_until' in attempt_info:
        if datetime.now() < attempt_info['blocked_until']:
            return True
        else:
            # 阻止时间已过，清除记录
            del failed_attempts[ip]
            return False
    
    return False

def record_failed_attempt(ip):
    """记录失败的登录尝试"""
    now = datetime.now()
    
    if ip not in failed_attempts:
        failed_attempts[ip] = {'count': 1, 'last_attempt': now}
    else:
        failed_attempts[ip]['count'] += 1
        failed_attempts[ip]['last_attempt'] = now
    
    # 如果失败次数达到限制，阻止该IP
    if failed_attempts[ip]['count'] >= MAX_FAILED_ATTEMPTS:
        failed_attempts[ip]['blocked_until'] = now + timedelta(minutes=BLOCK_DURATION_MINUTES)
        print(f"IP {ip} 已被阻止 {BLOCK_DURATION_MINUTES} 分钟（失败尝试 {failed_attempts[ip]['count']} 次）")

def clear_failed_attempts(ip):
    """清除IP的失败记录（登录成功时调用）"""
    if ip in failed_attempts:
        del failed_attempts[ip]

def verify_admin_password(password):
    """验证管理员密码"""
    return password == ADMIN_PASSWORD

def require_admin_auth():
    """装饰器：要求管理员认证"""
    def decorator(f):
        def wrapper(*args, **kwargs):
            client_ip = get_client_ip()
            
            # 检查IP是否被阻止
            if is_ip_blocked(client_ip):
                blocked_until = failed_attempts[client_ip]['blocked_until']
                remaining_minutes = int((blocked_until - datetime.now()).total_seconds() / 60) + 1
                return jsonify({
                    'error': f'IP地址已被暂时阻止，请在 {remaining_minutes} 分钟后重试',
                    'blocked_until': blocked_until.isoformat(),
                    'remaining_minutes': remaining_minutes
                }), 429
            
            # 检查是否已登录
            if 'admin_authenticated' not in session or not session['admin_authenticated']:
                return jsonify({'error': '需要管理员认证', 'require_auth': True}), 401
            
            return f(*args, **kwargs)
        wrapper.__name__ = f.__name__
        return wrapper
    return decorator

@contextmanager
def get_db():
    """数据库连接上下文管理器"""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def generate_pass(length=50):
    """生成随机Pass ID"""
    chars = string.ascii_letters + string.digits
    return ''.join(secrets.choice(chars) for _ in range(length))

def server_decrypt(encrypted_data, key):
    """服务端解密函数 - 与客户端保持一致的XOR + Base64解密"""
    try:
        # 安全的Base64解码
        def safe_base64_decode(s):
            try:
                # 处理URL安全的base64和padding
                s = s.replace('-', '+').replace('_', '/')
                # 添加必要的padding
                while len(s) % 4:
                    s += '='
                decoded_bytes = base64.b64decode(s)
                return decoded_bytes.decode('utf-8', errors='ignore')
            except Exception as e:
                print(f"Base64解码失败: {e}")
                # 尝试直接URL解码
                try:
                    return urllib.parse.unquote(s)
                except:
                    return s
        
        # XOR解密
        def xor_decrypt(encrypted_text, key):
            result = ''
            for i in range(len(encrypted_text)):
                text_char = ord(encrypted_text[i])
                key_char = ord(key[i % len(key)])
                result += chr(text_char ^ key_char)
            return result
        
        # 执行解密流程
        # 1. Base64解码
        encrypted = safe_base64_decode(encrypted_data)
        
        # 2. XOR解密
        json_str = xor_decrypt(encrypted, key)
        
        # 3. 解析JSON
        return json.loads(json_str)
        
    except Exception as e:
        print(f"服务端解密失败: {e}")
        raise e

def render_decrypted_html(domain, pass_id, timestamp, decrypted_data):
    """渲染已解密数据的HTML页面"""
    html_template = '''
<!DOCTYPE html>
<html>
<head>
    <title>Cookie Data for {{ domain }} (Decrypted)</title>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f8f9fa; }
        .container { max-width: 1000px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { border-bottom: 2px solid #007bff; padding-bottom: 15px; margin-bottom: 20px; }
        .info { color: #666; font-size: 14px; background: #f8f9fa; padding: 10px; border-radius: 5px; margin: 10px 0; }
        .data-section { margin: 20px 0; }
        .data-box { background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #28a745; }
        .item { background: white; padding: 8px; margin: 5px 0; border-radius: 3px; border: 1px solid #ddd; }
        .key { font-weight: bold; color: #007bff; }
        .value { color: #333; word-break: break-all; }
        .empty { color: #999; font-style: italic; }
        .count { color: #28a745; font-weight: bold; }
        .success-badge { background: #28a745; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px; }
        details { margin: 15px 0; }
        summary { cursor: pointer; font-weight: bold; padding: 10px; background: #f8f9fa; border-radius: 5px; }
        pre { background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🍪 Cookie Data for {{ domain }} <span class="success-badge">DECRYPTED</span></h1>
        </div>
        
        <div class="info">
            <p><strong>Pass ID:</strong> {{ pass_id }}</p>
            <p><strong>Domain:</strong> {{ domain }}</p>
            <p><strong>Timestamp:</strong> {{ timestamp }}</p>
            <p><strong>Status:</strong> ✅ Successfully decrypted on server</p>
        </div>
        
        {% if cookies and cookies|length > 0 %}
        <div class="data-section">
            <div class="data-box">
                <h3>🍪 Cookies <span class="count">({{ cookies|length }} items)</span></h3>
                {% for name, value in cookies.items() %}
                <div class="item">
                    <div class="key">{{ name }}:</div>
                    <div class="value">{{ value if value else '<span class="empty">(empty)</span>' }}</div>
                </div>
                {% endfor %}
            </div>
        </div>
        {% endif %}
        
        {% if localStorage and localStorage|length > 0 %}
        <div class="data-section">
            <div class="data-box">
                <h3>💾 LocalStorage <span class="count">({{ localStorage|length }} items)</span></h3>
                {% for key, value in localStorage.items() %}
                <div class="item">
                    <div class="key">{{ key }}:</div>
                    <div class="value">
                        {% if value|length > 100 %}
                            {{ value[:100] }}... <em>({{ value|length }} chars total)</em>
                        {% else %}
                            {{ value if value else '<span class="empty">(empty)</span>' }}
                        {% endif %}
                    </div>
                </div>
                {% endfor %}
            </div>
        </div>
        {% endif %}
        
        {% if not cookies and not localStorage %}
        <div class="data-section">
            <div class="info">
                <p>No cookies or localStorage data found.</p>
            </div>
        </div>
        {% endif %}
        
        <details>
            <summary>📄 Raw JSON Data</summary>
            <pre>{{ raw_json }}</pre>
        </details>
        
        <div class="info" style="margin-top: 30px; text-align: center; font-size: 12px;">
            <p>🔒 Data was encrypted and decrypted successfully using your provided key</p>
        </div>
    </div>
</body>
</html>
    '''
    
    # 确保decrypted_data是字典类型
    if not isinstance(decrypted_data, dict):
        print(f"render_decrypted_html: decrypted_data不是字典类型: {type(decrypted_data)}")
        # 如果是字符串，尝试解析
        if isinstance(decrypted_data, str):
            try:
                decrypted_data = json.loads(decrypted_data)
            except:
                decrypted_data = {'error': 'Invalid data format'}
        else:
            decrypted_data = {'error': 'Invalid data type'}
    
    cookies = decrypted_data.get('cookies', {})
    localStorage = decrypted_data.get('localStorage', {})
    raw_json = json.dumps(decrypted_data, indent=2, ensure_ascii=False)
    
    return render_template_string(html_template,
        domain=domain,
        pass_id=pass_id,
        timestamp=timestamp,
        cookies=cookies,
        localStorage=localStorage,
        raw_json=raw_json
    )

def render_encrypted_html(domain, pass_id, timestamp, encrypted_data, decrypt_key):
    """渲染加密数据的HTML页面（客户端解密）"""
    html_template = '''
<!DOCTYPE html>
<html>
<head>
    <title>Cookie Data for {{ domain }} (Encrypted)</title>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f8f9fa; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { border-bottom: 2px solid #ffc107; padding-bottom: 15px; margin-bottom: 20px; }
        .info { color: #666; font-size: 14px; background: #f8f9fa; padding: 10px; border-radius: 5px; margin: 10px 0; }
        .data-box { background: #fff3cd; padding: 15px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #ffc107; }
        .decrypt-section { margin: 20px 0; background: #e8f5e8; padding: 15px; border-radius: 5px; border-left: 4px solid #28a745; }
        textarea { width: 100%; height: 200px; font-family: monospace; border: 1px solid #ddd; border-radius: 4px; padding: 10px; }
        .warning-badge { background: #ffc107; color: #212529; padding: 4px 8px; border-radius: 12px; font-size: 12px; }
        .success-badge { background: #28a745; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px; }
        #decrypted-data { min-height: 100px; }
        .item { background: white; padding: 8px; margin: 5px 0; border-radius: 3px; border: 1px solid #ddd; }
        .key { font-weight: bold; color: #007bff; }
        .value { color: #333; word-break: break-all; }
        .empty { color: #999; font-style: italic; }
        .count { color: #28a745; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🍪 Cookie Data for {{ domain }} 
                {% if decrypt_key %}
                    <span class="success-badge">DECRYPTING</span>
                {% else %}
                    <span class="warning-badge">ENCRYPTED</span>
                {% endif %}
            </h1>
        </div>
        
        <div class="info">
            <p><strong>Pass ID:</strong> {{ pass_id }}</p>
            <p><strong>Domain:</strong> {{ domain }}</p>
            <p><strong>Timestamp:</strong> {{ timestamp }}</p>
            <p><strong>Status:</strong> 
                {% if decrypt_key %}
                    🔓 Decrypting with provided key...
                {% else %}
                    🔒 Encrypted data (no decryption key provided)
                {% endif %}
            </p>
            <p><strong>📊 JSON数据:</strong> <a href="{{ request.url.replace('&format=html', '').replace('?format=html', '') }}" target="_blank" style="color: #007bff; text-decoration: none;">🔗 查看JSON格式</a></p>
        </div>
        
        <div class="data-box">
            <h3>🔒 Encrypted Data:</h3>
            <textarea readonly>{{ data }}</textarea>
        </div>
        
        {% if decrypt_key %}
        <div class="decrypt-section">
            <h3>🔓 Decrypted Data:</h3>
            <div id="decrypted-data">Decrypting...</div>
        </div>
        {% endif %}
        
        <script>
            // 前端解密功能
            function decryptWithKey() {
                const key = document.getElementById('decrypt-key-input').value;
                if (!key) {
                    alert('请输入解密密钥');
                    return;
                }
                
                const encryptedData = '{{ data }}';
                const decrypted = decrypt(encryptedData, key);
                
                if (decrypted) {
                    let html = '<div style="background: #e8f5e8; padding: 15px; border-radius: 5px; border: 1px solid #28a745;">';
                    html += '<h4 style="color: #28a745; margin-top: 0;">✅ 解密成功!</h4>';
                    
                    if (decrypted.cookies && Object.keys(decrypted.cookies).length > 0) {
                        html += '<h5>🍪 Cookies (' + Object.keys(decrypted.cookies).length + ' items):</h5>';
                        html += '<div style="background: white; padding: 10px; border-radius: 3px; margin: 5px 0; max-height: 200px; overflow-y: auto;">';
                        for (const [name, value] of Object.entries(decrypted.cookies)) {
                            html += '<div class="item"><span class="key">' + escapeHtml(name) + ':</span> <span class="value">' + escapeHtml(value) + '</span></div>';
                        }
                        html += '</div>';
                    }
                    
                    if (decrypted.localStorage && Object.keys(decrypted.localStorage).length > 0) {
                        html += '<h5>💾 LocalStorage (' + Object.keys(decrypted.localStorage).length + ' items):</h5>';
                        html += '<div style="background: white; padding: 10px; border-radius: 3px; margin: 5px 0; max-height: 200px; overflow-y: auto;">';
                        for (const [key, value] of Object.entries(decrypted.localStorage)) {
                            const displayValue = value.length > 100 ? value.substring(0, 100) + '... (' + value.length + ' chars)' : value;
                            html += '<div class="item"><span class="key">' + escapeHtml(key) + ':</span> <span class="value">' + escapeHtml(displayValue) + '</span></div>';
                        }
                        html += '</div>';
                    }
                    
                    if (decrypted.timestamp) {
                        html += '<div style="color: #666; font-size: 12px; margin-top: 10px;">📅 Data Timestamp: ' + new Date(decrypted.timestamp).toLocaleString() + '</div>';
                    }
                    
                    html += '</div>';
                    html += '<details style="margin-top: 15px;"><summary>📄 Raw JSON Data</summary>';
                    html += '<pre style="background: #f5f5f5; padding: 10px; border-radius: 3px; overflow-x: auto; max-height: 300px; overflow-y: auto;">' + 
                            JSON.stringify(decrypted, null, 2) + '</pre></details>';
                    
                    document.getElementById('manual-decrypted-data').innerHTML = html;
                } else {
                    document.getElementById('manual-decrypted-data').innerHTML = 
                        '<div style="background: #f8d7da; padding: 15px; border-radius: 5px; border: 1px solid #f5c6cb;"><p style="color: #721c24; margin: 0;">❌ 解密失败: 密钥错误或数据损坏</p></div>';
                }
            }
            
            function copyDecryptionScript() {
                const script = `// 解密脚本 - 可在其他地方使用
function safeBase64Decode(str) {
    try {
        return decodeURIComponent(escape(atob(str)));
    } catch (error) {
        console.error('Base64解码失败:', error);
        return str;
    }
}

function xorDecrypt(encryptedText, key) {
    let result = '';
    for (let i = 0; i < encryptedText.length; i++) {
        const textChar = encryptedText.charCodeAt(i);
        const keyChar = key.charCodeAt(i % key.length);
        result += String.fromCharCode(textChar ^ keyChar);
    }
    return result;
}

function decrypt(encryptedData, key) {
    try {
        const encrypted = safeBase64Decode(encryptedData);
        const jsonStr = xorDecrypt(encrypted, key);
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error('解密失败:', error);
        return null;
    }
}

// 使用示例:
const encryptedData = '{{ data }}';
const key = 'YOUR_ENCRYPTION_KEY'; // 替换为你的密钥
const decrypted = decrypt(encryptedData, key);
if (decrypted) {
    console.log('解密成功:', decrypted);
} else {
    console.log('解密失败');
}`;
                
                // 创建临时文本区域来复制
                const textarea = document.createElement('textarea');
                textarea.value = script;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                
                try {
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                    alert('解密脚本已复制到剪贴板！');
                } catch (err) {
                    document.body.removeChild(textarea);
                    alert('复制失败，请手动复制以下内容:\\n\\n' + script);
                }
            }
            
            // 客户端解密实现（与客户端保持一致）
            function safeBase64Decode(str) {
                try {
                    return decodeURIComponent(escape(atob(str)));
                } catch (error) {
                    console.error('Base64解码失败:', error);
                    return str;
                }
            }
            
            function xorDecrypt(encryptedText, key) {
                let result = '';
                for (let i = 0; i < encryptedText.length; i++) {
                    const textChar = encryptedText.charCodeAt(i);
                    const keyChar = key.charCodeAt(i % key.length);
                    result += String.fromCharCode(textChar ^ keyChar);
                }
                return result;
            }
            
            function decrypt(encryptedData, key) {
                try {
                    const encrypted = safeBase64Decode(encryptedData);
                    const jsonStr = xorDecrypt(encrypted, key);
                    return JSON.parse(jsonStr);
                } catch (error) {
                    console.error('解密失败:', error);
                    return null;
                }
            }
            
            function escapeHtml(text) {
                const div = document.createElement('div');
                div.textContent = text;
                return div.innerHTML;
            }
            
            // 执行客户端解密
            try {
                const encryptedData = '{{ data }}';
                const key = '{{ decrypt_key }}';
                
                const decrypted = decrypt(encryptedData, key);
                
                if (decrypted) {
                    let html = '<div style="background: #e8f5e8; padding: 15px; border-radius: 5px;">';
                    
                    if (decrypted.cookies && Object.keys(decrypted.cookies).length > 0) {
                        html += '<h4>🍪 Cookies (' + Object.keys(decrypted.cookies).length + ' items):</h4>';
                        html += '<div style="background: white; padding: 10px; border-radius: 3px; margin: 5px 0;">';
                        for (const [name, value] of Object.entries(decrypted.cookies)) {
                            html += '<div class="item"><span class="key">' + escapeHtml(name) + ':</span> <span class="value">' + escapeHtml(value) + '</span></div>';
                        }
                        html += '</div>';
                    }
                    
                    if (decrypted.localStorage && Object.keys(decrypted.localStorage).length > 0) {
                        html += '<h4>💾 LocalStorage (' + Object.keys(decrypted.localStorage).length + ' items):</h4>';
                        html += '<div style="background: white; padding: 10px; border-radius: 3px; margin: 5px 0;">';
                        for (const [key, value] of Object.entries(decrypted.localStorage)) {
                            const displayValue = value.length > 100 ? value.substring(0, 100) + '... (' + value.length + ' chars)' : value;
                            html += '<div class="item"><span class="key">' + escapeHtml(key) + ':</span> <span class="value">' + escapeHtml(displayValue) + '</span></div>';
                        }
                        html += '</div>';
                    }
                    
                    if (decrypted.timestamp) {
                        html += '<div style="color: #666; font-size: 12px; margin-top: 10px;">📅 Data Timestamp: ' + new Date(decrypted.timestamp).toLocaleString() + '</div>';
                    }
                    
                    html += '</div>';
                    html += '<details style="margin-top: 15px;"><summary>📄 Raw JSON Data</summary>';
                    html += '<pre style="background: #f5f5f5; padding: 10px; border-radius: 3px; overflow-x: auto;">' + 
                            JSON.stringify(decrypted, null, 2) + '</pre></details>';
                    
                    document.getElementById('decrypted-data').innerHTML = html;
                } else {
                    document.getElementById('decrypted-data').innerHTML = 
                        '<p style="color: red;">❌ Decryption failed: Invalid key or corrupted data</p>';
                }
            } catch (e) {
                document.getElementById('decrypted-data').innerHTML = 
                    '<p style="color: red;">❌ Decryption error: ' + e.message + '</p>';
            }
            
            // 如果有密钥，自动解密
            {% if decrypt_key %}
            try {
                const encryptedData = '{{ data }}';
                const key = '{{ decrypt_key }}';
                
                const decrypted = decrypt(encryptedData, key);
                
                if (decrypted) {
                    let html = '<div style="background: #e8f5e8; padding: 15px; border-radius: 5px;">';
                    
                    if (decrypted.cookies && Object.keys(decrypted.cookies).length > 0) {
                        html += '<h4>🍪 Cookies (' + Object.keys(decrypted.cookies).length + ' items):</h4>';
                        html += '<div style="background: white; padding: 10px; border-radius: 3px; margin: 5px 0;">';
                        for (const [name, value] of Object.entries(decrypted.cookies)) {
                            html += '<div class="item"><span class="key">' + escapeHtml(name) + ':</span> <span class="value">' + escapeHtml(value) + '</span></div>';
                        }
                        html += '</div>';
                    }
                    
                    if (decrypted.localStorage && Object.keys(decrypted.localStorage).length > 0) {
                        html += '<h4>💾 LocalStorage (' + Object.keys(decrypted.localStorage).length + ' items):</h4>';
                        html += '<div style="background: white; padding: 10px; border-radius: 3px; margin: 5px 0;">';
                        for (const [key, value] of Object.entries(decrypted.localStorage)) {
                            const displayValue = value.length > 100 ? value.substring(0, 100) + '... (' + value.length + ' chars)' : value;
                            html += '<div class="item"><span class="key">' + escapeHtml(key) + ':</span> <span class="value">' + escapeHtml(displayValue) + '</span></div>';
                        }
                        html += '</div>';
                    }
                    
                    if (decrypted.timestamp) {
                        html += '<div style="color: #666; font-size: 12px; margin-top: 10px;">📅 Data Timestamp: ' + new Date(decrypted.timestamp).toLocaleString() + '</div>';
                    }
                    
                    html += '</div>';
                    html += '<details style="margin-top: 15px;"><summary>📄 Raw JSON Data</summary>';
                    html += '<pre style="background: #f5f5f5; padding: 10px; border-radius: 3px; overflow-x: auto;">' + 
                            JSON.stringify(decrypted, null, 2) + '</pre></details>';
                    
                    document.getElementById('decrypted-data').innerHTML = html;
                } else {
                    document.getElementById('decrypted-data').innerHTML = 
                        '<p style="color: red;">❌ Decryption failed: Invalid key or corrupted data</p>';
                }
            } catch (e) {
                document.getElementById('decrypted-data').innerHTML = 
                    '<p style="color: red;">❌ Decryption error: ' + e.message + '</p>';
            }
            {% endif %}
        </script>
        
        {% if not decrypt_key %}
        <div class="decrypt-section">
            <h3>🔓 前端解密工具</h3>
            <div style="margin-bottom: 15px;">
                <label for="decrypt-key-input" style="display: block; margin-bottom: 5px; font-weight: bold;">输入解密密钥:</label>
                <input type="text" id="decrypt-key-input" placeholder="请输入解密密钥" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                <button onclick="decryptWithKey()" style="margin-top: 10px; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">🔓 解密数据</button>
                <button onclick="copyDecryptionScript()" style="margin-top: 10px; margin-left: 10px; padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">📋 复制解密脚本</button>
            </div>
            <div id="manual-decrypted-data" style="margin-top: 15px;"></div>
        </div>
        
        <div class="info" style="background: #fff3cd; border-left: 4px solid #ffc107;">
            <p><strong>🔒 Data is encrypted</strong></p>
            <p>或者直接在URL中添加key参数:</p>
            <p><code>{{ request.url }}&key=YOUR_ENCRYPTION_KEY</code></p>
        </div>
        {% endif %}
        
        <div class="info" style="margin-top: 30px; text-align: center; font-size: 12px;">
            <p>🔐 This data is encrypted for security. Only users with the correct key can decrypt it.</p>
        </div>
    </div>
</body>
</html>
    '''
    
    return render_template_string(html_template,
        domain=domain,
        pass_id=pass_id,
        timestamp=timestamp,
        data=encrypted_data,
        decrypt_key=decrypt_key,
        request=request
    )

def cleanup_old_versions(pass_id, domain):
    """清理旧版本，保留最新的MAX_VERSIONS个"""
    with get_db() as conn:
        # 获取该域名下的所有版本，按时间倒序
        versions = conn.execute('''
            SELECT id FROM data_entries 
            WHERE pass_id = ? AND domain = ? 
            ORDER BY created_at DESC
        ''', (pass_id, domain)).fetchall()
        
        if len(versions) > MAX_VERSIONS:
            # 删除超出限制的旧版本
            old_versions = versions[MAX_VERSIONS:]
            for version in old_versions:
                conn.execute('DELETE FROM data_entries WHERE id = ?', (version['id'],))
        
        conn.commit()

# ==================== API端点 ====================

@app.route('/health')
def health():
    """健康检查"""
    return jsonify({
        'status': 'ok',
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'version': '1.0.0'
    })

@ns_pass.route('/create')
class CreatePass(Resource):
    @ns_pass.doc('create_pass')
    @ns_pass.expect(create_pass_model)
    @ns_pass.marshal_with(pass_model)
    @ns_pass.response(201, 'Pass ID 创建成功')
    @ns_pass.response(400, '请求参数错误')
    @ns_pass.response(500, '服务器内部错误')
    def post(self):
        """创建新的Pass ID"""
        try:
            data = request.get_json() or {}
            domain = data.get('domain', '')
            
            # 生成Pass ID
            pass_id = generate_pass()
            
            # 存储到数据库
            with get_db() as conn:
                conn.execute(
                    'INSERT INTO passes (pass_id) VALUES (?)',
                    (pass_id,)
                )
                conn.commit()
            
            return {
                'pass_id': pass_id,
                'created_at': datetime.utcnow().isoformat() + 'Z'
            }, 201
        
        except Exception as e:
            return {'error': str(e)}, 500


@app.route('/api/pass/create', methods=['POST'])
def create_pass_legacy():
    """创建新的Pass ID（兼容旧接口）"""
    try:
        data = request.get_json() or {}
        domain = data.get('domain', '')
        
        # 生成Pass ID
        pass_id = generate_pass()
        
        # 存储到数据库
        with get_db() as conn:
            conn.execute(
                'INSERT INTO passes (pass_id) VALUES (?)',
                (pass_id,)
            )
            conn.commit()
        
        return jsonify({
            'pass': pass_id,
            'created_at': datetime.utcnow().isoformat() + 'Z'
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@ns_pass.route('/<string:pass_id>/check')
class CheckPass(Resource):
    @ns_pass.doc('check_pass')
    @ns_pass.marshal_with(pass_model)
    @ns_pass.response(200, 'Pass 检查成功')
    @ns_pass.response(404, 'Pass 不存在')
    @ns_pass.response(500, '服务器内部错误')
    def get(self, pass_id):
        """验证Pass是否存在"""
        try:
            with get_db() as conn:
                # 检查Pass是否存在
                pass_info = conn.execute(
                    'SELECT created_at FROM passes WHERE pass_id = ?',
                    (pass_id,)
                ).fetchone()
                
                if not pass_info:
                    return {'exists': False}, 404
                
                # 获取该Pass下的所有域名
                domains = conn.execute('''
                    SELECT DISTINCT domain FROM data_entries WHERE pass_id = ?
                ''', (pass_id,)).fetchall()
                
                return {
                    'pass_id': pass_id,
                    'exists': True,
                    'created_at': pass_info['created_at'],
                    'domains': [row['domain'] for row in domains]
                }
        
        except Exception as e:
            return {'error': str(e)}, 500


@app.route('/api/pass/<pass_id>/check')
def check_pass_legacy(pass_id):
    """验证Pass是否存在（兼容旧接口）"""
    try:
        with get_db() as conn:
            # 检查Pass是否存在
            pass_info = conn.execute(
                'SELECT created_at FROM passes WHERE pass_id = ?',
                (pass_id,)
            ).fetchone()
            
            if not pass_info:
                return jsonify({'exists': False})
            
            # 获取该Pass下的所有域名
            domains = conn.execute('''
                SELECT DISTINCT domain FROM data_entries WHERE pass_id = ?
            ''', (pass_id,)).fetchall()
            
            return jsonify({
                'exists': True,
                'created_at': pass_info['created_at'],
                'domains': [row['domain'] for row in domains]
            })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@ns_data.route('/<string:pass_id>')
class SaveData(Resource):
    @ns_data.doc('save_data')
    @ns_data.expect(store_data_model)
    @ns_data.response(201, '数据保存成功')
    @ns_data.response(400, '请求参数错误')
    @ns_data.response(404, 'Pass ID 不存在')
    @ns_data.response(500, '服务器内部错误')
    def post(self, pass_id):
        """保存数据"""
        try:
            domain = request.args.get('domain')
            if not domain:
                return {'error': 'Missing domain parameter'}, 400
                
            data = request.get_json()
            if not data or 'data' not in data:
                return {'error': 'Missing data field'}, 400
            
            encrypted_data = data['data']
            
            # 检查数据大小
            data_size = len(encrypted_data.encode('utf-8'))
            if data_size > MAX_DATA_SIZE:
                return {'error': f'Data too large. Max size: {MAX_DATA_SIZE} bytes'}, 400
            
            # 验证Pass是否存在
            with get_db() as conn:
                pass_exists = conn.execute(
                    'SELECT 1 FROM passes WHERE pass_id = ?',
                    (pass_id,)
                ).fetchone()
                
                if not pass_exists:
                    return {'error': 'Invalid pass ID'}, 404
                
                # 保存数据
                cursor = conn.execute('''
                    INSERT INTO data_entries (pass_id, domain, data, size)
                    VALUES (?, ?, ?, ?)
                ''', (pass_id, domain, encrypted_data, data_size))
                
                conn.commit()
                
                # 清理旧版本
                cleanup_old_versions(pass_id, domain)
                
                return {
                    'success': True,
                    'id': f'data_{cursor.lastrowid}',
                    'timestamp': datetime.utcnow().isoformat() + 'Z'
                }, 201
        
        except Exception as e:
            return {'error': str(e)}, 500


@app.route('/api/data/<pass_id>', methods=['POST'])
def save_data_legacy(pass_id):
    """保存数据（兼容旧接口）"""
    try:
        domain = request.args.get('domain')
        if not domain:
            return jsonify({'error': 'Missing domain parameter'}), 400
            
        data = request.get_json()
        if not data or 'data' not in data:
            return jsonify({'error': 'Missing data field'}), 400
        
        encrypted_data = data['data']
        
        # 检查数据大小
        data_size = len(encrypted_data.encode('utf-8'))
        if data_size > MAX_DATA_SIZE:
            return jsonify({'error': f'Data too large. Max size: {MAX_DATA_SIZE} bytes'}), 400
        
        # 验证Pass是否存在
        with get_db() as conn:
            pass_exists = conn.execute(
                'SELECT 1 FROM passes WHERE pass_id = ?',
                (pass_id,)
            ).fetchone()
            
            if not pass_exists:
                return jsonify({'error': 'Invalid pass ID'}), 404
            
            # 保存数据
            cursor = conn.execute('''
                INSERT INTO data_entries (pass_id, domain, data, size)
                VALUES (?, ?, ?, ?)
            ''', (pass_id, domain, encrypted_data, data_size))
            
            conn.commit()
            
            # 清理旧版本
            cleanup_old_versions(pass_id, domain)
            
            return jsonify({
                'success': True,
                'id': f'data_{cursor.lastrowid}',
                'timestamp': datetime.utcnow().isoformat() + 'Z'
            })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@ns_data.route('/<string:pass_id>')
class GetData(Resource):
    @ns_data.doc('get_data')
    @ns_data.marshal_with(data_model)
    @ns_data.response(200, '数据获取成功')
    @ns_data.response(400, '请求参数错误')
    @ns_data.response(404, '数据未找到')
    @ns_data.response(500, '服务器内部错误')
    def get(self, pass_id):
        """获取最新数据"""
        try:
            domain = request.args.get('domain')
            if not domain:
                return {'error': 'Missing domain parameter'}, 400
            with get_db() as conn:
                # 获取最新数据
                data_entry = conn.execute('''
                    SELECT id, data, created_at FROM data_entries
                    WHERE pass_id = ? AND domain = ?
                    ORDER BY created_at DESC
                    LIMIT 1
                ''', (pass_id, domain)).fetchone()
                
                if not data_entry:
                    return {'error': 'No data found'}, 404
                
                return {
                    'data': data_entry['data'],
                    'timestamp': data_entry['created_at'],
                    'id': f'data_{data_entry["id"]}'
                }
        
        except Exception as e:
            return {'error': str(e)}, 500


@app.route('/api/data/<pass_id>')
def get_data_legacy(pass_id):
    """获取最新数据（兼容旧接口）"""
    try:
        domain = request.args.get('domain')
        if not domain:
            return jsonify({'error': 'Missing domain parameter'}), 400
        with get_db() as conn:
            # 获取最新数据
            data_entry = conn.execute('''
                SELECT id, data, created_at FROM data_entries
                WHERE pass_id = ? AND domain = ?
                ORDER BY created_at DESC
                LIMIT 1
            ''', (pass_id, domain)).fetchone()
            
            if not data_entry:
                return jsonify({'error': 'No data found'}), 404
            
            return jsonify({
                'data': data_entry['data'],
                'timestamp': data_entry['created_at'],
                'id': f'data_{data_entry["id"]}'
            })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@ns_data.route('/<string:pass_id>/versions')
class GetVersions(Resource):
    @ns_data.doc('get_versions')
    @ns_data.response(200, '版本列表获取成功')
    @ns_data.response(400, '请求参数错误')
    @ns_data.response(500, '服务器内部错误')
    def get(self, pass_id):
        """获取历史版本"""
        try:
            domain = request.args.get('domain')
            if not domain:
                return {'error': 'Missing domain parameter'}, 400
                
            limit = request.args.get('limit', 5, type=int)
            limit = min(limit, MAX_VERSIONS)  # 限制最大返回数量
            
            with get_db() as conn:
                versions = conn.execute('''
                    SELECT id, created_at, size FROM data_entries
                    WHERE pass_id = ? AND domain = ?
                    ORDER BY created_at DESC
                    LIMIT ?
                ''', (pass_id, domain, limit)).fetchall()
                
                return {
                    'versions': [
                        {
                            'id': f'data_{row["id"]}',
                            'timestamp': row['created_at'],
                            'size': row['size']
                        }
                        for row in versions
                    ]
                }
        
        except Exception as e:
            return {'error': str(e)}, 500


@app.route('/api/data/<pass_id>/versions')
def get_versions_legacy(pass_id):
    """获取历史版本（兼容旧接口）"""
    try:
        domain = request.args.get('domain')
        if not domain:
            return jsonify({'error': 'Missing domain parameter'}), 400
            
        limit = request.args.get('limit', 5, type=int)
        limit = min(limit, MAX_VERSIONS)  # 限制最大返回数量
        
        with get_db() as conn:
            versions = conn.execute('''
                SELECT id, created_at, size FROM data_entries
                WHERE pass_id = ? AND domain = ?
                ORDER BY created_at DESC
                LIMIT ?
            ''', (pass_id, domain, limit)).fetchall()
            
            return jsonify({
                'versions': [
                    {
                        'id': f'data_{row["id"]}',
                        'timestamp': row['created_at'],
                        'size': row['size']
                    }
                    for row in versions
                ]
            })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@ns_data.route('/<string:pass_id>')
class DeleteData(Resource):
    @ns_data.doc('delete_data')
    @ns_data.response(200, '数据删除成功')
    @ns_data.response(400, '请求参数错误')
    @ns_data.response(500, '服务器内部错误')
    def delete(self, pass_id):
        """删除数据"""
        try:
            domain = request.args.get('domain')
            if not domain:
                return {'error': 'Missing domain parameter'}, 400
                
            version_id = request.args.get('version_id')
            
            with get_db() as conn:
                if version_id:
                    # 删除特定版本
                    result = conn.execute('''
                        DELETE FROM data_entries 
                        WHERE pass_id = ? AND domain = ? AND id = ?
                    ''', (pass_id, domain, version_id.replace('data_', '')))
                else:
                    # 删除所有版本
                    result = conn.execute('''
                        DELETE FROM data_entries 
                        WHERE pass_id = ? AND domain = ?
                    ''', (pass_id, domain))
                
                conn.commit()
                
                return {
                    'success': True,
                    'deleted_count': result.rowcount
                }
        
        except Exception as e:
            return {'error': str(e)}, 500


@app.route('/api/data/<pass_id>', methods=['DELETE'])
def delete_data_legacy(pass_id):
    """删除数据（兼容旧接口）"""
    try:
        domain = request.args.get('domain')
        if not domain:
            return jsonify({'error': 'Missing domain parameter'}), 400
            
        version_id = request.args.get('version_id')
        
        with get_db() as conn:
            if version_id:
                # 删除特定版本
                result = conn.execute('''
                    DELETE FROM data_entries 
                    WHERE pass_id = ? AND domain = ? AND id = ?
                ''', (pass_id, domain, version_id.replace('data_', '')))
            else:
                # 删除所有版本
                result = conn.execute('''
                    DELETE FROM data_entries 
                    WHERE pass_id = ? AND domain = ?
                ''', (pass_id, domain))
            
            conn.commit()
            
            return jsonify({
                'success': True,
                'deleted_count': result.rowcount
            })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# 快速同步相关的命名空间
ns_quick = api.namespace('quick', description='快速同步操作')

@ns_quick.route('/<string:pass_id>')
class QuickAccess(Resource):
    @ns_quick.doc('quick_access')
    @ns_quick.param('domain', '域名', required=True)
    @ns_quick.param('format', '返回格式 (json/html)', default='json')
    @ns_quick.param('key', '解密密钥（可选）')
    @ns_quick.response(200, '成功获取数据')
    @ns_quick.response(400, '请求参数错误')
    @ns_quick.response(404, '未找到数据')
    @ns_quick.response(500, '服务器内部错误')
    def get(self, pass_id):
        """快捷访问 - 支持HTML和JSON格式，服务端解密"""
        try:
            domain = request.args.get('domain')
            if not domain:
                return jsonify({'error': 'Missing domain parameter'}), 400
                
            format_type = request.args.get('format', 'json')
            decrypt_key = request.args.get('key', '')
            
            with get_db() as conn:
                data_entry = conn.execute('''
                    SELECT data, created_at FROM data_entries
                    WHERE pass_id = ? AND domain = ?
                    ORDER BY created_at DESC
                    LIMIT 1
                ''', (pass_id, domain)).fetchone()
                
                if not data_entry:
                    if format_type == 'html':
                        return Response('<h1>No data found</h1>', status=404, mimetype='text/html')
                    return jsonify({'error': 'No data found'}), 404
                
                encrypted_data = data_entry['data']
                timestamp = data_entry['created_at']
                
                # 如果提供了解密密钥，在服务端解密
                decrypted_data = None
                if decrypt_key:
                    try:
                        decrypted_data = server_decrypt(encrypted_data, decrypt_key)
                        print(f"解密成功，数据类型: {type(decrypted_data)}")
                        
                        # 确保解密后的数据是字典类型
                        if isinstance(decrypted_data, str):
                            print(f"解密结果是字符串，尝试解析JSON: {decrypted_data[:100]}...")
                            decrypted_data = json.loads(decrypted_data)
                        elif not isinstance(decrypted_data, dict):
                            print(f"解密结果不是字典类型: {type(decrypted_data)}")
                            decrypted_data = None
                            
                    except Exception as e:
                        print(f"服务端解密失败: {e}")
                        print(f"加密数据预览: {encrypted_data[:100]}...")
                        print(f"解密密钥: {decrypt_key}")
                        decrypted_data = None
                
                # 根据格式返回不同响应
                if format_type == 'json':
                    if decrypted_data:
                        # 返回解密后的JSON数据
                        return jsonify({
                            'success': True,
                            'domain': domain,
                            'pass_id': pass_id,
                            'timestamp': timestamp,
                            'decrypted': True,
                            'data': decrypted_data
                        })
                    else:
                        # 返回加密数据
                        return jsonify({
                            'success': True,
                            'domain': domain,
                            'pass_id': pass_id,
                            'timestamp': timestamp,
                            'decrypted': False,
                            'encrypted_data': encrypted_data,
                            'message': 'No decryption key provided or decryption failed'
                        })
                else:
                    # HTML格式 - 如果有解密数据，直接显示；否则显示加密数据和客户端解密界面
                    if decrypted_data:
                        html_content = render_decrypted_html(domain, pass_id, timestamp, decrypted_data)
                        # 使用Flask-RESTX兼容的方式返回HTML
                        return Response(html_content, status=200, mimetype='text/html')
                    else:
                        html_content = render_encrypted_html(domain, pass_id, timestamp, encrypted_data, decrypt_key)
                        # 使用Flask-RESTX兼容的方式返回HTML
                        return Response(html_content, status=200, mimetype='text/html')
        
        except Exception as e:
            if format_type == 'html':
                return Response(f'<h1>Error: {str(e)}</h1>', status=500, mimetype='text/html')
            else:
                return jsonify({'error': str(e)}), 500



# 保持原有端点的向后兼容性
@app.route('/api/quick/<pass_id>')
def quick_access_legacy(pass_id):
    """快捷访问 - 支持HTML和JSON格式，服务端解密（向后兼容）"""
    return QuickAccess().get(pass_id)





# 统计相关的命名空间
ns_stats = api.namespace('stats', description='统计信息')

@ns_stats.route('/<string:pass_id>')
class GetPassStats(Resource):
    @ns_stats.doc('get_pass_stats')
    @ns_stats.response(200, '成功获取统计信息')
    @ns_stats.response(404, 'Pass不存在')
    @ns_stats.response(500, '服务器内部错误')
    def get(self, pass_id):
        """获取Pass统计信息"""
        try:
            with get_db() as conn:
                # 检查Pass是否存在
                pass_info = conn.execute(
                    'SELECT created_at FROM passes WHERE pass_id = ?',
                    (pass_id,)
                ).fetchone()
                
                if not pass_info:
                    return jsonify({'error': 'Pass not found'}), 404
                
                # 获取统计信息
                stats = conn.execute('''
                    SELECT 
                        COUNT(DISTINCT domain) as domain_count,
                        SUM(size) as total_size,
                        MAX(created_at) as last_activity
                    FROM data_entries 
                    WHERE pass_id = ?
                ''', (pass_id,)).fetchone()
                
                # 获取域名详情
                domains = conn.execute('''
                    SELECT 
                        domain,
                        COUNT(*) as version_count,
                        SUM(size) as size,
                        MAX(created_at) as last_modified
                    FROM data_entries 
                    WHERE pass_id = ?
                    GROUP BY domain
                ''', (pass_id,)).fetchall()
                
                return jsonify({
                    'pass': pass_id,
                    'domain_count': stats['domain_count'] or 0,
                    'total_size': stats['total_size'] or 0,
                    'last_activity': stats['last_activity'],
                    'domains': [
                        {
                            'domain': row['domain'],
                            'version_count': row['version_count'],
                            'size': row['size'],
                            'last_modified': row['last_modified']
                        }
                        for row in domains
                    ]
                })
        
        except Exception as e:
            return jsonify({'error': str(e)}), 500

# 保持原有端点的向后兼容性
@app.route('/api/stats/<pass_id>')
def get_pass_stats_legacy(pass_id):
    """获取Pass统计信息（向后兼容）"""
    return GetPassStats().get(pass_id)

@ns_stats.route('/server')
class GetServerStats(Resource):
    @ns_stats.doc('get_server_stats')
    @ns_stats.response(200, '成功获取服务器统计信息')
    @ns_stats.response(500, '服务器内部错误')
    def get(self):
        """获取服务器统计信息"""
        try:
            with get_db() as conn:
                stats = conn.execute('''
                    SELECT 
                        (SELECT COUNT(*) FROM passes) as total_passes,
                        (SELECT COUNT(DISTINCT domain) FROM data_entries) as total_domains,
                        (SELECT SUM(size) FROM data_entries) as total_size
                ''').fetchone()
                
                return jsonify({
                    'total_passes': stats['total_passes'] or 0,
                    'total_domains': stats['total_domains'] or 0,
                    'total_size_bytes': stats['total_size'] or 0,
                    'total_size_mb': round((stats['total_size'] or 0) / 1024 / 1024, 2),
                    'max_data_size_mb': round(MAX_DATA_SIZE / 1024 / 1024, 2),
                    'max_versions_per_domain': MAX_VERSIONS
                })
        
        except Exception as e:
            return jsonify({'error': str(e)}), 500

# 保持原有端点的向后兼容性
@app.route('/api/stats/server')
def get_server_stats_legacy():
    """获取服务器统计信息（向后兼容）"""
    return GetServerStats().get()

# ==================== 管理后台 ====================

@app.route('/admin')
def admin_page():
    """管理后台页面"""
    client_ip = get_client_ip()
    
    # 检查IP是否被阻止
    if is_ip_blocked(client_ip):
        blocked_until = failed_attempts[client_ip]['blocked_until']
        remaining_minutes = int((blocked_until - datetime.now()).total_seconds() / 60) + 1
        return f'''
        <html>
        <head><title>访问被阻止</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; margin-top: 100px;">
            <h1>🚫 访问被暂时阻止</h1>
            <p>由于多次登录失败，您的IP地址已被暂时阻止。</p>
            <p>请在 <strong>{remaining_minutes}</strong> 分钟后重试。</p>
            <p>阻止时间到: {blocked_until.strftime("%Y-%m-%d %H:%M:%S")}</p>
        </body>
        </html>
        ''', 429
    
    # 检查是否已登录
    if 'admin_authenticated' not in session or not session['admin_authenticated']:
        return render_admin_login()
    
    return render_template('admin.html')

@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    """管理员登录"""
    client_ip = get_client_ip()
    
    # 检查IP是否被阻止
    if is_ip_blocked(client_ip):
        blocked_until = failed_attempts[client_ip]['blocked_until']
        remaining_minutes = int((blocked_until - datetime.now()).total_seconds() / 60) + 1
        return jsonify({
            'success': False,
            'error': f'IP地址已被暂时阻止，请在 {remaining_minutes} 分钟后重试',
            'blocked_until': blocked_until.isoformat(),
            'remaining_minutes': remaining_minutes
        }), 429
    
    if request.method == 'GET':
        return render_admin_login()
    
    # POST请求 - 处理登录
    data = request.get_json() or {}
    password = data.get('password', '')
    
    if verify_admin_password(password):
        # 登录成功
        session['admin_authenticated'] = True
        session['admin_login_time'] = datetime.now().isoformat()
        clear_failed_attempts(client_ip)
        print(f"管理员从IP {client_ip} 成功登录")
        return jsonify({'success': True, 'message': '登录成功'})
    else:
        # 登录失败
        record_failed_attempt(client_ip)
        attempts_left = MAX_FAILED_ATTEMPTS - failed_attempts.get(client_ip, {}).get('count', 0)
        
        print(f"管理员登录失败，IP: {client_ip}, 剩余尝试次数: {attempts_left}")
        
        if attempts_left <= 0:
            return jsonify({
                'success': False,
                'error': f'密码错误次数过多，IP已被阻止 {BLOCK_DURATION_MINUTES} 分钟',
                'blocked': True
            }), 429
        else:
            return jsonify({
                'success': False,
                'error': f'密码错误，还有 {attempts_left} 次尝试机会',
                'attempts_left': attempts_left
            }), 401

@app.route('/admin/logout', methods=['POST'])
def admin_logout():
    """管理员登出"""
    session.pop('admin_authenticated', None)
    session.pop('admin_login_time', None)
    return jsonify({'success': True, 'message': '已登出'})

def render_admin_login():
    """渲染管理员登录页面"""
    client_ip = get_client_ip()
    attempts_info = failed_attempts.get(client_ip, {})
    attempts_left = MAX_FAILED_ATTEMPTS - attempts_info.get('count', 0)
    
    html_template = '''
<!DOCTYPE html>
<html>
<head>
    <title>管理员登录 - Cookie Manager</title>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        .login-container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            width: 100%;
            max-width: 400px;
        }
        .login-header {
            text-align: center;
            margin-bottom: 30px;
        }
        .login-header h1 {
            color: #333;
            margin: 0;
            font-size: 24px;
        }
        .login-header p {
            color: #666;
            margin: 10px 0 0 0;
            font-size: 14px;
        }
        .form-group {
            margin-bottom: 20px;
        }
        .form-group label {
            display: block;
            margin-bottom: 5px;
            color: #333;
            font-weight: bold;
        }
        .form-group input {
            width: 100%;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 16px;
            box-sizing: border-box;
        }
        .form-group input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 5px rgba(102, 126, 234, 0.3);
        }
        .login-btn {
            width: 100%;
            padding: 12px;
            background: #667eea;
            color: white;
            border: none;
            border-radius: 5px;
            font-size: 16px;
            cursor: pointer;
            transition: background 0.3s;
        }
        .login-btn:hover {
            background: #5a6fd8;
        }
        .login-btn:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        .message {
            margin-top: 15px;
            padding: 10px;
            border-radius: 5px;
            text-align: center;
        }
        .error {
            background: #fee;
            color: #c33;
            border: 1px solid #fcc;
        }
        .success {
            background: #efe;
            color: #3c3;
            border: 1px solid #cfc;
        }
        .info {
            background: #eef;
            color: #33c;
            border: 1px solid #ccf;
        }
        .attempts-info {
            text-align: center;
            margin-top: 15px;
            font-size: 12px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="login-header">
            <h1>🍪 Cookie Manager</h1>
            <p>管理后台登录</p>
        </div>
        
        <form id="loginForm">
            <div class="form-group">
                <label for="password">管理员密码:</label>
                <input type="password" id="password" name="password" required autocomplete="current-password">
            </div>
            
            <div class="form-group" style="margin-bottom: 25px;">
                <label style="display: flex; align-items: center; font-weight: normal; cursor: pointer;">
                    <input type="checkbox" id="rememberPassword" name="rememberPassword" style="width: auto; margin-right: 8px;">
                    记住密码（本地存储）
                </label>
            </div>
            
            <button type="submit" class="login-btn" id="loginBtn">登录</button>
        </form>
        
        <div id="message" class="message" style="display: none;"></div>
        
        {% if attempts_left < 5 %}
        <div class="attempts-info">
            ⚠️ 剩余尝试次数: {{ attempts_left }}
        </div>
        {% endif %}
    </div>
    
    <script>
        // 密码本地存储管理
        const PasswordManager = {
            // 保存密码到 localStorage
            savePassword: function(password) {
                try {
                    localStorage.setItem('admin_password', password);
                    console.log('密码已保存到本地存储');
                } catch (error) {
                    console.warn('无法保存密码到本地存储:', error);
                }
            },
            
            // 从 localStorage 获取密码
            getPassword: function() {
                try {
                    return localStorage.getItem('admin_password');
                } catch (error) {
                    console.warn('无法从本地存储获取密码:', error);
                    return null;
                }
            },
            
            // 清除保存的密码
            clearPassword: function() {
                try {
                    localStorage.removeItem('admin_password');
                    console.log('已清除本地存储的密码');
                } catch (error) {
                    console.warn('无法清除本地存储的密码:', error);
                }
            }
        };
        
        document.getElementById('loginForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const password = document.getElementById('password').value;
            const loginBtn = document.getElementById('loginBtn');
            const messageDiv = document.getElementById('message');
            const rememberCheckbox = document.getElementById('rememberPassword');
            
            loginBtn.disabled = true;
            loginBtn.textContent = '登录中...';
            
            try {
                const response = await fetch('/admin/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ password: password })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    // 如果勾选了记住密码，则保存到本地存储
                    if (rememberCheckbox && rememberCheckbox.checked) {
                        PasswordManager.savePassword(password);
                    }
                    
                    messageDiv.className = 'message success';
                    messageDiv.textContent = result.message;
                    messageDiv.style.display = 'block';
                    
                    setTimeout(() => {
                        window.location.href = '/admin';
                    }, 1000);
                } else {
                    messageDiv.className = 'message error';
                    messageDiv.textContent = result.error;
                    messageDiv.style.display = 'block';
                    
                    // 登录失败时清除保存的密码
                    PasswordManager.clearPassword();
                    
                    if (result.blocked) {
                        loginBtn.textContent = '已被阻止';
                        setTimeout(() => {
                            window.location.reload();
                        }, 3000);
                    } else {
                        loginBtn.disabled = false;
                        loginBtn.textContent = '登录';
                        document.getElementById('password').value = '';
                        document.getElementById('password').focus();
                    }
                }
            } catch (error) {
                messageDiv.className = 'message error';
                messageDiv.textContent = '登录请求失败: ' + error.message;
                messageDiv.style.display = 'block';
                
                loginBtn.disabled = false;
                loginBtn.textContent = '登录';
            }
        });
        
        // 页面加载时的初始化
        document.addEventListener('DOMContentLoaded', function() {
            const passwordInput = document.getElementById('password');
            const rememberCheckbox = document.getElementById('rememberPassword');
            
            // 尝试从本地存储恢复密码
            const savedPassword = PasswordManager.getPassword();
            if (savedPassword) {
                passwordInput.value = savedPassword;
                if (rememberCheckbox) {
                    rememberCheckbox.checked = true;
                }
                console.log('已从本地存储恢复密码');
            }
            
            // 自动聚焦密码输入框
            passwordInput.focus();
            passwordInput.select();
        });
    </script>
</body>
</html>
    '''
    
    return render_template_string(html_template, attempts_left=attempts_left)

# 管理员相关的命名空间
ns_admin = api.namespace('admin', description='管理员操作')

@ns_admin.route('/passes')
class GetAllPasses(Resource):
    @ns_admin.doc('get_all_passes')
    @ns_admin.response(200, '成功获取Pass列表')
    @ns_admin.response(401, '未授权访问')
    @ns_admin.response(403, '权限不足')
    @ns_admin.response(500, '服务器内部错误')
    @require_admin_auth()
    def get(self):
        """获取所有Pass列表（管理后台用）"""
        try:
            with get_db() as conn:
                # 获取所有Pass及其统计信息
                passes = conn.execute('''
                    SELECT 
                        p.pass_id,
                        p.created_at,
                        COUNT(DISTINCT d.domain) as domain_count,
                        SUM(d.size) as total_size,
                        MAX(d.created_at) as last_activity
                    FROM passes p
                    LEFT JOIN data_entries d ON p.pass_id = d.pass_id
                    GROUP BY p.pass_id, p.created_at
                    ORDER BY p.created_at DESC
                ''').fetchall()
                
                result = []
                for pass_row in passes:
                    # 获取该Pass的域名列表
                    domains = conn.execute('''
                        SELECT 
                            domain,
                            COUNT(*) as version_count,
                            SUM(size) as size,
                            MAX(created_at) as last_modified
                        FROM data_entries 
                        WHERE pass_id = ?
                        GROUP BY domain
                        ORDER BY last_modified DESC
                    ''', (pass_row['pass_id'],)).fetchall()
                    
                    result.append({
                        'pass_id': pass_row['pass_id'],
                        'created_at': pass_row['created_at'],
                        'domain_count': pass_row['domain_count'] or 0,
                        'total_size': pass_row['total_size'] or 0,
                        'last_activity': pass_row['last_activity'],
                        'domains': [
                            {
                                'domain': domain['domain'],
                                'version_count': domain['version_count'],
                                'size': domain['size'],
                                'last_modified': domain['last_modified']
                            }
                            for domain in domains
                        ]
                    })
                
                return jsonify(result)
        
        except Exception as e:
            return jsonify({'error': str(e)}), 500

# 保持原有端点的向后兼容性
@app.route('/api/admin/passes')
@require_admin_auth()
def get_all_passes_legacy():
    """获取所有Pass列表（管理后台用）（向后兼容）"""
    return GetAllPasses().get()

@ns_admin.route('/passes/<string:pass_id>')
class DeletePassAdmin(Resource):
    @ns_admin.doc('delete_pass_admin')
    @ns_admin.response(200, '成功删除Pass')
    @ns_admin.response(401, '未授权访问')
    @ns_admin.response(403, '权限不足')
    @ns_admin.response(404, 'Pass不存在')
    @ns_admin.response(500, '服务器内部错误')
    @require_admin_auth()
    def delete(self, pass_id):
        """删除Pass及其所有数据（管理后台用）"""
        try:
            with get_db() as conn:
                # 检查Pass是否存在
                pass_exists = conn.execute(
                    'SELECT 1 FROM passes WHERE pass_id = ?',
                    (pass_id,)
                ).fetchone()
                
                if not pass_exists:
                    return jsonify({'error': 'Pass not found'}), 404
                
                # 删除所有相关数据
                data_result = conn.execute(
                    'DELETE FROM data_entries WHERE pass_id = ?',
                    (pass_id,)
                )
                
                # 删除Pass记录
                pass_result = conn.execute(
                    'DELETE FROM passes WHERE pass_id = ?',
                    (pass_id,)
                )
                
                conn.commit()
                
                return jsonify({
                    'success': True,
                    'deleted_data_entries': data_result.rowcount,
                    'deleted_pass': pass_result.rowcount > 0
                })
        
        except Exception as e:
            return jsonify({'error': str(e)}), 500

# 保持原有端点的向后兼容性
@app.route('/api/admin/passes/<pass_id>', methods=['DELETE'])
@require_admin_auth()
def delete_pass_admin_legacy(pass_id):
    """删除Pass及其所有数据（管理后台用）（向后兼容）"""
    return DeletePassAdmin().delete(pass_id)

# ==================== 错误处理 ====================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

# ==================== 启动应用 ====================

if __name__ == '__main__':
    # 初始化数据库
    init_database()
    
    # 启动应用
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    
    print(f"🚀 Cookie Manager Server starting on port {port}")
    print(f"📊 Database: {DATABASE_PATH}")
    print(f"💾 Max data size: {MAX_DATA_SIZE / 1024 / 1024:.1f}MB")
    print(f"📚 Max versions per domain: {MAX_VERSIONS}")
    
    app.run(host='0.0.0.0', port=port, debug=debug)
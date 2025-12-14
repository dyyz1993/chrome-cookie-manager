# 🚀 简化版Cookie Manager服务器API

## 🎯 设计原则
- **开放式**: 任何人都可以使用，无需注册
- **Pass系统**: 通过随机Pass ID进行数据隔离  
- **客户端加密**: 服务器只存储加密数据
- **简单CRUD**: 只做基础增删改查

## 📡 API端点

### 1. 健康检查
```http
GET /health
```
```json
{
  "status": "ok",
  "timestamp": "2024-12-14T10:00:00Z",
  "version": "1.0.0"
}
```

### 2. Pass管理

#### 创建Pass
```http
POST /api/pass/create
Content-Type: application/json

{
  "domain": "example.com"  // 可选，用于生成更安全的Pass
}
```
```json
{
  "pass": "abc123def456ghi789jkl012mno345pqr678stu901vwx234yz",
  "created_at": "2024-12-14T10:00:00Z"
}
```

#### 验证Pass
```http
GET /api/pass/{pass}/check
```
```json
{
  "exists": true,
  "created_at": "2024-12-14T10:00:00Z",
  "domains": ["example.com", "test.com"]
}
```

### 3. 数据操作

#### 保存数据
```http
POST /api/data/{pass}/{domain}
Content-Type: application/json

{
  "data": "base64_encrypted_string",
  "timestamp": "2024-12-14T10:00:00Z"
}
```
```json
{
  "success": true,
  "id": "data_123",
  "timestamp": "2024-12-14T10:00:00Z"
}
```

#### 获取最新数据
```http
GET /api/data/{pass}/{domain}
```
```json
{
  "data": "base64_encrypted_string",
  "timestamp": "2024-12-14T10:00:00Z",
  "id": "data_123"
}
```

#### 获取历史版本
```http
GET /api/data/{pass}/{domain}/versions?limit=5
```
```json
{
  "versions": [
    {
      "id": "data_123",
      "timestamp": "2024-12-14T10:00:00Z",
      "size": 1024
    }
  ]
}
```

#### 删除数据
```http
DELETE /api/data/{pass}/{domain}
```
```json
{
  "success": true,
  "deleted_count": 1
}
```

### 4. 快捷访问 (一键复制功能)

#### 快速查看数据
```http
GET /api/quick/{pass}/{domain}?format=html&key=optional_decrypt_key
```

返回HTML页面，显示Cookie和LocalStorage数据，支持客户端解密。

#### 快速API调用
```http
GET /api/quick/{pass}/{domain}?format=json
```
```json
{
  "domain": "example.com",
  "data": "encrypted_data",
  "timestamp": "2024-12-14T10:00:00Z",
  "quick_url": "https://api.example.com/api/quick/abc123.../example.com"
}
```

### 5. 统计信息

#### Pass统计
```http
GET /api/stats/{pass}
```
```json
{
  "pass": "abc123...",
  "domain_count": 5,
  "total_size": 10240,
  "last_activity": "2024-12-14T10:00:00Z"
}
```

## 🗄️ 数据库设计 (SQLite)

### passes表
```sql
CREATE TABLE passes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pass_id TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### data_entries表  
```sql
CREATE TABLE data_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pass_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    data TEXT NOT NULL,  -- Base64编码的加密数据
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pass_id) REFERENCES passes(pass_id),
    UNIQUE(pass_id, domain, created_at)
);
```

### 索引
```sql
CREATE INDEX idx_pass_domain ON data_entries(pass_id, domain);
CREATE INDEX idx_created_at ON data_entries(created_at DESC);
```

## 🐍 Python实现示例

### 项目结构
```
cookie-server/
├── app.py              # 主应用
├── models.py           # 数据模型
├── utils.py            # 工具函数
├── requirements.txt    # 依赖
└── database.db         # SQLite数据库
```

### requirements.txt
```
Flask==2.3.3
Flask-CORS==4.0.0
```

### 核心代码框架
```python
# app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import secrets
import string
import base64
from datetime import datetime

app = Flask(__name__)
CORS(app)

def generate_pass(length=50):
    """生成随机Pass ID"""
    chars = string.ascii_letters + string.digits
    return ''.join(secrets.choice(chars) for _ in range(length))

@app.route('/health')
def health():
    return jsonify({
        'status': 'ok',
        'timestamp': datetime.utcnow().isoformat() + 'Z'
    })

@app.route('/api/pass/create', methods=['POST'])
def create_pass():
    pass_id = generate_pass()
    # 存储到数据库
    return jsonify({
        'pass': pass_id,
        'created_at': datetime.utcnow().isoformat() + 'Z'
    })

@app.route('/api/data/<pass_id>/<domain>', methods=['POST'])
def save_data(pass_id, domain):
    data = request.json.get('data')
    # 保存到数据库
    return jsonify({'success': True})

@app.route('/api/data/<pass_id>/<domain>', methods=['GET'])
def get_data(pass_id, domain):
    # 从数据库获取
    return jsonify({'data': 'encrypted_data'})

if __name__ == '__main__':
    app.run(debug=True)
```

## 🔧 部署方案

### Docker部署
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["python", "app.py"]
```

### 环境变量
```env
FLASK_ENV=production
DATABASE_PATH=/app/data/database.db
MAX_DATA_SIZE=1048576  # 1MB
MAX_VERSIONS=10
```

这个设计大大简化了服务器的复杂度，专注于做好数据存储，所有的业务逻辑都在客户端处理。
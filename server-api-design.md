# Cookie Manager 开放式服务器API设计

## 🎯 设计理念
- **开放式服务器**: 任何人都可以使用，无需注册
- **Pass系统**: 通过随机生成的Pass ID进行数据隔离
- **客户端加密**: 服务器只存储加密后的数据，不涉及密钥管理
- **简单CRUD**: 服务器只做基础的增删改查操作

## 📡 API 端点设计

### 1. 健康检查
```
GET /health
Response: { "status": "ok", "timestamp": "2024-12-14T10:00:00Z" }
```

### 2. Pass管理

#### 创建新Pass
```
POST /api/pass/create
Body: {
  "domain": "example.com"  // 可选，用于生成更安全的Pass
}

Response: {
  "pass": "abc123def456ghi789jkl012mno345pqr678stu901vwx234yz",  // 50位随机字符
  "created_at": "2024-12-14T10:00:00Z"
}
```

#### 验证Pass是否存在
```
GET /api/pass/{pass}/check
Response: {
  "exists": true,
  "created_at": "2024-12-14T10:00:00Z",
  "domains": ["example.com", "test.com"]  // 该Pass下的域名列表
}
```

### 3. 数据存储 (核心CRUD)

#### 保存数据
```
POST /api/data/{pass}/{domain}
Body: {
  "data": "encrypted_base64_string",  // 客户端加密后的数据
  "timestamp": "2024-12-14T10:00:00Z"
}

Response: {
  "success": true,
  "id": "data_id_123",
  "timestamp": "2024-12-14T10:00:00Z"
}
```

#### 获取数据
```
GET /api/data/{pass}/{domain}
Query: ?latest=true  // 获取最新版本

Response: {
  "data": "encrypted_base64_string",
  "timestamp": "2024-12-14T10:00:00Z",
  "id": "data_id_123"
}
```

#### 获取数据历史版本
```
GET /api/data/{pass}/{domain}/versions
Query: ?limit=5  // 限制返回数量

Response: {
  "versions": [
    {
      "id": "data_id_123",
      "timestamp": "2024-12-14T10:00:00Z",
      "size": 1024
    }
  ]
}
```

#### 删除数据
```
DELETE /api/data/{pass}/{domain}
Query: ?version_id=data_id_123  // 可选，删除特定版本

Response: {
  "success": true,
  "deleted_count": 1
}
```

#### 上传域名数据
```
POST /api/sync/{domain}
Headers:
  - Content-Type: application/json
  - X-Encryption-Key: [optional] 加密密钥

Body:
{
  "domain": "example.com",
  "data": {
    "cookies": { "name": "value" },
    "localStorage": { "key": "value" }
  },
  "encrypted": false,
  "timestamp": "2024-12-14T10:00:00Z",
  "hash": "sha256-hash"
}

Response:
{
  "success": true,
  "versionId": "uuid",
  "timestamp": "2024-12-14T10:00:00Z"
}
```

#### 下载域名数据
```
GET /api/sync/{domain}
Headers:
  - X-Encryption-Key: [optional] 加密密钥

Query Parameters:
  - decrypt: true/false (是否服务器端解密)
  - version: [optional] 指定版本ID

Response:
{
  "domain": "example.com",
  "data": {
    "cookies": { "name": "value" },
    "localStorage": { "key": "value" }
  },
  "encrypted": false,
  "timestamp": "2024-12-14T10:00:00Z",
  "versionId": "uuid"
}
```

### 3. 版本管理

#### 获取版本历史
```
GET /api/sync/{domain}/versions
Response:
{
  "domain": "example.com",
  "versions": [
    {
      "id": "uuid",
      "timestamp": "2024-12-14T10:00:00Z",
      "source": "server",
      "hash": "sha256-hash",
      "size": 1024
    }
  ]
}
```

#### 获取特定版本
```
GET /api/sync/{domain}/versions/{versionId}
Response: [同下载域名数据格式]
```

### 4. 管理后台API

#### 获取所有域名列表
```
GET /api/admin/domains
Response:
{
  "domains": [
    {
      "domain": "example.com",
      "lastModified": "2024-12-14T10:00:00Z",
      "dataSize": 1024,
      "versionCount": 5,
      "encrypted": true
    }
  ]
}
```

#### 获取域名详细信息
```
GET /api/admin/domains/{domain}
Response:
{
  "domain": "example.com",
  "lastModified": "2024-12-14T10:00:00Z",
  "encrypted": true,
  "versions": [...],
  "statistics": {
    "totalSize": 5120,
    "cookieCount": 10,
    "localStorageCount": 5
  }
}
```

## 🗄️ 数据库设计

### domains 表
```sql
CREATE TABLE domains (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  domain VARCHAR(255) UNIQUE NOT NULL,
  last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  encrypted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### domain_versions 表
```sql
CREATE TABLE domain_versions (
  id VARCHAR(36) PRIMARY KEY,
  domain_id BIGINT NOT NULL,
  data LONGTEXT NOT NULL,
  encrypted BOOLEAN DEFAULT FALSE,
  hash VARCHAR(64) NOT NULL,
  source ENUM('server', 'client') DEFAULT 'client',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE,
  INDEX idx_domain_created (domain_id, created_at DESC)
);
```

### encryption_keys 表 (可选)
```sql
CREATE TABLE encryption_keys (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  key_hash VARCHAR(64) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🔐 安全考虑

### 1. 加密策略
- 客户端生成对称密钥
- 服务器可选择存储加密数据或提供解密服务
- 密钥不存储在服务器（仅存储hash用于验证）

### 2. 访问控制
- 基于域名的数据隔离
- 可选的API密钥认证
- 请求频率限制

### 3. 数据完整性
- SHA-256哈希校验
- 版本冲突检测
- 数据大小限制

## 🚀 部署建议

### 1. 技术栈
- **后端**: Node.js + Express / Python + FastAPI / Go + Gin
- **数据库**: MySQL / PostgreSQL
- **缓存**: Redis (可选)
- **部署**: Docker + Nginx

### 2. 环境变量
```env
DATABASE_URL=mysql://user:pass@localhost/cookiemanager
REDIS_URL=redis://localhost:6379
MAX_DATA_SIZE=1048576  # 1MB
MAX_VERSIONS_PER_DOMAIN=10
ENABLE_ENCRYPTION=true
API_RATE_LIMIT=100  # requests per minute
```

### 3. Docker 配置
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```
# 🚀 Cookie Manager 部署指南

## 📋 概述

这是一个完整的Cookie和LocalStorage同步解决方案，包含：
- **Chrome扩展**: 客户端管理工具
- **Python服务器**: 开放式数据存储服务
- **Pass系统**: 基于随机ID的用户隔离

## 🖥️ 服务器部署

### 方式1: Docker部署 (推荐)

```bash
# 1. 克隆项目
git clone <repository-url>
cd cookie-manager

# 2. 构建并启动服务
cd server
docker-compose up -d

# 3. 验证服务
curl http://localhost:5000/health
```

### 方式2: 直接部署

```bash
# 1. 安装Python依赖
cd server
pip install -r requirements.txt

# 2. 启动服务
python app.py

# 3. 服务将在 http://localhost:5000 启动
```

### 方式3: 生产环境部署

```bash
# 1. 使用Gunicorn
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app

# 2. 使用Nginx反向代理
# 参考 server/nginx.conf 配置文件

# 3. 使用SSL证书
# 将证书文件放在 server/ssl/ 目录下
```

## 🔧 环境配置

### 环境变量
```env
# 数据库配置
DATABASE_PATH=/app/data/database.db

# 数据限制
MAX_DATA_SIZE=1048576  # 1MB
MAX_VERSIONS=10        # 每个域名最多10个版本

# 服务配置
FLASK_ENV=production
PORT=5000
```

### 数据目录
```bash
# 创建数据目录
mkdir -p /app/data
chmod 755 /app/data

# 数据库将自动创建在该目录下
```

## 🌐 域名和SSL配置

### 1. 域名解析
```
# 添加A记录指向服务器IP
api.yourdomain.com -> YOUR_SERVER_IP
```

### 2. SSL证书 (Let's Encrypt)
```bash
# 安装certbot
sudo apt install certbot

# 获取证书
sudo certbot certonly --standalone -d api.yourdomain.com

# 证书路径
/etc/letsencrypt/live/api.yourdomain.com/fullchain.pem
/etc/letsencrypt/live/api.yourdomain.com/privkey.pem
```

### 3. Nginx配置
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name api.yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;
    
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 📱 Chrome扩展安装

### 开发者模式安装
1. 打开Chrome扩展管理页面: `chrome://extensions/`
2. 开启"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择项目根目录

### 配置扩展
1. 点击扩展图标
2. 切换到"同步"标签页
3. 输入服务器地址: `https://api.yourdomain.com`
4. 可选：设置加密密钥
5. 点击"测试连接"验证
6. 保存配置

## 🔐 安全配置

### 1. 防火墙设置
```bash
# 只开放必要端口
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

### 2. 数据备份
```bash
# 定期备份数据库
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
cp /app/data/database.db /backup/database_$DATE.db

# 添加到crontab
0 2 * * * /path/to/backup.sh
```

### 3. 日志监控
```bash
# 查看应用日志
docker logs cookie-manager-server_cookie-manager-server_1

# 查看Nginx日志
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

## 📊 监控和维护

### 健康检查
```bash
# 检查服务状态
curl https://api.yourdomain.com/health

# 检查统计信息
curl https://api.yourdomain.com/api/stats/server
```

### 管理后台
访问 `https://api.yourdomain.com/admin` 可以：
- 查看服务器统计信息
- 管理所有Pass和数据
- 搜索和过滤Pass
- 删除Pass及其数据
- 查看域名使用情况

### 数据库维护
```bash
# 进入容器
docker exec -it cookie-manager-server_cookie-manager-server_1 /bin/bash

# 连接数据库
sqlite3 /app/data/database.db

# 查看统计
.tables
SELECT COUNT(*) FROM passes;
SELECT COUNT(*) FROM data_entries;
```

### 性能优化
```python
# 在app.py中添加索引优化
def optimize_database():
    with get_db() as conn:
        conn.execute('ANALYZE')
        conn.execute('VACUUM')
```

## 🚨 故障排除

### 常见问题

#### 1. 连接失败
```bash
# 检查服务状态
systemctl status nginx
docker ps

# 检查端口占用
netstat -tlnp | grep :5000
```

#### 2. 数据库错误
```bash
# 检查数据库文件权限
ls -la /app/data/database.db

# 重新初始化数据库
rm /app/data/database.db
python app.py  # 会自动重建
```

#### 3. SSL证书问题
```bash
# 检查证书有效期
openssl x509 -in /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem -text -noout

# 续期证书
sudo certbot renew
```

## 📈 扩展部署

### 多服务器部署
```yaml
# docker-compose.yml
version: '3.8'
services:
  app1:
    build: .
    ports: ["5001:5000"]
  app2:
    build: .
    ports: ["5002:5000"]
  
  nginx:
    image: nginx
    ports: ["80:80", "443:443"]
    # 配置负载均衡
```

### 数据库分离
```python
# 使用PostgreSQL替代SQLite
DATABASE_URL = "postgresql://user:pass@localhost/cookiemanager"
```

## 🎯 使用示例

### 1. 创建Pass
```bash
curl -X POST https://api.yourdomain.com/api/pass/create \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 2. 保存数据
```bash
curl -X POST https://api.yourdomain.com/api/data/{pass}/{domain} \
  -H "Content-Type: application/json" \
  -d '{"data": "encrypted_data", "timestamp": "2024-12-14T10:00:00Z"}'
```

### 3. 获取数据
```bash
curl https://api.yourdomain.com/api/data/{pass}/{domain}
```

### 4. 快捷访问
```
https://api.yourdomain.com/api/quick/{pass}/{domain}?format=html
```

这个部署指南涵盖了从开发到生产环境的完整部署流程，确保系统的安全性和可靠性。
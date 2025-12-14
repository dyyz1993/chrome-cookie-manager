# Chrome Cookie Manager | Chrome Cookie 管理器

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green.svg)](https://chrome.google.com/webstore)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub release](https://img.shields.io/github/release/username/chrome-cookie-manager.svg)](https://github.com/username/chrome-cookie-manager/releases)

一个功能强大的Chrome扩展，用于管理当前页面的Cookie和LocalStorage，支持读取、写入、复制和云端同步功能。

A powerful Chrome extension for managing cookies and localStorage on the current page, supporting read, write, copy, and cloud sync features.

## 🌟 主要特点 | Key Features

- 🍪 **Cookie管理** - 读取、写入、复制当前页面的所有Cookie
- 💾 **LocalStorage管理** - 查看、过滤、复制网站的LocalStorage数据
- ☁️ **云端同步** - 支持跨设备数据同步（可选）
- � **数据加密** - 客户端加密，保护隐私安全
- 🎨 **现代化界面** - 四标签页设计，简洁直观
- ⚙️ **智能配置** - 按域名独立配置同步策略
- 📱 **响应式设计** - 适配不同屏幕尺寸

## 📸 截图 | Screenshots

![Cookie Manager Interface](docs/images/interface-screenshot.png)

## 🚀 安装 | Installation

### 方式1：从Chrome Web Store安装（推荐）
### Method 1: Install from Chrome Web Store (Recommended)

1. 访问 [Chrome Web Store](https://chrome.google.com/webstore)
2. 搜索 "Cookie Manager"
3. 点击 "添加到Chrome"

### 方式2：开发者模式安装
### Method 2: Developer Mode Installation

1. 下载或克隆此项目到本地
   ```bash
   git clone https://github.com/username/chrome-cookie-manager.git
   cd chrome-cookie-manager
   ```
2. 打开Chrome浏览器，进入 `chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目文件夹

## 📖 使用指南 | User Guide

### Cookie管理 | Cookie Management

1. 打开要查看Cookie的网页
2. 点击工具栏中的Cookie Manager图标
3. 在"Cookie"标签页中：
   - 点击"获取所有Cookie"获取当前页面的所有Cookie
   - 或点击"获取指定Cookie"输入Cookie名称获取特定Cookie
   - 点击"复制Cookie"将Cookie复制到剪贴板

### LocalStorage管理 | LocalStorage Management

1. 切换到"Storage"标签页
2. 可以进行以下操作：
   - 点击"获取所有Storage"获取当前页面的所有LocalStorage数据
   - 点击"获取指定项"输入键名获取特定Storage项
   - 设置"最大值长度"来过滤过长的数据（默认500字符）
   - 点击"复制Storage"将数据复制到剪贴板

### 设置Cookie | Setting Cookies

1. 切换到"设置"标签页
2. 填写Cookie信息：
   - **Cookie名称** - 必填，要设置的Cookie名称
   - **Cookie值** - 必填，Cookie的值
   - **域名** - 可选，留空则使用当前域名
   - **路径** - 可选，默认为"/"
   - **过期时间** - 可选，格式如：2025-12-31T23:59:59Z
3. 点击"设置Cookie"按钮完成设置

### 云端同步 | Cloud Sync

1. 切换到"同步"标签页
2. 配置服务器URL和加密密钥
3. 为每个域名单独配置同步策略
4. 支持自动同步和手动同步

## 🔧 技术实现 | Technical Implementation

- **Manifest V3** - 使用最新的Chrome扩展API
- **现代化UI** - 基于现代设计原则的四标签页界面
- **动态权限申请** - 根据当前页面域名动态申请权限
- **客户端加密** - 使用AES加密保护数据安全
- **版本管理** - 智能版本控制和冲突解决

## 🌐 服务器部署 | Server Deployment

### Docker部署（推荐）| Docker Deployment (Recommended)

```bash
# 克隆项目
git clone https://github.com/username/chrome-cookie-manager.git
cd chrome-cookie-manager/server

# 启动服务
docker-compose up -d

# 验证服务
curl http://localhost:5000/health
```

### 直接部署 | Direct Deployment

```bash
# 安装依赖
cd server
pip install -r requirements.txt

# 启动服务
python app.py
```

## 📚 API文档 | API Documentation

### 健康检查 | Health Check
```http
GET /health
```

### Pass管理 | Pass Management
```http
POST /api/pass/create
GET /api/pass/{pass}/check
```

### 数据存储 | Data Storage
```http
POST /api/data/{pass}/{domain}
GET /api/data/{pass}/{domain}
DELETE /api/data/{pass}/{domain}
```

详细API文档请参考：[API Documentation](docs/api.md)

## 🤝 贡献 | Contributing

欢迎贡献代码！请遵循以下步骤：

1. Fork 此仓库
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

Welcome to contribute! Please follow these steps:

1. Fork this repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 许可证 | License

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 致谢 | Acknowledgments

- 感谢所有贡献者的支持
- 感谢Chrome扩展开发社区
- UI设计灵感来源于现代Web应用

## 📞 联系方式 | Contact

- 项目主页：[https://github.com/username/chrome-cookie-manager](https://github.com/username/chrome-cookie-manager)
- 问题反馈：[Issues](https://github.com/username/chrome-cookie-manager/issues)
- 功能建议：[Discussions](https://github.com/username/chrome-cookie-manager/discussions)

---

## 🌍 语言 | Language

[English](README_EN.md) | [简体中文](README.md)
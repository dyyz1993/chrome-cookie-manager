# Chrome Cookie Manager

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green.svg)](https://chrome.google.com/webstore)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub release](https://img.shields.io/github/release/username/chrome-cookie-manager.svg)](https://github.com/username/chrome-cookie-manager/releases)

A powerful Chrome extension for managing cookies and localStorage on the current page, supporting read, write, copy, and cloud sync features.

一个功能强大的Chrome扩展，用于管理当前页面的Cookie和LocalStorage，支持读取、写入、复制和云端同步功能。

## 🌟 Key Features | 主要特点

- 🍪 **Cookie Management** - Read, write, and copy all cookies on the current page
- 💾 **LocalStorage Management** - View, filter, and copy website localStorage data
- ☁️ **Cloud Sync** - Cross-device data synchronization (optional)
- 🔐 **Data Encryption** - Client-side encryption to protect privacy
- 🎨 **Modern UI** - Four-tab design, clean and intuitive
- ⚙️ **Smart Configuration** - Independent sync strategies per domain
- 📱 **Responsive Design** - Adapts to different screen sizes

## 📸 Screenshots | 截图

![Cookie Manager Interface](docs/images/interface-screenshot.png)

## 🚀 Installation | 安装

### Method 1: Install from Chrome Web Store (Recommended)
### 方式1：从Chrome Web Store安装（推荐）

1. Visit [Chrome Web Store](https://chrome.google.com/webstore)
2. Search for "Cookie Manager"
3. Click "Add to Chrome"

### Method 2: Developer Mode Installation
### 方式2：开发者模式安装

1. Download or clone this project locally
   ```bash
   git clone https://github.com/username/chrome-cookie-manager.git
   cd chrome-cookie-manager
   ```
2. Open Chrome browser and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked extension"
5. Select the project folder

## 📖 User Guide | 使用指南

### Cookie Management | Cookie管理

1. Open the webpage where you want to view cookies
2. Click the Cookie Manager icon in the toolbar
3. In the "Cookie" tab:
   - Click "Get All Cookies" to get all cookies on the current page
   - Or click "Get Specific Cookie" and enter the cookie name to get a specific cookie
   - Click "Copy Cookie" to copy cookies to clipboard

### LocalStorage Management | LocalStorage管理

1. Switch to the "Storage" tab
2. You can perform the following operations:
   - Click "Get All Storage" to get all localStorage data on the current page
   - Click "Get Specific Item" and enter the key name to get a specific storage item
   - Set "Maximum Value Length" to filter overly long data (default 500 characters)
   - Click "Copy Storage" to copy data to clipboard

### Setting Cookies | 设置Cookie

1. Switch to the "Settings" tab
2. Fill in cookie information:
   - **Cookie Name** - Required, the name of the cookie to set
   - **Cookie Value** - Required, the value of the cookie
   - **Domain** - Optional, leave empty to use current domain
   - **Path** - Optional, default is "/"
   - **Expiration Time** - Optional, format like: 2025-12-31T23:59:59Z
3. Click the "Set Cookie" button to complete the setting

### Cloud Sync | 云端同步

1. Switch to the "Sync" tab
2. Configure server URL and encryption key
3. Configure sync strategies independently for each domain
4. Support automatic sync and manual sync

## 🔧 Technical Implementation | 技术实现

- **Manifest V3** - Using the latest Chrome extension API
- **Modern UI** - Four-tab interface based on modern design principles
- **Dynamic Permission Request** - Dynamically request permissions based on current page domain
- **Client-side Encryption** - Use AES encryption to protect data security
- **Version Management** - Smart version control and conflict resolution

## 🌐 Server Deployment | 服务器部署

### Docker Deployment (Recommended) | Docker部署（推荐）

```bash
# Clone project
git clone https://github.com/username/chrome-cookie-manager.git
cd chrome-cookie-manager/server

# Start service
docker-compose up -d

# Verify service
curl http://localhost:5000/health
```

### Direct Deployment | 直接部署

```bash
# Install dependencies
cd server
pip install -r requirements.txt

# Start service
python app.py
```

## 📚 API Documentation | API文档

### Health Check | 健康检查
```http
GET /health
```

### Pass Management | Pass管理
```http
POST /api/pass/create
GET /api/pass/{pass}/check
```

### Data Storage | 数据存储
```http
POST /api/data/{pass}/{domain}
GET /api/data/{pass}/{domain}
DELETE /api/data/{pass}/{domain}
```

For detailed API documentation, please refer to: [API Documentation](docs/api.md)

## 🤝 Contributing | 贡献

Contributions are welcome! Please follow these steps:

欢迎贡献代码！请遵循以下步骤：

1. Fork this repository | Fork 此仓库
2. Create your feature branch (`git checkout -b feature/AmazingFeature`) | 创建您的特性分支
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`) | 提交您的更改
4. Push to the branch (`git push origin feature/AmazingFeature`) | 推送到分支
5. Open a Pull Request | 打开一个 Pull Request

## 📄 License | 许可证

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 Acknowledgments | 致谢

- Thanks to all contributors | 感谢所有贡献者的支持
- Thanks to the Chrome extension development community | 感谢Chrome扩展开发社区
- UI design inspiration from modern web applications | UI设计灵感来源于现代Web应用

## 📞 Contact | 联系方式

- Project homepage: [https://github.com/username/chrome-cookie-manager](https://github.com/username/chrome-cookie-manager) | 项目主页
- Issue feedback: [Issues](https://github.com/username/chrome-cookie-manager/issues) | 问题反馈
- Feature suggestions: [Discussions](https://github.com/username/chrome-cookie-manager/discussions) | 功能建议

---

## 🌍 Language | 语言

[English](README_EN.md) | [简体中文](README.md)
# Chrome Cookie Manager

一个功能强大的Chrome插件，用于管理当前页面的Cookie，支持读取、写入和复制功能。

## 功能特点

- 🍪 **读取所有Cookie** - 获取当前页面的所有Cookie
- 🎯 **读取指定Cookie** - 根据名称获取特定的Cookie
- ✏️ **写入Cookie** - 设置新的Cookie到当前页面
- 📋 **一键复制** - 将Cookie拼接成一行并复制到剪贴板
- 🔐 **动态权限申请** - 自动申请访问页面域名的权限
- 🎨 **美观界面** - 简洁直观的用户界面

## 安装方法

1. 下载或克隆此项目到本地
2. 打开Chrome浏览器，进入 `chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目文件夹
6. 插件安装完成，可以在工具栏看到Cookie Manager图标

## 使用方法

### 读取Cookie

1. 打开要查看Cookie的网页
2. 点击工具栏中的Cookie Manager图标
3. 点击"获取所有Cookie"按钮获取当前页面的所有Cookie
4. 或者点击"获取指定Cookie"按钮，输入Cookie名称获取特定Cookie

### 写入Cookie

1. 在"写入Cookie"部分填写Cookie信息：
   - **Cookie名称** - 必填，要设置的Cookie名称
   - **Cookie值** - 必填，Cookie的值
   - **域名** - 可选，留空则使用当前域名
   - **路径** - 可选，默认为"/"
   - **过期时间** - 可选，格式如：2025-12-31T23:59:59Z

2. 点击"设置Cookie"按钮完成设置

### 复制Cookie

1. 获取Cookie后，点击"复制Cookie"按钮
2. Cookie会自动拼接成一行格式（如：`name1=value1; name2=value2;`）
3. 可以直接粘贴到需要的地方

## 权限说明

插件需要以下权限：

- `activeTab` - 获取当前活动标签页信息
- `cookies` - 读取和写入Cookie
- `<all_urls>` - 访问所有网站的Cookie（通过动态权限申请实现）

## 技术实现

- **Manifest V3** - 使用最新的Chrome扩展API
- **动态权限申请** - 根据当前页面域名动态申请权限
- **响应式设计** - 适配不同屏幕尺寸
- **错误处理** - 完善的错误提示和状态反馈

## 文件结构

```
chrome-cookie-manager/
├── manifest.json          # 插件配置文件
├── popup.html             # 弹窗界面
├── popup.js               # 弹窗逻辑
├── background.js          # 后台脚本
├── icons/                 # 图标文件夹
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── icon.svg               # SVG图标源文件
├── create_icons.py        # 图标生成脚本
└── README.md              # 说明文档
```

## 开发说明

如需修改或扩展功能，可以编辑以下文件：

- `popup.html` - 修改界面布局
- `popup.js` - 添加或修改前端逻辑
- `background.js` - 修改后台处理逻辑
- `manifest.json` - 更新插件配置和权限

## 注意事项

- 插件只能在网页环境下使用，不能在Chrome内部页面（如新标签页）使用
- 某些网站可能设置了HttpOnly或Secure标志，这些Cookie可能无法读取或修改
- 权限申请需要用户确认，如果拒绝则无法访问对应域名的Cookie

## 许可证

MIT License
# Contributing to Chrome Cookie Manager

感谢您对Chrome Cookie Manager项目的关注！我们欢迎各种形式的贡献。

Thank you for your interest in the Chrome Cookie Manager project! We welcome contributions in all forms.

## 🤝 如何贡献 | How to Contribute

### 报告问题 | Reporting Issues

如果您发现了bug或有功能建议，请：

If you found a bug or have a feature suggestion, please:

1. 检查[现有问题](https://github.com/username/chrome-cookie-manager/issues)是否已存在
   Check if [existing issues](https://github.com/username/chrome-cookie-manager/issues) already exist
2. 如果没有，请[创建新问题](https://github.com/username/chrome-cookie-manager/issues/new)
   If not, please [create a new issue](https://github.com/username/chrome-cookie-manager/issues/new)
3. 提供详细的问题描述和复现步骤
   Provide detailed issue description and reproduction steps

### 提交代码 | Submitting Code

1. Fork此仓库 | Fork this repository
2. 创建您的特性分支 | Create your feature branch
   ```bash
   git checkout -b feature/AmazingFeature
   ```
3. 提交您的更改 | Commit your changes
   ```bash
   git commit -m 'Add some AmazingFeature'
   ```
4. 推送到分支 | Push to the branch
   ```bash
   git push origin feature/AmazingFeature
   ```
5. 打开一个Pull Request | Open a Pull Request

## 📝 开发指南 | Development Guide

### 环境设置 | Environment Setup

1. 克隆仓库 | Clone the repository
   ```bash
   git clone https://github.com/username/chrome-cookie-manager.git
   cd chrome-cookie-manager
   ```

2. 加载扩展到Chrome | Load extension to Chrome
   - 打开Chrome浏览器 | Open Chrome browser
   - 访问 `chrome://extensions/` | Go to `chrome://extensions/`
   - 启用"开发者模式" | Enable "Developer mode"
   - 点击"加载已解压的扩展程序" | Click "Load unpacked extension"
   - 选择项目文件夹 | Select the project folder

3. 启动服务器（可选）| Start server (optional)
   ```bash
   cd server
   pip install -r requirements.txt
   python app.py
   ```

### 代码规范 | Code Standards

- JavaScript代码使用ESLint进行格式化 | Use ESLint for JavaScript code formatting
- Python代码遵循PEP 8规范 | Follow PEP 8 standards for Python code
- 提交信息使用约定式提交格式 | Use conventional commit format for commit messages
   - `feat:` 新功能 | New feature
   - `fix:` 修复bug | Bug fix
   - `docs:` 文档更新 | Documentation update
   - `style:` 代码格式化 | Code formatting
   - `refactor:` 代码重构 | Code refactoring
   - `test:` 测试相关 | Test related
   - `chore:` 构建过程或辅助工具的变动 | Changes to the build process or auxiliary tools

### 测试 | Testing

- 运行服务器测试 | Run server tests
  ```bash
  cd server
  python -m pytest
  ```

- 测试扩展功能 | Test extension functionality
  1. 在Chrome中加载扩展 | Load extension in Chrome
  2. 测试各个标签页功能 | Test each tab functionality
  3. 验证权限申请 | Verify permission requests

## 📋 Pull Request 检查清单 | Pull Request Checklist

提交PR前，请确保：

Before submitting a PR, please ensure:

- [ ] 代码通过所有测试 | Code passes all tests
- [ ] 代码符合项目规范 | Code follows project standards
- [ ] 添加了必要的测试 | Added necessary tests
- [ ] 更新了相关文档 | Updated relevant documentation
- [ ] 提交信息清晰明确 | Commit message is clear and descriptive
- [ ] 没有合并冲突 | No merge conflicts

## 🏷️ 发布流程 | Release Process

1. 更新版本号 | Update version number
   - 在`manifest.json`中更新版本号 | Update version number in `manifest.json`
   - 创建Git标签 | Create Git tag
     ```bash
     git tag v1.0.0
     git push origin v1.0.0
     ```

2. 自动构建和发布 | Automatic build and release
   - GitHub Actions会自动构建扩展包 | GitHub Actions will automatically build extension package
   - 创建GitHub Release | Create GitHub Release
   - 部署服务器（如有更改）| Deploy server (if changed)

## 📞 联系方式 | Contact

如有任何问题，请通过以下方式联系：

If you have any questions, please contact us through:

- 创建Issue | Create an Issue
- 发送邮件 | Send an email
- 加入讨论组 | Join the discussion group

## 🙏 致谢 | Acknowledgments

感谢所有为这个项目做出贡献的开发者！

Thanks to all developers who have contributed to this project!
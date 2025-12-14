#!/usr/bin/env python3
"""
本地服务器启动脚本
提供开发和生产环境的启动选项
"""

import os
import sys
import argparse
import subprocess
from pathlib import Path

def setup_environment():
    """设置环境"""
    # 确保数据目录存在
    data_dir = Path('data')
    data_dir.mkdir(exist_ok=True)
    
    # 设置环境变量
    os.environ.setdefault('DATABASE_PATH', str(data_dir / 'database.db'))
    os.environ.setdefault('MAX_DATA_SIZE', '1048576')  # 1MB
    os.environ.setdefault('MAX_VERSIONS', '10')
    
    print(f"📊 数据库路径: {os.environ['DATABASE_PATH']}")
    print(f"💾 最大数据大小: {int(os.environ['MAX_DATA_SIZE']) / 1024 / 1024:.1f}MB")
    print(f"📚 最大版本数: {os.environ['MAX_VERSIONS']}")

def install_dependencies():
    """安装依赖"""
    print("📦 安装依赖包...")
    try:
        subprocess.run([sys.executable, '-m', 'pip', 'install', '-r', 'requirements.txt'], 
                      check=True)
        print("✅ 依赖安装完成")
    except subprocess.CalledProcessError:
        print("❌ 依赖安装失败")
        sys.exit(1)

def run_tests():
    """运行测试"""
    print("🧪 运行测试...")
    try:
        result = subprocess.run([sys.executable, 'run_tests.py', '--type', 'fast'], 
                              check=False)
        if result.returncode == 0:
            print("✅ 测试通过")
        else:
            print("⚠️ 测试失败，但继续启动服务器")
    except Exception as e:
        print(f"⚠️ 测试运行出错: {e}")

def start_development_server(port=5000, debug=True):
    """启动开发服务器"""
    os.environ['FLASK_ENV'] = 'development' if debug else 'production'
    os.environ['PORT'] = str(port)
    
    print(f"🚀 启动开发服务器 (端口: {port}, 调试: {debug})")
    print(f"🌐 访问地址: http://localhost:{port}")
    print(f"🔍 健康检查: http://localhost:{port}/health")
    print(f"📊 服务器统计: http://localhost:{port}/api/stats/server")
    print("-" * 50)
    
    try:
        from app import app
        app.run(host='0.0.0.0', port=port, debug=debug)
    except KeyboardInterrupt:
        print("\n👋 服务器已停止")
    except Exception as e:
        print(f"❌ 服务器启动失败: {e}")
        sys.exit(1)

def start_production_server(port=5000, workers=4):
    """启动生产服务器"""
    print("📦 检查Gunicorn...")
    try:
        subprocess.run([sys.executable, '-m', 'pip', 'install', 'gunicorn'], 
                      check=True, capture_output=True)
    except subprocess.CalledProcessError:
        print("❌ Gunicorn安装失败")
        sys.exit(1)
    
    os.environ['FLASK_ENV'] = 'production'
    
    print(f"🚀 启动生产服务器 (端口: {port}, 工作进程: {workers})")
    print(f"🌐 访问地址: http://localhost:{port}")
    print("-" * 50)
    
    cmd = [
        'gunicorn',
        '-w', str(workers),
        '-b', f'0.0.0.0:{port}',
        '--access-logfile', '-',
        '--error-logfile', '-',
        'app:app'
    ]
    
    try:
        subprocess.run(cmd, check=True)
    except KeyboardInterrupt:
        print("\n👋 服务器已停止")
    except subprocess.CalledProcessError as e:
        print(f"❌ 服务器启动失败: {e}")
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description='Cookie Manager 服务器启动脚本')
    parser.add_argument('--port', type=int, default=int(os.environ.get('PORT', 5000)), help='服务器端口 (默认: 5000)')
    parser.add_argument('--production', action='store_true', help='生产模式 (使用Gunicorn)')
    parser.add_argument('--workers', type=int, default=4, help='Gunicorn工作进程数 (默认: 4)')
    parser.add_argument('--no-debug', action='store_true', help='禁用调试模式')
    parser.add_argument('--skip-install', action='store_true', help='跳过依赖安装')
    parser.add_argument('--skip-tests', action='store_true', help='跳过测试')
    
    args = parser.parse_args()
    
    print("🍪 Cookie Manager 服务器启动器")
    print("=" * 50)
    
    # 设置环境
    setup_environment()
    
    # 安装依赖
    if not args.skip_install:
        install_dependencies()
    
    # 运行测试
    if not args.skip_tests and not args.production:
        run_tests()
    
    # 启动服务器
    if args.production:
        start_production_server(args.port, args.workers)
    else:
        start_development_server(args.port, not args.no_debug)

if __name__ == '__main__':
    main()
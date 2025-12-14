#!/usr/bin/env python3
"""
测试运行脚本
提供不同的测试运行选项
"""

import os
import sys
import subprocess
import argparse

def run_tests(test_type='all', coverage=True, verbose=True):
    """运行测试"""
    
    # 基础命令
    cmd = ['python', '-m', 'pytest']
    
    # 添加测试文件
    if test_type == 'unit':
        cmd.extend(['-k', 'not (performance or integration)'])
    elif test_type == 'integration':
        cmd.extend(['-m', 'integration'])
    elif test_type == 'performance':
        cmd.extend(['-m', 'performance'])
    elif test_type == 'fast':
        cmd.extend(['-m', 'not slow'])
    
    # 添加选项
    if verbose:
        cmd.append('-v')
    
    if coverage:
        cmd.extend([
            '--cov=app',
            '--cov-report=html:htmlcov',
            '--cov-report=term-missing',
            '--cov-report=xml'
        ])
    
    # 其他选项
    cmd.extend([
        '--tb=short',
        '--strict-markers',
        '--disable-warnings'
    ])
    
    print(f"运行命令: {' '.join(cmd)}")
    print("-" * 50)
    
    # 执行测试
    result = subprocess.run(cmd, cwd=os.path.dirname(os.path.abspath(__file__)))
    
    if coverage and result.returncode == 0:
        print("\n" + "=" * 50)
        print("测试完成！覆盖率报告已生成:")
        print("- HTML报告: htmlcov/index.html")
        print("- XML报告: coverage.xml")
        print("=" * 50)
    
    return result.returncode

def main():
    parser = argparse.ArgumentParser(description='运行Cookie Manager服务器测试')
    parser.add_argument('--type', choices=['all', 'unit', 'integration', 'performance', 'fast'],
                       default='all', help='测试类型')
    parser.add_argument('--no-coverage', action='store_true', help='禁用覆盖率报告')
    parser.add_argument('--quiet', action='store_true', help='静默模式')
    
    args = parser.parse_args()
    
    # 设置环境变量
    os.environ['FLASK_ENV'] = 'testing'
    
    # 运行测试
    exit_code = run_tests(
        test_type=args.type,
        coverage=not args.no_coverage,
        verbose=not args.quiet
    )
    
    sys.exit(exit_code)

if __name__ == '__main__':
    main()
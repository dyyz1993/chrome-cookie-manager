#!/usr/bin/env python3
"""
手动API测试脚本
用于快速验证API功能
"""

import requests
import json
import time
import base64

class APITester:
    def __init__(self, base_url='http://localhost:5000'):
        self.base_url = base_url
        self.session = requests.Session()
        self.pass_id = None
    
    def test_health(self):
        """测试健康检查"""
        print("🔍 测试健康检查...")
        try:
            response = self.session.get(f'{self.base_url}/health')
            if response.status_code == 200:
                data = response.json()
                print(f"✅ 服务器正常 - 版本: {data.get('version', 'unknown')}")
                return True
            else:
                print(f"❌ 健康检查失败: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ 连接失败: {e}")
            return False
    
    def test_create_pass(self):
        """测试创建Pass"""
        print("🔑 测试创建Pass...")
        try:
            response = self.session.post(f'{self.base_url}/api/pass/create', 
                                       json={})  # 发送空JSON对象
            if response.status_code == 200:
                data = response.json()
                self.pass_id = data['pass']
                print(f"✅ Pass创建成功: {self.pass_id[:20]}...")
                return True
            else:
                print(f"❌ Pass创建失败: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Pass创建异常: {e}")
            return False
    
    def test_check_pass(self):
        """测试检查Pass"""
        if not self.pass_id:
            print("❌ 没有可用的Pass ID")
            return False
        
        print("🔍 测试检查Pass...")
        try:
            response = self.session.get(f'{self.base_url}/api/pass/{self.pass_id}/check')
            if response.status_code == 200:
                data = response.json()
                if data['exists']:
                    print(f"✅ Pass验证成功")
                    return True
                else:
                    print(f"❌ Pass不存在")
                    return False
            else:
                print(f"❌ Pass检查失败: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Pass检查异常: {e}")
            return False
    
    def test_save_data(self):
        """测试保存数据"""
        if not self.pass_id:
            print("❌ 没有可用的Pass ID")
            return False
        
        print("💾 测试保存数据...")
        
        # 创建测试数据
        test_data = {
            'cookies': {'session_id': 'abc123', 'user_id': '456'},
            'localStorage': {'theme': 'dark', 'language': 'zh-CN'}
        }
        
        # Base64编码
        encoded_data = base64.b64encode(json.dumps(test_data).encode()).decode()
        
        payload = {
            'data': encoded_data,
            'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        }
        
        try:
            response = self.session.post(
                f'{self.base_url}/api/data/{self.pass_id}?domain=example.com',
                json=payload
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ 数据保存成功: {data['id']}")
                return True
            else:
                print(f"❌ 数据保存失败: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            print(f"❌ 数据保存异常: {e}")
            return False
    
    def test_get_data(self):
        """测试获取数据"""
        if not self.pass_id:
            print("❌ 没有可用的Pass ID")
            return False
        
        print("📥 测试获取数据...")
        try:
            response = self.session.get(f'{self.base_url}/api/data/{self.pass_id}?domain=example.com')
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ 数据获取成功: {len(data['data'])} 字符")
                
                # 尝试解码数据
                try:
                    decoded = base64.b64decode(data['data']).decode()
                    parsed = json.loads(decoded)
                    print(f"📊 解码数据: {len(parsed)} 项")
                except:
                    print("⚠️ 数据解码失败")
                
                return True
            else:
                print(f"❌ 数据获取失败: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ 数据获取异常: {e}")
            return False
    
    def test_quick_access(self):
        """测试快捷访问"""
        if not self.pass_id:
            print("❌ 没有可用的Pass ID")
            return False
        
        print("🚀 测试快捷访问...")
        
        # 测试JSON格式
        try:
            response = self.session.get(f'{self.base_url}/api/quick/{self.pass_id}?domain=example.com&format=json')
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ JSON快捷访问成功")
                print(f"🔗 快捷URL: {data.get('quick_url', 'N/A')}")
                
                # 测试HTML格式
                html_response = self.session.get(f'{self.base_url}/api/quick/{self.pass_id}?domain=example.com&format=html')
                if html_response.status_code == 200:
                    print(f"✅ HTML快捷访问成功: {len(html_response.text)} 字符")
                    return True
                else:
                    print(f"❌ HTML快捷访问失败: {html_response.status_code}")
                    return False
            else:
                print(f"❌ 快捷访问失败: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ 快捷访问异常: {e}")
            return False
    
    def test_versions(self):
        """测试版本历史"""
        if not self.pass_id:
            print("❌ 没有可用的Pass ID")
            return False
        
        print("📚 测试版本历史...")
        try:
            response = self.session.get(f'{self.base_url}/api/data/{self.pass_id}/versions?domain=example.com&limit=5')
            
            if response.status_code == 200:
                data = response.json()
                versions = data['versions']
                print(f"✅ 版本历史获取成功: {len(versions)} 个版本")
                
                for i, version in enumerate(versions[:3]):  # 显示前3个版本
                    print(f"  📄 版本 {i+1}: {version['id']} ({version['size']} bytes)")
                
                return True
            else:
                print(f"❌ 版本历史获取失败: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ 版本历史异常: {e}")
            return False
    
    def test_stats(self):
        """测试统计信息"""
        print("📊 测试统计信息...")
        
        # 测试服务器统计
        try:
            response = self.session.get(f'{self.base_url}/api/stats/server')
            if response.status_code == 200:
                data = response.json()
                print(f"✅ 服务器统计: {data['total_passes']} Pass, {data['total_domains']} 域名")
            else:
                print(f"❌ 服务器统计失败: {response.status_code}")
        except Exception as e:
            print(f"❌ 服务器统计异常: {e}")
        
        # 测试Pass统计
        if self.pass_id:
            try:
                response = self.session.get(f'{self.base_url}/api/stats/{self.pass_id}')
                if response.status_code == 200:
                    data = response.json()
                    print(f"✅ Pass统计: {data['domain_count']} 域名, {data['total_size']} bytes")
                    return True
                else:
                    print(f"❌ Pass统计失败: {response.status_code}")
            except Exception as e:
                print(f"❌ Pass统计异常: {e}")
        
        return False
    
    def run_all_tests(self):
        """运行所有测试"""
        print("🧪 开始API测试")
        print("=" * 50)
        
        tests = [
            ('健康检查', self.test_health),
            ('创建Pass', self.test_create_pass),
            ('检查Pass', self.test_check_pass),
            ('保存数据', self.test_save_data),
            ('获取数据', self.test_get_data),
            ('快捷访问', self.test_quick_access),
            ('版本历史', self.test_versions),
            ('统计信息', self.test_stats),
        ]
        
        passed = 0
        total = len(tests)
        
        for name, test_func in tests:
            print(f"\n📋 {name}")
            print("-" * 30)
            
            try:
                if test_func():
                    passed += 1
                    print(f"✅ {name} 通过")
                else:
                    print(f"❌ {name} 失败")
            except Exception as e:
                print(f"💥 {name} 异常: {e}")
            
            time.sleep(0.5)  # 短暂延迟
        
        print("\n" + "=" * 50)
        print(f"🎯 测试结果: {passed}/{total} 通过")
        
        if self.pass_id:
            print(f"🔑 测试Pass ID: {self.pass_id}")
            print(f"🔗 快捷访问: {self.base_url}/api/quick/{self.pass_id}?domain=example.com&format=html")
        
        return passed == total

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Cookie Manager API 手动测试')
    parser.add_argument('--url', default='http://localhost:5000', help='服务器URL')
    parser.add_argument('--test', choices=['health', 'pass', 'data', 'quick', 'stats', 'all'], 
                       default='all', help='测试类型')
    
    args = parser.parse_args()
    
    tester = APITester(args.url)
    
    if args.test == 'all':
        success = tester.run_all_tests()
        exit(0 if success else 1)
    else:
        # 运行单个测试
        test_map = {
            'health': tester.test_health,
            'pass': lambda: tester.test_create_pass() and tester.test_check_pass(),
            'data': lambda: tester.test_create_pass() and tester.test_save_data() and tester.test_get_data(),
            'quick': lambda: tester.test_create_pass() and tester.test_save_data() and tester.test_quick_access(),
            'stats': lambda: tester.test_create_pass() and tester.test_save_data() and tester.test_stats(),
        }
        
        if args.test in test_map:
            success = test_map[args.test]()
            exit(0 if success else 1)

if __name__ == '__main__':
    main()
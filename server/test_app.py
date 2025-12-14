#!/usr/bin/env python3
"""
Cookie Manager 服务器测试用例
使用pytest框架进行全面测试，包含覆盖率报告
"""

import pytest
import json
import os
import tempfile
import sqlite3
from unittest.mock import patch
from app import app, init_database, generate_pass, cleanup_old_versions

class TestCookieManagerServer:
    """Cookie Manager服务器测试类"""
    
    @pytest.fixture
    def client(self):
        """创建测试客户端"""
        # 创建临时数据库
        db_fd, app.config['DATABASE_PATH'] = tempfile.mkstemp()
        app.config['TESTING'] = True
        
        with app.test_client() as client:
            with app.app_context():
                init_database()
            yield client
        
        os.close(db_fd)
        os.unlink(app.config['DATABASE_PATH'])
    
    @pytest.fixture
    def sample_pass(self, client):
        """创建测试用的Pass ID"""
        response = client.post('/api/pass/create')
        data = json.loads(response.data)
        return data['pass']
    
    @pytest.fixture
    def sample_data(self):
        """测试数据"""
        return {
            'data': 'eyJ0ZXN0IjogInZhbHVlIn0=',  # base64编码的测试数据
            'timestamp': '2024-12-14T10:00:00Z'
        }

    # ==================== 健康检查测试 ====================
    
    def test_health_check(self, client):
        """测试健康检查接口"""
        response = client.get('/health')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['status'] == 'ok'
        assert 'timestamp' in data
        assert 'version' in data

    # ==================== Pass管理测试 ====================
    
    def test_create_pass_success(self, client):
        """测试创建Pass成功"""
        response = client.post('/api/pass/create')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert 'pass' in data
        assert 'created_at' in data
        assert len(data['pass']) == 50  # Pass长度应为50
    
    def test_create_pass_with_domain(self, client):
        """测试带域名创建Pass"""
        payload = {'domain': 'example.com'}
        response = client.post('/api/pass/create', 
                             data=json.dumps(payload),
                             content_type='application/json')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert 'pass' in data
    
    def test_check_pass_exists(self, client, sample_pass):
        """测试检查Pass存在"""
        response = client.get(f'/api/pass/{sample_pass}/check')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['exists'] is True
        assert 'created_at' in data
        assert 'domains' in data
    
    def test_check_pass_not_exists(self, client):
        """测试检查Pass不存在"""
        fake_pass = 'nonexistent_pass_id'
        response = client.get(f'/api/pass/{fake_pass}/check')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['exists'] is False

    # ==================== 数据操作测试 ====================
    
    def test_save_data_success(self, client, sample_pass, sample_data):
        """测试保存数据成功"""
        response = client.post(f'/api/data/{sample_pass}?domain=example.com',
                             data=json.dumps(sample_data),
                             content_type='application/json')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['success'] is True
        assert 'id' in data
        assert 'timestamp' in data
    
    def test_save_data_missing_domain(self, client, sample_pass, sample_data):
        """测试保存数据缺少域名参数"""
        response = client.post(f'/api/data/{sample_pass}',
                             data=json.dumps(sample_data),
                             content_type='application/json')
        assert response.status_code == 400
        
        data = json.loads(response.data)
        assert 'Missing domain parameter' in data['error']
    
    def test_save_data_missing_data_field(self, client, sample_pass):
        """测试保存数据缺少data字段"""
        payload = {'timestamp': '2024-12-14T10:00:00Z'}
        response = client.post(f'/api/data/{sample_pass}?domain=example.com',
                             data=json.dumps(payload),
                             content_type='application/json')
        assert response.status_code == 400
        
        data = json.loads(response.data)
        assert 'Missing data field' in data['error']
    
    def test_save_data_invalid_pass(self, client, sample_data):
        """测试使用无效Pass保存数据"""
        fake_pass = 'invalid_pass_id'
        response = client.post(f'/api/data/{fake_pass}?domain=example.com',
                             data=json.dumps(sample_data),
                             content_type='application/json')
        assert response.status_code == 404
        
        data = json.loads(response.data)
        assert 'Invalid pass ID' in data['error']
    
    def test_save_data_too_large(self, client, sample_pass):
        """测试保存过大数据"""
        large_data = {
            'data': 'x' * (1024 * 1024 + 1),  # 超过1MB
            'timestamp': '2024-12-14T10:00:00Z'
        }
        response = client.post(f'/api/data/{sample_pass}?domain=example.com',
                             data=json.dumps(large_data),
                             content_type='application/json')
        assert response.status_code == 400
        
        data = json.loads(response.data)
        assert 'Data too large' in data['error']
    
    def test_get_data_success(self, client, sample_pass, sample_data):
        """测试获取数据成功"""
        # 先保存数据
        client.post(f'/api/data/{sample_pass}?domain=example.com',
                   data=json.dumps(sample_data),
                   content_type='application/json')
        
        # 获取数据
        response = client.get(f'/api/data/{sample_pass}?domain=example.com')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['data'] == sample_data['data']
        assert 'timestamp' in data
        assert 'id' in data
    
    def test_get_data_missing_domain(self, client, sample_pass):
        """测试获取数据缺少域名参数"""
        response = client.get(f'/api/data/{sample_pass}')
        assert response.status_code == 400
        
        data = json.loads(response.data)
        assert 'Missing domain parameter' in data['error']
    
    def test_get_data_not_found(self, client, sample_pass):
        """测试获取不存在的数据"""
        response = client.get(f'/api/data/{sample_pass}?domain=nonexistent.com')
        assert response.status_code == 404
        
        data = json.loads(response.data)
        assert 'No data found' in data['error']
    
    def test_get_versions_success(self, client, sample_pass, sample_data):
        """测试获取版本历史成功"""
        # 保存多个版本
        for i in range(3):
            data = sample_data.copy()
            data['data'] = f'version_{i}_data'
            client.post(f'/api/data/{sample_pass}?domain=example.com',
                       data=json.dumps(data),
                       content_type='application/json')
        
        # 获取版本历史
        response = client.get(f'/api/data/{sample_pass}/versions?domain=example.com&limit=5')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert 'versions' in data
        assert len(data['versions']) == 3
        
        # 验证版本数据结构
        version = data['versions'][0]
        assert 'id' in version
        assert 'timestamp' in version
        assert 'size' in version
    
    def test_get_versions_missing_domain(self, client, sample_pass):
        """测试获取版本历史缺少域名参数"""
        response = client.get(f'/api/data/{sample_pass}/versions')
        assert response.status_code == 400
        
        data = json.loads(response.data)
        assert 'Missing domain parameter' in data['error']
    
    def test_delete_data_success(self, client, sample_pass, sample_data):
        """测试删除数据成功"""
        # 先保存数据
        client.post(f'/api/data/{sample_pass}?domain=example.com',
                   data=json.dumps(sample_data),
                   content_type='application/json')
        
        # 删除数据
        response = client.delete(f'/api/data/{sample_pass}?domain=example.com')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['success'] is True
        assert data['deleted_count'] >= 1
    
    def test_delete_data_missing_domain(self, client, sample_pass):
        """测试删除数据缺少域名参数"""
        response = client.delete(f'/api/data/{sample_pass}')
        assert response.status_code == 400
        
        data = json.loads(response.data)
        assert 'Missing domain parameter' in data['error']

    # ==================== 快捷访问测试 ====================
    
    def test_quick_access_json(self, client, sample_pass, sample_data):
        """测试快捷访问JSON格式"""
        # 先保存数据
        client.post(f'/api/data/{sample_pass}?domain=example.com',
                   data=json.dumps(sample_data),
                   content_type='application/json')
        
        # 快捷访问
        response = client.get(f'/api/quick/{sample_pass}?domain=example.com&format=json')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['domain'] == 'example.com'
        assert data['pass'] == sample_pass
        assert data['data'] == sample_data['data']
        assert 'quick_url' in data
    
    def test_quick_access_html(self, client, sample_pass, sample_data):
        """测试快捷访问HTML格式"""
        # 先保存数据
        client.post(f'/api/data/{sample_pass}?domain=example.com',
                   data=json.dumps(sample_data),
                   content_type='application/json')
        
        # 快捷访问HTML
        response = client.get(f'/api/quick/{sample_pass}?domain=example.com&format=html')
        assert response.status_code == 200
        assert b'Cookie Data for example.com' in response.data
        assert sample_pass.encode() in response.data
    
    def test_quick_access_missing_domain(self, client, sample_pass):
        """测试快捷访问缺少域名参数"""
        response = client.get(f'/api/quick/{sample_pass}')
        assert response.status_code == 400
        
        data = json.loads(response.data)
        assert 'Missing domain parameter' in data['error']
    
    def test_quick_access_not_found_json(self, client, sample_pass):
        """测试快捷访问数据不存在(JSON)"""
        response = client.get(f'/api/quick/{sample_pass}?domain=nonexistent.com&format=json')
        assert response.status_code == 404
        
        data = json.loads(response.data)
        assert 'No data found' in data['error']
    
    def test_quick_access_not_found_html(self, client, sample_pass):
        """测试快捷访问数据不存在(HTML)"""
        response = client.get(f'/api/quick/{sample_pass}?domain=nonexistent.com&format=html')
        assert response.status_code == 404
        assert b'No data found' in response.data

    # ==================== 统计信息测试 ====================
    
    def test_get_pass_stats_success(self, client, sample_pass, sample_data):
        """测试获取Pass统计信息成功"""
        # 保存一些测试数据
        domains = ['example.com', 'test.com']
        for domain in domains:
            client.post(f'/api/data/{sample_pass}?domain={domain}',
                       data=json.dumps(sample_data),
                       content_type='application/json')
        
        # 获取统计信息
        response = client.get(f'/api/stats/{sample_pass}')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert data['pass'] == sample_pass
        assert data['domain_count'] == 2
        assert data['total_size'] > 0
        assert 'domains' in data
        assert len(data['domains']) == 2
    
    def test_get_pass_stats_not_found(self, client):
        """测试获取不存在Pass的统计信息"""
        fake_pass = 'nonexistent_pass'
        response = client.get(f'/api/stats/{fake_pass}')
        assert response.status_code == 404
        
        data = json.loads(response.data)
        assert 'Pass not found' in data['error']
    
    def test_get_server_stats(self, client, sample_pass, sample_data):
        """测试获取服务器统计信息"""
        # 保存一些测试数据
        client.post(f'/api/data/{sample_pass}?domain=example.com',
                   data=json.dumps(sample_data),
                   content_type='application/json')
        
        # 获取服务器统计
        response = client.get('/api/stats/server')
        assert response.status_code == 200
        
        data = json.loads(response.data)
        assert 'total_passes' in data
        assert 'total_domains' in data
        assert 'total_size_bytes' in data
        assert 'total_size_mb' in data
        assert 'max_data_size_mb' in data
        assert 'max_versions_per_domain' in data

    # ==================== 错误处理测试 ====================
    
    def test_404_error(self, client):
        """测试404错误处理"""
        response = client.get('/nonexistent/endpoint')
        assert response.status_code == 404
        
        data = json.loads(response.data)
        assert 'Endpoint not found' in data['error']
    
    def test_invalid_json(self, client, sample_pass):
        """测试无效JSON数据"""
        response = client.post(f'/api/data/{sample_pass}?domain=example.com',
                             data='invalid json',
                             content_type='application/json')
        assert response.status_code == 400

    # ==================== 工具函数测试 ====================
    
    def test_generate_pass(self):
        """测试Pass生成函数"""
        pass1 = generate_pass()
        pass2 = generate_pass()
        
        # 验证长度
        assert len(pass1) == 50
        assert len(pass2) == 50
        
        # 验证唯一性
        assert pass1 != pass2
        
        # 验证字符集
        import string
        valid_chars = set(string.ascii_letters + string.digits)
        assert all(c in valid_chars for c in pass1)
    
    def test_cleanup_old_versions(self, client, sample_pass):
        """测试版本清理功能"""
        # 创建超过限制的版本数
        sample_data = {
            'data': 'test_data',
            'timestamp': '2024-12-14T10:00:00Z'
        }
        
        # 保存15个版本（超过MAX_VERSIONS=10）
        for i in range(15):
            data = sample_data.copy()
            data['data'] = f'version_{i}'
            client.post(f'/api/data/{sample_pass}?domain=example.com',
                       data=json.dumps(data),
                       content_type='application/json')
        
        # 验证只保留了最新的10个版本
        response = client.get(f'/api/data/{sample_pass}/versions?domain=example.com&limit=20')
        data = json.loads(response.data)
        assert len(data['versions']) <= 10

    # ==================== 集成测试 ====================
    
    def test_full_workflow(self, client):
        """测试完整工作流程"""
        # 1. 创建Pass
        response = client.post('/api/pass/create')
        pass_data = json.loads(response.data)
        pass_id = pass_data['pass']
        
        # 2. 验证Pass
        response = client.get(f'/api/pass/{pass_id}/check')
        assert response.status_code == 200
        
        # 3. 保存数据
        test_data = {
            'data': 'eyJ0ZXN0IjogInZhbHVlIn0=',
            'timestamp': '2024-12-14T10:00:00Z'
        }
        response = client.post(f'/api/data/{pass_id}?domain=example.com',
                             data=json.dumps(test_data),
                             content_type='application/json')
        assert response.status_code == 200
        
        # 4. 获取数据
        response = client.get(f'/api/data/{pass_id}?domain=example.com')
        assert response.status_code == 200
        retrieved_data = json.loads(response.data)
        assert retrieved_data['data'] == test_data['data']
        
        # 5. 快捷访问
        response = client.get(f'/api/quick/{pass_id}?domain=example.com')
        assert response.status_code == 200
        
        # 6. 获取统计
        response = client.get(f'/api/stats/{pass_id}')
        assert response.status_code == 200
        stats = json.loads(response.data)
        assert stats['domain_count'] == 1
        
        # 7. 删除数据
        response = client.delete(f'/api/data/{pass_id}?domain=example.com')
        assert response.status_code == 200


# ==================== 性能测试 ====================

class TestPerformance:
    """性能测试类"""
    
    @pytest.fixture
    def client(self):
        """创建测试客户端"""
        db_fd, app.config['DATABASE_PATH'] = tempfile.mkstemp()
        app.config['TESTING'] = True
        
        with app.test_client() as client:
            with app.app_context():
                init_database()
            yield client
        
        os.close(db_fd)
        os.unlink(app.config['DATABASE_PATH'])
    
    def test_concurrent_pass_creation(self, client):
        """测试并发创建Pass"""
        import threading
        import time
        
        results = []
        
        def create_pass():
            response = client.post('/api/pass/create')
            results.append(response.status_code)
        
        # 创建10个并发线程
        threads = []
        for _ in range(10):
            thread = threading.Thread(target=create_pass)
            threads.append(thread)
        
        # 启动所有线程
        start_time = time.time()
        for thread in threads:
            thread.start()
        
        # 等待所有线程完成
        for thread in threads:
            thread.join()
        
        end_time = time.time()
        
        # 验证结果
        assert len(results) == 10
        assert all(status == 200 for status in results)
        assert end_time - start_time < 5  # 应该在5秒内完成
    
    def test_large_data_handling(self, client):
        """测试大数据处理"""
        # 创建Pass
        response = client.post('/api/pass/create')
        pass_data = json.loads(response.data)
        pass_id = pass_data['pass']
        
        # 测试接近限制的大数据
        large_data = {
            'data': 'x' * (1024 * 1024 - 1000),  # 接近1MB
            'timestamp': '2024-12-14T10:00:00Z'
        }
        
        import time
        start_time = time.time()
        
        response = client.post(f'/api/data/{pass_id}?domain=example.com',
                             data=json.dumps(large_data),
                             content_type='application/json')
        
        end_time = time.time()
        
        assert response.status_code == 200
        assert end_time - start_time < 10  # 应该在10秒内完成


if __name__ == '__main__':
    # 运行测试
    pytest.main([
        __file__,
        '-v',                    # 详细输出
        '--cov=app',            # 覆盖率测试
        '--cov-report=html',    # HTML覆盖率报告
        '--cov-report=term',    # 终端覆盖率报告
        '--tb=short'            # 简短的错误回溯
    ])
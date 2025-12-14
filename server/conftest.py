"""
pytest配置文件
提供全局fixtures和测试配置
"""

import pytest
import os
import tempfile
import sqlite3
from app import app, init_database

@pytest.fixture(scope="session")
def test_database():
    """会话级别的测试数据库"""
    db_fd, db_path = tempfile.mkstemp()
    
    # 设置测试数据库路径
    original_path = os.environ.get('DATABASE_PATH')
    os.environ['DATABASE_PATH'] = db_path
    
    # 初始化数据库
    with sqlite3.connect(db_path) as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS passes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pass_id TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        conn.execute('''
            CREATE TABLE IF NOT EXISTS data_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pass_id TEXT NOT NULL,
                domain TEXT NOT NULL,
                data TEXT NOT NULL,
                size INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (pass_id) REFERENCES passes(pass_id)
            )
        ''')
        
        conn.execute('CREATE INDEX IF NOT EXISTS idx_pass_domain ON data_entries(pass_id, domain)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_created_at ON data_entries(created_at DESC)')
        conn.commit()
    
    yield db_path
    
    # 清理
    os.close(db_fd)
    os.unlink(db_path)
    
    # 恢复原始路径
    if original_path:
        os.environ['DATABASE_PATH'] = original_path
    elif 'DATABASE_PATH' in os.environ:
        del os.environ['DATABASE_PATH']

@pytest.fixture
def clean_database(test_database):
    """每个测试前清理数据库"""
    with sqlite3.connect(test_database) as conn:
        conn.execute('DELETE FROM data_entries')
        conn.execute('DELETE FROM passes')
        conn.commit()
    
    yield test_database

def pytest_configure(config):
    """pytest配置"""
    # 设置测试环境变量
    os.environ['FLASK_ENV'] = 'testing'
    os.environ['MAX_DATA_SIZE'] = '1048576'  # 1MB
    os.environ['MAX_VERSIONS'] = '10'

def pytest_collection_modifyitems(config, items):
    """修改测试收集"""
    # 为慢速测试添加标记
    for item in items:
        if "performance" in item.nodeid:
            item.add_marker(pytest.mark.slow)
        if "integration" in item.nodeid:
            item.add_marker(pytest.mark.integration)
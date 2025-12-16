FROM python:3.11-slim

WORKDIR /app

# 安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY app.py .
COPY templates/ templates/

# 创建数据目录
RUN mkdir -p /app/data

# 设置环境变量
ENV FLASK_ENV=production
ENV DATABASE_PATH=/app/data/database.db
ENV MAX_DATA_SIZE=1048576
ENV MAX_VERSIONS=10

# 暴露端口
EXPOSE 5000

# 启动应用
CMD ["python", "app.py"]
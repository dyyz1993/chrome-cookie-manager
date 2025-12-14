#!/usr/bin/env python3
"""
使用PIL和svglib转换SVG为PNG
"""

import os
from PIL import Image
import io

def convert_svg_to_png():
    """使用在线转换方法创建PNG图标"""
    # 创建一个简单的PNG图标作为替代方案
    sizes = [16, 32, 48, 128]
    
    # 创建icons目录
    os.makedirs("icons", exist_ok=True)
    
    for size in sizes:
        # 创建一个新的图像
        img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        
        # 绘制一个简单的饼干图标
        from PIL import ImageDraw
        
        draw = ImageDraw.Draw(img)
        
        # 饼干主体 (棕色圆形)
        center = size // 2
        radius = int(size * 0.4)
        draw.ellipse([center - radius, center - radius, center + radius, center + radius], 
                    fill=(212, 165, 116, 255))
        
        # 巧克力豆
        chip_radius = max(1, size // 16)
        positions = [
            (int(center * 0.7), int(center * 0.7)),
            (int(center * 1.3), int(center * 0.8)),
            (int(center * 1.1), int(center * 1.2)),
            (int(center * 0.8), int(center * 1.3)),
            (int(center * 1.3), int(center * 1.3))
        ]
        
        for x, y in positions:
            if 0 <= x < size and 0 <= y < size:
                draw.ellipse([x - chip_radius, y - chip_radius, x + chip_radius, y + chip_radius], 
                           fill=(93, 64, 55, 255))
        
        # 保存图像
        img.save(f"icons/icon{size}.png")
        print(f"已生成 icons/icon{size}.png")
    
    print("所有图标生成完成!")

if __name__ == "__main__":
    convert_svg_to_png()
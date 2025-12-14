#!/usr/bin/env python3
"""
SVG图标转PNG工具
将SVG图标转换为多种尺寸的PNG格式，用于Chrome插件
"""

import os
import subprocess
import sys

def check_dependencies():
    """检查必要的依赖是否安装"""
    try:
        import cairosvg
        return True
    except ImportError:
        print("错误: 需要安装cairosvg库")
        print("请运行: pip install cairosvg")
        return False

def convert_svg_to_png(svg_path, output_dir, sizes):
    """
    将SVG转换为多种尺寸的PNG
    
    Args:
        svg_path: SVG文件路径
        output_dir: 输出目录
        sizes: 需要生成的尺寸列表
    """
    if not check_dependencies():
        return False
    
    # 创建输出目录
    os.makedirs(output_dir, exist_ok=True)
    
    try:
        import cairosvg
        
        for size in sizes:
            output_path = os.path.join(output_dir, f"icon{size}.png")
            print(f"正在生成 {size}x{size} 的图标: {output_path}")
            
            # 使用cairosvg转换
            cairosvg.svg2png(
                url=svg_path,
                write_to=output_path,
                output_width=size,
                output_height=size
            )
            
        print("所有图标生成完成!")
        return True
        
    except Exception as e:
        print(f"转换过程中出现错误: {e}")
        return False

def main():
    """主函数"""
    # 获取当前脚本所在目录
    current_dir = os.path.dirname(os.path.abspath(__file__))
    svg_path = os.path.join(current_dir, "icon.svg")
    icons_dir = os.path.join(current_dir, "icons")
    
    # 检查SVG文件是否存在
    if not os.path.exists(svg_path):
        print(f"错误: 找不到SVG文件 {svg_path}")
        sys.exit(1)
    
    # Chrome插件需要的图标尺寸
    sizes = [16, 32, 48, 128]
    
    # 转换SVG到PNG
    success = convert_svg_to_png(svg_path, icons_dir, sizes)
    
    if success:
        print("\n图标转换成功完成!")
        print(f"生成的图标位于: {icons_dir}")
        for size in sizes:
            print(f"  - icon{size}.png")
    else:
        print("\n图标转换失败!")
        sys.exit(1)

if __name__ == "__main__":
    main()
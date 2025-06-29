#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
图标生成脚本
将SVG图标转换为不同尺寸的PNG文件
"""

import os
import subprocess
import sys

def check_dependencies():
    """检查依赖"""
    try:
        import cairosvg
        return True
    except ImportError:
        print("需要安装 cairosvg 库")
        print("运行: pip install cairosvg")
        return False

def generate_icons():
    """生成图标"""
    if not check_dependencies():
        return False
    
    try:
        import cairosvg
        
        # 图标尺寸
        sizes = [16, 48, 128]
        
        for size in sizes:
            output_file = f"icon{size}.png"
            print(f"生成 {output_file}...")
            
            # 使用cairosvg转换SVG到PNG
            cairosvg.svg2png(
                url="icon.svg",
                write_to=output_file,
                output_width=size,
                output_height=size
            )
            
            print(f"✓ {output_file} 生成完成")
        
        return True
        
    except Exception as e:
        print(f"生成图标时出错: {e}")
        return False

def create_simple_icons():
    """创建简单的纯色图标（备用方案）"""
    try:
        from PIL import Image, ImageDraw, ImageFont
        
        sizes = [16, 48, 128]
        
        for size in sizes:
            # 创建图像
            img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
            draw = ImageDraw.Draw(img)
            
            # 绘制圆形背景
            margin = size // 10
            draw.ellipse([margin, margin, size-margin, size-margin], 
                        fill=(102, 126, 234, 255))
            
            # 添加文字
            try:
                font_size = size // 3
                font = ImageFont.truetype("arial.ttf", font_size)
            except:
                font = ImageFont.load_default()
            
            text = "ETH"
            bbox = draw.textbbox((0, 0), text, font=font)
            text_width = bbox[2] - bbox[0]
            text_height = bbox[3] - bbox[1]
            
            x = (size - text_width) // 2
            y = (size - text_height) // 2
            
            draw.text((x, y), text, fill=(255, 255, 255, 255), font=font)
            
            # 保存
            output_file = f"icon{size}.png"
            img.save(output_file)
            print(f"✓ {output_file} 生成完成")
        
        return True
        
    except ImportError:
        print("PIL库未安装，无法生成备用图标")
        return False
    except Exception as e:
        print(f"生成备用图标时出错: {e}")
        return False

if __name__ == "__main__":
    print("ETH价格监控器 - 图标生成器")
    print("=" * 40)
    
    # 检查当前目录
    if not os.path.exists("icon.svg"):
        print("错误: 找不到 icon.svg 文件")
        print("请确保在extension/icons目录下运行此脚本")
        sys.exit(1)
    
    # 尝试生成图标
    if generate_icons():
        print("\n所有图标生成完成！")
    else:
        print("\n尝试生成备用图标...")
        if create_simple_icons():
            print("备用图标生成完成！")
        else:
            print("图标生成失败，请手动创建图标文件")
            print("需要创建: icon16.png, icon48.png, icon128.png") 
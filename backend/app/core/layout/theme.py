"""
主题系统 - 管理图表的颜色、样式、视觉效果
"""
from typing import Dict, Any, Optional
from enum import Enum


class ThemeType(str, Enum):
    """主题类型"""
    BUSINESS = "business"  # 商务主题（蓝+灰）
    VIBRANT = "vibrant"  # 活泼主题（橙+青）
    DARK = "dark"  # 暗色主题
    FLAT = "flat"  # 扁平主题（无阴影）
    HANDDRAWN = "handdrawn"  # 手绘风格
    INDUSTRIAL = "industrial"  # 工业主题（黑+黄）
    DEFAULT = "default"  # 默认主题


class Theme:
    """主题类"""
    
    THEMES = {
        ThemeType.BUSINESS: {
            "primary": "#4A90E2",  # 蓝色
            "secondary": "#7B8A95",  # 灰色
            "accent": "#50C878",  # 绿色
            "background": "#FFFFFF",
            "text": "#2C3E50",
            "lineColor": "#4A90E2",
            "lineWidth": 2,
            "cornerRadius": 8,
            "shadow": False
        },
        ThemeType.VIBRANT: {
            "primary": "#FF6B6B",  # 红色
            "secondary": "#4ECDC4",  # 青色
            "accent": "#FFE66D",  # 黄色
            "background": "#FFFFFF",
            "text": "#2C3E50",
            "lineColor": "#4ECDC4",
            "lineWidth": 2,
            "cornerRadius": 10,
            "shadow": False
        },
        ThemeType.DARK: {
            "primary": "#6C5CE7",  # 紫色
            "secondary": "#A29BFE",  # 浅紫色
            "accent": "#00B894",  # 绿色
            "background": "#2D3436",
            "text": "#FFFFFF",
            "lineColor": "#6C5CE7",
            "lineWidth": 2,
            "cornerRadius": 8,
            "shadow": True
        },
        ThemeType.FLAT: {
            "primary": "#3498DB",  # 蓝色
            "secondary": "#E74C3C",  # 红色
            "accent": "#F39C12",  # 橙色
            "background": "#FFFFFF",
            "text": "#34495E",
            "lineColor": "#95A5A6",
            "lineWidth": 2,
            "cornerRadius": 0,
            "shadow": False
        },
        ThemeType.HANDDRAWN: {
            "primary": "#2C3E50",  # 深灰
            "secondary": "#34495E",  # 灰色
            "accent": "#E67E22",  # 橙色
            "background": "#FDF6E3",
            "text": "#2C3E50",
            "lineColor": "#2C3E50",
            "lineWidth": 3,
            "cornerRadius": 5,
            "shadow": False
        },
        ThemeType.INDUSTRIAL: {
            "primary": "#000000",  # 黑色
            "secondary": "#FFD700",  # 金色
            "accent": "#FF6B35",  # 橙红
            "background": "#FFFFFF",
            "text": "#000000",
            "lineColor": "#000000",
            "lineWidth": 3,
            "cornerRadius": 0,
            "shadow": False
        },
        ThemeType.DEFAULT: {
            "primary": "#1976d2",  # 蓝色
            "secondary": "#34a853",  # 绿色
            "accent": "#fb8c00",  # 橙色
            "background": "#FFFFFF",
            "text": "#202124",
            "lineColor": "#1976d2",
            "lineWidth": 2,
            "cornerRadius": 8,
            "shadow": False
        }
    }
    
    # 形状对应的颜色
    SHAPE_COLORS = {
        "rectangle": "primary",
        "ellipse": "secondary",
        "diamond": "accent",
        "text": "text"
    }
    
    @classmethod
    def get_theme(cls, theme_type: ThemeType = ThemeType.DEFAULT) -> Dict[str, Any]:
        """获取主题配置"""
        return cls.THEMES.get(theme_type, cls.THEMES[ThemeType.DEFAULT])
    
    @classmethod
    def get_shape_color(cls, shape: str, theme_type: ThemeType = ThemeType.DEFAULT) -> str:
        """获取形状对应的颜色"""
        theme = cls.get_theme(theme_type)
        color_key = cls.SHAPE_COLORS.get(shape, "primary")
        return theme.get(color_key, theme["primary"])
    
    @classmethod
    def get_background_color(cls, theme_type: ThemeType = ThemeType.DEFAULT) -> str:
        """获取背景颜色"""
        theme = cls.get_theme(theme_type)
        return theme.get("background", "#FFFFFF")
    
    @classmethod
    def get_line_color(cls, theme_type: ThemeType = ThemeType.DEFAULT) -> str:
        """获取线条颜色"""
        theme = cls.get_theme(theme_type)
        return theme.get("lineColor", theme["primary"])
    
    @classmethod
    def get_line_width(cls, theme_type: ThemeType = ThemeType.DEFAULT) -> int:
        """获取线条宽度"""
        theme = cls.get_theme(theme_type)
        return theme.get("lineWidth", 2)
    
    @classmethod
    def get_corner_radius(cls, theme_type: ThemeType = ThemeType.DEFAULT) -> int:
        """获取圆角半径"""
        theme = cls.get_theme(theme_type)
        return theme.get("cornerRadius", 8)





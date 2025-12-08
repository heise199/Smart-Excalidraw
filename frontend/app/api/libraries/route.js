import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * 根据文件名获取库文件分类（按优先级顺序检查，使用精确匹配）
 */
function getLibraryCategory(fileName) {
  const name = fileName.toLowerCase().trim();
  
  // 架构相关（优先检查，因为可能包含其他关键词）
  if (name.includes('architecture') || name.includes('system-design') || name.includes('aws-architecture')) {
    return '架构设计';
  }
  
  // 数据相关（精确匹配）
  if (name.includes('data-science') || name.includes('data-viz') || 
      (name.startsWith('data') && !name.includes('database'))) {
    return '数据科学';
  }
  
  // 开发运维（精确匹配）
  if (name.includes('dev_ops') || name.includes('dev-ops') || name.includes('devops') || 
      (name.includes('dev') && name.includes('ops')) || name === 'cloud' || name.includes('cloud')) {
    return '开发运维';
  }
  
  // UI/设计
  if (name.includes('logo') || name.includes('hearts') || 
      name.includes('stick-figure') || name.includes('stick-figures') || name.includes('stickfigure')) {
    return 'UI/设计';
  }
  
  // 电路/硬件
  if (name.includes('circuit')) {
    return '电路/硬件';
  }
  
  // 其他
  return '其他';
}

/**
 * GET /api/libraries
 * 自动扫描 public/libraries 目录下的所有 .excalidrawlib 文件
 * 返回文件列表和分类信息
 */
export async function GET() {
  try {
    // 获取 public/libraries 目录的绝对路径
    const librariesDir = path.join(process.cwd(), 'public', 'libraries');
    
    // 检查目录是否存在
    if (!fs.existsSync(librariesDir)) {
      return NextResponse.json({ 
        files: [],
        categories: {},
        message: 'Libraries directory does not exist'
      });
    }

    // 读取目录下的所有文件
    const files = fs.readdirSync(librariesDir);
    
    // 过滤出 .excalidrawlib 文件并添加分类信息
    const libraryFiles = files
      .filter(file => file.endsWith('.excalidrawlib'))
      .map(file => {
        const fileName = file.replace('.excalidrawlib', '');
        return {
          path: `/libraries/${file}`, // 返回相对于 public 的路径
          name: fileName,
          category: getLibraryCategory(fileName)
        };
      });

    // 按分类组织文件
    const categories = {};
    libraryFiles.forEach(file => {
      if (!categories[file.category]) {
        categories[file.category] = [];
      }
      categories[file.category].push(file);
    });

    // 调试信息：输出每个文件的分类
    console.log('📁 Library files classification:');
    libraryFiles.forEach(file => {
      console.log(`  - ${file.name} -> ${file.category}`);
    });
    console.log('📊 Categories summary:', Object.keys(categories).map(cat => ({
      category: cat,
      count: categories[cat].length,
      files: categories[cat].map(f => f.name)
    })));

    return NextResponse.json({ 
      files: libraryFiles.map(f => f.path), // 保持向后兼容
      filesWithCategory: libraryFiles, // 包含分类信息的完整列表
      categories: categories, // 按分类组织的文件
      count: libraryFiles.length
    });
  } catch (error) {
    console.error('Error scanning libraries directory:', error);
    return NextResponse.json(
      { 
        error: 'Failed to scan libraries directory',
        message: error.message,
        files: [],
        categories: {}
      },
      { status: 500 }
    );
  }
}


# Excalidraw Libraries 加载指南

## 概述

Excalidraw 支持加载外部组件库（Libraries）来扩展绘图功能。组件库文件通常是 `.excalidrawlib` 格式，包含预定义的图形元素集合。

## Libraries 文件格式

`.excalidrawlib` 文件是一个 JSON 文件，包含以下结构：

```json
{
  "type": "excalidrawlib",
  "version": 2,
  "libraryItems": [
    {
      "id": "...",
      "type": "rectangle",
      "x": 0,
      "y": 0,
      "width": 100,
      "height": 100,
      // ... 其他元素属性
    }
  ]
}
```

## 加载方式

### 方式一：通过 `libraryItems` prop 加载

在 `Excalidraw` 组件中直接传递 `libraryItems` prop：

```javascript
import { Excalidraw } from '@excalidraw/excalidraw';

function App() {
  // 从文件加载或直接定义 libraryItems
  const libraryItems = [
    {
      id: "item-1",
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      backgroundColor: "#ff6b6b"
    },
    // ... 更多库项
  ];

  return (
    <Excalidraw
      libraryItems={libraryItems}
      // ... 其他 props
    />
  );
}
```

### 方式二：通过 `initialData.libraryItems` 初始化加载

在 `initialData` 中传递 `libraryItems`：

```javascript
<Excalidraw
  initialData={{
    elements: [],
    libraryItems: libraryItems, // 初始化时加载库
    appState: {}
  }}
/>
```

### 方式三：通过 API 动态加载

使用 Excalidraw API 的 `loadLibraryItems` 方法动态加载：

```javascript
import { useState, useEffect } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';

function App() {
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);

  useEffect(() => {
    if (excalidrawAPI) {
      // 加载库文件
      loadLibraryFromFile('/path/to/library.excalidrawlib')
        .then(libraryItems => {
          excalidrawAPI.loadLibraryItems(libraryItems);
        });
    }
  }, [excalidrawAPI]);

  // 从文件加载库
  const loadLibraryFromFile = async (filePath) => {
    const response = await fetch(filePath);
    const data = await response.json();
    return data.libraryItems || [];
  };

  return (
    <Excalidraw
      excalidrawAPI={(api) => setExcalidrawAPI(api)}
    />
  );
}
```

### 方式四：从本地文件系统加载

如果用户已经下载了 `.excalidrawlib` 文件，可以通过文件输入加载：

```javascript
import { useState } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';

function App() {
  const [libraryItems, setLibraryItems] = useState([]);
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);

  const handleFileLoad = async (event) => {
    const file = event.target.files[0];
    if (file && file.name.endsWith('.excalidrawlib')) {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (data.libraryItems) {
        setLibraryItems(data.libraryItems);
        // 如果 API 已加载，直接更新
        if (excalidrawAPI) {
          excalidrawAPI.loadLibraryItems(data.libraryItems);
        }
      }
    }
  };

  return (
    <div>
      <input
        type="file"
        accept=".excalidrawlib"
        onChange={handleFileLoad}
      />
      <Excalidraw
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
        libraryItems={libraryItems}
      />
    </div>
  );
}
```

## 在 ExcalidrawCanvas 中集成

### 步骤 1：添加库文件存储

在 `public` 目录下创建 `libraries` 文件夹，存放 `.excalidrawlib` 文件：

```
frontend/
  public/
    libraries/
      shapes.excalidrawlib
      icons.excalidrawlib
      ...
```

### 步骤 2：修改 ExcalidrawCanvas 组件

在 `ExcalidrawCanvas.jsx` 中添加库加载功能：

```javascript
// 在组件顶部添加状态
const [libraryItems, setLibraryItems] = useState([]);

// 加载库文件的函数
const loadLibraryItems = async (libraryPaths) => {
  try {
    const allItems = [];
    for (const path of libraryPaths) {
      const response = await fetch(path);
      const data = await response.json();
      if (data.libraryItems) {
        allItems.push(...data.libraryItems);
      }
    }
    setLibraryItems(allItems);
  } catch (error) {
    console.error('Failed to load library:', error);
  }
};

// 在 useEffect 中加载库
useEffect(() => {
  // 加载默认库
  loadLibraryItems([
    '/libraries/shapes.excalidrawlib',
    '/libraries/icons.excalidrawlib',
  ]);
}, []);

// 在 Excalidraw 组件中添加 libraryItems prop
<Excalidraw
  libraryItems={libraryItems}
  // ... 其他 props
/>
```

### 步骤 3：通过 API 动态加载

如果需要在运行时动态加载库：

```javascript
useEffect(() => {
  if (excalidrawAPI && libraryItems.length > 0) {
    excalidrawAPI.loadLibraryItems(libraryItems);
  }
}, [excalidrawAPI, libraryItems]);
```

## 完整示例

以下是一个完整的示例，展示如何在 ExcalidrawCanvas 中加载 libraries：

```javascript
'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useRef } from 'react';
import '@excalidraw/excalidraw/index.css';

const Excalidraw = dynamic(
  async () => (await import('@excalidraw/excalidraw')).Excalidraw,
  { ssr: false }
);

export default function ExcalidrawCanvas({ elements = [], onElementsChange }) {
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const [libraryItems, setLibraryItems] = useState([]);

  // 加载库文件
  useEffect(() => {
    const loadLibraries = async () => {
      try {
        // 从 public/libraries 目录加载库文件
        const libraryPaths = [
          '/libraries/shapes.excalidrawlib',
          // 添加更多库文件路径
        ];

        const allItems = [];
        for (const path of libraryPaths) {
          try {
            const response = await fetch(path);
            if (response.ok) {
              const data = await response.json();
              if (data.libraryItems && Array.isArray(data.libraryItems)) {
                allItems.push(...data.libraryItems);
              }
            }
          } catch (error) {
            console.warn(`Failed to load library from ${path}:`, error);
          }
        }

        setLibraryItems(allItems);
      } catch (error) {
        console.error('Error loading libraries:', error);
      }
    };

    loadLibraries();
  }, []);

  // 当 API 和库项都准备好时，加载库
  useEffect(() => {
    if (excalidrawAPI && libraryItems.length > 0) {
      try {
        excalidrawAPI.loadLibraryItems(libraryItems);
        console.log('Library items loaded:', libraryItems.length);
      } catch (error) {
        console.error('Failed to load library items:', error);
      }
    }
  }, [excalidrawAPI, libraryItems]);

  return (
    <div className="w-full h-full">
      <Excalidraw
        excalidrawAPI={(api) => {
          if (api) {
            setExcalidrawAPI(api);
          }
        }}
        libraryItems={libraryItems}
        initialData={{
          elements: elements || [],
          libraryItems: libraryItems, // 也可以在 initialData 中传递
          appState: {
            viewBackgroundColor: '#ffffff',
          },
        }}
        onChange={(excalidrawElements, appState, files) => {
          if (onElementsChange) {
            onElementsChange(excalidrawElements);
          }
        }}
      />
    </div>
  );
}
```

## 用户上传库文件

如果需要支持用户上传 `.excalidrawlib` 文件：

```javascript
const handleLibraryUpload = async (event) => {
  const file = event.target.files[0];
  if (!file || !file.name.endsWith('.excalidrawlib')) {
    alert('请选择 .excalidrawlib 文件');
    return;
  }

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    
    if (data.libraryItems && Array.isArray(data.libraryItems)) {
      // 合并到现有库
      setLibraryItems(prev => [...prev, ...data.libraryItems]);
      
      // 或者通过 API 加载
      if (excalidrawAPI) {
        excalidrawAPI.loadLibraryItems(data.libraryItems);
      }
    }
  } catch (error) {
    console.error('Failed to parse library file:', error);
    alert('库文件格式错误');
  }
};

// 在 JSX 中添加文件输入
<input
  type="file"
  accept=".excalidrawlib"
  onChange={handleLibraryUpload}
  style={{ display: 'none' }}
  id="library-upload"
/>
<label htmlFor="library-upload">
  <button>上传库文件</button>
</label>
```

## 注意事项

1. **文件路径**：确保库文件路径正确，如果放在 `public` 目录下，路径应该以 `/` 开头。

2. **文件格式**：确保 `.excalidrawlib` 文件格式正确，包含 `libraryItems` 数组。

3. **加载时机**：建议在组件挂载后加载库，避免阻塞初始渲染。

4. **错误处理**：添加适当的错误处理，避免单个库文件加载失败影响整体功能。

5. **性能考虑**：如果库文件很大，考虑延迟加载或按需加载。

6. **API 方法**：`loadLibraryItems` 方法会合并新库项到现有库中，而不是替换。

## 参考资源

- [Excalidraw Libraries 网站](https://libraries.excalidraw.com)
- [Excalidraw API 文档](https://docs.excalidraw.com)
- [GitHub: Excalidraw](https://github.com/excalidraw/excalidraw)


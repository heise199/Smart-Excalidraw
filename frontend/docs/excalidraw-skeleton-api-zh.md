# ExcalidrawElementSkeleton API 详细中文文档

> 本文档详细说明如何使用 ExcalidrawElementSkeleton API 程序化创建 Excalidraw 图表元素

## 目录

1. [概述](#概述)
2. [核心函数](#核心函数)
3. [元素类型详解](#元素类型详解)
4. [属性参考](#属性参考)
5. [最佳实践](#最佳实践)
6. [完整示例](#完整示例)

---

## 概述

### 什么是 ExcalidrawElementSkeleton？

`ExcalidrawElementSkeleton` 是 Excalidraw 提供的简化 API，用于程序化生成图表元素。它是完整 `ExcalidrawElement` 类型的简化版本，只需要提供最少的必要属性即可创建元素。

### 为什么使用 Skeleton API？

- **简化创建**：只需提供必要属性，系统自动补全其他属性
- **易于绑定**：特别适合创建箭头绑定、文本容器等复杂场景
- **自动计算**：未提供的尺寸、坐标等属性会自动计算

### 工作流程

```
ExcalidrawElementSkeleton (骨架代码)
  ↓
convertToExcalidrawElements() (转换函数)
  ↓
ExcalidrawElement[] (完整元素)
  ↓
Excalidraw 画布渲染
```

---

## 核心函数

### convertToExcalidrawElements

**函数签名：**
```typescript
convertToExcalidrawElements(
  elements: ExcalidrawElementSkeleton | ExcalidrawElementSkeleton[],
  opts?: { regenerateIds: boolean }
): ExcalidrawElement[]
```

**参数说明：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `elements` | `ExcalidrawElementSkeleton` 或数组 | - | 需要转换的骨架元素 |
| `opts.regenerateIds` | `boolean` | `true` | 是否重新生成元素 ID |

**使用示例：**
```javascript
import { convertToExcalidrawElements } from "@excalidraw/excalidraw";

const elements = convertToExcalidrawElements([
  {
    type: "rectangle",
    x: 100,
    y: 100,
    width: 200,
    height: 100
  }
]);
```

**重要提示：**
- 必须在使用 `initialData`、`updateScene` 等 API 之前调用此函数
- 默认会重新生成所有元素的 ID，如需保留原始 ID，设置 `regenerateIds: false`

---

## 元素类型详解

### 1. 矩形 (Rectangle)

**必填属性：** `type`, `x`, `y`  
**可选属性：** `width`, `height`, `strokeColor`, `backgroundColor`, `strokeWidth`, `strokeStyle`, `fillStyle`, `roundness`, `opacity`, `angle`, `locked`, `link`, `label`

**基础示例：**
```javascript
{
  type: "rectangle",
  x: 100,
  y: 100
}
```

**完整示例：**
```javascript
{
  type: "rectangle",
  x: 100,
  y: 100,
  width: 200,
  height: 100,
  backgroundColor: "#c0eb75",
  strokeColor: "#1976d2",
  strokeWidth: 2,
  strokeStyle: "solid",
  fillStyle: "hachure",
  roundness: { type: 3 }, // 圆角
  opacity: 1.0,
  angle: 0,
  locked: false
}
```

**文本容器：**
```javascript
{
  type: "rectangle",
  x: 100,
  y: 100,
  label: {
    text: "矩形文本容器",
    fontSize: 18,
    strokeColor: "#000000",
    textAlign: "center",
    verticalAlign: "middle"
  }
  // width 和 height 会根据 label 文本自动计算
}
```

---

### 2. 椭圆 (Ellipse)

**必填属性：** `type`, `x`, `y`  
**可选属性：** 与矩形相同

**基础示例：**
```javascript
{
  type: "ellipse",
  x: 250,
  y: 250
}
```

**完整示例：**
```javascript
{
  type: "ellipse",
  x: 250,
  y: 250,
  width: 200,
  height: 100,
  backgroundColor: "#ffc9c9",
  strokeColor: "#1971c2",
  strokeStyle: "dotted",
  fillStyle: "solid",
  strokeWidth: 2
}
```

---

### 3. 菱形 (Diamond)

**必填属性：** `type`, `x`, `y`  
**可选属性：** 与矩形相同

**基础示例：**
```javascript
{
  type: "diamond",
  x: 380,
  y: 250
}
```

**完整示例：**
```javascript
{
  type: "diamond",
  x: 380,
  y: 250,
  width: 200,
  height: 100,
  backgroundColor: "#a5d8ff",
  strokeColor: "#1971c2",
  strokeStyle: "dashed",
  fillStyle: "cross-hatch",
  strokeWidth: 2
}
```

---

### 4. 文本 (Text)

**必填属性：** `type`, `x`, `y`, `text`  
**可选属性：** `fontSize`, `fontFamily`, `strokeColor`, `opacity`, `angle`, `textAlign`, `verticalAlign`

**重要提示：** `width` 和 `height` 由系统自动计算，**不要手动提供**

**基础示例：**
```javascript
{
  type: "text",
  x: 100,
  y: 100,
  text: "Hello World!"
}
```

**完整示例：**
```javascript
{
  type: "text",
  x: 100,
  y: 100,
  text: "Styled Text",
  fontSize: 20,
  fontFamily: 1, // 1=Virgil, 2=Helvetica, 3=Cascadia
  strokeColor: "#5f3dc4",
  textAlign: "center",
  verticalAlign: "middle",
  opacity: 1.0,
  angle: 0
}
```

---

### 5. 线条 (Line)

**必填属性：** `type`, `x`, `y`  
**可选属性：** `width`, `height`, `strokeColor`, `strokeWidth`, `strokeStyle`, `polygon`

**重要提示：** `points` 由系统根据 `width` 和 `height` 自动生成，**不要手动提供**

**基础示例：**
```javascript
{
  type: "line",
  x: 100,
  y: 60
}
```

**完整示例：**
```javascript
{
  type: "line",
  x: 100,
  y: 60,
  width: 200, // 默认 100
  height: 0,  // 默认 0
  strokeColor: "#2f9e44",
  strokeWidth: 2,
  strokeStyle: "dotted", // solid | dashed | dotted
  polygon: false // 是否闭合
}
```

---

### 6. 箭头 (Arrow)

**必填属性：** `type`, `x`, `y`  
**可选属性：** `width`, `height`, `strokeColor`, `strokeWidth`, `strokeStyle`, `elbowed`, `startArrowhead`, `endArrowhead`, `start`, `end`, `label`

**重要提示：** 
- `points` 由系统根据 `width` 和 `height` 自动生成，**不要手动提供**
- `start` 和 `end` 用于绑定到其他元素

**基础示例：**
```javascript
{
  type: "arrow",
  x: 100,
  y: 20
}
```

**完整示例：**
```javascript
{
  type: "arrow",
  x: 100,
  y: 20,
  width: 200,
  height: 0,
  strokeColor: "#1971c2",
  strokeWidth: 2,
  strokeStyle: "solid",
  elbowed: false, // 是否肘形箭头
  startArrowhead: null, // 起点箭头样式
  endArrowhead: "arrow", // 终点箭头样式
  // 箭头样式可选值：
  // arrow, bar, circle, circle_outline, triangle, 
  // triangle_outline, diamond, diamond_outline
}
```

**带标签的箭头：**
```javascript
{
  type: "arrow",
  x: 100,
  y: 100,
  label: {
    text: "标签文本",
    fontSize: 16,
    strokeColor: "#099268"
  }
}
```

---

### 7. 箭头绑定 (Arrow Bindings)

箭头可以绑定到其他元素，实现自动连接。

#### 通过 type 绑定（自动创建元素）

**绑定到矩形：**
```javascript
{
  type: "arrow",
  x: 255,
  y: 239,
  start: {
    type: "rectangle" // 自动创建矩形并绑定
  },
  end: {
    type: "ellipse" // 自动创建椭圆并绑定
  }
}
```

**绑定到文本：**
```javascript
{
  type: "arrow",
  x: 255,
  y: 239,
  start: {
    type: "text",
    text: "起点文本" // 必须提供 text
  },
  end: {
    type: "text",
    text: "终点文本"
  }
}
```

**指定绑定元素尺寸：**
```javascript
{
  type: "arrow",
  x: 100,
  y: 440,
  width: 295,
  height: 35,
  start: {
    type: "rectangle",
    width: 150,
    height: 150
  },
  end: {
    type: "ellipse",
    width: 100,
    height: 100
  }
}
```

#### 通过 id 绑定（绑定已有元素）

**步骤 1：创建带 id 的元素**
```javascript
{
  type: "ellipse",
  id: "ellipse-1", // 指定 ID
  x: 390,
  y: 356,
  width: 150,
  height: 150
}
```

**步骤 2：通过 id 绑定箭头**
```javascript
{
  type: "arrow",
  x: 100,
  y: 440,
  start: {
    type: "rectangle", // 可以混合使用
    width: 150,
    height: 150
  },
  end: {
    id: "ellipse-1" // 绑定到已有元素
  }
}
```

**完整示例：**
```javascript
convertToExcalidrawElements([
  {
    type: "ellipse",
    id: "ellipse-1",
    x: 390,
    y: 356,
    width: 150,
    height: 150,
    backgroundColor: "#d8f5a2"
  },
  {
    type: "diamond",
    id: "diamond-1",
    x: -30,
    y: 380,
    width: 100,
    height: 100
  },
  {
    type: "arrow",
    x: 100,
    y: 440,
    start: { id: "diamond-1" },
    end: { id: "ellipse-1" }
  }
]);
```

**绑定位置计算：**
- 如果未指定 `start` 和 `end` 的位置，系统会根据箭头位置自动计算
- 绑定点会自动选择元素边缘的中心点
- 系统会根据元素相对位置选择最合适的边缘（上/下/左/右）

---

### 8. 框架 (Frame)

框架用于将多个元素分组，创建逻辑分组。

**必填属性：** `type`, `children`  
**可选属性：** `x`, `y`, `width`, `height`, `name`

**重要提示：**
- `children` 必须是元素 ID 数组
- 如果未提供坐标和尺寸，系统会根据 `children` 自动计算，并包含 10px 内边距

**基础示例：**
```javascript
convertToExcalidrawElements([
  {
    type: "rectangle",
    id: "rect-1",
    x: 10,
    y: 10
  },
  {
    type: "diamond",
    id: "diamond-1",
    x: 120,
    y: 20
  },
  {
    type: "frame",
    children: ["rect-1", "diamond-1"],
    name: "功能模块组"
  }
]);
```

**指定框架位置和尺寸：**
```javascript
{
  type: "frame",
  x: 0,
  y: 0,
  width: 500,
  height: 300,
  children: ["rect-1", "diamond-1"],
  name: "自定义框架"
}
```

---

### 9. 自由绘制 (Freedraw)

**必填属性：** `type`, `x`, `y`  
**可选属性：** `strokeColor`, `strokeWidth`, `opacity`

**重要提示：** `points` 由系统生成，用于手绘风格线条

**示例：**
```javascript
{
  type: "freedraw",
  x: 100,
  y: 100,
  strokeColor: "#000000",
  strokeWidth: 2,
  opacity: 1.0
}
```

---

### 10. 图片 (Image)

**必填属性：** `type`, `x`, `y`, `fileId`  
**可选属性：** `width`, `height`, `scale`, `crop`, `angle`, `locked`, `link`

**示例：**
```javascript
{
  type: "image",
  x: 100,
  y: 100,
  fileId: "image-file-id",
  width: 300,
  height: 200,
  angle: 0,
  scale: [1, 1], // [x, y] 翻转
  locked: false
}
```

---

## 属性参考

### 通用属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `type` | `string` | - | 元素类型（必填） |
| `id` | `string` | - | 元素唯一标识符 |
| `x` | `number` | - | X 坐标（必填） |
| `y` | `number` | - | Y 坐标（必填） |
| `width` | `number` | 100 | 宽度 |
| `height` | `number` | 100 | 高度 |
| `strokeColor` | `string` | `#000000` | 描边颜色（十六进制） |
| `backgroundColor` | `string` | `transparent` | 背景颜色（十六进制） |
| `strokeWidth` | `number` | 1 | 描边宽度 |
| `strokeStyle` | `string` | `solid` | 描边样式：`solid` \| `dashed` \| `dotted` |
| `fillStyle` | `string` | `hachure` | 填充样式：`hachure` \| `solid` \| `zigzag` \| `cross-hatch` |
| `roughness` | `number` | 1 | 粗糙度（0-2） |
| `opacity` | `number` | 1.0 | 透明度（0-1） |
| `angle` | `number` | 0 | 旋转角度（弧度） |
| `roundness` | `object` | `null` | 圆角：`{ type: 1-3 }` |
| `locked` | `boolean` | `false` | 是否锁定 |
| `link` | `string` | `null` | 超链接 |

### 文本相关属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `text` | `string` | - | 文本内容（text 类型必填） |
| `fontSize` | `number` | 20 | 字体大小 |
| `fontFamily` | `number` | 1 | 字体：1=Virgil, 2=Helvetica, 3=Cascadia |
| `textAlign` | `string` | `left` | 水平对齐：`left` \| `center` \| `right` |
| `verticalAlign` | `string` | `top` | 垂直对齐：`top` \| `middle` \| `bottom` |

### 标签属性 (label)

用于在形状或箭头上添加文本标签。

| 属性 | 类型 | 说明 |
|------|------|------|
| `label.text` | `string` | 标签文本（必填） |
| `label.fontSize` | `number` | 字体大小 |
| `label.fontFamily` | `number` | 字体 |
| `label.strokeColor` | `string` | 文本颜色 |
| `label.textAlign` | `string` | 水平对齐 |
| `label.verticalAlign` | `string` | 垂直对齐 |

### 箭头相关属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `elbowed` | `boolean` | `false` | 是否肘形箭头 |
| `startArrowhead` | `string` | `null` | 起点箭头样式 |
| `endArrowhead` | `string` | `arrow` | 终点箭头样式 |
| `start` | `object` | `null` | 起点绑定 |
| `end` | `object` | `null` | 终点绑定 |

**箭头样式可选值：**
- `arrow` - 标准箭头
- `bar` - 横线
- `circle` - 实心圆
- `circle_outline` - 空心圆
- `triangle` - 实心三角
- `triangle_outline` - 空心三角
- `diamond` - 实心菱形
- `diamond_outline` - 空心菱形

### 绑定属性 (start/end)

| 属性 | 类型 | 说明 |
|------|------|------|
| `type` | `string` | 元素类型：`rectangle` \| `ellipse` \| `diamond` \| `text` |
| `id` | `string` | 已有元素的 ID |
| `x` | `number` | 元素 X 坐标（可选） |
| `y` | `number` | 元素 Y 坐标（可选） |
| `width` | `number` | 元素宽度（可选） |
| `height` | `number` | 元素高度（可选） |
| `text` | `string` | 文本内容（type 为 text 时必填） |

**注意：** `type` 和 `id` 二选一，不能同时提供。

---

## 最佳实践

### 1. 坐标规划

- **预规划布局**：在生成代码前，先规划好元素的坐标位置
- **避免重叠**：确保元素之间的间距足够大（建议 > 800px）
- **统一对齐**：使用网格对齐，保持视觉一致性

### 2. 箭头绑定

- **优先使用绑定**：使用 `start` 和 `end` 绑定，而不是手动计算坐标
- **边缘连接**：箭头会自动连接到元素边缘中心，确保连接点准确
- **ID 管理**：对于复杂图表，使用 `id` 管理元素，便于复用

### 3. 文本容器

- **自动尺寸**：不提供 `width` 和 `height` 时，系统会根据文本自动计算
- **对齐方式**：根据内容选择合适的 `textAlign` 和 `verticalAlign`
- **字体大小**：根据容器大小调整 `fontSize`，确保文本可读

### 4. 样式一致性

- **颜色方案**：使用 2-4 种主色，保持视觉统一
- **描边宽度**：同类型元素使用相同的 `strokeWidth`
- **填充样式**：根据图表类型选择合适的 `fillStyle`

### 5. 性能优化

- **批量转换**：一次性转换所有元素，而不是逐个转换
- **ID 复用**：如需保留 ID，设置 `regenerateIds: false`
- **最小属性**：只提供必要属性，让系统自动补全

### 6. 错误处理

- **类型检查**：确保 `type` 值正确
- **必填属性**：确保提供所有必填属性
- **JSON 验证**：转换前验证 JSON 格式正确

---

## 完整示例

### 示例 1：简单流程图

```javascript
convertToExcalidrawElements([
  {
    type: "ellipse",
    x: 200,
    y: 50,
    label: { text: "开始" }
  },
  {
    type: "rectangle",
    x: 150,
    y: 200,
    label: { text: "处理步骤" }
  },
  {
    type: "diamond",
    x: 150,
    y: 350,
    label: { text: "判断" }
  },
  {
    type: "ellipse",
    x: 200,
    y: 500,
    label: { text: "结束" }
  },
  {
    type: "arrow",
    x: 250,
    y: 150,
    start: { type: "ellipse" },
    end: { type: "rectangle" }
  },
  {
    type: "arrow",
    x: 250,
    y: 300,
    start: { type: "rectangle" },
    end: { type: "diamond" }
  },
  {
    type: "arrow",
    x: 250,
    y: 450,
    start: { type: "diamond" },
    end: { type: "ellipse" }
  }
]);
```

### 示例 2：带 ID 的复杂图表

```javascript
convertToExcalidrawElements([
  // 定义节点
  {
    type: "rectangle",
    id: "node-1",
    x: 100,
    y: 100,
    width: 150,
    height: 80,
    label: { text: "节点 1" }
  },
  {
    type: "rectangle",
    id: "node-2",
    x: 400,
    y: 100,
    width: 150,
    height: 80,
    label: { text: "节点 2" }
  },
  {
    type: "rectangle",
    id: "node-3",
    x: 250,
    y: 300,
    width: 150,
    height: 80,
    label: { text: "节点 3" }
  },
  // 定义箭头
  {
    type: "arrow",
    x: 250,
    y: 180,
    start: { id: "node-1" },
    end: { id: "node-2" },
    label: { text: "连接 1" }
  },
  {
    type: "arrow",
    x: 325,
    y: 180,
    start: { id: "node-2" },
    end: { id: "node-3" },
    label: { text: "连接 2" }
  },
  {
    type: "arrow",
    x: 175,
    y: 180,
    start: { id: "node-1" },
    end: { id: "node-3" },
    label: { text: "连接 3" }
  }
]);
```

### 示例 3：带框架的分组

```javascript
convertToExcalidrawElements([
  {
    type: "rectangle",
    id: "rect-1",
    x: 10,
    y: 10,
    width: 100,
    height: 50
  },
  {
    type: "rectangle",
    id: "rect-2",
    x: 120,
    y: 10,
    width: 100,
    height: 50
  },
  {
    type: "rectangle",
    id: "rect-3",
    x: 230,
    y: 10,
    width: 100,
    height: 50
  },
  {
    type: "frame",
    children: ["rect-1", "rect-2", "rect-3"],
    name: "第一组"
  },
  {
    type: "rectangle",
    id: "rect-4",
    x: 10,
    y: 100,
    width: 100,
    height: 50
  },
  {
    type: "rectangle",
    id: "rect-5",
    x: 120,
    y: 100,
    width: 100,
    height: 50
  },
  {
    type: "frame",
    children: ["rect-4", "rect-5"],
    name: "第二组"
  }
]);
```

---

## 常见问题

### Q1: 为什么箭头没有连接到元素？

**A:** 确保使用了 `start` 和 `end` 绑定属性，而不是手动计算坐标。系统会自动计算连接点。

### Q2: 文本容器的尺寸如何控制？

**A:** 如果不提供 `width` 和 `height`，系统会根据文本自动计算。如需固定尺寸，可以手动指定。

### Q3: 如何创建圆角矩形？

**A:** 使用 `roundness` 属性：
```javascript
{
  type: "rectangle",
  x: 100,
  y: 100,
  roundness: { type: 3 } // 1-3 表示不同的圆角程度
}
```

### Q4: 箭头样式有哪些？

**A:** 支持多种样式，详见 [箭头相关属性](#箭头相关属性) 章节。

### Q5: 如何旋转元素？

**A:** 使用 `angle` 属性，单位为弧度：
```javascript
{
  type: "rectangle",
  x: 100,
  y: 100,
  angle: Math.PI / 4 // 45度
}
```

---

## 参考资源

- [Excalidraw 官方文档](https://docs.excalidraw.com/)
- [GitHub PR #6546](https://github.com/excalidraw/excalidraw/pull/6546)
- [TypeScript 类型定义](https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/data/transform.ts)

---

**文档版本：** 1.0  
**最后更新：** 2025-01-XX  
**维护者：** Smart Excalidraw 团队


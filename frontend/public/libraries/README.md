# Excalidraw Libraries 使用说明

## 目录说明

这个目录用于存放 Excalidraw 的库文件（`.excalidrawlib` 格式）。

**重要提示**：只需要将库文件放在 `public/libraries/` 目录下，系统会自动检测并加载。

## 如何添加新的库文件

### 步骤 1：下载库文件

从 [Excalidraw Libraries](https://libraries.excalidraw.com) 下载所需的库文件，保存为 `.excalidrawlib` 格式。

### 步骤 2：放置文件

直接将下载的库文件放到 `public/libraries/` 目录：

```
frontend/
  └── public/
      └── libraries/          # 库文件目录
          ├── your-library.excalidrawlib
          └── another-library.excalidrawlib
```

### 步骤 3：自动加载

**无需任何代码修改！** 系统会自动：
- 扫描 `public/libraries/` 目录下的所有 `.excalidrawlib` 文件
- 自动加载所有库文件到 Excalidraw
- 支持新旧两种库文件格式

### 步骤 4：刷新页面

添加新库文件后，刷新浏览器页面即可看到新库。

## 自动检测机制

系统通过以下方式自动检测库文件：

1. **API 路由**：`/api/libraries` 自动扫描 `public/libraries/` 目录
2. **前端加载**：`ExcalidrawCanvas` 组件自动调用 API 获取库文件列表
3. **格式兼容**：自动处理旧版本（`library` 字段）和新版本（`libraryItems` 字段）格式

## 当前已加载的库

系统会自动检测并加载 `public/libraries/` 目录下的所有 `.excalidrawlib` 文件。

## 注意事项

1. **文件格式**：确保文件是有效的 `.excalidrawlib` 格式
2. **文件大小**：大型库文件可能影响加载性能，建议按需添加
3. **版本兼容**：代码会自动处理旧版本（`library` 字段）和新版本（`libraryItems` 字段）格式
4. **错误处理**：如果某个库文件加载失败，会在控制台显示警告，但不会影响其他库的加载
5. **文件命名**：建议使用有意义的文件名，便于识别

## 故障排查

如果库文件没有加载：

1. **检查文件位置**：确认文件在 `public/libraries/` 目录下
2. **检查文件扩展名**：确保文件扩展名是 `.excalidrawlib`
3. **查看控制台**：打开浏览器开发者工具，查看控制台日志
4. **检查 API**：访问 `/api/libraries` 查看是否能正确返回文件列表
5. **验证文件格式**：确保文件是有效的 JSON 格式

## 技术实现

- **API 路由**：`app/api/libraries/route.js` - 扫描目录并返回文件列表
- **前端组件**：`components/ExcalidrawCanvas.jsx` - 自动获取并加载库文件
- **加载方式**：通过 `excalidrawAPI.updateLibrary()` 方法动态更新库项


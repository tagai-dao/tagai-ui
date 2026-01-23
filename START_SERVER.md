# 启动前端服务器指南

## 快速启动

### 方法一：使用启动脚本（推荐）

```bash
cd /Users/yinguozi/TagAI_DApp/tagai-ui
./start-server.sh
```

### 方法二：使用 yarn 命令

```bash
cd /Users/yinguozi/TagAI_DApp/tagai-ui
yarn dev
```

### 方法三：使用 npm 命令（如果未安装 yarn）

```bash
cd /Users/yinguozi/TagAI_DApp/tagai-ui
npm run dev
```

## 启动前准备

### 1. 安装依赖（如果未安装）

```bash
cd /Users/yinguozi/TagAI_DApp/tagai-ui
yarn install
# 或
npm install
```

### 2. 检查环境变量

确保 `.env` 文件已正确配置：
- `VITE_APP_NEYNAR_CLIENT_ID`
- `VITE_APP_PRIVY_APP_ID`
- `VITE_APP_PRIVY_CLIENT_ID`
- 其他必要的 API 配置

### 3. 检查端口占用

默认端口是 **5173**（Vite 默认端口）

检查端口是否被占用：
```bash
lsof -ti:5173
```

如果端口被占用，Vite 会自动尝试使用下一个可用端口（5174, 5175...）

## 服务器信息

- **默认端口**: 5173
- **访问地址**: http://localhost:5173
- **构建工具**: Vite
- **框架**: Vue 3 + TypeScript

## 可用命令

### 开发模式

```bash
yarn dev
# 或
npm run dev
```

- 启动开发服务器
- 支持热模块替换（HMR）
- 代码修改后自动刷新
- 适合开发调试

### 构建生产版本

```bash
yarn build
# 或
npm run build
```

- 构建优化后的生产版本
- 输出到 `dist/` 目录
- 包含代码压缩和优化

### 预览构建版本

```bash
yarn preview
# 或
npm run preview
```

- 预览构建后的生产版本
- 用于测试生产构建

### 类型检查

```bash
yarn type-check
# 或
npm run type-check
```

- 检查 TypeScript 类型错误

### 代码检查

```bash
yarn lint
# 或
npm run lint
```

- 运行 ESLint 检查并自动修复

## 开发服务器特性

### 热模块替换 (HMR)

- 修改 Vue 组件后，页面会自动更新，无需刷新
- 保持应用状态，提升开发体验

### 快速刷新

- 代码修改后立即在浏览器中看到效果
- 支持 Vue、TypeScript、CSS 等文件的热更新

### 网络访问

- 服务器配置为 `host: '0.0.0.0'`，可以从局域网其他设备访问
- 访问地址会显示在终端输出中

## 常见问题

### 1. 端口已被占用

**现象**: 启动时提示端口被占用

**解决**:
- Vite 会自动尝试下一个可用端口
- 或手动指定端口：
  ```bash
  yarn dev --port 5174
  ```

### 2. 依赖未安装

**错误**: `Cannot find module 'xxx'`

**解决**:
```bash
yarn install
```

### 3. 环境变量未生效

**注意**: Vite 的环境变量必须以 `VITE_` 开头

**检查**:
- `.env` 文件中的变量名是否正确
- 变量名是否以 `VITE_` 开头
- 修改环境变量后需要重启开发服务器

### 4. 构建失败

**可能原因**:
- TypeScript 类型错误
- 依赖版本冲突
- 内存不足

**解决**:
```bash
# 清理并重新安装依赖
rm -rf node_modules
yarn install

# 检查类型错误
yarn type-check
```

### 5. 页面无法访问

**检查**:
- 后端服务器是否已启动（默认端口 9901）
- 浏览器控制台是否有错误信息
- 网络连接是否正常

## 验证服务器是否启动成功

启动后，可以通过以下方式验证：

1. **查看终端输出**：
   - 应该看到类似以下信息：
     ```
     VITE v5.x.x  ready in xxx ms
     
     ➜  Local:   http://localhost:5173/
     ➜  Network: http://192.168.x.x:5173/
     ```

2. **访问浏览器**：
   - 打开 http://localhost:5173
   - 应该能看到应用界面

3. **检查进程**：
   ```bash
   lsof -ti:5173
   ```

## 开发提示

### 1. 使用浏览器开发者工具

- 按 `F12` 打开开发者工具
- 查看 Console 面板了解错误信息
- 使用 Vue DevTools 调试 Vue 组件

### 2. 查看网络请求

- 在 Network 面板查看 API 请求
- 确保后端服务器正常运行

### 3. 热更新不工作

- 某些文件修改可能需要手动刷新
- 检查浏览器控制台是否有错误

## 与后端服务器配合

前端服务器需要后端 API 支持：

1. **确保后端服务器已启动**（端口 9901）
2. **检查 API 配置**：
   - 查看 `src/config.ts` 中的 API 地址配置
   - 确保与后端服务器地址匹配

## 停止服务器

在运行服务器的终端中按 `Ctrl + C` 即可停止服务器。

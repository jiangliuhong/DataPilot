## 1. 依赖安装

- [x] 1.1 安装 `@monaco-editor/react` 依赖

## 2. 编辑器页面路由与布局

- [x] 2.1 创建 `src/app/editor/layout.tsx`，包裹 Providers（确保 HeroUI 主题和 toast 可用）
- [x] 2.2 创建 `src/app/editor/projects/[id]/page.tsx`，作为文件编辑器页面入口，加载项目信息并渲染编辑器布局

## 3. 编辑器核心组件

- [x] 3.1 创建 `src/web/features/project/components/editor/editor-layout.tsx`，实现全屏左右分栏布局（顶部工具栏 + 左侧目录树面板 + 右侧编辑区）
- [x] 3.2 创建 `src/web/features/project/components/editor/editor-toolbar.tsx`，实现顶部工具栏（返回链接、项目名称、保存按钮）
- [x] 3.3 创建 `src/web/features/project/components/editor/editor-directory-tree.tsx`，实现左侧目录树（展示目录和文件节点，文件节点点击触发 onFileSelect）
- [x] 3.4 创建 `src/web/features/project/components/editor/editor-tabs.tsx`，实现 Tab 栏组件（多 Tab 显示、切换、关闭按钮、dirty 标记●）
- [x] 3.5 创建 `src/web/features/project/components/editor/editor-code-viewer.tsx`，封装 Monaco Editor，根据文件类型自动切换语法高亮

## 4. 状态管理 Hook

- [x] 4.1 创建 `src/web/features/project/hooks/use-editor-state.ts`，使用 useReducer 管理 Tab 列表状态（打开、关闭、切换、标记 dirty、更新内容）

## 5. 编辑器集成

- [x] 5.1 在 `editor-layout.tsx` 中集成所有子组件，连接目录树点击 → 打开 Tab → 加载文件内容 → 编辑 → 保存的完整流程
- [x] 5.2 实现保存功能：调用 `fileApi.update()` 提交内容，Ctrl/Cmd+S 快捷键支持，保存成功清除 dirty 标记
- [x] 5.3 实现关闭未保存 Tab 的确认弹窗（保存 / 不保存 / 取消）
- [x] 5.4 处理空状态（无 Tab 时显示提示）和项目不存在的错误处理

## 6. 项目列表入口按钮

- [x] 6.1 在 `src/web/features/project/components/project-list.tsx` 操作列中添加"文件编辑"按钮，点击后 `window.open('/editor/projects/' + projectId, '_blank')`

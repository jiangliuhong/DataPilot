## ADDED Requirements

### Requirement: 错误状态可见
AI 助手页的所有用户可见操作（新建会话、加载会话列表、加载历史消息、发起对话、删除会话）失败时 SHALL 在 UI 上可见地展示错误信息（HeroUI Alert），而非静默吞掉错误。每条错误提示 SHALL 可被用户关闭，且对于可重试的操作 SHALL 提供"重试"入口。任何失败 SHALL NOT 导致 UI 长时间停留于不可交互的禁用态而无错误提示。

#### Scenario: 新建会话失败可见
- **WHEN** 用户点击"新建会话"按钮，但 `POST /api/agent/conversations` 请求失败（如 401、网络错）
- **THEN** 会话列表区域 SHALL 显示一条错误提示（如"创建会话失败：<原因>"），并提供"重试"按钮；输入框不进入"已选中空会话"的假态

#### Scenario: 加载会话列表失败可见
- **WHEN** 会话列表加载（`GET /api/agent/conversations`）失败
- **THEN** 会话列表区域 SHALL 显示错误提示与"重试"按钮，而非永久停留在"加载中…"或空列表

#### Scenario: 加载历史消息失败可见
- **WHEN** 切换会话后加载历史（`GET /api/agent/conversations/:id/messages`）失败
- **THEN** 对话区 SHALL 显示错误提示与"重试"按钮，而非空白无提示

#### Scenario: 错误提示可关闭
- **WHEN** 用户点击错误提示的关闭按钮
- **THEN** 该错误提示移除，UI 恢复到操作前的正常可交互态

### Requirement: 对话错误终态刷新历史与列表
当流式对话以错误终止（收到 SSE `error` 事件或网络中断）时，系统 SHALL 刷新当前会话的历史消息与会话列表，以清理临时生成状态、避免脏数据残留，随后重新启用输入框。

#### Scenario: error 事件后刷新
- **WHEN** 前端收到 `error` 类型的流式事件
- **THEN** 系统 SHALL 移除"正在输入"指示器，刷新历史消息与会话列表，重新启用输入框；错误信息可见展示

#### Scenario: 网络中断后清理
- **WHEN** 流式连接因网络问题中断且未收到 `message_end`
- **THEN** 系统 SHALL 清理未完成的临时 assistant 消息，刷新历史，显示"连接中断，请重试"并可重试

### Requirement: 停止生成
当 AI 正在生成回复时，用户 SHALL 能主动中止生成。中止 SHALL 取消底层 fetch/SSE 连接、清理临时生成状态并重新启用输入框。组件卸载时 SHALL 也中止进行中的请求，避免幽灵流。

#### Scenario: 点击停止按钮
- **WHEN** AI 正在生成回复，用户点击"停止"按钮
- **THEN** 系统 SHALL 中止流式请求（AbortController.abort），移除"正在输入"指示器，已接收的部分内容保留，重新启用输入框

#### Scenario: 卸载时中止
- **WHEN** 对话页组件在生成进行中被卸载（如切换菜单）
- **THEN** 系统 SHALL 中止进行中的流式请求，不遗留未关闭连接

### Requirement: assistant 消息 Markdown 渲染
assistant 消息 SHALL 以 Markdown 渲染（支持标题、列表、代码块、表格等 GFM 语法），渲染 SHALL 不执行原始 HTML 以避免注入。历史 assistant 消息与流式 assistant 消息 SHALL 一致地以 Markdown 渲染。

#### Scenario: 渲染 Markdown 回复
- **WHEN** assistant 消息内容包含 Markdown 语法（如 `**粗体**`、列表、代码块）
- **THEN** 消息气泡 SHALL 按渲染后的 Markdown 展示，而非原始文本

#### Scenario: 不渲染原始 HTML
- **WHEN** assistant 消息内容包含 `<script>` 等 HTML 标签
- **THEN** 系统 SHALL 不执行该 HTML，仅作为纯文本或转义展示

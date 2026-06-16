## ADDED Requirements

### Requirement: AI Agent 对话页入口
系统 SHALL 在主站侧边栏提供"AI 助手"一级菜单项（key 为 `agent-chat`），点击后在 `ContentPanel` 中渲染 AI Agent 对话页。对话页 SHALL 采用左右二级布局：左侧为会话列表面板，右侧为当前会话的对话区。

#### Scenario: 从侧边栏进入对话页
- **WHEN** 用户在侧边栏点击"AI 助手"菜单项
- **THEN** 右侧内容区渲染 AI Agent 对话页，左侧显示会话列表，右侧显示对话区（无选中会话时显示空状态提示）

#### Scenario: 对话页首次加载
- **WHEN** 对话页首次加载且存在历史会话
- **THEN** 系统 GET `/api/agent/conversations` 获取会话列表并在左侧渲染，按 `createdAt` 倒序排列；右侧默认不选中任何会话，显示"选择或新建一个会话开始对话"提示

### Requirement: 会话列表与新建会话
会话列表面板 SHALL 展示所有未删除会话，每项显示会话标题和创建时间。面板顶部 SHALL 提供"新建会话"按钮。点击会话项 SHALL 切换右侧对话区到该会话并加载其历史消息。新建会话 SHALL 立即在后端创建记录并选中新会话。

#### Scenario: 新建会话
- **WHEN** 用户点击"新建会话"按钮
- **THEN** 系统 POST `/api/agent/conversations` 创建会话（标题默认为"新对话"），会话列表新增一项并高亮选中，右侧对话区切换为空对话区（无历史消息），输入框获得焦点

#### Scenario: 切换会话
- **WHEN** 用户点击会话列表中的某个会话项
- **THEN** 右侧对话区切换为该会话，GET `/api/agent/conversations/:id/messages` 加载历史消息并渲染为消息流，会话项高亮为选中态

#### Scenario: 删除会话
- **WHEN** 用户点击会话项的删除按钮并确认
- **THEN** 系统 DELETE `/api/agent/conversations/:id` 软删除该会话，会话从列表移除；若删除的是当前选中会话，右侧对话区回到空状态

### Requirement: 消息流渲染
对话区 SHALL 以消息流形式展示对话，user 消息右对齐、assistant 消息左对齐，按时间顺序自上而下排列。tool 类型的消息 SHALL 折叠为"工具调用步骤"卡片，不作为独立气泡显示。assistant 消息 SHALL 支持 Markdown 渲染。

#### Scenario: 渲染用户消息
- **WHEN** 用户发送一条消息
- **THEN** 消息流右侧出现一个用户消息气泡，显示消息文本

#### Scenario: 渲染 AI 回复
- **WHEN** AI 完成一条回复
- **THEN** 消息流左侧出现一个 AI 消息气泡，内容按 Markdown 渲染（支持标题、列表、代码块、表格等）

#### Scenario: 渲染历史消息
- **WHEN** 用户切换到一个有历史消息的会话
- **THEN** 消息流按 role 和时间顺序渲染所有历史消息，user 右对齐、assistant 左对齐

### Requirement: 流式渲染 AI 回复
当 AI 正在生成回复时，系统 SHALL 逐 token 将内容追加到当前 assistant 消息气泡，并显示"正在输入"指示器。生成完成后 SHALL 移除指示器。

#### Scenario: 流式接收 token
- **WHEN** 前端收到 `token` 类型的流式事件
- **THEN** 当前正在生成的 assistant 消息气泡末尾追加该 token 文本，滚动条自动滚动到底部

#### Scenario: 生成中指示器
- **WHEN** AI 正在生成回复（已收到至少一个 token 但未收到 `message_end`）
- **THEN** assistant 消息气泡下方显示"正在输入..."动画指示器，输入框禁用发送按钮

#### Scenario: 生成完成
- **WHEN** 前端收到 `message_end` 事件
- **THEN** 移除"正在输入"指示器，启用输入框，该 assistant 消息固化（messageId 来自事件）

### Requirement: 工具调用步骤可视化
当 Agent 调用工具时，对话区 SHALL 在对应的 assistant 消息上下文显示工具调用步骤卡片。卡片 SHALL 显示工具名称、调用入参（折叠可展开）、执行状态（进行中/完成）和返回结果摘要。

#### Scenario: 显示工具调用开始
- **WHEN** 前端收到 `tool_start` 事件（含 tool 名称和 input）
- **THEN** 在当前 assistant 消息区域渲染一张工具调用卡片，显示工具名称和"进行中"状态（加载动画），入参折叠为可展开区域

#### Scenario: 显示工具调用完成
- **WHEN** 前端收到对应的 `tool_end` 事件（含 tool 名称和 output）
- **THEN** 该工具调用卡片状态变为"完成"（勾选图标），展示返回结果摘要（截断过长内容，可展开查看完整结果）

#### Scenario: 多次工具调用
- **WHEN** Agent 在一轮回复中连续调用两个工具（如先 list_projects 再 get_project）
- **THEN** 对话区按调用顺序渲染两张工具调用卡片，两张卡片均在最终文本回复之前

### Requirement: 消息输入与发送
对话区底部 SHALL 提供消息输入框（支持多行）和发送按钮。用户 SHALL 能通过点击发送按钮或按 Enter 键发送消息（Shift+Enter 换行）。发送时 SHALL 将消息加入消息流并触发流式请求。

#### Scenario: 发送消息
- **WHEN** 用户在输入框输入文本后点击发送按钮或按 Enter
- **THEN** 系统将文本作为 user 消息加入消息流，清空输入框，发起 `POST /api/agent/chat` 流式请求（带上 conversationId 和完整历史）

#### Scenario: 多行输入
- **WHEN** 用户按 Shift+Enter
- **THEN** 输入框换行，不触发发送

#### Scenario: 空消息禁止发送
- **WHEN** 输入框为空或仅含空白字符时用户点击发送
- **THEN** 系统 SHALL 不发起请求，发送按钮为禁用态

#### Scenario: 生成中禁用发送
- **WHEN** AI 正在生成回复（流式请求进行中）
- **THEN** 发送按钮 SHALL 禁用，防止并发请求

### Requirement: 流式错误处理
当流式请求失败时，系统 SHALL 在对话区显示错误提示，清理临时生成状态，并重新启用输入框。

#### Scenario: 收到错误事件
- **WHEN** 前端收到 `error` 类型的流式事件
- **THEN** 在消息流末尾渲染一条错误提示（红色文本"对话出错：<message>"），移除"正在输入"指示器，启用输入框

#### Scenario: 网络中断
- **WHEN** 流式连接因网络问题中断且未收到 `message_end`
- **THEN** 系统显示错误提示"连接中断，请重试"，清理未完成的临时 assistant 消息

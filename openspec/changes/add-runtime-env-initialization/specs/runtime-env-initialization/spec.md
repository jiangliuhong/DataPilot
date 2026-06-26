## ADDED Requirements

### Requirement: 手动触发初始化
系统 SHALL 提供运行环境的 Python 虚拟环境初始化能力，由用户通过 `POST /api/dbt/environments/[id]/initialize` 手动触发，系统不自动创建虚拟环境。

#### Scenario: 成功触发初始化
- **WHEN** 用户对一个存在且未软删除的运行环境提交 `POST /api/dbt/environments/[id]/initialize`，且该环境当前不在初始化中
- **THEN** 系统将环境 `initializationStatus` 置为 `running`，异步开始创建虚拟环境与安装依赖，并立即返回 200 与 `{ initializationStatus: "running" }`

#### Scenario: 初始化的环境不存在
- **WHEN** 用户对一个不存在或已软删除的运行环境提交初始化请求
- **THEN** 系统返回 404 错误

#### Scenario: 重复触发正在初始化的环境
- **WHEN** 用户对一个 `initializationStatus` 为 `running` 的环境再次提交初始化请求
- **THEN** 系统返回 409 错误，提示该环境正在初始化中

#### Scenario: 重新初始化已完成的环境
- **WHEN** 用户对一个 `initializationStatus` 为 `initialized` 或 `failed` 的环境提交初始化请求
- **THEN** 系统允许重新触发，将状态重置为 `running` 并开始新的初始化流程（重建/升级虚拟环境）

### Requirement: 虚拟环境创建与依赖安装
初始化 SHALL 使用 Python 标准库 `venv` 在磁盘上创建虚拟环境，并使用该虚拟环境内的解释器通过 `python -m pip install` 安装运行环境关联版本的 `dependencies` 清单。

#### Scenario: 创建虚拟环境
- **WHEN** 初始化流程开始
- **THEN** 系统在配置的 venv 根目录下、按环境名分目录创建虚拟环境（`<root>/<env-name>/`），调用 `<python> -m venv <path>`

#### Scenario: 安装版本依赖
- **WHEN** 虚拟环境创建成功
- **THEN** 系统使用虚拟环境内的解释器执行 `<venv-python> -m pip install <packages>`，包列表来自该环境关联版本的 `dependencies`，`version` 为具体版本号时拼为 `name==version`，为 `latest` 时不加版本约束

#### Scenario: 初始化成功
- **WHEN** 虚拟环境创建与依赖安装均成功（子进程退出码为 0）
- **THEN** 系统将环境 `initializationStatus` 置为 `initialized`，写入 `venvPath` 与 `initializedAt`（当前时间），清空 `lastErrorMessage`

#### Scenario: 初始化失败
- **WHEN** 虚拟环境创建或依赖安装失败（子进程非 0 退出、超时或抛错）
- **THEN** 系统将环境 `initializationStatus` 置为 `failed`，写入 `lastErrorMessage`（失败原因摘要），`venvPath` 与 `initializedAt` 保持原值

#### Scenario: 安装超时
- **WHEN** pip 安装过程超过配置的超时时间（默认 10 分钟，可由 `DBT_INIT_TIMEOUT_MS` 调整）
- **THEN** 系统终止子进程，将环境状态置为 `failed` 并在 `lastErrorMessage` 中记录超时原因

### Requirement: venv 目录策略
系统 SHALL 将所有运行环境的虚拟环境集中存放在一个根目录下，每个环境按环境名分目录。

#### Scenario: 默认根目录
- **WHEN** 未配置 `DBT_VENV_ROOT` 环境变量
- **THEN** 系统使用进程当前工作目录下的 `venvs/` 作为根目录（`path.resolve(process.cwd(), "venvs")`）

#### Scenario: 自定义根目录
- **WHEN** 配置了 `DBT_VENV_ROOT` 环境变量
- **THEN** 系统使用该值（解析为绝对路径）作为 venv 根目录

#### Scenario: 环境名安全化
- **WHEN** 计算某环境的 venv 目录名
- **THEN** 系统对环境名做文件系统安全化（保留 `a-zA-Z0-9._-`，其余字符替换为 `_`），目录为 `<root>/<安全化后的环境名>/`

#### Scenario: 目录名冲突回退
- **WHEN** 安全化后的环境名与已有目录冲突或为空
- **THEN** 系统回退使用 `<root>/env-<id>/` 作为该环境的 venv 目录名，并将实际路径写入 `venvPath`

### Requirement: Python 解释器配置
系统 SHALL 通过配置确定创建虚拟环境所用的 Python 解释器。

#### Scenario: 使用指定解释器
- **WHEN** 配置了 `DBT_PYTHON_BIN` 环境变量
- **THEN** 系统使用该路径指向的 Python 解释器创建虚拟环境

#### Scenario: 自动探测解释器
- **WHEN** 未配置 `DBT_PYTHON_BIN`
- **THEN** 系统依次探测 `python3`、`python`，使用第一个可用的解释器

#### Scenario: 默认使用中国镜像源
- **WHEN** 未配置 `DBT_PIP_INDEX_URL` 环境变量
- **THEN** 系统在执行 pip install 时默认通过 `PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple` 传递清华 TUNA 镜像源给子进程

#### Scenario: 覆盖镜像源
- **WHEN** 配置了 `DBT_PIP_INDEX_URL` 环境变量（如设为 `https://pypi.org/simple` 使用官方源）
- **THEN** 系统在执行 pip install 时通过 `PIP_INDEX_URL` 传递该自定义镜像源给子进程

### Requirement: 初始化状态查询
系统的运行环境列表与详情接口 SHALL 返回每个环境的初始化状态，前端据此展示。

#### Scenario: 返回初始化状态字段
- **WHEN** 用户请求运行环境列表或详情
- **THEN** 响应包含 `initializationStatus`（pending/running/initialized/failed）、`venvPath`、`initializedAt`、`lastErrorMessage` 字段

#### Scenario: 页面展示初始化完成
- **WHEN** 某环境的 `initializationStatus` 为 `initialized`
- **THEN** 前端在该环境行展示状态"初始化完成"，并提供"重新初始化"操作

#### Scenario: 页面展示初始化失败
- **WHEN** 某环境的 `initializationStatus` 为 `failed`
- **THEN** 前端展示状态"初始化失败"及失败原因，并提供"重试初始化"操作

### Requirement: 初始化进度与日志实时推送
系统 SHALL 在初始化执行过程中，通过实时通道把状态变化与子进程输出日志推送给已订阅该环境的客户端。

#### Scenario: 订阅环境初始化事件
- **WHEN** 客户端通过 WebSocket 连接并发送 `{ type: "subscribe", topic: "environment:<id>:init" }`
- **THEN** 系统将该连接注册到该主题，后续该环境的初始化事件均推送给此连接

#### Scenario: 推送状态变化
- **WHEN** 初始化流程进入新的阶段（开始创建 venv、开始安装依赖、完成、失败）
- **THEN** 系统向已订阅该主题的客户端推送 `{ type: "event", topic, event: "status", data: { status, step } }`

#### Scenario: 推送子进程日志
- **WHEN** 创建 venv 或 pip install 的子进程输出 stdout/stderr 的一行
- **THEN** 系统向已订阅该主题的客户端推送 `{ type: "event", topic, event: "log", data: { stream: "stdout"|"stderr", line } }`

#### Scenario: 推送完成事件
- **WHEN** 初始化流程结束（成功或失败）
- **THEN** 系统向已订阅该主题的客户端推送 `{ type: "event", topic, event: "done", data: { status: "initialized"|"failed", error? } }`

#### Scenario: 取消订阅
- **WHEN** 客户端发送 `{ type: "unsubscribe", topic: "environment:<id>:init" }` 或断开连接
- **THEN** 系统移除该连接在该主题的订阅，不再向其推送事件

## ADDED Requirements

### Requirement: 标题生成与会话内容一致
会话标题的自动生成 SHALL 仅在对应一轮对话成功完成（LLM 产出最终文本并准备持久化 assistant 消息）后执行。当对话因任何原因失败（LLM 调用异常、工具执行异常等）时 SHALL NOT 更新会话标题，保持原标题（默认"新对话"），避免出现"标题已更新但无回复"的脏会话。

#### Scenario: 成功对话后生成标题
- **WHEN** 用户在标题为"新对话"的会话中发送首条消息，且该轮对话成功（emit `message_end` 前）
- **THEN** 系统 SHALL 在持久化 assistant 消息时将标题更新为用户首条消息的截断文本，随后 emit `message_end`

#### Scenario: 失败对话不更新标题
- **WHEN** 用户在标题为"新对话"的会话中发送首条消息，但该轮对话失败（emit `error`）
- **THEN** 系统 SHALL 保持会话标题为"新对话"，不落库脏标题

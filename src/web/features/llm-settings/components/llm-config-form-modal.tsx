"use client";

import { useState, useEffect } from "react";
import {
  Modal,
  Button,
  Input,
  Label,
  Select,
  ListBox,
  Switch,
  useOverlayState,
} from "@heroui/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  LLM_PROVIDER_OPTIONS,
  type LlmProvider,
  type LlmProviderConfigItem,
  type UpdateLlmConfigInput,
} from "@/web/types/settings";

interface LlmConfigFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 提交回调；isEdit 由调用方（基于 config 是否存在）决定如何处理 */
  onSubmit: (data: UpdateLlmConfigInput) => Promise<void>;
  config?: LlmProviderConfigItem | null;
}

export default function LlmConfigFormModal({
  isOpen,
  onClose,
  onSubmit,
  config,
}: LlmConfigFormModalProps) {
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<LlmProvider>("openai");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyTouched, setApiKeyTouched] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [temperature, setTemperature] = useState("");
  const [maxTokens, setMaxTokens] = useState("");
  const [topP, setTopP] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);

  const state = useOverlayState({
    isOpen,
    onOpenChange: (open) => {
      if (!open) onClose();
    },
  });

  const isEdit = !!config;

  useEffect(() => {
    if (config) {
      setName(config.name);
      setProvider(config.provider);
      setModel(config.model);
      setApiKey("");
      setApiKeyTouched(false);
      setBaseUrl(config.baseUrl ?? "");
      setTemperature(config.temperature?.toString() ?? "");
      setMaxTokens(config.maxTokens?.toString() ?? "");
      setTopP(config.topP?.toString() ?? "");
      setIsDefault(config.isDefault);
      setShowAdvanced(
        config.temperature !== null ||
          config.maxTokens !== null ||
          config.topP !== null,
      );
    } else {
      setName("");
      setProvider("openai");
      setModel("");
      setApiKey("");
      setApiKeyTouched(false);
      setBaseUrl("");
      setTemperature("");
      setMaxTokens("");
      setTopP("");
      setIsDefault(false);
      setShowAdvanced(false);
    }
  }, [config, isOpen]);

  const handleSubmit = async () => {
    if (!name.trim() || !model.trim()) return;
    // 新建时 API Key 必填（本地无 key 服务除外，但 OpenAI/Anthropic 均需 key）
    if (!isEdit && !apiKey.trim()) return;

    setLoading(true);
    try {
      const payload: UpdateLlmConfigInput = {
        name: name.trim(),
        provider,
        model: model.trim(),
        baseUrl: baseUrl.trim() || null,
        temperature: temperature === "" ? null : Number(temperature),
        maxTokens: maxTokens === "" ? null : Number(maxTokens),
        topP: topP === "" ? null : Number(topP),
        isDefault,
      };
      // 仅在用户编辑过 apiKey 且非空时提交（编辑时空值表示不修改）
      if (apiKeyTouched && apiKey.trim()) {
        payload.apiKey = apiKey.trim();
      }
      await onSubmit(payload);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal state={state}>
      <Modal.Backdrop>
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog>
            <Modal.Header>{isEdit ? "编辑大模型配置" : "新建大模型配置"}</Modal.Header>
            <Modal.Body className="gap-4">
              <div className="flex flex-col gap-1">
                <Label htmlFor="llm-name">预设名称 *</Label>
                <Input
                  id="llm-name"
                  fullWidth
                  placeholder="如 OpenAI 官方 / DeepSeek / Claude"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="llm-provider">协议供应商 *</Label>
                <Select
                  id="llm-provider"
                  className="w-full"
                  selectedKey={provider}
                  onChange={(key) => setProvider(key as LlmProvider)}
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {LLM_PROVIDER_OPTIONS.map((opt) => (
                        <ListBox.Item key={opt.value} id={opt.value} textValue={opt.label}>
                          <div className="flex flex-col">
                            <span>{opt.label}</span>
                            <span className="text-xs text-default-400">{opt.description}</span>
                          </div>
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="llm-model">模型名 *</Label>
                <Input
                  id="llm-model"
                  fullWidth
                  placeholder="如 gpt-4o-mini / deepseek-chat / claude-3-5-sonnet"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
                <span className="text-xs text-default-400">
                  模型必须支持 tool calling（函数调用），agent 高度依赖多轮工具调用
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="llm-key">
                  API Key {!isEdit ? "*" : ""}
                </Label>
                <Input
                  id="llm-key"
                  type="password"
                  fullWidth
                  placeholder={
                    isEdit && config?.hasApiKey
                      ? "已配置，留空表示不修改；如需更新请在此输入"
                      : "sk-..."
                  }
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setApiKeyTouched(true);
                  }}
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="llm-baseurl">Base URL（可选）</Label>
                <Input
                  id="llm-baseurl"
                  fullWidth
                  placeholder="OpenAI 兼容服务地址，如 https://api.deepseek.com/v1"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                />
                <span className="text-xs text-default-400">
                  OpenAI 协议下可指向 DeepSeek、Moonshot、本地 Ollama / vLLM 等
                </span>
              </div>

              {/* 高级参数：折叠 */}
              <div className="space-y-3">
                <button
                  type="button"
                  className="flex items-center gap-1 text-sm font-medium text-default-500"
                  onClick={() => setShowAdvanced((v) => !v)}
                >
                  {showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  高级参数
                </button>
                {showAdvanced && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="llm-temp">温度 (0~2)</Label>
                      <Input
                        id="llm-temp"
                        type="number"
                        fullWidth
                        min={0}
                        max={2}
                        step={0.1}
                        placeholder="默认"
                        value={temperature}
                        onChange={(e) => setTemperature(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="llm-maxtokens">最大 Tokens</Label>
                      <Input
                        id="llm-maxtokens"
                        type="number"
                        fullWidth
                        min={1}
                        max={1000000}
                        placeholder="默认"
                        value={maxTokens}
                        onChange={(e) => setMaxTokens(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="llm-topp">Top P (0~1)</Label>
                      <Input
                        id="llm-topp"
                        type="number"
                        fullWidth
                        min={0}
                        max={1}
                        step={0.1}
                        placeholder="默认"
                        value={topP}
                        onChange={(e) => setTopP(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="llm-default">设为当前生效配置</Label>
                <Switch
                  id="llm-default"
                  isSelected={isDefault}
                  onChange={setIsDefault}
                />
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="ghost" onPress={onClose}>
                取消
              </Button>
              <Button
                variant="primary"
                onPress={handleSubmit}
                isDisabled={
                  !name.trim() ||
                  !model.trim() ||
                  (!isEdit && !apiKey.trim())
                }
              >
                {isEdit ? "保存" : "创建"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

import { db } from "@/app/db";
import * as llmConfigRepo from "@/app/server/repositories/settings/llm-provider-config.repository";
import { encrypt, decrypt } from "@/app/server/lib/crypto";
import type {
  LlmProviderConfig,
  NewLlmProviderConfig,
} from "@/app/db/schema";
import type { LlmRuntimeConfig } from "@/app/server/agent/llm/config";

/**
 * 对外脱敏：剥离 encryptedApiKey，附加 hasApiKey 标记。
 * 明文 API Key 永不离开服务端（仅 agent 运行时通过 getActiveRuntimeConfig 解密使用）。
 */
function sanitize(config: LlmProviderConfig | null) {
  if (!config) return null;
  const { encryptedApiKey, ...rest } = config;
  return {
    ...rest,
    hasApiKey: !!encryptedApiKey,
  };
}

export type SanitizedLlmConfig = NonNullable<ReturnType<typeof sanitize>>;

/** 创建配置的输入类型（apiKey 明文替代 encryptedApiKey） */
type CreateLlmConfigInput = Omit<NewLlmProviderConfig, "encryptedApiKey"> & {
  apiKey?: string;
};

/** 更新配置的输入类型 */
type UpdateLlmConfigInput = {
  name?: string;
  provider?: "openai" | "anthropic";
  model?: string;
  apiKey?: string;
  baseUrl?: string | null;
  temperature?: number | null;
  maxTokens?: number | null;
  topP?: number | null;
  isDefault?: boolean;
  status?: "active" | "inactive";
};

/**
 * 创建配置（加密 apiKey）。
 * 若 isDefault=true，事务内清空其它生效标记，保证全局唯一。
 *
 * @throws Error 当同时指定 isDefault=true 且 status=inactive（停用项不可生效）
 */
export async function createLlmConfig(data: CreateLlmConfigInput) {
  const { apiKey, isDefault, ...rest } = data;
  // 停用项不可设为生效（与 activateLlmConfig 的校验一致）
  const effectiveDefault = isDefault && rest.status !== "inactive";
  if (isDefault && !effectiveDefault) {
    throw new Error("停用状态的配置不可设为生效");
  }
  const encryptedApiKey = apiKey ? encrypt(apiKey) : null;

  const created = await db.transaction(async () => {
    if (effectiveDefault) {
      // 先插入再清空其它标记，避免唯一性被自身占位
      const row = await llmConfigRepo.create({
        ...rest,
        encryptedApiKey,
        isDefault: true,
      });
      if (row) {
        await llmConfigRepo.clearOtherDefaults(row.id);
      }
      return row;
    }
    return llmConfigRepo.create({ ...rest, encryptedApiKey, isDefault: false });
  });

  return sanitize(created);
}

/** 查询配置详情（脱敏） */
export async function getLlmConfig(id: number) {
  return sanitize(await llmConfigRepo.findById(id));
}

/** 查询配置列表（脱敏） */
export async function listLlmConfigs(
  options: Parameters<typeof llmConfigRepo.findList>[0],
) {
  const result = await llmConfigRepo.findList(options);
  return {
    ...result,
    items: result.items.map((item) => sanitize(item)) as SanitizedLlmConfig[],
  };
}

/**
 * 更新配置。
 * - 仅在显式传入 apiKey（非空字符串）时重新加密
 * - isDefault=true 时事务内清空其它生效标记
 */
export async function updateLlmConfig(id: number, data: UpdateLlmConfigInput) {
  const { apiKey, isDefault, ...rest } = data;

  // 校验「生效项必须 active」不变式：覆盖两种破坏路径
  //   ① 把停用项设为生效（isDefault=true）
  //   ② 把已是生效的项改为停用（status=inactive 且当前 isDefault）
  if (isDefault === true || rest.status === "inactive") {
    const current = await llmConfigRepo.findById(id);
    if (!current) return null;
    const resultingStatus = rest.status ?? current.status;
    const resultingDefault = isDefault ?? current.isDefault;
    if (resultingDefault && resultingStatus !== "active") {
      throw new Error("停用状态的配置不可为生效项，请先取消「设为生效」或保持启用");
    }
  }

  const patch: Partial<NewLlmProviderConfig> = { ...rest };
  if (typeof apiKey === "string" && apiKey.length > 0) {
    patch.encryptedApiKey = encrypt(apiKey);
  }

  const updated = await db.transaction(async () => {
    if (isDefault === true) {
      await llmConfigRepo.clearOtherDefaults(id);
      patch.isDefault = true;
    } else if (isDefault === false) {
      patch.isDefault = false;
    }
    return llmConfigRepo.updateById(id, patch);
  });

  return sanitize(updated);
}

/** 删除配置（软删）。若删的是生效项，同步清除 isDefault 保持不变式。 */
export async function deleteLlmConfig(id: number) {
  const config = await llmConfigRepo.findById(id);
  if (!config) return null;
  // 软删生效项时一并清掉 isDefault，避免残留「已删除但仍是 default」的脏行
  if (config.isDefault) {
    await llmConfigRepo.updateById(id, { isDefault: false });
  }
  await llmConfigRepo.softDeleteById(id);
  return sanitize(config);
}

/**
 * 设为当前生效配置（事务内清空其它标记再标记本条）。
 *
 * @throws Error 当配置不存在、或处于停用状态时（停用项不可生效）
 */
export async function activateLlmConfig(id: number) {
  const config = await llmConfigRepo.findById(id);
  if (!config) return null;
  if (config.status !== "active") {
    throw new Error("该配置已停用，无法设为生效，请先启用");
  }

  await db.transaction(async () => {
    await llmConfigRepo.clearOtherDefaults(id);
    await llmConfigRepo.updateById(id, { isDefault: true });
  });

  return sanitize(await llmConfigRepo.findById(id));
}

/**
 * 获取当前生效配置并解密，供 agent LLM 工厂使用。
 * 这是唯一会解密 API Key 的出口；调用方仅限服务端 agent service。
 *
 * @throws Error 当未配置任何生效项时，抛出引导用户去设置页配置的明确错误。
 */
export async function getActiveRuntimeConfig(): Promise<LlmRuntimeConfig> {
  const active = await llmConfigRepo.findActive();
  if (!active) {
    throw new Error(
      "尚未配置生效的大模型。请在「系统设置 → 大模型配置」中添加并启用一项配置。",
    );
  }

  // 解密失败（密文被篡改 / 密钥更换）时给出可读提示，避免原始 crypto 错误透传
  let apiKey: string | undefined;
  if (active.encryptedApiKey) {
    try {
      apiKey = decrypt(active.encryptedApiKey);
    } catch {
      throw new Error(
        "当前生效配置的 API Key 解密失败，请在「系统设置 → 大模型配置」中重新填写。",
      );
    }
  }

  return {
    provider: active.provider,
    model: active.model,
    apiKey,
    baseUrl: active.baseUrl ?? undefined,
    temperature: active.temperature ?? undefined,
    maxTokens: active.maxTokens ?? undefined,
    topP: active.topP ?? undefined,
  };
}

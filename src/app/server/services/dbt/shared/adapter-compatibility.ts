/**
 * 适配器兼容性校验（共享逻辑）。
 *
 * 由 environment.service 与 task.service 共同复用：
 *   - 创建/更新运行环境时校验 version 的适配器包是否支持 connection 的数据库类型；
 *   - 创建/更新任务时再做一次，防御环境后续换了连接。
 *
 *（见 harden-dbt-construction-flow / D4）
 */

/** dbt 版本的适配器包结构（对齐 dbt_versions.adapterPackages） */
export interface AdapterPackage {
  name: string;
  version: string;
  supportedDatabases: string[];
}

/**
 * 校验给定适配器包集合是否支持目标数据库类型。
 * 空数组视为通配：不限定数据库类型，视为支持所有数据库。
 * 不支持时抛出 Error，由调用方映射为 400。
 */
export function validateAdapterCompatibility(
  adapterPackages: AdapterPackage[],
  databaseType: string,
): void {
  const supported = adapterPackages.some((pkg) =>
    pkg.supportedDatabases.length === 0
      ? true
      : pkg.supportedDatabases.includes(databaseType),
  );
  if (!supported) {
    throw new Error(`该版本的适配器包不支持 ${databaseType} 数据库类型`);
  }
}

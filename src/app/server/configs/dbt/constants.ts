/** dbt 域业务常量配置 */

/** ZIP 导入文件大小上限（字节），默认 50MB */
export const MAX_IMPORT_FILE_SIZE = 50 * 1024 * 1024;

/** 支持的文件扩展名列表 */
export const SUPPORTED_FILE_TYPES = [
  "sql",
  "yml",
  "yaml",
  "md",
  "py",
  "csv",
  "json",
  "txt",
] as const;

/** 导入时跳过的系统级配置文件 */
export const SKIP_IMPORT_FILES = [
  "dbt_project.yml",
  "packages.yml",
] as const;

/** 默认分页大小 */
export const DEFAULT_PAGE_SIZE = 20;

/** 最大分页大小 */
export const MAX_PAGE_SIZE = 100;

/** 数据库类型到 dbt 适配器包名的静态映射表 */
export const DB_TYPE_ADAPTER_MAP = {
  mysql5: { adapterPackage: "dbt-mysql", minAdapterVersion: "1.0.0" },
  mysql8: { adapterPackage: "dbt-mysql", minAdapterVersion: "1.0.0" },
  starrocks: { adapterPackage: "dbt-starrocks", minAdapterVersion: "1.0.0" },
  postgresql: { adapterPackage: "dbt-postgres", minAdapterVersion: "1.0.0" },
} as const;

/** 支持的数据库类型列表 */
export const SUPPORTED_DATABASE_TYPES = Object.keys(DB_TYPE_ADAPTER_MAP) as (
  | keyof typeof DB_TYPE_ADAPTER_MAP
)[];

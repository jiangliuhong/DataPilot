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

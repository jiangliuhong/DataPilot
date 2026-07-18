export interface MenuItem {
  key: string;
  label: string;
  icon?: string;
  badge?: string;
  group?: string;
  children?: MenuItem[];
}

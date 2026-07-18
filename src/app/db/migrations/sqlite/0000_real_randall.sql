CREATE TABLE `dbt_database_connections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text(255) NOT NULL,
	`database_type` text(20) NOT NULL,
	`host` text(255) NOT NULL,
	`port` integer NOT NULL,
	`database_name` text(255) NOT NULL,
	`schema_name` text(255),
	`username` text(255) NOT NULL,
	`encrypted_password` text NOT NULL,
	`extra_config` text,
	`status` text(8) DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dbt_database_connections_name_unique` ON `dbt_database_connections` (`name`);--> statement-breakpoint
CREATE TABLE `dbt_directories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`parent_id` integer,
	`name` text(255) NOT NULL,
	`path` text(500) NOT NULL,
	`depth` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `dbt_projects`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `dbt_directories`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `dbt_directories_project_id_idx` ON `dbt_directories` (`project_id`);--> statement-breakpoint
CREATE INDEX `dbt_directories_parent_id_idx` ON `dbt_directories` (`parent_id`);--> statement-breakpoint
CREATE INDEX `dbt_directories_path_idx` ON `dbt_directories` (`path`);--> statement-breakpoint
CREATE TABLE `dbt_files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`directory_id` integer,
	`name` text(255) NOT NULL,
	`path` text(500) NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`file_type` text(20) NOT NULL,
	`size` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `dbt_projects`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`directory_id`) REFERENCES `dbt_directories`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `dbt_files_project_id_idx` ON `dbt_files` (`project_id`);--> statement-breakpoint
CREATE INDEX `dbt_files_directory_id_idx` ON `dbt_files` (`directory_id`);--> statement-breakpoint
CREATE INDEX `dbt_files_path_idx` ON `dbt_files` (`path`);--> statement-breakpoint
CREATE INDEX `dbt_files_file_type_idx` ON `dbt_files` (`file_type`);--> statement-breakpoint
CREATE TABLE `dbt_project_environments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`environment_id` integer NOT NULL,
	`environment_alias` text(255),
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `dbt_projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`environment_id`) REFERENCES `dbt_runtime_environments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dbt_project_environments_unique` ON `dbt_project_environments` (`project_id`,`environment_id`);--> statement-breakpoint
CREATE TABLE `dbt_projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text(255) NOT NULL,
	`description` text,
	`status` text(10) DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dbt_projects_name_unique` ON `dbt_projects` (`name`);--> statement-breakpoint
CREATE TABLE `dbt_runtime_environments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text(255) NOT NULL,
	`version_id` integer NOT NULL,
	`connection_id` integer NOT NULL,
	`status` text(8) DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`version_id`) REFERENCES `dbt_versions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`connection_id`) REFERENCES `dbt_database_connections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dbt_runtime_environments_name_unique` ON `dbt_runtime_environments` (`name`);--> statement-breakpoint
CREATE TABLE `dbt_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text(255) NOT NULL,
	`version` text(50) NOT NULL,
	`adapter_packages` text NOT NULL,
	`dependencies` text NOT NULL,
	`status` text(8) DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dbt_versions_name_unique` ON `dbt_versions` (`name`);
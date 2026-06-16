CREATE TABLE `users` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`username` varchar(64) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`display_name` varchar(128) NOT NULL,
	`email` varchar(255),
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	`deleted_at` timestamp,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
ALTER TABLE `dbt_runtime_environments` DROP FOREIGN KEY `dbt_runtime_environments_version_id_dbt_versions_id_fk`;
--> statement-breakpoint
ALTER TABLE `dbt_runtime_environments` DROP FOREIGN KEY `dbt_runtime_environments_connection_id_dbt_database_connections_id_fk`;
--> statement-breakpoint
ALTER TABLE `dbt_project_environments` DROP FOREIGN KEY `dbt_project_environments_project_id_dbt_projects_id_fk`;
--> statement-breakpoint
ALTER TABLE `dbt_project_environments` DROP FOREIGN KEY `dbt_project_environments_environment_id_dbt_runtime_environments_id_fk`;
--> statement-breakpoint
ALTER TABLE `dbt_projects` MODIFY COLUMN `id` bigint AUTO_INCREMENT NOT NULL;--> statement-breakpoint
ALTER TABLE `dbt_directories` MODIFY COLUMN `id` bigint AUTO_INCREMENT NOT NULL;--> statement-breakpoint
ALTER TABLE `dbt_directories` MODIFY COLUMN `project_id` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `dbt_directories` MODIFY COLUMN `parent_id` bigint;--> statement-breakpoint
ALTER TABLE `dbt_directories` MODIFY COLUMN `path` varchar(500) NOT NULL;--> statement-breakpoint
ALTER TABLE `dbt_directories` MODIFY COLUMN `depth` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `dbt_directories` MODIFY COLUMN `sort_order` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `dbt_files` MODIFY COLUMN `id` bigint AUTO_INCREMENT NOT NULL;--> statement-breakpoint
ALTER TABLE `dbt_files` MODIFY COLUMN `project_id` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `dbt_files` MODIFY COLUMN `directory_id` bigint;--> statement-breakpoint
ALTER TABLE `dbt_files` MODIFY COLUMN `path` varchar(500) NOT NULL;--> statement-breakpoint
ALTER TABLE `dbt_files` MODIFY COLUMN `size` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `dbt_versions` MODIFY COLUMN `id` bigint AUTO_INCREMENT NOT NULL;--> statement-breakpoint
ALTER TABLE `dbt_database_connections` MODIFY COLUMN `id` bigint AUTO_INCREMENT NOT NULL;--> statement-breakpoint
ALTER TABLE `dbt_database_connections` MODIFY COLUMN `port` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `dbt_runtime_environments` MODIFY COLUMN `id` bigint AUTO_INCREMENT NOT NULL;--> statement-breakpoint
ALTER TABLE `dbt_project_environments` MODIFY COLUMN `id` bigint AUTO_INCREMENT NOT NULL;--> statement-breakpoint
ALTER TABLE `dbt_runtime_environments` ADD CONSTRAINT `runtime_env_version_fk` FOREIGN KEY (`version_id`) REFERENCES `dbt_versions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dbt_runtime_environments` ADD CONSTRAINT `runtime_env_connection_fk` FOREIGN KEY (`connection_id`) REFERENCES `dbt_database_connections`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dbt_project_environments` ADD CONSTRAINT `project_env_project_fk` FOREIGN KEY (`project_id`) REFERENCES `dbt_projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dbt_project_environments` ADD CONSTRAINT `project_env_environment_fk` FOREIGN KEY (`environment_id`) REFERENCES `dbt_runtime_environments`(`id`) ON DELETE cascade ON UPDATE no action;
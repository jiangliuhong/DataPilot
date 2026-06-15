CREATE TABLE `dbt_versions` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`version` varchar(50) NOT NULL,
	`adapter_packages` json NOT NULL,
	`dependencies` json NOT NULL,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	`deleted_at` timestamp,
	CONSTRAINT `dbt_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `dbt_versions_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `dbt_database_connections` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`database_type` enum('mysql5','mysql8','starrocks','postgresql') NOT NULL,
	`host` varchar(255) NOT NULL,
	`port` int NOT NULL,
	`database_name` varchar(255) NOT NULL,
	`schema_name` varchar(255),
	`username` varchar(255) NOT NULL,
	`encrypted_password` text NOT NULL,
	`extra_config` json,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	`deleted_at` timestamp,
	CONSTRAINT `dbt_database_connections_id` PRIMARY KEY(`id`),
	CONSTRAINT `dbt_database_connections_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `dbt_runtime_environments` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`version_id` bigint unsigned NOT NULL,
	`connection_id` bigint unsigned NOT NULL,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	`deleted_at` timestamp,
	CONSTRAINT `dbt_runtime_environments_id` PRIMARY KEY(`id`),
	CONSTRAINT `dbt_runtime_environments_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `dbt_project_environments` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`project_id` bigint unsigned NOT NULL,
	`environment_id` bigint unsigned NOT NULL,
	`environment_alias` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	`deleted_at` timestamp,
	CONSTRAINT `dbt_project_environments_id` PRIMARY KEY(`id`),
	CONSTRAINT `dbt_project_environments_unique` UNIQUE(`project_id`,`environment_id`)
);
--> statement-breakpoint
ALTER TABLE `dbt_runtime_environments` ADD CONSTRAINT `dbt_runtime_environments_version_id_fk` FOREIGN KEY (`version_id`) REFERENCES `dbt_versions`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `dbt_runtime_environments` ADD CONSTRAINT `dbt_runtime_environments_connection_id_fk` FOREIGN KEY (`connection_id`) REFERENCES `dbt_database_connections`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `dbt_project_environments` ADD CONSTRAINT `dbt_project_environments_project_id_fk` FOREIGN KEY (`project_id`) REFERENCES `dbt_projects`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `dbt_project_environments` ADD CONSTRAINT `dbt_project_environments_environment_id_fk` FOREIGN KEY (`environment_id`) REFERENCES `dbt_runtime_environments`(`id`) ON DELETE cascade ON UPDATE no action;

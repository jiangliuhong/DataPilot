CREATE TABLE `dbt_projects` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	`deleted_at` timestamp,
	CONSTRAINT `dbt_projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `dbt_projects_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `dbt_directories` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`parent_id` int,
	`name` varchar(255) NOT NULL,
	`path` varchar(1024) NOT NULL,
	`depth` int NOT NULL DEFAULT 0,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	`deleted_at` timestamp,
	CONSTRAINT `dbt_directories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dbt_files` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`project_id` int NOT NULL,
	`directory_id` int,
	`name` varchar(255) NOT NULL,
	`path` varchar(1024) NOT NULL,
	`content` text NOT NULL DEFAULT (''),
	`file_type` varchar(20) NOT NULL,
	`size` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	`deleted_at` timestamp,
	CONSTRAINT `dbt_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `dbt_directories` ADD CONSTRAINT `dbt_directories_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `dbt_projects`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `dbt_directories` ADD CONSTRAINT `dbt_directories_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `dbt_directories`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `dbt_files` ADD CONSTRAINT `dbt_files_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `dbt_projects`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `dbt_files` ADD CONSTRAINT `dbt_files_directory_id_fkey` FOREIGN KEY (`directory_id`) REFERENCES `dbt_directories`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX `dbt_directories_project_id_idx` ON `dbt_directories` (`project_id`);--> statement-breakpoint
CREATE INDEX `dbt_directories_parent_id_idx` ON `dbt_directories` (`parent_id`);--> statement-breakpoint
CREATE INDEX `dbt_directories_path_idx` ON `dbt_directories` (`path`);--> statement-breakpoint
CREATE INDEX `dbt_files_project_id_idx` ON `dbt_files` (`project_id`);--> statement-breakpoint
CREATE INDEX `dbt_files_directory_id_idx` ON `dbt_files` (`directory_id`);--> statement-breakpoint
CREATE INDEX `dbt_files_path_idx` ON `dbt_files` (`path`);--> statement-breakpoint
CREATE INDEX `dbt_files_file_type_idx` ON `dbt_files` (`file_type`);
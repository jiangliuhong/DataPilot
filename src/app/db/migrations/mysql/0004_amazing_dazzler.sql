CREATE TABLE `dbt_task_runs` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`task_id` bigint NOT NULL,
	`status` enum('queued','running','succeeded','failed','canceled') NOT NULL DEFAULT 'queued',
	`exit_code` bigint,
	`error_message` text,
	`started_at` timestamp,
	`finished_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dbt_task_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dbt_tasks` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`project_id` bigint NOT NULL,
	`environment_id` bigint NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`command` enum('run','build','test','compile','seed','snapshot') NOT NULL,
	`select_arg` text,
	`exclude_arg` text,
	`full_refresh` boolean NOT NULL DEFAULT false,
	`vars_arg` text,
	`target_arg` varchar(255),
	`schedule_cron` varchar(100),
	`schedule_status` enum('disabled','enabled') NOT NULL DEFAULT 'disabled',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	`deleted_at` timestamp,
	CONSTRAINT `dbt_tasks_id` PRIMARY KEY(`id`),
	CONSTRAINT `dbt_tasks_project_name_unique` UNIQUE(`project_id`,`name`)
);
--> statement-breakpoint
ALTER TABLE `dbt_runtime_environments` ADD `initialization_status` enum('pending','running','initialized','failed') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `dbt_runtime_environments` ADD `venv_path` varchar(512);--> statement-breakpoint
ALTER TABLE `dbt_runtime_environments` ADD `initialized_at` timestamp;--> statement-breakpoint
ALTER TABLE `dbt_runtime_environments` ADD `last_error_message` text;--> statement-breakpoint
ALTER TABLE `dbt_task_runs` ADD CONSTRAINT `task_run_task_fk` FOREIGN KEY (`task_id`) REFERENCES `dbt_tasks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dbt_tasks` ADD CONSTRAINT `task_project_fk` FOREIGN KEY (`project_id`) REFERENCES `dbt_projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dbt_tasks` ADD CONSTRAINT `task_environment_fk` FOREIGN KEY (`environment_id`) REFERENCES `dbt_runtime_environments`(`id`) ON DELETE cascade ON UPDATE no action;
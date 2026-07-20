CREATE TABLE `dbt_task_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`status` text(12) DEFAULT 'queued' NOT NULL,
	`exit_code` integer,
	`error_message` text,
	`started_at` integer,
	`finished_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `dbt_tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `dbt_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`environment_id` integer NOT NULL,
	`name` text(255) NOT NULL,
	`description` text,
	`command` text(20) NOT NULL,
	`select_arg` text,
	`exclude_arg` text,
	`full_refresh` integer DEFAULT false NOT NULL,
	`vars_arg` text,
	`target_arg` text(255),
	`schedule_cron` text(100),
	`schedule_status` text(10) DEFAULT 'disabled' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `dbt_projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`environment_id`) REFERENCES `dbt_runtime_environments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dbt_tasks_project_name_unique` ON `dbt_tasks` (`project_id`,`name`);
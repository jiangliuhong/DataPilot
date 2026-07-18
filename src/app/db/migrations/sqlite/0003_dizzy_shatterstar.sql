ALTER TABLE `dbt_runtime_environments` ADD `initialization_status` text(20) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `dbt_runtime_environments` ADD `venv_path` text(512);--> statement-breakpoint
ALTER TABLE `dbt_runtime_environments` ADD `initialized_at` integer;--> statement-breakpoint
ALTER TABLE `dbt_runtime_environments` ADD `last_error_message` text;
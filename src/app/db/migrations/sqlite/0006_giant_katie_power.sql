CREATE TABLE `llm_provider_configs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text(100) NOT NULL,
	`provider` text(32) NOT NULL,
	`model` text(100) NOT NULL,
	`encrypted_api_key` text(2048),
	`base_url` text(512),
	`temperature` real,
	`max_tokens` integer,
	`top_p` real,
	`is_default` integer DEFAULT false NOT NULL,
	`status` text(8) DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer
);

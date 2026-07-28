CREATE TABLE `llm_provider_configs` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`provider` enum('openai','anthropic') NOT NULL,
	`model` varchar(100) NOT NULL,
	`encrypted_api_key` text,
	`base_url` varchar(512),
	`temperature` double,
	`max_tokens` int,
	`top_p` double,
	`is_default` boolean NOT NULL DEFAULT false,
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	`deleted_at` timestamp,
	CONSTRAINT `llm_provider_configs_id` PRIMARY KEY(`id`)
);

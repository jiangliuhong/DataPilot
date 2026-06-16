CREATE TABLE `agent_conversations` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`user_id` bigint NOT NULL,
	`title` varchar(255) NOT NULL DEFAULT '新对话',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	`deleted_at` timestamp,
	CONSTRAINT `agent_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agent_messages` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`conversation_id` bigint NOT NULL,
	`role` enum('user','assistant','tool') NOT NULL,
	`content` text,
	`tool_calls` text,
	`tool_call_id` varchar(128),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `agent_conversations` ADD CONSTRAINT `agent_conversations_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `agent_messages` ADD CONSTRAINT `agent_messages_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `agent_conversations`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX `agent_conversations_user_id_idx` ON `agent_conversations` (`user_id`);--> statement-breakpoint
CREATE INDEX `agent_conversations_user_deleted_idx` ON `agent_conversations` (`user_id`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `agent_messages_conversation_id_idx` ON `agent_messages` (`conversation_id`);
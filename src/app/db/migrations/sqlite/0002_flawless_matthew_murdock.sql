CREATE TABLE `agent_conversations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`title` text(255) DEFAULT '新对话' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `agent_conversations_user_id_idx` ON `agent_conversations` (`user_id`);--> statement-breakpoint
CREATE INDEX `agent_conversations_user_deleted_idx` ON `agent_conversations` (`user_id`,`deleted_at`);--> statement-breakpoint
CREATE TABLE `agent_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`conversation_id` integer NOT NULL,
	`role` text(16) NOT NULL,
	`content` text,
	`tool_calls` text,
	`tool_call_id` text(128),
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `agent_conversations`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `agent_messages_conversation_id_idx` ON `agent_messages` (`conversation_id`);
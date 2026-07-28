CREATE TABLE `agent_workspaces` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`user_id` bigint NOT NULL,
	`type` varchar(32) NOT NULL,
	`ref_id` bigint NOT NULL,
	`name` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	`deleted_at` timestamp,
	CONSTRAINT `agent_workspaces_id` PRIMARY KEY(`id`),
	CONSTRAINT `agent_workspaces_user_type_ref_idx` UNIQUE(`user_id`,`type`,`ref_id`,`deleted_at`)
);
--> statement-breakpoint
ALTER TABLE `agent_conversations` ADD `workspace_id` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `agent_workspaces` ADD CONSTRAINT `agent_workspaces_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX `agent_workspaces_user_deleted_idx` ON `agent_workspaces` (`user_id`,`deleted_at`);--> statement-breakpoint
ALTER TABLE `agent_conversations` ADD CONSTRAINT `agent_conversations_workspace_id_fkey` FOREIGN KEY (`workspace_id`) REFERENCES `agent_workspaces`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX `agent_conversations_workspace_id_idx` ON `agent_conversations` (`workspace_id`);
CREATE TABLE `agent_workspaces` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`type` text(32) NOT NULL,
	`ref_id` integer NOT NULL,
	`name` text(255) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agent_workspaces_user_type_ref_idx` ON `agent_workspaces` (`user_id`,`type`,`ref_id`);--> statement-breakpoint
CREATE INDEX `agent_workspaces_user_deleted_idx` ON `agent_workspaces` (`user_id`,`deleted_at`);--> statement-breakpoint
ALTER TABLE `agent_conversations` ADD `workspace_id` integer NOT NULL REFERENCES agent_workspaces(id);--> statement-breakpoint
CREATE INDEX `agent_conversations_workspace_id_idx` ON `agent_conversations` (`workspace_id`);
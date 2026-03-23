CREATE TABLE `generatedImages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`imageUrl` text NOT NULL,
	`imageKey` text NOT NULL,
	`prompt` text NOT NULL,
	`orderIndex` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `generatedImages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`originalImageUrl` text NOT NULL,
	`originalImageKey` text NOT NULL,
	`processedImageUrl` text,
	`processedImageKey` text,
	`platforms` text NOT NULL,
	`imageType` enum('main','detail') NOT NULL,
	`productName` text NOT NULL,
	`productParams` text,
	`productSellingPoints` text,
	`marketingCopy` text,
	`status` enum('draft','processing','completed','failed') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `generatedImages` ADD CONSTRAINT `generatedImages_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
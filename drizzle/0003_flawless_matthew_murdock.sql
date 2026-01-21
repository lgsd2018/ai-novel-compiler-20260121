CREATE TABLE `platformAccounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`platform` enum('qidian','jinjiang','zongheng','17k') NOT NULL,
	`username` varchar(255) NOT NULL,
	`encryptedPassword` text,
	`apiKey` text,
	`accessToken` text,
	`refreshToken` text,
	`tokenExpiresAt` timestamp,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `platformAccounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `publishingLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`level` enum('info','warning','error') NOT NULL DEFAULT 'info',
	`message` text NOT NULL,
	`details` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `publishingLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `publishingTasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int NOT NULL,
	`platformAccountId` int NOT NULL,
	`platform` enum('qidian','jinjiang','zongheng','17k') NOT NULL,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`platformWorkId` text,
	`platformWorkUrl` text,
	`publishConfig` json,
	`totalChapters` int NOT NULL DEFAULT 0,
	`publishedChapters` int NOT NULL DEFAULT 0,
	`failedChapters` int NOT NULL DEFAULT 0,
	`errorMessage` text,
	`errorLog` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completedAt` timestamp,
	CONSTRAINT `publishingTasks_id` PRIMARY KEY(`id`)
);

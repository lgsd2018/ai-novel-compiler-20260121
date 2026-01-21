CREATE TABLE `platform_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`platform` enum('qidian','jinjiang','zongheng','17k') NOT NULL,
	`ruleType` varchar(100) NOT NULL,
	`ruleName` varchar(255) NOT NULL,
	`ruleValue` json NOT NULL,
	`description` text,
	`version` varchar(50) NOT NULL DEFAULT '1.0',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `platform_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sensitive_words` (
	`id` int AUTO_INCREMENT NOT NULL,
	`word` text NOT NULL,
	`category` varchar(50) NOT NULL,
	`isRegex` boolean NOT NULL DEFAULT false,
	`severity` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`replacement` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sensitive_words_id` PRIMARY KEY(`id`)
);

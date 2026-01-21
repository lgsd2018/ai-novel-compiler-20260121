CREATE TABLE `speech_recognition_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int,
	`documentId` int,
	`audioUrl` text,
	`audioFormat` varchar(20) NOT NULL DEFAULT 'webm',
	`audioDuration` int,
	`transcript` text NOT NULL,
	`language` varchar(10) NOT NULL DEFAULT 'zh',
	`recognitionType` enum('file','streaming') NOT NULL DEFAULT 'file',
	`confidence` decimal(5,4),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `speech_recognition_history_id` PRIMARY KEY(`id`)
);

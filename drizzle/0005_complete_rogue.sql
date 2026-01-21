CREATE TABLE `tts_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cacheKey` varchar(64) NOT NULL,
	`audioData` MEDIUMTEXT NOT NULL,
	`format` varchar(10) NOT NULL DEFAULT 'mp3',
	`duration` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastAccessedAt` timestamp NOT NULL DEFAULT (now()),
	`accessCount` int NOT NULL DEFAULT 1,
	CONSTRAINT `tts_cache_id` PRIMARY KEY(`id`),
	CONSTRAINT `tts_cache_cacheKey_unique` UNIQUE(`cacheKey`)
);

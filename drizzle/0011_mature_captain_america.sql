CREATE TABLE `business_metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`year` int NOT NULL,
	`totalTransactionAmount` int DEFAULT 0,
	`assessmentCount` int DEFAULT 0,
	`contractCount` int DEFAULT 0,
	`memo` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `business_metrics_id` PRIMARY KEY(`id`)
);

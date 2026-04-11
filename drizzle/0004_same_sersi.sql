CREATE TABLE `vehicle_media` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vehicleId` int NOT NULL,
	`type` enum('image','video') NOT NULL,
	`url` text NOT NULL,
	`thumbnailUrl` text,
	`displayOrder` int DEFAULT 0,
	`isMain` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vehicle_media_id` PRIMARY KEY(`id`)
);

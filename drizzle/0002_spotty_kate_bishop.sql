CREATE TABLE `slideshow_media` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('image','video') NOT NULL,
	`url` text NOT NULL,
	`thumbnailUrl` text,
	`title` varchar(255),
	`displayOrder` int DEFAULT 0,
	`isPublished` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `slideshow_media_id` PRIMARY KEY(`id`)
);

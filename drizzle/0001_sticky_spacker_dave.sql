CREATE TABLE `purchase_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vehicleName` varchar(255) NOT NULL,
	`purchasePrice` int NOT NULL,
	`priceDisplay` varchar(50),
	`imageUrl` text,
	`purchaseDate` timestamp,
	`comment` text,
	`isPublished` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchase_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`price` int,
	`priceDisplay` varchar(50),
	`videoUrl` text,
	`thumbnailUrl` text,
	`description` text,
	`status` enum('在庫あり','商談中','売約済み') NOT NULL DEFAULT '在庫あり',
	`displayOrder` int DEFAULT 0,
	`isPublished` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vehicles_id` PRIMARY KEY(`id`)
);

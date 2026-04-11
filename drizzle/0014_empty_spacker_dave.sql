ALTER TABLE `vehicle_media` ADD `bunnyStatus` enum('pending','processing','ready','error') DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `vehicle_media` ADD `bunnyEncodeProgress` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `vehicle_media` ADD `optimizedUrls` text;
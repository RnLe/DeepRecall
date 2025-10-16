CREATE TABLE `blobs` (
	`hash` text PRIMARY KEY NOT NULL,
	`size` integer NOT NULL,
	`mime` text NOT NULL,
	`mtime_ms` integer NOT NULL,
	`created_ms` integer NOT NULL,
	`filename` text
);
--> statement-breakpoint
CREATE TABLE `paths` (
	`hash` text NOT NULL,
	`path` text PRIMARY KEY NOT NULL,
	FOREIGN KEY (`hash`) REFERENCES `blobs`(`hash`) ON UPDATE no action ON DELETE cascade
);

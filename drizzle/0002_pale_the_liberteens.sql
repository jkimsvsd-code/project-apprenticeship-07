CREATE TABLE `import_request_limits` (
	`user_id` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL,
	`request_count` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE cascade
);

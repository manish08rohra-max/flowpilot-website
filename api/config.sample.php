<?php
// Copy this file to "config.php" on the server and fill in the REAL values.
// config.php is git-ignored — real credentials never enter the repository.

define("DB_HOST", "localhost");
define("DB_NAME", "your_database_name");
define("DB_USER", "your_database_user");
define("DB_PASS", "your_database_password");

// Random string used to hash visitor IPs (privacy: raw IPs are never stored)
define("IP_HASH_SALT", "change-this-to-a-long-random-string");

// Enquiry notifications go here; best-effort (the DB row is the real record)
define("NOTIFY_EMAIL", "info@flowpilotai.co.in");

// mail() From address — should be a mailbox on your own domain for deliverability
define("NOTIFY_FROM", "enquiries@flowpilotai.co.in");

// Origins allowed to submit (CORS). Update if the site domain changes.
$GLOBALS["ALLOWED_ORIGINS"] = array(
  "https://flowpilotai.co.in",
  "https://www.flowpilotai.co.in"
);

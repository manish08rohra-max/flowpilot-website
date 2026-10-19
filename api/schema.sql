-- FlowPilot enquiry capture — schema for the GoDaddy hosted MySQL database.
-- Run ONCE from the hosting dashboard's database tool (phpMyAdmin → Import,
-- or paste into the SQL runner) with the site's database selected.
--
-- Non-destructive and re-runnable: CREATE TABLE IF NOT EXISTS leaves any
-- existing enquiries table and its data untouched. Re-running may report
-- "Duplicate key name 'idx_enquiries_ip_time'" for the index — harmless.

CREATE TABLE IF NOT EXISTS enquiries (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  name VARCHAR(120) NOT NULL,
  business VARCHAR(160) NULL,
  email VARCHAR(190) NOT NULL,
  phone VARCHAR(40) NULL,
  topic VARCHAR(80) NULL,
  message TEXT NOT NULL,
  ip_hash CHAR(64) NULL,
  user_agent VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_enquiries_ip_time ON enquiries (ip_hash, submitted_at);

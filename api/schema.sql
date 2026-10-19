-- FlowPilot enquiry capture — run once in cPanel → phpMyAdmin
-- (select the FlowPilot database first, then run this SQL)

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

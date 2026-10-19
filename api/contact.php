<?php
/**
 * FlowPilot enquiry capture endpoint (GoDaddy PHP + MySQL).
 * POST { name, business?, email, phone?, topic?, message, company-website? (honeypot) }
 * Returns JSON: {"ok":true} — never exposes database or server details.
 */
error_reporting(0);
ini_set("display_errors", "0");
header("Content-Type: application/json; charset=utf-8");

// CORS: only the site's own origins may submit (configured in config file)
$origin = isset($_SERVER["HTTP_ORIGIN"]) ? $_SERVER["HTTP_ORIGIN"] : "";
if (isset($GLOBALS["ALLOWED_ORIGINS"]) && in_array($origin, $GLOBALS["ALLOWED_ORIGINS"], true)) {
  header("Access-Control-Allow-Origin: " . $origin);
  header("Vary: Origin");
}
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("X-Content-Type-Options: nosniff");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") { http_response_code(204); exit; }
if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  http_response_code(405);
  echo json_encode(array("ok" => false, "error" => "Method not allowed"));
  exit;
}

if (!file_exists(__DIR__ . "/config.php")) {
  http_response_code(500);
  echo json_encode(array("ok" => false, "error" => "Server not configured"));
  exit;
}
require __DIR__ . "/config.php";

// Decode JSON body (fetch) or fall back to form-encoded posts
$raw = file_get_contents("php://input");
$data = json_decode($raw, true);
if (!is_array($data)) { $data = $_POST; }

// Honeypot — pretend success for bots
if (!empty($data["company-website"])) {
  echo json_encode(array("ok" => true));
  exit;
}

$name     = isset($data["name"])     ? trim(strip_tags((string)$data["name"])) : "";
$business = isset($data["business"]) ? trim(strip_tags((string)$data["business"])) : "";
$email    = isset($data["email"])    ? trim((string)$data["email"]) : "";
$phone    = isset($data["phone"])    ? trim((string)$data["phone"]) : "";
$topic    = isset($data["topic"])    ? trim(strip_tags((string)$data["topic"])) : "";
$message  = isset($data["message"])  ? trim(strip_tags((string)$data["message"])) : "";

$valid = ($name !== "" && $message !== "" && filter_var($email, FILTER_VALIDATE_EMAIL))
  && mb_strlen($name) <= 120 && mb_strlen($business) <= 160 && mb_strlen($phone) <= 40
  && mb_strlen($topic) <= 80 && mb_strlen($message) <= 5000;

if (!$valid) {
  http_response_code(422);
  echo json_encode(array("ok" => false, "error" => "Invalid submission"));
  exit;
}

// Basic rate limit: max 5 enquiries per hashed IP per 10 minutes
$ipHash = hash("sha256", (isset($_SERVER["REMOTE_ADDR"]) ? $_SERVER["REMOTE_ADDR"] : "") . IP_HASH_SALT);

try {
  $db = new PDO(
    "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
    DB_USER,
    DB_PASS,
    array(PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 5)
  );

  $stmt = $db->prepare(
    "SELECT COUNT(*) FROM enquiries WHERE ip_hash = ? AND submitted_at > (NOW() - INTERVAL 10 MINUTE)"
  );
  $stmt->execute(array($ipHash));
  if ((int)$stmt->fetchColumn() >= 5) {
    http_response_code(429);
    echo json_encode(array("ok" => false, "error" => "Too many submissions"));
    exit;
  }

  $stmt = $db->prepare(
    "INSERT INTO enquiries (name, business, email, phone, topic, message, ip_hash, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  $stmt->execute(array(
    $name,
    $business,
    $email,
    $phone,
    $topic,
    $message,
    $ipHash,
    substr(isset($_SERVER["HTTP_USER_AGENT"]) ? $_SERVER["HTTP_USER_AGENT"] : "", 0, 255)
  ));

  // Email notification — best effort; the DB row is the real record
  $subject = "Website enquiry — " . ($topic !== "" ? $topic : "General");
  $lines = array(
    "Name: " . $name,
    "Business: " . $business,
    "Email: " . $email,
    "Phone: " . $phone,
    "",
    $message
  );
  $headers = "From: " . NOTIFY_FROM . "\r\n"
           . "Reply-To: " . $email . "\r\n"
           . "Content-Type: text/plain; charset=utf-8";
  @mail(NOTIFY_EMAIL, $subject, implode("\n", $lines), $headers);

  echo json_encode(array("ok" => true));
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(array("ok" => false, "error" => "Server error"));
}

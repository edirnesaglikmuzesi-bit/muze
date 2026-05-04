<?php

header("Content-Type: application/json");

$api_key = "sk-xxxx"; // API key buraya

$data = json_decode(file_get_contents("php://input"), true);
$message = $data["message"] ?? "";

$fullPrompt = "Sen Sultan II. Bayezid Külliyesi Sağlık Müzesi'nin dijital rehberisin. 
Ziyaretçilere tarihî, kültürel ve mimari bilgileri akıcı, etkileyici ve anlaşılır şekilde anlatırsın. 
Cevapların kısa ama bilgilendirici olsun. 
Samimi ama profesyonel bir dil kullan. 
Konu dışına çıkma, sadece külliye ve Osmanlı tıbbı hakkında konuş.

Soru: " . $message;

$payload = [
  "model" => "claude-3-haiku-20240307",
  "max_tokens" => 300,
  "messages" => [
    [
      "role" => "user",
      "content" => $fullPrompt
    ]
  ]
];

$ch = curl_init("https://api.anthropic.com/v1/messages");

curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
  "Content-Type: application/json",
  "x-api-key: $api_key",
  "anthropic-version: 2023-06-01"
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));

$response = curl_exec($ch);

if (!$response) {
  echo json_encode(["reply" => "API bağlantı hatası"]);
  exit;
}

curl_close($ch);

$result = json_decode($response, true);

echo json_encode([
  "reply" => $result["content"][0]["text"] ?? "Cevap alınamadı"
]);

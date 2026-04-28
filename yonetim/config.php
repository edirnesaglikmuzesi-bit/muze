<?php
// Hata raporlamayı açalım (Sorun varsa ekranda görelim)
error_reporting(E_ALL);
ini_set('display_errors', 1);

session_start();

$dosya = __DIR__ . '/ayarlar.json';

// Eğer ayarlar.json yoksa, otomatik olarak oluştur
if (!file_exists($dosya)) {
    $ilk_kurulum = [
        "kullanici" => "admin",
        "sifre" => password_hash("123456", PASSWORD_DEFAULT)
    ];
    file_put_contents($dosya, json_encode($ilk_kurulum, JSON_PRETTY_PRINT));
}

$ayarlar = json_decode(file_get_contents($dosya), true);

function oturumKontrol() {
    if (!isset($_SESSION['giris_yapildi'])) {
        header("Location: login.php");
        exit;
    }
}
?>

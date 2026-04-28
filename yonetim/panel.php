<?php
require 'config.php';
oturumKontrol();

$mesaj = "";

if (isset($_POST['guncelle'])) {
    $yeni_user = $_POST['yeni_user'];
    $yeni_pass = $_POST['yeni_pass'];
    
    // Eğer şifre alanı boşsa eski şifreyi koru, doluysa yenisini hashle
    $guncel_sifre = !empty($yeni_pass) ? password_hash($yeni_pass, PASSWORD_DEFAULT) : $ayarlar['sifre'];
    
    $yeni_veriler = [
        "kullanici" => $yeni_user,
        "sifre" => $guncel_sifre
    ];
    
    if(file_put_contents('ayarlar.json', json_encode($yeni_veriler, JSON_PRETTY_PRINT))) {
        $ayarlar = $yeni_veriler;
        $mesaj = "Bilgiler başarıyla güncellendi!";
    } else {
        $mesaj = "Hata: Dosya yazılamadı! Klasör izinlerini kontrol edin.";
    }
}

if (isset($_GET['cikis'])) {
    session_destroy();
    header("Location: login.php");
    exit;
}
?>
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <title>Yönetim Paneli</title>
    <style>
        body { font-family: sans-serif; display: flex; margin: 0; background: #f4f4f4; }
        .sidebar { width: 240px; background: #1e1e1e; color: white; height: 100vh; padding: 20px; box-sizing: border-box; }
        .main { flex: 1; padding: 40px; }
        .card { background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 400px; }
        input { width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
        .btn { background: #d4af37; color: #1e1e1e; border: none; padding: 12px; width: 100%; cursor: pointer; font-weight: bold; }
        .msg { color: green; margin-bottom: 15px; font-weight: bold; }
        a { color: #ff4d4d; text-decoration: none; display: block; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="sidebar">
        <h3>MENU</h3>
        <p>Profil Ayarları</p>
        <a href="?cikis=1">Güvenli Çıkış</a>
    </div>
    <div class="main">
        <h1>Hoş geldin, <?= htmlspecialchars($ayarlar['kullanici']) ?></h1>
        <div class="card">
            <h3>Hesap Bilgilerini Güncelle</h3>
            <?php if($mesaj) echo "<div class='msg'>$mesaj</div>"; ?>
            <form method="POST">
                <label>Kullanıcı Adı:</label>
                <input type="text" name="yeni_user" value="<?= htmlspecialchars($ayarlar['kullanici']) ?>" required>
                
                <label>Yeni Şifre (Değişmesin istiyorsanız boş bırakın):</label>
                <input type="password" name="yeni_pass" placeholder="******">
                
                <button type="submit" name="guncelle" class="btn">GÜNCELLE</button>
            </form>
        </div>
    </div>
</body>
</html>

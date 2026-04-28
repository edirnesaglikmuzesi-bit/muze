<?php
require 'config.php';

$hata = "";

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $user = $_POST['user'] ?? '';
    $pass = $_POST['pass'] ?? '';

    if ($user === $ayarlar['kullanici'] && password_verify($pass, $ayarlar['sifre'])) {
        $_SESSION['giris_yapildi'] = true;
        header("Location: panel.php");
        exit;
    } else {
        $hata = "Kullanıcı adı veya şifre yanlış!";
    }
}
?>
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <title>Giriş Yap</title>
    <style>
        body { background: #121212; color: white; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .box { background: #1e1e1e; padding: 30px; border-radius: 8px; border: 1px solid #333; width: 300px; text-align: center; }
        input { width: 100%; padding: 12px; margin: 10px 0; background: #2c2c2c; border: 1px solid #444; color: white; border-radius: 4px; box-sizing: border-box; }
        button { width: 100%; padding: 12px; background: #d4af37; border: none; color: #121212; font-weight: bold; cursor: pointer; border-radius: 4px; }
        .err { color: #ff4d4d; font-size: 14px; margin-bottom: 10px; }
    </style>
</head>
<body>
    <div class="box">
        <h2>Panel Girişi</h2>
        <?php if($hata) echo "<div class='err'>$hata</div>"; ?>
        <form method="POST">
            <input type="text" name="user" placeholder="Kullanıcı Adı" required>
            <input type="password" name="pass" placeholder="Şifre" required>
            <button type="submit">GİRİŞ</button>
        </form>
    </div>
</body>
</html>

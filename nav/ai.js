/* ============================================================
   ai.js — Rehber Soru-Cevap Modülü
   Kullanıcı sorusunu JSON içeriğiyle eşleştirir, TTS ile okur
   ============================================================ */

const AIGuide = (() => {
  /* ── Bilgi bankası — anahtar kelime → cevap ─────────────── */
  const KB = [
    {
      keys: ['darüşşifa','hastane','şifahane','tedavi'],
      ans:  'Edirne Darüşşifası, 1488 yılında Sultan II. Bayezid tarafından yaptırılmış, Osmanlı tıp tarihinin en önemli eserlerinden biridir. Müzik, su sesi ve koku terapisi gibi yöntemlerle tedavi uygulanmıştır.'
    },
    {
      keys: ['müzik','makam','tedavi müzik'],
      ans:  'Bu hastanede 10 kişilik bir musiki grubu, hekimlerin önerileriyle her hastalığa özel müzik makamları çalardı. Rast makamı kalp ve beyne, Irak makamı sırt ağrısına, Dügah makamı ise ruh hastalıklarına iyi gelirdi.'
    },
    {
      keys: ['imaret','yemek','aşevi','fakir'],
      ans:  'İmarethane, günde üç öğün fakir ve yolculara ücretsiz yemek dağıtan sosyal bir yapıydı. Yahya Baba efsanesine göre birkaç avuç pirinci mucizevi şekilde binlerce insana yetirmişti.'
    },
    {
      keys: ['medrese','tıp','hekim','eğitim'],
      ans:  'Külliyenin Tıp Medresesi, Osmanlı\'nın hekimleri yetiştirdiği bir okuldur. Eğitim teorik ve pratik olarak verilir; öğrenciler medresede ders alır, Darüşşifada uygulama yapardı.'
    },
    {
      keys: ['yahya baba','balık','pilav','efsane'],
      ans:  'Aşçıbaşı Yahya Baba, yaptığı pilavla hem hastaları doyurur hem de artan pilavı Tunca Nehri\'ndeki balıklara verirdi. Padişah bunu görünce kızdı, ama balıklar dile gelip "Bizim rızkımıza mı göz diker!" dedi. Yahya Baba bu utançla secdeye kapanıp orada vefat etti.'
    },
    {
      keys: ['cami','kubbe','avlu','namaz'],
      ans:  'Sultan II. Bayezid Camii, tek kubbe mimarisiyle görkemli bir yapıdır. Şadırvanlı avlusu, mermer sütunları ve işli taç kapısıyla Osmanlı klasik döneminin simgelerinden biridir.'
    },
    {
      keys: ['konum','neredeyim','neresi','yer'],
      ans:  'Şu an Sultan II. Bayezid Külliyesi Sağlık Müzesindesiniz. Külliye 1488\'de inşa edilmiş ve günümüze en sağlam ulaşmış Osmanlı külliyelerinden biridir. Konum menüsünden harita görünümüne geçebilirsiniz.'
    },
    {
      keys: ['bayezid','sultan','padişah','tarih'],
      ans:  'Sultan II. Bayezid, Fatih Sultan Mehmet\'in oğlu ve 8. Osmanlı Padişahı\'dır. 1481-1512 yılları arasında hüküm sürmüştür. Bu külliye, onun adına Hayrettin Mimar tarafından Edirne\'de inşa edilmiştir.'
    },
    {
      keys: ['giriş','bilet','ziyaret','açık','saat'],
      ans:  'Müze genel olarak hafta içi ve hafta sonu ziyarete açıktır. Güncel çalışma saatleri ve bilet bilgileri için müze girişindeki bilgi panosunu incelemenizi öneririm.'
    },
    {
      keys: ['su','şadırvan','kuyu','süt kuyusu'],
      ans:  'Darüşşifa avlusundaki "Süt Kuyusu"nun, yeni doğum yapan annelerin sütünü artırdığına inanılırdı. Büyük şifahanedeki şadırvandan akan su ise hastaları rahatlatmak amacıyla tasarlanmıştır.'
    },
  ];

  /* ── Fallback cevap ─────────────────────────────────────── */
  const FALLBACK = 'Bu konuda bilgim sınırlı. Külliye hakkında merak ettiklerinizi müze rehberimize veya bilgi panolarına sorabilirsiniz. 🏛️';

  /* ── State ──────────────────────────────────────────────── */
  let _open = false;

  /* ── Init ─────────────────────────────────────────────────── */
  function init() {
    // FAB butonu
    const fab = document.getElementById('ai-fab');
    if (fab) fab.addEventListener('click', togglePanel);

    // Kapat butonu
    const closeBtn = document.getElementById('ai-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closePanel);

    // Gönder butonu
    const sendBtn = document.getElementById('ai-send-btn');
    const input   = document.getElementById('ai-input');
    if (sendBtn) sendBtn.addEventListener('click', _submit);
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _submit(); }
      });
    }

    // Sürükleme tutacağı
    const handle = document.querySelector('.ai-handle');
    if (handle) handle.addEventListener('click', closePanel);

    // Hoş geldin mesajı
    _addMsg('bot', '🏛️ Merhaba! Ben dijital rehberinizim. Külliye hakkında her şeyi sorabilirsiniz. Örn: "Müzik tedavisi nasıl yapılırdı?"');
  }

  /* ── Panel aç/kapa ─────────────────────────────────────── */
  function togglePanel() {
    _open ? closePanel() : openPanel();
  }

  function openPanel() {
    _open = true;
    document.getElementById('ai-panel')?.classList.add('open');
    document.getElementById('ai-fab')?.classList.add('hidden');
    setTimeout(() => document.getElementById('ai-input')?.focus(), 300);
  }

  function closePanel() {
    _open = false;
    document.getElementById('ai-panel')?.classList.remove('open');
    const fab = document.getElementById('ai-fab');
    if (fab && Navigation.activeScreen() === 'screen-tour') {
      fab.classList.remove('hidden');
    }
  }

  /* ── Soru gönder ────────────────────────────────────────── */
  function _submit() {
    const input = document.getElementById('ai-input');
    const q = (input?.value || '').trim();
    if (!q) return;

    _addMsg('user', q);
    input.value = '';

    // Kısa gecikme ile "düşünüyor" efekti
    const typingId = _addMsg('bot typing', '...');
    setTimeout(() => {
      _removeMsg(typingId);
      const ans = _answer(q);
      _addMsg('bot', ans);
      AudioController.speak(ans);
    }, 600 + Math.random() * 400);
  }

  /* ── Cevap üret ─────────────────────────────────────────── */
  function _answer(q) {
    const low = q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Mevcut tur adımını da bağlam olarak kullan
    let contextBonus = '';
    if (typeof TourManager !== 'undefined') {
      const step = TourManager.currentData();
      if (step) contextBonus = (step.t + ' ' + step.s + ' ' + step.m).toLowerCase();
    }

    const haystack = low + ' ' + contextBonus;

    // En iyi eşleşmeyi bul (en çok anahtar kelime sayısı)
    let best = null, bestScore = 0;
    for (const entry of KB) {
      const score = entry.keys.filter(k => haystack.includes(k)).length;
      if (score > bestScore) { bestScore = score; best = entry; }
    }

    return bestScore > 0 ? best.ans : FALLBACK;
  }

  /* ── Mesaj DOM işlemleri ─────────────────────────────────── */
  let _msgIdCounter = 0;

  function _addMsg(role, text) {
    const container = document.getElementById('ai-messages');
    if (!container) return null;

    const id  = 'aimsg-' + (++_msgIdCounter);
    const div = document.createElement('div');
    div.id        = id;
    div.className = 'ai-msg ' + role;
    div.textContent = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return id;
  }

  function _removeMsg(id) {
    if (!id) return;
    document.getElementById(id)?.remove();
  }

  return { init, openPanel, closePanel, togglePanel };
})();

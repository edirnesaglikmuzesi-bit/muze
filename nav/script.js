/* ────────────────────────────────────────
   FIREBASE INIT
──────────────────────────────────────── */
(function(){
  const cfg={apiKey:"AIzaSyDXbfeuczA_aOJcB7YegqrGK29yaWHD-PM",authDomain:"edirnesaglikmuze.firebaseapp.com",projectId:"edirnesaglikmuze",storageBucket:"edirnesaglikmuze.firebasestorage.app",messagingSenderId:"707402210781",appId:"1:707402210781:web:fb65c71ca2557575e4aa34"};
  try{if(typeof firebase!=='undefined'){if(!firebase.apps.length){firebase.initializeApp(cfg);}window.db=firebase.firestore();}}catch(e){console.warn('Firebase:',e);window.db=null;}
})();
/* ────────────────────────────────────────
   CONSTANTS
──────────────────────────────────────── */
const TOTAL_STOPS=11;
let STOP_NAMES=['Müze Girişi','Darüşşifa 1. Avlu','Darüşşifa 2. Avlu','Şifahane','Medrese','Büyük Avlu','İmarethane','Cami Avlusu','Cami İçi','Gönül Köprüsü Davet','Gönül Köprüsü'];

/* Her durak için FAB'da gösterilecek kısa bilgi */
const FAB_STOP_HINTS=[
  '🏛️ Büyük külliye fotoğrafını inceleyin, Darüşşifa sizi bekliyor.',
  '⚖️ Sol taraftaki Süt Kuyusu\'na ve bahçedeki şiir tabelasına dikkat!',
  '🚪 Kapının üzerindeki kitabeyi okuyun, nefes alın ve içeri girin.',
  '🎵 Şadırvanın sesini dinleyin — bu ses 500 yıllık şifa ritmidir.',
  '📚 Evliya Çelebi 1652\'de bu medreseyi gezdi. Dershaneyi kaçırmayın!',
  '🌳 Su terazisini ve asırlık çınarları görün, İmaret sizi bekliyor.',
  '🍲 Yahya Baba\'nın türbesini ziyaret etmeyi unutmayın.',
  '⛲ Şadırvanın başında durun, sütunların arasından geçin.',
  '🌌 Başınızı kaldırın ve 31 metrelik kubbeyi seyredin!',
  '✍️ Gönül Köprüsü\'nde duygularınızı bırakın.',
  '🪨 Bir taş da siz koyun — köprüde yeriniz hazır!'
];

const LANG_AUDIO_FOLDERS = {
  tr:'assets/audio/tr',
  en:'assets/audio/en',
  de:'assets/audio/de',
  fr:'assets/audio/fr',
  it:'assets/audio/it',
  es:'assets/audio/es',
  ru:'assets/audio/ru',
  ar:'assets/audio/ar',
  bg:'assets/audio/bg',
  el:'assets/audio/gr',
  zh:'assets/audio/cn',
  fa:'assets/audio/fa',
  ro:'assets/audio/ro',
  ja:'assets/audio/ja'
};
function getAudioFile(n, lang) {
  const folder = LANG_AUDIO_FOLDERS[lang] || LANG_AUDIO_FOLDERS.tr;
  return `${folder}/${n + 1}.mp3`;
}

/* ────────────────────────────────────────
   STATE
──────────────────────────────────────── */
let currentStop=0,speakerMuted=false,currentLang='tr';
let allMessages=[],archivePage=1;
const LATEST=10,PER_PAGE=10;
let fabBubbleTimer=null;

/* ────────────────────────────────────────
   SCREEN
──────────────────────────────────────── */
function showScreen(name){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('screen-'+name).classList.add('active');
  const locBtn=document.getElementById('btn-loc-fixed');
  if(locBtn)locBtn.style.display=(name==='tour')?'flex':'none';
  const fab=document.getElementById('evliya-fab-wrap');
  if(fab)fab.style.display=(name==='intro')?'none':'flex';
}

function startTour(){
  const introAudio=document.getElementById('intro-audio');
  introAudio.pause();introAudio.currentTime=0;
  showScreen('tour');
  document.getElementById('btn-loc-fixed').style.display='flex';
  document.getElementById('evliya-fab-wrap').style.display='flex';
  goStop(0);loadMessages();
  // Tracking
  TRACKING.sessionId='sess_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);
  TRACKING.startTime=Date.now();TRACKING.active=true;
  createSession();
  localStorage.removeItem('loc-perm-decided');
  setTimeout(()=>{document.getElementById('loc-permission-popup').classList.add('open');},1500);
}

/* ────────────────────────────────────────
   STOP NAVIGATION
──────────────────────────────────────── */
function goStop(n){
  if(n<0||n>=TOTAL_STOPS)return;
  document.querySelectorAll('.stop-page').forEach(p=>p.classList.remove('active'));
  document.getElementById('stop-'+n).classList.add('active');
  const tc=document.getElementById('tour-content');
  if(tc)tc.scrollTop=0;
  currentStop=n;
  updateProgressBar();
  applyTranslations();
  playStopAudio(n);
  showFabHint(n);
  // Tracking: durak ve currentPage bilgisini güncelle
  if(TRACKING.active&&n>TRACKING.lastStop){
    TRACKING.lastStop=n;
    updateSessionField({maxStop:n,lang:currentLang||'tr'});
  }
  // Anlık konum güncellemesi için currentPage'i visitor_locations'a yaz
  if(TRACKING.active&&TRACKING.currentZone){
    refreshVisitorLocation(TRACKING.currentZone);
     if(n > 0) history.pushState({stop: n}, '', window.location.href);
  }
}

function menuGoStop(n){closeMenu();showScreen('tour');goStop(n);}

/* ────────────────────────────────────────
   FAB HINT BUBBLE (her durakta)
──────────────────────────────────────── */
function showFabHint(n){
  clearTimeout(fabBubbleTimer);
  const bubble=document.getElementById('fab-info-bubble');
  if(!bubble)return;
  bubble.classList.remove('show');
  const hint=FAB_STOP_HINTS[n];
  if(!hint)return;
  bubble.textContent=hint;
  // Kısa gecikmeyle göster (sayfa geçiş animasyonu bitmesini bekle)
  fabBubbleTimer=setTimeout(()=>{
    bubble.classList.add('show');
    fabBubbleTimer=setTimeout(()=>bubble.classList.remove('show'),5000);
  },600);
}

/* ────────────────────────────────────────
   PROGRESS BAR
──────────────────────────────────────── */
function updateProgressBar(){
  const pct=(currentStop/(TOTAL_STOPS-1))*100;
  document.getElementById('pb-fill').style.width=pct+'%';
  document.getElementById('pb-cur').textContent=STOP_NAMES[currentStop]||'';
  document.getElementById('pb-prev').textContent=currentStop>0?(STOP_NAMES[currentStop-1]||''):'';
  document.getElementById('pb-next').textContent=currentStop<TOTAL_STOPS-1?(STOP_NAMES[currentStop+1]||''):'';
}

/* ────────────────────────────────────────
   AUDIO
──────────────────────────────────────── */
function playStopAudio(n){
  if(speakerMuted)return;
  const audio=document.getElementById('stop-audio');
  audio.src=getAudioFile(n,currentLang);
  audio.play().catch(()=>{});
}
function toggleSpeaker(){
  speakerMuted=!speakerMuted;
  document.getElementById('btn-speaker').textContent=speakerMuted?'🔇':'🔊';
  const audio=document.getElementById('stop-audio');
  if(speakerMuted)audio.pause();else playStopAudio(currentStop);
  localStorage.setItem('rehber-speaker-muted',speakerMuted?'1':'0');
}

/* ────────────────────────────────────────
   MENU
──────────────────────────────────────── */
function openMenu() {
    document.getElementById('menu-modal').classList.add('open');
}

function closeMenu() {
    document.getElementById('menu-modal').classList.remove('open');
}

function openLang() {
    const onIntro = document.getElementById('screen-intro').classList.contains('active');
    const introAudio = document.getElementById('intro-audio');
    const stopAudio = document.getElementById('stop-audio');

    // Ses durdurma mantığı: Hangi ekranda olursak olalım çalan sesi işaretle ve durdur
    [introAudio, stopAudio].forEach(audio => {
        if (audio && !audio.paused) {
            audio._langWasPlaying = true;
            audio.pause();
        }
    });

    document.getElementById('lang-modal').classList.add('open');
}

function closeLang() {
    document.getElementById('lang-modal').classList.remove('open');

    const onIntro = document.getElementById('screen-intro').classList.contains('active');
    const introAudio = document.getElementById('intro-audio');
    const stopAudio = document.getElementById('stop-audio');

    if (onIntro) {
        // Intro ekranındaysak sadece intro sesini geri başlat
        if (introAudio && introAudio._langWasPlaying) {
            introAudio.play().catch(() => {});
            introAudio._langWasPlaying = false;
        }
    } else {
        // Durak ekranlarındaysak durak sesini geri başlat (mute değilse)
        if (stopAudio && stopAudio._langWasPlaying && !window.speakerMuted) {
            stopAudio.play().catch(() => {});
            stopAudio._langWasPlaying = false;
        }
        // Intro sesi flag'ini temizle (başka ekranda intro çalmasın)
        if (introAudio) introAudio._langWasPlaying = false;
    }
}
const LANG_NAMES = {
  tr:'Türkçe 🇹🇷',
  en:'English 🇬🇧',
  de:'Deutsch 🇩🇪',
  fr:'Français 🇫🇷',
  it:'Italiano 🇮🇹',
  ru:'Русский 🇷🇺',
  es:'Español 🇪🇸',
  ar:'العربية 🇸🇦',
  bg:'Български 🇧🇬',
  el:'Ελληνικά 🇬🇷',
  zh:'中文 🇨🇳',
  fa:'فارسی 🇮🇷',
  ro:'Română 🇷🇴',
  ja:'日本語 🇯🇵'
};

function setLang(code){
  if(!TRANSLATIONS[code]) code = 'tr';
  currentLang = code;
  document.documentElement.lang = code;

  const isRTL = code==='ar'||code==='fa';
  document.documentElement.dir = isRTL ? 'rtl' : 'ltr';

  document.querySelectorAll('.lang-btn').forEach(b=>{
    b.classList.toggle('active', b.getAttribute('onclick').includes("'"+code+"'"));
  });

  localStorage.setItem('rehber-lang', code);

  // Modalları hemen kapat
  closeLang();
  closeMenu();
  playStopAudio(currentStop);
  // DOM'u senkron olarak güncelle — anında dil değişimi
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const key = el.getAttribute('data-i18n');
    let val;
    if(currentLang === 'tr'){
      val = el.getAttribute('data-tr');
    } else {
      const lang = TRANSLATIONS[currentLang] || TRANSLATIONS['tr'];
      val = lang[key] || TRANSLATIONS['tr'][key];
    }
    if(!val) return;
    if(el.classList.contains('stop-callout') || el.classList.contains('stop-slogan')){
      el.innerHTML = val;
    } else {
      el.textContent = val;
    }
  });

  const introTitle = document.querySelector('.intro-title');
  const introSub   = document.querySelector('.intro-sub');
  const btnStart   = document.querySelector('.btn-start');
  if(introTitle) introTitle.textContent = t('intro_title');
  if(introSub)   introSub.textContent   = t('intro_sub');
  if(btnStart)   btnStart.textContent   = t('start');

  const ml = document.getElementById('menu-lang-label');
  if(ml) ml.textContent = t('menu_lang');

  const gbName = document.getElementById('gb-name');
  const gbCity = document.getElementById('gb-city');
  const gbText = document.getElementById('gb-text');
  const gbBtn  = document.getElementById('btn-submit');
  if(gbName) gbName.placeholder = t('gb_name');
  if(gbCity) gbCity.placeholder = t('gb_city');
  if(gbText) gbText.placeholder = t('gb_msg');
  if(gbBtn && !gbBtn.disabled) gbBtn.textContent = t('gb_submit');

  const confirmText  = document.querySelector('.confirm-text');
  const confirmClose = document.querySelector('.confirm-close');
  if(confirmText)  confirmText.innerHTML = '<strong>'+t('confirm_text')+'</strong>';
  if(confirmClose) confirmClose.textContent = t('confirm_close');

  updateMenuStopNames();
  updateProgressBar();

  document.querySelectorAll('.stop-page').forEach(p=>p.classList.remove('active'));
  const activeStop = document.getElementById('stop-'+currentStop);
  if(activeStop) activeStop.classList.add('active');
}

function openLangFromMenu(){
  closeMenu();
  openLang();
}

/* ══════════════════════════════════════════
   ÇEVİRİ SİSTEMİ
══════════════════════════════════════════ */
const TRANSLATIONS = {
  tr:{
    start:'YOLCULUĞA BAŞLA',intro_title:'Eşiğe Davet',intro_sub:'Zamanın ötesine, şifanın merkezine bir yolculuk…',
    back:'← GERİ',menu_stops:'TUR DURAKLARI',menu_pages:'SAYFALAR',menu_settings:'AYARLAR',
    menu_lang:'Dil: Türkçe 🇹🇷',menu_map:'Harita & Konum',menu_defter:'Gönül Köprüsü',
    loc_searching:'📍 Konum alınıyor…',loc_outside:'📍 Külliye alanı dışındasınız.',
    loc_error:'📍 Konum alınamadı. Lütfen konum iznini etkinleştirin.',
    gb_name:'Adınız Soyadınız',gb_city:'Geldiğiniz Şehir',gb_msg:'Duygularınızı buraya bırakın…',
    gb_submit:'KÖPRÜYE BİR TAŞ DA BEN KOYUYORUM 🪨',gb_submitting:'Mühürleniyor…',
    gb_conn_err:'Bağlantı hatası. Tekrar deneyin.',gb_no_msg:'Lütfen bir not bırakın…',
    confirm_text:"Duygularınız Gönül Köprüsü'ne mühürlendi. Bıraktığınız bu anlamlı iz, külliyemizin manevi mirasını zenginleştirdi…",
    confirm_close:'ŞİFANIZ BOL OLSUN 🌿',latest_title:'📜 Son Mesajlar',archive_title:'🗂️ Arşiv',
    no_msg:'Henüz mesaj yok. İlk taşı siz koyun! ✨',
    s0_main:'🏛️ SULTAN II. BAYEZİD KÜLLİYESİ',s0_sub:'SAĞLIK MÜZESİ',s0_slogan:'✨ ŞİFA YOLCULUĞU — MÜZE GİRİŞİ',
    s1_main:'Darüşşifa Girişi',s1_sub:'🏛️ ADALET VE ŞİFA KAPISI',s1_slogan:'⚖️ ŞİFANIN İLK DURAĞI',
    s2_main:'Sunum Odasından Çıkış',s2_sub:'🏛️ BİLGİDEN DENEYİME',s2_slogan:'🏛️ İDARE VE NİZAM',
    s3_main:'Büyük Şifahane (SEKİZGEN BÖLÜM)',s3_sub:'🏛️ DARÜŞŞİFA EŞİĞİ',s3_slogan:'🌊 RUHUN ŞİFAYA KAVUŞTUĞU ZİRVE',
    s4_main:'Tıp Medresesi',s4_sub:'🎓 İLMİN BEŞİĞİ',s4_slogan:'📚 BİLGİNİN IŞIĞI',
    s5_main:'Büyük Avlu',s5_sub:'🌿 ASIRLIK ÇINARLAR',s5_slogan:'🌳 ZAMAN VE HUZUR',
    s6_main:'İmarethane',s6_sub:'🍲 ŞEFKAT VE BEREKET',s6_slogan:'🍲 YAHYA BABA\'NIN MUTFAĞI',
    s7_main:'Ruhanî Atmosfere Hazırlık',s7_sub:'🕌 CAMİYE GİRİŞ',s7_slogan:'✨ TEK KUBBE, SONSUZ HUZUR',
    s8_main:'Cami İçinde Manevî Yolculuk',s8_sub:'🕌 CAMİ AVLUSU',s8_slogan:'🌌 KUBBE ALTINDA FİNAL',
    s9_main:'Veda Vakti',s9_sub:'🌊 GÖNÜL KÖPRÜSÜNE DAVET',s9_slogan:'✨ BU HİKÂYEDE SİZİN DE İZİNİZ OLSUN',
    s10_main:'🖋️ Gönül Köprüsü',s10_slogan:'"Geçmişin şifası, bugünün kelimeleriyle buluşuyor."'
  },
  en:{
    start:'BEGIN THE JOURNEY',intro_title:'Invitation to the Threshold',intro_sub:'A journey beyond time, to the center of healing…',
    back:'← BACK',menu_lang:'Language: English 🇬🇧',menu_map:'Map & Location',menu_defter:'Heart Bridge',
    loc_searching:'📍 Getting location…',loc_outside:'📍 You are outside the Külliye area.',
    loc_error:'📍 Could not get location. Please enable location permission.',
    gb_name:'Your Name',gb_city:'Your City',gb_msg:'Leave your feelings here…',
    gb_submit:'I ADD MY STONE TO THE BRIDGE 🪨',gb_submitting:'Sealing…',
    gb_conn_err:'Connection error. Please try again.',gb_no_msg:'Please leave a note…',
    confirm_text:'Your feelings have been sealed on the Heart Bridge. The meaningful trace you left enriches the spiritual heritage of our Külliye…',
    confirm_close:'MAY YOU BE HEALED 🌿',latest_title:'📜 Recent Messages',archive_title:'🗂️ Archive',
    no_msg:'No messages yet. Be the first to add a stone! ✨',
    s0_main:'🏛️ SULTAN BAYEZID II KÜLLIYE',s0_sub:'HEALTH MUSEUM',s0_slogan:'✨ HEALING JOURNEY — MUSEUM ENTRANCE',
    s1_main:'Darüşşifa Entrance',s1_sub:'🏛️ GATEWAY OF JUSTICE AND HEALING',s1_slogan:'⚖️ FIRST STOP OF HEALING',
    s2_main:'Exiting the Presentation Room',s2_sub:'🏛️ FROM KNOWLEDGE TO EXPERIENCE',s2_slogan:'🏛️ ADMINISTRATION AND ORDER',
    s3_main:'The Great Infirmary (OCTAGONAL HALL)',s3_sub:'🏛️ THRESHOLD OF THE DARÜŞŞIFA',s3_slogan:'🌊 THE PINNACLE OF HEALING',
    s4_main:'Medical School (Madrasa)',s4_sub:'🎓 CRADLE OF KNOWLEDGE',s4_slogan:'📚 THE LIGHT OF LEARNING',
    s5_main:'Great Courtyard',s5_sub:'🌿 CENTURIES-OLD PLANE TREES',s5_slogan:'🌳 TIME AND TRANQUILITY',
    s6_main:'Imaret (Soup Kitchen)',s6_sub:'🍲 COMPASSION AND ABUNDANCE',s6_slogan:'🍲 YAHYA BABA\'S KITCHEN',
    s7_main:'Preparing for a Spiritual Atmosphere',s7_sub:'🕌 ENTRANCE TO THE MOSQUE',s7_slogan:'✨ ONE DOME, ENDLESS PEACE',
    s8_main:'Spiritual Journey Inside the Mosque',s8_sub:'🕌 MOSQUE COURTYARD',s8_slogan:'🌌 FINALE UNDER THE DOME',
    s9_main:'Time to Bid Farewell',s9_sub:'🌊 INVITATION TO THE HEART BRIDGE',s9_slogan:'✨ LEAVE YOUR MARK IN THIS STORY',
    s10_main:'🖋️ Heart Bridge',s10_slogan:'"The healing of the past meets the words of today."',
    nav_back:'← BACK',
    s0_ct1:'👑 HISTORY',s0_ct2:'🏗️ STRUCTURE',s0_ct3:'🎧 YOUR GUIDE',s0_ct4:'📵 ATTENTION',s0_ct5:'📍 LOCATION',s0_ct6:'🏫 ORIENTATION',
    s0_c1:'You are now in one of the most captivating historic sites in Edirne — the Sultan Bayezid II Külliye Health Museum. Welcome to this place where history and healing meet.',
    s0_c2:'Built by Sultan Bayezid II, son of Mehmed the Conqueror and the 8th Ottoman Sultan, under chief architect Hayrettin, this complex is the best-preserved külliye among all Ottoman külliyes. At its center stands the mosque; to the right the hospital and madrasa; to the left the imaret and pantry; attached to the mosque\'s sides are guesthouses, and behind it a bridge over the Tunca River — all embodying the Ottoman social state model.',
    s0_c3:'I will guide you through the Külliye and our museum with written, audio, and visual content to enrich your visit.',
    s0_c4:'Please keep your attention on your mobile phone throughout the tour.',
    s0_c5:'You have passed the ticket booth and are now in the front garden. Please stand in front of the large Külliye photograph hanging on the wall opposite you, and study the location of these structures within the city of Edirne.',
    s0_c6:'As you walk toward this point, the building on your right is the Medical Madrasa of the Külliye, and the building directly ahead is the Darüşşifa — perhaps the heart of the Külliye and the center of our museum.',
    s0_callout:'👣 <strong>After examining the large photograph, enter the Darüşşifa\'s garden through the door immediately to your left.</strong>',
    s0_fwd:'BEGIN THE JOURNEY THROUGH TIME →',
    s1_ct1:'🏥 DARÜŞŞIFA — 1ST COURTYARD',s1_ct2:'🌍 HISTORICAL SIGNIFICANCE',s1_ct3:'🛏️ SERVICE ROOMS',s1_ct4:'🩺 OUTPATIENT ROOMS',s1_ct5:'🧭 DIRECTIONS',s1_ct6:'💧 THE MILK WELL',s1_ct7:'🌿 THE TREE AND THE IVY',s1_ct8:'🎬 PRESENTATION ROOM',
    s1_c1:'You are now in the first courtyard of the Edirne Darüşşifa, one of the Ottoman Empire\'s most important healing centers. Please pause here for a moment and observe your surroundings.',
    s1_c2:'First, know this: this building is recognized as one of the earliest examples of a centrally and meticulously planned hospital in history. Western counterparts appeared only about 200 years later — here, treatment and service areas were realized with an architectural vision far ahead of its time.',
    s1_c3:'As you proceed along the path ahead, the four rooms immediately to the left of the entrance are the Darüşşifa\'s service units: a staff room, a laundry, a dietary kitchen, and a pantry for storing provisions.',
    s1_c4:'On your right, behind the columns, are six outpatient rooms where daily patient examinations, care, and emergency interventions were carried out. In the founding years, one of these rooms was reserved for eye doctors known as "kehhal."',
    s1_c5:'Leave the detailed visit of these rooms — arranged with displays and information panels — for your return, and let me guide you now toward our presentation room. It is located past the first courtyard, on the left. As you walk there, please notice the well on your left.',
    s1_c6:'This stone structure is called the "Milk Well," as it was believed that its water increased the milk supply of new mothers. About 20 meters further, among the grass, you will see a tree with ivy wrapped around it.',
    s1_c7:'When you reach that spot, be sure to read the melancholic love poem written by Ahmet Kutsi Tecer about this tree, displayed on a panel in the grass. Then look at the tree and the ivy once more, with that feeling in your heart.',
    s1_c8:'Just past the poem, immediately on your left, is our presentation room. Here you can watch a video about the history and development of the Külliye and the Darüşşifa, gaining a comprehensive understanding of this place\'s significance in the history of medicine and architecture.',
    s1_callout:'🎬 <strong>Would you like to watch the presentation video?</strong> You may watch it in the presentation room or tap the button below to watch it on your phone.',
    s1_watch:'WATCH PRESENTATION ▶',s1_fwd:'TO THE PRESENTATION ROOM →',
    s2_ct1:'🚪 ENTERING THE 2ND COURTYARD',s2_ct2:'🏛️ ADMINISTRATIVE ROOMS',s2_ct3:'🔒 ADMINISTRATIVE SECTION',s2_ct4:'✨ INSCRIPTION AND ENTRY',
    s2_c1:'As soon as you exit the presentation room, pass through the grand door immediately to your left into the second courtyard, where the administrative offices are located.',
    s2_c2:'In this courtyard there are 4 rooms — two on each side. The chief physician and other doctors used these rooms; all hospital operations were planned and managed here. In the founding years, this Darüşşifa had 1 chief physician, two doctors, 2 surgeons, 2 eye doctors, and 1 pharmacist.',
    s2_c3:'This administrative section also served as a protective barrier between the daily patient flow in the first courtyard and the inpatient treatment ward you are about to enter.',
    s2_c4:'Now read the inscription written above the door, then hold your breath…',
    s2_callout:'🚶‍♂️ <strong>Step into this magical place where music and the sound of water meet healing.</strong>',
    s2_fwd:'DISCOVER THE GREAT INFIRMARY →',
    s3_ct1:'🏥 INPATIENT TREATMENT WARD',s3_ct2:'🌊 HOSPITAL STRUCTURE',s3_ct3:'🎵 MUSIC THERAPY',s3_ct4:'💧 WATER THERAPY',s3_ct5:'🌿 AROMATHERAPY',s3_ct6:'🧺 OCCUPATIONAL THERAPY',s3_ct7:'🚶 EXIT AND TOUR',
    s3_c1:'You are now in the heart of our museum and in the inpatient treatment ward of the Edirne Darüşşifa. Walk through this space with the feeling of those who found healing here 500 years ago.',
    s3_c2:'Imagine a hospital where you are greeted by a fountain flowing in a rhythmic pattern in the center, and a music stage directly across from it. This centrally planned hospital, covered by a wide dome, consists of 6 winter patient rooms, 4 summer patient rooms, and a music stage. The lantern in the dome also ventilates bad air out. The sloped flooring and the channels beneath facilitate easy washing and cleaning.',
    s3_c3:'What distinguished this hospital from others was the use of musical modes in treatment alongside contemporary medical knowledge. A musical ensemble of 10 performers played and sang different modes for different illnesses, as recommended by physicians — believed to benefit various conditions.',
    s3_c4:'The sound of water flowing from the fountain at the center of the building was an important part of treatment, aimed at calming and soothing patients.',
    s3_c5:'In addition to music and water sounds, aromatherapy was also practiced in the Darüşşifa. The scents of various plants grown in the courtyard and surroundings were an integral part of the healing process.',
    s3_c6:'Occupational therapy was also used as a treatment method here. Patients were engaged in basket-weaving, knitting, and various crafts to distract them from their worries and thoughts.',
    s3_c7:'After touring the rooms showcasing different aspects of Ottoman medicine, you may exit the inpatient ward. As you leave this healing place — which served continuously for 400 years — you may also visit the other rooms in the second and first courtyards to learn more about the Darüşşifa and Ottoman medicine.',
    s3_callout:'🏫 <strong>TOWARD THE MEDICAL MADRASA:</strong> Exit the Darüşşifa and walk toward the Medical Madrasa, located to the left of the entrance garden with the large photograph.',
    s3_fwd:'ONWARD TO THE MADRASA →',
    s4_ct1:'🏫 THE MEDICAL MADRASA',s4_ct2:'🌍 HISTORICAL SIGNIFICANCE',s4_ct3:'📚 EDUCATION SYSTEM',s4_ct4:'🏛️ ARCHITECTURAL STRUCTURE',s4_ct5:'📜 EVLIYA ÇELEBİ',s4_ct6:'👨‍🏫 TEACHING STAFF',s4_ct7:'📖 MANUSCRIPTS',s4_ct8:'🏥 HEALTH MUSEUM',
    s4_c1:'You have toured the Darüşşifa and now entered another crucial section of the Külliye — the Sultan Bayezid II Medical Madrasa. Before entering the museum rooms on the right and opposite sides, stop and study this unique space.',
    s4_c2:'What you see now as a building arranged around a square courtyard was one of the most prestigious educational institutions training physicians in the Ottoman Empire — an important center of learning that produced many prominent doctors over the centuries.',
    s4_c3:'Ranked among the highest-level "60-rated and above" madrasas in the Ottoman education system, students here could apply their theoretical training in the adjacent Darüşşifa, reinforcing their knowledge with practice.',
    s4_c4:'The madrasa — with a fountain (no longer standing) at its center and a well in the corner for water supply — consists of 18 student rooms arranged on three sides and a lecture hall directly opposite.',
    s4_c5:'Evliya Çelebi, who visited the Külliye in 1652, wrote about this madrasa: "In the Medical Madrasa and its rooms are students who constantly speak of scholars like Plato, Socrates, Aristotle, Galen and Pythagoras — mature physicians each. Each devoted to a branch of knowledge, relying on valuable books in the art of medicine, striving to find remedies for the ailments of humankind."',
    s4_c6:'The teaching staff included a professor earning 60 akçe per day teaching 18 students, an assistant professor, a librarian, and two servants. All student needs were provided, and they also received a daily scholarship of two akçe.',
    s4_c7:'38 handwritten medical manuscripts studied here — many bearing the seals of Ottoman sultans — have survived to this day. These precious works are now preserved at the Selimiye Manuscript Library.',
    s4_c8:'The madrasa was opened by Trakya University in 2007 as the second section of the Health Museum. Its rooms narrate medical education of the era. The most important section is the lecture hall, directly opposite the entrance.',
    s4_callout:'🚶 <strong>After touring the student rooms, applied training rooms, professor\'s room, lecture hall, and library — arranged to reflect 15th-century atmosphere with mannequins — exit the madrasa and proceed through the turnstile near the Darüşşifa exit to the mosque courtyard to continue toward the Imaret.</strong>',
    s4_fwd:'TOWARD THE MOSQUE GRANDEUR →',
    s5_ct1:'🌳 INTO THE GARDEN',s5_ct2:'💧 WATER SCALE',s5_ct3:'🕌 MOSQUE MAIN GATE',s5_ct4:'🏛️ PANTRY AND IMARET',
    s5_c1:'After touring the Darüşşifa and Madrasa, you have entered the mosque garden. Walk slowly through this beautiful garden of centuries-old plane trees, heading toward the Imaret section of the museum directly ahead.',
    s5_c2:'As you enter the garden from the Darüşşifa, the first thing to notice on your right — at the corner of the mosque — is a rectangular stone structure about 4 meters high. This is the Külliye\'s water scale. Water brought by pipes from high hills first had its pressure balanced within this structure before being distributed to the other units of the Külliye.',
    s5_c3:'After passing the water scale, you will be greeted by the mosque\'s magnificent main entrance portal on your right. Let us leave exploring the mosque courtyard through this portal for the very end of our tour, and continue our walk toward the Imaret.',
    s5_c4:'Ahead, two large buildings of similar architecture stand side by side. The one on the left contains the pantry and the bakery section, now used for the museum\'s scientific and cultural events. The one on the right is the Imaret I am now directing you toward.',
    s5_callout:'🍲 <strong>Are you ready to see Ottoman imaret culture and hear the legend of Cook Yahya Baba? Then show your ticket at the turnstile and enter this section, then tap the next stop to continue.</strong>',
    s5_fwd:'TO THE HEART OF ABUNDANCE →',
    s6_ct1:'🏛️ THE IMARETS',s6_ct2:'🍲 THE SULTAN BAYEZID II IMARET',s6_ct3:'🔥 KITCHEN AND DINING HALL',s6_ct4:'🎭 THIS MUSEUM SECTION',s6_ct5:'🌿 YAHYA BABA\'S TOMB',s6_ct6:'📖 THE LEGEND OF YAHYA BABA',s6_ct7:'⚖️ THE PANTRY KEEPER\'S TEST',s6_ct8:'👑 THE SULTAN\'S WITNESS',s6_ct9:'🐟 THE MIRACLE OF THE FISH',s6_ct10:'🤲 THE PASSING OF YAHYA BABA',s6_ct11:'🪦 VISITING THE TOMB',
    s6_c1:'In the Ottoman Empire, imarets were among the most important institutions embodying the spirit of social solidarity and charity. Serving as soup kitchens that distributed free food to the poor, travelers, students, and the destitute, these structures were not merely kitchens — they were vital centers that protected the needy members of society and maintained social balance.',
    s6_c2:'And you are now inside just such a place. The Sultan Bayezid II Külliye imaret, established as the third section of the Health Museum, was an important charitable institution where — according to its deed — three meals a day were cooked and distributed to the poor.',
    s6_c3:'The wide space you encounter upon entering is the kitchen where food was cooked in large cauldrons. The large hall you see through the door immediately to your right is where meals were eaten at stone floor tables.',
    s6_c4:'Like the other sections of the Health Museum, this section is animated with mannequins suited to the spirit of the place, narrating Ottoman imaret culture and taking visitors on a journey through time. Original copper vessels, mortars, and storage jars of the era are also exhibited here.',
    s6_c5:'Immediately behind the imaret is the Tomb of Cook Yahya Baba, a figure of legend. As you explore this interesting and spacious building, let me tell you the legend of Cook Yahya Baba that has survived to this day.',
    s6_c6:'According to the story, Yahya Baba, the head cook during the reign of the Külliye\'s founder Sultan Bayezid II, made exceptionally delicious rice pilaf. While stirring the pilaf he would constantly pray, and when closing the lid would say "Grant abundance, O Lord." The pilaf would be so plentiful it would feed all the patients and even have leftovers. Yahya Baba never discarded the extra pilaf — he would take it to feed the fish in the Tunca River.',
    s6_c7:'When the pantry keeper noticed Yahya Baba was feeding the excess pilaf to the river, he began reducing the amount of rice given to him day by day. Yet even with less rice, Yahya Baba would cook the pilaf with prayer, feeding both patients and fish. Eventually the allotted rice was reduced to a single handful. Still Yahya Baba\'s pilaf fed all the patients, and he still managed to set aside a portion for the fish.',
    s6_c8:'Word of this eventually reached the Sultan. Deciding to witness the matter firsthand, the Sultan arrived at the Tunca River bank before Yahya Baba and hid. As Yahya Baba was about to return after feeding the fish, the Sultan stepped out from hiding and roared: "You there — are you pouring the patients\' provisions into the river?"',
    s6_c9:'Yahya Baba was frozen. He could say nothing. He was so overwhelmed with shame that he prostrated himself and sought refuge in God. But the fish, raising their heads from the water, spoke out: "Does the great Sultan begrudge the fish their sustenance?"',
    s6_c10:'The Sultan, realizing his error in astonishment and grief, waited for Yahya Baba to raise his head from prostration — but in vain. This benevolent man had already surrendered his soul…',
    s6_c11:'The tomb of Yahya Baba, located just behind the imaret, is visited like a saint\'s shrine by passersby who come to pray. Especially on Fridays, this tomb is filled with visitors.',
    s6_callout:'🪦 <strong>GUESTHOUSES:</strong> After hearing this legend, it is time to exit the imaret and rest at the museum café on the left. In the museum café within the Külliye guesthouse, you can enjoy tea and especially an Ottoman sherbet, purchase gifts and books, tour the museum library, and then proceed to the final stop — the Mosque courtyard. Shall we take a short break at the Külliye Guesthouse?',
    s6_fwd:'TOWARD THE MUSEUM CAFÉ →',
    s7_ct1:'🏛️ COURTYARD AND ENTERING THE MOSQUE',s7_ct2:'🚪 ENTRANCE AND ATMOSPHERE',s7_ct3:'⛲ THE FOUNTAIN AND SERENITY',s7_ct4:'🏛️ MARBLE COLUMNS AND ARCHITECTURAL HARMONY',s7_ct5:'✨ INNER PEACE AND TRANQUILITY',s7_ct6:'👁️ MOMENTS OF OBSERVATION',s7_ct7:'🚪 ENTERING THE MOSQUE',s7_ct8:'🪵 KÜNDEKÂRI CRAFTSMANSHIP',
    s7_c1:'You have toured the sections of our Health Museum and tasted the refreshing Ottoman sherbet at the café. Now it is time to meet one of the most magnificent structures of the Külliye — the mosque.',
    s7_c2:'As you step in through the elegant side door opening to the courtyard, or through the grand main portal, you are greeted by the fine craftsmanship of marble. In an instant, you leave behind the bustle of the outer world and glide into a completely different atmosphere.',
    s7_c3:'The fountain at the very center of the courtyard fills the space with peace through the calm sound of water. This sound, combined with the silence of stone, slows you down and makes you aware of the present moment.',
    s7_c4:'The marble columns surrounding you rise like a protective ring. Chosen in different colors, they embody the elegance and harmonious richness of Ottoman aesthetics.',
    s7_c5:'What you feel here is not merely architectural beauty — it is a tranquility, an inner peace that has remained unchanged for centuries.',
    s7_c6:'Pause briefly at the fountain and observe this simple yet striking courtyard arrangement. Feel the harmony the columns, arches, and fine ornaments create with one another.',
    s7_c7:'Then turn toward the magnificent portal rising directly before you. Gently part the leather curtain covering the door and step inside. You will immediately sense that you have entered one of the most elegant mosques in our country.',
    s7_c8:'As you enter, do not forget to pay attention to the original kündekâri woodwork above the door — and if possible, feel the texture of this exquisite craftsmanship.',
    s7_callout:'🕌 <strong>Shall we enter the great expanse and tranquility within the sanctuary?</strong>',
    s7_fwd:'PROCEED INSIDE →',
    s8_ct1:'🕌 INSIDE THE MOSQUE — THE FINALE',s8_ct2:'🚤 HISTORIC TRANSPORT AND ROYAL TRADITION',s8_ct3:'👑 IMAGINING THE ROYAL GALLERY',s8_ct4:'🏛️ THE ROYAL GALLERY AND ITS FIRSTS',s8_ct5:'⚙️ THE MIHRAB AND BALANCE STONES',s8_ct6:'🪵 THE MINBAR AND FINE CRAFTSMANSHIP',s8_ct7:'📐 SYMBOLS AND MEANINGS',s8_ct8:'💡 LIGHT AND ACOUSTIC ORDER',s8_ct9:'🌌 SPLENDOR UNDER THE DOME',s8_ct10:'🏗️ AN ARCHITECTURAL TURNING POINT',s8_ct11:'✨ FINALE AND FAREWELL',
    s8_c1:'You are now inside the mosque at the center of the Külliye, and we are completing the finale of our tour beneath this magnificent dome.',
    s8_c2:'Sultan Bayezid II, the founder of the Külliye, and the sultans who followed him used to arrive at this mosque by traveling along the river in ornate imperial boats. They would enter through the riverside door and perform their prayers in the royal gallery — the hünkâr mahfili — which rises on columns in the left corner of the mosque.',
    s8_c3:'Close your eyes for a moment… Imagine the Sultan, at that height, worshipping in the same peace alongside the congregation.',
    s8_c4:'Remembering that the first royal gallery ever built in Turkish-Islamic architecture is located here, let us now walk toward the mihrab.',
    s8_c5:'When you touch and gently turn the cylindrical balance stones on either side of the mihrab, you will be amazed to find that the ground of this great structure shows not the slightest shift.',
    s8_c6:'As you approach the minbar on the right, you will marvel at the delicacy and elegance of the marble craftsmanship.',
    s8_c7:'Now I suggest you turn your back to the mihrab and look above the entrance door. The tray motif with a watermelon at its center, positioned directly above the door, symbolizes that there is an imaret in this Külliye and that those who come here are invited to a meal.',
    s8_c8:'The windows around the dome and in the lower rows ensure that light is distributed evenly throughout the space. This lighting arrangement, combined with the mosque\'s powerful acoustics, lends the space both visual and auditory depth.',
    s8_c9:'And now lift your gaze upward… Look carefully at this magnificent dome adorned with baroque decorations. Approximately 31 meters high and 22 meters in diameter, this dome — resting on four walls without any intermediate columns — is an architecturally remarkable example.',
    s8_c10:'It is also considered an important precursor to the transition toward single-domed structures.',
    s8_c11:'Beneath the grace and splendor of this unparalleled dome, we conclude this journey where you have connected the traces of the past with today\'s silence — do not forget to carry with you the peace and wonder this place has left in your heart.',
    s8_callout:'🙏 <strong>Shall we place a quiet farewell on this spiritual journey?</strong>',
    s8_fwd:'TOWARD FAREWELL →',
    s9_c1:'🏛️ We traced the footprints of the past step by step, breathing in this magnificent architecture together. Now it is time to add your own breath to this historic place.',
    s9_c2:'💭 What resonates within you… A moment of peace, a deep admiration, or that quiet note lingering in your heart…',
    s9_c3:'📖 The Visitor\'s Book we have prepared for you is a spiritual archive of this experience. Every sentence you leave here will be: an invaluable memory for us, and a light that gives meaning to this journey for our other guests.',
    s9_c4:'✨ Share what flows from your heart with us — and let your mark remain forever on the Heart Bridge…',
    s9_callout:'✍️ <strong>We invite you to share your feelings on our Heart Bridge page.</strong>',
    s9_fwd:'WRITE TO THE HEART BRIDGE →',
    s10_body:'We would love to hear the impressions this 500-year journey through our Külliye has left on you. Your words will become stones of this bridge.',
    s10_restart:'🏛️ RETURN TO START'
  },
   de:{
    start:'REISE BEGINNEN',intro_title:'Einladung zur Schwelle',intro_sub:'Eine Reise jenseits der Zeit, zum Zentrum der Heilung…',
    back:'← ZURÜCK',menu_lang:'Sprache: Deutsch 🇩🇪',menu_map:'Karte & Standort',menu_defter:'Herzbrücke',
    loc_searching:'📍 Standort wird ermittelt…',loc_outside:'📍 Sie befinden sich außerhalb des Külliye-Gebiets.',
    loc_error:'📍 Standort konnte nicht ermittelt werden. Bitte aktivieren Sie die Standortberechtigung.',
    gb_name:'Ihr Name',gb_city:'Ihre Stadt',gb_msg:'Hinterlassen Sie hier Ihre Gefühle…',
    gb_submit:'ICH LEGE MEINEN STEIN AUF DIE BRÜCKE 🪨',gb_submitting:'Versiegelung…',
    gb_conn_err:'Verbindungsfehler. Bitte versuchen Sie es erneut.',gb_no_msg:'Bitte hinterlassen Sie eine Notiz…',
    confirm_text:'Ihre Gefühle wurden auf der Herzbrücke versiegelt. Die bedeutsame Spur, die Sie hinterlassen haben, bereichert das geistige Erbe unserer Külliye…',
    confirm_close:'MÖGEN SIE GEHEILT WERDEN 🌿',latest_title:'📜 Neueste Nachrichten',archive_title:'🗂️ Archiv',
    no_msg:'Noch keine Nachrichten. Legen Sie den ersten Stein! ✨',
    s0_main:'🏛️ SULTAN BAYEZID II. KÜLLIYE',s0_sub:'GESUNDHEITSMUSEUM',s0_slogan:'✨ HEILUNGSREISE — MUSEUMSEINGANG',
    s1_main:'Darüşşifa Eingang',s1_sub:'🏛️ TOR DER GERECHTIGKEIT UND HEILUNG',s1_slogan:'⚖️ ERSTER STOP DER HEILUNG',
    s2_main:'Ausgang aus dem Vortragsraum',s2_sub:'🏛️ VON WISSEN ZU ERFAHRUNG',s2_slogan:'🏛️ VERWALTUNG UND ORDNUNG',
    s3_main:'Die Große Krankenstation (ACHTECKIGER SAAL)',s3_sub:'🏛️ SCHWELLE DES DARÜŞŞIFA',s3_slogan:'🌊 DER HÖHEPUNKT DER HEILUNG',
    s4_main:'Medizinische Schule (Medrese)',s4_sub:'🎓 WIEGE DES WISSENS',s4_slogan:'📚 DAS LICHT DES LERNENS',
    s5_main:'Großer Innenhof',s5_sub:'🌿 JAHRHUNDERTEALTE PLATANEN',s5_slogan:'🌳 ZEIT UND STILLE',
    s6_main:'Imaret (Suppenküche)',s6_sub:'🍲 MITGEFÜHL UND ÜBERFLUSS',s6_slogan:'🍲 YAHYA BABAS KÜCHE',
    s7_main:'Vorbereitung auf spirituelle Atmosphäre',s7_sub:'🕌 EINGANG ZUR MOSCHEE',s7_slogan:'✨ EINE KUPPEL, UNENDLICHER FRIEDEN',
    s8_main:'Spirituelle Reise in der Moschee',s8_sub:'🕌 MOSCHEEHOF',s8_slogan:'🌌 FINALE UNTER DER KUPPEL',
    s9_main:'Zeit des Abschieds',s9_sub:'🌊 EINLADUNG ZUR HERZBRÜCKE',s9_slogan:'✨ HINTERLASSE DEINE SPUR IN DIESER GESCHICHTE',
    s10_main:'🖋️ Herzbrücke',s10_slogan:'"Die Heilung der Vergangenheit begegnet den Worten der Gegenwart."',
    nav_back:'← ZURÜCK',
    s0_ct1:'👑 GESCHICHTE',s0_ct2:'🏗️ BAUWERK',s0_ct3:'🎧 IHR REISEFÜHRER',s0_ct4:'📵 ACHTUNG',s0_ct5:'📍 STANDORT',s0_ct6:'🏫 ORIENTIERUNG',
    s0_c1:'Sie befinden sich nun an einem der faszinierendsten historischen Orte Edirnes — dem Gesundheitsmuseum der Sultan Bayezid II. Külliye. Willkommen an diesem Ort, wo Geschichte und Heilung aufeinandertreffen.',
    s0_c2:'Diese Anlage wurde von Sultan Bayezid II., Sohn von Mehmed dem Eroberer und 8. osmanischer Sultan, unter dem damaligen Chefarchitekten Hayrettin errichtet. Sie gilt als am besten erhaltene Külliye unter allen osmanischen Külliyes. Im Zentrum steht die Moschee; rechts befinden sich das Krankenhaus und die Medrese; links das Imaret und die Vorratskammer; an die Seiten der Moschee angebaut sind Gasthäuser, und dahinter führt eine Brücke über den Tunca-Fluss — all dies verkörpert das osmanische Sozialstaatsmodell.',
    s0_c3:'Ich werde Sie durch die Külliye und unser Museum mit schriftlichen, akustischen und visuellen Inhalten führen, um Ihren Besuch zu bereichern.',
    s0_c4:'Bitte behalten Sie Ihr Mobiltelefon während der gesamten Führung in der Hand.',
    s0_c5:'Sie haben die Ticketkasse passiert und befinden sich nun im Vorgarten. Stellen Sie sich bitte vor das große Külliye-Foto an der gegenüberliegenden Wand und studieren Sie die Lage dieser Bauwerke in der Stadt Edirne.',
    s0_c6:'Während Sie auf diesen Punkt zugehen, ist das Gebäude zu Ihrer Rechten die Medizinische Medrese der Külliye, und das Gebäude direkt vor Ihnen ist das Darüşşifa — vielleicht das Herz der Külliye und das Zentrum unseres Museums.',
    s0_callout:'👣 <strong>Nachdem Sie das große Foto betrachtet haben, betreten Sie den Garten des Darüşşifa durch die Tür unmittelbar zu Ihrer Linken.</strong>',
    s0_fwd:'ZEITREISE BEGINNEN →',
    s1_ct1:'🏥 DARÜŞŞIFA — 1. INNENHOF',s1_ct2:'🌍 HISTORISCHE BEDEUTUNG',s1_ct3:'🛏️ DIENSTRÄUME',s1_ct4:'🩺 AMBULANTE RÄUME',s1_ct5:'🧭 WEGWEISER',s1_ct6:'💧 DER MILCHBRUNNEN',s1_ct7:'🌿 DER BAUM UND DER EFEU',s1_ct8:'🎬 VORTRAGSRAUM',
    s1_c1:'Sie befinden sich nun im ersten Innenhof des Edirne Darüşşifa, einem der bedeutendsten Heilungszentren des Osmanischen Reiches. Halten Sie hier bitte einen Moment inne und beobachten Sie Ihre Umgebung.',
    s1_c2:'Zunächst sei Folgendes festgehalten: Dieses Gebäude gilt als eines der frühesten Beispiele eines zentral und sorgfältig geplanten Krankenhauses in der Geschichte. Westliche Gegenstücke entstanden erst rund 200 Jahre später — hier wurden Behandlungs- und Servicebereiche mit einer architektonischen Vision realisiert, die ihrer Zeit weit voraus war.',
    s1_c3:'Wenn Sie den Weg vor Ihnen entlanggehen, sind die vier Räume unmittelbar links des Eingangs die Dienstbereiche des Darüşşifa: ein Personalraum, eine Wäscherei, eine Diätküche und eine Vorratskammer.',
    s1_c4:'Auf Ihrer rechten Seite, hinter den Säulen, befinden sich sechs ambulante Räume, in denen tägliche Patientenuntersuchungen, Pflege und Notfallversorgung durchgeführt wurden. In den Gründungsjahren war einer dieser Räume Augenärzten, den sogenannten "kehhal", vorbehalten.',
    s1_c5:'Verschieben Sie den ausführlichen Besuch dieser mit Displays und Informationstafeln ausgestatteten Räume auf Ihren Rückweg und lassen Sie mich Sie nun zum Vortragsraum führen. Dieser befindet sich hinter dem ersten Innenhof, auf der linken Seite. Beachten Sie beim Gehen bitte den Brunnen zu Ihrer Linken.',
    s1_c6:'Dieses steinerne Bauwerk heißt "Milchbrunnen", da man glaubte, dass sein Wasser die Milchproduktion von stillenden Müttern steigerte. Etwa 20 Meter weiter sehen Sie im Gras einen Baum, der von Efeu umrankt wird.',
    s1_c7:'Wenn Sie diesen Punkt erreichen, lesen Sie unbedingt das melancholische Liebesgedicht, das Ahmet Kutsi Tecer über diesen Baum geschrieben hat und das auf einer Tafel im Gras zu sehen ist. Betrachten Sie dann den Baum und den Efeu noch einmal mit diesem Gefühl im Herzen.',
    s1_c8:'Kurz nach dem Gedicht, unmittelbar zu Ihrer Linken, befindet sich unser Vortragsraum. Hier können Sie ein Video über die Geschichte und Entwicklung der Külliye und des Darüşşifa sehen und ein umfassendes Verständnis für die Bedeutung dieses Ortes in der Geschichte der Medizin und Architektur gewinnen.',
    s1_callout:'🎬 <strong>Möchten Sie das Präsentationsvideo ansehen?</strong> Sie können es im Vortragsraum ansehen oder unten auf die Schaltfläche tippen, um es auf Ihrem Telefon zu sehen.',
    s1_watch:'PRÄSENTATION ANSEHEN ▶',s1_fwd:'ZUM VORTRAGSRAUM →',
    s2_ct1:'🚪 EINTRITT IN DEN 2. INNENHOF',s2_ct2:'🏛️ VERWALTUNGSRÄUME',s2_ct3:'🔒 VERWALTUNGSBEREICH',s2_ct4:'✨ INSCHRIFT UND EINGANG',
    s2_c1:'Sobald Sie den Vortragsraum verlassen, gehen Sie durch die große Tür unmittelbar zu Ihrer Linken in den zweiten Innenhof, in dem sich die Verwaltungsbüros befinden.',
    s2_c2:'In diesem Innenhof befinden sich 4 Räume — je zwei auf jeder Seite. Der Chefphysiker und andere Ärzte nutzten diese Räume; alle Krankenhausoperationen wurden hier geplant und verwaltet. In den Gründungsjahren hatte dieses Darüşşifa 1 Chefarzt, zwei Ärzte, 2 Chirurgen, 2 Augenärzte und 1 Apotheker.',
    s2_c3:'Dieser Verwaltungsbereich diente auch als Schutzbarriere zwischen dem täglichen Patientenfluss im ersten Innenhof und der stationären Behandlungsstation, die Sie gleich betreten werden.',
    s2_c4:'Lesen Sie nun die über der Tür geschriebene Inschrift, dann halten Sie den Atem an…',
    s2_callout:'🚶‍♂️ <strong>Betreten Sie diesen magischen Ort, wo Musik und das Rauschen des Wassers auf Heilung treffen.</strong>',
    s2_fwd:'DIE GROSSE KRANKENSTATION ENTDECKEN →',
    s3_ct1:'🏥 STATIONÄRE BEHANDLUNGSSTATION',s3_ct2:'🌊 STRUKTUR DES KRANKENHAUSES',s3_ct3:'🎵 MUSIKTHERAPIE',s3_ct4:'💧 WASSERTHERAPIE',s3_ct5:'🌿 AROMATHERAPIE',s3_ct6:'🧺 BESCHÄFTIGUNGSTHERAPIE',s3_ct7:'🚶 AUSGANG UND RUNDGANG',
    s3_c1:'Sie befinden sich nun im Herzen unseres Museums und in der stationären Behandlungsstation des Edirne Darüşşifa. Durchwandern Sie diesen Raum mit dem Gefühl derer, die hier vor 500 Jahren Heilung fanden.',
    s3_c2:'Stellen Sie sich ein Krankenhaus vor, in dem Sie in der Mitte von einem rhythmisch fließenden Brunnen und direkt gegenüber von einer Musikbühne empfangen werden. Dieses zentral geplante, von einer großen Kuppel überdachte Krankenhaus besteht aus 6 Winterpatientenzimmern, 4 Sommerpatientenzimmern und einer Musikbühne. Die Laterne in der Kuppel belüftet auch schlechte Luft nach außen. Der geneigte Boden und die darunterliegenden Kanäle erleichtern das Waschen und Reinigen.',
    s3_c3:'Was dieses Krankenhaus von anderen unterschied, war die Verwendung von Musikmodi in der Behandlung neben dem zeitgenössischen medizinischen Wissen. Ein Musikensemble aus 10 Musikern spielte und sang verschiedene Modi für verschiedene Krankheiten, wie von den Ärzten empfohlen — es wurde geglaubt, dass dies verschiedenen Erkrankungen zugute komme.',
    s3_c4:'Das Rauschen des Wassers, das aus dem Brunnen in der Mitte des Gebäudes floss, war ein wichtiger Bestandteil der Behandlung, der darauf abzielte, die Patienten zu beruhigen und zu besänftigen.',
    s3_c5:'Zusätzlich zu Musik und Wassergeräuschen wurde im Darüşşifa auch Aromatherapie praktiziert. Die Düfte verschiedener im Innenhof und in der Umgebung angebauter Pflanzen waren ein integraler Bestandteil des Heilungsprozesses.',
    s3_c6:'Auch Beschäftigungstherapie wurde hier als Behandlungsmethode eingesetzt. Die Patienten wurden mit Korbflechten, Stricken und verschiedenen Handarbeiten beschäftigt, um sie von ihren Sorgen und Gedanken abzulenken.',
    s3_c7:'Nach dem Rundgang durch die Räume, die verschiedene Aspekte der osmanischen Medizin zeigen, können Sie die stationäre Station verlassen. Beim Verlassen dieses Heilungsortes — der 400 Jahre ununterbrochen in Betrieb war — können Sie auch die anderen Räume im zweiten und ersten Innenhof besuchen, um mehr über das Darüşşifa und die osmanische Medizin zu erfahren.',
    s3_callout:'🏫 <strong>ZUR MEDIZINISCHEN MEDRESE:</strong> Verlassen Sie das Darüşşifa und gehen Sie zur Medizinischen Medrese, die sich links des Eingangsgartens mit dem großen Foto befindet.',
    s3_fwd:'WEITER ZUR MEDRESE →',
    s4_ct1:'🏫 DIE MEDIZINISCHE MEDRESE',s4_ct2:'🌍 HISTORISCHE BEDEUTUNG',s4_ct3:'📚 BILDUNGSSYSTEM',s4_ct4:'🏛️ ARCHITEKTONISCHE STRUKTUR',s4_ct5:'📜 EVLIYA ÇELEBİ',s4_ct6:'👨‍🏫 LEHRPERSONAL',s4_ct7:'📖 HANDSCHRIFTEN',s4_ct8:'🏥 GESUNDHEITSMUSEUM',
    s4_c1:'Sie haben das Darüşşifa besichtigt und sind nun in einen weiteren wichtigen Bereich der Külliye eingetreten — der Medizinischen Medrese Sultan Bayezid II. Bevor Sie die Museumsräume auf der rechten und gegenüberliegenden Seite betreten, halten Sie an und studieren Sie diesen einzigartigen Raum.',
    s4_c2:'Was Sie jetzt als Gebäude rund um einen quadratischen Innenhof sehen, war eine der angesehensten Bildungseinrichtungen zur Ausbildung von Ärzten im Osmanischen Reich — ein wichtiges Wissenszentrum, das im Laufe der Jahrhunderte viele bedeutende Ärzte hervorbrachte.',
    s4_c3:'Als eine der höchststufigen "60er und darüber" Medresen im osmanischen Bildungssystem eingestuft, konnten die Studenten hier ihre theoretische Ausbildung im angrenzenden Darüşşifa anwenden und ihr Wissen durch die Praxis festigen.',
    s4_c4:'Die Medrese — mit einem Brunnen (nicht mehr vorhanden) in der Mitte und einem Brunnen in der Ecke zur Wasserversorgung — besteht aus 18 Studentenzimmern, die auf drei Seiten angeordnet sind, und einem Hörsaal direkt gegenüber.',
    s4_c5:'Evliya Çelebi, der die Külliye 1652 besuchte, schrieb über diese Medrese: "In der Medizinischen Medrese und ihren Räumen sind Studenten, die ständig von Gelehrten wie Platon, Sokrates, Aristoteles, Galen und Pythagoras sprechen — gereifte Ärzte, jeder einzelne. Jeder einem Wissensgebiet gewidmet, auf wertvolle Bücher in der Heilkunst angewiesen und bestrebt, Heilmittel für die Gebrechen der Menschheit zu finden."',
    s4_c6:'Das Lehrpersonal umfasste einen Professor, der 60 Akçe pro Tag verdiente und 18 Studenten unterrichtete, einen Assistenzprofessor, einen Bibliothekar und zwei Bedienstete. Alle Studentenbedürfnisse wurden gedeckt, und sie erhielten außerdem ein tägliches Stipendium von zwei Akçe.',
    s4_c7:'38 handgeschriebene medizinische Manuskripte, die hier studiert wurden — viele mit den Siegeln osmanischer Sultane — sind bis heute erhalten geblieben. Diese wertvollen Werke werden nun in der Selimiye-Handschriftenbibliothek aufbewahrt.',
    s4_c8:'Die Medrese wurde 2007 von der Trakya Universität als zweiter Abschnitt des Gesundheitsmuseums eröffnet. Ihre Räume schildern die medizinische Ausbildung der Epoche. Der wichtigste Bereich ist der Hörsaal direkt gegenüber dem Eingang.',
    s4_callout:'🚶 <strong>Nachdem Sie die Studentenzimmer, angewandten Trainingsräume, das Professorenzimmer, den Hörsaal und die Bibliothek — mit Schaufensterpuppen in 15. Jh.-Atmosphäre — besichtigt haben, verlassen Sie die Medrese und gehen Sie durch das Drehkreuz beim Darüşşifa-Ausgang zum Moscheeinnenhof, um weiter zum Imaret zu gelangen.</strong>',
    s4_fwd:'ZUR PRACHT DER MOSCHEE →',
    s5_ct1:'🌳 IN DEN GARTEN',s5_ct2:'💧 WASSERWAAGE',s5_ct3:'🕌 HAUPTTOR DER MOSCHEE',s5_ct4:'🏛️ VORRATSKAMMER UND IMARET',
    s5_c1:'Nach dem Rundgang durch Darüşşifa und Medrese sind Sie in den Moscheegarten eingetreten. Gehen Sie langsam durch diesen schönen Garten mit jahrhundertealten Platanen und steuern Sie auf den Imaret-Bereich des Museums direkt vor Ihnen zu.',
    s5_c2:'Wenn Sie den Garten vom Darüşşifa aus betreten, ist das Erste, was Sie rechts bemerken sollten — an der Ecke der Moschee — ein rechteckiges Steingebäude von etwa 4 Metern Höhe. Dies ist die Wasserwaage der Külliye. Das durch Rohre von hohen Hügeln herangeführte Wasser wurde zunächst in diesem Bauwerk druckausgeglichen, bevor es auf die anderen Einheiten der Külliye verteilt wurde.',
    s5_c3:'Nachdem Sie die Wasserwaage passiert haben, werden Sie vom prächtigen Haupteingangsportal der Moschee zu Ihrer Rechten empfangen. Lassen Sie uns das Erkunden des Moscheehofes durch dieses Portal für das Ende der Führung aufheben und unseren Weg zum Imaret fortsetzen.',
    s5_c4:'Vor Ihnen stehen zwei große Gebäude ähnlicher Architektur nebeneinander. Das linke enthält die Vorratskammer und die Bäckerei, die heute für wissenschaftliche und kulturelle Veranstaltungen des Museums genutzt werden. Das rechte ist das Imaret, zu dem ich Sie gerade dirigiere.',
    s5_callout:'🍲 <strong>Sind Sie bereit, die osmanische Imaret-Kultur zu erleben und die Legende des Kochs Yahya Baba zu hören? Dann zeigen Sie Ihr Ticket am Drehkreuz und betreten Sie diesen Bereich, dann tippen Sie auf den nächsten Stopp, um fortzufahren.</strong>',
    s5_fwd:'ZUM HERZEN DES ÜBERFLUSSES →',
    s6_ct1:'🏛️ DIE IMARETS',s6_ct2:'🍲 DAS IMARET VON SULTAN BAYEZID II.',s6_ct3:'🔥 KÜCHE UND SPEISESAAL',s6_ct4:'🎭 DIESER MUSEUMSBEREICH',s6_ct5:'🌿 YAHYA BABAS GRABMAL',s6_ct6:'📖 DIE LEGENDE VON YAHYA BABA',s6_ct7:'⚖️ DIE PRÜFUNG DES VORRATSVERWALTERS',s6_ct8:'👑 DER SULTAN ALS ZEUGE',s6_ct9:'🐟 DAS WUNDER DER FISCHE',s6_ct10:'🤲 YAHYA BABAS ABLEBEN',s6_ct11:'🪦 GRABBESUCH',
    s6_c1:'Im Osmanischen Reich waren Imarets zu den wichtigsten Institutionen, die den Geist der sozialen Solidarität und Wohltätigkeit verkörperten. Als Suppenküchen, die armen Menschen, Reisenden, Studenten und Mittellosen kostenlos Essen verteilten, waren diese Bauten nicht nur Küchen — sie waren lebenswichtige Zentren, die die Bedürftigen der Gesellschaft schützten und das soziale Gleichgewicht aufrechthielten.',
    s6_c2:'Und Sie befinden sich nun in genau so einem Ort. Das Imaret der Sultan Bayezid II. Külliye, als dritter Abschnitt des Gesundheitsmuseums eingerichtet, war eine wichtige Wohltätigkeitsinstitution, in der — laut seiner Stiftungsurkunde — täglich drei Mahlzeiten gekocht und an Arme verteilt wurden.',
    s6_c3:'Der breite Raum, dem Sie beim Eintreten begegnen, ist die Küche, in der Speisen in großen Kesseln gekocht wurden. Der große Saal, den Sie durch die Tür unmittelbar zu Ihrer Rechten sehen, war der Ort, wo Mahlzeiten an steinernen Bodentischen eingenommen wurden.',
    s6_c4:'Wie die anderen Bereiche des Gesundheitsmuseums ist auch dieser Bereich mit dem Geist des Ortes entsprechenden Schaufensterpuppen belebt, schildert die osmanische Imaret-Kultur und nimmt Besucher mit auf eine Zeitreise. Originale Kupfergefäße, Mörser und Vorratskrüge der Epoche werden hier ebenfalls ausgestellt.',
    s6_c5:'Unmittelbar hinter dem Imaret befindet sich das Grabmal des Kochs Yahya Baba, eine Sagengestalt. Während Sie dieses interessante und geräumige Gebäude erkunden, lassen Sie mich Ihnen die Legende des Kochs Yahya Baba erzählen, die bis heute überliefert ist.',
    s6_c6:'Der Überlieferung nach bereitete Yahya Baba, der Küchenchef zu Zeiten des Külliye-Gründers Sultan Bayezid II., außergewöhnlich köstlichen Reispilav zu. Beim Rühren des Pilavs betete er ununterbrochen, und wenn er den Deckel schloss, sagte er: "Gewähre Überfluss, o Herr." Der Pilav war so reichhaltig, dass er alle Patienten sättigte und sogar noch übrig blieb. Yahya Baba warf den übrigen Pilav nie weg — er brachte ihn, um die Fische im Tunca-Fluss zu füttern.',
    s6_c7:'Als der Vorratsverwalter bemerkte, dass Yahya Baba den überschüssigen Pilav in den Fluss schüttete, begann er, die ihm täglich zugeteilte Reismenge zu verringern. Doch auch mit weniger Reis kochte Yahya Baba den Pilav mit Gebet und sättigte sowohl Patienten als auch Fische. Schließlich wurde die zugeteilte Reismenge auf eine einzige Handvoll reduziert. Dennoch sättigte Yahya Babas Pilav alle Patienten, und er schaffte es noch immer, einen Anteil für die Fische beiseite zu legen.',
    s6_c8:'Das Ganze drang schließlich bis zum Sultan vor. Der Sultan beschloss, die Sache aus erster Hand zu bezeugen, kam vor Yahya Baba am Tunca-Flussufer an und versteckte sich. Als Yahya Baba nach dem Füttern der Fische gerade gehen wollte, trat der Sultan aus seinem Versteck und brüllte: "He, du — schüttest du die Lebensmittel der Patienten in den Fluss?"',
    s6_c9:'Yahya Baba erstarrte. Er konnte nichts sagen. Er war so von Scham überwältigt, dass er sich niederwarf und bei Gott Zuflucht suchte. Doch die Fische hoben ihre Köpfe aus dem Wasser und riefen: "Gönnt der große Sultan den Fischen ihre Nahrung nicht?"',
    s6_c10:'Der Sultan, der seinen Irrtum in Staunen und Kummer erkannte, wartete darauf, dass Yahya Baba seinen Kopf von der Niederwerfung heben würde — aber vergeblich. Dieser gütige Mann hatte seine Seele bereits ausgehaucht…',
    s6_c11:'Das Grabmal von Yahya Baba, das sich direkt hinter dem Imaret befindet, wird von Vorbeigehenden wie eine Heiligenstätte besucht, die kommen, um zu beten. Besonders freitags ist dieses Grabmal voller Besucher.',
    s6_callout:'🪦 <strong>GASTHÄUSER:</strong> Nach dem Anhören dieser Legende ist es Zeit, das Imaret zu verlassen und im Museumscafé auf der linken Seite zu rasten. Im Museumscafé im Külliye-Gästehaus können Sie Tee und besonders osmanischen Şerbet genießen, Geschenke und Bücher kaufen, die Museumsbibliothek besichtigen und dann zur letzten Station — dem Moscheehof — übergehen. Möchten wir eine kurze Pause im Külliye-Gästehaus einlegen?',
    s6_fwd:'ZUM MUSEUMSCAFÉ →',
    s7_ct1:'🏛️ INNENHOF UND EINGANG ZUR MOSCHEE',s7_ct2:'🚪 EINGANG UND ATMOSPHÄRE',s7_ct3:'⛲ DER BRUNNEN UND DIE STILLE',s7_ct4:'🏛️ MARMORSÄULEN UND ARCHITEKTONISCHE HARMONIE',s7_ct5:'✨ INNERER FRIEDEN UND RUHE',s7_ct6:'👁️ MOMENTE DER BEOBACHTUNG',s7_ct7:'🚪 EINGANG IN DIE MOSCHEE',s7_ct8:'🪵 KÜNDEKÂRI-HANDWERK',
    s7_c1:'Sie haben die Bereiche unseres Gesundheitsmuseums besichtigt und den erfrischenden osmanischen Şerbet im Café gekostet. Jetzt ist es an der Zeit, eines der prächtigsten Bauwerke der Külliye kennenzulernen — die Moschee.',
    s7_c2:'Wenn Sie durch die elegante Seitentür, die zum Innenhof führt, oder durch das prächtige Hauptportal eintreten, werden Sie vom feinen Handwerk des Marmors begrüßt. Im Nu lassen Sie den Trubel der Außenwelt hinter sich und gleiten in eine völlig andere Atmosphäre.',
    s7_c3:'Der Brunnen in der Mitte des Innenhofs erfüllt den Raum durch das stille Rauschen des Wassers mit Frieden. Dieses Geräusch, kombiniert mit der Stille des Steins, verlangsamt Sie und macht Sie sich des gegenwärtigen Moments bewusst.',
    s7_c4:'Die Sie umgebenden Marmorsäulen steigen wie ein schützender Ring auf. In verschiedenen Farben ausgewählt, verkörpern sie die Eleganz und harmonische Fülle osmanischer Ästhetik.',
    s7_c5:'Was Sie hier fühlen, ist nicht nur architektonische Schönheit — es ist eine Stille, ein innerer Frieden, der sich seit Jahrhunderten unverändert erhalten hat.',
    s7_c6:'Halten Sie kurz am Brunnen inne und beobachten Sie diese schlichte, aber eindrucksvolle Innenhofordnung. Spüren Sie die Harmonie, die Säulen, Bögen und feine Ornamente miteinander eingehen.',
    s7_c7:'Wenden Sie sich dann dem prächtigen Portal zu, das direkt vor Ihnen aufsteigt. Öffnen Sie behutsam den Ledervorhang über der Tür und treten Sie ein. Sie werden sofort spüren, dass Sie eine der elegantesten Moscheen unseres Landes betreten haben.',
    s7_c8:'Achten Sie beim Eintreten auf das originale Kündekâri-Schnitzwerk über der Tür — und fühlen Sie wenn möglich die Textur dieses exquisiten Handwerks.',
    s7_callout:'🕌 <strong>Sollen wir in die große Weite und Stille des Heiligtums eintreten?</strong>',
    s7_fwd:'WEITER NACH INNEN →',
    s8_ct1:'🕌 IN DER MOSCHEE — DAS FINALE',s8_ct2:'🚤 HISTORISCHER TRANSPORT UND KÖNIGLICHE TRADITION',s8_ct3:'👑 DIE KÖNIGLICHE GALERIE VORSTELLEN',s8_ct4:'🏛️ DIE KÖNIGLICHE GALERIE UND IHRE ERSTLINGE',s8_ct5:'⚙️ DIE GEBETSNISCHE UND GLEICHGEWICHTSSTEINE',s8_ct6:'🪵 DIE KANZEL UND FEINES HANDWERK',s8_ct7:'📐 SYMBOLE UND BEDEUTUNGEN',s8_ct8:'💡 LICHT- UND AKUSTIKORDNUNG',s8_ct9:'🌌 PRACHT UNTER DER KUPPEL',s8_ct10:'🏗️ EIN ARCHITEKTONISCHER WENDEPUNKT',s8_ct11:'✨ FINALE UND ABSCHIED',
    s8_c1:'Sie befinden sich nun in der Moschee im Zentrum der Külliye, und wir vollenden das Finale unserer Führung unter dieser prächtigen Kuppel.',
    s8_c2:'Sultan Bayezid II., der Gründer der Külliye, und die nachfolgenden Sultane pflegten in verzierten kaiserlichen Booten entlang des Flusses zu dieser Moschee zu gelangen. Sie traten durch die flusseitige Tür ein und verrichteten ihre Gebete in der Königsgalerie — dem Hünkâr Mahfili — die auf Säulen in der linken Ecke der Moschee aufsteigt.',
    s8_c3:'Schließen Sie einen Moment die Augen… Stellen Sie sich den Sultan vor, wie er in dieser Höhe in demselben Frieden neben der Gemeinde betet.',
    s8_c4:'Im Gedanken daran, dass die erste Königsgalerie in der türkisch-islamischen Architektur hier errichtet wurde, gehen wir nun zur Gebetsnische.',
    s8_c5:'Wenn Sie die zylindrischen Gleichgewichtssteine auf beiden Seiten der Gebetsnische berühren und sanft drehen, werden Sie erstaunt feststellen, dass der Boden dieses großen Bauwerks nicht die geringste Verschiebung zeigt.',
    s8_c6:'Wenn Sie sich der Kanzel auf der rechten Seite nähern, werden Sie die Feinheit und Eleganz der Marmorarbeit bewundern.',
    s8_c7:'Nun schlage ich vor, Sie drehen Ihren Rücken zur Gebetsnische und schauen über die Eingangstür. Das Tablett-Motiv mit einer Wassermelone in der Mitte, direkt über der Tür, symbolisiert, dass es in dieser Külliye ein Imaret gibt und dass die Ankömmlinge zu einer Mahlzeit eingeladen sind.',
    s8_c8:'Die Fenster rund um die Kuppel und in den unteren Reihen sorgen dafür, dass das Licht gleichmäßig im Raum verteilt wird. Diese Lichtanordnung, kombiniert mit der kraftvollen Akustik der Moschee, verleiht dem Raum sowohl visuelle als auch akustische Tiefe.',
    s8_c9:'Heben Sie nun Ihren Blick nach oben… Betrachten Sie sorgfältig diese prächtige Kuppel, die mit Barockverzierungen geschmückt ist. Diese Kuppel — etwa 31 Meter hoch und 22 Meter im Durchmesser — ruht auf vier Wänden ohne Zwischensäulen und ist ein architektonisch bemerkenswertes Beispiel.',
    s8_c10:'Sie gilt auch als wichtiger Vorläufer des Übergangs zu Einzel-Kuppel-Strukturen.',
    s8_c11:'Unter der Anmut und Pracht dieser unvergleichlichen Kuppel schließen wir diese Reise ab, auf der Sie die Spuren der Vergangenheit mit der heutigen Stille verbunden haben — vergessen Sie nicht, den Frieden und die Bewunderung, die dieser Ort in Ihrem Herzen hinterlassen hat, mit sich zu tragen.',
    s8_callout:'🙏 <strong>Sollen wir dieser spirituellen Reise einen stillen Abschied setzen?</strong>',
    s8_fwd:'IN RICHTUNG ABSCHIED →',
    s9_c1:'🏛️ Wir haben Schritt für Schritt die Spuren der Vergangenheit verfolgt und diese großartige Architektur gemeinsam eingeatmet. Jetzt ist es an der Zeit, diesem historischen Ort Ihren eigenen Atem hinzuzufügen.',
    s9_c2:'💭 Was in Ihnen nachhallt… Ein Moment des Friedens, eine tiefe Bewunderung oder jene stille Note, die in Ihrem Herzen nachklingt…',
    s9_c3:'📖 Das Besucherbuch, das wir für Sie vorbereitet haben, ist ein spirituelles Archiv dieser Erfahrung. Jeder Satz, den Sie hier hinterlassen, wird für uns eine unschätzbare Erinnerung sein und für unsere anderen Gäste ein Licht, das dieser Reise Bedeutung verleiht.',
    s9_c4:'✨ Teilen Sie mit uns, was von Ihrem Herzen fließt — und lassen Sie Ihre Spur für immer auf der Herzbrücke bleiben…',
    s9_callout:'✍️ <strong>Wir laden Sie ein, Ihre Gefühle auf unserer Herzbrücken-Seite zu teilen.</strong>',
    s9_fwd:'AUF DIE HERZBRÜCKE SCHREIBEN →',
    s10_body:'Wir würden gerne hören, welche Eindrücke diese 500-jährige Reise durch unsere Külliye bei Ihnen hinterlassen hat. Ihre Worte werden Steine dieser Brücke.',
    s10_restart:'🏛️ ZUM ANFANG ZURÜCK'
  },

  fr:{
    start:'COMMENCER LE VOYAGE',intro_title:'Invitation au Seuil',intro_sub:'Un voyage au-delà du temps, vers le centre de la guérison…',
    back:'← RETOUR',menu_lang:'Langue: Français 🇫🇷',menu_map:'Carte & Position',menu_defter:'Pont du Cœur',
    loc_searching:'📍 Localisation en cours…',loc_outside:'📍 Vous êtes en dehors du Külliye.',
    loc_error:'📍 Localisation impossible. Veuillez activer les autorisations de localisation.',
    gb_name:'Votre Nom',gb_city:'Votre Ville',gb_msg:'Laissez vos sentiments ici…',
    gb_submit:'JE POSE MA PIERRE SUR LE PONT 🪨',gb_submitting:'Scellement…',
    gb_conn_err:'Erreur de connexion. Veuillez réessayer.',gb_no_msg:'Veuillez laisser une note…',
    confirm_text:'Vos sentiments ont été scellés sur le Pont du Cœur. La trace significative que vous avez laissée enrichit le patrimoine spirituel de notre Külliye…',
    confirm_close:'QUE VOUS SOYEZ GUÉRI 🌿',latest_title:'📜 Derniers Messages',archive_title:'🗂️ Archive',
    no_msg:'Pas encore de messages. Soyez le premier à poser une pierre ! ✨',
    s0_main:'🏛️ KÜLLIYE DU SULTAN BAYEZID II',s0_sub:'MUSÉE DE SANTÉ',s0_slogan:'✨ VOYAGE DE GUÉRISON — ENTRÉE DU MUSÉE',
    s1_main:'Entrée du Darüşşifa',s1_sub:'🏛️ PORTE DE JUSTICE ET DE GUÉRISON',s1_slogan:'⚖️ PREMIER ARRÊT DE LA GUÉRISON',
    s2_main:'Sortie de la Salle de Présentation',s2_sub:'🏛️ DU SAVOIR À L\'EXPÉRIENCE',s2_slogan:'🏛️ ADMINISTRATION ET ORDRE',
    s3_main:'La Grande Infirmerie (SALLE OCTOGONALE)',s3_sub:'🏛️ SEUIL DU DARÜŞŞIFA',s3_slogan:'🌊 L\'APOGÉE DE LA GUÉRISON',
    s4_main:'École de Médecine (Médresé)',s4_sub:'🎓 BERCEAU DU SAVOIR',s4_slogan:'📚 LA LUMIÈRE DE L\'APPRENTISSAGE',
    s5_main:'Grande Cour',s5_sub:'🌿 PLATANES CENTENAIRES',s5_slogan:'🌳 TEMPS ET TRANQUILLITÉ',
    s6_main:'Imaret (Cuisine Communautaire)',s6_sub:'🍲 COMPASSION ET ABONDANCE',s6_slogan:'🍲 LA CUISINE DE YAHYA BABA',
    s7_main:'Préparation à l\'Atmosphère Spirituelle',s7_sub:'🕌 ENTRÉE À LA MOSQUÉE',s7_slogan:'✨ UN DÔME, UNE PAIX INFINIE',
    s8_main:'Voyage Spirituel dans la Mosquée',s8_sub:'🕌 COUR DE LA MOSQUÉE',s8_slogan:'🌌 FINALE SOUS LE DÔME',
    s9_main:'L\'Heure des Adieux',s9_sub:'🌊 INVITATION AU PONT DU CŒUR',s9_slogan:'✨ LAISSEZ VOTRE EMPREINTE DANS CETTE HISTOIRE',
    s10_main:'🖋️ Pont du Cœur',s10_slogan:'"La guérison du passé rencontre les mots d\'aujourd\'hui."',
    nav_back:'← RETOUR',
    s0_ct1:'👑 HISTOIRE',s0_ct2:'🏗️ STRUCTURE',s0_ct3:'🎧 VOTRE GUIDE',s0_ct4:'📵 ATTENTION',s0_ct5:'📍 LOCALISATION',s0_ct6:'🏫 ORIENTATION',
    s0_c1:'Vous vous trouvez maintenant dans l\'un des sites historiques les plus captivants d\'Edirne — le Musée de Santé de la Külliye du Sultan Bayezid II. Bienvenue en ce lieu où l\'histoire et la guérison se rencontrent.',
    s0_c2:'Construite par le Sultan Bayezid II, fils de Mehmed le Conquérant et 8e sultan ottoman, sous la direction de l\'architecte en chef Hayrettin, cette ensemble est la külliye la mieux conservée parmi toutes les külliyes ottomanes. En son centre se dresse la mosquée ; à droite l\'hôpital et la médersa ; à gauche l\'imaret et le garde-manger ; attenants aux côtés de la mosquée, des hôtelleries, et derrière un pont sur le Tunca — tout cela incarne le modèle d\'État social ottoman.',
    s0_c3:'Je vous guiderai à travers la Külliye et notre musée avec des contenus écrits, audio et visuels pour enrichir votre visite.',
    s0_c4:'Veuillez garder votre téléphone portable en main tout au long de la visite.',
    s0_c5:'Vous avez passé la billetterie et vous vous trouvez maintenant dans le jardin avant. Veuillez vous placer devant la grande photographie de la Külliye suspendue au mur en face de vous et étudier l\'emplacement de ces bâtiments dans la ville d\'Edirne.',
    s0_c6:'En marchant vers ce point, le bâtiment à votre droite est la Médersa de Médecine de la Külliye, et le bâtiment directement devant vous est le Darüşşifa — peut-être le cœur de la Külliye et le centre de notre musée.',
    s0_callout:'👣 <strong>Après avoir examiné la grande photographie, entrez dans le jardin du Darüşşifa par la porte immédiatement à votre gauche.</strong>',
    s0_fwd:'COMMENCER LE VOYAGE DANS LE TEMPS →',
    s1_ct1:'🏥 DARÜŞŞIFA — 1ère COUR',s1_ct2:'🌍 IMPORTANCE HISTORIQUE',s1_ct3:'🛏️ SALLES DE SERVICE',s1_ct4:'🩺 CONSULTATIONS EXTERNES',s1_ct5:'🧭 ORIENTATION',s1_ct6:'💧 LE PUITS DU LAIT',s1_ct7:'🌿 L\'ARBRE ET LE LIERRE',s1_ct8:'🎬 SALLE DE PRÉSENTATION',
    s1_c1:'Vous vous trouvez maintenant dans la première cour du Darüşşifa d\'Edirne, l\'un des centres de guérison les plus importants de l\'Empire ottoman. Veuillez vous arrêter ici un instant et observer votre environnement.',
    s1_c2:'Sachez d\'abord ceci : ce bâtiment est reconnu comme l\'un des premiers exemples d\'hôpital planifié de manière centralisée et méticuleuse dans l\'histoire. Les homologues occidentaux n\'apparurent que 200 ans plus tard — ici, les espaces de traitement et de service ont été réalisés avec une vision architecturale bien en avance sur son temps.',
    s1_c3:'En avançant sur le chemin devant vous, les quatre salles immédiatement à gauche de l\'entrée sont les unités de service du Darüşşifa : une salle du personnel, une buanderie, une cuisine diététique et un garde-manger pour les provisions.',
    s1_c4:'Sur votre droite, derrière les colonnes, se trouvent six salles de consultation externe où les examens quotidiens des patients, les soins et les interventions d\'urgence avaient lieu. Dans les années de fondation, l\'une de ces salles était réservée aux oculistes appelés "kehhal".',
    s1_c5:'Remettez la visite détaillée de ces salles — ornées de présentations et de panneaux d\'information — à votre retour, et laissez-moi vous guider maintenant vers notre salle de présentation. Elle se trouve après la première cour, sur la gauche. En marchant, veuillez remarquer le puits à votre gauche.',
    s1_c6:'Cette structure en pierre s\'appelle le "Puits du Lait", car on croyait que son eau augmentait la production de lait des nouvelles mères. Environ 20 mètres plus loin, parmi l\'herbe, vous verrez un arbre enveloppé de lierre.',
    s1_c7:'Lorsque vous atteignez cet endroit, lisez absolument le poème d\'amour mélancolique écrit par Ahmet Kutsi Tecer sur cet arbre, affiché sur un panneau dans l\'herbe. Puis regardez l\'arbre et le lierre une fois de plus, avec ce sentiment dans votre cœur.',
    s1_c8:'Juste après le poème, immédiatement sur votre gauche, se trouve notre salle de présentation. Vous pouvez y regarder une vidéo sur l\'histoire et le développement de la Külliye et du Darüşşifa, acquérant une compréhension globale de l\'importance de ce lieu dans l\'histoire de la médecine et de l\'architecture.',
    s1_callout:'🎬 <strong>Souhaitez-vous regarder la vidéo de présentation ?</strong> Vous pouvez la voir dans la salle de présentation ou appuyer sur le bouton ci-dessous pour la regarder sur votre téléphone.',
    s1_watch:'VOIR LA PRÉSENTATION ▶',s1_fwd:'VERS LA SALLE DE PRÉSENTATION →',
    s2_ct1:'🚪 ENTRÉE DANS LA 2ème COUR',s2_ct2:'🏛️ SALLES ADMINISTRATIVES',s2_ct3:'🔒 SECTION ADMINISTRATIVE',s2_ct4:'✨ INSCRIPTION ET ENTRÉE',
    s2_c1:'Dès que vous quittez la salle de présentation, passez par la grande porte immédiatement à votre gauche dans la deuxième cour, où se trouvent les bureaux administratifs.',
    s2_c2:'Dans cette cour se trouvent 4 salles — deux de chaque côté. Le médecin-chef et les autres médecins utilisaient ces salles ; toutes les opérations hospitalières y étaient planifiées et gérées. Dans les années de fondation, ce Darüşşifa comptait 1 médecin-chef, deux médecins, 2 chirurgiens, 2 oculistes et 1 pharmacien.',
    s2_c3:'Cette section administrative servait également de barrière protectrice entre le flux quotidien de patients dans la première cour et le service de traitement hospitalier que vous êtes sur le point de visiter.',
    s2_c4:'Lisez maintenant l\'inscription au-dessus de la porte, puis retenez votre souffle…',
    s2_callout:'🚶‍♂️ <strong>Entrez dans ce lieu magique où la musique et le son de l\'eau se rencontrent avec la guérison.</strong>',
    s2_fwd:'DÉCOUVRIR LA GRANDE INFIRMERIE →',
    s3_ct1:'🏥 SERVICE DE TRAITEMENT HOSPITALIER',s3_ct2:'🌊 STRUCTURE DE L\'HÔPITAL',s3_ct3:'🎵 MUSICOTHÉRAPIE',s3_ct4:'💧 HYDROTHÉRAPIE',s3_ct5:'🌿 AROMATHÉRAPIE',s3_ct6:'🧺 ERGOTHÉRAPIE',s3_ct7:'🚶 SORTIE ET VISITE',
    s3_c1:'Vous vous trouvez maintenant au cœur de notre musée et dans le service de traitement hospitalier du Darüşşifa d\'Edirne. Traversez cet espace avec le sentiment de ceux qui ont trouvé la guérison ici il y a 500 ans.',
    s3_c2:'Imaginez un hôpital où vous êtes accueilli par une fontaine coulant selon un rythme régulier au centre, et une scène musicale directement en face. Cet hôpital à plan centré, couvert d\'une large coupole, comprend 6 chambres de patients d\'hiver, 4 chambres de patients d\'été et une scène musicale. Le lanternon dans la coupole ventile également l\'air vicié vers l\'extérieur. Le sol incliné et les canaux en dessous facilitent le lavage et le nettoyage.',
    s3_c3:'Ce qui distinguait cet hôpital des autres était l\'utilisation des modes musicaux dans le traitement, en plus des connaissances médicales contemporaines. Un ensemble musical de 10 musiciens jouait et chantait différents modes pour différentes maladies, selon les recommandations des médecins — on croyait que cela bénéficiait à diverses affections.',
    s3_c4:'Le son de l\'eau coulant de la fontaine au centre du bâtiment était une partie importante du traitement, visant à calmer et apaiser les patients.',
    s3_c5:'En plus de la musique et des sons d\'eau, l\'aromathérapie était également pratiquée au Darüşşifa. Les parfums de diverses plantes cultivées dans la cour et ses environs faisaient partie intégrante du processus de guérison.',
    s3_c6:'L\'ergothérapie était également utilisée comme méthode de traitement ici. Les patients étaient occupés avec la vannerie, le tricot et divers artisanats pour les distraire de leurs soucis et pensées.',
    s3_c7:'Après la visite des salles présentant différents aspects de la médecine ottomane, vous pouvez quitter le service hospitalier. En quittant ce lieu de guérison — qui a servi sans interruption pendant 400 ans — vous pouvez également visiter les autres salles dans les deuxième et première cours pour en apprendre davantage sur le Darüşşifa et la médecine ottomane.',
    s3_callout:'🏫 <strong>VERS LA MÉDERSA MÉDICALE :</strong> Quittez le Darüşşifa et marchez vers la Médersa Médicale, située à gauche du jardin d\'entrée avec la grande photographie.',
    s3_fwd:'EN AVANT VERS LA MÉDERSA →',
    s4_ct1:'🏫 LA MÉDERSA MÉDICALE',s4_ct2:'🌍 IMPORTANCE HISTORIQUE',s4_ct3:'📚 SYSTÈME ÉDUCATIF',s4_ct4:'🏛️ STRUCTURE ARCHITECTURALE',s4_ct5:'📜 EVLIYA ÇELEBİ',s4_ct6:'👨‍🏫 PERSONNEL ENSEIGNANT',s4_ct7:'📖 MANUSCRITS',s4_ct8:'🏥 MUSÉE DE SANTÉ',
    s4_c1:'Vous avez visité le Darüşşifa et êtes maintenant entré dans une autre section cruciale de la Külliye — la Médersa Médicale du Sultan Bayezid II. Avant d\'entrer dans les salles du musée sur les côtés droit et opposé, arrêtez-vous et étudiez cet espace unique.',
    s4_c2:'Ce que vous voyez maintenant comme un bâtiment arrangé autour d\'une cour carrée était l\'une des institutions d\'enseignement les plus prestigieuses formant des médecins dans l\'Empire ottoman — un important centre de savoir qui a produit de nombreux médecins éminents au fil des siècles.',
    s4_c3:'Classée parmi les méderses de niveau le plus élevé "60 et au-dessus" du système éducatif ottoman, les étudiants pouvaient appliquer leur formation théorique au Darüşşifa adjacent, renforçant leurs connaissances par la pratique.',
    s4_c4:'La médersa — avec une fontaine (disparue) en son centre et un puits dans le coin pour l\'approvisionnement en eau — comprend 18 chambres d\'étudiants disposées sur trois côtés et une salle de cours directement en face.',
    s4_c5:'Evliya Çelebi, qui visita la Külliye en 1652, écrivit sur cette médersa : "Dans la Médersa Médicale et ses salles se trouvent des étudiants qui parlent constamment de savants comme Platon, Socrate, Aristote, Galien et Pythagore — des médecins accomplis chacun. Chacun se consacre à une branche du savoir, s\'appuyant sur de précieux livres dans l\'art de la médecine, s\'efforçant de trouver des remèdes aux maux de l\'humanité."',
    s4_c6:'Le personnel enseignant comprenait un professeur gagnant 60 akçe par jour enseignant à 18 étudiants, un professeur adjoint, un bibliothécaire et deux domestiques. Tous les besoins des étudiants étaient couverts, et ils recevaient également une bourse quotidienne de deux akçe.',
    s4_c7:'38 manuscrits médicaux manuscrits étudiés ici — beaucoup portant les sceaux de sultans ottomans — ont survécu jusqu\'à nos jours. Ces précieuses œuvres sont maintenant conservées à la Bibliothèque de Manuscrits de Selimiye.',
    s4_c8:'La médersa a été ouverte par l\'Université de Trakya en 2007 comme deuxième section du Musée de Santé. Ses salles racontent l\'enseignement médical de l\'époque. La section la plus importante est la salle de cours, directement en face de l\'entrée.',
    s4_callout:'🚶 <strong>Après avoir visité les chambres d\'étudiants, les salles de formation pratique, la salle du professeur, la salle de cours et la bibliothèque — agencées avec des mannequins dans une atmosphère du XVe siècle — quittez la médersa et passez par le tourniquet près de la sortie du Darüşşifa vers la cour de la mosquée pour continuer vers l\'Imaret.</strong>',
    s4_fwd:'VERS LA GRANDEUR DE LA MOSQUÉE →',
    s5_ct1:'🌳 DANS LE JARDIN',s5_ct2:'💧 BALANCE HYDRAULIQUE',s5_ct3:'🕌 PORTAIL PRINCIPAL DE LA MOSQUÉE',s5_ct4:'🏛️ GARDE-MANGER ET IMARET',
    s5_c1:'Après la visite du Darüşşifa et de la Médersa, vous avez pénétré dans le jardin de la mosquée. Avancez lentement dans ce beau jardin de platanes centenaires, en vous dirigeant vers la section Imaret du musée directement devant vous.',
    s5_c2:'En entrant dans le jardin depuis le Darüşşifa, la première chose à remarquer sur votre droite — au coin de la mosquée — est une structure rectangulaire en pierre d\'environ 4 mètres de haut. C\'est la balance hydraulique de la Külliye. L\'eau amenée par des tuyaux depuis les collines environnantes voyait d\'abord sa pression équilibrée dans cette structure avant d\'être distribuée aux autres unités de la Külliye.',
    s5_c3:'Après avoir passé la balance hydraulique, vous serez accueilli par le magnifique portail d\'entrée principal de la mosquée à votre droite. Laissons l\'exploration de la cour de la mosquée par ce portail pour la toute fin de notre visite, et continuons notre marche vers l\'Imaret.',
    s5_c4:'Devant vous se dressent côte à côte deux grands bâtiments d\'architecture similaire. Celui de gauche contient le garde-manger et la boulangerie, utilisés maintenant pour les événements scientifiques et culturels du musée. Celui de droite est l\'Imaret vers lequel je vous dirige.',
    s5_callout:'🍲 <strong>Êtes-vous prêt à découvrir la culture de l\'imaret ottoman et à entendre la légende du cuisinier Yahya Baba ? Alors montrez votre billet au tourniquet et entrez dans cette section, puis appuyez sur l\'arrêt suivant pour continuer.</strong>',
    s5_fwd:'VERS LE CŒUR DE L\'ABONDANCE →',
    s6_ct1:'🏛️ LES IMARETS',s6_ct2:'🍲 L\'IMARET DU SULTAN BAYEZID II',s6_ct3:'🔥 CUISINE ET SALLE À MANGER',s6_ct4:'🎭 CETTE SECTION DU MUSÉE',s6_ct5:'🌿 LE TOMBEAU DE YAHYA BABA',s6_ct6:'📖 LA LÉGENDE DE YAHYA BABA',s6_ct7:'⚖️ L\'ÉPREUVE DU GARDIEN',s6_ct8:'👑 LE SULTAN COMME TÉMOIN',s6_ct9:'🐟 LE MIRACLE DES POISSONS',s6_ct10:'🤲 LA DISPARITION DE YAHYA BABA',s6_ct11:'🪦 VISITE DU TOMBEAU',
    s6_c1:'Dans l\'Empire ottoman, les imarets étaient parmi les institutions les plus importantes incarnant l\'esprit de solidarité sociale et de charité. Servant de soupes populaires distribuant de la nourriture gratuitement aux pauvres, aux voyageurs, aux étudiants et aux démunis, ces structures n\'étaient pas de simples cuisines — elles étaient des centres vitaux qui protégeaient les membres les plus démunis de la société et maintenaient l\'équilibre social.',
    s6_c2:'Et vous vous trouvez maintenant dans un tel endroit. L\'imaret de la Külliye du Sultan Bayezid II, établi comme troisième section du Musée de Santé, était une importante institution caritative où — selon son acte de fondation — trois repas par jour étaient cuisinés et distribués aux pauvres.',
    s6_c3:'Le large espace que vous rencontrez en entrant est la cuisine où les repas étaient cuisinés dans de grandes marmites. La grande salle que vous voyez par la porte immédiatement à votre droite était l\'endroit où les repas étaient pris à des tables à même le sol en pierre.',
    s6_c4:'Comme les autres sections du Musée de Santé, cette section est animée par des mannequins adaptés à l\'esprit du lieu, narrant la culture de l\'imaret ottoman et emmenant les visiteurs dans un voyage dans le temps. Des récipients en cuivre originaux de l\'époque, des mortiers et des jarres de stockage y sont également exposés.',
    s6_c5:'Immédiatement derrière l\'imaret se trouve le Tombeau du cuisinier Yahya Baba, un personnage de légende. Pendant que vous explorez ce bâtiment intéressant et spacieux, laissez-moi vous raconter la légende du cuisinier Yahya Baba qui a survécu jusqu\'à nos jours.',
    s6_c6:'Selon l\'histoire, Yahya Baba, le cuisinier en chef sous le règne du fondateur de la Külliye, le Sultan Bayezid II, préparait un pilaf de riz exceptionnellement délicieux. En remuant le pilaf, il priait constamment, et en fermant le couvercle, il disait : "Accorde l\'abondance, ô Seigneur." Le pilaf était si abondant qu\'il nourrissait tous les patients et avait même des restes. Yahya Baba ne jetait jamais le pilaf en surplus — il l\'apportait pour nourrir les poissons dans le Tunca.',
    s6_c7:'Lorsque le gardien remarqua que Yahya Baba donnait le pilaf en surplus à la rivière, il commença à réduire la quantité de riz qui lui était allouée jour après jour. Pourtant, même avec moins de riz, Yahya Baba cuisinait le pilaf avec prière, nourrissant à la fois les patients et les poissons. Finalement, le riz alloué fut réduit à une seule poignée. Le pilaf de Yahya Baba nourrissait toujours tous les patients, et il parvenait encore à mettre une portion de côté pour les poissons.',
    s6_c8:'La chose parvint finalement aux oreilles du Sultan. Décidant de témoigner de la chose en personne, le Sultan arriva avant Yahya Baba au bord du Tunca et se cacha. Alors que Yahya Baba était sur le point de repartir après avoir nourri les poissons, le Sultan sortit de sa cachette et rugit : "Toi là — verses-tu les provisions des patients dans la rivière ?"',
    s6_c9:'Yahya Baba fut paralysé. Il ne pouvait rien dire. Il était tellement submergé par la honte qu\'il se prosterna et chercha refuge auprès de Dieu. Mais les poissons, levant la tête hors de l\'eau, s\'exprimèrent : "Le grand Sultan refuse-t-il aux poissons leur subsistance ?"',
    s6_c10:'Le Sultan, réalisant son erreur dans l\'étonnement et le chagrin, attendit que Yahya Baba lève la tête de sa prosternation — mais en vain. Cet homme bienveillant avait déjà rendu l\'âme…',
    s6_c11:'Le tombeau de Yahya Baba, situé juste derrière l\'imaret, est visité comme un sanctuaire de saint par des passants qui viennent prier. Surtout le vendredi, ce tombeau est rempli de visiteurs.',
    s6_callout:'🪦 <strong>HÔTELLERIES :</strong> Après avoir entendu cette légende, il est temps de quitter l\'imaret et de se reposer au café du musée sur la gauche. Dans le café du musée de l\'hôtellerie de la Külliye, vous pouvez déguster du thé et surtout un şerbet ottoman, acheter des cadeaux et des livres, visiter la bibliothèque du musée, puis vous rendre à la dernière étape — la cour de la mosquée. Voulez-vous faire une courte pause à l\'hôtellerie de la Külliye ?',
    s6_fwd:'VERS LE CAFÉ DU MUSÉE →',
    s7_ct1:'🏛️ COUR ET ENTRÉE DANS LA MOSQUÉE',s7_ct2:'🚪 ENTRÉE ET ATMOSPHÈRE',s7_ct3:'⛲ LA FONTAINE ET LA SÉRÉNITÉ',s7_ct4:'🏛️ COLONNES DE MARBRE ET HARMONIE ARCHITECTURALE',s7_ct5:'✨ PAIX INTÉRIEURE ET TRANQUILLITÉ',s7_ct6:'👁️ MOMENTS D\'OBSERVATION',s7_ct7:'🚪 ENTRÉE DANS LA MOSQUÉE',s7_ct8:'🪵 L\'ART DU KÜNDEKÂRI',
    s7_c1:'Vous avez visité les sections de notre Musée de Santé et goûté le şerbet ottoman rafraîchissant au café. Il est maintenant temps de rencontrer l\'une des structures les plus magnifiques de la Külliye — la mosquée.',
    s7_c2:'En entrant par l\'élégante porte latérale ouvrant sur la cour, ou par le grand portail principal, vous êtes accueilli par le fin travail du marbre. En un instant, vous laissez derrière vous l\'agitation du monde extérieur et glissez dans une atmosphère complètement différente.',
    s7_c3:'La fontaine au cœur même de la cour emplit l\'espace de paix par le son calme de l\'eau. Ce son, combiné au silence de la pierre, vous ralentit et vous rend conscient du moment présent.',
    s7_c4:'Les colonnes de marbre qui vous entourent s\'élèvent comme un anneau protecteur. Choisies dans différentes couleurs, elles incarnent l\'élégance et la richesse harmonieuse de l\'esthétique ottomane.',
    s7_c5:'Ce que vous ressentez ici n\'est pas seulement de la beauté architecturale — c\'est une tranquillité, une paix intérieure qui est restée inchangée depuis des siècles.',
    s7_c6:'Faites une courte pause à la fontaine et observez cet agencement de cour simple mais frappant. Ressentez l\'harmonie que les colonnes, les arcs et les ornements fins créent les uns avec les autres.',
    s7_c7:'Puis tournez-vous vers le portail magnifique qui s\'élève directement devant vous. Écartez doucement le rideau de cuir couvrant la porte et entrez. Vous sentirez immédiatement que vous avez pénétré dans l\'une des mosquées les plus élégantes de notre pays.',
    s7_c8:'En entrant, n\'oubliez pas de porter attention au travail de kündekâri original au-dessus de la porte — et si possible, touchez la texture de cet artisanat exquis.',
    s7_callout:'🕌 <strong>Entrons-nous dans la grande étendue et la tranquillité du sanctuaire ?</strong>',
    s7_fwd:'AVANCER À L\'INTÉRIEUR →',
    s8_ct1:'🕌 À L\'INTÉRIEUR DE LA MOSQUÉE — LE FINALE',s8_ct2:'🚤 TRANSPORT HISTORIQUE ET TRADITION ROYALE',s8_ct3:'👑 IMAGINER LA GALERIE ROYALE',s8_ct4:'🏛️ LA GALERIE ROYALE ET SES PREMIÈRES',s8_ct5:'⚙️ LE MIHRAB ET LES PIERRES D\'ÉQUILIBRE',s8_ct6:'🪵 LE MINBAR ET L\'ARTISANAT RAFFINÉ',s8_ct7:'📐 SYMBOLES ET SIGNIFICATIONS',s8_ct8:'💡 LUMIÈRE ET ORDRE ACOUSTIQUE',s8_ct9:'🌌 SPLENDEUR SOUS LA COUPOLE',s8_ct10:'🏗️ UN TOURNANT ARCHITECTURAL',s8_ct11:'✨ FINALE ET AU REVOIR',
    s8_c1:'Vous vous trouvez maintenant à l\'intérieur de la mosquée au centre de la Külliye, et nous achevons le finale de notre visite sous cette magnifique coupole.',
    s8_c2:'Le Sultan Bayezid II, fondateur de la Külliye, et les sultans qui lui ont succédé avaient l\'habitude de se rendre à cette mosquée en voyageant le long de la rivière dans d\'ornés bateaux impériaux. Ils entraient par la porte côté rivière et accomplissaient leurs prières dans la galerie royale — le hünkâr mahfili — qui s\'élève sur des colonnes dans le coin gauche de la mosquée.',
    s8_c3:'Fermez les yeux un instant… Imaginez le Sultan, à cette hauteur, adorant dans la même paix aux côtés de la congrégation.',
    s8_c4:'En se souvenant que la première galerie royale jamais construite dans l\'architecture turco-islamique se trouve ici, marchons maintenant vers le mihrab.',
    s8_c5:'Lorsque vous touchez et tournez doucement les pierres d\'équilibre cylindriques de chaque côté du mihrab, vous serez étonné de constater que le sol de cette grande structure ne montre pas le moindre déplacement.',
    s8_c6:'En vous approchant du minbar sur la droite, vous vous émerveiller devant la délicatesse et l\'élégance du travail du marbre.',
    s8_c7:'Je vous suggère maintenant de tourner le dos au mihrab et de regarder au-dessus de la porte d\'entrée. Le motif de plateau avec une pastèque en son centre, positionné directement au-dessus de la porte, symbolise qu\'il y a un imaret dans cette Külliye et que ceux qui viennent ici sont invités à un repas.',
    s8_c8:'Les fenêtres autour de la coupole et dans les rangées inférieures assurent que la lumière est distribuée uniformément dans l\'espace. Cet agencement d\'éclairage, combiné avec l\'acoustique puissante de la mosquée, confère à l\'espace une profondeur visuelle et auditive.',
    s8_c9:'Et maintenant levez les yeux… Regardez attentivement cette magnifique coupole ornée de décorations baroques. Environ 31 mètres de haut et 22 mètres de diamètre, cette coupole — reposant sur quatre murs sans colonnes intermédiaires — est un exemple architecturalement remarquable.',
    s8_c10:'Elle est également considérée comme un important précurseur de la transition vers les structures à coupole unique.',
    s8_c11:'Sous la grâce et la splendeur de cette coupole sans pareille, nous concluons ce voyage où vous avez connecté les traces du passé avec le silence d\'aujourd\'hui — n\'oubliez pas d\'emporter avec vous la paix et l\'émerveillement que ce lieu a laissés dans votre cœur.',
    s8_callout:'🙏 <strong>Mettons-nous un au revoir silencieux à ce voyage spirituel ?</strong>',
    s8_fwd:'VERS L\'AU REVOIR →',
    s9_c1:'🏛️ Nous avons retracé pas à pas les empreintes du passé, respirant ensemble cette magnifique architecture. Il est maintenant temps d\'y ajouter votre propre souffle.',
    s9_c2:'💭 Ce qui résonne en vous… Un moment de paix, une profonde admiration, ou cette note silencieuse qui s\'attarde dans votre cœur…',
    s9_c3:'📖 Le Livre des Visiteurs que nous avons préparé pour vous est une archive spirituelle de cette expérience. Chaque phrase que vous laissez ici sera : un souvenir inestimable pour nous, et une lumière qui donne sens à ce voyage pour nos autres visiteurs.',
    s9_c4:'✨ Partagez avec nous ce qui coule de votre cœur — et laissez votre empreinte demeurer à jamais sur le Pont du Cœur…',
    s9_callout:'✍️ <strong>Nous vous invitons à partager vos sentiments sur notre page du Pont du Cœur.</strong>',
    s9_fwd:'ÉCRIRE AU PONT DU CŒUR →',
    s10_body:'Nous aimerions entendre les impressions que ce voyage de 500 ans à travers notre Külliye a laissées en vous. Vos mots deviendront des pierres de ce pont.',
    s10_restart:'🏛️ RETOUR AU DÉBUT'
  },
   it:{
    start:'INIZIA IL VIAGGIO',intro_title:'Invito alla Soglia',intro_sub:'Un viaggio oltre il tempo, verso il centro della guarigione…',
    back:'← INDIETRO',menu_lang:'Lingua: Italiano 🇮🇹',menu_map:'Mappa e Posizione',menu_defter:'Ponte del Cuore',
    loc_searching:'📍 Ricerca posizione…',loc_outside:'📍 Sei fuori dall\'area del Külliye.',
    loc_error:'📍 Impossibile ottenere la posizione. Abilita i permessi di localizzazione.',
    gb_name:'Il tuo nome',gb_city:'La tua città',gb_msg:'Lascia qui i tuoi sentimenti…',
    gb_submit:'AGGIUNGO LA MIA PIETRA AL PONTE 🪨',gb_submitting:'Sigillando…',
    gb_conn_err:'Errore di connessione. Riprova.',gb_no_msg:'Lascia un messaggio…',
    confirm_text:'I tuoi sentimenti sono stati sigillati sul Ponte del Cuore. La traccia significativa che hai lasciato arricchisce il patrimonio spirituale del nostro Külliye…',
    confirm_close:'POSSIATE GUARIRE 🌿',latest_title:'📜 Messaggi Recenti',archive_title:'🗂️ Archivio',
    no_msg:'Nessun messaggio ancora. Sii il primo ad aggiungere una pietra! ✨',
    s0_main:'🏛️ KÜLLIYE DI SULTAN BAYEZID II',s0_sub:'MUSEO DELLA SALUTE',s0_slogan:'✨ VIAGGIO DI GUARIGIONE — INGRESSO AL MUSEO',
    s1_main:'Ingresso del Darüşşifa',s1_sub:'🏛️ PORTA DELLA GIUSTIZIA E DELLA GUARIGIONE',s1_slogan:'⚖️ PRIMA TAPPA DELLA GUARIGIONE',
    s2_main:'Uscita dalla Sala Presentazioni',s2_sub:'🏛️ DALLA CONOSCENZA ALL\'ESPERIENZA',s2_slogan:'🏛️ AMMINISTRAZIONE E ORDINE',
    s3_main:'La Grande Infermeria (SALA OTTAGONALE)',s3_sub:'🏛️ SOGLIA DEL DARÜŞŞIFA',s3_slogan:'🌊 L\'APICE DELLA GUARIGIONE',
    s4_main:'Scuola di Medicina (Madrasa)',s4_sub:'🎓 CULLA DEL SAPERE',s4_slogan:'📚 LA LUCE DELL\'APPRENDIMENTO',
    s5_main:'Grande Cortile',s5_sub:'🌿 PLATANI PLURICENTENARI',s5_slogan:'🌳 TEMPO E TRANQUILLITÀ',
    s6_main:'Imaret (Mensa Popolare)',s6_sub:'🍲 COMPASSIONE E ABBONDANZA',s6_slogan:'🍲 LA CUCINA DI YAHYA BABA',
    s7_main:'Preparazione a un\'Atmosfera Spirituale',s7_sub:'🕌 INGRESSO ALLA MOSCHEA',s7_slogan:'✨ UNA CUPOLA, PACE INFINITA',
    s8_main:'Viaggio Spirituale all\'Interno della Moschea',s8_sub:'🕌 CORTILE DELLA MOSCHEA',s8_slogan:'🌌 FINALE SOTTO LA CUPOLA',
    s9_main:'Ora di Congedarsi',s9_sub:'🌊 INVITO AL PONTE DEL CUORE',s9_slogan:'✨ LASCIA IL TUO SEGNO IN QUESTA STORIA',
    s10_main:'🖋️ Ponte del Cuore',s10_slogan:'"La guarigione del passato incontra le parole di oggi."',
    nav_back:'← INDIETRO',
    s0_ct1:'👑 STORIA',s0_ct2:'🏗️ STRUTTURA',s0_ct3:'🎧 LA TUA GUIDA',s0_ct4:'📵 ATTENZIONE',s0_ct5:'📍 POSIZIONE',s0_ct6:'🏫 ORIENTAMENTO',
    s0_c1:'Ti trovi ora in uno dei siti storici più affascinanti di Edirne — il Museo della Salute del Külliye di Sultan Bayezid II. Benvenuto in questo luogo dove storia e guarigione si incontrano.',
    s0_c2:'Costruito da Sultan Bayezid II, figlio di Maometto il Conquistatore e 8° Sultano Ottomano, sotto la direzione dell\'architetto capo Hayrettin, questo complesso è il külliye meglio conservato tra tutti i külliyes ottomani. Al suo centro si trova la moschea; a destra l\'ospedale e la madrasa; a sinistra l\'imaret e la dispensa; ai lati della moschea vi sono le foresterie, e dietro di essa un ponte sul fiume Tunca — tutto incarna il modello ottomano di stato sociale.',
    s0_c3:'Ti guiderò attraverso il Külliye e il nostro museo con contenuti scritti, audio e visivi per arricchire la tua visita.',
    s0_c4:'Ti preghiamo di mantenere l\'attenzione sul tuo cellulare durante tutto il tour.',
    s0_c5:'Hai superato la biglietteria e ora ti trovi nel giardino anteriore. Posizionati davanti alla grande fotografia del Külliye appesa alla parete di fronte a te e studia la posizione di queste strutture nella città di Edirne.',
    s0_c6:'Mentre ti avvicini a questo punto, l\'edificio alla tua destra è la Madrasa Medica del Külliye, e l\'edificio direttamente davanti è il Darüşşifa — forse il cuore del Külliye e il centro del nostro museo.',
    s0_callout:'👣 <strong>Dopo aver esaminato la grande fotografia, entra nel giardino del Darüşşifa attraverso la porta immediatamente alla tua sinistra.</strong>',
    s0_fwd:'INIZIA IL VIAGGIO ATTRAVERSO IL TEMPO →',
    s1_ct1:'🏥 DARÜŞŞIFA — 1° CORTILE',s1_ct2:'🌍 IMPORTANZA STORICA',s1_ct3:'🛏️ STANZE DI SERVIZIO',s1_ct4:'🩺 AMBULATORI',s1_ct5:'🧭 INDICAZIONI',s1_ct6:'💧 IL POZZO DEL LATTE',s1_ct7:'🌿 L\'ALBERO E L\'EDERA',s1_ct8:'🎬 SALA PRESENTAZIONI',
    s1_c1:'Ti trovi ora nel primo cortile del Darüşşifa di Edirne, uno dei più importanti centri di guarigione dell\'Impero Ottomano. Fermati un momento e osserva ciò che ti circonda.',
    s1_c2:'Prima di tutto, sappi che questo edificio è riconosciuto come uno dei primi esempi di ospedale progettato centralmente e con grande cura nella storia. Le controparti occidentali apparvero solo circa 200 anni dopo — qui, le aree di trattamento e servizio furono realizzate con una visione architettonica molto avanti rispetto ai tempi.',
    s1_c3:'Procedendo lungo il percorso davanti a te, le quattro stanze immediatamente alla sinistra dell\'ingresso sono le unità di servizio del Darüşşifa: una stanza del personale, una lavanderia, una cucina dietetica e una dispensa per conservare le provviste.',
    s1_c4:'Alla tua destra, dietro le colonne, si trovano sei ambulatori dove venivano effettuate visite quotidiane, cure e interventi d\'emergenza. Negli anni della fondazione, una di queste stanze era riservata ai medici oculisti conosciuti come "kehhal".',
    s1_c5:'Lascia la visita dettagliata di queste stanze — allestite con esposizioni e pannelli informativi — per il tuo ritorno, e lascia che ora ti guidi verso la nostra sala presentazioni. Si trova oltre il primo cortile, a sinistra. Mentre cammini, nota il pozzo alla tua sinistra.',
    s1_c6:'Questa struttura in pietra è chiamata "Pozzo del Latte", poiché si credeva che la sua acqua aumentasse la produzione di latte nelle neomamme. Circa 20 metri più avanti, tra l\'erba, vedrai un albero con dell\'edera avvolta intorno ad esso.',
    s1_c7:'Quando raggiungi quel punto, assicurati di leggere la malinconica poesia d\'amore scritta da Ahmet Kutsi Tecer su quell\'albero, esposta su un pannello nell\'erba. Poi guarda di nuovo l\'albero e l\'edera, con quel sentimento nel cuore.',
    s1_c8:'Appena dopo la poesia, immediatamente alla tua sinistra, si trova la nostra sala presentazioni. Qui puoi guardare un video sulla storia e lo sviluppo del Külliye e del Darüşşifa, acquisendo una comprensione completa dell\'importanza di questo luogo nella storia della medicina e dell\'architettura.',
    s1_callout:'🎬 <strong>Vuoi guardare il video della presentazione?</strong> Puoi guardarlo nella sala presentazioni o toccare il pulsante qui sotto per vederlo sul tuo telefono.',
    s1_watch:'GUARDA LA PRESENTAZIONE ▶',s1_fwd:'VERSO LA SALA PRESENTAZIONI →',
    s2_ct1:'🚪 INGRESSO AL 2° CORTILE',s2_ct2:'🏛️ STANZE AMMINISTRATIVE',s2_ct3:'🔒 SEZIONE AMMINISTRATIVA',s2_ct4:'✨ ISCRIZIONE E INGRESSO',
    s2_c1:'Non appena esci dalla sala presentazioni, passa attraverso la grande porta immediatamente alla tua sinistra nel secondo cortile, dove si trovano gli uffici amministrativi.',
    s2_c2:'In questo cortile ci sono 4 stanze — due per lato. Il medico capo e gli altri dottori usavano queste stanze; tutte le operazioni ospedaliere erano pianificate e gestite qui. Negli anni della fondazione, questo Darüşşifa aveva 1 medico capo, due dottori, 2 chirurghi, 2 oculisti e 1 farmacista.',
    s2_c3:'Questa sezione amministrativa fungeva anche da barriera protettiva tra il flusso quotidiano di pazienti nel primo cortile e il reparto di degenza che stai per entrare.',
    s2_c4:'Ora leggi l\'iscrizione scritta sopra la porta, poi trattieni il respiro…',
    s2_callout:'🚶‍♂️ <strong>Entra in questo luogo magico dove musica e suono dell\'acqua si incontrano con la guarigione.</strong>',
    s2_fwd:'SCOPRI LA GRANDE INFERMERIA →',
    s3_ct1:'🏥 REPARTO DI DEGENZA',s3_ct2:'🌊 STRUTTURA OSPEDALIERA',s3_ct3:'🎵 MUSICOTERAPIA',s3_ct4:'💧 IDROTERAPIA',s3_ct5:'🌿 AROMATERAPIA',s3_ct6:'🧺 TERAPIA OCCUPAZIONALE',s3_ct7:'🚶 USCITA E TOUR',
    s3_c1:'Ti trovi ora nel cuore del nostro museo e nel reparto di degenza del Darüşşifa di Edirne. Cammina in questo spazio con il sentimento di coloro che trovarono guarigione qui 500 anni fa.',
    s3_c2:'Immagina un ospedale dove sei accolto da una fontana che scorre ritmicamente al centro, e un palcoscenico musicale direttamente di fronte. Questo ospedale a pianta centrale, coperto da un\'ampia cupola, è composto da 6 stanze per pazienti invernali, 4 stanze per pazienti estivi e un palcoscenico musicale. Il lanternino nella cupola ventila anche l\'aria viziata verso l\'esterno. Il pavimento inclinato e i canali sottostanti facilitano il lavaggio e la pulizia.',
    s3_c3:'Ciò che distingueva questo ospedale dagli altri era l\'uso di modi musicali nel trattamento insieme alle conoscenze mediche contemporanee. Un ensemble musicale di 10 esecutori suonava e cantava modi diversi per malattie diverse, come raccomandato dai medici — ritenuto benefico per varie condizioni.',
    s3_c4:'Il suono dell\'acqua che scorre dalla fontana al centro dell\'edificio era una parte importante del trattamento, mirato a calmare e rasserenare i pazienti.',
    s3_c5:'Oltre alla musica e ai suoni dell\'acqua, nel Darüşşifa veniva praticata anche l\'aromaterapia. I profumi di varie piante coltivate nel cortile e nei dintorni erano parte integrante del processo di guarigione.',
    s3_c6:'La terapia occupazionale era utilizzata anche come metodo di trattamento qui. I pazienti erano impegnati nella tessitura di cesti, nel lavoro a maglia e in vari artigianati per distrarli dalle loro preoccupazioni e pensieri.',
    s3_c7:'Dopo aver visitato le stanze che mostrano diversi aspetti della medicina ottomana, puoi uscire dal reparto di degenza. Mentre lasci questo luogo di guarigione — che ha funzionato ininterrottamente per 400 anni — puoi anche visitare le altre stanze nel secondo e nel primo cortile per saperne di più sul Darüşşifa e sulla medicina ottomana.',
    s3_callout:'🏫 <strong>VERSO LA MADRASA MEDICA:</strong> Esci dal Darüşşifa e cammina verso la Madrasa Medica, situata a sinistra del giardino d\'ingresso con la grande fotografia.',
    s3_fwd:'AVANTI VERSO LA MADRASA →',
    s4_ct1:'🏫 LA MADRASA MEDICA',s4_ct2:'🌍 IMPORTANZA STORICA',s4_ct3:'📚 SISTEMA EDUCATIVO',s4_ct4:'🏛️ STRUTTURA ARCHITETTONICA',s4_ct5:'📜 EVLIYA ÇELEBİ',s4_ct6:'👨‍🏫 PERSONALE DOCENTE',s4_ct7:'📖 MANOSCRITTI',s4_ct8:'🏥 MUSEO DELLA SALUTE',
    s4_c1:'Hai visitato il Darüşşifa e ora sei entrato in un\'altra sezione cruciale del Külliye — la Madrasa Medica di Sultan Bayezid II. Prima di entrare nelle stanze del museo sui lati destro e opposto, fermati e studia questo spazio unico.',
    s4_c2:'Quello che vedi ora come un edificio disposto attorno a un cortile quadrato era una delle più prestigiose istituzioni educative che formavano medici nell\'Impero Ottomano — un importante centro di apprendimento che ha prodotto molti medici illustri nel corso dei secoli.',
    s4_c3:'Classificata tra le madrasa di più alto livello "con valutazione di 60 e oltre" nel sistema educativo ottomano, gli studenti qui potevano applicare la loro formazione teorica nel Darüşşifa adiacente, consolidando le loro conoscenze con la pratica.',
    s4_c4:'La madrasa — con una fontana (non più esistente) al suo centro e un pozzo nell\'angolo per l\'approvvigionamento idrico — è composta da 18 stanze per studenti disposte su tre lati e un\'aula direttamente di fronte.',
    s4_c5:'Evliya Çelebi, che visitò il Külliye nel 1652, scrisse di questa madrasa: "Nella Madrasa Medica e nelle sue stanze vi sono studenti che parlano costantemente di studiosi come Platone, Socrate, Aristotele, Galeno e Pitagora — ognuno un medico maturo. Ognuno dedito a una branca del sapere, affidandosi a libri preziosi nell\'arte della medicina, sforzandosi di trovare rimedi per i mali dell\'umanità."',
    s4_c6:'Il personale docente includeva un professore che guadagnava 60 akçe al giorno insegnando a 18 studenti, un professore assistente, un bibliotecario e due servitori. Tutti i bisogni degli studenti erano soddisfatti, e ricevevano anche una borsa di studio giornaliera di due akçe.',
    s4_c7:'38 manoscritti medici scritti a mano studiati qui — molti recanti i sigilli dei sultani ottomani — sono sopravvissuti fino ad oggi. Questi preziosi lavori sono ora conservati presso la Biblioteca dei Manoscritti di Selimiye.',
    s4_c8:'La madrasa è stata aperta dall\'Università della Tracia nel 2007 come seconda sezione del Museo della Salute. Le sue stanze narrano l\'educazione medica dell\'epoca. La sezione più importante è l\'aula, direttamente di fronte all\'ingresso.',
    s4_callout:'🚶 <strong>Dopo aver visitato le stanze degli studenti, le stanze di addestramento applicato, la stanza del professore, l\'aula e la biblioteca — disposte per riflettere l\'atmosfera del XV secolo con manichini — esci dalla madrasa e procedi attraverso il tornello vicino all\'uscita del Darüşşifa verso il cortile della moschea per continuare verso l\'Imaret.</strong>',
    s4_fwd:'VERSO LA GRANDIOSITÀ DELLA MOSCHEA →',
    s5_ct1:'🌳 NEL GIARDINO',s5_ct2:'💧 SCALA IDRICA',s5_ct3:'🕌 PORTALE PRINCIPALE DELLA MOSCHEA',s5_ct4:'🏛️ DISPENSA E IMARET',
    s5_c1:'Dopo aver visitato il Darüşşifa e la Madrasa, sei entrato nel giardino della moschea. Cammina lentamente in questo bellissimo giardino di platani pluricentenari, dirigendoti verso la sezione Imaret del museo direttamente davanti a te.',
    s5_c2:'Mentre entri nel giardino dal Darüşşifa, la prima cosa da notare alla tua destra — all\'angolo della moschea — è una struttura rettangolare in pietra alta circa 4 metri. Questa è la scala idrica del Külliye. L\'acqua portata da tubi provenienti da colline elevate aveva prima la sua pressione bilanciata all\'interno di questa struttura prima di essere distribuita alle altre unità del Külliye.',
    s5_c3:'Dopo aver superato la scala idrica, sarai accolto dal magnifico portale d\'ingresso principale della moschea alla tua destra. Lasciamo per la fine del nostro tour l\'esplorazione del cortile della moschea attraverso questo portale, e continuiamo la nostra passeggiata verso l\'Imaret.',
    s5_c4:'Davanti a te, due grandi edifici di architettura simile si trovano fianco a fianco. Quello a sinistra contiene la dispensa e la sezione del forno, ora usato per eventi scientifici e culturali del museo. Quello a destra è l\'Imaret verso cui ti sto ora dirigendo.',
    s5_callout:'🍲 <strong>Sei pronto a scoprire la cultura ottomana dell\'imaret e ascoltare la leggenda del Cuoco Yahya Baba? Allora mostra il tuo biglietto al tornello e entra in questa sezione, poi tocca la prossima tappa per continuare.</strong>',
    s5_fwd:'AL CUORE DELL\'ABBONDANZA →',
    s6_ct1:'🏛️ GLI IMARET',s6_ct2:'🍲 L\'IMARET DI SULTAN BAYEZID II',s6_ct3:'🔥 CUCINA E SALA DA PRANZO',s6_ct4:'🎭 QUESTA SEZIONE DEL MUSEO',s6_ct5:'🌿 LA TOMBA DI YAHYA BABA',s6_ct6:'📖 LA LEGGENDA DI YAHYA BABA',s6_ct7:'⚖️ IL TEST DEL GUARDIANO DELLA DISPENSA',s6_ct8:'👑 IL TESTIMONE DEL SULTANO',s6_ct9:'🐟 IL MIRACOLO DEL PESCE',s6_ct10:'🤲 LA MORTE DI YAHYA BABA',s6_ct11:'🪦 VISITA ALLA TOMBA',
    s6_c1:'Nell\'Impero Ottomano, gli imaret erano tra le istituzioni più importanti che incarnavano lo spirito di solidarietà sociale e carità. Fungendo da mense popolari che distribuivano cibo gratuito ai poveri, ai viaggiatori, agli studenti e ai bisognosi, queste strutture non erano semplicemente cucine — erano centri vitali che proteggevano i membri più vulnerabili della società e mantenevano l\'equilibrio sociale.',
    s6_c2:'E ora ti trovi esattamente in un posto simile. L\'imaret del Külliye di Sultan Bayezid II, istituito come terza sezione del Museo della Salute, era un\'importante istituzione caritatevole dove — secondo il suo statuto — venivano cucinati e distribuiti tre pasti al giorno ai poveri.',
    s6_c3:'L\'ampio spazio che incontri all\'ingresso è la cucina dove il cibo veniva cucinato in grandi calderoni. La grande sala che vedi attraverso la porta immediatamente alla tua destra è dove i pasti venivano consumati ai tavoli sul pavimento in pietra.',
    s6_c4:'Come le altre sezioni del Museo della Salute, questa sezione è animata con manichini adatti allo spirito del luogo, narrando la cultura ottomana dell\'imaret e portando i visitatori in un viaggio nel tempo. Qui sono esposti anche vasi di rame originali, mortai e vasi di conservazione dell\'epoca.',
    s6_c5:'Immediatamente dietro l\'imaret si trova la Tomba del Cuoco Yahya Baba, una figura leggendaria. Mentre esplori questo interessante e spazioso edificio, lasciami raccontare la leggenda del Cuoco Yahya Baba sopravvissuta fino ad oggi.',
    s6_c6:'Secondo la storia, Yahya Baba, il cuoco capo durante il regno del fondatore del Külliye Sultan Bayezid II, preparava un riso pilaf eccezionalmente delizioso. Mentre mescolava il pilaf pregava costantemente, e quando chiudeva il coperchio diceva "Dona abbondanza, o Signore." Il pilaf era così abbondante da sfamare tutti i pazienti e avanzarne ancora. Yahya Baba non buttava mai via il pilaf in eccesso — lo portava a nutrire i pesci nel fiume Tunca.',
    s6_c7:'Quando il guardiano della dispensa si accorse che Yahya Baba stava dando il pilaf in eccesso al fiume, cominciò a ridurre giorno dopo giorno la quantità di riso che gli veniva consegnata. Eppure anche con meno riso, Yahya Baba cucinava il pilaf con preghiera, sfamando sia i pazienti che i pesci. Alla fine il riso assegnato fu ridotto a una sola manciata. Tuttavia il pilaf di Yahya Baba sfamava ancora tutti i pazienti, e riusciva ancora a mettere da parte una porzione per i pesci.',
    s6_c8:'La notizia raggiunse eventualmente il Sultano. Decidendo di assistere personalmente alla faccenda, il Sultano arrivò sulla riva del fiume Tunca prima di Yahya Baba e si nascose. Mentre Yahya Baba stava per tornare dopo aver nutrito i pesci, il Sultano uscì dal nascondiglio e tuonò: "Tu là — stai versando le provviste dei pazienti nel fiume?"',
    s6_c9:'Yahya Baba rimase pietrificato. Non riusciva a dire nulla. Era così sopraffatto dalla vergogna che si prostrò e cercò rifugio in Dio. Ma i pesci, alzando le teste dall\'acqua, parlarono: "Il grande Sultano invidia ai pesci il loro sostentamento?"',
    s6_c10:'Il Sultano, rendendosi conto del suo errore con stupore e dolore, aspettò che Yahya Baba alzasse la testa dalla prostrazione — ma invano. Quest\'uomo benevolente aveva già consegnato la sua anima…',
    s6_c11:'La tomba di Yahya Baba, situata appena dietro l\'imaret, è visitata come il santuario di un santo dai passanti che vengono a pregare. Specialmente il venerdì, questa tomba è piena di visitatori.',
    s6_callout:'🪦 <strong>FORESTERIE:</strong> Dopo aver ascoltato questa leggenda, è tempo di uscire dall\'imaret e riposarsi al caffè del museo a sinistra. Nel caffè del museo all\'interno della foresteria del Külliye, puoi gustare il tè e soprattutto uno sherbet ottomano, acquistare regali e libri, visitare la biblioteca del museo, e poi procedere verso la tappa finale — il cortile della Moschea. Facciamo una breve pausa alla Foresteria del Külliye?',
    s6_fwd:'VERSO IL CAFFÈ DEL MUSEO →',
    s7_ct1:'🏛️ CORTILE E INGRESSO ALLA MOSCHEA',s7_ct2:'🚪 INGRESSO E ATMOSFERA',s7_ct3:'⛲ LA FONTANA E LA SERENITÀ',s7_ct4:'🏛️ COLONNE DI MARMO E ARMONIA ARCHITETTONICA',s7_ct5:'✨ PACE INTERIORE E TRANQUILLITÀ',s7_ct6:'👁️ MOMENTI DI OSSERVAZIONE',s7_ct7:'🚪 INGRESSO ALLA MOSCHEA',s7_ct8:'🪵 L\'ARTIGIANATO KÜNDEKÂRI',
    s7_c1:'Hai visitato le sezioni del nostro Museo della Salute e assaporato il rinfrescante sherbet ottomano al caffè. Ora è il momento di incontrare una delle strutture più magnifiche del Külliye — la moschea.',
    s7_c2:'Mentre entri attraverso l\'elegante porta laterale che si apre sul cortile, o attraverso il grande portale principale, sei accolto dalla raffinata lavorazione del marmo. In un istante, lasci alle spalle il trambusto del mondo esterno e scivoli in un\'atmosfera completamente diversa.',
    s7_c3:'La fontana al centro del cortile riempie lo spazio di pace attraverso il calmo suono dell\'acqua. Questo suono, combinato con il silenzio della pietra, ti rallenta e ti rende consapevole del momento presente.',
    s7_c4:'Le colonne di marmo che ti circondano si innalzano come un anello protettivo. Scelte in colori diversi, incarnano l\'eleganza e la ricchezza armoniosa dell\'estetica ottomana.',
    s7_c5:'Ciò che senti qui non è semplicemente bellezza architettonica — è una tranquillità, una pace interiore rimasta immutata per secoli.',
    s7_c6:'Fermati brevemente alla fontana e osserva questa semplice ma suggestiva disposizione del cortile. Senti l\'armonia che colonne, archi e raffinati ornamenti creano tra loro.',
    s7_c7:'Poi volgiti verso il magnifico portale che si innalza direttamente davanti a te. Apri delicatamente la tenda di cuoio che copre la porta e entra. Sentirai immediatamente di essere entrato in una delle moschee più eleganti del nostro paese.',
    s7_c8:'Mentre entri, non dimenticare di prestare attenzione all\'originale lavorazione kündekâri in legno sopra la porta — e se possibile, senti la texture di questo squisito artigianato.',
    s7_callout:'🕌 <strong>Entriamo nel grande spazio e nella tranquillità all\'interno del santuario?</strong>',
    s7_fwd:'PROCEDI ALL\'INTERNO →',
    s8_ct1:'🕌 ALL\'INTERNO DELLA MOSCHEA — IL FINALE',s8_ct2:'🚤 TRASPORTO STORICO E TRADIZIONE REALE',s8_ct3:'👑 IMMAGINARE LA GALLERIA REALE',s8_ct4:'🏛️ LA GALLERIA REALE E LE SUE PRIME VOLTE',s8_ct5:'⚙️ IL MIHRAB E LE PIETRE D\'EQUILIBRIO',s8_ct6:'🪵 IL MINBAR E LA RAFFINATA LAVORAZIONE',s8_ct7:'📐 SIMBOLI E SIGNIFICATI',s8_ct8:'💡 ORDINE DI LUCE E ACUSTICA',s8_ct9:'🌌 SPLENDORE SOTTO LA CUPOLA',s8_ct10:'🏗️ UN PUNTO DI SVOLTA ARCHITETTONICO',s8_ct11:'✨ FINALE E ADDIO',
    s8_c1:'Ti trovi ora all\'interno della moschea al centro del Külliye, e stiamo completando il finale del nostro tour sotto questa magnifica cupola.',
    s8_c2:'Sultan Bayezid II, il fondatore del Külliye, e i sultani che lo seguirono solevano arrivare a questa moschea viaggiando lungo il fiume su ornate imbarcazioni imperiali. Entravano attraverso la porta sul lato del fiume e pregavano nella galleria reale — l\'hünkâr mahfili — che si eleva su colonne nell\'angolo sinistro della moschea.',
    s8_c3:'Chiudi gli occhi per un momento… Immagina il Sultano, a quell\'altezza, che prega con la stessa pace insieme alla congregazione.',
    s8_c4:'Ricordando che la prima galleria reale mai costruita nell\'architettura turco-islamica si trova qui, camminiamo ora verso il mihrab.',
    s8_c5:'Quando tocchi e giri delicatamente le pietre d\'equilibrio cilindriche su entrambi i lati del mihrab, ti stupirai nel trovare che il suolo di questa grande struttura non mostra il minimo cedimento.',
    s8_c6:'Avvicinandoti al minbar sulla destra, ti meraviglierai della delicatezza ed eleganza della lavorazione in marmo.',
    s8_c7:'Ora ti suggerisco di dare le spalle al mihrab e guardare sopra la porta d\'ingresso. Il motivo del vassoio con un\'anguria al centro, posizionato direttamente sopra la porta, simboleggia che in questo Külliye c\'è un imaret e che coloro che vengono qui sono invitati a un pasto.',
    s8_c8:'Le finestre intorno alla cupola e nelle file inferiori assicurano che la luce sia distribuita uniformemente in tutto lo spazio. Questa disposizione dell\'illuminazione, combinata con la potente acustica della moschea, conferisce allo spazio profondità sia visiva che uditiva.',
    s8_c9:'E ora alza lo sguardo verso l\'alto… Guarda attentamente questa magnifica cupola adornata con decorazioni barocche. Alta circa 31 metri e con un diametro di 22 metri, questa cupola — che poggia su quattro pareti senza colonne intermedie — è un esempio architettonicamente notevole.',
    s8_c10:'È anche considerata un\'importante precorritrice della transizione verso le strutture a cupola singola.',
    s8_c11:'Sotto la grazia e lo splendore di questa cupola ineguagliabile, concludiamo questo viaggio in cui hai collegato le tracce del passato con il silenzio di oggi — non dimenticare di portare con te la pace e la meraviglia che questo luogo ha lasciato nel tuo cuore.',
    s8_callout:'🙏 <strong>Mettiamo un tranquillo addio su questo viaggio spirituale?</strong>',
    s8_fwd:'VERSO IL CONGEDO →',
    s9_c1:'🏛️ Abbiamo tracciato passo dopo passo le impronte del passato, respirando insieme questa magnifica architettura. Ora è il momento di aggiungere il tuo stesso respiro a questo luogo storico.',
    s9_c2:'💭 Ciò che risuona dentro di te… Un momento di pace, una profonda ammirazione, o quella nota silenziosa che indugia nel tuo cuore…',
    s9_c3:'📖 Il Libro dei Visitatori che abbiamo preparato per te è un archivio spirituale di questa esperienza. Ogni frase che lasci qui sarà: un ricordo inestimabile per noi, e una luce che dà significato a questo viaggio per i nostri altri ospiti.',
    s9_c4:'✨ Condividi con noi ciò che fluisce dal tuo cuore — e lascia che il tuo segno rimanga per sempre sul Ponte del Cuore…',
    s9_callout:'✍️ <strong>Ti invitiamo a condividere i tuoi sentimenti sulla nostra pagina del Ponte del Cuore.</strong>',
    s9_fwd:'SCRIVI AL PONTE DEL CUORE →',
    s10_body:'Ci piacerebbe sentire le impressioni che questo viaggio di 500 anni nel nostro Külliye ha lasciato su di te. Le tue parole diventeranno pietre di questo ponte.',
    s10_restart:'🏛️ TORNA ALL\'INIZIO'
  },
  es:{
    start:'COMENZAR EL VIAJE',intro_title:'Invitación al Umbral',intro_sub:'Un viaje más allá del tiempo, hacia el centro de la sanación…',
    back:'← ATRÁS',menu_lang:'Idioma: Español 🇪🇸',menu_map:'Mapa y Ubicación',menu_defter:'Puente del Corazón',
    loc_searching:'📍 Obteniendo ubicación…',loc_outside:'📍 Estás fuera del área del Külliye.',
    loc_error:'📍 No se pudo obtener la ubicación. Activa el permiso de localización.',
    gb_name:'Tu nombre',gb_city:'Tu ciudad',gb_msg:'Deja aquí tus sentimientos…',
    gb_submit:'AÑADO MI PIEDRA AL PUENTE 🪨',gb_submitting:'Sellando…',
    gb_conn_err:'Error de conexión. Por favor, inténtalo de nuevo.',gb_no_msg:'Por favor, deja una nota…',
    confirm_text:'Tus sentimientos han sido sellados en el Puente del Corazón. La huella significativa que has dejado enriquece el patrimonio espiritual de nuestro Külliye…',
    confirm_close:'QUE TE SANES 🌿',latest_title:'📜 Mensajes Recientes',archive_title:'🗂️ Archivo',
    no_msg:'Aún no hay mensajes. ¡Sé el primero en añadir una piedra! ✨',
    s0_main:'🏛️ KÜLLIYE DEL SULTÁN BAYEZID II',s0_sub:'MUSEO DE LA SALUD',s0_slogan:'✨ VIAJE DE SANACIÓN — ENTRADA AL MUSEO',
    s1_main:'Entrada del Darüşşifa',s1_sub:'🏛️ PUERTA DE LA JUSTICIA Y LA SANACIÓN',s1_slogan:'⚖️ PRIMERA PARADA DE LA SANACIÓN',
    s2_main:'Salida de la Sala de Presentaciones',s2_sub:'🏛️ DEL CONOCIMIENTO A LA EXPERIENCIA',s2_slogan:'🏛️ ADMINISTRACIÓN Y ORDEN',
    s3_main:'La Gran Enfermería (SALA OCTAGONAL)',s3_sub:'🏛️ UMBRAL DEL DARÜŞŞIFA',s3_slogan:'🌊 EL PINÁCULO DE LA SANACIÓN',
    s4_main:'Escuela de Medicina (Madrasa)',s4_sub:'🎓 CUNA DEL SABER',s4_slogan:'📚 LA LUZ DEL APRENDIZAJE',
    s5_main:'Gran Patio',s5_sub:'🌿 PLÁTANOS CENTENARIOS',s5_slogan:'🌳 TIEMPO Y TRANQUILIDAD',
    s6_main:'Imaret (Comedor Popular)',s6_sub:'🍲 COMPASIÓN Y ABUNDANCIA',s6_slogan:'🍲 LA COCINA DE YAHYA BABA',
    s7_main:'Preparación para una Atmósfera Espiritual',s7_sub:'🕌 ENTRADA A LA MEZQUITA',s7_slogan:'✨ UNA CÚPULA, PAZ INFINITA',
    s8_main:'Viaje Espiritual dentro de la Mezquita',s8_sub:'🕌 PATIO DE LA MEZQUITA',s8_slogan:'🌌 FINAL BAJO LA CÚPULA',
    s9_main:'Hora de Despedirse',s9_sub:'🌊 INVITACIÓN AL PUENTE DEL CORAZÓN',s9_slogan:'✨ DEJA TU HUELLA EN ESTA HISTORIA',
    s10_main:'🖋️ Puente del Corazón',s10_slogan:'"La sanación del pasado se encuentra con las palabras de hoy."',
    nav_back:'← ATRÁS',
    s0_ct1:'👑 HISTORIA',s0_ct2:'🏗️ ESTRUCTURA',s0_ct3:'🎧 TU GUÍA',s0_ct4:'📵 ATENCIÓN',s0_ct5:'📍 UBICACIÓN',s0_ct6:'🏫 ORIENTACIÓN',
    s0_c1:'Ahora te encuentras en uno de los sitios históricos más cautivadores de Edirne — el Museo de la Salud del Külliye del Sultán Bayezid II. Bienvenido a este lugar donde la historia y la sanación se encuentran.',
    s0_c2:'Construido por el Sultán Bayezid II, hijo de Mehmed el Conquistador y 8° Sultán Otomano, bajo la dirección del arquitecto jefe Hayrettin, este complejo es el külliye mejor conservado entre todos los külliyes otomanos. En su centro se encuentra la mezquita; a la derecha el hospital y la madrasa; a la izquierda el imaret y la despensa; adosadas a los lados de la mezquita hay casas de huéspedes, y detrás de ella un puente sobre el río Tunca — todo encarna el modelo otomano de estado social.',
    s0_c3:'Te guiaré por el Külliye y nuestro museo con contenido escrito, de audio y visual para enriquecer tu visita.',
    s0_c4:'Por favor, mantén la atención en tu teléfono móvil durante todo el recorrido.',
    s0_c5:'Has pasado la taquilla y ahora estás en el jardín delantero. Colócate frente a la gran fotografía del Külliye colgada en la pared frente a ti y estudia la ubicación de estas estructuras dentro de la ciudad de Edirne.',
    s0_c6:'Mientras caminas hacia este punto, el edificio a tu derecha es la Madrasa Médica del Külliye, y el edificio directamente frente a ti es el Darüşşifa — quizás el corazón del Külliye y el centro de nuestro museo.',
    s0_callout:'👣 <strong>Tras examinar la gran fotografía, entra al jardín del Darüşşifa por la puerta inmediatamente a tu izquierda.</strong>',
    s0_fwd:'COMENZAR EL VIAJE A TRAVÉS DEL TIEMPO →',
    s1_ct1:'🏥 DARÜŞŞIFA — 1.er PATIO',s1_ct2:'🌍 IMPORTANCIA HISTÓRICA',s1_ct3:'🛏️ HABITACIONES DE SERVICIO',s1_ct4:'🩺 CONSULTORIOS',s1_ct5:'🧭 INDICACIONES',s1_ct6:'💧 EL POZO DE LA LECHE',s1_ct7:'🌿 EL ÁRBOL Y LA HIEDRA',s1_ct8:'🎬 SALA DE PRESENTACIONES',
    s1_c1:'Ahora te encuentras en el primer patio del Darüşşifa de Edirne, uno de los centros de sanación más importantes del Imperio Otomano. Detente un momento y observa tu entorno.',
    s1_c2:'En primer lugar, ten en cuenta que este edificio está reconocido como uno de los primeros ejemplos de hospital planificado de forma centralizada y meticulosa en la historia. Sus homólogos occidentales aparecieron unos 200 años después — aquí, las áreas de tratamiento y servicio se realizaron con una visión arquitectónica muy adelantada a su tiempo.',
    s1_c3:'Mientras avanzas por el camino frente a ti, las cuatro habitaciones inmediatamente a la izquierda de la entrada son las unidades de servicio del Darüşşifa: una sala de personal, una lavandería, una cocina dietética y una despensa para almacenar provisiones.',
    s1_c4:'A tu derecha, detrás de las columnas, hay seis consultorios donde se realizaban exámenes diarios de pacientes, cuidados e intervenciones de emergencia. En los años fundacionales, una de estas salas estaba reservada para los médicos oculistas conocidos como "kehhal".',
    s1_c5:'Deja la visita detallada de estas salas — dispuestas con exposiciones y paneles informativos — para tu regreso, y déjame guiarte ahora hacia nuestra sala de presentaciones. Se encuentra pasado el primer patio, a la izquierda. Mientras caminas, observa el pozo a tu izquierda.',
    s1_c6:'Esta estructura de piedra se llama "Pozo de la Leche", ya que se creía que su agua aumentaba la producción de leche en las madres lactantes. Unos 20 metros más adelante, entre la hierba, verás un árbol con hiedra enredada a su alrededor.',
    s1_c7:'Cuando llegues a ese lugar, asegúrate de leer el melancólico poema de amor escrito por Ahmet Kutsi Tecer sobre ese árbol, expuesto en un panel entre la hierba. Luego mira de nuevo el árbol y la hiedra, con ese sentimiento en el corazón.',
    s1_c8:'Justo después del poema, inmediatamente a tu izquierda, está nuestra sala de presentaciones. Aquí puedes ver un vídeo sobre la historia y el desarrollo del Külliye y el Darüşşifa, adquiriendo una comprensión completa de la importancia de este lugar en la historia de la medicina y la arquitectura.',
    s1_callout:'🎬 <strong>¿Te gustaría ver el vídeo de presentación?</strong> Puedes verlo en la sala de presentaciones o pulsar el botón de abajo para verlo en tu teléfono.',
    s1_watch:'VER PRESENTACIÓN ▶',s1_fwd:'HACIA LA SALA DE PRESENTACIONES →',
    s2_ct1:'🚪 ENTRADA AL 2.º PATIO',s2_ct2:'🏛️ SALAS ADMINISTRATIVAS',s2_ct3:'🔒 SECCIÓN ADMINISTRATIVA',s2_ct4:'✨ INSCRIPCIÓN Y ENTRADA',
    s2_c1:'Nada más salir de la sala de presentaciones, pasa por la gran puerta inmediatamente a tu izquierda hacia el segundo patio, donde se encuentran las oficinas administrativas.',
    s2_c2:'En este patio hay 4 salas — dos a cada lado. El médico jefe y los demás doctores utilizaban estas salas; todas las operaciones hospitalarias se planificaban y gestionaban aquí. En los años fundacionales, este Darüşşifa contaba con 1 médico jefe, dos doctores, 2 cirujanos, 2 oculistas y 1 farmacéutico.',
    s2_c3:'Esta sección administrativa también servía como barrera protectora entre el flujo diario de pacientes en el primer patio y el área de hospitalización que estás a punto de entrar.',
    s2_c4:'Ahora lee la inscripción escrita sobre la puerta, luego contén el aliento…',
    s2_callout:'🚶‍♂️ <strong>Adéntrate en este lugar mágico donde la música y el sonido del agua se encuentran con la sanación.</strong>',
    s2_fwd:'DESCUBRE LA GRAN ENFERMERÍA →',
    s3_ct1:'🏥 ÁREA DE HOSPITALIZACIÓN',s3_ct2:'🌊 ESTRUCTURA HOSPITALARIA',s3_ct3:'🎵 MUSICOTERAPIA',s3_ct4:'💧 HIDROTERAPIA',s3_ct5:'🌿 AROMATERAPIA',s3_ct6:'🧺 TERAPIA OCUPACIONAL',s3_ct7:'🚶 SALIDA Y RECORRIDO',
    s3_c1:'Ahora te encuentras en el corazón de nuestro museo y en el área de hospitalización del Darüşşifa de Edirne. Camina por este espacio con el sentimiento de quienes encontraron sanación aquí hace 500 años.',
    s3_c2:'Imagina un hospital donde eres recibido por una fuente que fluye rítmicamente en el centro, y un escenario musical directamente frente a ella. Este hospital de planta central, cubierto por una amplia cúpula, consta de 6 habitaciones para pacientes de invierno, 4 habitaciones para pacientes de verano y un escenario musical. El tragaluz de la cúpula también ventila el aire viciado hacia el exterior. El suelo inclinado y los canales inferiores facilitan el lavado y la limpieza.',
    s3_c3:'Lo que distinguía a este hospital de los demás era el uso de modos musicales en el tratamiento junto con los conocimientos médicos contemporáneos. Un conjunto musical de 10 intérpretes tocaba y cantaba diferentes modos para diferentes enfermedades, según las recomendaciones de los médicos — considerado beneficioso para diversas afecciones.',
    s3_c4:'El sonido del agua que fluía desde la fuente en el centro del edificio era una parte importante del tratamiento, destinada a calmar y tranquilizar a los pacientes.',
    s3_c5:'Además de la música y los sonidos del agua, en el Darüşşifa también se practicaba la aromaterapia. Los aromas de diversas plantas cultivadas en el patio y sus alrededores eran parte integral del proceso de sanación.',
    s3_c6:'La terapia ocupacional también se utilizaba como método de tratamiento aquí. Los pacientes se dedicaban a la cestería, el tejido y diversas artesanías para distraerlos de sus preocupaciones y pensamientos.',
    s3_c7:'Tras recorrer las salas que muestran diferentes aspectos de la medicina otomana, puedes salir del área de hospitalización. Al abandonar este lugar de sanación — que funcionó ininterrumpidamente durante 400 años — también puedes visitar las demás salas del segundo y primer patio para saber más sobre el Darüşşifa y la medicina otomana.',
    s3_callout:'🏫 <strong>HACIA LA MADRASA MÉDICA:</strong> Sal del Darüşşifa y camina hacia la Madrasa Médica, situada a la izquierda del jardín de entrada con la gran fotografía.',
    s3_fwd:'ADELANTE HACIA LA MADRASA →',
    s4_ct1:'🏫 LA MADRASA MÉDICA',s4_ct2:'🌍 IMPORTANCIA HISTÓRICA',s4_ct3:'📚 SISTEMA EDUCATIVO',s4_ct4:'🏛️ ESTRUCTURA ARQUITECTÓNICA',s4_ct5:'📜 EVLIYA ÇELEBİ',s4_ct6:'👨‍🏫 PERSONAL DOCENTE',s4_ct7:'📖 MANUSCRITOS',s4_ct8:'🏥 MUSEO DE LA SALUD',
    s4_c1:'Has recorrido el Darüşşifa y ahora has entrado en otra sección crucial del Külliye — la Madrasa Médica del Sultán Bayezid II. Antes de entrar en las salas del museo a la derecha y al frente, detente y estudia este espacio único.',
    s4_c2:'Lo que ves ahora como un edificio dispuesto alrededor de un patio cuadrado era una de las instituciones educativas más prestigiosas que formaban médicos en el Imperio Otomano — un importante centro de aprendizaje que produjo muchos médicos destacados a lo largo de los siglos.',
    s4_c3:'Clasificada entre las madrasas de más alto nivel "con calificación de 60 y superior" en el sistema educativo otomano, los estudiantes aquí podían aplicar su formación teórica en el Darüşşifa adyacente, reforzando sus conocimientos con la práctica.',
    s4_c4:'La madrasa — con una fuente (ya desaparecida) en su centro y un pozo en el rincón para el suministro de agua — consta de 18 habitaciones de estudiantes dispuestas en tres lados y un aula directamente enfrente.',
    s4_c5:'Evliya Çelebi, que visitó el Külliye en 1652, escribió sobre esta madrasa: "En la Madrasa Médica y sus salas hay estudiantes que hablan constantemente de eruditos como Platón, Sócrates, Aristóteles, Galeno y Pitágoras — cada uno un médico maduro. Cada uno dedicado a una rama del conocimiento, apoyándose en valiosos libros en el arte de la medicina, esforzándose por encontrar remedios para las dolencias de la humanidad."',
    s4_c6:'El personal docente incluía un profesor que ganaba 60 akçe al día enseñando a 18 estudiantes, un profesor asistente, un bibliotecario y dos sirvientes. Todas las necesidades de los estudiantes estaban cubiertas, y también recibían una beca diaria de dos akçe.',
    s4_c7:'38 manuscritos médicos escritos a mano estudiados aquí — muchos con los sellos de los sultanes otomanos — han sobrevivido hasta nuestros días. Estas preciosas obras están ahora preservadas en la Biblioteca de Manuscritos de Selimiye.',
    s4_c8:'La madrasa fue abierta por la Universidad de Tracia en 2007 como segunda sección del Museo de la Salud. Sus salas narran la educación médica de la época. La sección más importante es el aula, directamente frente a la entrada.',
    s4_callout:'🚶 <strong>Tras recorrer las salas de estudiantes, las salas de formación aplicada, la sala del profesor, el aula y la biblioteca — dispuestas para reflejar la atmósfera del siglo XV con maniquíes — sal de la madrasa y pasa por el torniquete cerca de la salida del Darüşşifa hacia el patio de la mezquita para continuar hacia el Imaret.</strong>',
    s4_fwd:'HACIA LA GRANDIOSIDAD DE LA MEZQUITA →',
    s5_ct1:'🌳 AL JARDÍN',s5_ct2:'💧 ESCALA DE AGUA',s5_ct3:'🕌 PORTAL PRINCIPAL DE LA MEZQUITA',s5_ct4:'🏛️ DESPENSA E IMARET',
    s5_c1:'Tras visitar el Darüşşifa y la Madrasa, has entrado en el jardín de la mezquita. Camina lentamente por este hermoso jardín de plátanos centenarios, dirigiéndote hacia la sección Imaret del museo directamente frente a ti.',
    s5_c2:'Al entrar al jardín desde el Darüşşifa, lo primero que debes notar a tu derecha — en la esquina de la mezquita — es una estructura rectangular de piedra de unos 4 metros de altura. Esta es la escala de agua del Külliye. El agua traída por tuberías desde colinas elevadas tenía primero su presión equilibrada dentro de esta estructura antes de ser distribuida a las demás unidades del Külliye.',
    s5_c3:'Tras pasar la escala de agua, serás recibido por el magnífico portal de entrada principal de la mezquita a tu derecha. Dejemos para el final de nuestro recorrido la exploración del patio de la mezquita a través de este portal, y continuemos nuestro paseo hacia el Imaret.',
    s5_c4:'Frente a ti, dos grandes edificios de arquitectura similar se encuentran uno al lado del otro. El de la izquierda contiene la despensa y la sección de panadería, ahora utilizada para eventos científicos y culturales del museo. El de la derecha es el Imaret hacia donde te dirijo ahora.',
    s5_callout:'🍲 <strong>¿Estás listo para conocer la cultura del imaret otomano y escuchar la leyenda del Cocinero Yahya Baba? Entonces muestra tu entrada en el torniquete y entra en esta sección, luego toca la siguiente parada para continuar.</strong>',
    s5_fwd:'AL CORAZÓN DE LA ABUNDANCIA →',
    s6_ct1:'🏛️ LOS IMARET',s6_ct2:'🍲 EL IMARET DEL SULTÁN BAYEZID II',s6_ct3:'🔥 COCINA Y COMEDOR',s6_ct4:'🎭 ESTA SECCIÓN DEL MUSEO',s6_ct5:'🌿 LA TUMBA DE YAHYA BABA',s6_ct6:'📖 LA LEYENDA DE YAHYA BABA',s6_ct7:'⚖️ LA PRUEBA DEL GUARDIÁN DE LA DESPENSA',s6_ct8:'👑 EL TESTIGO DEL SULTÁN',s6_ct9:'🐟 EL MILAGRO DEL PEZ',s6_ct10:'🤲 LA PARTIDA DE YAHYA BABA',s6_ct11:'🪦 VISITA A LA TUMBA',
    s6_c1:'En el Imperio Otomano, los imaret eran una de las instituciones más importantes que encarnaban el espíritu de solidaridad social y caridad. Funcionando como comedores populares que distribuían comida gratuita a los pobres, viajeros, estudiantes y necesitados, estas estructuras no eran meras cocinas — eran centros vitales que protegían a los miembros más vulnerables de la sociedad y mantenían el equilibrio social.',
    s6_c2:'Y ahora te encuentras dentro de uno de esos lugares. El imaret del Külliye del Sultán Bayezid II, establecido como tercera sección del Museo de la Salud, era una importante institución benéfica donde — según su escritura fundacional — se cocinaban y distribuían tres comidas al día a los pobres.',
    s6_c3:'El amplio espacio que encuentras al entrar es la cocina donde la comida se cocinaba en grandes calderos. La gran sala que ves a través de la puerta inmediatamente a tu derecha es donde se comía en mesas sobre el suelo de piedra.',
    s6_c4:'Al igual que las demás secciones del Museo de la Salud, esta sección está animada con maniquíes acordes al espíritu del lugar, narrando la cultura otomana del imaret y llevando a los visitantes en un viaje en el tiempo. También se exhiben aquí vasijas de cobre originales de la época, morteros y tarros de almacenamiento.',
    s6_c5:'Inmediatamente detrás del imaret se encuentra la Tumba del Cocinero Yahya Baba, una figura legendaria. Mientras exploras este interesante y espacioso edificio, déjame contarte la leyenda del Cocinero Yahya Baba que ha sobrevivido hasta nuestros días.',
    s6_c6:'Según la historia, Yahya Baba, el cocinero jefe durante el reinado del fundador del Külliye, el Sultán Bayezid II, preparaba un arroz pilaf excepcionalmente delicioso. Mientras removía el pilaf rezaba constantemente, y al cerrar la tapa decía "Concede abundancia, oh Señor." El pilaf era tan abundante que alimentaba a todos los pacientes y aún sobraba. Yahya Baba nunca tiraba el pilaf sobrante — lo llevaba a alimentar a los peces del río Tunca.',
    s6_c7:'Cuando el guardián de la despensa notó que Yahya Baba estaba dando el pilaf sobrante al río, comenzó a reducir día a día la cantidad de arroz que le entregaba. Sin embargo, incluso con menos arroz, Yahya Baba cocinaba el pilaf con oración, alimentando tanto a los pacientes como a los peces. Finalmente, el arroz asignado se redujo a un solo puñado. Aun así, el pilaf de Yahya Baba alimentaba a todos los pacientes, y todavía lograba apartar una porción para los peces.',
    s6_c8:'La noticia llegó eventualmente al Sultán. Decidiendo presenciar el asunto en persona, el Sultán llegó a la orilla del río Tunca antes que Yahya Baba y se escondió. Cuando Yahya Baba estaba a punto de regresar tras alimentar a los peces, el Sultán salió de su escondite y rugió: "¡Tú ahí — estás echando las provisiones de los pacientes al río!"',
    s6_c9:'Yahya Baba quedó petrificado. No podía decir nada. Estaba tan abrumado por la vergüenza que se postró y buscó refugio en Dios. Pero los peces, alzando sus cabezas del agua, hablaron: "¿Acaso el gran Sultán envidia a los peces su sustento?"',
    s6_c10:'El Sultán, dándose cuenta de su error con asombro y pesar, esperó a que Yahya Baba levantara la cabeza de la postración — pero en vano. Este hombre benevolente ya había entregado su alma…',
    s6_c11:'La tumba de Yahya Baba, situada justo detrás del imaret, es visitada como el santuario de un santo por los transeúntes que vienen a rezar. Especialmente los viernes, esta tumba se llena de visitantes.',
    s6_callout:'🪦 <strong>CASAS DE HUÉSPEDES:</strong> Tras escuchar esta leyenda, es hora de salir del imaret y descansar en el café del museo a la izquierda. En el café del museo dentro de la casa de huéspedes del Külliye, puedes disfrutar de té y especialmente de un sherbet otomano, comprar regalos y libros, visitar la biblioteca del museo, y luego dirigirte a la última parada — el patio de la Mezquita. ¿Hacemos un breve descanso en la Casa de Huéspedes del Külliye?',
    s6_fwd:'HACIA EL CAFÉ DEL MUSEO →',
    s7_ct1:'🏛️ PATIO Y ENTRADA A LA MEZQUITA',s7_ct2:'🚪 ENTRADA Y ATMÓSFERA',s7_ct3:'⛲ LA FUENTE Y LA SERENIDAD',s7_ct4:'🏛️ COLUMNAS DE MÁRMOL Y ARMONÍA ARQUITECTÓNICA',s7_ct5:'✨ PAZ INTERIOR Y TRANQUILIDAD',s7_ct6:'👁️ MOMENTOS DE OBSERVACIÓN',s7_ct7:'🚪 ENTRADA A LA MEZQUITA',s7_ct8:'🪵 LA ARTESANÍA KÜNDEKÂRI',
    s7_c1:'Has recorrido las secciones de nuestro Museo de la Salud y saboreado el refrescante sherbet otomano en el café. Ahora es el momento de conocer una de las estructuras más magníficas del Külliye — la mezquita.',
    s7_c2:'Al entrar por la elegante puerta lateral que se abre al patio, o por el gran portal principal, eres recibido por la fina artesanía del mármol. En un instante, dejas atrás el bullicio del mundo exterior y te deslizas hacia una atmósfera completamente diferente.',
    s7_c3:'La fuente en el centro mismo del patio llena el espacio de paz a través del sereno sonido del agua. Este sonido, combinado con el silencio de la piedra, te hace ir más despacio y te hace consciente del momento presente.',
    s7_c4:'Las columnas de mármol que te rodean se elevan como un anillo protector. Elegidas en diferentes colores, encarnan la elegancia y la riqueza armoniosa de la estética otomana.',
    s7_c5:'Lo que sientes aquí no es simplemente belleza arquitectónica — es una tranquilidad, una paz interior que ha permanecido invariable durante siglos.',
    s7_c6:'Detente brevemente en la fuente y observa esta disposición simple pero impactante del patio. Siente la armonía que crean entre sí las columnas, los arcos y los finos ornamentos.',
    s7_c7:'Luego gírate hacia el magnífico portal que se eleva directamente ante ti. Aparta suavemente la cortina de cuero que cubre la puerta y entra. Sentirás de inmediato que has entrado en una de las mezquitas más elegantes de nuestro país.',
    s7_c8:'Al entrar, no olvides prestar atención a la original carpintería kündekâri sobre la puerta — y si es posible, siente la textura de esta exquisita artesanía.',
    s7_callout:'🕌 <strong>¿Entramos en el gran espacio y la tranquilidad dentro del santuario?</strong>',
    s7_fwd:'CONTINÚA HACIA EL INTERIOR →',
    s8_ct1:'🕌 DENTRO DE LA MEZQUITA — EL FINAL',s8_ct2:'🚤 TRANSPORTE HISTÓRICO Y TRADICIÓN REAL',s8_ct3:'👑 IMAGINANDO LA GALERÍA REAL',s8_ct4:'🏛️ LA GALERÍA REAL Y SUS PRIMERAS VECES',s8_ct5:'⚙️ EL MIHRAB Y LAS PIEDRAS DE EQUILIBRIO',s8_ct6:'🪵 EL MINBAR Y LA FINA ARTESANÍA',s8_ct7:'📐 SÍMBOLOS Y SIGNIFICADOS',s8_ct8:'💡 ORDEN DE LUZ Y ACÚSTICA',s8_ct9:'🌌 ESPLENDOR BAJO LA CÚPULA',s8_ct10:'🏗️ UN PUNTO DE INFLEXIÓN ARQUITECTÓNICO',s8_ct11:'✨ FINAL Y DESPEDIDA',
    s8_c1:'Ahora te encuentras dentro de la mezquita en el centro del Külliye, y estamos completando el final de nuestro recorrido bajo esta magnífica cúpula.',
    s8_c2:'El Sultán Bayezid II, el fundador del Külliye, y los sultanes que le siguieron solían llegar a esta mezquita viajando por el río en ornamentadas embarcaciones imperiales. Entraban por la puerta del lado del río y realizaban sus oraciones en la galería real — el hünkâr mahfili — que se eleva sobre columnas en el rincón izquierdo de la mezquita.',
    s8_c3:'Cierra los ojos por un momento… Imagina al Sultán, a esa altura, adorando con la misma paz junto a la congregación.',
    s8_c4:'Recordando que la primera galería real jamás construida en la arquitectura turco-islámica se encuentra aquí, caminemos ahora hacia el mihrab.',
    s8_c5:'Cuando toques y gires suavemente las piedras de equilibrio cilíndricas a ambos lados del mihrab, te asombrarás al comprobar que el suelo de esta gran estructura no muestra el más mínimo desplazamiento.',
    s8_c6:'Al acercarte al minbar a la derecha, quedarás maravillado por la delicadeza y elegancia de la artesanía en mármol.',
    s8_c7:'Ahora te sugiero que des la espalda al mihrab y mires sobre la puerta de entrada. El motivo de la bandeja con una sandía en el centro, situado directamente sobre la puerta, simboliza que hay un imaret en este Külliye y que quienes vienen aquí están invitados a una comida.',
    s8_c8:'Las ventanas alrededor de la cúpula y en las filas inferiores aseguran que la luz se distribuya uniformemente por todo el espacio. Esta disposición de iluminación, combinada con la poderosa acústica de la mezquita, confiere al espacio profundidad tanto visual como auditiva.',
    s8_c9:'Y ahora eleva tu mirada hacia arriba… Contempla detenidamente esta magnífica cúpula adornada con decoraciones barrocas. De aproximadamente 31 metros de altura y 22 metros de diámetro, esta cúpula — que descansa sobre cuatro paredes sin columnas intermedias — es un ejemplo arquitectónicamente notable.',
    s8_c10:'También se considera un importante precursor de la transición hacia las estructuras de cúpula única.',
    s8_c11:'Bajo la gracia y el esplendor de esta cúpula sin igual, concluimos este viaje en el que has conectado las huellas del pasado con el silencio de hoy — no olvides llevar contigo la paz y el asombro que este lugar ha dejado en tu corazón.',
    s8_callout:'🙏 <strong>¿Ponemos una tranquila despedida a este viaje espiritual?</strong>',
    s8_fwd:'HACIA LA DESPEDIDA →',
    s9_c1:'🏛️ Hemos trazado paso a paso las huellas del pasado, respirando juntos esta magnífica arquitectura. Ahora es el momento de añadir tu propio aliento a este lugar histórico.',
    s9_c2:'💭 Lo que resuena dentro de ti… Un momento de paz, una profunda admiración, o esa nota silenciosa que persiste en tu corazón…',
    s9_c3:'📖 El Libro de Visitas que hemos preparado para ti es un archivo espiritual de esta experiencia. Cada frase que dejes aquí será: un recuerdo invaluable para nosotros, y una luz que da significado a este viaje para nuestros demás visitantes.',
    s9_c4:'✨ Comparte con nosotros lo que fluye de tu corazón — y deja que tu huella permanezca para siempre en el Puente del Corazón…',
    s9_callout:'✍️ <strong>Te invitamos a compartir tus sentimientos en nuestra página del Puente del Corazón.</strong>',
    s9_fwd:'ESCRIBIR AL PUENTE DEL CORAZÓN →',
    s10_body:'Nos encantaría escuchar las impresiones que este viaje de 500 años por nuestro Külliye ha dejado en ti. Tus palabras se convertirán en piedras de este puente.',
    s10_restart:'🏛️ VOLVER AL INICIO'
  },
   ru:{
    start:'НАЧАТЬ ПУТЕШЕСТВИЕ',intro_title:'Приглашение к Порогу',intro_sub:'Путешествие вне времени, к центру исцеления…',
    back:'← НАЗАД',menu_lang:'Язык: Русский 🇷🇺',menu_map:'Карта и Расположение',menu_defter:'Мост Сердца',
    loc_searching:'📍 Определение местоположения…',loc_outside:'📍 Вы находитесь за пределами территории Куллие.',
    loc_error:'📍 Не удалось определить местоположение. Пожалуйста, разрешите доступ к геолокации.',
    gb_name:'Ваше Имя',gb_city:'Ваш Город',gb_msg:'Оставьте здесь свои чувства…',
    gb_submit:'Я ДОБАВЛЯЮ СВОЙ КАМЕНЬ НА МОСТ 🪨',gb_submitting:'Запечатывается…',
    gb_conn_err:'Ошибка соединения. Пожалуйста, попробуйте снова.',gb_no_msg:'Пожалуйста, оставьте заметку…',
    confirm_text:'Ваши чувства запечатаны на Мосту Сердца. Значимый след, который вы оставили, обогащает духовное наследие нашего Куллие…',
    confirm_close:'БУДЬТЕ ЗДОРОВЫ 🌿',latest_title:'📜 Последние Сообщения',archive_title:'🗂️ Архив',
    no_msg:'Сообщений пока нет. Будьте первым, кто добавит камень! ✨',
    s0_main:'🏛️ КУЛЛИЕ СУЛТАНА БАЯЗИДА II',s0_sub:'МУЗЕЙ ЗДОРОВЬЯ',s0_slogan:'✨ ПУТЕШЕСТВИЕ К ИСЦЕЛЕНИЮ — ВХОД В МУЗЕЙ',
    s1_main:'Вход в Дарюшшифа',s1_sub:'🏛️ ВРАТА СПРАВЕДЛИВОСТИ И ИСЦЕЛЕНИЯ',s1_slogan:'⚖️ ПЕРВАЯ ОСТАНОВКА ИСЦЕЛЕНИЯ',
    s2_main:'Выход из Зала Презентаций',s2_sub:'🏛️ ОТ ЗНАНИЯ К ОПЫТУ',s2_slogan:'🏛️ АДМИНИСТРАЦИЯ И ПОРЯДОК',
    s3_main:'Большой Лазарет (ВОСЬМИУГОЛЬНЫЙ ЗАЛ)',s3_sub:'🏛️ ПОРОГ ДАРЮШШИФА',s3_slogan:'🌊 ВЕРШИНА ИСЦЕЛЕНИЯ',
    s4_main:'Медицинское Медресе',s4_sub:'🎓 КОЛЫБЕЛЬ ЗНАНИЙ',s4_slogan:'📚 СВЕТ УЧЕНИЯ',
    s5_main:'Большой Двор',s5_sub:'🌿 ВЕКОВЫЕ ПЛАТАНЫ',s5_slogan:'🌳 ВРЕМЯ И ПОКОЙ',
    s6_main:'Имарет (Благотворительная Кухня)',s6_sub:'🍲 СОСТРАДАНИЕ И ИЗОБИЛИЕ',s6_slogan:'🍲 КУХНЯ ЯХЬЯ-БАБЫ',
    s7_main:'Подготовка к Духовной Атмосфере',s7_sub:'🕌 ВХОД В МЕЧЕТЬ',s7_slogan:'✨ ОДИН КУПОЛ, БЕСКОНЕЧНЫЙ ПОКОЙ',
    s8_main:'Духовное Путешествие Внутри Мечети',s8_sub:'🕌 ДВОР МЕЧЕТИ',s8_slogan:'🌌 ФИНАЛ ПОД КУПОЛОМ',
    s9_main:'Время Прощания',s9_sub:'🌊 ПРИГЛАШЕНИЕ НА МОСТ СЕРДЦА',s9_slogan:'✨ ОСТАВЬТЕ СВОЙ СЛЕД В ЭТОЙ ИСТОРИИ',
    s10_main:'🖋️ Мост Сердца',s10_slogan:'"Исцеление прошлого встречается со словами сегодняшнего дня."',
    nav_back:'← НАЗАД',
    s0_ct1:'👑 ИСТОРИЯ',s0_ct2:'🏗️ СТРОЕНИЕ',s0_ct3:'🎧 ВАШ ЭКСКУРСОВОД',s0_ct4:'📵 ВНИМАНИЕ',s0_ct5:'📍 РАСПОЛОЖЕНИЕ',s0_ct6:'🏫 ОРИЕНТАЦИЯ',
    s0_c1:'Вы находитесь в одном из самых захватывающих исторических мест Эдирне — Музее Здоровья Куллие Султана Баязида II. Добро пожаловать в это место, где встречаются история и исцеление.',
    s0_c2:'Построенный Султаном Баязидом II — сыном Мехмеда Завоевателя и 8-м османским султаном — под руководством главного архитектора Хайреттина, этот комплекс является наиболее хорошо сохранившимся куллие среди всех османских куллие. В центре расположена мечеть; справа — больница и медресе; слева — имарет и кладовая; по бокам мечети — гостевые дома, а за ней — мост через реку Тунджа. Всё это воплощает модель османского социального государства.',
    s0_c3:'Я проведу вас по Куллие и нашему музею с помощью текстового, аудио и визуального контента, чтобы обогатить ваш визит.',
    s0_c4:'Пожалуйста, держите мобильный телефон при себе на протяжении всей экскурсии.',
    s0_c5:'Вы прошли кассу и теперь находитесь в переднем саду. Пожалуйста, встаньте перед большой фотографией Куллие, висящей на стене напротив вас, и изучите расположение этих строений в городе Эдирне.',
    s0_c6:'По мере того как вы идёте в эту сторону, здание справа от вас — это Медицинское Медресе Куллие, а здание прямо перед вами — Дарюшшифа, сердце Куллие и центр нашего музея.',
    s0_callout:'👣 <strong>Осмотрев большую фотографию, войдите в сад Дарюшшифа через дверь слева от вас.</strong>',
    s0_fwd:'НАЧАТЬ ПУТЕШЕСТВИЕ СКВОЗЬ ВРЕМЯ →',
    s1_ct1:'🏥 ДАРЮШШИФА — 1-Й ДВОР',s1_ct2:'🌍 ИСТОРИЧЕСКОЕ ЗНАЧЕНИЕ',s1_ct3:'🛏️ СЛУЖЕБНЫЕ КОМНАТЫ',s1_ct4:'🩺 АМБУЛАТОРНЫЕ КОМНАТЫ',s1_ct5:'🧭 УКАЗАНИЯ',s1_ct6:'💧 МОЛОЧНЫЙ КОЛОДЕЦ',s1_ct7:'🌿 ДЕРЕВО И ПЛЮЩ',s1_ct8:'🎬 ЗАЛ ПРЕЗЕНТАЦИЙ',
    s1_c1:'Вы находитесь в первом дворе Эдирнского Дарюшшифа — одного из важнейших лечебных центров Османской империи. Пожалуйста, остановитесь здесь на мгновение и осмотритесь.',
    s1_c2:'Прежде всего знайте: это здание признано одним из первых примеров централизованно и тщательно спланированной больницы в истории. Западные аналоги появились лишь около 200 лет спустя — здесь зоны лечения и обслуживания были реализованы с архитектурным видением, опередившим своё время.',
    s1_c3:'По мере продвижения по дорожке впереди, четыре комнаты сразу слева от входа — это служебные подразделения Дарюшшифа: комната персонала, прачечная, диетическая кухня и кладовая для хранения припасов.',
    s1_c4:'Справа, за колоннами, находятся шесть амбулаторных комнат, где ежедневно проводились осмотры пациентов, уход и экстренные вмешательства. В годы основания одна из этих комнат была отведена для глазных врачей, известных как «кеххаль».',
    s1_c5:'Оставьте детальный осмотр этих комнат — оформленных с витринами и информационными стендами — на обратный путь, а пока позвольте мне провести вас к нашему залу презентаций. Он находится за первым двором, слева. По дороге, пожалуйста, обратите внимание на колодец слева.',
    s1_c6:'Это каменное сооружение называется «Молочным Колодцем», поскольку считалось, что его вода увеличивала выработку молока у кормящих матерей. Примерно в 20 метрах дальше, среди травы, вы увидите дерево, обвитое плющом.',
    s1_c7:'Когда доберётесь до этого места, обязательно прочитайте меланхоличное любовное стихотворение Ахмета Кутси Течера об этом дереве, размещённое на стенде в траве. Затем ещё раз посмотрите на дерево и плющ — с этим чувством в сердце.',
    s1_c8:'Сразу за стихотворением, немедленно слева, находится наш зал презентаций. Здесь вы можете посмотреть видео об истории и развитии Куллие и Дарюшшифа, получив полное представление о значении этого места в истории медицины и архитектуры.',
    s1_callout:'🎬 <strong>Хотите посмотреть презентационное видео?</strong> Вы можете посмотреть его в зале презентаций или нажать кнопку ниже, чтобы посмотреть на телефоне.',
    s1_watch:'СМОТРЕТЬ ПРЕЗЕНТАЦИЮ ▶',s1_fwd:'В ЗАЛ ПРЕЗЕНТАЦИЙ →',
    s2_ct1:'🚪 ВХОД ВО 2-Й ДВОР',s2_ct2:'🏛️ АДМИНИСТРАТИВНЫЕ КОМНАТЫ',s2_ct3:'🔒 АДМИНИСТРАТИВНЫЙ РАЗДЕЛ',s2_ct4:'✨ НАДПИСЬ И ВХОД',
    s2_c1:'Как только вы выйдете из зала презентаций, пройдите через большую дверь слева во второй двор, где расположены административные кабинеты.',
    s2_c2:'В этом дворе находятся 4 комнаты — по две с каждой стороны. Главный врач и другие доктора использовали эти комнаты; здесь планировалась и управлялась вся деятельность больницы. В годы основания в этом Дарюшшифа работали 1 главный врач, два доктора, 2 хирурга, 2 глазных врача и 1 фармацевт.',
    s2_c3:'Этот административный раздел также служил защитным барьером между ежедневным потоком пациентов в первом дворе и стационарным лечебным отделением, в которое вы вот-вот войдёте.',
    s2_c4:'Теперь прочитайте надпись над дверью, затем задержите дыхание…',
    s2_callout:'🚶‍♂️ <strong>Войдите в это волшебное место, где музыка и звук воды соединяются с исцелением.</strong>',
    s2_fwd:'ОТКРЫТЬ ВЕЛИКИЙ ЛАЗАРЕТ →',
    s3_ct1:'🏥 СТАЦИОНАРНОЕ ЛЕЧЕБНОЕ ОТДЕЛЕНИЕ',s3_ct2:'🌊 СТРУКТУРА БОЛЬНИЦЫ',s3_ct3:'🎵 МУЗЫКАЛЬНАЯ ТЕРАПИЯ',s3_ct4:'💧 ВОДНАЯ ТЕРАПИЯ',s3_ct5:'🌿 АРОМАТЕРАПИЯ',s3_ct6:'🧺 ТРУДОТЕРАПИЯ',s3_ct7:'🚶 ВЫХОД И ЭКСКУРСИЯ',
    s3_c1:'Вы находитесь в сердце нашего музея — стационарном лечебном отделении Эдирнского Дарюшшифа. Пройдите по этому пространству с ощущением тех, кто обрёл здесь исцеление 500 лет назад.',
    s3_c2:'Представьте больницу, где вас встречает фонтан, ритмично текущий в центре, а прямо напротив него — музыкальная сцена. Эта централизованно спланированная больница, перекрытая широким куполом, состоит из 6 зимних палат, 4 летних палат и музыкальной сцены. Фонарь в куполе также обеспечивает вентиляцию и вывод загрязнённого воздуха. Наклонные полы и каналы под ними облегчают мытьё и уборку.',
    s3_c3:'Особенностью этой больницы было использование музыкальных ладов в лечении наряду с современными медицинскими знаниями. Музыкальный ансамбль из 10 исполнителей играл и пел различные лады для разных болезней по рекомендации врачей — считалось, что это приносит пользу при различных недугах.',
    s3_c4:'Звук воды, текущей из фонтана в центре здания, был важной частью лечения, призванной успокаивать и умиротворять пациентов.',
    s3_c5:'Помимо музыки и звуков воды, в Дарюшшифа также практиковалась ароматерапия. Ароматы различных растений, выращиваемых во дворе и окрестностях, были неотъемлемой частью процесса исцеления.',
    s3_c6:'Трудотерапия также использовалась здесь как метод лечения. Пациентов вовлекали в плетение корзин, вязание и различные ремёсла, чтобы отвлечь их от тревог и мыслей.',
    s3_c7:'Осмотрев комнаты, демонстрирующие различные аспекты османской медицины, вы можете выйти из стационарного отделения. Покидая это место исцеления, которое непрерывно служило 400 лет, вы также можете посетить другие комнаты во втором и первом дворах, чтобы узнать больше о Дарюшшифа и османской медицине.',
    s3_callout:'🏫 <strong>К МЕДИЦИНСКОМУ МЕДРЕСЕ:</strong> Выйдите из Дарюшшифа и направляйтесь к Медицинскому Медресе, расположенному слева от входного сада с большой фотографией.',
    s3_fwd:'ВПЕРЁД, К МЕДРЕСЕ →',
    s4_ct1:'🏫 МЕДИЦИНСКОЕ МЕДРЕСЕ',s4_ct2:'🌍 ИСТОРИЧЕСКОЕ ЗНАЧЕНИЕ',s4_ct3:'📚 СИСТЕМА ОБРАЗОВАНИЯ',s4_ct4:'🏛️ АРХИТЕКТУРНОЕ СТРОЕНИЕ',s4_ct5:'📜 ЭВЛИЯ ЧЕЛЕБИ',s4_ct6:'👨‍🏫 ПРЕПОДАВАТЕЛЬСКИЙ СОСТАВ',s4_ct7:'📖 РУКОПИСИ',s4_ct8:'🏥 МУЗЕЙ ЗДОРОВЬЯ',
    s4_c1:'Вы осмотрели Дарюшшифа и теперь вошли в другую важнейшую часть Куллие — Медицинское Медресе Султана Баязида II. Прежде чем войти в музейные залы справа и напротив, остановитесь и изучите это уникальное пространство.',
    s4_c2:'То, что вы видите сейчас — здание, расположенное вокруг квадратного двора, — было одним из наиболее престижных учебных заведений по подготовке врачей в Османской империи, важным центром знаний, подготовившим многих выдающихся докторов на протяжении столетий.',
    s4_c3:'Входя в число медресе наивысшего уровня «60-ти акче и выше» в системе османского образования, студенты здесь могли применять теоретические знания в соседнем Дарюшшифа, закрепляя их практикой.',
    s4_c4:'Медресе — с фонтаном (ныне не сохранившимся) в центре и колодцем в углу для водоснабжения — состоит из 18 студенческих комнат, расположенных с трёх сторон, и лекционного зала прямо напротив.',
    s4_c5:'Эвлия Челеби, посетивший Куллие в 1652 году, писал об этом медресе: «В Медицинском Медресе и его комнатах — студенты, постоянно рассуждающие о таких учёных, как Платон, Сократ, Аристотель, Гален и Пифагор — каждый зрелый врач. Каждый посвящён какой-либо области знаний, опираясь на ценные книги по искусству медицины, стремясь найти средства от недугов человечества».',
    s4_c6:'В преподавательский состав входили профессор, получавший 60 акче в день и обучавший 18 студентов, доцент, библиотекарь и двое слуг. Все нужды студентов обеспечивались, а кроме того, они получали ежедневную стипендию в размере двух акче.',
    s4_c7:'38 рукописных медицинских манускриптов, изученных здесь — многие с печатями османских султанов — сохранились до наших дней. Эти драгоценные труды ныне хранятся в Рукописной библиотеке Селимие.',
    s4_c8:'Медресе было открыто Университетом Фракии в 2007 году как второй раздел Музея Здоровья. Его комнаты повествуют о медицинском образовании той эпохи. Важнейший раздел — лекционный зал прямо напротив входа.',
    s4_callout:'🚶 <strong>Осмотрев студенческие комнаты, залы практических занятий, профессорскую комнату, лекционный зал и библиотеку — оформленные в атмосфере XV века с манекенами — выйдите из медресе и пройдите через турникет у выхода из Дарюшшифа во двор мечети, чтобы продолжить путь к Имарету.</strong>',
    s4_fwd:'К ВЕЛИЧИЮ МЕЧЕТИ →',
    s5_ct1:'🌳 В САД',s5_ct2:'💧 ВОДЯНЫЕ ВЕСЫ',s5_ct3:'🕌 ГЛАВНЫЕ ВОРОТА МЕЧЕТИ',s5_ct4:'🏛️ КЛАДОВАЯ И ИМАРЕТ',
    s5_c1:'Осмотрев Дарюшшифа и Медресе, вы вошли в сад мечети. Медленно пройдите по этому красивому саду с вековыми платанами, направляясь к разделу Имарета музея прямо впереди.',
    s5_c2:'Входя в сад со стороны Дарюшшифа, первое, на что следует обратить внимание справа — у угла мечети — прямоугольное каменное сооружение высотой около 4 метров. Это водяные весы Куллие. Вода, доставляемая по трубам с высоких холмов, сначала выравнивала своё давление в этом сооружении, а затем распределялась по другим частям Куллие.',
    s5_c3:'Пройдя мимо водяных весов, вас встретит великолепный главный входной портал мечети справа. Оставим исследование двора мечети через этот портал на самый конец нашей экскурсии и продолжим путь к Имарету.',
    s5_c4:'Впереди два больших здания схожей архитектуры стоят рядом. Левое содержит кладовую и пекарню, ныне используемые для научных и культурных мероприятий музея. Правое — это Имарет, к которому я сейчас вас направляю.',
    s5_callout:'🍲 <strong>Готовы ли вы увидеть культуру османского имарета и услышать легенду о Поваре Яхья-Бабе? Тогда покажите билет у турникета, войдите в этот раздел и нажмите следующую остановку, чтобы продолжить.</strong>',
    s5_fwd:'К СЕРДЦУ ИЗОБИЛИЯ →',
    s6_ct1:'🏛️ ИМАРЕТ',s6_ct2:'🍲 ИМАРЕТ СУЛТАНА БАЯЗИДА II',s6_ct3:'🔥 КУХНЯ И ОБЕДЕННЫЙ ЗАЛ',s6_ct4:'🎭 ЭТОТ РАЗДЕЛ МУЗЕЯ',s6_ct5:'🌿 ГРОБНИЦА ЯХЬЯ-БАБЫ',s6_ct6:'📖 ЛЕГЕНДА О ЯХЬЯ-БАБЕ',s6_ct7:'⚖️ ИСПЫТАНИЕ КЛАДОВЩИКА',s6_ct8:'👑 СВИДЕТЕЛЬ-СУЛТАН',s6_ct9:'🐟 ЧУДО РЫБЫ',s6_ct10:'🤲 УХОД ЯХЬЯ-БАБЫ',s6_ct11:'🪦 ПОСЕЩЕНИЕ ГРОБНИЦЫ',
    s6_c1:'В Османской империи имареты были одними из важнейших институтов, воплощавших дух социальной солидарности и благотворительности. Служа бесплатными столовыми для бедных, путешественников, студентов и нуждающихся, эти сооружения были не просто кухнями — они являлись жизненно важными центрами, защищавшими нуждающихся членов общества и поддерживавшими социальное равновесие.',
    s6_c2:'И вы сейчас находитесь именно в таком месте. Имарет Куллие Султана Баязида II, основанный как третий раздел Музея Здоровья, был важным благотворительным учреждением, где — согласно его уставу — три раза в день готовилась и раздавалась еда бедным.',
    s6_c3:'Просторное помещение, которое вы видите при входе, — это кухня, где еда готовилась в больших котлах. Большой зал, который вы видите через дверь сразу справа, — это место, где принимали пищу за каменными столами на полу.',
    s6_c4:'Как и другие разделы Музея Здоровья, этот раздел оживлён манекенами, соответствующими духу места, повествующими об османской культуре имарета и переносящими посетителей в путешествие сквозь время. Здесь также экспонируются оригинальные медные сосуды, ступки и кувшины для хранения той эпохи.',
    s6_c5:'Непосредственно за имаретом находится Гробница Повара Яхья-Бабы — легендарной фигуры. Пока вы исследуете это интересное и просторное здание, позвольте рассказать вам легенду о Поваре Яхья-Бабе, сохранившуюся до наших дней.',
    s6_c6:'Согласно преданию, Яхья-Баба, главный повар в царствование основателя Куллие Султана Баязида II, готовил исключительно вкусный рисовый плов. Помешивая плов, он постоянно молился, а закрывая крышку, говорил: «Даруй изобилие, о Господи». Плова было так много, что он кормил всех пациентов и ещё оставался. Яхья-Баба никогда не выбрасывал лишний плов — он относил его кормить рыбу в реке Тунджа.',
    s6_c7:'Когда кладовщик заметил, что Яхья-Баба скармливает лишний плов реке, он начал день за днём уменьшать количество выдаваемого ему риса. Однако даже с меньшим количеством риса Яхья-Баба с молитвой готовил плов, кормя и пациентов, и рыбу. В конце концов выделяемое количество риса сократилось до одной горстки. Но плов Яхья-Бабы по-прежнему кормил всех пациентов, и ему всё равно удавалось отложить часть для рыбы.',
    s6_c8:'В конце концов весть об этом дошла до Султана. Решив лично стать свидетелем происходящего, Султан пришёл на берег реки Тунджа раньше Яхья-Бабы и спрятался. Когда Яхья-Баба собрался уходить после кормления рыбы, Султан вышел из укрытия и воскликнул: «Эй ты — ты выливаешь провизию пациентов в реку?»',
    s6_c9:'Яхья-Баба оцепенел. Он не мог ничего сказать. Им так овладел стыд, что он пал ниц и воззвал к Богу. Но рыбы, подняв головы из воды, заговорили: «Неужели великий Султан жалеет рыбам их пропитание?»',
    s6_c10:'Султан, осознав свою ошибку в изумлении и горе, ждал, когда Яхья-Баба поднимет голову от земли — но напрасно. Этот добросердечный человек уже отдал свою душу…',
    s6_c11:'Гробница Яхья-Бабы, расположенная прямо за имаретом, посещается как святыня прохожими, приходящими помолиться. Особенно по пятницам эта гробница наполнена посетителями.',
    s6_callout:'🪦 <strong>ГОСТЕВЫЕ ДОМА:</strong> Услышав эту легенду, пришло время выйти из имарета и отдохнуть в музейном кафе слева. В музейном кафе в гостевом доме Куллие вы можете выпить чай и, особенно, попробовать османский щербет, приобрести сувениры и книги, осмотреть библиотеку музея, а затем отправиться на последнюю остановку — двор Мечети. Сделаем небольшой перерыв в Гостевом доме Куллие?',
    s6_fwd:'К МУЗЕЙНОМУ КАФЕ →',
    s7_ct1:'🏛️ ДВОР И ВХОД В МЕЧЕТЬ',s7_ct2:'🚪 ВХОД И АТМОСФЕРА',s7_ct3:'⛲ ФОНТАН И УМИРОТВОРЕНИЕ',s7_ct4:'🏛️ МРАМОРНЫЕ КОЛОННЫ И АРХИТЕКТУРНАЯ ГАРМОНИЯ',s7_ct5:'✨ ВНУТРЕННИЙ МИР И ПОКОЙ',s7_ct6:'👁️ МГНОВЕНИЯ НАБЛЮДЕНИЯ',s7_ct7:'🚪 ВХОД В МЕЧЕТЬ',s7_ct8:'🪵 КЮНДЕКЯРИ — МАСТЕРСТВО РЕЗЬБЫ',
    s7_c1:'Вы осмотрели разделы нашего Музея Здоровья и попробовали освежающий османский щербет в кафе. Теперь пришло время познакомиться с одним из самых величественных сооружений Куллие — мечетью.',
    s7_c2:'Войдя через изящную боковую дверь, открывающуюся во двор, или через величественный главный портал, вас встречает тонкое мастерство мрамора. В мгновение ока вы оставляете позади суету внешнего мира и погружаетесь в совершенно иную атмосферу.',
    s7_c3:'Фонтан в самом центре двора наполняет пространство покоем через спокойный звук воды. Этот звук в сочетании с тишиной камня замедляет вас и заставляет осознать настоящий момент.',
    s7_c4:'Мраморные колонны, окружающие вас, поднимаются словно защитное кольцо. Выбранные в разных цветах, они воплощают изящество и гармоничное богатство османской эстетики.',
    s7_c5:'То, что вы чувствуете здесь, — это не просто архитектурная красота, а умиротворённость, внутренний покой, остававшийся неизменным на протяжении столетий.',
    s7_c6:'Ненадолго остановитесь у фонтана и понаблюдайте за этим простым, но впечатляющим устройством двора. Почувствуйте гармонию, которую колонны, арки и тонкие украшения создают друг с другом.',
    s7_c7:'Затем повернитесь к величественному порталу, возвышающемуся прямо перед вами. Мягко отведите кожаную занавесь, покрывающую дверь, и войдите. Вы сразу почувствуете, что вошли в одну из самых изящных мечетей нашей страны.',
    s7_c8:'Войдя, не забудьте обратить внимание на оригинальную деревянную резьбу кюндекяри над дверью — и если возможно, почувствуйте текстуру этого изысканного мастерства.',
    s7_callout:'🕌 <strong>Войдём ли мы в великое пространство и покой внутри святыни?</strong>',
    s7_fwd:'ПРОДОЛЖИТЬ ВНУТРЬ →',
    s8_ct1:'🕌 ВНУТРИ МЕЧЕТИ — ФИНАЛ',s8_ct2:'🚤 ИСТОРИЧЕСКОЕ СООБЩЕНИЕ И КОРОЛЕВСКАЯ ТРАДИЦИЯ',s8_ct3:'👑 ВООБРАЖЕНИЕ КОРОЛЕВСКОЙ ГАЛЕРЕИ',s8_ct4:'🏛️ КОРОЛЕВСКАЯ ГАЛЕРЕЯ И ЕЁ ПЕРВЕНСТВО',s8_ct5:'⚙️ МИХРАБ И БАЛАНСИРОВОЧНЫЕ КАМНИ',s8_ct6:'🪵 МИНБАР И ТОНКОЕ МАСТЕРСТВО',s8_ct7:'📐 СИМВОЛЫ И ЗНАЧЕНИЯ',s8_ct8:'💡 СВЕТОВОЙ И АКУСТИЧЕСКИЙ ПОРЯДОК',s8_ct9:'🌌 ВЕЛИКОЛЕПИЕ ПОД КУПОЛОМ',s8_ct10:'🏗️ АРХИТЕКТУРНЫЙ ПОВОРОТНЫЙ МОМЕНТ',s8_ct11:'✨ ФИНАЛ И ПРОЩАНИЕ',
    s8_c1:'Вы находитесь внутри мечети в центре Куллие, и мы завершаем финал нашей экскурсии под этим величественным куполом.',
    s8_c2:'Султан Баязид II, основатель Куллие, и последовавшие за ним султаны прибывали в эту мечеть, путешествуя по реке на украшенных императорских лодках. Они входили через дверь со стороны реки и совершали намаз в королевской галерее — хюнкяр махфили — возвышающейся на колоннах в левом углу мечети.',
    s8_c3:'Закройте глаза на мгновение… Представьте Султана, на той высоте, молящегося в том же покое вместе с общиной.',
    s8_c4:'Помня о том, что первая в истории турецко-исламской архитектуры королевская галерея расположена именно здесь, давайте теперь направимся к михрабу.',
    s8_c5:'Когда вы прикоснётесь и осторожно повернёте цилиндрические балансировочные камни по обе стороны михраба, вы с удивлением обнаружите, что основание этого великого сооружения не сдвинулось ни на малейшую долю.',
    s8_c6:'Приближаясь к минбару справа, вы восхититесь тонкостью и изяществом мраморного мастерства.',
    s8_c7:'Теперь я предлагаю вам повернуться спиной к михрабу и посмотреть над входной дверью. Мотив подноса с арбузом в центре, расположенный прямо над дверью, символизирует, что в этом Куллие есть имарет и что все, кто приходит сюда, приглашены к трапезе.',
    s8_c8:'Окна вокруг купола и в нижних рядах обеспечивают равномерное распределение света по всему пространству. Это освещение в сочетании с мощной акустикой мечети придаёт пространству как визуальную, так и слуховую глубину.',
    s8_c9:'А теперь поднимите взгляд вверх… Внимательно рассмотрите этот величественный купол, украшенный барочными орнаментами. Высотой около 31 метра и диаметром 22 метра, этот купол — опирающийся на четыре стены без промежуточных колонн — является архитектурно примечательным примером.',
    s8_c10:'Он также считается важным предшественником перехода к однокупольным сооружениям.',
    s8_c11:'Под благодатью и великолепием этого несравненного купола мы завершаем это путешествие, где вы соединили следы прошлого с тишиной сегодняшнего дня — не забудьте унести с собой покой и восхищение, которые это место оставило в вашем сердце.',
    s8_callout:'🙏 <strong>Оставим ли мы тихое прощание на этом духовном пути?</strong>',
    s8_fwd:'К ПРОЩАНИЮ →',
    s9_c1:'🏛️ Мы шаг за шагом прослеживали следы прошлого, вместе вдыхая воздух этой великолепной архитектуры. Теперь пришло время добавить ваше собственное дыхание к этому историческому месту.',
    s9_c2:'💭 Что отзывается внутри вас… Момент покоя, глубокое восхищение или та тихая нота, звучащая в вашем сердце…',
    s9_c3:'📖 Книга Посетителей, которую мы подготовили для вас, — это духовный архив этого опыта. Каждое предложение, которое вы оставите здесь, станет: бесценным воспоминанием для нас и светом, придающим смысл этому путешествию для наших других гостей.',
    s9_c4:'✨ Поделитесь с нами тем, что течёт из вашего сердца — и пусть ваш след навсегда останется на Мосту Сердца…',
    s9_callout:'✍️ <strong>Приглашаем вас поделиться своими чувствами на нашей странице Моста Сердца.</strong>',
    s9_fwd:'НАПИСАТЬ НА МОСТ СЕРДЦА →',
    s10_body:'Нам было бы очень интересно узнать, какие впечатления оставило у вас это 500-летнее путешествие по нашему Куллие. Ваши слова станут камнями этого моста.',
    s10_restart:'🏛️ ВЕРНУТЬСЯ К НАЧАЛУ'
  },
   ar:{
    start:'ابدأ الرحلة',intro_title:'دعوة إلى العتبة',intro_sub:'رحلة خارج الزمن، إلى مركز الشفاء…',
    back:'→ عودة',menu_lang:'اللغة: العربية 🇸🇦',menu_map:'الخريطة والموقع',menu_defter:'جسر القلب',
    loc_searching:'📍 جارٍ تحديد الموقع…',loc_outside:'📍 أنت خارج منطقة الكلية.',
    loc_error:'📍 تعذّر تحديد الموقع. يرجى تفعيل إذن الموقع.',
    gb_name:'اسمك',gb_city:'مدينتك',gb_msg:'اترك مشاعرك هنا…',
    gb_submit:'أضع حجري على الجسر 🪨',gb_submitting:'جارٍ الختم…',
    gb_conn_err:'خطأ في الاتصال. يرجى المحاولة مجدداً.',gb_no_msg:'يرجى ترك رسالة…',
    confirm_text:'لقد خُتمت مشاعرك على جسر القلب. الأثر الثمين الذي تركته يُثري الإرث الروحي لكليّتنا…',
    confirm_close:'شفاءً وعافيةً 🌿',latest_title:'📜 أحدث الرسائل',archive_title:'🗂️ الأرشيف',
    no_msg:'لا توجد رسائل بعد. كن أول من يضع حجراً! ✨',
    s0_main:'🏛️ كلية السلطان بايزيد الثاني',s0_sub:'متحف الصحة',s0_slogan:'✨ رحلة الشفاء — مدخل المتحف',
    s1_main:'مدخل دار الشفاء',s1_sub:'🏛️ بوابة العدل والشفاء',s1_slogan:'⚖️ المحطة الأولى للشفاء',
    s2_main:'الخروج من قاعة العرض',s2_sub:'🏛️ من المعرفة إلى التجربة',s2_slogan:'🏛️ الإدارة والنظام',
    s3_main:'المارستان الكبير (القاعة الثمانية الأضلاع)',s3_sub:'🏛️ عتبة دار الشفاء',s3_slogan:'🌊 قمة الشفاء',
    s4_main:'المدرسة الطبية',s4_sub:'🎓 مهد المعرفة',s4_slogan:'📚 نور العلم',
    s5_main:'الصحن الكبير',s5_sub:'🌿 أشجار الدلب المعمّرة',s5_slogan:'🌳 الزمن والسكينة',
    s6_main:'الإمارة (المطبخ الخيري)',s6_sub:'🍲 الرحمة والوفرة',s6_slogan:'🍲 مطبخ يحيى بابا',
    s7_main:'التهيؤ للأجواء الروحانية',s7_sub:'🕌 مدخل المسجد',s7_slogan:'✨ قبة واحدة وسلام لا نهاية له',
    s8_main:'الرحلة الروحانية داخل المسجد',s8_sub:'🕌 صحن المسجد',s8_slogan:'🌌 الختام تحت القبة',
    s9_main:'حان وقت الوداع',s9_sub:'🌊 دعوة إلى جسر القلب',s9_slogan:'✨ اترك أثرك في هذه القصة',
    s10_main:'🖋️ جسر القلب',s10_slogan:'"شفاء الماضي يلتقي بكلمات اليوم."',
    nav_back:'→ عودة',
    s0_ct1:'👑 التاريخ',s0_ct2:'🏗️ البنية',s0_ct3:'🎧 مرشدك',s0_ct4:'📵 تنبيه',s0_ct5:'📍 الموقع',s0_ct6:'🏫 التوجيه',
    s0_c1:'أنت الآن في أحد أكثر المواقع التاريخية سحراً في أدرنة — متحف الصحة في كلية السلطان بايزيد الثاني. أهلاً وسهلاً بك في هذا المكان الذي يلتقي فيه التاريخ بالشفاء.',
    s0_c2:'شيّد هذه المجمع السلطانُ بايزيد الثاني، ابن محمد الفاتح والسلطان العثماني الثامن، بإشراف المعمار الرئيسي حيرالدين، وهو أفضل كلية عثمانية محفوظة على الإطلاق. في مركزه المسجد، وعن يمينه المستشفى والمدرسة، وعن يساره الإمارة والمخزن، وعلى جانبي المسجد دور الضيافة، وخلفه جسر يعلو نهر تونجا — كل ذلك يجسّد نموذج الدولة الاجتماعية العثمانية.',
    s0_c3:'سأرشدك عبر الكلية ومتحفنا بمحتوى مكتوب وصوتي ومرئي لإثراء زيارتك.',
    s0_c4:'يرجى إبقاء انتباهك على هاتفك المحمول طوال الجولة.',
    s0_c5:'لقد تجاوزت بوابة التذاكر وأنت الآن في الحديقة الأمامية. يرجى الوقوف أمام الصورة الكبيرة للكلية المعلّقة على الجدار المقابل، ودراسة موقع هذه المنشآت داخل مدينة أدرنة.',
    s0_c6:'بينما تسير نحو هذه النقطة، المبنى على يمينك هو المدرسة الطبية للكلية، والمبنى المواجه لك هو دار الشفاء — قلب الكلية ومركز متحفنا.',
    s0_callout:'👣 <strong>بعد مطالعة الصورة الكبيرة، ادخل إلى حديقة دار الشفاء من الباب المجاور مباشرةً على يسارك.</strong>',
    s0_fwd:'ابدأ الرحلة عبر الزمن →',
    s1_ct1:'🏥 دار الشفاء — الصحن الأول',s1_ct2:'🌍 الأهمية التاريخية',s1_ct3:'🛏️ غرف الخدمة',s1_ct4:'🩺 غرف العيادات الخارجية',s1_ct5:'🧭 الإرشادات',s1_ct6:'💧 بئر الحليب',s1_ct7:'🌿 الشجرة واللبلاب',s1_ct8:'🎬 قاعة العرض',
    s1_c1:'أنت الآن في الصحن الأول لدار شفاء أدرنة، أحد أهم مراكز الشفاء في الإمبراطورية العثمانية. يرجى التوقف هنا لحظة ومراقبة محيطك.',
    s1_c2:'أولاً، اعلم أن هذا المبنى يُعدّ من أوائل نماذج المستشفيات المخطَّطة بشكل مركزي ودقيق في التاريخ. ظهرت نظيراتها الغربية بعد نحو ٢٠٠ عام — إذ تحقّقت هنا مناطق العلاج والخدمة برؤية معمارية تسبق عصرها بكثير.',
    s1_c3:'بينما تسير على الطريق أمامك، الغرف الأربع المجاورة مباشرةً لجهة اليسار هي وحدات الخدمة في دار الشفاء: غرفة الموظفين، والمغسلة، والمطبخ الغذائي، ومخزن المؤن.',
    s1_c4:'على يمينك، خلف الأعمدة، ست غرف للعيادات الخارجية حيث كانت تُجرى الفحوصات اليومية للمرضى والرعاية والتدخلات الطارئة. في سنوات التأسيس، كانت إحدى هذه الغرف مخصصة لأطباء العيون المعروفين بـ"الكحّال".',
    s1_c5:'اترك الزيارة التفصيلية لهذه الغرف — المزوّدة بالمعروضات ولوحات المعلومات — لعودتك، ودعني أرشدك الآن نحو قاعة العرض. تقع ما وراء الصحن الأول، على اليسار. بينما تسير، يرجى ملاحظة البئر على يسارك.',
    s1_c6:'هذا البناء الحجري يُسمّى "بئر الحليب"، إذ كان يُعتقد أن ماءه يزيد في حليب الأمهات المرضعات. على بُعد نحو ٢٠ متراً في العشب، ستجد شجرة يلتفّ حولها اللبلاب.',
    s1_c7:'حين تصل إلى تلك البقعة، احرص على قراءة قصيدة الحب الحزينة التي كتبها أحمد قدسي تيجر عن هذه الشجرة، المعروضة على لوحة في العشب. ثم انظر إلى الشجرة واللبلاب مجدداً وفي قلبك ذلك الشعور.',
    s1_c8:'بعد القصيدة مباشرةً، على يسارك فوراً، توجد قاعة العرض. هنا يمكنك مشاهدة فيلم عن تاريخ الكلية ودار الشفاء وتطوّرهما، لتحظى بفهم شامل لأهمية هذا المكان في تاريخ الطب والعمارة.',
    s1_callout:'🎬 <strong>هل تودّ مشاهدة فيلم العرض التقديمي؟</strong> يمكنك مشاهدته في قاعة العرض أو الضغط على الزر أدناه لمشاهدته على هاتفك.',
    s1_watch:'شاهد العرض ▶',s1_fwd:'إلى قاعة العرض →',
    s2_ct1:'🚪 الدخول إلى الصحن الثاني',s2_ct2:'🏛️ الغرف الإدارية',s2_ct3:'🔒 القسم الإداري',s2_ct4:'✨ النقش والمدخل',
    s2_c1:'فور خروجك من قاعة العرض، مرّ عبر الباب الكبير على يسارك مباشرةً إلى الصحن الثاني، حيث توجد المكاتب الإدارية.',
    s2_c2:'في هذا الصحن أربع غرف — اثنتان في كل جانب. استخدم الطبيب الرئيسي وسائر الأطباء هذه الغرف؛ وهنا كانت تُخطَّط جميع عمليات المستشفى وتُدار. في سنوات التأسيس، كان في هذا الدار طبيبٌ رئيسي واحد، وطبيبان، وجرّاحان، وطبيبا عيون، وصيدلاني.',
    s2_c3:'خدم هذا القسم الإداري أيضاً حاجزاً واقياً بين تدفق المرضى اليومي في الصحن الأول وجناح العلاج الداخلي الذي توشك على دخوله.',
    s2_c4:'الآن اقرأ النقش المكتوب فوق الباب، ثم احبس أنفاسك…',
    s2_callout:'🚶‍♂️ <strong>ادخل إلى هذا المكان السحري حيث تلتقي الموسيقى وصوت الماء بالشفاء.</strong>',
    s2_fwd:'اكتشف المارستان الكبير →',
    s3_ct1:'🏥 جناح العلاج الداخلي',s3_ct2:'🌊 هيكل المستشفى',s3_ct3:'🎵 العلاج بالموسيقى',s3_ct4:'💧 العلاج بالماء',s3_ct5:'🌿 العلاج بالروائح',s3_ct6:'🧺 العلاج الوظيفي',s3_ct7:'🚶 الخروج والجولة',
    s3_c1:'أنت الآن في قلب متحفنا وفي جناح العلاج الداخلي لدار شفاء أدرنة. سر في هذا الفضاء بمشاعر من وجدوا شفاءهم هنا منذ ٥٠٠ عام.',
    s3_c2:'تخيّل مستشفى يستقبلك فيه نافورة تتدفق بإيقاع منتظم في المركز، ومسرح موسيقي مباشرةً في مواجهتها. يتألف هذا المستشفى المخطَّط مركزياً المغطّى بقبة واسعة من ٦ غرف للمرضى شتاءً و٤ غرف صيفاً ومسرح موسيقي. يقوم الفانوس في القبة بتهوية الهواء الفاسد. أما الأرضية المائلة والقنوات تحتها فتيسّر الغسيل والتنظيف.',
    s3_c3:'ما ميّز هذا المستشفى عن غيره هو استخدام المقامات الموسيقية في العلاج إلى جانب المعرفة الطبية المعاصرة. كان فريق موسيقي من ١٠ عازفين يؤدّي ويغنّي مقامات مختلفة لأمراض مختلفة بحسب توصية الأطباء — إذ كان يُعتقد بفائدتها لحالات متعددة.',
    s3_c4:'كان صوت الماء الجاري من النافورة في مركز المبنى جزءاً مهماً من العلاج، يهدف إلى تهدئة المرضى وطمأنتهم.',
    s3_c5:'إلى جانب الموسيقى وأصوات الماء، كان العلاج بالروائح يُمارَس أيضاً في دار الشفاء. كانت عطور النباتات المزروعة في الصحن وما حوله جزءاً لا يتجزأ من مسيرة الشفاء.',
    s3_c6:'كان العلاج الوظيفي يُستخدم أيضاً هنا كأسلوب علاجي. كان المرضى يشاركون في نسج السلال والتطريز وفنون حرفية مختلفة لصرف أفكارهم عن همومهم ومخاوفهم.',
    s3_c7:'بعد جولة الغرف التي تعرض مختلف جوانب الطب العثماني، يمكنك الخروج من الجناح الداخلي. وأنت تغادر هذا المكان الذي خدم بلا انقطاع ٤٠٠ عام، يمكنك زيارة الغرف الأخرى في الصحنين الأول والثاني لمعرفة المزيد عن دار الشفاء والطب العثماني.',
    s3_callout:'🏫 <strong>نحو المدرسة الطبية:</strong> اخرج من دار الشفاء وسِر نحو المدرسة الطبية الواقعة على يسار حديقة المدخل ذات الصورة الكبيرة.',
    s3_fwd:'إلى المدرسة →',
    s4_ct1:'🏫 المدرسة الطبية',s4_ct2:'🌍 الأهمية التاريخية',s4_ct3:'📚 منظومة التعليم',s4_ct4:'🏛️ البنية المعمارية',s4_ct5:'📜 أوليا جلبي',s4_ct6:'👨‍🏫 هيئة التدريس',s4_ct7:'📖 المخطوطات',s4_ct8:'🏥 متحف الصحة',
    s4_c1:'لقد جُلتَ في دار الشفاء ودخلتَ الآن قسماً آخر بالغ الأهمية في الكلية — المدرسة الطبية للسلطان بايزيد الثاني. قبل دخول قاعات المتحف على اليمين والمقابلة، قف وادرس هذا الفضاء الفريد.',
    s4_c2:'ما تراه الآن مبنى منتظماً حول صحن مربع كان أحد أرقى المؤسسات التعليمية التي تُخرّج الأطباء في الإمبراطورية العثمانية — مركزاً علمياً مهماً أنتج أطباء بارزين كثيرين عبر القرون.',
    s4_c3:'وهي مُصنَّفة ضمن أرقى المدارس "ذات الستين أقچه فأكثر" في النظام التعليمي العثماني، حيث كان الطلاب يطبّقون تدريبهم النظري في دار الشفاء المجاورة، ويعزّزون معرفتهم بالممارسة.',
    s4_c4:'تضم المدرسة — التي كان في مركزها نافورة (لم تعد موجودة) وبئر في الزاوية للمياه — ١٨ غرفة للطلاب على ثلاثة جوانب وقاعة محاضرات مباشرةً في المواجهة.',
    s4_c5:'كتب أوليا جلبي الذي زار الكلية عام ١٦٥٢ عن هذه المدرسة: "في المدرسة الطبية وغرفها طلاب يتحدثون باستمرار عن علماء كأفلاطون وسقراط وأرسطو وجالينوس وفيثاغورس — كلٌّ منهم طبيب ناضج. كلٌّ مكرّس لفرع من المعرفة، يعتمد على كتب ثمينة في فن الطب، يسعى لإيجاد علاجات لأمراض البشرية."',
    s4_c6:'ضمّت هيئة التدريس أستاذاً يتقاضى ٦٠ أقچه يومياً يُدرّس ١٨ طالباً، وأستاذاً مساعداً، وأمين مكتبة، وخادمَين. كانت جميع احتياجات الطلاب مكفولة، فضلاً عن منحة دراسية يومية قدرها أقچتان.',
    s4_c7:'٣٨ مخطوطة طبية مكتوبة بخط اليد درست هنا — تحمل كثيرٌ منها أختام السلاطين العثمانيين — نجت حتى يومنا هذا. هذه الأعمال النفيسة محفوظة الآن في مكتبة سليمية للمخطوطات.',
    s4_c8:'افتُتحت المدرسة من قِبل جامعة تراقيا عام ٢٠٠٧ قسماً ثانياً لمتحف الصحة. غرفها تروي التعليم الطبي في تلك الحقبة. أهم قسم فيها هو قاعة المحاضرات مباشرةً أمام المدخل.',
    s4_callout:'🚶 <strong>بعد جولة غرف الطلاب وقاعات التدريب العملي وغرفة الأستاذ وقاعة المحاضرات والمكتبة — المُهيَّأة بالمانيكان لتعكس أجواء القرن الخامس عشر — اخرج من المدرسة وامش عبر البوّابة الدوّارة قرب مخرج دار الشفاء إلى صحن المسجد لمواصلة الطريق نحو الإمارة.</strong>',
    s4_fwd:'نحو جلال المسجد →',
    s5_ct1:'🌳 إلى الحديقة',s5_ct2:'💧 ميزان الماء',s5_ct3:'🕌 البوابة الرئيسية للمسجد',s5_ct4:'🏛️ المخزن والإمارة',
    s5_c1:'بعد جولتك في دار الشفاء والمدرسة، دخلتَ حديقة المسجد. سِر ببطء في هذه الحديقة الجميلة ذات أشجار الدلب المعمّرة، متجهاً نحو قسم الإمارة في المتحف أمامك مباشرةً.',
    s5_c2:'حين تدخل الحديقة من جهة دار الشفاء، أول ما تلاحظه على يمينك — عند زاوية المسجد — بنيانٌ حجري مستطيل يبلغ ارتفاعه نحو ٤ أمتار. هذا ميزان ماء الكلية. كان الماء المجلوب بالأنابيب من التلال العالية يوازَن ضغطه أولاً داخل هذا البنيان قبل توزيعه على الوحدات الأخرى للكلية.',
    s5_c3:'بعد تجاوز ميزان الماء، ستستقبلك البوابة الرئيسية الفخمة للمسجد على يمينك. دعنا نُرجئ استكشاف صحن المسجد عبر هذه البوابة إلى نهاية جولتنا، ونواصل المسير نحو الإمارة.',
    s5_c4:'أمامك مبنيان كبيران بطراز معماري متشابه يقفان جنباً إلى جنب. الأيسر يضم المخزن والمخبز، ويُستخدم الآن للفعاليات العلمية والثقافية للمتحف. الأيمن هو الإمارة التي أوجّهك إليها الآن.',
    s5_callout:'🍲 <strong>هل أنت مستعد لمشاهدة ثقافة الإمارة العثمانية وسماع أسطورة الطباخ يحيى بابا؟ أبرِز تذكرتك عند البوابة الدوّارة وادخل هذا القسم، ثم اضغط على المحطة التالية للمتابعة.</strong>',
    s5_fwd:'إلى قلب الوفرة →',
    s6_ct1:'🏛️ الإمارات',s6_ct2:'🍲 إمارة السلطان بايزيد الثاني',s6_ct3:'🔥 المطبخ وقاعة الطعام',s6_ct4:'🎭 هذا القسم من المتحف',s6_ct5:'🌿 ضريح يحيى بابا',s6_ct6:'📖 أسطورة يحيى بابا',s6_ct7:'⚖️ اختبار أمين المخزن',s6_ct8:'👑 شهادة السلطان',s6_ct9:'🐟 معجزة السمك',s6_ct10:'🤲 رحيل يحيى بابا',s6_ct11:'🪦 زيارة الضريح',
    s6_c1:'في الإمبراطورية العثمانية، كانت الإمارات من أهم المؤسسات التي تجسّد روح التضامن الاجتماعي والعطاء. فهذه المطابخ الخيرية التي وزّعت الطعام مجاناً على الفقراء والمسافرين والطلاب والمعوزين لم تكن مجرد مطابخ — بل كانت مراكز حيوية تحمي المحتاجين وتحفظ التوازن الاجتماعي.',
    s6_c2:'وأنت الآن داخل مثل هذا المكان. إمارة كلية السلطان بايزيد الثاني، المُنشأة قسماً ثالثاً لمتحف الصحة، كانت مؤسسة خيرية مهمة تُطبخ فيها ثلاث وجبات يومياً وتُوزَّع على الفقراء وفق وقفيتها.',
    s6_c3:'الفضاء الرحب الذي تواجهه عند الدخول هو المطبخ حيث كان الطعام يُطهى في قدور كبيرة. القاعة الكبيرة التي تراها عبر الباب على يمينك مباشرةً هي حيث كانت الوجبات تُتناول على موائد حجرية في الأرضية.',
    s6_c4:'كسائر أقسام متحف الصحة، يزخر هذا القسم بالمانيكان الملائمة لروح المكان، تروي ثقافة الإمارة العثمانية وتصحب الزوار في رحلة عبر الزمن. تُعرض هنا أيضاً أوعية نحاسية أصلية وهاوون ومرطبانات تخزين من تلك الحقبة.',
    s6_c5:'خلف الإمارة مباشرةً ضريح الطباخ يحيى بابا، الشخصية الأسطورية. بينما تستكشف هذا المبنى الرحب الشيّق، دعني أحكي لك أسطورة الطباخ يحيى بابا المتوارثة حتى يومنا هذا.',
    s6_c6:'وفق الحكاية، كان يحيى بابا، رئيس الطباخين في عهد مؤسس الكلية السلطان بايزيد الثاني، يصنع أرزاً بالغ اللذة. وبينما يحرّك الأرز كان يدعو الله باستمرار، وحين يغلق الغطاء يقول: "يا ربّ، أنعم بالوفرة". فكان الأرز وفيراً يكفي جميع المرضى ويفضل منه. ولم يكن يحيى بابا يُلقي بالأرز الزائد — بل كان يحمله ليُطعم به الأسماك في نهر تونجا.',
    s6_c7:'حين لاحظ أمين المخزن أن يحيى بابا يُطعم الأرز الزائد للنهر، بدأ يُنقص كمية الأرز المعطاة له يوماً بعد يوم. ومع ذلك، حتى بأرز أقل، كان يحيى بابا يطبخ الأرز بالدعاء، فيُشبع المرضى والأسماك على حدٍّ سواء. وفي النهاية قلّص المخصص إلى حفنة واحدة. فحتى بحفنة واحدة كان أرز يحيى بابا يُشبع جميع المرضى وما زال يُفرز نصيباً للأسماك.',
    s6_c8:'بلغ الأمر في نهاية المطاف إلى السلطان. فقرر أن يشهد الأمر بنفسه، فجاء إلى ضفة نهر تونجا قبل يحيى بابا واختبأ. وحين همّ يحيى بابا بالعودة بعد إطعام الأسماك، خرج السلطان من مخبئه وزمجر: "أنت هناك — أتصبّ رزق المرضى في النهر؟"',
    s6_c9:'جُمّد يحيى بابا في مكانه. لم يستطع أن يتفوّه بكلمة. اعتراه من الخجل ما جعله يسجد ويلوذ بالله. غير أن الأسماك رفعت رؤوسها من الماء وتكلّمت: "أيبخل السلطان العظيم على الأسماك برزقها؟"',
    s6_c10:'أدرك السلطان في دهشة وحزن خطأه، وانتظر أن يرفع يحيى بابا رأسه من السجود — لكن دون جدوى. فقد فارق هذا الرجل الطيب القلب الحياة بالفعل…',
    s6_c11:'يُزار ضريح يحيى بابا الواقع خلف الإمارة مباشرةً كضريح وليّ يأتيه المارة للدعاء. لا سيما أيام الجمعة، إذ يمتلئ الضريح بالزوار.',
    s6_callout:'🪦 <strong>دور الضيافة:</strong> بعد سماع هذه الأسطورة، حان وقت مغادرة الإمارة والاستراحة في مقهى المتحف على اليسار. في مقهى المتحف داخل دار ضيافة الكلية، يمكنك الاستمتاع بالشاي وبخاصة شراب الشربات العثماني، وشراء الهدايا والكتب، والتجوال في مكتبة المتحف، ثم التوجه إلى المحطة الأخيرة — صحن المسجد. هل نأخذ استراحة قصيرة في دار ضيافة الكلية؟',
    s6_fwd:'نحو مقهى المتحف →',
    s7_ct1:'🏛️ الصحن والدخول إلى المسجد',s7_ct2:'🚪 المدخل والأجواء',s7_ct3:'⛲ النافورة والسكينة',s7_ct4:'🏛️ الأعمدة الرخامية والتناسق المعماري',s7_ct5:'✨ السلام الداخلي والطمأنينة',s7_ct6:'👁️ لحظات المراقبة',s7_ct7:'🚪 الدخول إلى المسجد',s7_ct8:'🪵 فن الكُنْدَكاري الخشبي',
    s7_c1:'لقد جُلتَ في أقسام متحف الصحة وتذوّقتَ الشربات العثماني المنعش في المقهى. حان الآن وقت لقاء أحد أعظم منشآت الكلية — المسجد.',
    s7_c2:'حين تخطو من الباب الجانبي الأنيق المفتوح على الصحن، أو عبر البوابة الرئيسية الشامخة، يستقبلك الرخام بنقوشه الرفيعة. في لحظة واحدة تترك خلفك صخب العالم الخارجي وتنزلق إلى أجواء مختلفة كلياً.',
    s7_c3:'النافورة في وسط الصحن تملأ الفضاء بالسلام عبر خرير الماء الهادئ. هذا الصوت مع صمت الحجر يُبطئ خطاك ويجعلك واعياً للحظة الراهنة.',
    s7_c4:'الأعمدة الرخامية المحيطة بك ترتفع كخاتم واقٍ. اختُيرت بألوان مختلفة تجسّد رقي الجماليات العثمانية وغناءها المتناسق.',
    s7_c5:'ما تشعر به هنا ليس مجرد جمال معماري — بل هو سكينة وسلام داخلي لم يتغير على مدى قرون.',
    s7_c6:'توقف لحظة عند النافورة وراقب هذا التنظيم البسيط والمؤثر للصحن. أحسس التناسق الذي تصنعه الأعمدة والأقواس والزخارف الرقيقة في ما بينها.',
    s7_c7:'ثم اتجه نحو البوابة الشامخة التي تعلو أمامك مباشرةً. أزِح بلطف الستار الجلدي المغطي للباب وادخل. ستشعر فوراً أنك دخلت أحد أرقى مساجد بلادنا.',
    s7_c8:'حين تدخل، لا تنسَ الانتباه إلى فن الكُنْدَكاري الخشبي الأصيل فوق الباب — وإن أمكن، تلمّس نسيج هذه الصنعة الرائعة.',
    s7_callout:'🕌 <strong>هل ندخل الفضاء الرحب والسكينة داخل الحرم؟</strong>',
    s7_fwd:'المضيّ إلى الداخل →',
    s8_ct1:'🕌 داخل المسجد — الختام',s8_ct2:'🚤 التنقل التاريخي والتقليد السلطاني',s8_ct3:'👑 تخيّل الشرفة السلطانية',s8_ct4:'🏛️ الشرفة السلطانية وسبقها',s8_ct5:'⚙️ المحراب وحجارة التوازن',s8_ct6:'🪵 المنبر والنقوش الرقيقة',s8_ct7:'📐 الرموز والمعاني',s8_ct8:'💡 الإضاءة والنظام الصوتي',s8_ct9:'🌌 الجلال تحت القبة',s8_ct10:'🏗️ منعطف معماري',s8_ct11:'✨ الختام والوداع',
    s8_c1:'أنت الآن داخل المسجد في مركز الكلية، ونحن نُتمّ ختام جولتنا تحت هذه القبة الشامخة.',
    s8_c2:'كان السلطان بايزيد الثاني مؤسس الكلية والسلاطين من بعده يصلون إلى هذا المسجد بالإبحار على طول النهر في زوارق سلطانية مزيّنة. كانوا يدخلون عبر باب جانب النهر ويؤدّون صلواتهم في الشرفة السلطانية — الهنكار محفلي — المرتفعة على أعمدة في الزاوية اليسرى للمسجد.',
    s8_c3:'أغمض عينيك لحظة… تخيّل السلطان في تلك العلوّ، يتعبّد في السلام ذاته جنباً إلى جنب مع الجماعة.',
    s8_c4:'مستحضراً أن أول شرفة سلطانية بُنيت على الإطلاق في العمارة التركية الإسلامية تقع هنا، لنمشِ الآن نحو المحراب.',
    s8_c5:'حين تلمس حجارة التوازن الأسطوانية على جانبَي المحراب وتدوّرها برفق، ستندهش لأن أرضية هذا البنيان العظيم لا تُظهر أدنى انحراف.',
    s8_c6:'حين تقترب من المنبر على اليمين، ستنبهر بدقة الصنعة الرخامية وأناقتها.',
    s8_c7:'أقترح عليك الآن أن تدير ظهرك نحو المحراب وتنظر فوق باب المدخل. زخرفة الصينية بالبطيخة في مركزها، المتوضّعة مباشرةً فوق الباب، ترمز إلى وجود إمارة في هذه الكلية وأن القادمين إليها مدعوون إلى وليمة.',
    s8_c8:'النوافذ حول القبة وفي الصفوف السفلية تضمن توزيع الضوء بالتساوي في الفضاء كله. هذا الترتيب الإضاءوي مع الصوتيات القوية للمسجد يمنح الفضاء عمقاً بصرياً وسمعياً في آنٍ واحد.',
    s8_c9:'والآن ارفع بصرك إلى العلاء… تأمّل هذه القبة الفارهة المزيّنة بزخارف باروكية. يبلغ ارتفاعها نحو ٣١ متراً وقطرها ٢٢ متراً، وترتكز على أربعة جدران دون أعمدة وسطى — وهو نموذج رائع من الناحية المعمارية.',
    s8_c10:'كما تُعدّ سلفاً مهماً للانتقال نحو المنشآت ذات القبة الواحدة.',
    s8_c11:'تحت نعمة هذه القبة المنقطعة النظير وجلالها، نختم هذه الرحلة التي ربطت فيها آثار الماضي بصمت اليوم — لا تنسَ أن تحمل معك السلام والدهشة اللذَين خلّفهما هذا المكان في قلبك.',
    s8_callout:'🙏 <strong>هل نضع وداعاً هادئاً على هذه الرحلة الروحانية؟</strong>',
    s8_fwd:'نحو الوداع →',
    s9_c1:'🏛️ تتبّعنا خطوات الماضي خطوةً خطوة، وتنفّسنا معاً في رحاب هذه العمارة الرائعة. حان الآن وقت إضافة نفَسك أنت إلى هذا المكان التاريخي.',
    s9_c2:'💭 ما الذي يتردد صداه بداخلك… لحظة سلام، إعجاب عميق، أو تلك النغمة الهادئة العالقة في قلبك…',
    s9_c3:'📖 سجل الزوار الذي أعددناه لك هو أرشيف روحاني لهذه التجربة. كل جملة تتركها هنا ستكون: ذكرى ثمينة لنا، ونوراً يمنح المعنى لهذه الرحلة لضيوفنا الآخرين.',
    s9_c4:'✨ شاركنا ما يفيض من قلبك — ولتبقَ علامتك إلى الأبد على جسر القلب…',
    s9_callout:'✍️ <strong>ندعوك لمشاركة مشاعرك على صفحة جسر القلب.</strong>',
    s9_fwd:'الكتابة إلى جسر القلب →',
    s10_body:'يسعدنا سماع الانطباعات التي تركتها رحلة ٥٠٠ عام هذه عبر كليّتنا في نفسك. كلماتك ستصبح حجارة هذا الجسر.',
    s10_restart:'🏛️ العودة إلى البداية'
  },
  ro:{
    start:'ÎNCEPE CĂLĂTORIA',intro_title:'Invitație la Prag',intro_sub:'O călătorie dincolo de timp, spre centrul vindecării…',
    back:'← ÎNAPOI',menu_lang:'Limba: Română 🇷🇴',menu_map:'Hartă și Locație',menu_defter:'Podul Inimii',
    loc_searching:'📍 Se obține locația…',loc_outside:'📍 Sunteți în afara zonei Külliye.',
    loc_error:'📍 Nu s-a putut obține locația. Vă rugăm să activați permisiunea de locație.',
    gb_name:'Numele tău',gb_city:'Orașul tău',gb_msg:'Lasă-ți sentimentele aici…',
    gb_submit:'ADAUG PIATRA MEA LA POD 🪨',gb_submitting:'Se sigilează…',
    gb_conn_err:'Eroare de conexiune. Vă rugăm să încercați din nou.',gb_no_msg:'Vă rugăm să lăsați un mesaj…',
    confirm_text:'Sentimentele tale au fost sigilate pe Podul Inimii. Urma semnificativă pe care ai lăsat-o îmbogățește moștenirea spirituală a complexului nostru Külliye…',
    confirm_close:'SĂ FII VINDECAT 🌿',latest_title:'📜 Mesaje Recente',archive_title:'🗂️ Arhivă',
    no_msg:'Niciun mesaj încă. Fii primul care adaugă o piatră! ✨',
    s0_main:'🏛️ KÜLLIYE SULTAN BAYEZID II',s0_sub:'MUZEUL SĂNĂTĂȚII',s0_slogan:'✨ CĂLĂTORIA VINDECĂRII — INTRAREA ÎN MUZEU',
    s1_main:'Intrarea în Darüşşifa',s1_sub:'🏛️ POARTA DREPTĂȚII ȘI A VINDECĂRII',s1_slogan:'⚖️ PRIMA OPRIRE A VINDECĂRII',
    s2_main:'Ieșirea din Sala de Prezentare',s2_sub:'🏛️ DE LA CUNOAȘTERE LA EXPERIENȚĂ',s2_slogan:'🏛️ ADMINISTRARE ȘI ORDINE',
    s3_main:'Marea Infirmerie (SALA OCTOGONALĂ)',s3_sub:'🏛️ PRAGUL DIN DARÜŞŞIFA',s3_slogan:'🌊 APOGEUL VINDECĂRII',
    s4_main:'Școala de Medicină (Madrasa)',s4_sub:'🎓 LEAGĂNUL CUNOAȘTERII',s4_slogan:'📚 LUMINA ÎNVĂȚĂRII',
    s5_main:'Marea Curte',s5_sub:'🌿 PLATANI SECULARI',s5_slogan:'🌳 TIMP ȘI TRANCHILITATE',
    s6_main:'Imaret (Cantina Socială)',s6_sub:'🍲 COMPASIUNE ȘI ABUNDENȚĂ',s6_slogan:'🍲 BUCĂTĂRIA LUI YAHYA BABA',
    s7_main:'Pregătirea pentru o Atmosferă Spirituală',s7_sub:'🕌 INTRAREA ÎN MOSCHEE',s7_slogan:'✨ O CUPOLĂ, PACE INFINITĂ',
    s8_main:'Călătorie Spirituală în Interiorul Moscheii',s8_sub:'🕌 CURTEA MOSCHEII',s8_slogan:'🌌 FINAL SUB CUPOLĂ',
    s9_main:'Timpul pentru Rămas Bun',s9_sub:'🌊 INVITAȚIE PE PODUL INIMII',s9_slogan:'✨ LASĂ-ȚI URMA ÎN ACEASTĂ POVESTE',
    s10_main:'🖋️ Podul Inimii',s10_slogan:'"Vindecarea trecutului întâlnește cuvintele de astăzi."',
    nav_back:'← ÎNAPOI',
    s0_ct1:'👑 ISTORIE',s0_ct2:'🏗️ STRUCTURĂ',s0_ct3:'🎧 GHIDUL TĂU',s0_ct4:'📵 ATENȚIE',s0_ct5:'📍 LOCAȚIE',s0_ct6:'🏫 ORIENTARE',
    s0_c1:'Vă aflați acum într-unul dintre cele mai fascinante situri istorice din Edirne — Muzeul Sănătății din cadrul Complexului Sultan Bayezid II. Bine ați venit în acest loc unde istoria și vindecarea se întâlnesc.',
    s0_c2:'Construit de Sultanul Bayezid al II-lea, fiul lui Mehmed Cuceritorul și al 8-lea sultan otoman, sub conducerea arhitectului-șef Hayrettin, acest complex este cel mai bine conservat külliye dintre toate complexele otomane. În centru se află moscheea; la dreapta, spitalul și madrasa; la stânga, imaretul și cămara; atașate de laturile moscheii sunt casele de oaspeți, iar în spate, un pod peste râul Tunca — toate întruchipând modelul statului social otoman.',
    s0_c3:'Vă voi ghida prin Külliye și prin muzeul nostru cu conținut scris, audio și vizual pentru a vă îmbogăți vizita.',
    s0_c4:'Vă rugăm să vă mențineți atenția asupra telefonului mobil pe tot parcursul turului.',
    s0_c5:'Ați trecut de casa de bilete și vă aflați acum în grădina din față. Vă rugăm să stați în fața fotografiei mari a complexului Külliye de pe peretele opus și să studiați locația acestor structuri în cadrul orașului Edirne.',
    s0_c6:'Pe măsură ce mergeți spre acest punct, clădirea din dreapta dumneavoastră este Madrasa Medicală, iar clădirea direct în față este Darüşşifa — probabil inima complexului și centrul muzeului nostru.',
    s0_callout:'👣 <strong>După ce examinați fotografia mare, intrați în grădina Darüşşifa prin ușa imediat din stânga dumneavoastră.</strong>',
    s0_fwd:'ÎNCEPE CĂLĂTORIA ÎN TIMP →',
    s1_ct1:'🏥 DARÜŞŞIFA — PRIMA CURTE',s1_ct2:'🌍 SEMNIFICAȚIE ISTORICĂ',s1_ct3:'🛏️ CAMERE DE SERVICIU',s1_ct4:'🩺 CAMERE PENTRU PACIENȚI EXTERNI',s1_ct5:'🧭 DIRECȚII',s1_ct6:'💧 FÂNTÂNA CU LAPTE',s1_ct7:'🌿 ARBORELE ȘI IEDERA',s1_ct8:'🎬 SALA DE PREZENTARE',
    s1_c1:'Vă aflați acum în prima curte a Darüşşifa din Edirne, unul dintre cele mai importante centre de vindecare ale Imperiului Otoman. Vă rugăm să vă opriți aici pentru un moment și să observați împrejurimile.',
    s1_c2:'În primul rând, trebuie să știți: această clădire este recunoscută ca unul dintre primele exemple de spital planificat centralizat și meticulos din istorie. Omologii occidentali au apărut abia aproximativ 200 de ani mai târziu — aici, zonele de tratament și servicii au fost realizate cu o viziune arhitecturală mult înaintea timpului său.',
    s1_c3:'Pe măsură ce înaintați pe poteca din față, cele patru camere imediat la stânga intrării sunt unitățile de serviciu ale Darüşşifa: o cameră pentru personal, o spălătorie, o bucătărie dietetică și o cămară pentru depozitarea proviziilor.',
    s1_c4:'În dreapta dumneavoastră, în spatele coloanelor, sunt șase camere pentru pacienți externi unde se efectuau consultații zilnice, îngrijiri și intervenții de urgență. În primii ani, una dintre aceste camere era rezervată medicilor oftalmologi cunoscuți sub numele de "kehhal".',
    s1_c5:'Lăsați vizitarea detaliată a acestor camere — amenajate cu exponate și panouri informative — pentru întoarcere, și permiteți-mi să vă ghidez acum spre sala noastră de prezentare. Aceasta se află după prima curte, pe stânga. În timp ce mergeți acolo, vă rugăm să observați fântâna din stânga.',
    s1_c6:'Această structură de piatră este numită "Fântâna cu Lapte", deoarece se credea că apa sa sporea producția de lapte a proaspetelor mame. Aproximativ 20 de metri mai departe, printre iarbă, veți vedea un copac cu iederă înfășurată în jurul lui.',
    s1_c7:'Când ajungeți în acel loc, asigurați-vă că citiți poezia de dragoste melancolică scrisă de Ahmet Kutsi Tecer despre acest copac, afișată pe un panou în iarbă. Apoi priviți copacul și iedera încă o dată, cu acel sentiment în inimă.',
    s1_c8:'Imediat după poezie, în stânga, se află sala noastră de prezentare. Aici puteți viziona un videoclip despre istoria și dezvoltarea Külliye și a Darüşşifa, obținând o înțelegere cuprinzătoare a importanței acestui loc în istoria medicinei și a arhitecturii.',
    s1_callout:'🎬 <strong>Doriți să vizionați videoclipul de prezentare?</strong> Îl puteți viziona în sala de prezentare sau apăsați butonul de mai jos pentru a-l vedea pe telefon.',
    s1_watch:'VEZI PREZENTAREA ▶',s1_fwd:'SPRE SALA DE PREZENTARE →',
    s2_ct1:'🚪 INTRAREA ÎN A DOUA CURTE',s2_ct2:'🏛️ CAMERE ADMINISTRATIVE',s2_ct3:'🔒 SECȚIUNEA ADMINISTRATIVĂ',s2_ct4:'✨ INSCRIPȚIE ȘI INTRARE',
    s2_c1:'Imediat ce ieșiți din sala de prezentare, treceți prin ușa mare din stânga în a doua curte, unde se află birourile administrative.',
    s2_c2:'În această curte sunt 4 camere — câte două pe fiecare parte. Medicul-șef și ceilalți doctori foloseau aceste camere; toate operațiunile spitalului erau planificate și gestionate aici. În anii de fondare, această Darüşşifa avea 1 medic-șef, doi doctori, 2 chirurgi, 2 oftalmologi și 1 farmacist.',
    s2_c3:'Această secțiune administrativă servea și ca o barieră de protecție între fluxul zilnic de pacienți din prima curte și secția de tratament pentru pacienți internați în care urmează să intrați.',
    s2_c4:'Acum citiți inscripția scrisă deasupra ușii, apoi țineți-vă respirația…',
    s2_callout:'🚶‍♂️ <strong>Pășiți în acest loc magic unde muzica și sunetul apei întâlnesc vindecarea.</strong>',
    s2_fwd:'DESCOPERĂ MAREA INFIRMERIE →',
    s3_ct1:'🏥 SECȚIA DE TRATAMENT INTERN',s3_ct2:'🌊 STRUCTURA SPITALULUI',s3_ct3:'🎵 MUZICOTERAPIE',s3_ct4:'💧 TERAPIE PRIN APĂ',s3_ct5:'🌿 AROMATERAPIE',s3_ct6:'🧺 TERAPIE OCUPAȚIONALĂ',s3_ct7:'🚶 IEȘIRE ȘI TUR',
    s3_c1:'Vă aflați acum în inima muzeului nostru și în secția de tratament pentru pacienți internați a Darüşşifa din Edirne. Mergeți prin acest spațiu cu sentimentul celor care au găsit vindecarea aici acum 500 de ani.',
    s3_c2:'Imaginați-vă un spital unde sunteți întâmpinați de o fântână care curge într-un ritm constant în centru și o scenă muzicală direct vizavi. Acest spital planificat central, acoperit de o cupolă largă, constă în 6 saloane de iarnă, 4 saloane de vară și o scenă muzicală. Lanterna din cupolă are și rol de ventilare a aerului. Podeaua înclinată și canalele de dedesubt facilitează spălarea și curățarea ușoară.',
    s3_c3:'Ceea ce distingea acest spital de altele era utilizarea modurilor muzicale în tratament, alături de cunoștințele medicale contemporane. Un ansamblu muzical de 10 interpreți cânta diferite moduri pentru diferite boli, conform recomandărilor medicilor — crezându-se că acestea aduc beneficii în diverse afecțiuni.',
    s3_c4:'Sunetul apei care curgea din fântâna aflată în centrul clădirii era o parte importantă a tratamentului, având scopul de a calma și liniști pacienții.',
    s3_c5:'Pe lângă muzică și sunetele apei, în Darüşşifa se practica și aromaterapia. Parfumurile diverselor plante cultivate în curte și în împrejurimi erau o parte integrantă a procesului de vindecare.',
    s3_c6:'Terapia ocupațională era de asemenea folosită ca metodă de tratament aici. Pacienții erau implicați în împletirea coșurilor, tricotat și diverse meșteșuguri pentru a le distrage atenția de la griji și gânduri.',
    s3_c7:'După ce vizitați camerele care prezintă diferite aspecte ale medicinei otomane, puteți ieși din secția de internați. Părăsind acest loc de vindecare — care a servit continuu timp de 400 de ani — puteți vizita și celelalte camere din a doua și prima curte pentru a afla mai multe despre Darüşşifa și medicina otomană.',
    s3_callout:'🏫 <strong>SPRE MADRASA MEDICALĂ:</strong> Ieșiți din Darüşşifa și mergeți spre Madrasa Medicală, situată în stânga grădinii de la intrare cu fotografia mare.',
    s3_fwd:'MAI DEPARTE SPRE MADRASA →',
    s4_ct1:'🏫 MADRASA MEDICALĂ',s4_ct2:'🌍 SEMNIFICAȚIE ISTORICĂ',s4_ct3:'📚 SISTEMUL DE EDUCAȚIE',s4_ct4:'🏛️ STRUCTURA ARHITECTURALĂ',s4_ct5:'📜 EVLIYA ÇELEBİ',s4_ct6:'👨‍🏫 PERSONALUL DIDACTIC',s4_ct7:'📖 MANUSCRISE',s4_ct8:'🏥 MUZEUL SĂNĂTĂȚII',
    s4_c1:'Ați vizitat Darüşşifa și ați intrat acum într-o altă secțiune crucială a complexului — Madrasa Medicală Sultan Bayezid II. Înainte de a intra în camerele muzeului din dreapta și din partea opusă, opriți-vă și studiați acest spațiu unic.',
    s4_c2:'Ceea ce vedeți acum ca o clădire dispusă în jurul unei curți pătrate a fost una dintre cele mai prestigioase instituții de învățământ care a format medici în Imperiul Otoman — un centru important de învățare care a produs mulți doctori proeminenți de-a lungul secolelor.',
    s4_c3:'Clasată printre madrasale de cel mai înalt nivel "de grad 60 și peste" în sistemul de educație otoman, studenții de aici își puteau aplica pregătirea teoretică în Darüşşifa adiacentă, consolidându-și cunoștințele prin practică.',
    s4_c4:'Madrasa — cu o fântână (care nu mai există) în centru și un puț în colț pentru alimentarea cu apă — este formată din 18 camere pentru studenți dispuse pe trei laturi și o sală de curs direct opusă.',
    s4_c5:'Evliya Çelebi, care a vizitat Külliye în 1652, a scris despre această madrasa: "În Madrasa Medicală și în camerele sale se află studenți care vorbesc constant despre învățați precum Platon, Socrate, Aristotel, Galen și Pitagora — fiecare fiind medici maturi. Fiecare este dedicat unei ramuri a cunoașterii, bazându-se pe cărți valoroase în arta medicinei, străduindu-se să găsească remedii pentru suferințele omenirii."',
    s4_c6:'Personalul didactic includea un profesor plătit cu 60 de akçe pe zi care preda celor 18 studenți, un profesor asistent, un bibliotecar și doi servitori. Toate nevoile studenților erau asigurate, aceștia primind și o bursă zilnică de doi akçe.',
    s4_c7:'38 de manuscrise medicale scrise de mână studiate aici — multe purtând sigiliile sultanilor otomani — au supraviețuit până astăzi. Aceste lucrări prețioase sunt acum păstrate la Biblioteca de Manuscrise Selimiye.',
    s4_c8:'Madrasa a fost deschisă de Universitatea Trakya în 2007 ca a doua secțiune a Muzeului Sănătății. Camerele sale narează educația medicală a epocii. Cea mai importantă secțiune este sala de curs, direct vizavi de intrare.',
    s4_callout:'🚶 <strong>După ce vizitați camerele studenților, sălile de antrenament aplicat, camera profesorului, sala de curs și biblioteca — amenajate pentru a reflecta atmosfera secolului XV cu manechine — ieșiți din madrasa și treceți prin turnichetul de lângă ieșirea Darüşşifa spre curtea moscheii pentru a continua spre Imaret.</strong>',
    s4_fwd:'SPRE GRANDOAREA MOSCHEII →',
    s5_ct1:'🌳 ÎN GRĂDINĂ',s5_ct2:'💧 CÂNTARUL DE APĂ',s5_ct3:'🕌 POARTA PRINCIPALĂ A MOSCHEII',s5_ct4:'🏛️ CĂMARA ȘI IMARETUL',
    s5_c1:'După ce ați vizitat Darüşşifa și Madrasa, ați intrat în grădina moscheii. Mergeți încet prin această grădină frumoasă cu platani seculari, îndreptându-vă spre secțiunea Imaret a muzeului, aflată direct înainte.',
    s5_c2:'Pe măsură ce intrați în grădină dinspre Darüşşifa, primul lucru pe care îl veți observa în dreapta — la colțul moscheii — este o structură de piatră dreptunghiulară de aproximativ 4 metri înălțime. Acesta este cântarul de apă al complexului. Apa adusă prin conducte de pe dealurile înalte avea presiunea echilibrată în această structură înainte de a fi distribuită către celelalte unități ale complexului.',
    s5_c3:'După ce treceți de cântarul de apă, veți fi întâmpinați de portalul magnific al intrării principale a moscheii, în dreapta. Să lăsăm explorarea curții moscheii prin acest portal pentru sfârșitul turului nostru și să ne continuăm plimbarea spre Imaret.',
    s5_c4:'În față, două clădiri mari cu arhitectură similară stau una lângă alta. Cea din stânga conține cămara și secțiunea de brutărie, folosite acum pentru evenimentele științifice și culturale ale muzeului. Cea din dreapta este Imaretul spre care vă îndrum acum.',
    s5_callout:'🍲 <strong>Sunteți gata să vedeți cultura imaretului otoman și să auziți legenda bucătarului Yahya Baba? Atunci arătați biletul la turnichet și intrați în această secțiune, apoi apăsați pe următoarea oprire pentru a continua.</strong>',
    s5_fwd:'SPRE INIMA ABUNDENȚEI →',
    s6_ct1:'🏛️ IMARETELE',s6_ct2:'🍲 IMARETUL SULTAN BAYEZID II',s6_ct3:'🔥 BUCĂTĂRIA ȘI SALA DE MESE',s6_ct4:'🎭 ACEASTĂ SECȚIUNE A MUZEULUI',s6_ct5:'🌿 MORMÂNTUL LUI YAHYA BABA',s6_ct6:'📖 LEGENDA LUI YAHYA BABA',s6_ct7:'⚖️ TESTUL PAZNICULUI CĂMĂRII',s6_ct8:'👑 MARTURIA SULTANULUI',s6_ct9:'🐟 MIRACOLUL PEȘTILOR',s6_ct10:'🤲 TRECEREA LUI YAHYA BABA',s6_ct11:'🪦 VIZITAREA MORMÂNTULUI',
    s6_c1:'În Imperiul Otoman, imaretele erau printre cele mai importante instituții care întruchipau spiritul solidarității sociale și al carității. Servind drept cantine sociale care distribuiau mâncare gratuită săracilor, călătorilor, studenților și celor lipsiți de adăpost, aceste structuri nu erau simple bucătării — erau centre vitale care protejau membrii nevoiași ai societății și mențineau echilibrul social.',
    s6_c2:'Și vă aflați acum chiar într-un astfel de loc. Imaretul Complexului Sultan Bayezid II, stabilit ca a treia secțiune a Muzeului Sănătății, a fost o instituție caritabilă importantă unde — conform actului de dotare — se găteau și se distribuiau trei mese pe zi celor săraci.',
    s6_c3:'Spațiul larg pe care îl întâlniți la intrare este bucătăria unde se gătea în cazane mari. Sala mare pe care o vedeți prin ușa din dreapta este locul unde se mânca la mese de piatră așezate pe podea.',
    s6_c4:'La fel ca și celelalte secțiuni ale Muzeului Sănătății, această parte este animată cu manechine adaptate spiritului locului, narrând cultura imaretului otoman și purtând vizitatorii într-o călătorie în timp. Vase originale din cupru, mojaruri și borcane de depozitare din acea epocă sunt de asemenea expuse aici.',
    s6_c5:'Imediat în spatele imaretului se află mormântul lui Yahya Baba, o figură legendară. În timp ce explorați această clădire interesantă și spațioasă, permiteți-mi să vă spun legenda lui Yahya Baba care a supraviețuit până astăzi.',
    s6_c6:'Conform poveștii, Yahya Baba, bucătarul-șef în timpul domniei fondatorului complexului, Sultanul Bayezid al II-lea, făcea un pilaf de orez excepțional de gustos. În timp ce amesteca pilaful, se ruga constant, iar când închidea capacul spunea "Dăruiește abundență, Doamne". Pilaful era atât de mult încât hrănea toți pacienții și chiar mai rămânea. Yahya Baba nu arunca niciodată pilaful rămas — îl ducea să hrănească peștii din râul Tunca.',
    s6_c7:'Când paznicul cămării a observat că Yahya Baba hrănea peștii cu restul de pilaf, a început să reducă zilnic cantitatea de orez primită. Totuși, chiar și cu mai puțin orez, Yahya Baba gătea pilaful cu rugăciune, hrănind și pacienții și peștii. În cele din urmă, rația a fost redusă la un singur pumn de orez. Totuși, pilaful lui Yahya Baba a hrănit toți pacienții și tot a mai rămas o porție pentru pești.',
    s6_c8:'Vestea a ajuns la urechile Sultanului. Decizând să fie martor direct, Sultanul a ajuns pe malul râului Tunca înainte de Yahya Baba și s-a ascuns. Când Yahya Baba se pregătea să plece după ce a hrănit peștii, Sultanul a ieșit din ascunzătoare și a tunat: "Tu, de acolo — verși proviziile pacienților în râu?"',
    s6_c9:'Yahya Baba a înlemnit. Nu a putut spune nimic. A fost atât de copleșit de rușine încât s-a prosternat și a căutat refugiu la Dumnezeu. Dar peștii, scoțându-și capetele din apă, au vorbit: "Oare marele Sultan pizmuiește hrana peștilor?"',
    s6_c10:'Sultanul, realizându-și greșeala cu uimire și durere, a așteptat ca Yahya Baba să-și ridice capul din prosternare — dar în zadar. Acest om binefăcător își dăduse deja sufletul…',
    s6_c11:'Mormântul lui Yahya Baba, situat chiar în spatele imaretului, este vizitat ca un altar sfânt de către trecătorii care vin să se roage. Mai ales în zilele de vineri, acest mormânt este plin de vizitatori.',
    s6_callout:'🪦 <strong>CASELE DE OASPEȚI:</strong> După ce ați auzit această legendă, este timpul să ieșiți din imaret și să vă odihniți la cafeneaua muzeului, în stânga. În cafeneaua situată în fosta casă de oaspeți a complexului, puteți savura un ceai și în special un șerbet otoman, puteți cumpăra cadouri și cărți, puteți vizita biblioteca muzeului și apoi să mergeți spre ultima oprire — curtea Moscheii. Facem o scurtă pauză la Casa de Oaspeți a Külliye?',
    s6_fwd:'SPRE CAFENEAUA MUZEULUI →',
    s7_ct1:'🏛️ CURTEA ȘI INTRAREA ÎN MOSCHEE',s7_ct2:'🚪 INTRARE ȘI ATMOSFERĂ',s7_ct3:'⛲ FÂNTÂNA ȘI SERENITATEA',s7_ct4:'🏛️ COLOANE DE MARMURĂ ȘI ARMONIE ARHITECTURALĂ',s7_ct5:'✨ PACE INTERIOARĂ ȘI TRANCHILITATE',s7_ct6:'👁️ MOMENTE DE OBSERVARE',s7_ct7:'🚪 INTRAREA ÎN MOSCHEE',s7_ct8:'🪵 MEȘTEȘUGUL KÜNDEKÂRI',
    s7_c1:'Ați vizitat secțiunile Muzeului Sănătății și ați gustat șerbetul otoman răcoritor la cafenea. Acum este timpul să cunoașteți una dintre cele mai magnifice structuri ale complexului — moscheea.',
    s7_c2:'Pe măsură ce pășiți prin ușa laterală elegantă care se deschide spre curte, sau prin portalul principal grandios, sunteți întâmpinați de măiestria prelucrării marmurei. Într-o clipă, lăsați în urmă agitația lumii exterioare și alunecați într-o atmosferă complet diferită.',
    s7_c3:'Fântâna din centrul curții umple spațiul cu pace prin sunetul calm al apei. Acest sunet, combinat cu tăcerea pietrei, vă încetinește și vă face conștienți de momentul prezent.',
    s7_c4:'Coloanele de marmură care vă înconjoară se ridică precum un inel protector. Alese în culori diferite, ele întruchipează eleganța și bogăția armonioasă a esteticii otomane.',
    s7_c5:'Ceea ce simțiți aici nu este doar frumusețe arhitecturală — este o liniște, o pace interioară care a rămas neschimbată de secole.',
    s7_c6:'Opriți-vă scurt la fântână și observați acest aranjament simplu, dar frapant al curții. Simțiți armonia pe care coloanele, arcadele și ornamentele fine o creează între ele.',
    s7_c7:'Apoi întoarceți-vă spre portalul magnific care se ridică direct în fața voastră. Împingeți ușor cortina de piele care acoperă ușa și pășiți înăuntru. Veți simți imediat că ați intrat într-una dintre cele mai elegante moschei din țara noastră.',
    s7_c8:'La intrare, nu uitați să acordați atenție lucrării originale în lemn kündekâri de deasupra ușii — și, dacă este posibil, simțiți textura acestui meșteșug rafinat.',
    s7_callout:'🕌 <strong>Să intrăm în marea întindere și liniște din interiorul sanctuarului?</strong>',
    s7_fwd:'ÎNAINTAȚI ÎN INTERIOR →',
    s8_ct1:'🕌 ÎN INTERIORUL MOSCHEII — FINALUL',s8_ct2:'🚤 TRANSPORT ISTORIC ȘI TRADIȚIE REGALĂ',s8_ct3:'👑 IMAGINAREA GALERIEI REGALE',s8_ct4:'🏛️ GALERIA REGALĂ ȘI PREMIERELE EI',s8_ct5:'⚙️ MIHRAB-UL ȘI PIETRELE DE ECHILIBRU',s8_ct6:'🪵 MINBAR-UL ȘI MEȘTEȘUGUL RAFINAT',s8_ct7:'📐 SIMBOLURI ȘI SEMNIFICAȚII',s8_ct8:'💡 LUMINĂ ȘI ORDINE ACUSTICĂ',s8_ct9:'🌌 SPLENDOARE SUB CUPOLĂ',s8_ct10:'🏗️ UN PUNCT DE COTITURĂ ARHITECTURAL',s8_ct11:'✨ FINAL ȘI RĂMAS BUN',
    s8_c1:'Vă aflați acum în interiorul moscheii din centrul complexului, și încheiem finalul turului nostru sub această cupolă magnifică.',
    s8_c2:'Sultanul Bayezid al II-lea, fondatorul complexului, și sultanii care l-au urmat obișnuiau să vină la această moschee călătorind pe râu în bărci imperiale bogat ornamentate. Ei intrau prin ușa de pe malul râului și își făceau rugăciunile în galeria regală — hünkâr mahfili — care se ridică pe coloane în colțul din stânga al moscheii.',
    s8_c3:'Închideți ochii pentru o clipă… Imaginați-vă Sultanul, la acea înălțime, rugându-se în aceeași pace alături de restul oamenilor.',
    s8_c4:'Amintiți-vă că prima galerie regală construită vreodată în arhitectura turco-islamică se află aici; acum să mergem spre mihrab.',
    s8_c5:'Când atingeți și rotiți ușor pietrele cilindrice de echilibru de pe ambele părți ale mihrab-ului, veți fi uimiți să descoperiți că fundamentul acestei mari structuri nu prezintă nici cea mai mică deplasare.',
    s8_c6:'Pe măsură ce vă apropiați de minbar în dreapta, veți fi minunați de delicatețea și eleganța prelucrării marmurei.',
    s8_c7:'Acum vă sugerez să vă întoarceți cu spatele la mihrab și să priviți deasupra ușii de la intrare. Motivul tăvii cu un pepene verde în centru, poziționat direct deasupra ușii, simbolizează faptul că în acest complex există un imaret și că cei care vin aici sunt invitați la masă.',
    s8_c8:'Ferestrele din jurul cupolei și din rândurile de jos asigură distribuirea uniformă a luminii în întregul spațiu. Acest aranjament de iluminat, combinat cu acustica puternică a moscheii, conferă spațiului o profunzime atât vizuală, cât și auditivă.',
    s8_c9:'Iar acum ridicați privirea… Priviți cu atenție această cupolă magnifică împodobită cu decorațiuni baroce. Cu o înălțime de aproximativ 31 de metri și un diametru de 22 de metri, această cupolă — care se sprijină pe patru pereți fără coloane intermediare — este un exemplu remarcabil din punct de vedere arhitectural.',
    s8_c10:'Este considerată, de asemenea, un precursor important al tranziției către structurile cu o singură cupolă.',
    s8_c11:'Sub grația și splendoarea acestei cupole fără egal, încheiem această călătorie unde ați conectat urmele trecutului cu liniștea de astăzi — nu uitați să purtați cu voi pacea și uimirea pe care acest loc le-a lăsat în inima voastră.',
    s8_callout:'🙏 <strong>Să lăsăm un rămas bun tăcut în această călătorie spirituală?</strong>',
    s8_fwd:'SPRE RĂMAS BUN →',
    s9_c1:'🏛️ Am urmat pașii trecutului pas cu pas, respirând împreună această arhitectură magnifică. Acum este timpul să adaugi propria ta suflare acestui loc istoric.',
    s9_c2:'💭 Ceea ce rezonează în tine… Un moment de pace, o admirație profundă sau acea notă liniștită care zăbovește în inima ta…',
    s9_c3:'📖 Cartea de Onoare pe care am pregătit-o pentru tine este o arhivă spirituală a acestei experiențe. Fiecare frază pe care o lași aici va fi: o amintire neprețuită pentru noi și o lumină care dă sens acestei călătorii pentru ceilalți oaspeți ai noștri.',
    s9_c4:'✨ Împărtășește cu noi ceea ce îți curge din inimă — și lasă-ți urma pentru totdeauna pe Podul Inimii…',
    s9_callout:'✍️ <strong>Te invităm să-ți împărtășești sentimentele pe pagina Podul Inimii.</strong>',
    s9_fwd:'SCRIE PE PODUL INIMII →',
    s10_body:'Ne-ar plăcea să auzim impresiile pe care această călătorie de 500 de ani prin complexul nostru Külliye le-a lăsat asupra ta. Cuvintele tale vor deveni pietrele acestui pod.',
    s10_restart:'🏛️ REÎNTOARCERE LA START'
},
  bg:{
    start:'ЗАПОЧНИ ПЪТУВАНЕТО',intro_title:'Покана към Прага',intro_sub:'Пътуване отвъд времето, към центъра на изцелението…',
    back:'← НАЗАД',menu_lang:'Език: Български 🇧🇬',menu_map:'Карта & Местоположение',menu_defter:'Мост на Сърцето',
    menu_stops:'СПИРКИ НА ОБИКОЛКАТА',menu_settings:'НАСТРОЙКИ',menu_pages:'СТРАНИЦИ',
    loc_searching:'📍 Определяне на местоположението…',loc_outside:'📍 Намирате се извън района на Кюллието.',
    loc_error:'📍 Неуспешно определяне на местоположението.',
    gb_name:'Вашето Име',gb_city:'Вашият Град',gb_msg:'Оставете чувствата си тук…',
    gb_submit:'ПОСТАВЯМ КАМЪКА СИ НА МОСТА 🪨',gb_submitting:'Запечатване…',
    gb_conn_err:'Грешка при свързване.',gb_no_msg:'Моля, оставете бележка…',
    confirm_text:'Вашите чувства са запечатани на Моста на Сърцето…',confirm_close:'ЗДРАВЕ И БЛАГОПОЛУЧИЕ 🌿',
    latest_title:'📜 Последни Съобщения',archive_title:'🗂️ Архив',no_msg:'Все още няма съобщения. Бъдете първи! ✨',
    s0_main:'🏛️ КЮЛЛИЕ НА СУЛТАН БАЯЗИД II',s0_sub:'ЗДРАВЕН МУЗЕЙ',s0_slogan:'✨ ПЪТУВАНЕ КЪМ ЗДРАВЕТО — ВХОД',
    s1_main:'Вход на Дарюшшифа',s1_sub:'🏛️ ПОРТА НА СПРАВЕДЛИВОСТТА',s1_slogan:'⚖️ ПЪРВА СПИРКА',
    s2_main:'Изход от залата за презентации',s2_sub:'🏛️ ОТ ЗНАНИЕ КЪМ ОПИТ',s2_slogan:'🏛️ АДМИНИСТРАЦИЯ И РЕД',
    s3_main:'Голямото болнично крило (ОСМОЪГЪЛНА ЗАЛА)',s3_sub:'🏛️ ПРАГЪТ НА ДАРЮШШИФА',s3_slogan:'🌊 ВРЪХНАТА ТОЧКА',
    s4_main:'Медицинско Медресе',s4_sub:'🎓 ЛЮЛКА НА ЗНАНИЕТО',s4_slogan:'📚 СВЕТЛИНАТА НА УЧЕНЕТО',
    s5_main:'Голям Двор',s5_sub:'🌿 ВЕКОВНИ ЧИНАРИ',s5_slogan:'🌳 ВРЕМЕТО И ПОКОЯТ',
    s6_main:'Имарет (Обществена Кухня)',s6_sub:'🍲 СЪЧУВСТВИЕ И ИЗОБИЛИЕ',s6_slogan:'🍲 КУХНЯТА НА ЯХЯ БАБА',
    s7_main:'Подготовка за духовна атмосфера',s7_sub:'🕌 ВХОД КЪМ ДЖАМИЯТА',s7_slogan:'✨ ЕДИН КУПОЛ, БЕЗ КРАЕН МИР',
    s8_main:'Духовно пътуване в джамията',s8_sub:'🕌 ДВОР НА ДЖАМИЯТА',s8_slogan:'🌌 ФИНАЛ ПОД КУПОЛА',
    s9_main:'Час за Сбогом',s9_sub:'🌊 ПОКАНА КЪМ МОСТА НА СЪРЦЕТО',s9_slogan:'✨ ОСТАВИ СВОЯТА СЛЕДА',
    s10_main:'🖋️ Мост на Сърцето',s10_slogan:'"Лечението на миналото среща думите на настоящето."',
    nav_back:'← НАЗАД',
    s0_ct1:'👑 ИСТОРИЯ',s0_ct2:'🏗️ СТРУКТУРА',s0_ct3:'🎧 ВАШИЯТ ВОДАЧ',s0_ct4:'📵 ВНИМАНИЕ',s0_ct5:'📍 МЕСТОПОЛОЖЕНИЕ',s0_ct6:'🏫 ОРИЕНТАЦИЯ',
    s0_c1:'Намирате се в един от най-завладяващите исторически обекти на Одрин — Здравния музей на Кюллието на Султан Баязид II. Добре дошли на това място, където историята среща изцелението.',
    s0_c2:'Построено от Султан Баязид II, син на Мехмед Завоевателя и 8-ми османски султан, под ръководството на главния архитект Хайреддин, този комплекс е най-добре запазеното кюллие сред всички османски кюллиета. В центъра му се издига джамията; вдясно — болницата и медресето; вляво — имаретът и складът; до джамията — хановете; зад нея — мост над река Тунджа. Всичко олицетворява османската социална държава.',
    s0_c3:'Ще ви водя из Кюллието и нашия музей с писано, аудио и визуално съдържание, за да обогатя посещението ви.',
    s0_c4:'Моля, дръжте мобилния си телефон в ръка по време на цялата обиколка.',
    s0_c5:'Преминахте билетната каса и се намирате в предния двор. Застанете пред голямата снимка на Кюллието и разгледайте местоположението на тези сгради в град Одрин.',
    s0_c6:'Докато вървите към тази точка, сградата вдясно е Медицинското медресе, а сградата директно пред вас е Дарюшшифа — сърцето на Кюллието и центърът на нашия музей.',
    s0_callout:'👣 <strong>След като разгледате голямата снимка, влезте в градината на Дарюшшифа през вратата непосредствено вляво.</strong>',
    s0_fwd:'НАЧАЛО НА ПЪТУВАНЕТО ВЪВ ВРЕМЕТО →',
    s1_ct1:'🏥 ДАРЮШШИФА — 1-ВИ ДВОР',s1_ct2:'🌍 ИСТОРИЧЕСКО ЗНАЧЕНИЕ',s1_ct3:'🛏️ ПОМОЩНИ СТАИ',s1_ct4:'🩺 АМБУЛАТОРНИ КАБИНЕТИ',s1_ct5:'🧭 ОРИЕНТАЦИЯ',s1_ct6:'💧 КЛАДЕНЕЦЪТ НА МЛЯКОТО',s1_ct7:'🌿 ДЪРВОТО И БРЪШЛЯНЪТ',s1_ct8:'🎬 ЗАЛА ЗА ПРЕЗЕНТАЦИИ',
    s1_c1:'Намирате се в първия двор на Одринската Дарюшшифа — един от най-важните лечебни центрове на Османската империя. Спрете тук за момент и наблюдавайте обкръжението си.',
    s1_c2:'Преди всичко знайте: тази сграда е призната за един от най-ранните примери за централно планирана болница в историята. Западните аналози се появяват едва около 200 години по-късно.',
    s1_c3:'Четирите стаи непосредствено вляво от входа са обслужващите звена: персонална стая, перална, диетична кухня и склад за провизии.',
    s1_c4:'Вдясно, зад колоните, шест амбулаторни кабинета, където са провеждани прегледи и спешни интервенции. В началните години една стая е отделена за очни лекари — „кехал".',
    s1_c5:'Оставете подробното разглеждане на стаите за връщането ви, а сега нека ви насоча към залата за презентации — след първия двор, вляво. Забележете кладенеца вляво.',
    s1_c6:'Тази каменна конструкция се нарича „Кладенецът на млякото" — вярвало се, че водата му увеличава млякото на кърмещите майки. Около 20 метра по-нататък, сред тревата, ще видите дърво, увито с бръшлян.',
    s1_c7:'Прочетете меланхоличното стихотворение на Ахмет Кутси Течер за дървото, изложено на табела в тревата. После погледнете дървото и бръшляна с това чувство в сърцето.',
    s1_c8:'Непосредствено след стихотворението, вляво, е залата за презентации. Тук можете да гледате видео за историята на Кюллието и Дарюшшифа.',
    s1_callout:'🎬 <strong>Искате ли да гледате видеото за презентацията?</strong> Можете в залата или на телефона с бутона по-долу.',
    s1_watch:'ГЛЕДАЙ ПРЕЗЕНТАЦИЯТА ▶',s1_fwd:'КЪМ ЗАЛАТА ЗА ПРЕЗЕНТАЦИИ →',
    s2_ct1:'🚪 ВЛИЗАНЕ ВЪВ 2-РИЯ ДВОР',s2_ct2:'🏛️ АДМИНИСТРАТИВНИ СТАИ',s2_ct3:'🔒 АДМИНИСТРАТИВНА СЕКЦИЯ',s2_ct4:'✨ НАДПИС И ВХОД',
    s2_c1:'Веднага след залата за презентации, преминете през голямата врата вляво към втория двор с административните офиси.',
    s2_c2:'В двора има 4 стаи — по две от всяка страна. Главният лекар и другите лекари ги използвали. В началните години имало 1 главен лекар, двама лекари, 2 хирурзи, 2 очни лекари и 1 фармацевт.',
    s2_c3:'Тази административна секция е служела и като защитна бариера между пациентите в първия двор и отделението за болни пациенти.',
    s2_c4:'Прочетете надписа над вратата и задръжте дъха си…',
    s2_callout:'🚶‍♂️ <strong>Влезте в магичното място, където музиката и звукът на водата се срещат с изцелението.</strong>',
    s2_fwd:'ОТКРИЙТЕ ГОЛЯМОТО БОЛНИЧНО КРИЛО →',
    s3_ct1:'🏥 ОТДЕЛЕНИЕ ЗА БОЛНИ ПАЦИЕНТИ',s3_ct2:'🌊 СТРУКТУРА НА БОЛНИЦАТА',s3_ct3:'🎵 МУЗИКОТЕРАПИЯ',s3_ct4:'💧 ХИДРОТЕРАПИЯ',s3_ct5:'🌿 АРОМАТЕРАПИЯ',s3_ct6:'🧺 ЕРГОТЕРАПИЯ',s3_ct7:'🚶 ИЗХОД И ОБИКОЛКА',
    s3_c1:'Намирате се в сърцето на музея и в отделението за болни пациенти на Одринската Дарюшшифа. Разходете се с усещането на онези, намерили изцеление тук преди 500 години.',
    s3_c2:'Болница, в която ви посреща ритмично течащ фонтан и музикална сцена. Централно планирана, с 6 зимни и 4 летни стаи, наклонен под за лесно почистване и вентилационен фенер в купола.',
    s3_c3:'Музикален ансамбъл от 10 изпълнители е свирел различни макамати за различни болести по препоръка на лекарите.',
    s3_c4:'Звукът на фонтана е бил важна терапевтична съставка — ала за умиротворяване на пациентите.',
    s3_c5:'Ароматите на растения от двора и наоколо са допълвали терапията с изцяло природни аромати.',
    s3_c6:'Пациентите са се занимавали с плетене на кошници и ръчни изработки, за да ги отвлекат от тревогите.',
    s3_c7:'След обиколката на стаите с османска медицина, можете да излезете. Посетете и другите стаи на двата двора.',
    s3_callout:'🏫 <strong>КЪМ МЕДИЦИНСКОТО МЕДРЕСЕ:</strong> Излезте и вървете към Медицинското медресе вляво от входния двор.',
    s3_fwd:'НАПРЕД КЪМ МЕДРЕСЕТО →',
    s4_ct1:'🏫 МЕДИЦИНСКОТО МЕДРЕСЕ',s4_ct2:'🌍 ИСТОРИЧЕСКО ЗНАЧЕНИЕ',s4_ct3:'📚 ОБРАЗОВАТЕЛНА СИСТЕМА',s4_ct4:'🏛️ АРХИТЕКТУРНА СТРУКТУРА',s4_ct5:'📜 ЕВЛИЯ ЧЕЛЕБИ',s4_ct6:'👨‍🏫 ПРЕПОДАВАТЕЛСКИ ПЕРСОНАЛ',s4_ct7:'📖 РЪКОПИСИ',s4_ct8:'🏥 ЗДРАВЕН МУЗЕЙ',
    s4_c1:'Разгледахте Дарюшшифа и сега влязохте в Медицинското медресе на Султан Баязид II. Спрете и разгледайте преди да влезете в музейните стаи.',
    s4_c2:'Това е едно от най-престижните учебни заведения, обучавали лекари в Османската империя — важен учебен център, произвел много видни лекари.',
    s4_c3:'Студентите са прилагали теоретичното обучение директно в съседната Дарюшшифа.',
    s4_c4:'Медресето има 18 студентски стаи на три страни и аудитория точно срещу тях. В центъра е имало фонтан (вече несъхранен).',
    s4_c5:'Евлия Челеби (1652 г.): „В Медицинското медресе студентите говорят за Платон, Сократ, Аристотел, Гален и Питагор — зрели лекари, всеки отдаден на своята наука."',
    s4_c6:'Персоналът включвал profesör (60 акче дневно), асистент, библиотекар и двама слуги. Студентите получавали 2 акче дневна стипендия.',
    s4_c7:'38 ръкописа с печати на османски султани са оцелели — пазят се в Библиотеката за ръкописи „Селимие".',
    s4_c8:'Открито от Тракийския университет (2007) като втора секция на Здравния музей. Най-важна е аудиторията напреко от входа.',
    s4_callout:'🚶 <strong>След обиколката — студентски стаи, аудитория и библиотека с манекени в атмосфера на 15 век — излезте и преминете през турникета до двора на джамията.</strong>',
    s4_fwd:'КЪМ ВЕЛИЧИЕТО НА ДЖАМИЯТА →',
    s5_ct1:'🌳 В ГРАДИНАТА',s5_ct2:'💧 ВОДЕН УРАВНОВЕСИТЕЛ',s5_ct3:'🕌 ГЛАВНА ПОРТА НА ДЖАМИЯТА',s5_ct4:'🏛️ СКЛАД И ИМАРЕТ',
    s5_c1:'След обиколката на Дарюшшифа и Медресето влязохте в красивата градина с вековни чинари. Вървете към секцията Имарет на музея.',
    s5_c2:'Вдясно, в ъгъла на джамията — правоъгълна каменна конструкция висока ~4 метра. Водният уравновесител — тук се е изравнявало налягането на водата преди разпределяне из Кюллието.',
    s5_c3:'Минавайки покрай водния уравновесител, вдясно е великолепната главна порта на джамията. Нека я оставим за края и да продължим към Имарета.',
    s5_c4:'Пред вас две сгради с подобна архитектура. Вляво — складът и пекарната (за научни прояви). Вдясно — Имаретът.',
    s5_callout:'🍲 <strong>Готови ли сте да видите османската имарет култура и да чуете легендата за Готвача Яхя Баба? Покажете билета и влезте!</strong>',
    s5_fwd:'КЪМ СЪРЦЕТО НА ИЗОБИЛИЕТО →',
    s6_ct1:'🏛️ ИМАРЕТИТЕ',s6_ct2:'🍲 ИМАРЕТЪТ НА СУЛТАН БАЯЗИД II',s6_ct3:'🔥 КУХНЯ И ТРАПЕЗАРИЯ',s6_ct4:'🎭 ТАЗИ СЕКЦИЯ НА МУЗЕЯ',s6_ct5:'🌿 ГРОБНИЦАТА НА ЯХЯ БАБА',s6_ct6:'📖 ЛЕГЕНДАТА ЗА ЯХЯ БАБА',s6_ct7:'⚖️ ИЗПИТАНИЕТО НА ПАЗАЧА',s6_ct8:'👑 СУЛТАНЪТ КАТО СВИДЕТЕЛ',s6_ct9:'🐟 ЧУДОТО НА РИБИТЕ',s6_ct10:'🤲 ЗАМИНАВАНЕТО НА ЯХЯ БАБА',s6_ct11:'🪦 ПОСЕЩЕНИЕ НА ГРОБНИЦАТА',
    s6_c1:'В Османската империя имаретите са институции на социалната солидарност — обществени кухни, разпределящи безплатна храна на бедни, пътници и студенти.',
    s6_c2:'Имаретът на Кюллието — третата секция на Здравния музей — е раздавал три хранения дневно на бедните.',
    s6_c3:'Широкото пространство при входа е кухнята с големите казани. Голямата зала вдясно е трапезарията с каменни маси.',
    s6_c4:'Стаята е оживена с манекени и разказва за османската имарет култура. Изложени са оригинални медни съдове и буркани.',
    s6_c5:'Зад имарета е Гробницата на Готвача Яхя Баба. Нека ви разкажа тази легенда…',
    s6_c6:'Яхя Баба, главен готвач при Султан Баязид II, правел вкусен ориз и се молел при всяко бъркане. Оризът бил толкова изобилен, че храни всички и оставало — остатъкът носел на рибите в Тунджа.',
    s6_c7:'Пазачът намалявал постепенно ориза. Но Яхя Баба продължавал да храни и болните, и рибите — дори с една шепа ориз.',
    s6_c8:'Новината накрая достигнала до Султана. Той пристигнал преди Яхя Баба на брега на Тунджа и се скрил. Когато Яхя Баба се канел да си тръгне, Султанът изскочил: \'Ти там — изхвърляш ли запасите в реката?\'',
    s6_c9:'Яхя Баба застинал от срам и паднал ничком. Рибите вдигнали глави: „Великият Султан отказва ли на рибите прехраната им?"',
    s6_c10:'Султанът чакал Яхя Баба да вдигне глава — но напразно. Благосклонният готвач вече предал душата си…',
    s6_c11:'Гробницата вад имарета се посещава като светилище. В петък е пълна с молещи се.',
    s6_callout:'🪦 <strong>ХАНОВЕ:</strong> Изхождайки от имарета, починете в музейното кафе вляво — опитайте османски шербет, купете сувенири и посетете библиотеката, преди последната спирка — двора на Джамията.',
    s6_fwd:'КЪМ МУЗЕЙНОТО КАФЕ →',
    s7_ct1:'🏛️ ДВОР И ВЛИЗАНЕ В ДЖАМИЯТА',s7_ct2:'🚪 ВХОД И АТМОСФЕРА',s7_ct3:'⛲ ФОНТАНЪТ И СПОКОЙСТВИЕТО',s7_ct4:'🏛️ МРАМОРНИ КОЛОНИ И ХАРМОНИЯ',s7_ct5:'✨ ВЪТРЕШЕН МИР',s7_ct6:'👁️ МОМЕНТИ НА НАБЛЮДЕНИЕ',s7_ct7:'🚪 ВЛИЗАНЕ В ДЖАМИЯТА',s7_ct8:'🪵 ИЗКУСТВОТО КЮНДЕКЯРИ',
    s7_c1:'Разгледахте Здравния музей и вкусихте шербет. Сега е ред на най-великолепната сграда на Кюллието — джамията.',
    s7_c2:'Влизайки от елегантната странична врата или главната порта, мраморното майсторство ви посреща. В миг оставяте суетата зад себе си.',
    s7_c3:'Фонтанът в центъра на двора изпълва пространството с мир. Звукът на водата, съчетан с тишината на камъка, ви забавя.',
    s7_c4:'Мраморните колони в различни цветове въплъщават елегантността и хармонията на османската естетика.',
    s7_c5:'Тук не усещате само архитектурна красота — усещате вековен вътрешен мир.',
    s7_c6:'Спрете при фонтана, наблюдавайте и почувствайте хармонията между колоните, арките и украшенията.',
    s7_c7:'Насочете се към великолепната порта. Разделете кожената завеса и влезте в една от най-елегантните джамии.',
    s7_c8:'Обърнете внимание на оригиналното кюндекяри дърводелство над вратата — докоснете тази изискана текстура.',
    s7_callout:'🕌 <strong>Нека влезем в голямото пространство и спокойствието на светилището?</strong>',
    s7_fwd:'НАПРЕДВАЙТЕ ВЪТРЕ →',
    s8_ct1:'🕌 ВЪТРЕ В ДЖАМИЯТА — ФИНАЛЪТ',s8_ct2:'🚤 ИСТОРИЧЕСКА ТРАНСПОРТАЦИЯ',s8_ct3:'👑 КРАЛСКАТА ГАЛЕРИЯ',s8_ct4:'🏛️ ХЮНКЯР МАХФИЛ И НЕГОВИТЕ ПЪРВЕНСТВА',s8_ct5:'⚙️ МИХРАБЪТ И БАЛАНСИРАЩИТЕ КАМЪНИ',s8_ct6:'🪵 МИНБЕРЪТ',s8_ct7:'📐 СИМВОЛИ И ЗНАЧЕНИЯ',s8_ct8:'💡 СВЕТЛИНА И АКУСТИКА',s8_ct9:'🌌 ВЕЛИКОЛЕПИЕ ПОД КУПОЛА',s8_ct10:'🏗️ АРХИТЕКТУРЕН ПОВРАТЕН МОМЕНТ',s8_ct11:'✨ ФИНАЛ И СБОГОМ',
    s8_c1:'Намирате се вътре в джамията в центъра на Кюллието — финалът на нашата обиколка под великолепния купол.',
    s8_c2:'Султан Баязид II и следващите го султани са пристигали с украсени лодки по реката. Влизали от речната врата и се молели в кралската галерия — хюнкяр махфил — на колони вляво.',
    s8_c3:'Затворете очи… Представете си Султана, на онова ниво, молейки се в мир заедно с общността.',
    s8_c4:'Първата кралска галерия в турско-ислямската архитектура е точно тук. Нека се насочим към михраба.',
    s8_c5:'Докоснете и завъртете леко цилиндричните балансиращи камъни — изненадайте се, че тази голяма сграда не е хлъзнала ни миллиметър.',
    s8_c6:'Приближавайки минбера вдясно, ще се възхитите на деликатното мраморно майсторство.',
    s8_c7:'Обърнете гръб на михраба и вижте над входната врата тавата с диня — символ на имарета: всеки, влизащ тук, е поканен на трапеза.',
    s8_c8:'Прозорците разпределят равномерно светлината, а мощната акустика на джамията придава визуална и слухова дълбочина.',
    s8_c9:'Вдигнете поглед… Куполът с барокови украшения: ~31 м висок, ~22 м диаметър, без нито една опорна колона — архитектурно чудо.',
    s8_c10:'Счита се за важен предшественик на прехода към едноцентрично купольни конструкции.',
    s8_c11:'Под тази несравнима красота завършваме пътуването. Вземете мира и удивлението, оставени от това място в сърцето ви.',
    s8_callout:'🙏 <strong>Нека поставим тихо сбогом на това духовно пътуване?</strong>',
    s8_fwd:'КЪМ СБОГУВАНЕТО →',
    s9_c1:'🏛️ Следвахме следите на миналото заедно. Сега е ваш ред да добавите своето дихание към това историческо място.',
    s9_c2:'💭 Момент на мир, дълбоко възхищение, или тихата нота, останала в сърцето ви…',
    s9_c3:'📖 Книгата за посетители е духовен архив. Всяко изречение — безценен спомен за нас и светлина за другите гости.',
    s9_c4:'✨ Споделете с нас онова, което извира от сърцето — и нека следата ви остане завинаги на Моста на Сърцето…',
    s9_callout:'✍️ <strong>Каним ви да споделите чувствата си на нашата страница Мост на Сърцето.</strong>',
    s9_fwd:'ПИШЕТЕ НА МОСТА НА СЪРЦЕТО →',
    s10_body:'Бихме искали да чуем впечатленията от това 500-годишно пътуване. Думите ви ще станат камъните на този мост.',
    s10_restart:'🏛️ ВЪРНЕТЕ СЕ В НАЧАЛОТО'
  },
  el:{
    start:'ΞΕΚΙΝΉΣΤΕ ΤΟ ΤΑΞΊΔΙ',intro_title:'Πρόσκληση στο Κατώφλι',intro_sub:'Ένα ταξίδι πέρα από τον χρόνο, στο κέντρο της θεραπείας…',
    back:'← ΠΊΣΩ',menu_stops:'ΣΤΑΘΜΟΊ ΠΕΡΙΗΓΗΣΗΣ',menu_pages:'ΣΕΛΊΔΕΣ',menu_settings:'ΡΥΘΜΊΣΕΙΣ',
    menu_lang:'Γλώσσα: Ελληνικά 🇬🇷',menu_map:'Χάρτης & Τοποθεσία',menu_defter:'Γέφυρα Καρδιάς',
    loc_searching:'📍 Εντοπισμός τοποθεσίας…',loc_outside:'📍 Βρίσκεστε εκτός της περιοχής Κυλλιγιέ.',
    loc_error:'📍 Αδυναμία εντοπισμού τοποθεσίας. Παρακαλώ ενεργοποιήστε την άδεια τοποθεσίας.',
    gb_name:'Ονοματεπώνυμό σας',gb_city:'Η Πόλη σας',gb_msg:'Αφήστε τα συναισθήματά σας εδώ…',
    gb_submit:'ΤΟΠΟΘΕΤΏ ΤΗΝ ΠΈΤΡΑ ΜΟΥ ΣΤΗ ΓΈΦΥΡΑ 🪨',gb_submitting:'Σφράγισμα…',
    gb_conn_err:'Σφάλμα σύνδεσης. Παρακαλώ δοκιμάστε ξανά.',gb_no_msg:'Παρακαλώ αφήστε μια σημείωση…',
    confirm_text:'Τα συναισθήματά σας έχουν σφραγιστεί στη Γέφυρα Καρδιάς. Το ουσιαστικό ίχνος που αφήσατε εμπλουτίζει την πνευματική κληρονομιά του Κυλλιγιέ μας…',
    confirm_close:'ΝΑ ΕΙΣΘΕ ΥΓΙΕΙΣ 🌿',latest_title:'📜 Πρόσφατα Μηνύματα',archive_title:'🗂️ Αρχείο',
    no_msg:'Δεν υπάρχουν μηνύματα ακόμα. Γίνετε ο πρώτος που θα αφήσει μια πέτρα! ✨',
    s0_main:'🏛️ ΚΥΛΛΙΓΙΈ ΤΟΥ ΣΟΥΛΤΆΝΟΥ ΒΑΓΙΑΖΉΤ Β\'',s0_sub:'ΜΟΥΣΕΊΟ ΥΓΕΊΑΣ',s0_slogan:'✨ ΤΑΞΊΔΙ ΘΕΡΑΠΕΊΑΣ — ΕΊΣΟΔΟΣ ΜΟΥΣΕΊΟΥ',
    s1_main:'Είσοδος Νοσοκομείου',s1_sub:'🏛️ ΠΎΛΗ ΔΙΚΑΙΟΣΎΝΗΣ ΚΑΙ ΘΕΡΑΠΕΊΑΣ',s1_slogan:'⚖️ ΠΡΏΤΟΣ ΣΤΑΘΜΌΣ ΘΕΡΑΠΕΊΑΣ',
    s2_main:'Έξοδος από την Αίθουσα Παρουσίασης',s2_sub:'🏛️ ΑΠΌ ΤΗ ΓΝΏΣΗ ΣΤΗΝ ΕΜΠΕΙΡΊΑ',s2_slogan:'🏛️ ΔΙΟΊΚΗΣΗ ΚΑΙ ΤΆΞΗ',
    s3_main:'Το Μεγάλο Νοσοκομείο (ΟΚΤΑΓΩΝΙΚΉ ΑΊΘΟΥΣΑ)',s3_sub:'🏛️ ΚΑΤΏΦΛΙ ΤΟΥ ΝΟΣΟΚΟΜΕΊΟΥ',s3_slogan:'🌊 Η ΚΟΡΥΦΉ ΤΗΣ ΘΕΡΑΠΕΊΑΣ',
    s4_main:'Ιατρική Σχολή (Μεντρεσέ)',s4_sub:'🎓 ΚΟΙΤΊΔΑ ΤΗΣ ΓΝΏΣΗΣ',s4_slogan:'📚 ΤΟ ΦΩΣ ΤΗΣ ΜΆΘΗΣΗΣ',
    s5_main:'Μεγάλη Αυλή',s5_sub:'🌿 ΑΙΩΝΌΒΙΑ ΠΛΑΤΆΝΙΑ',s5_slogan:'🌳 ΧΡΌΝΟΣ ΚΑΙ ΓΑΛΉΝΗ',
    s6_main:'Ιμαρέτ (Κοινοτική Κουζίνα)',s6_sub:'🍲 ΦΙΛΑΝΘΡΩΠΊΑ ΚΑΙ ΑΦΘΟΝΊΑ',s6_slogan:'🍲 Η ΚΟΥΖΊΝΑ ΤΟΥ ΓΙΑΧΥΆ ΜΠΑΜΠΆ',
    s7_main:'Προετοιμασία για Πνευματική Ατμόσφαιρα',s7_sub:'🕌 ΕΊΣΟΔΟΣ ΣΤΟ ΤΖΑΜΊ',s7_slogan:'✨ ΈΝΑΣ ΤΡΟΎΛΟΣ, ΑΤΕΛΕΊΩΤΗ ΓΑΛΉΝΗ',
    s8_main:'Πνευματικό Ταξίδι στο Τζαμί',s8_sub:'🕌 ΑΥΛΉ ΤΖΑΜΙΟΎ',s8_slogan:'🌌 ΦΙΝΆΛΕ ΥΠΌ ΤΟΝ ΤΡΟΎΛΟ',
    s9_main:'Ώρα Αποχαιρετισμού',s9_sub:'🌊 ΠΡΌΣΚΛΗΣΗ ΣΤΗ ΓΈΦΥΡΑ ΚΑΡΔΙΆΣ',s9_slogan:'✨ ΑΦΉΣΤΕ ΤΟ ΣΗΜΆΔΙ ΣΑΣ ΣΕ ΑΥΤΉ ΤΗΝ ΙΣΤΟΡΊΑ',
    s10_main:'🖋️ Γέφυρα Καρδιάς',s10_slogan:'"Η θεραπεία του παρελθόντος συναντά τις λέξεις του παρόντος."',
    nav_back:'← ΠΊΣΩ',
    s0_ct1:'👑 ΙΣΤΟΡΊΑ',s0_ct2:'🏗️ ΑΡΧΙΤΕΚΤΟΝΙΚΉ',s0_ct3:'🎧 Ο ΟΔΗΓΌΣ ΣΑΣ',s0_ct4:'📵 ΠΡΟΣΟΧΉ',s0_ct5:'📍 ΤΟΠΟΘΕΣΊΑ',s0_ct6:'🏫 ΠΡΟΣΑΝΑΤΟΛΙΣΜΌΣ',
    s0_c1:'Βρίσκεστε τώρα σε έναν από τους πιο συναρπαστικούς ιστορικούς χώρους της Αδριανούπολης — το Μουσείο Υγείας του Κυλλιγιέ του Σουλτάνου Βαγιαζήτ Β\'. Καλώς ήρθατε σε αυτόν τον τόπο όπου η ιστορία συναντά τη θεραπεία.',
    s0_c2:'Χτισμένο από τον Σουλτάνο Βαγιαζήτ Β\', γιο του Μωάμεθ του Κατακτητή και 8ο Οθωμανό Σουλτάνο, υπό την καθοδήγηση του αρχιτέκτονα Χαϊρεντίν, αυτό το συγκρότημα είναι το καλύτερα διατηρημένο κυλλιγιέ μεταξύ όλων των οθωμανικών κυλλιγιέ. Στο κέντρο του υψώνεται το τζαμί· δεξιά βρίσκονται το νοσοκομείο και η ιατρική σχολή· αριστερά το ιμαρέτ και η αποθήκη τροφίμων· δίπλα στο τζαμί τα ξενοδοχεία, και πίσω μια γέφυρα πάνω στον ποταμό Τούντζα — όλα ενσαρκώνουν το οθωμανικό κοινωνικό κράτος.',
    s0_c3:'Θα σας ξεναγήσω στο Κυλλιγιέ και το μουσείο μας με γραπτό, ηχητικό και οπτικό περιεχόμενο για να εμπλουτίσω την επίσκεψή σας.',
    s0_c4:'Παρακαλώ κρατήστε το κινητό σας τηλέφωνο στο χέρι σας καθ\' όλη τη διάρκεια της περιήγησης.',
    s0_c5:'Έχετε περάσει από την ταμειακή και βρίσκεστε τώρα στον μπροστινό κήπο. Σταθείτε μπροστά στη μεγάλη φωτογραφία του Κυλλιγιέ που κρέμεται στον τοίχο απέναντί σας και μελετήστε τη θέση αυτών των κτηρίων μέσα στην πόλη της Αδριανούπολης.',
    s0_c6:'Καθώς περπατάτε προς αυτό το σημείο, το κτήριο στα δεξιά σας είναι η Ιατρική Σχολή του Κυλλιγιέ, και το κτήριο ακριβώς μπροστά σας είναι το Νοσοκομείο (Νταρούσσιφα) — ίσως η καρδιά του Κυλλιγιέ και το κέντρο του μουσείου μας.',
    s0_callout:'👣 <strong>Αφού εξετάσετε τη μεγάλη φωτογραφία, μπείτε στον κήπο του Νοσοκομείου από την πόρτα αμέσως στα αριστερά σας.</strong>',
    s0_fwd:'ΞΕΚΙΝΉΣΤΕ ΤΟ ΤΑΞΊΔΙ ΣΤΟ ΧΡΌΝΟ →',
    s1_ct1:'🏥 ΝΟΣΟΚΟΜΕΊΟ — 1η ΑΥΛΉ',s1_ct2:'🌍 ΙΣΤΟΡΙΚΉ ΣΗΜΑΣΊΑ',s1_ct3:'🛏️ ΑΊΘΟΥΣΕΣ ΥΠΗΡΕΣΙΏΝ',s1_ct4:'🩺 ΕΞΩΤΕΡΙΚΆ ΙΑΤΡΕΊΑ',s1_ct5:'🧭 ΠΡΟΣΑΝΑΤΟΛΙΣΜΌΣ',s1_ct6:'💧 ΤΟ ΠΗΓΆΔΙ ΤΟΥ ΓΆΛΑΚΤΟΣ',s1_ct7:'🌿 ΤΟ ΔΈΝΤΡΟ ΚΑΙ Ο ΚΙΣΣΌΣ',s1_ct8:'🎬 ΑΊΘΟΥΣΑ ΠΑΡΟΥΣΊΑΣΗΣ',
    s1_c1:'Βρίσκεστε τώρα στην πρώτη αυλή του Νοσοκομείου της Αδριανούπολης, ενός από τα σημαντικότερα κέντρα θεραπείας της Οθωμανικής Αυτοκρατορίας. Παρακαλώ σταματήστε εδώ για μια στιγμή και παρατηρήστε το περιβάλλον σας.',
    s1_c2:'Αρχικά να γνωρίζετε: αυτό το κτήριο αναγνωρίζεται ως ένα από τα πρώτα παραδείγματα κεντρικά σχεδιασμένου νοσοκομείου στην ιστορία. Τα δυτικά αντίστοιχα εμφανίστηκαν μόλις περίπου 200 χρόνια αργότερα — εδώ, οι χώροι θεραπείας υλοποιήθηκαν με αρχιτεκτονικό όραμα πολύ μπροστά από την εποχή τους.',
    s1_c3:'Καθώς προχωράτε στο μονοπάτι μπροστά σας, τα τέσσερα δωμάτια αμέσως στα αριστερά της εισόδου είναι οι μονάδες υπηρεσιών του Νοσοκομείου: ένα δωμάτιο προσωπικού, ένα πλυντήριο, μια δίαιτα κουζίνα και μια αποθήκη τροφίμων.',
    s1_c4:'Στα δεξιά σας, πίσω από τις κολόνες, υπάρχουν έξι αίθουσες εξωτερικών ιατρείων όπου πραγματοποιούνταν οι καθημερινές εξετάσεις ασθενών, η φροντίδα και οι επείγουσες παρεμβάσεις. Κατά τα πρώτα χρόνια, ένα από αυτά τα δωμάτια ήταν αφιερωμένο στους οφθαλμίατρους γνωστούς ως "κεχχάλ".',
    s1_c5:'Αφήστε την αναλυτική επίσκεψη αυτών των δωματίων — διακοσμημένων με παρουσιάσεις και πίνακες πληροφοριών — για την επιστροφή σας, και αφήστε με τώρα να σας οδηγήσω στην αίθουσα παρουσίασής μας. Βρίσκεται μετά την πρώτη αυλή, στα αριστερά. Καθώς περπατάτε, παρατηρήστε το πηγάδι στα αριστερά σας.',
    s1_c6:'Αυτή η πέτρινη κατασκευή ονομάζεται "Πηγάδι του Γάλακτος", καθώς πιστευόταν ότι το νερό της αύξανε τη γαλακτοπαραγωγή των νέων μητέρων. Περίπου 20 μέτρα πιο μακριά, ανάμεσα στο γρασίδι, θα δείτε ένα δέντρο τυλιγμένο με κισσό.',
    s1_c7:'Όταν φτάσετε εκεί, φροντίστε να διαβάσετε το μελαγχολικό ερωτικό ποίημα που έγραψε ο Αχμέτ Κουτσί Τετσέρ για αυτό το δέντρο, εκτεθειμένο σε πίνακα στο γρασίδι. Έπειτα κοιτάξτε το δέντρο και τον κισσό για άλλη μια φορά, με αυτό το συναίσθημα στην καρδιά σας.',
    s1_c8:'Αμέσως μετά το ποίημα, στα αριστερά σας, βρίσκεται η αίθουσα παρουσίασής μας. Εδώ μπορείτε να παρακολουθήσετε ένα βίντεο για την ιστορία και την ανάπτυξη του Κυλλιγιέ και του Νοσοκομείου, αποκτώντας μια ολοκληρωμένη κατανόηση της σημασίας αυτού του χώρου στην ιστορία της ιατρικής και της αρχιτεκτονικής.',
    s1_callout:'🎬 <strong>Θέλετε να παρακολουθήσετε το βίντεο παρουσίασης;</strong> Μπορείτε να το δείτε στην αίθουσα παρουσίασης ή να πατήσετε το κουμπί παρακάτω για να το παρακολουθήσετε στο τηλέφωνό σας.',
    s1_watch:'ΔΕΣ ΤΗΝ ΠΑΡΟΥΣΊΑΣΗ ▶',s1_fwd:'ΠΡΟΣ ΤΗΝ ΑΊΘΟΥΣΑ ΠΑΡΟΥΣΊΑΣΗΣ →',
    s2_ct1:'🚪 ΕΊΣΟΔΟΣ ΣΤΗΝ 2η ΑΥΛΉ',s2_ct2:'🏛️ ΔΙΟΙΚΗΤΙΚΆ ΔΩΜΆΤΙΑ',s2_ct3:'🔒 ΔΙΟΙΚΗΤΙΚΉ ΕΝΌΤΗΤΑ',s2_ct4:'✨ ΕΠΙΓΡΑΦΉ ΚΑΙ ΕΊΣΟΔΟΣ',
    s2_c1:'Μόλις βγείτε από την αίθουσα παρουσίασης, περάστε από τη μεγαλοπρεπή πόρτα αμέσως στα αριστερά σας στη δεύτερη αυλή, όπου βρίσκονται τα διοικητικά γραφεία.',
    s2_c2:'Σε αυτή την αυλή υπάρχουν 4 δωμάτια — δύο από κάθε πλευρά. Ο αρχίατρος και οι άλλοι γιατροί χρησιμοποιούσαν αυτά τα δωμάτια· όλες οι νοσοκομειακές λειτουργίες σχεδιάζονταν και διαχειρίζονταν εδώ. Κατά τα πρώτα χρόνια, αυτό το Νοσοκομείο είχε 1 αρχίατρο, δύο γιατρούς, 2 χειρουργούς, 2 οφθαλμίατρους και 1 φαρμακοποιό.',
    s2_c3:'Αυτή η διοικητική ενότητα χρησίμευε επίσης ως προστατευτικό φράγμα μεταξύ της καθημερινής ροής ασθενών στην πρώτη αυλή και του νοσοκομειακού τμήματος εσωτερικών ασθενών που πρόκειται να επισκεφθείτε.',
    s2_c4:'Τώρα διαβάστε την επιγραφή πάνω από την πόρτα και μετά κρατήστε την ανάσα σας…',
    s2_callout:'🚶‍♂️ <strong>Μπείτε σε αυτόν τον μαγικό χώρο όπου η μουσική και ο ήχος του νερού συναντούν τη θεραπεία.</strong>',
    s2_fwd:'ΑΝΑΚΑΛΎΨΤΕ ΤΟ ΜΕΓΆΛΟ ΝΟΣΟΚΟΜΕΊΟ →',
    s3_ct1:'🏥 ΤΜΉΜΑ ΕΣΩΤΕΡΙΚΏΝ ΑΣΘΕΝΏΝ',s3_ct2:'🌊 ΔΟΜΉ ΤΟΥ ΝΟΣΟΚΟΜΕΊΟΥ',s3_ct3:'🎵 ΜΟΥΣΙΚΟΘΕΡΑΠΕΊΑ',s3_ct4:'💧 ΥΔΡΟΘΕΡΑΠΕΊΑ',s3_ct5:'🌿 ΑΡΩΜΑΤΟΘΕΡΑΠΕΊΑ',s3_ct6:'🧺 ΕΡΓΟΘΕΡΑΠΕΊΑ',s3_ct7:'🚶 ΈΞΟΔΟΣ ΚΑΙ ΠΕΡΙΗΓΗΣΗ',
    s3_c1:'Βρίσκεστε τώρα στην καρδιά του μουσείου μας και στο τμήμα εσωτερικών ασθενών του Νοσοκομείου της Αδριανούπολης. Περπατήστε σε αυτόν τον χώρο με το συναίσθημα εκείνων που βρήκαν εδώ θεραπεία 500 χρόνια πριν.',
    s3_c2:'Φανταστείτε ένα νοσοκομείο όπου σας υποδέχεται μια κρήνη που ρέει ρυθμικά στο κέντρο, και μια σκηνή μουσικής ακριβώς απέναντί της. Αυτό το κεντρικά σχεδιασμένο νοσοκομείο, καλυμμένο από ένα φαρδύ θόλο, αποτελείται από 6 χειμερινά δωμάτια ασθενών, 4 καλοκαιρινά δωμάτια ασθενών και μια σκηνή μουσικής. Ο φανός στον τρούλο αερίζει επίσης τον κακό αέρα. Το κεκλιμένο δάπεδο και τα κανάλια κάτω από αυτό διευκολύνουν το εύκολο πλύσιμο και καθαρισμό.',
    s3_c3:'Αυτό που ξεχώριζε αυτό το νοσοκομείο από τα άλλα ήταν η χρήση μουσικών τρόπων στη θεραπεία παράλληλα με τις σύγχρονες ιατρικές γνώσεις. Ένα μουσικό σύνολο 10 εκτελεστών έπαιζε και τραγουδούσε διαφορετικούς τρόπους για διαφορετικές ασθένειες, όπως συνιστούσαν οι γιατροί — πιστεύοντας ότι ωφελεί διάφορες παθήσεις.',
    s3_c4:'Ο ήχος του νερού που ρέει από την κρήνη στο κέντρο του κτηρίου ήταν σημαντικό μέρος της θεραπείας, με στόχο να ηρεμήσει και να καταπραΰνει τους ασθενείς.',
    s3_c5:'Εκτός από τη μουσική και τους ήχους του νερού, εφαρμοζόταν επίσης αρωματοθεραπεία στο Νοσοκομείο. Τα αρώματα διαφόρων φυτών που καλλιεργούνταν στην αυλή και τα περίχωρα ήταν αναπόσπαστο μέρος της θεραπευτικής διαδικασίας.',
    s3_c6:'Η εργοθεραπεία χρησιμοποιούνταν επίσης ως μέθοδος θεραπείας εδώ. Οι ασθενείς ασχολούνταν με πλέξιμο καλαθιών, πλέξιμο και διάφορες χειροτεχνίες για να αποσπάσουν την προσοχή τους από τις ανησυχίες και τις σκέψεις τους.',
    s3_c7:'Αφού περιηγηθείτε στα δωμάτια που παρουσιάζουν διάφορες πτυχές της οθωμανικής ιατρικής, μπορείτε να βγείτε από το τμήμα εσωτερικών ασθενών. Καθώς φεύγετε από αυτόν τον χώρο θεραπείας — που λειτουργούσε συνεχώς για 400 χρόνια — μπορείτε επίσης να επισκεφθείτε τα άλλα δωμάτια στη δεύτερη και πρώτη αυλή για να μάθετε περισσότερα για το Νοσοκομείο και την οθωμανική ιατρική.',
    s3_callout:'🏫 <strong>ΠΡΟΣ ΤΗΝ ΙΑΤΡΙΚΉ ΣΧΟΛΉ:</strong> Βγείτε από το Νοσοκομείο και περπατήστε προς την Ιατρική Σχολή, που βρίσκεται στα αριστερά του κήπου εισόδου με τη μεγάλη φωτογραφία.',
    s3_fwd:'ΣΥΝΕΧΕΙΑ ΠΡΟΣ ΤΗΝ ΙΑΤΡΙΚΉ ΣΧΟΛΉ →',
    s4_ct1:'🏫 Η ΙΑΤΡΙΚΉ ΣΧΟΛΉ',s4_ct2:'🌍 ΙΣΤΟΡΙΚΉ ΣΗΜΑΣΊΑ',s4_ct3:'📚 ΕΚΠΑΙΔΕΥΤΙΚΌ ΣΥΣΤΉΜΑ',s4_ct4:'🏛️ ΑΡΧΙΤΕΚΤΟΝΙΚΉ ΔΟΜΉ',s4_ct5:'📜 ΕΒΛΙΓΙΆ ΤΣΕΛΕΜΠΉ',s4_ct6:'👨‍🏫 ΔΙΔΑΚΤΙΚΌ ΠΡΟΣΩΠΙΚΌ',s4_ct7:'📖 ΧΕΙΡΌΓΡΑΦΑ',s4_ct8:'🏥 ΜΟΥΣΕΊΟ ΥΓΕΊΑΣ',
    s4_c1:'Έχετε περιηγηθεί στο Νοσοκομείο και έχετε μπει τώρα σε μια άλλη κρίσιμη ενότητα του Κυλλιγιέ — την Ιατρική Σχολή του Σουλτάνου Βαγιαζήτ Β\'. Πριν μπείτε στα δωμάτια του μουσείου στη δεξιά και αντίθετη πλευρά, σταματήστε και μελετήστε αυτόν τον μοναδικό χώρο.',
    s4_c2:'Αυτό που βλέπετε τώρα ως κτήριο διατεταγμένο γύρω από μια τετράγωνη αυλή ήταν ένα από τα πιο αξιόλογα εκπαιδευτικά ιδρύματα που εκπαίδευαν γιατρούς στην Οθωμανική Αυτοκρατορία — ένα σημαντικό κέντρο μάθησης που παρήγαγε πολλούς σπουδαίους γιατρούς στους αιώνες.',
    s4_c3:'Κατατεταγμένη μεταξύ των ανώτατου επιπέδου "60-βαθμολογίας και άνω" μεντρεσέδων στο οθωμανικό εκπαιδευτικό σύστημα, οι σπουδαστές εδώ μπορούσαν να εφαρμόσουν τη θεωρητική τους εκπαίδευση στο γειτονικό Νοσοκομείο, ενισχύοντας τις γνώσεις τους με πράξη.',
    s4_c4:'Η ιατρική σχολή — με κρήνη (που δεν υπάρχει πλέον) στο κέντρο της και ένα πηγάδι στη γωνία για παροχή νερού — αποτελείται από 18 δωμάτια σπουδαστών σε τρεις πλευρές και μια αίθουσα διαλέξεων ακριβώς απέναντι.',
    s4_c5:'Ο Εβλιγιά Τσελεμπή, που επισκέφθηκε το Κυλλιγιέ το 1652, έγραψε για αυτή τη σχολή: "Στην Ιατρική Σχολή και τα δωμάτιά της υπάρχουν σπουδαστές που μιλούν συνεχώς για σοφούς όπως ο Πλάτων, ο Σωκράτης, ο Αριστοτέλης, ο Γαληνός και ο Πυθαγόρας — ώριμοι γιατροί ο καθένας. Ο καθένας αφοσιωμένος σε έναν κλάδο γνώσης, βασιζόμενος σε πολύτιμα βιβλία στην τέχνη της ιατρικής, προσπαθώντας να βρει θεραπείες για τις ασθένειες της ανθρωπότητας."',
    s4_c6:'Το διδακτικό προσωπικό περιλάμβανε έναν καθηγητή που κέρδιζε 60 ακτσέ ημερησίως διδάσκοντας 18 σπουδαστές, έναν βοηθό καθηγητή, έναν βιβλιοθηκάριο και δύο υπηρέτες. Όλες οι ανάγκες των σπουδαστών καλύπτονταν, και λάμβαναν επίσης ημερήσια υποτροφία δύο ακτσέ.',
    s4_c7:'38 χειρόγραφα ιατρικά χειρόγραφα που μελετήθηκαν εδώ — πολλά φέροντας τις σφραγίδες Οθωμανών σουλτάνων — έχουν επιβιώσει μέχρι σήμερα. Αυτά τα πολύτιμα έργα φυλάσσονται τώρα στη Βιβλιοθήκη Χειρογράφων Σελιμιγιέ.',
    s4_c8:'Η ιατρική σχολή άνοιξε από το Πανεπιστήμιο Τράκγιας το 2007 ως δεύτερη ενότητα του Μουσείου Υγείας. Τα δωμάτιά της αφηγούνται την ιατρική εκπαίδευση της εποχής. Η πιο σημαντική ενότητα είναι η αίθουσα διαλέξεων, ακριβώς απέναντι από την είσοδο.',
    s4_callout:'🚶 <strong>Αφού περιηγηθείτε στα δωμάτια σπουδαστών, τις αίθουσες εφαρμοσμένης κατάρτισης, το δωμάτιο καθηγητή, την αίθουσα διαλέξεων και τη βιβλιοθήκη — διαρρυθμισμένα ώστε να αντικατοπτρίζουν την ατμόσφαιρα του 15ου αιώνα με ανδρείκελα — βγείτε από τη σχολή και προχωρήστε μέσω της περιστρεφόμενης πόρτας κοντά στην έξοδο του Νοσοκομείου προς την αυλή του τζαμιού για να συνεχίσετε προς το Ιμαρέτ.</strong>',
    s4_fwd:'ΠΡΟΣ ΤΗ ΜΕΓΑΛΟΠΡΈΠΕΙΑ ΤΟΥ ΤΖΑΜΙΟΎ →',
    s5_ct1:'🌳 ΣΤΟΝ ΚΉΠΟ',s5_ct2:'💧 ΥΔΡΑΥΛΙΚΟΣ ΖΥΓΌΣ',s5_ct3:'🕌 ΚΎΡΙΑ ΠΎΛΗ ΤΖΑΜΙΟΎ',s5_ct4:'🏛️ ΑΠΟΘΉΚΗ ΚΑΙ ΙΜΑΡΈΤ',
    s5_c1:'Αφού περιηγηθήκατε στο Νοσοκομείο και τη Σχολή, έχετε μπει στον κήπο του τζαμιού. Περπατήστε αργά μέσα σε αυτόν τον όμορφο κήπο με τα αιωνόβια πλατάνια, κατευθυνόμενοι προς την ενότητα Ιμαρέτ του μουσείου ακριβώς μπροστά σας.',
    s5_c2:'Καθώς μπαίνετε στον κήπο από το Νοσοκομείο, το πρώτο πράγμα που πρέπει να παρατηρήσετε στα δεξιά σας — στη γωνία του τζαμιού — είναι μια ορθογώνια πέτρινη κατασκευή ύψους περίπου 4 μέτρων. Αυτός είναι ο υδραυλικός ζυγός του Κυλλιγιέ. Το νερό που μεταφερόταν με σωληνώσεις από τους γύρω λόφους είχε πρώτα εξισορροπημένη την πίεσή του μέσα σε αυτή την κατασκευή πριν διανεμηθεί στις άλλες μονάδες του Κυλλιγιέ.',
    s5_c3:'Αφού περάσετε τον υδραυλικό ζυγό, θα σας υποδεχθεί η μεγαλοπρεπής κύρια είσοδος του τζαμιού στα δεξιά σας. Ας αφήσουμε την εξερεύνηση της αυλής του τζαμιού μέσω αυτής της πύλης για το τέλος της περιήγησής μας και ας συνεχίσουμε το βήμα μας προς το Ιμαρέτ.',
    s5_c4:'Μπροστά σας υψώνονται δύο μεγάλα κτήρια παρόμοιας αρχιτεκτονικής το ένα δίπλα στο άλλο. Αυτό στα αριστερά περιέχει την αποθήκη τροφίμων και το αρτοποιείο, που χρησιμοποιούνται τώρα για τις επιστημονικές και πολιτιστικές εκδηλώσεις του μουσείου. Αυτό στα δεξιά είναι το Ιμαρέτ προς το οποίο σας κατευθύνω.',
    s5_callout:'🍲 <strong>Είστε έτοιμοι να δείτε τον οθωμανικό πολιτισμό ιμαρέτ και να ακούσετε τον θρύλο του Μάγειρα Γιαχυά Μπαμπά; Τότε δείξτε το εισιτήριό σας στην περιστρεφόμενη πόρτα και μπείτε σε αυτή την ενότητα, μετά πατήστε τον επόμενο σταθμό για να συνεχίσετε.</strong>',
    s5_fwd:'ΠΡΟΣ ΤΗΝ ΚΑΡΔΙΆ ΤΗΣ ΑΦΘΟΝΊΑΣ →',
    s6_ct1:'🏛️ ΤΑ ΙΜΑΡΈΤ',s6_ct2:'🍲 ΤΟ ΙΜΑΡΈΤ ΤΟΥ ΣΟΥΛΤΆΝΟΥ ΒΑΓΙΑΖΉΤ Β\'',s6_ct3:'🔥 ΚΟΥΖΊΝΑ ΚΑΙ ΤΡΑΠΕΖΑΡΊΑ',s6_ct4:'🎭 ΑΥΤΉ Η ΕΝΌΤΗΤΑ ΤΟΥ ΜΟΥΣΕΊΟΥ',s6_ct5:'🌿 Ο ΤΆΦΟΣ ΤΟΥ ΓΙΑΧΥΆ ΜΠΑΜΠΆ',s6_ct6:'📖 Ο ΘΡΎΛΟΣ ΤΟΥ ΓΙΑΧΥΆ ΜΠΑΜΠΆ',s6_ct7:'⚖️ Η ΔΟΚΙΜΑΣΊΑ ΤΟΥ ΦΎΛΑΚΑ',s6_ct8:'👑 Ο ΣΟΥΛΤΆΝΟΣ ΩΣ ΜΆΡΤΥΡΑΣ',s6_ct9:'🐟 ΤΟ ΘΑΎΜΑ ΤΩΝ ΨΑΡΙΏΝ',s6_ct10:'🤲 Η ΑΝΑΧΏΡΗΣΗ ΤΟΥ ΓΙΑΧΥΆ ΜΠΑΜΠΆ',s6_ct11:'🪦 ΕΠΊΣΚΕΨΗ ΣΤΟ ΤΆΦΟ',
    s6_c1:'Στην Οθωμανική Αυτοκρατορία, τα ιμαρέτ ήταν μεταξύ των πιο σημαντικών ιδρυμάτων που ενσάρκωναν το πνεύμα κοινωνικής αλληλεγγύης και φιλανθρωπίας. Ως συσσίτια που διένεμαν δωρεάν φαγητό στους φτωχούς, τους ταξιδιώτες, τους σπουδαστές και τους άπορους, αυτές οι κατασκευές δεν ήταν απλώς κουζίνες — ήταν ζωτικά κέντρα που προστάτευαν τα πιο εύθραυστα μέλη της κοινωνίας και διατηρούσαν την κοινωνική ισορροπία.',
    s6_c2:'Και βρίσκεστε τώρα μέσα σε έναν τέτοιο χώρο. Το ιμαρέτ του Κυλλιγιέ του Σουλτάνου Βαγιαζήτ Β\', που ιδρύθηκε ως τρίτη ενότητα του Μουσείου Υγείας, ήταν ένα σημαντικό φιλανθρωπικό ίδρυμα όπου — σύμφωνα με το ιδρυτικό του έγγραφο — μαγειρεύονταν και διανέμονταν στους φτωχούς τρία γεύματα την ημέρα.',
    s6_c3:'Ο ευρύχωρος χώρος που συναντάτε κατά την είσοδο είναι η κουζίνα όπου το φαγητό μαγειρευόταν σε μεγάλα καζάνια. Η μεγάλη αίθουσα που βλέπετε μέσα από την πόρτα αμέσως στα δεξιά σας ήταν ο χώρος όπου τα γεύματα λαμβάνονταν σε τραπέζια στο πέτρινο πάτωμα.',
    s6_c4:'Όπως και οι άλλες ενότητες του Μουσείου Υγείας, αυτή η ενότητα είναι εμψυχωμένη με ανδρείκελα κατάλληλα για το πνεύμα του χώρου, αφηγούμενη τον οθωμανικό πολιτισμό ιμαρέτ και μεταφέροντας τους επισκέπτες σε ένα ταξίδι στο χρόνο. Αρχικά χάλκινα σκεύη, γουδιά και αποθηκευτικά αγγεία της εποχής εκτίθενται επίσης εδώ.',
    s6_c5:'Αμέσως πίσω από το ιμαρέτ βρίσκεται ο Τάφος του Μάγειρα Γιαχυά Μπαμπά, μιας μυθικής φυσιογνωμίας. Καθώς εξερευνάτε αυτό το ενδιαφέρον και ευρύχωρο κτήριο, αφήστε με να σας πω τον θρύλο του Μάγειρα Γιαχυά Μπαμπά που έχει επιβιώσει μέχρι σήμερα.',
    s6_c6:'Σύμφωνα με την ιστορία, ο Γιαχυά Μπαμπά, ο αρχιμάγειρας κατά τη βασιλεία του ιδρυτή του Κυλλιγιέ, Σουλτάνου Βαγιαζήτ Β\', φτιαχνεί εξαιρετικά νόστιμο ρυζόπιλαφ. Ενώ ανακατεύει το πιλάφι, προσεύχεται συνεχώς, και όταν κλείνει το καπάκι λέει: "Δώσε αφθονία, ω Κύριε." Το πιλάφι ήταν τόσο άφθονο που τάιζε όλους τους ασθενείς και περίσσευε ακόμα. Ο Γιαχυά Μπαμπά ποτέ δεν πετούσε το περισσευούμενο πιλάφι — το έπαιρνε για να ταΐσει τα ψάρια στον ποταμό Τούντζα.',
    s6_c7:'Όταν ο φύλακας παρατήρησε ότι ο Γιαχυά Μπαμπά έδινε το περίσσευμα πιλαφιού στο ποτάμι, άρχισε να μειώνει την ποσότητα ρυζιού που του διαθέτουν μέρα με τη μέρα. Όμως ακόμα και με λιγότερο ρύζι, ο Γιαχυά Μπαμπά μαγείρευε το πιλάφι με προσευχή, τρέφοντας τόσο τους ασθενείς όσο και τα ψάρια. Τελικά το ρύζι που διατέθηκε μειώθηκε σε μια μόνο χούφτα. Το πιλάφι του Γιαχυά Μπαμπά τάιζε ακόμα όλους τους ασθενείς, και κατάφερνε ακόμα να βάζει ένα μερίδιο στην άκρη για τα ψάρια.',
    s6_c8:'Η είδηση έφτασε τελικά στα αυτιά του Σουλτάνου. Αποφασίζοντας να γίνει ο ίδιος μάρτυρας, ο Σουλτάνος έφτασε στην όχθη του ποταμού Τούντζα πριν από τον Γιαχυά Μπαμπά και κρύφτηκε. Καθώς ο Γιαχυά Μπαμπά ήταν έτοιμος να επιστρέψει αφού τάισε τα ψάρια, ο Σουλτάνος βγήκε από την κρυψώνα του και βρυχήθηκε: "Εσύ εκεί — ρίχνεις τα τρόφιμα των ασθενών στο ποτάμι;"',
    s6_c9:'Ο Γιαχυά Μπαμπά πάγωσε. Δεν μπορούσε να πει τίποτα. Ήταν τόσο κατακλυσμένος από ντροπή που γονάτισε και αναζήτησε καταφύγιο στον Θεό. Αλλά τα ψάρια, σηκώνοντας τα κεφάλια τους από το νερό, μίλησαν: "Μήπως ο μεγάλος Σουλτάνος αρνείται στα ψάρια τη διατροφή τους;"',
    s6_c10:'Ο Σουλτάνος, συνειδητοποιώντας το λάθος του με κατάπληξη και θλίψη, περίμενε τον Γιαχυά Μπαμπά να σηκώσει το κεφάλι από τη γονυπέτηση — αλλά μάταια. Αυτός ο ευεργετικός άνθρωπος είχε ήδη παραδώσει την ψυχή του…',
    s6_c11:'Ο τάφος του Γιαχυά Μπαμπά, που βρίσκεται ακριβώς πίσω από το ιμαρέτ, επισκέπτεται ως ιερό αγίου από περαστικούς που έρχονται να προσευχηθούν. Ειδικά τις Παρασκευές, αυτός ο τάφος γεμίζει με επισκέπτες.',
    s6_callout:'🪦 <strong>ΞΕΝΟΔΟΧΕΊΑ:</strong> Αφού ακούσατε αυτόν τον θρύλο, είναι ώρα να βγείτε από το ιμαρέτ και να ξεκουραστείτε στο καφέ του μουσείου στα αριστερά. Στο καφέ του μουσείου στο ξενοδοχείο του Κυλλιγιέ, μπορείτε να απολαύσετε τσάι και κυρίως ένα οθωμανικό σερμπέτ, να αγοράσετε δώρα και βιβλία, να επισκεφθείτε τη βιβλιοθήκη του μουσείου και στη συνέχεια να προχωρήσετε στον τελικό σταθμό — την αυλή του Τζαμιού. Να κάνουμε ένα σύντομο διάλειμμα στο Ξενοδοχείο Κυλλιγιέ;',
    s6_fwd:'ΠΡΟΣ ΤΟ ΚΑΦΈ ΤΟΥ ΜΟΥΣΕΊΟΥ →',
    s7_ct1:'🏛️ ΑΥΛΉ ΚΑΙ ΕΊΣΟΔΟΣ ΣΤΟ ΤΖΑΜΊ',s7_ct2:'🚪 ΕΊΣΟΔΟΣ ΚΑΙ ΑΤΜΌΣΦΑΙΡΑ',s7_ct3:'⛲ Η ΚΡΉΝΗ ΚΑΙ Η ΓΑΛΉΝΗ',s7_ct4:'🏛️ ΜΑΡΜΆΡΙΝΕΣ ΚΟΛΌΝΕΣ ΚΑΙ ΑΡΧΙΤΕΚΤΟΝΙΚΉ ΑΡΜΟΝΊΑ',s7_ct5:'✨ ΕΣΩΤΕΡΙΚΉ ΗΡΕΜΊΑ ΚΑΙ ΓΑΛΉΝΗ',s7_ct6:'👁️ ΣΤΙΓΜΈΣ ΠΑΡΑΤΉΡΗΣΗΣ',s7_ct7:'🚪 ΕΊΣΟΔΟΣ ΣΤΟ ΤΖΑΜΊ',s7_ct8:'🪵 Η ΤΈΧΝΗ ΤΟΥ ΚΙΟΥΝΤΕΚΆΡΙ',
    s7_c1:'Έχετε περιηγηθεί στις ενότητες του Μουσείου Υγείας μας και έχετε γευτεί το δροσερό οθωμανικό σερμπέτ στο καφέ. Τώρα είναι ώρα να γνωρίσετε μια από τις πιο μεγαλοπρεπείς κατασκευές του Κυλλιγιέ — το τζαμί.',
    s7_c2:'Καθώς μπαίνετε από την κομψή πλαϊνή πόρτα που ανοίγει στην αυλή, ή από τη μεγάλη κύρια πύλη, σας υποδέχεται η εκλεπτυσμένη τεχνουργία του μαρμάρου. Σε μια στιγμή, αφήνετε πίσω σας τον θόρυβο του εξωτερικού κόσμου και γλιστράτε σε μια εντελώς διαφορετική ατμόσφαιρα.',
    s7_c3:'Η κρήνη στην ίδια την καρδιά της αυλής γεμίζει τον χώρο με ηρεμία μέσω του ήρεμου ήχου του νερού. Αυτός ο ήχος, σε συνδυασμό με τη σιωπή της πέτρας, σας επιβραδύνει και σας κάνει συνειδητούς για την παρούσα στιγμή.',
    s7_c4:'Οι μαρμάρινες κολόνες που σας περιβάλλουν υψώνονται σαν ένα προστατευτικό δαχτυλίδι. Επιλεγμένες σε διαφορετικά χρώματα, ενσαρκώνουν την κομψότητα και τον αρμονικό πλούτο της οθωμανικής αισθητικής.',
    s7_c5:'Αυτό που νιώθετε εδώ δεν είναι απλώς αρχιτεκτονική ομορφιά — είναι μια γαλήνη, μια εσωτερική ηρεμία που παραμένει αναλλοίωτη εδώ και αιώνες.',
    s7_c6:'Κάντε μια σύντομη παύση στην κρήνη και παρατηρήστε αυτή την απλή αλλά εντυπωσιακή διάταξη αυλής. Νιώστε την αρμονία που δημιουργούν οι κολόνες, τα τόξα και τα λεπτά κοσμήματα μεταξύ τους.',
    s7_c7:'Στη συνέχεια στραφείτε προς τη μεγαλοπρεπή πύλη που υψώνεται ακριβώς μπροστά σας. Ανοίξτε απαλά την δερμάτινη κουρτίνα που καλύπτει την πόρτα και μπείτε μέσα. Θα νιώσετε αμέσως ότι έχετε μπει σε ένα από τα πιο κομψά τζαμιά της χώρας μας.',
    s7_c8:'Καθώς μπαίνετε, μην ξεχάσετε να δώσετε προσοχή στην πρωτότυπη ξυλογλυπτική κιουντεκάρι πάνω από την πόρτα — και αν είναι δυνατόν, αγγίξτε την υφή αυτής της εξαίσιας τεχνουργίας.',
    s7_callout:'🕌 <strong>Ας μπούμε στη μεγάλη έκταση και τη γαλήνη εντός του ιερού;</strong>',
    s7_fwd:'ΠΡΟΧΩΡΉΣΤΕ ΜΈΣΑ →',
    s8_ct1:'🕌 ΕΝΤΌΣ ΤΟΥ ΤΖΑΜΙΟΎ — ΤΟ ΦΙΝΆΛΕ',s8_ct2:'🚤 ΙΣΤΟΡΙΚΉ ΜΕΤΑΦΟΡΆ ΚΑΙ ΒΑΣΙΛΙΚΉ ΠΑΡΆΔΟΣΗ',s8_ct3:'👑 ΦΑΝΤΑΣΤΕΊΤΕ ΤΗΝ ΒΑΣΙΛΙΚΉ ΣΤΟΆ',s8_ct4:'🏛️ Η ΒΑΣΙΛΙΚΉ ΣΤΟΆ ΚΑΙ ΤΑ ΠΡΩΤΑ ΤΗΣ',s8_ct5:'⚙️ ΤΟ ΜΙΧΡΆΜΠ ΚΑΙ ΟΙ ΛΊΘΟΙ ΙΣΟΡΡΟΠΊΑΣ',s8_ct6:'🪵 ΤΟ ΜΙΝΜΠΈΡ ΚΑΙ Η ΕΚΛΕΠΤΥΣΜΈΝΗ ΤΕΧΝΟΥΡΓΊΑ',s8_ct7:'📐 ΣΎΜΒΟΛΑ ΚΑΙ ΣΗΜΑΣΊΕΣ',s8_ct8:'💡 ΦΩΣ ΚΑΙ ΑΚΟΥΣΤΙΚΉ ΤΆΞΗ',s8_ct9:'🌌 ΜΕΓΑΛΟΠΡΈΠΕΙΑ ΥΠΌ ΤΟΝ ΤΡΟΎΛΟ',s8_ct10:'🏗️ ΈΝΑ ΑΡΧΙΤΕΚΤΟΝΙΚΌ ΣΤΑΥΡΟΔΡΌΜΙ',s8_ct11:'✨ ΦΙΝΆΛΕ ΚΑΙ ΑΠΟΧΑΙΡΕΤΙΣΜΌΣ',
    s8_c1:'Βρίσκεστε τώρα στο εσωτερικό του τζαμιού στο κέντρο του Κυλλιγιέ, και ολοκληρώνουμε το φινάλε της περιήγησής μας κάτω από αυτόν τον υπέροχο τρούλο.',
    s8_c2:'Ο Σουλτάνος Βαγιαζήτ Β\', ο ιδρυτής του Κυλλιγιέ, και οι σουλτάνοι που τον διαδέχθηκαν συνήθιζαν να φτάνουν σε αυτό το τζαμί ταξιδεύοντας κατά μήκος του ποταμού σε στολισμένες αυτοκρατορικές βάρκες. Έμπαιναν από την πόρτα δίπλα στο ποτάμι και εκτελούσαν τις προσευχές τους στη βασιλική στοά — τον χούνκαρ μαχφίλ — που υψώνεται σε κολόνες στην αριστερή γωνία του τζαμιού.',
    s8_c3:'Κλείστε τα μάτια σας για μια στιγμή… Φανταστείτε τον Σουλτάνο, σε εκείνο το ύψος, να λατρεύει με την ίδια ειρήνη μαζί με την κοινότητα.',
    s8_c4:'Θυμούμενοι ότι η πρώτη βασιλική στοά που χτίστηκε ποτέ στην τουρκο-ισλαμική αρχιτεκτονική βρίσκεται εδώ, ας περπατήσουμε τώρα προς το μιχράμπ.',
    s8_c5:'Όταν αγγίξετε και στρέψετε απαλά τους κυλινδρικούς λίθους ισορροπίας εκατέρωθεν του μιχράμπ, θα εκπλαγείτε διαπιστώνοντας ότι το έδαφος αυτής της μεγάλης κατασκευής δεν παρουσιάζει την παραμικρή μετατόπιση.',
    s8_c6:'Καθώς πλησιάζετε το μινμπέρ στα δεξιά, θα θαυμάσετε τη λεπτότητα και την κομψότητα της μαρμάρινης τεχνουργίας.',
    s8_c7:'Τώρα σας προτείνω να γυρίσετε την πλάτη σας στο μιχράμπ και να κοιτάξετε πάνω από την πόρτα εισόδου. Το μοτίβο δίσκου με ένα καρπούζι στο κέντρο του, τοποθετημένο ακριβώς πάνω από την πόρτα, συμβολίζει ότι υπάρχει ένα ιμαρέτ σε αυτό το Κυλλιγιέ και ότι αυτοί που έρχονται εδώ καλούνται σε γεύμα.',
    s8_c8:'Τα παράθυρα γύρω από τον τρούλο και στις κατώτερες σειρές εξασφαλίζουν ότι το φως κατανέμεται ομοιόμορφα σε όλο τον χώρο. Αυτή η διάταξη φωτισμού, σε συνδυασμό με την ισχυρή ακουστική του τζαμιού, προσδίδει στον χώρο τόσο οπτικό όσο και ακουστικό βάθος.',
    s8_c9:'Και τώρα σηκώστε το βλέμμα σας ψηλά… Κοιτάξτε προσεκτικά αυτόν τον υπέροχο τρούλο στολισμένο με μπαρόκ διακοσμήσεις. Περίπου 31 μέτρα ψηλός και 22 μέτρα διάμετρο, αυτός ο τρούλος — που στηρίζεται σε τέσσερις τοίχους χωρίς ενδιάμεσες κολόνες — είναι ένα αρχιτεκτονικά αξιοσημείωτο παράδειγμα.',
    s8_c10:'Θεωρείται επίσης σημαντικός πρόδρομος της μετάβασης προς μονοθόλωτες κατασκευές.',
    s8_c11:'Κάτω από τη χάρη και τη μεγαλοπρέπεια αυτού του ανεπανάληπτου τρούλου, ολοκληρώνουμε αυτό το ταξίδι όπου έχετε συνδέσει τα ίχνη του παρελθόντος με τη σιωπή του σήμερα — μην ξεχάσετε να κουβαλήσετε μαζί σας την ειρήνη και τον θαυμασμό που σας άφησε αυτός ο χώρος στην καρδιά σας.',
    s8_callout:'🙏 <strong>Να βάλουμε έναν ήσυχο αποχαιρετισμό σε αυτό το πνευματικό ταξίδι;</strong>',
    s8_fwd:'ΠΡΟΣ ΤΟΝ ΑΠΟΧΑΙΡΕΤΙΣΜΌ →',
    s9_c1:'🏛️ Ακολουθήσαμε τα αποτυπώματα του παρελθόντος βήμα βήμα, αναπνέοντας μαζί αυτή τη μεγαλοπρεπή αρχιτεκτονική. Τώρα είναι ώρα να προσθέσετε τη δική σας ανάσα σε αυτόν τον ιστορικό τόπο.',
    s9_c2:'💭 Αυτό που αντηχεί μέσα σας… Μια στιγμή ειρήνης, ένας βαθύς θαυμασμός, ή εκείνη η ήσυχη νότα που μένει στην καρδιά σας…',
    s9_c3:'📖 Το Βιβλίο Επισκεπτών που έχουμε ετοιμάσει για σας είναι ένα πνευματικό αρχείο αυτής της εμπειρίας. Κάθε πρόταση που αφήνετε εδώ θα είναι: μια ανεκτίμητη ανάμνηση για εμάς, και ένα φως που δίνει νόημα σε αυτό το ταξίδι για τους άλλους επισκέπτες μας.',
    s9_c4:'✨ Μοιραστείτε μαζί μας αυτό που ρέει από την καρδιά σας — και αφήστε το σημάδι σας να παραμείνει για πάντα στη Γέφυρα Καρδιάς…',
    s9_callout:'✍️ <strong>Σας προσκαλούμε να μοιραστείτε τα συναισθήματά σας στη σελίδα μας Γέφυρα Καρδιάς.</strong>',
    s9_fwd:'ΓΡΆΨΤΕ ΣΤΗ ΓΈΦΥΡΑ ΚΑΡΔΙΆΣ →',
    s10_body:'Θα θέλαμε πολύ να ακούσουμε τις εντυπώσεις που άφησε σε σας αυτό το ταξίδι 500 ετών μέσα από το Κυλλιγιέ μας. Οι λέξεις σας θα γίνουν πέτρες αυτής της γέφυρας.',
    s10_restart:'🏛️ ΕΠΙΣΤΡΟΦΉ ΣΤΗΝ ΑΡΧΉ'
  },
 zh:{
    start:'开始旅程',intro_title:'门槛的邀请',intro_sub:'超越时间的旅程，走向疗愈的中心…',
    back:'← 返回',menu_lang:'语言：中文 🇨🇳',menu_map:'地图与位置',menu_defter:'心桥',
    loc_searching:'📍 正在获取位置…',loc_outside:'📍 您在屈利耶区域外。',
    loc_error:'📍 无法获取位置。请开启位置权限。',
    gb_name:'您的姓名',gb_city:'您的城市',gb_msg:'在此留下您的感受…',
    gb_submit:'我将我的石头放上心桥 🪨',gb_submitting:'封印中…',
    gb_conn_err:'连接错误。请重试。',gb_no_msg:'请留下留言…',
    confirm_text:'您的感受已封印于心桥之上。您留下的珍贵印记丰富了我们屈利耶的精神遗产…',
    confirm_close:'祝您安康 🌿',latest_title:'📜 最新留言',archive_title:'🗂️ 档案',
    no_msg:'暂无留言。成为第一个放置石头的人吧！✨',
    s0_main:'🏛️ 苏丹巴耶济德二世屈利耶',s0_sub:'健康博物馆',s0_slogan:'✨ 疗愈之旅 — 博物馆入口',
    s1_main:'达吕什法入口',s1_sub:'🏛️ 正义与疗愈之门',s1_slogan:'⚖️ 疗愈的第一站',
    s2_main:'走出展示厅',s2_sub:'🏛️ 从知识到体验',s2_slogan:'🏛️ 管理与秩序',
    s3_main:'大疗养院（八角形大厅）',s3_sub:'🏛️ 达吕什法的门槛',s3_slogan:'🌊 疗愈的顶峰',
    s4_main:'医学经学院',s4_sub:'🎓 知识的摇篮',s4_slogan:'📚 学习之光',
    s5_main:'大庭院',s5_sub:'🌿 百年悬铃木',s5_slogan:'🌳 时间与宁静',
    s6_main:'伊马雷特（施粥所）',s6_sub:'🍲 慈悲与丰盛',s6_slogan:'🍲 叶海亚·巴巴的厨房',
    s7_main:'准备迎接精神氛围',s7_sub:'🕌 清真寺入口',s7_slogan:'✨ 一座穹顶，无尽安宁',
    s8_main:'清真寺内的精神之旅',s8_sub:'🕌 清真寺庭院',s8_slogan:'🌌 穹顶下的终章',
    s9_main:'告别时刻',s9_sub:'🌊 心桥的邀请',s9_slogan:'✨ 在这段故事中留下您的印记',
    s10_main:'🖋️ 心桥',s10_slogan:'"过去的疗愈与今日的文字相遇。"',
    nav_back:'← 返回',
    s0_ct1:'👑 历史',s0_ct2:'🏗️ 建筑结构',s0_ct3:'🎧 您的向导',s0_ct4:'📵 注意事项',s0_ct5:'📍 位置',s0_ct6:'🏫 参观引导',
    s0_c1:'您现在身处埃迪尔内最迷人的历史遗址之一——苏丹巴耶济德二世屈利耶健康博物馆。欢迎来到这个历史与疗愈相遇的地方。',
    s0_c2:'这座建筑群由征服者穆罕默德之子、第八任奥斯曼苏丹巴耶济德二世，在总建筑师海雷廷的主持下建造，是所有奥斯曼屈利耶中保存最完好的。其中心为清真寺，右侧为医院和经学院，左侧为施粥所和储藏室，清真寺两侧为宾馆，其后有一座横跨图恩贾河的桥——所有这一切都体现了奥斯曼社会国家模式。',
    s0_c3:'我将通过文字、音频和视觉内容引导您参观屈利耶和博物馆，丰富您的参观体验。',
    s0_c4:'请在整个参观过程中留意您的手机。',
    s0_c5:'您已通过售票处，现在位于前花园。请站在对面墙上悬挂的大型屈利耶照片前，了解这些建筑在埃迪尔内城市中的位置。',
    s0_c6:'走向这个方向时，右侧的建筑是屈利耶的医学经学院，正前方的建筑是达吕什法——屈利耶的心脏，也是我们博物馆的中心。',
    s0_callout:'👣 <strong>欣赏完大照片后，请从左侧的门进入达吕什法的花园。</strong>',
    s0_fwd:'开启穿越时光之旅 →',
    s1_ct1:'🏥 达吕什法 — 第一庭院',s1_ct2:'🌍 历史意义',s1_ct3:'🛏️ 服务用房',s1_ct4:'🩺 门诊室',s1_ct5:'🧭 指引',s1_ct6:'💧 乳井',s1_ct7:'🌿 树与常春藤',s1_ct8:'🎬 展示厅',
    s1_c1:'您现在身处奥斯曼帝国最重要的疗愈中心之一——埃迪尔内达吕什法的第一庭院。请在此停留片刻，观察周围环境。',
    s1_c2:'首先请了解：这座建筑被认为是历史上最早的中央规划且精心设计的医院之一。西方同类建筑约晚了200年才出现——这里的治疗和服务区域以远超时代的建筑理念得以实现。',
    s1_c3:'沿前方小路前行，入口左侧紧邻的四个房间是达吕什法的服务部门：员工室、洗衣房、饮食厨房和食品储藏室。',
    s1_c4:'右侧柱廊后方是六间门诊室，日常患者检查、护理和紧急处置在此进行。建院之初，其中一间专门留给被称为"克哈勒"的眼科医生。',
    s1_c5:'这些配有展示品和信息牌的房间留待返回时详细参观，现在让我先引导您前往展示厅。它位于第一庭院后方左侧。走过去时，请注意左侧的水井。',
    s1_c6:'这个石质构造被称为"乳井"，因为人们相信其水可以增加新生儿母亲的乳汁。再往前约20米的草地中，您会看到一棵缠绕着常春藤的树。',
    s1_c7:'到达那里时，请务必阅读草地展板上阿赫迈特·库特西·泰杰尔为这棵树写的忧郁爱情诗。然后带着心中的那种感受，再次注视树与常春藤。',
    s1_c8:'诗的后方，紧靠左侧，是我们的展示厅。在这里您可以观看关于屈利耶和达吕什法历史与发展的视频，全面了解这个地方在医学史和建筑史上的重要性。',
    s1_callout:'🎬 <strong>您想观看展示视频吗？</strong> 可以在展示厅观看，也可以点击下方按钮在手机上观看。',
    s1_watch:'观看展示 ▶',s1_fwd:'前往展示厅 →',
    s2_ct1:'🚪 进入第二庭院',s2_ct2:'🏛️ 行政用房',s2_ct3:'🔒 行政区域',s2_ct4:'✨ 碑文与入口',
    s2_c1:'走出展示厅后，立即从左侧的大门进入设有行政办公室的第二庭院。',
    s2_c2:'这个庭院共有4个房间，两侧各两间。院长和其他医生使用这些房间，医院的所有运营均在此规划和管理。建院之初，这座达吕什法有1名院长、两名医生、2名外科医生、2名眼科医生和1名药剂师。',
    s2_c3:'这一行政区域也充当了第一庭院日常患者流与您即将进入的住院治疗病区之间的保护屏障。',
    s2_c4:'现在请阅读门上方的碑文，然后屏住呼吸…',
    s2_callout:'🚶‍♂️ <strong>踏入这个音乐与水声相遇于疗愈的神奇之地。</strong>',
    s2_fwd:'探索大疗养院 →',
    s3_ct1:'🏥 住院治疗病区',s3_ct2:'🌊 医院结构',s3_ct3:'🎵 音乐疗法',s3_ct4:'💧 水疗法',s3_ct5:'🌿 芳香疗法',s3_ct6:'🧺 作业疗法',s3_ct7:'🚶 出口与参观',
    s3_c1:'您现在身处博物馆的心脏——埃迪尔内达吕什法的住院治疗病区。请带着500年前在此寻得疗愈之人的心情，走过这个空间。',
    s3_c2:'想象一座医院，中央有一座节奏流淌的喷泉迎接您，正对面是音乐舞台。这座宽大穹顶覆盖的中央规划医院由6间冬季病房、4间夏季病房和一个音乐舞台组成。穹顶上的天窗同时排出污浊空气。倾斜的地面和下方的沟渠便于清洗和清洁。',
    s3_c3:'这家医院与众不同之处在于，除当代医学知识外，还在治疗中运用音乐调式。由10名演奏者组成的乐团按医生建议，为不同疾病演奏和演唱不同调式——据信对各种病症有益。',
    s3_c4:'建筑中央喷泉流水的声音是治疗的重要组成部分，旨在使患者平静和舒缓。',
    s3_c5:'除音乐和水声外，达吕什法还实践芳香疗法。庭院及周边种植的各种植物的香气是疗愈过程不可或缺的一部分。',
    s3_c6:'作业疗法也在此作为治疗方法使用。患者参与编篮、编织和各种手工艺，以分散对烦恼和杂念的注意力。',
    s3_c7:'参观完展示奥斯曼医学不同方面的各个房间后，您可以走出住院病区。离开这个持续服务了400年的疗愈之地时，您还可以参观第二和第一庭院的其他房间，进一步了解达吕什法和奥斯曼医学。',
    s3_callout:'🏫 <strong>前往医学经学院：</strong> 走出达吕什法，前往位于大照片入口花园左侧的医学经学院。',
    s3_fwd:'前往经学院 →',
    s4_ct1:'🏫 医学经学院',s4_ct2:'🌍 历史意义',s4_ct3:'📚 教育体系',s4_ct4:'🏛️ 建筑结构',s4_ct5:'📜 埃夫利亚·切勒比',s4_ct6:'👨‍🏫 教学人员',s4_ct7:'📖 手稿',s4_ct8:'🏥 健康博物馆',
    s4_c1:'您参观了达吕什法，现在进入屈利耶另一个重要区域——苏丹巴耶济德二世医学经学院。进入右侧和对面的博物馆展厅之前，请先停下来仔细观察这个独特的空间。',
    s4_c2:'您现在看到的这座围绕方形庭院布置的建筑，曾是奥斯曼帝国培养医生最负盛名的教育机构之一，数百年间培养了众多杰出医生的重要学术中心。',
    s4_c3:'在奥斯曼教育体系中被列为最高级别的"60阿克切及以上"经学院，学生可在此将理论训练应用于毗邻的达吕什法，以实践巩固知识。',
    s4_c4:'经学院中央原有喷泉（今已不存），角落设有水井供水，三面排列18间学生室，正对面是讲堂。',
    s4_c5:'1652年造访屈利耶的埃夫利亚·切勒比曾如此记载这座经学院："医学经学院及其房间中有学生，他们不断谈论柏拉图、苏格拉底、亚里士多德、盖伦和毕达哥拉斯等学者——每位都是成熟的医生。各人专注于某一知识领域，依赖医学艺术中的珍贵书籍，努力为人类的疾苦寻找治疗之道。"',
    s4_c6:'教学人员包括每天获得60阿克切、教授18名学生的教授，一名助理教授、一名图书管理员和两名仆人。学生所有需求均得到保障，另外每日还获得两阿克切奖学金。',
    s4_c7:'在此研习的38部手写医学手稿——许多带有奥斯曼苏丹印章——保存至今。这些珍贵著作现收藏于塞利米耶手稿图书馆。',
    s4_c8:'经学院于2007年由色雷斯大学开放为健康博物馆的第二展区。其房间讲述了那个时代的医学教育。最重要的区域是入口正对面的讲堂。',
    s4_callout:'🚶 <strong>参观以人体模型再现15世纪氛围的学生室、实习室、教授室、讲堂和图书馆后，走出经学院，通过达吕什法出口附近的旋转闸进入清真寺庭院，继续前往伊马雷特。</strong>',
    s4_fwd:'走向清真寺的壮观 →',
    s5_ct1:'🌳 进入花园',s5_ct2:'💧 水秤',s5_ct3:'🕌 清真寺正门',s5_ct4:'🏛️ 储藏室与伊马雷特',
    s5_c1:'参观达吕什法和经学院后，您进入了清真寺花园。请在这片百年悬铃木的美丽花园中缓步前行，朝正前方博物馆的伊马雷特展区走去。',
    s5_c2:'从达吕什法方向进入花园时，首先请注意右侧清真寺角落处一个约4米高的长方形石质构造。这是屈利耶的水秤。从高山上通过管道引来的水，首先在这个构造内平衡水压，然后再分配到屈利耶的其他部门。',
    s5_c3:'经过水秤后，右侧会出现清真寺宏伟的正面入口门廊。我们将通过这座门廊探索清真寺庭院留到参观的最后，请继续走向伊马雷特。',
    s5_c4:'前方有两座建筑风格相近的大型建筑并排而立。左侧的建筑包含储藏室和面包房，现用于博物馆的学术和文化活动。右侧就是我现在引导您前往的伊马雷特。',
    s5_callout:'🍲 <strong>准备好参观奥斯曼伊马雷特文化、聆听厨师叶海亚·巴巴的传说了吗？请在旋转闸处出示门票，进入本展区，然后点击下一站继续。</strong>',
    s5_fwd:'走向丰盛的中心 →',
    s6_ct1:'🏛️ 伊马雷特',s6_ct2:'🍲 苏丹巴耶济德二世伊马雷特',s6_ct3:'🔥 厨房与餐厅',s6_ct4:'🎭 本博物馆展区',s6_ct5:'🌿 叶海亚·巴巴的圣祠',s6_ct6:'📖 叶海亚·巴巴的传说',s6_ct7:'⚖️ 仓库管理员的考验',s6_ct8:'👑 苏丹的见证',s6_ct9:'🐟 鱼的奇迹',s6_ct10:'🤲 叶海亚·巴巴的离世',s6_ct11:'🪦 参拜圣祠',
    s6_c1:'在奥斯曼帝国，伊马雷特是体现社会团结与慈善精神最重要的机构之一。这些免费向穷人、旅人、学生和困苦者提供食物的施粥所，不仅仅是厨房——它们是保护社会弱势群体、维系社会平衡的重要中心。',
    s6_c2:'而您现在身处的正是这样一个地方。苏丹巴耶济德二世屈利耶伊马雷特作为健康博物馆的第三展区而设立，是一座重要的慈善机构——根据其章程，每天三餐烹制并分发给穷人。',
    s6_c3:'入口处宽阔的空间是用大锅烹制食物的厨房。从右侧门可以看到的大厅，是在石地板餐桌上用餐的地方。',
    s6_c4:'与健康博物馆的其他展区一样，这一展区以符合场所氛围的人体模型点缀其中，讲述奥斯曼伊马雷特文化，带领参观者踏上穿越时光的旅程。该时期的原版铜制容器、研钵和储物罐也在此展出。',
    s6_c5:'伊马雷特正后方是传奇人物厨师叶海亚·巴巴的圣祠。在您探索这座有趣而宽敞的建筑时，让我为您讲述流传至今的厨师叶海亚·巴巴的传说。',
    s6_c6:'据说，叶海亚·巴巴是屈利耶创建者苏丹巴耶济德二世在位时的主厨，他烹制的米饭极为美味。搅拌米饭时他不断祈祷，盖上锅盖时会说"赐予丰盛，主啊"。米饭如此丰盛，足以喂饱所有患者，还有剩余。叶海亚·巴巴从不丢弃多余的米饭——他会带去喂图恩贾河里的鱼。',
    s6_c7:'当仓库管理员注意到叶海亚·巴巴把多余的米饭喂给河里的鱼时，他开始一天天减少给他的米量。然而即便米变少了，叶海亚·巴巴仍带着祈祷煮出米饭，既养活了患者，也养活了鱼。最终分配的米减少到了仅仅一把。叶海亚·巴巴的米饭依然喂饱了所有患者，他仍然设法为鱼留出一份。',
    s6_c8:'此事终于传到了苏丹耳中。苏丹决定亲自见证，便在叶海亚·巴巴之前来到图恩贾河边藏了起来。叶海亚·巴巴喂完鱼准备离开时，苏丹从藏身处走出，厉声喝道："你——你是在把患者的口粮倒进河里吗？"',
    s6_c9:'叶海亚·巴巴僵住了。他什么也说不出来。羞愧之情使他俯首叩地，向神祈求庇护。然而鱼儿从水中抬起头来说道："伟大的苏丹难道要吝惜鱼儿的食物吗？"',
    s6_c10:'苏丹在惊愕与悲痛中意识到自己的错误，等待叶海亚·巴巴从俯首中抬起头来——却是徒劳。这位善良的人已然归真…',
    s6_c11:'位于伊马雷特正后方的叶海亚·巴巴圣祠，被前来祈祷的过路人当作圣人墓地般参拜。尤其在周五，这座圣祠总是挤满了参拜者。',
    s6_callout:'🪦 <strong>宾馆：</strong> 听完这个传说后，是时候走出伊马雷特，在左侧的博物馆咖啡厅休息了。在屈利耶宾馆内的博物馆咖啡厅，您可以享用茶，特别是奥斯曼糖浆饮料，购买礼品和书籍，参观博物馆图书馆，然后前往最后一站——清真寺庭院。我们在屈利耶宾馆稍事休息？',
    s6_fwd:'前往博物馆咖啡厅 →',
    s7_ct1:'🏛️ 庭院与进入清真寺',s7_ct2:'🚪 入口与氛围',s7_ct3:'⛲ 喷泉与宁静',s7_ct4:'🏛️ 大理石柱与建筑和谐',s7_ct5:'✨ 内心平和与宁静',s7_ct6:'👁️ 观察时刻',s7_ct7:'🚪 进入清真寺',s7_ct8:'🪵 屈恩德卡里木工艺',
    s7_c1:'您已参观了健康博物馆的各个展区，并在咖啡厅品尝了清爽的奥斯曼糖浆饮料。现在是时候与屈利耶最宏伟的建筑之一——清真寺相遇了。',
    s7_c2:'当您踏入通向庭院的优雅侧门，或是宏伟的正面门廊时，大理石的精湛工艺映入眼帘。转瞬之间，您便将外界的喧嚣抛于身后，滑入一个截然不同的氛围之中。',
    s7_c3:'庭院正中央的喷泉，以平静的水声将空间充满宁和。这声音与石头的寂静交融，让您放慢脚步，感知当下的时刻。',
    s7_c4:'环绕您的大理石柱犹如一道守护之环高高耸立。以不同颜色选取的它们，体现着奥斯曼美学的优雅与和谐的丰富。',
    s7_c5:'您在此感受到的，不仅仅是建筑之美——而是一种宁静，一种数百年来始终如一的内心平和。',
    s7_c6:'在喷泉旁短暂停留，观察这简单却震撼人心的庭院布局。感受廊柱、拱顶与精致装饰彼此之间所营造的和谐。',
    s7_c7:'然后转向您正前方耸立的宏伟门廊。轻轻拨开覆盖门口的皮革帘幕，走进去。您会立刻感到，自己已进入国内最优雅的清真寺之一。',
    s7_c8:'进入时，请务必注意门上方原版的屈恩德卡里木雕工艺——如果可以，请触摸感受这精美工艺的纹理。',
    s7_callout:'🕌 <strong>我们踏入圣所内那广阔的空间与宁静吗？</strong>',
    s7_fwd:'继续走进内部 →',
    s8_ct1:'🕌 清真寺内部 — 终章',s8_ct2:'🚤 历史交通与皇家传统',s8_ct3:'👑 想象皇家廊台',s8_ct4:'🏛️ 皇家廊台及其首创',s8_ct5:'⚙️ 米哈拉布与平衡石',s8_ct6:'🪵 敏拜尔与精湛工艺',s8_ct7:'📐 符号与含义',s8_ct8:'💡 光线与声学秩序',s8_ct9:'🌌 穹顶下的壮观',s8_ct10:'🏗️ 建筑的转折点',s8_ct11:'✨ 终章与告别',
    s8_c1:'您现在身处屈利耶中央清真寺的内部，我们将在这座宏伟穹顶之下完成参观的终章。',
    s8_c2:'屈利耶的创建者苏丹巴耶济德二世及其后继苏丹们，乘坐华丽的御用船只沿河而来，到达这座清真寺。他们从河边的门进入，在清真寺左角柱上耸立的皇家廊台——亨卡尔·马赫菲里——礼拜。',
    s8_c3:'请闭上眼睛片刻…想象苏丹在那个高处，与众人一起在同样的宁静中礼拜的画面。',
    s8_c4:'铭记土耳其伊斯兰建筑中有史以来第一座皇家廊台就在此处，让我们现在走向米哈拉布。',
    s8_c5:'当您触碰并轻轻转动米哈拉布两侧的圆柱形平衡石时，您会惊讶地发现，这座宏伟建筑的地基丝毫没有任何偏移。',
    s8_c6:'走近右侧的敏拜尔时，您会对大理石工艺的精细与优雅叹为观止。',
    s8_c7:'现在我建议您背对米哈拉布，仰视入口门的上方。正对门上方中央有西瓜的托盘图案，象征着这座屈利耶设有伊马雷特，来此之人皆受邀用餐。',
    s8_c8:'穹顶周围和下方排列的窗户确保光线均匀分布于整个空间。这种采光安排与清真寺强大的声学效果相结合，赋予空间视觉与听觉的双重深度。',
    s8_c9:'现在请抬起目光…仔细欣赏这座饰有巴洛克装饰的宏伟穹顶。高约31米、直径22米，这座无需中间柱、仅凭四面墙支撑的穹顶，是建筑上令人称叹的杰作。',
    s8_c10:'它也被视为向单穹顶结构过渡的重要先驱。',
    s8_c11:'在这无与伦比的穹顶的恩泽与壮观之下，我们结束了这段将过去的痕迹与今日的寂静相连接的旅程——请不要忘记将这个地方在您心中留下的平静与惊叹带走。',
    s8_callout:'🙏 <strong>我们在这段精神旅程上留下一个静静的告别吗？</strong>',
    s8_fwd:'走向告别 →',
    s9_c1:'🏛️ 我们一步一步追寻着过去的足迹，共同呼吸着这壮丽建筑的气息。现在是时候将您自己的气息添加到这片历史之地了。',
    s9_c2:'💭 在您心中回响的……一刻宁静，深深的感动，或是那在心底萦绕不去的静谧音符……',
    s9_c3:'📖 我们为您准备的留言册，是这段体验的精神档案。您在此留下的每一句话，都将成为我们珍贵的回忆，也将成为照亮其他访客旅程的一盏灯。',
    s9_c4:'✨ 请与我们分享您心中涌动的一切——让您的印记永远留在心桥之上……',
    s9_callout:'✍️ <strong>我们邀请您在心桥页面分享您的感受。</strong>',
    s9_fwd:'写信给心桥 →',
    s10_body:'我们非常希望听到这段穿越我们屈利耶500年历史的旅程在您心中留下的印象。您的文字将成为这座桥的石头。',
    s10_restart:'🏛️ 返回起点'
  },
  fa:{
    start:'شروع سفر',intro_title:'دعوت به آستانه',intro_sub:'سفری فراتر از زمان، به مرکز شفا…',
    back:'→ بازگشت',menu_lang:'زبان: فارسی 🇮🇷',menu_map:'نقشه و مکان',menu_defter:'پل دل',
    loc_searching:'📍 در حال دریافت موقعیت…',loc_outside:'📍 شما خارج از محوطه کُلیّه هستید.',
    loc_error:'📍 موقعیت یافت نشد. لطفاً دسترسی به مکان را فعال کنید.',
    gb_name:'نام شما',gb_city:'شهر شما',gb_msg:'احساسات خود را اینجا بنویسید…',
    gb_submit:'سنگ خود را روی پل می‌گذارم 🪨',gb_submitting:'در حال ثبت…',
    gb_conn_err:'خطای اتصال. دوباره تلاش کنید.',gb_no_msg:'لطفاً یادداشتی بگذارید…',
    confirm_text:'احساسات شما بر پل دل ثبت شد. این ردپای معنادار شما میراث معنوی کُلیّه‌مان را غنی‌تر ساخت…',
    confirm_close:'سلامت باشید 🌿',
    latest_title:'📜 آخرین پیام‌ها',archive_title:'🗂️ آرشیو',no_msg:'هنوز پیامی نیست. اولین باشید! ✨',
    s0_main:'🏛️ مجموعه سلطان بایزید دوم',s0_sub:'موزه بهداشت',s0_slogan:'✨ سفر شفا — ورودی موزه',
    s1_main:'ورودی دارالشفا',s1_sub:'🏛️ دروازه عدالت و شفا',s1_slogan:'⚖️ اولین ایستگاه شفا',
    s2_main:'خروج از سالن ارائه',s2_sub:'🏛️ از دانش به تجربه',s2_slogan:'🏛️ مدیریت و نظم',
    s3_main:'بیمارستان بزرگ (سالن هشت‌ضلعی)',s3_sub:'🏛️ آستانه دارالشفا',s3_slogan:'🌊 اوج شفا',
    s4_main:'مدرسه پزشکی',s4_sub:'🎓 گهواره دانش',s4_slogan:'📚 نور آموزش',
    s5_main:'حیاط بزرگ',s5_sub:'🌿 چنارهای کهنسال',s5_slogan:'🌳 زمان و آرامش',
    s6_main:'عمارت (آشپزخانه عمومی)',s6_sub:'🍲 همدردی و فراوانی',s6_slogan:'🍲 آشپزخانه یحیی بابا',
    s7_main:'آمادگی برای فضای معنوی',s7_sub:'🕌 ورود به مسجد',s7_slogan:'✨ یک گنبد، آرامش بی‌پایان',
    s8_main:'سفر معنوی در مسجد',s8_sub:'🕌 حیاط مسجد',s8_slogan:'🌌 پایان‌بندی زیر گنبد',
    s9_main:'وقت خداحافظی',s9_sub:'🌊 دعوت به پل دل',s9_slogan:'✨ اثری از خود به جای بگذار',
    s10_main:'🖋️ پل دل',s10_slogan:'"شفای گذشته با کلمات امروز ملاقات می‌کند."',
    nav_back:'→ بازگشت',
    s0_ct1:'👑 تاریخ',s0_ct2:'🏗️ ساختار',s0_ct3:'🎧 راهنمای شما',s0_ct4:'📵 توجه',s0_ct5:'📍 مکان',s0_ct6:'🏫 جهت‌یابی',
    s0_c1:'اکنون در یکی از جذاب‌ترین مکان‌های تاریخی ادرنه — موزه بهداشت کُلیّه سلطان بایزید دوم — هستید. به این مکان که تاریخ و شفا در آن به هم می‌رسند، خوش آمدید.',
    s0_c2:'این مجموعه به دستور سلطان بایزید دوم، پسر سلطان محمد فاتح و هشتمین سلطان عثمانی، توسط معمارباشی حیرالدین ساخته شده است و بهترین کُلیّه حفظ‌شده در میان همه کُلیّه‌های عثمانی است. در مرکز آن مسجد، سمت راست بیمارستان و مدرسه، سمت چپ عمارت و انبار، در کنار مسجد مهمان‌خانه‌ها و پشت آن پلی بر روی رودخانه تونجا قرار دارد — همه اینها بازتاب نظام دولت رفاهی عثمانی است.',
    s0_c3:'با محتوای نوشتاری، صوتی و تصویری شما را در کُلیّه و موزه‌مان راهنمایی می‌کنم تا بازدیدتان غنی‌تر شود.',
    s0_c4:'لطفاً در طول تور توجه خود را به تلفن همراهتان حفظ کنید.',
    s0_c5:'از گیشه بلیت گذشتید و اکنون در باغ جلویی هستید. لطفاً مقابل عکس بزرگ کُلیّه که روی دیوار روبه‌روی شما آویزان است بایستید و جایگاه این ابنیه را در شهر ادرنه بررسی کنید.',
    s0_c6:'در مسیر رفتن به این نقطه، ساختمان سمت راست شما مدرسه پزشکی کُلیّه و ساختمان مستقیماً روبه‌روی شما دارالشفاست — شاید قلب کُلیّه و مرکز موزه ما.',
    s0_callout:'👣 <strong>پس از بررسی عکس بزرگ، از درِ سمت چپ وارد باغ دارالشفا شوید.</strong>',
    s0_fwd:'آغاز سفر در زمان ←',
    s1_ct1:'🏥 دارالشفا — حیاط اول',s1_ct2:'🌍 اهمیت تاریخی',s1_ct3:'🛏️ اتاق‌های خدماتی',s1_ct4:'🩺 اتاق‌های سرپایی',s1_ct5:'🧭 مسیریابی',s1_ct6:'💧 چاه شیر',s1_ct7:'🌿 درخت و پیچک',s1_ct8:'🎬 سالن ارائه',
    s1_c1:'اکنون در حیاط اول دارالشفای ادرنه، یکی از مهم‌ترین مراکز درمانی امپراتوری عثمانی هستید. لطفاً لحظه‌ای اینجا بمانید و اطرافتان را تماشا کنید.',
    s1_c2:'پیش از هر چیز بدانید: این بنا به عنوان یکی از اولین نمونه‌های بیمارستان با برنامه‌ریزی مرکزی و دقیق در تاریخ شناخته می‌شود. نمونه‌های غربی مشابه تنها حدود ۲۰۰ سال بعد ظهور کردند — اینجا فضاهای درمانی با دیدگاه معماری بسیار پیشرفته‌تر از زمان خود شکل گرفتند.',
    s1_c3:'با پیش رفتن در مسیر، چهار اتاق بلافاصله سمت چپ ورودی بخش‌های خدماتی دارالشفاست: اتاق کارکنان، رختشویخانه، آشپزخانه رژیمی و انبار آذوقه.',
    s1_c4:'در سمت راست، پشت ستون‌ها، شش اتاق سرپایی قرار دارد که معاینه روزانه بیماران، مراقبت و مداخلات اورژانسی در آنها انجام می‌شد. در سال‌های ابتدایی، یکی از این اتاق‌ها به پزشکان چشم معروف به "کحّال" اختصاص داشت.',
    s1_c5:'بازدید دقیق این اتاق‌ها — که با نمایشگاه‌ها و تابلوهای اطلاعاتی آراسته شده‌اند — را برای بازگشتتان بگذارید. اکنون شما را به سالن ارائه‌مان هدایت می‌کنم که پس از حیاط اول، سمت چپ قرار دارد. در مسیر، به چاهی که سمت چپتان است توجه کنید.',
    s1_c6:'این سازه سنگی "چاه شیر" نامیده می‌شود، چون اعتقاد بود آب آن شیر مادران تازه‌زا را افزایش می‌دهد. حدود ۲۰ متر جلوتر، میان چمن، درختی با پیچک پیچیده‌شده به دور آن خواهید دید.',
    s1_c7:'وقتی به آن نقطه رسیدید، حتماً شعر غم‌انگیز عاشقانه‌ای را که احمد قوتسی تجر برای این درخت نوشته و روی تابلویی در چمن نصب شده، بخوانید. سپس با همان احساس، دوباره به درخت و پیچک نگاه کنید.',
    s1_c8:'درست پس از شعر، بلافاصله سمت چپتان سالن ارائه ماست. اینجا می‌توانید ویدیویی درباره تاریخچه و توسعه کُلیّه و دارالشفا تماشا کنید و درکی جامع از اهمیت این مکان در تاریخ پزشکی و معماری به دست آورید.',
    s1_callout:'🎬 <strong>آیا می‌خواهید ویدیوی ارائه را تماشا کنید؟</strong> می‌توانید آن را در سالن ارائه یا با فشردن دکمه زیر روی تلفنتان ببینید.',
    s1_watch:'تماشای ارائه ▶',s1_fwd:'به سمت سالن ارائه ←',
    s2_ct1:'🚪 ورود به حیاط دوم',s2_ct2:'🏛️ اتاق‌های اداری',s2_ct3:'🔒 بخش اداری',s2_ct4:'✨ کتیبه و ورود',
    s2_c1:'بلافاصله پس از خروج از سالن ارائه، از درِ باشکوه سمت چپتان وارد حیاط دوم شوید که دفاتر اداری در آن قرار دارند.',
    s2_c2:'در این حیاط چهار اتاق — دو عدد در هر طرف — وجود دارد. پزشک‌باشی و سایر پزشکان از این اتاق‌ها استفاده می‌کردند و تمام عملیات بیمارستان اینجا برنامه‌ریزی و مدیریت می‌شد. در سال‌های تأسیس، این دارالشفا دارای ۱ پزشک‌باشی، دو پزشک، ۲ جراح، ۲ پزشک چشم و ۱ داروساز بود.',
    s2_c3:'این بخش اداری همچنین به عنوان سدّ محافظ میان جریان روزانه بیماران در حیاط اول و بخش بستری‌ای که در شُرف ورود به آن هستید عمل می‌کرد.',
    s2_c4:'اکنون کتیبه بالای در را بخوانید، سپس نفستان را نگه دارید…',
    s2_callout:'🚶‍♂️ <strong>وارد این مکان جادویی شوید که در آن موسیقی و صدای آب با شفا در هم می‌آمیزند.</strong>',
    s2_fwd:'کشف بیمارستان بزرگ ←',
    s3_ct1:'🏥 بخش بستری',s3_ct2:'🌊 ساختار بیمارستان',s3_ct3:'🎵 موسیقی‌درمانی',s3_ct4:'💧 آب‌درمانی',s3_ct5:'🌿 عطردرمانی',s3_ct6:'🧺 کاردرمانی',s3_ct7:'🚶 خروج و بازدید',
    s3_c1:'اکنون در قلب موزه ما و در بخش بستری دارالشفای ادرنه هستید. با احساس کسانی که ۵۰۰ سال پیش اینجا شفا یافتند در این فضا قدم بزنید.',
    s3_c2:'بیمارستانی را تصور کنید که در مرکزش فواره‌ای با آهنگ موزون جاری است و درست روبه‌رویش یک صحنه موسیقی قرار دارد. این بیمارستان با طرح مرکزی و سقف گنبد پهن، شامل ۶ اتاق بیمار زمستانی، ۴ اتاق بیمار تابستانی و یک صحنه موسیقی است. فانوس روی گنبد نیز هوای کثیف را تهویه می‌کند. کف شیب‌دار و کانال‌های زیر آن شستشو و نظافت را آسان می‌کنند.',
    s3_c3:'آنچه این بیمارستان را از دیگران متمایز می‌کرد، استفاده از مقام‌های موسیقی در کنار دانش پزشکی روز بود. گروه موسیقی ۱۰ نفره در روزهای معین مقام‌های مختلف را برای بیماری‌های مختلف، به توصیه پزشکان، می‌نواخت و می‌خواند.',
    s3_c4:'صدای آب جاری از فواره مرکزی بخشی مهم از درمان بود که هدفش آرام کردن و تسکین بیماران بود.',
    s3_c5:'علاوه بر موسیقی و صدای آب، عطردرمانی نیز در دارالشفا رواج داشت. عطر گیاهان مختلف کاشته‌شده در حیاط و اطراف، بخشی جدانشدنی از فرآیند شفا بود.',
    s3_c6:'کاردرمانی نیز به عنوان روش درمانی اینجا به کار می‌رفت. بیماران با سبدبافی، بافندگی و صنایع دستی مختلف از نگرانی‌ها و افکارشان منحرف می‌شدند.',
    s3_c7:'پس از بازدید اتاق‌هایی که جنبه‌های مختلف طب عثمانی را نشان می‌دهند، می‌توانید از بخش بستری خارج شوید. هنگام ترک این مکان شفابخش — که ۴۰۰ سال پیوسته خدمت کرد — می‌توانید سایر اتاق‌های حیاط دوم و اول را نیز برای آشنایی بیشتر با دارالشفا و طب عثمانی بازدید کنید.',
    s3_callout:'🏫 <strong>به سمت مدرسه پزشکی:</strong> از دارالشفا خارج شده و به سمت مدرسه پزشکی که سمت چپ باغ ورودی با عکس بزرگ قرار دارد بروید.',
    s3_fwd:'به سوی مدرسه ←',
    s4_ct1:'🏫 مدرسه پزشکی',s4_ct2:'🌍 اهمیت تاریخی',s4_ct3:'📚 نظام آموزشی',s4_ct4:'🏛️ ساختار معماری',s4_ct5:'📜 اولیاء چلبی',s4_ct6:'👨‍🏫 کادر آموزشی',s4_ct7:'📖 نسخه‌های خطی',s4_ct8:'🏥 موزه بهداشت',
    s4_c1:'دارالشفا را بازدید کردید و اکنون وارد بخش دیگری از کُلیّه شده‌اید — مدرسه پزشکی سلطان بایزید دوم. پیش از ورود به اتاق‌های موزه در طرف راست و روبه‌رو، بایستید و این فضای منحصربه‌فرد را بررسی کنید.',
    s4_c2:'آنچه اکنون به عنوان بنایی پیرامون یک حیاط مربع می‌بینید، یکی از معتبرترین مؤسسات آموزشی تربیت پزشک در امپراتوری عثمانی بود — مرکز مهمی از یادگیری که در طول قرون پزشکان برجسته بسیاری پرورش داد.',
    s4_c3:'در ردیف بالاترین مدرسه‌های "شصت و بالاتر" در نظام آموزشی عثمانی قرار داشت؛ دانشجویان اینجا می‌توانستند آموزش نظری‌شان را در دارالشفای مجاور به کار ببندند و دانش خود را با تمرین تقویت کنند.',
    s4_c4:'مدرسه — با فواره‌ای (که دیگر وجود ندارد) در مرکز و چاهی در گوشه برای تأمین آب — شامل ۱۸ اتاق دانشجویی در سه طرف و یک سالن درس درست روبه‌رو است.',
    s4_c5:'اولیاء چلبی که در سال ۱۶۵۲ از کُلیّه بازدید کرد، درباره این مدرسه نوشت: "در مدرسه پزشکی و اتاق‌هایش دانشجویانی هستند که پیوسته از دانشمندانی چون افلاطون، سقراط، ارسطو، جالینوس و فیثاغورس سخن می‌گویند — هر کدام پزشکی کامل. هر یک وقف شاخه‌ای از دانش، تکیه بر کتب ارزشمند فنّ طب، در جستجوی درمانی برای دردهای بشر."',
    s4_c6:'کادر آموزشی شامل یک استاد با حقوق روزانه ۶۰ آکچه که ۱۸ دانشجو تدریس می‌کرد، یک دستیار استاد، یک کتابدار و دو خدمتکار بود. تمام نیازهای دانشجویان تأمین می‌شد و روزانه دو آکچه بورسیه هم دریافت می‌کردند.',
    s4_c7:'۳۸ نسخه خطی پزشکی که اینجا مطالعه می‌شدند — بسیاری با مُهر سلاطین عثمانی — تا امروز باقی مانده‌اند. این آثار گران‌بها اکنون در کتابخانه نسخ خطی سلیمیه نگهداری می‌شوند.',
    s4_c8:'مدرسه در سال ۲۰۰۷ توسط دانشگاه تراکیا به عنوان بخش دوم موزه بهداشت افتتاح شد. اتاق‌هایش آموزش پزشکی عصر را روایت می‌کنند. مهم‌ترین بخش سالن درس است که درست روبه‌روی ورودی قرار دارد.',
    s4_callout:'🚶 <strong>پس از بازدید اتاق‌های دانشجویی، اتاق‌های آموزش کاربردی، اتاق استاد، سالن درس و کتابخانه — که با مانکن‌ها فضای قرن پانزدهم را بازآفرینی کرده‌اند — از مدرسه خارج شده و از گیت دوّار نزدیک خروجی دارالشفا به سمت حیاط مسجد بروید تا به عمارت ادامه دهید.</strong>',
    s4_fwd:'به سوی شکوه مسجد ←',
    s5_ct1:'🌳 وارد باغ',s5_ct2:'💧 ترازوی آب',s5_ct3:'🕌 دروازه اصلی مسجد',s5_ct4:'🏛️ انبار و عمارت',
    s5_c1:'پس از بازدید دارالشفا و مدرسه، وارد باغ مسجد شده‌اید. با قدمی آهسته از میان این باغ زیبا با چنارهای صدساله به سمت بخش عمارت موزه که مستقیم جلوی شماست بروید.',
    s5_c2:'هنگام ورود به باغ از دارالشفا، اولین چیزی که باید سمت راستتان — در گوشه مسجد — ببینید یک سازه سنگی مستطیل‌شکل حدود ۴ متر ارتفاع است. این ترازوی آب کُلیّه است. آبی که از تپه‌های بلند با لوله‌کشی می‌آمد، ابتدا در این سازه فشارش متعادل می‌شد و سپس به سایر واحدهای کُلیّه توزیع می‌گشت.',
    s5_c3:'پس از گذشتن از ترازوی آب، دروازه ورودی اصلی باشکوه مسجد سمت راستتان شما را به استقبال می‌گیرد. کاوش حیاط مسجد از طریق این دروازه را برای پایان تور بگذارید و به قدم‌هایمان به سمت عمارت ادامه دهیم.',
    s5_c4:'در جلو دو ساختمان بزرگ با معماری مشابه کنار هم ایستاده‌اند. آنکه سمت چپ است انبار و نانوایی را در خود دارد که اکنون برای رویدادهای علمی و فرهنگی موزه استفاده می‌شود. آنکه سمت راست است همان عمارتی است که الان به سمتش هدایتتان می‌کنم.',
    s5_callout:'🍲 <strong>آماده‌اید فرهنگ عمارت عثمانی را ببینید و داستان آشپز یحیی بابا را بشنوید؟ پس بلیتتان را به گیت دوّار نشان داده وارد این بخش شوید، سپس ایستگاه بعدی را لمس کنید.</strong>',
    s5_fwd:'به قلب فراوانی ←',
    s6_ct1:'🏛️ عمارت‌ها',s6_ct2:'🍲 عمارت سلطان بایزید دوم',s6_ct3:'🔥 آشپزخانه و سالن غذاخوری',s6_ct4:'🎭 این بخش از موزه',s6_ct5:'🌿 مزار یحیی بابا',s6_ct6:'📖 افسانه یحیی بابا',s6_ct7:'⚖️ آزمون انبارداز',s6_ct8:'👑 سلطان به عنوان شاهد',s6_ct9:'🐟 معجزه ماهیان',s6_ct10:'🤲 گذشت یحیی بابا',s6_ct11:'🪦 زیارت مزار',
    s6_c1:'در امپراتوری عثمانی، عمارت‌ها از مهم‌ترین نهادهایی بودند که روح همبستگی اجتماعی و نیکوکاری را تجسم می‌بخشیدند. به عنوان آشپزخانه‌هایی که غذای رایگان به فقرا، مسافران، دانشجویان و مستمندان می‌دادند، این سازه‌ها صرفاً آشپزخانه نبودند — مراکز حیاتی بودند که اقشار آسیب‌پذیر را حمایت و توازن اجتماعی را حفظ می‌کردند.',
    s6_c2:'و اکنون شما داخل چنین مکانی هستید. عمارت کُلیّه سلطان بایزید دوم که به عنوان بخش سوم موزه بهداشت تأسیس شده، نهاد خیریه مهمی بود که — طبق وقف‌نامه‌اش — سه وعده در روز برای فقرا پخته و توزیع می‌شد.',
    s6_c3:'فضای گسترده‌ای که هنگام ورود می‌بینید آشپزخانه‌ای است که غذا در دیگ‌های بزرگ پخته می‌شد. سالن بزرگی که از درِ بلافاصله سمت راستتان می‌بینید جایی بود که وعده‌های غذایی روی کف سنگی صرف می‌شد.',
    s6_c4:'مانند سایر بخش‌های موزه بهداشت، این بخش نیز با مانکن‌هایی متناسب با روح مکان زنده شده که فرهنگ عمارت عثمانی را روایت و بازدیدکنندگان را به سفری در زمان می‌برند. ظروف مسی اصیل، هاون‌ها و خمره‌های انبار آن دوران نیز اینجا به نمایش گذاشته شده‌اند.',
    s6_c5:'درست پشت عمارت، مزار آشپز یحیی بابا، شخصیتی افسانه‌ای، قرار دارد. در حالی که این ساختمان جالب و فراخ را کاوش می‌کنید، اجازه دهید افسانه آشپز یحیی بابا را که تا امروز باقی مانده برایتان بگویم.',
    s6_c6:'طبق داستان، یحیی بابا، آشپزباشی در دوران سلطان بایزید دوم بنیانگذار کُلیّه، پلوی برنجی فوق‌العاده خوشمزه می‌پخت. در حین هم زدن پلو پیوسته دعا می‌کرد و وقتی در را می‌بست می‌گفت: "خداوندا، برکت بده." پلو آنقدر فراوان بود که همه بیماران را سیر می‌کرد و باز هم باقی می‌ماند. یحیی بابا هرگز پلوی اضافه را دور نمی‌انداخت — آن را برای تغذیه ماهیان رودخانه تونجا می‌برد.',
    s6_c7:'وقتی انبارداز متوجه شد یحیی بابا پلوی اضافه را به رودخانه می‌دهد، هر روز مقدار برنجی که به او می‌داد را کم کرد. با اینحال یحیی بابا با برنج کمتر هم پلو را با دعا می‌پخت و هم بیماران و هم ماهیان را تغذیه می‌کرد. سرانجام برنج تخصیصی به یک مشت کاهش یافت. پلوی یحیی بابا هنوز همه بیماران را سیر می‌کرد و هنوز موفق می‌شد سهمی برای ماهیان کنار بگذارد.',
    s6_c8:'خبر سرانجام به گوش سلطان رسید. سلطان که تصمیم گرفت خودش شاهد ماجرا باشد، پیش از یحیی بابا به کنار رودخانه تونجا رفت و پنهان شد. هنگامی که یحیی بابا پس از تغذیه ماهیان داشت بازمی‌گشت، سلطان از پنهانگاه بیرون آمد و غرید: "تو! آذوقه بیماران را به رودخانه می‌ریزی؟"',
    s6_c9:'یحیی بابا یخ کرد. هیچ نگفت. آنقدر از شرم دچار سهمگین‌شدن شد که به سجده افتاد و به خدا پناه برد. اما ماهیان سرهایشان را از آب بالا آوردند و گفتند: "آیا سلطان بزرگ از تغذیه ماهیان دریغ می‌کند؟"',
    s6_c10:'سلطان با شگفتی و اندوه از اشتباه خود آگاه شد و منتظر ماند یحیی بابا سرش را از سجده بلند کند — اما بیهوده. این مرد نیکوکار از پیش روحش را تسلیم کرده بود…',
    s6_c11:'مزار یحیی بابا که درست پشت عمارت قرار دارد، مانند بارگاهی مقدس توسط عابران برای دعا زیارت می‌شود. به‌خصوص روزهای جمعه این مزار از زیارت‌کنندگان پر می‌شود.',
    s6_callout:'🪦 <strong>مهمان‌خانه‌ها:</strong> پس از شنیدن این افسانه، وقت آن است که از عمارت خارج شده و در کافه موزه سمت چپ استراحت کنید. در کافه موزه واقع در مهمان‌خانه کُلیّه می‌توانید چای و به‌خصوص شربت عثمانی بنوشید، هدیه و کتاب بخرید، از کتابخانه موزه دیدن کنید و سپس به آخرین ایستگاه — حیاط مسجد — بروید. آیا کمی در مهمان‌خانه کُلیّه استراحت کنیم؟',
    s6_fwd:'به سمت کافه موزه ←',
    s7_ct1:'🏛️ حیاط و ورود به مسجد',s7_ct2:'🚪 ورودی و فضا',s7_ct3:'⛲ فواره و آرامش',s7_ct4:'🏛️ ستون‌های مرمری و هماهنگی معماری',s7_ct5:'✨ آرامش درونی',s7_ct6:'👁️ لحظات مشاهده',s7_ct7:'🚪 ورود به مسجد',s7_ct8:'🪵 هنر کُندکاری',
    s7_c1:'بخش‌های موزه بهداشت ما را گشتید و در کافه شربت خنک عثمانی نوشیدید. اکنون وقت آن است که با یکی از باشکوه‌ترین سازه‌های کُلیّه — مسجد — آشنا شوید.',
    s7_c2:'هنگامی که از درِ جانبی زیبایی که به حیاط باز می‌شود یا از دروازه اصلی باشکوه وارد می‌شوید، صنعتگری لطیف سنگ مرمر شما را به استقبال می‌گیرد. در لحظه‌ای سروصدای دنیای بیرون را پشت سر می‌گذارید و وارد فضایی کاملاً متفاوت می‌شوید.',
    s7_c3:'فواره‌ای که درست در قلب حیاط قرار دارد با صدای آرام آب، فضا را با صلح و آرامش پر می‌کند. این صدا در ترکیب با سکوت سنگ، شما را کُند می‌کند و به لحظه حال آگاه می‌سازد.',
    s7_c4:'ستون‌های مرمری که شما را احاطه کرده‌اند مانند حلقه‌ای محافظ برمی‌خیزند. با رنگ‌های مختلف انتخاب‌شده، زیبایی و ثروت هماهنگ زیبایی‌شناسی عثمانی را تجسم می‌بخشند.',
    s7_c5:'آنچه اینجا احساس می‌کنید صرفاً زیبایی معماری نیست — آرامشی است، صلح درونی که قرن‌هاست تغییر نکرده.',
    s7_c6:'لحظه‌ای کنار فواره مکث کنید و این چیدمان ساده اما شگفت‌انگیز حیاط را تماشا کنید. هماهنگی را که ستون‌ها، قوس‌ها و زیورهای ظریف با یکدیگر می‌سازند احساس کنید.',
    s7_c7:'سپس به سمت دروازه باشکوهی که درست روبه‌رویتان قد افراشته بچرخید. پرده چرمی روی در را به آرامی کنار بزنید و داخل شوید. بلافاصله احساس خواهید کرد که وارد یکی از زیباترین مساجد کشورمان شده‌اید.',
    s7_c8:'هنگام ورود فراموش نکنید به کندکاری چوبی اصیل بالای در توجه کنید — و اگر ممکن بود، بافت این صنعتگری ممتاز را لمس کنید.',
    s7_callout:'🕌 <strong>بیایید وارد گستردگی عظیم و آرامش درون حرم شویم؟</strong>',
    s7_fwd:'داخل شوید ←',
    s8_ct1:'🕌 داخل مسجد — پرده آخر',s8_ct2:'🚤 حمل‌ونقل تاریخی و سنت سلطنتی',s8_ct3:'👑 تصور گالری سلطنتی',s8_ct4:'🏛️ گالری سلطنتی و اولین‌هایش',s8_ct5:'⚙️ محراب و سنگ‌های تراز',s8_ct6:'🪵 منبر و صنعتگری ظریف',s8_ct7:'📐 نمادها و معانی',s8_ct8:'💡 نور و نظم آکوستیک',s8_ct9:'🌌 شکوه زیر گنبد',s8_ct10:'🏗️ نقطه عطف معماری',s8_ct11:'✨ پرده آخر و خداحافظی',
    s8_c1:'اکنون داخل مسجد در مرکز کُلیّه هستید و پرده آخر تور ما را زیر این گنبد باشکوه به پایان می‌رسانیم.',
    s8_c2:'سلطان بایزید دوم بنیانگذار کُلیّه و سلاطین پس از او عادت داشتند با قایق‌های سلطنتی آراسته از رودخانه به این مسجد می‌آمدند. از در کنار رودخانه وارد می‌شدند و نمازشان را در گالری سلطنتی — هُنکار محفلی — که روی ستون‌ها در گوشه چپ مسجد برافراشته، ادا می‌کردند.',
    s8_c3:'یک لحظه چشمانتان را ببندید… سلطان را تصور کنید که در آن ارتفاع، با همان آرامش در کنار جماعت عبادت می‌کند.',
    s8_c4:'با یادآوری اینکه اولین گالری سلطنتی ساخته‌شده در معماری ترکی-اسلامی اینجاست، اکنون به سمت محراب برویم.',
    s8_c5:'وقتی سنگ‌های تراز استوانه‌ای دو طرف محراب را لمس کرده و به آرامی بچرخانید، شگفت‌زده خواهید شد که زمین این سازه عظیم کوچکترین جابه‌جایی ندارد.',
    s8_c6:'هنگامی که به منبر سمت راست نزدیک می‌شوید، از ظرافت و زیبایی صنعتگری مرمر شگفت‌زده خواهید شد.',
    s8_c7:'اکنون پیشنهاد می‌کنم پشتتان را به محراب کنید و بالای درِ ورودی را نگاه کنید. نقش موتیف سینی با هندوانه‌ای در مرکز که درست بالای در قرار دارد، نمادی است از اینکه در این کُلیّه عمارتی هست و آمدگان اینجا به وعده غذایی دعوت‌اند.',
    s8_c8:'پنجره‌های اطراف گنبد و ردیف‌های پایینی تضمین می‌کنند نور به‌طور یکنواخت در سراسر فضا پخش شود. این چیدمان نوری در ترکیب با آکوستیک قوی مسجد، به فضا عمق بصری و شنیداری هر دو می‌بخشد.',
    s8_c9:'حالا نگاهتان را بالا بیاورید… با دقت به این گنبد باشکوه تزیین‌شده با تزئینات باروک بنگرید. این گنبد با ارتفاع حدود ۳۱ متر و قطر ۲۲ متر — که روی چهار دیوار بدون هیچ ستون میانی استوار است — نمونه‌ای شگفت‌انگیز از نظر معماری است.',
    s8_c10:'همچنین پیشروی مهمی در گذار به ساختارهای تک‌گنبدی به شمار می‌رود.',
    s8_c11:'زیر فیض و شکوه این گنبد بی‌نظیر، این سفر را که در آن ردپای گذشته را به سکوت امروز پیوند دادید به پایان می‌رسانیم — فراموش نکنید آرامش و شگفتی را که این مکان در قلبتان گذاشته با خود ببرید.',
    s8_callout:'🙏 <strong>یک خداحافظی آرام برای این سفر معنوی می‌گذاریم؟</strong>',
    s8_fwd:'به سمت خداحافظی ←',
    s9_c1:'🏛️ ردپای گذشته را گام به گام دنبال کردیم و این معماری باشکوه را با هم نفس کشیدیم. حالا وقت آن است که نفس خودتان را به این مکان تاریخی بیفزایید.',
    s9_c2:'💭 آنچه درونتان طنین می‌اندازد… لحظه‌ای از آرامش، تحسینی عمیق، یا آن نغمه آهسته‌ای که در قلبتان ماند…',
    s9_c3:'📖 دفتر بازدیدکنندگان که برایتان آماده کرده‌ایم آرشیو معنوی این تجربه است. هر جمله‌ای که اینجا می‌گذارید: خاطره‌ای بی‌ارزش برای ما، و نوری خواهد بود که این سفر را برای سایر مهمانانمان معنادار می‌کند.',
    s9_c4:'✨ آنچه از قلبتان جاری می‌شود با ما در میان بگذارید — و ردپایتان را برای همیشه بر پل دل باقی بگذارید…',
    s9_callout:'✍️ <strong>شما را دعوت می‌کنیم احساساتتان را در صفحه پل دل ما به اشتراک بگذارید.</strong>',
    s9_fwd:'نوشتن در پل دل ←',
    s10_body:'خوشحال می‌شویم تأثیرات این سفر ۵۰۰ ساله از کُلیّه‌مان را بشنویم. کلمات شما سنگ‌های این پل خواهند شد.',
    s10_restart:'🏛️ بازگشت به آغاز'
  },
   ro:{
    start:'ÎNCEPE CĂLĂTORIA',intro_title:'Invitație la Prag',intro_sub:'O călătorie dincolo de timp, spre centrul vindecării…',
    back:'← ÎNAPOI',menu_lang:'Limbă: Română 🇷🇴',menu_map:'Hartă & Locație',menu_defter:'Podul Inimii',
    loc_searching:'📍 Se obține locația…',loc_outside:'📍 Vă aflați în afara zonei Külliye.',
    loc_error:'📍 Nu s-a putut obține locația. Vă rugăm activați permisiunea de localizare.',
    gb_name:'Numele dvs.',gb_city:'Orașul dvs.',gb_msg:'Lăsați-vă sentimentele aici…',
    gb_submit:'ADAUG PIATRA MEA PE POD 🪨',gb_submitting:'Se sigilează…',
    gb_conn_err:'Eroare de conexiune. Vă rugăm încercați din nou.',gb_no_msg:'Vă rugăm lăsați o notiță…',
    confirm_text:'Sentimentele dvs. au fost sigilate pe Podul Inimii. Urma semnificativă pe care ați lăsat-o îmbogățește patrimoniul spiritual al Külliye-ului nostru…',
    confirm_close:'SĂ VĂ FIE DE VINDECARE 🌿',latest_title:'📜 Mesaje Recente',archive_title:'🗂️ Arhivă',
    no_msg:'Niciun mesaj încă. Fii primul care adaugă o piatră! ✨',
    s0_main:'🏛️ KÜLLIYE-UL SULTANULUI BAYEZID AL II-LEA',s0_sub:'MUZEUL SĂNĂTĂȚII',s0_slogan:'✨ CĂLĂTORIA VINDECĂRII — INTRAREA ÎN MUZEU',
    s1_main:'Intrarea Darüşşifa',s1_sub:'🏛️ POARTA DREPTĂȚII ȘI VINDECĂRII',s1_slogan:'⚖️ PRIMA OPRIRE A VINDECĂRII',
    s2_main:'Ieșirea din Sala de Prezentare',s2_sub:'🏛️ DE LA CUNOAȘTERE LA EXPERIENȚĂ',s2_slogan:'🏛️ ADMINISTRAȚIE ȘI ORDINE',
    s3_main:'Marea Infirmerie (SALA OCTOGONALĂ)',s3_sub:'🏛️ PRAGUL DARÜŞŞIFA-ULUI',s3_slogan:'🌊 CULMEA VINDECĂRII',
    s4_main:'Școala Medicală (Madrasa)',s4_sub:'🎓 LEAGĂNUL CUNOAȘTERII',s4_slogan:'📚 LUMINA ÎNVĂȚĂTURII',
    s5_main:'Curtea Mare',s5_sub:'🌿 PLATANI VECHI DE SECOLE',s5_slogan:'🌳 TIMP ȘI LINIȘTE',
    s6_main:'Imaret (Bucătăria Populară)',s6_sub:'🍲 COMPASIUNE ȘI ABUNDENȚĂ',s6_slogan:'🍲 BUCĂTĂRIA LUI YAHYA BABA',
    s7_main:'Pregătire pentru o Atmosferă Spirituală',s7_sub:'🕌 INTRAREA ÎN MOSCHEE',s7_slogan:'✨ UN DOM, PACE NESFÂRȘITĂ',
    s8_main:'Călătorie Spirituală în Interiorul Moscheii',s8_sub:'🕌 CURTEA MOSCHEII',s8_slogan:'🌌 FINALUL SUB DOM',
    s9_main:'Momentul Rămas-Bunului',s9_sub:'🌊 INVITAȚIE LA PODUL INIMII',s9_slogan:'✨ LASĂ-ȚI AMPRENTA ÎN ACEASTĂ POVESTE',
    s10_main:'🖋️ Podul Inimii',s10_slogan:'"Vindecarea trecutului întâlnește cuvintele prezentului."',
    nav_back:'← ÎNAPOI',
    s0_ct1:'👑 ISTORIE',s0_ct2:'🏗️ STRUCTURĂ',s0_ct3:'🎧 GHIDUL DVS.',s0_ct4:'📵 ATENȚIE',s0_ct5:'📍 LOCAȚIE',s0_ct6:'🏫 ORIENTARE',
    s0_c1:'Vă aflați acum într-unul dintre cele mai captivante situri istorice din Edirne — Muzeul Sănătății Külliye al Sultanului Bayezid al II-lea. Bun venit în acest loc unde istoria și vindecarea se întâlnesc.',
    s0_c2:'Construit de Sultanul Bayezid al II-lea, fiul lui Mehmed Cuceritorul și al 8-lea Sultan Otoman, sub conducerea arhitectului șef Hayrettin, acest complex este cel mai bine conservat külliye dintre toate külliye-urile otomane. În centru se află moscheea; la dreapta spitalul și madrasa; la stânga imaretul și cămara; atașate laturilor moscheii sunt casele de oaspeți, iar în spatele ei un pod peste Râul Tunca — toate întruchipând modelul statului social otoman.',
    s0_c3:'Vă voi ghida prin Külliye și muzeul nostru cu conținut scris, audio și vizual pentru a vă îmbogăți vizita.',
    s0_c4:'Vă rugăm să acordați atenție telefonului mobil pe parcursul întregului tur.',
    s0_c5:'Ați trecut de casa de bilete și vă aflați acum în grădina din față. Vă rugăm să stați în fața marii fotografii a Külliye-ului atârnate pe peretele din față și să studiați locația acestor structuri în cadrul orașului Edirne.',
    s0_c6:'Pe măsură ce mergeți spre acest punct, clădirea din dreapta dvs. este Madrasa Medicală a Külliye-ului, iar clădirea din față este Darüşşifa — poate inima Külliye-ului și centrul muzeului nostru.',
    s0_callout:'👣 <strong>După ce examinați marea fotografie, intrați în grădina Darüşşifa-ului prin ușa imediat din stânga dvs.</strong>',
    s0_fwd:'ÎNCEPE CĂLĂTORIA PRIN TIMP →',
    s1_ct1:'🏥 DARÜŞŞIFA — CURTEA 1',s1_ct2:'🌍 SEMNIFICAȚIE ISTORICĂ',s1_ct3:'🛏️ CAMERE DE SERVICII',s1_ct4:'🩺 CAMERE AMBULATORII',s1_ct5:'🧭 INDICAȚII',s1_ct6:'💧 FÂNTÂNA LAPTELUI',s1_ct7:'🌿 COPACUL ȘI IEDERA',s1_ct8:'🎬 SALA DE PREZENTARE',
    s1_c1:'Vă aflați acum în prima curte a Darüşşifa din Edirne, unul dintre cele mai importante centre de vindecare ale Imperiului Otoman. Vă rugăm să vă opriți o clipă și să observați împrejurimile.',
    s1_c2:'În primul rând, știți că această clădire este recunoscută drept unul dintre primele exemple de spital planificat central și meticulos din istorie. Omologii occidentali au apărut abia cu aproximativ 200 de ani mai târziu — aici, zonele de tratament și servicii au fost realizate cu o viziune arhitecturală mult înaintea epocii sale.',
    s1_c3:'Pe măsură ce înaintați pe calea din față, cele patru camere imediat la stânga intrării sunt unitățile de servicii ale Darüşşifa-ului: o cameră pentru personal, o spălătorie, o bucătărie dietetică și o cămară pentru depozitarea proviziilor.',
    s1_c4:'La dreapta dvs., în spatele coloanelor, se află șase camere ambulatorii unde se efectuau examinări zilnice ale pacienților, îngrijiri și intervenții de urgență. În anii de înființare, una dintre aceste camere era rezervată medicilor oculiști cunoscuți drept "kehhal."',
    s1_c5:'Lăsați vizita detaliată a acestor camere — amenajate cu exponate și panouri informative — pentru întoarcere, și lăsați-mă acum să vă îndrept spre sala noastră de prezentare. Se află dincolo de prima curte, la stânga. Pe drum, vă rugăm observați fântâna din stânga dvs.',
    s1_c6:'Această structură de piatră se numește "Fântâna Laptelui", deoarece se credea că apa sa creștea producția de lapte a mamelor care alăptau. La aproximativ 20 de metri mai departe, în iarbă, veți vedea un copac cu iederă înfășurată în jurul lui.',
    s1_c7:'Când ajungeți acolo, asigurați-vă că citiți melancolica poezie de dragoste scrisă de Ahmet Kutsi Tecer despre acest copac, afișată pe un panou în iarbă. Apoi priviți din nou copacul și iedera, cu acel sentiment în inimă.',
    s1_c8:'Chiar după poem, imediat la stânga dvs., se află sala noastră de prezentare. Aici puteți viziona un film despre istoria și dezvoltarea Külliye-ului și a Darüşşifa-ului, dobândind o înțelegere cuprinzătoare a importanței acestui loc în istoria medicinei și arhitecturii.',
    s1_callout:'🎬 <strong>Doriți să vizionați videoclipul de prezentare?</strong> Îl puteți viziona în sala de prezentare sau apăsați butonul de mai jos pentru a-l viziona pe telefonul dvs.',
    s1_watch:'VIZIONAȚI PREZENTAREA ▶',s1_fwd:'SPRE SALA DE PREZENTARE →',
    s2_ct1:'🚪 INTRAREA ÎN CURTEA A 2-A',s2_ct2:'🏛️ CAMERE ADMINISTRATIVE',s2_ct3:'🔒 SECȚIUNEA ADMINISTRATIVĂ',s2_ct4:'✨ INSCRIPȚIE ȘI INTRARE',
    s2_c1:'Imediat după ce ieșiți din sala de prezentare, treceți prin marea ușă imediat din stânga dvs. în cea de-a doua curte, unde se află birourile administrative.',
    s2_c2:'În această curte există 4 camere — câte două pe fiecare parte. Medicul șef și ceilalți doctori foloseau aceste camere; toate operațiunile spitalului erau planificate și gestionate aici. În anii de înființare, acest Darüşşifa avea 1 medic șef, doi doctori, 2 chirurgi, 2 oftalmologi și 1 farmacist.',
    s2_c3:'Această secțiune administrativă a servit și ca barieră de protecție între fluxul zilnic de pacienți din prima curte și secția de tratament internat în care urmează să intrați.',
    s2_c4:'Citiți acum inscripția scrisă deasupra ușii, apoi țineți-vă respirația…',
    s2_callout:'🚶‍♂️ <strong>Pășiți în acest loc magic unde muzica și sunetul apei întâlnesc vindecarea.</strong>',
    s2_fwd:'DESCOPERIȚI MAREA INFIRMERIE →',
    s3_ct1:'🏥 SECȚIA DE TRATAMENT INTERNAT',s3_ct2:'🌊 STRUCTURA SPITALULUI',s3_ct3:'🎵 MUZICOTERAPIA',s3_ct4:'💧 HIDROTERAPIA',s3_ct5:'🌿 AROMATERAPIA',s3_ct6:'🧺 TERAPIA OCUPAȚIONALĂ',s3_ct7:'🚶 IEȘIRE ȘI TUR',
    s3_c1:'Vă aflați acum în inima muzeului nostru și în secția de tratament internat a Darüşşifa din Edirne. Parcurgeți acest spațiu cu sentimentul celor care au găsit vindecare aici acum 500 de ani.',
    s3_c2:'Imaginați-vă un spital unde sunteți întâmpinat de o fântână ce curge ritmic în centru și o scenă muzicală exact în față. Acest spital cu plan central, acoperit de un dom larg, constă în 6 camere pentru pacienți de iarnă, 4 camere pentru pacienți de vară și o scenă muzicală. Felinarul din dom ventilează și aerul viciat. Pardoseala înclinată și canalele de dedesubt facilitează spălarea și curățarea ușoară.',
    s3_c3:'Ceea ce distingea acest spital de altele era utilizarea modurilor muzicale în tratament alături de cunoștințele medicale contemporane. Un ansamblu muzical de 10 interpreți cânta și intona diferite moduri pentru diferite boli, la recomandarea medicilor — considerate benefice pentru diverse afecțiuni.',
    s3_c4:'Sunetul apei curgând din fântâna de la centrul clădirii era o parte importantă a tratamentului, menit să calmeze și să liniștească pacienții.',
    s3_c5:'Pe lângă muzică și sunetele apei, în Darüşşifa se practica și aromaterapia. Parfumurile diverselor plante cultivate în curte și împrejurimi erau parte integrantă a procesului de vindecare.',
    s3_c6:'Terapia ocupațională era de asemenea folosită ca metodă de tratament aici. Pacienții erau implicați în împletitul coșurilor, tricotat și diverse meșteșuguri pentru a-i distrage de la griji și gânduri.',
    s3_c7:'După ce vizitați camerele care prezintă diferite aspecte ale medicinei otomane, puteți ieși din secția de internați. Pe măsură ce părăsiți acest loc de vindecare — care a funcționat continuu timp de 400 de ani — puteți vizita și celelalte camere din curtea a doua și prima pentru a afla mai multe despre Darüşşifa și medicina otomană.',
    s3_callout:'🏫 <strong>SPRE MADRASA MEDICALĂ:</strong> Ieșiți din Darüşşifa și mergeți spre Madrasa Medicală, situată la stânga grădinii de intrare cu marea fotografie.',
    s3_fwd:'ÎNAINTE SPRE MADRASĂ →',
    s4_ct1:'🏫 MADRASA MEDICALĂ',s4_ct2:'🌍 SEMNIFICAȚIE ISTORICĂ',s4_ct3:'📚 SISTEMUL EDUCAȚIONAL',s4_ct4:'🏛️ STRUCTURA ARHITECTURALĂ',s4_ct5:'📜 EVLIYA ÇELEBİ',s4_ct6:'👨‍🏫 PERSONALUL DIDACTIC',s4_ct7:'📖 MANUSCRISE',s4_ct8:'🏥 MUZEUL SĂNĂTĂȚII',
    s4_c1:'Ați vizitat Darüşşifa-ul și ați intrat acum într-o altă secțiune crucială a Külliye-ului — Madrasa Medicală a Sultanului Bayezid al II-lea. Înainte de a intra în camerele muzeului din dreapta și din față, opriți-vă și studiați acest spațiu unic.',
    s4_c2:'Ceea ce vedeți acum ca o clădire aranjată în jurul unei curți pătrate a fost una dintre cele mai prestigioase instituții educaționale care formau medici în Imperiul Otoman — un important centru de învățătură care a produs mulți doctori proeminenți de-a lungul secolelor.',
    s4_c3:'Clasată printre madrasele de cel mai înalt nivel "cu rating de 60 și peste" din sistemul educațional otoman, studenții de aici își puteau aplica pregătirea teoretică în Darüşşifa-ul adiacent, consolidând cunoștințele cu practica.',
    s4_c4:'Madrasa — cu o fântână (care nu mai există) în centru și o fântână arteziană în colț pentru alimentarea cu apă — constă în 18 camere pentru studenți aranjate pe trei laturi și o sală de curs direct în față.',
    s4_c5:'Evliya Çelebi, care a vizitat Külliye-ul în 1652, a scris despre această madrasă: "În Madrasa Medicală și camerele sale se află studenți care vorbesc constant despre savanți precum Platon, Socrate, Aristotel, Galen și Pitagora — medici maturi fiecare. Fiecare devotat unei ramuri a cunoașterii, bazându-se pe cărți valoroase în arta medicinei, străduindu-se să găsească remedii pentru bolile omenirii."',
    s4_c6:'Personalul didactic includea un profesor câștigând 60 de akçe pe zi predând 18 studenți, un profesor asistent, un bibliotecar și doi servitori. Toate nevoile studenților erau asigurate, iar aceștia primeau și o bursă zilnică de două akçe.',
    s4_c7:'38 de manuscrise medicale scrise de mână studiate aici — multe purtând sigiliile sultanilor otomani — au supraviețuit până în zilele noastre. Aceste prețioase lucrări sunt acum păstrate la Biblioteca de Manuscrise Selimiye.',
    s4_c8:'Madrasa a fost deschisă de Universitatea Trakya în 2007 ca cea de-a doua secțiune a Muzeului Sănătății. Camerele sale narează educația medicală a epocii. Cea mai importantă secțiune este sala de curs, direct în față față de intrare.',
    s4_callout:'🚶 <strong>După ce vizitați camerele studenților, camerele de instruire aplicată, camera profesorului, sala de curs și biblioteca — aranjate pentru a reflecta atmosfera secolului al XV-lea cu manechine — ieșiți din madrasă și treceți prin turnichetul de lângă ieșirea Darüşşifa spre curtea moscheii pentru a continua spre Imaret.</strong>',
    s4_fwd:'SPRE GRANDOAREA MOSCHEII →',
    s5_ct1:'🌳 ÎN GRĂDINĂ',s5_ct2:'💧 SCALA APEI',s5_ct3:'🕌 POARTA PRINCIPALĂ A MOSCHEII',s5_ct4:'🏛️ CĂMARA ȘI IMARETUL',
    s5_c1:'După ce ați vizitat Darüşşifa și Madrasa, ați intrat în grădina moscheii. Mergeți încet prin această frumoasă grădină cu platani vechi de secole, îndreptându-vă spre secțiunea Imaret a muzeului direct înainte.',
    s5_c2:'La intrarea în grădină din Darüşşifa, primul lucru de observat la dreapta dvs. — la colțul moscheii — este o structură dreptunghiulară de piatră de aproximativ 4 metri înălțime. Aceasta este scala de apă a Külliye-ului. Apa adusă prin conducte de pe dealurile înalte își echilibra mai întâi presiunea în interiorul acestei structuri înainte de a fi distribuită celorlalte unități ale Külliye-ului.',
    s5_c3:'După ce treceți de scala de apă, veți fi întâmpinați de magnificul portal de intrare principal al moscheii la dreapta dvs. Să lăsăm explorarea curții moscheii prin acest portal pentru sfârșitul turului, și să continuăm drumul spre Imaret.',
    s5_c4:'Înainte, două clădiri mari de arhitectură similară stau una lângă alta. Cea din stânga conține cămara și secțiunea de brutărie, folosită acum pentru evenimentele științifice și culturale ale muzeului. Cea din dreapta este Imaretul spre care vă îndrept acum.',
    s5_callout:'🍲 <strong>Sunteți pregătit să vedeți cultura imaret otomană și să auziți legenda Bucătarului Yahya Baba? Atunci arătați biletul la turnichet și intrați în această secțiune, apoi apăsați următoarea oprire pentru a continua.</strong>',
    s5_fwd:'SPRE INIMA ABUNDENȚEI →',
    s6_ct1:'🏛️ IMARETURILE',s6_ct2:'🍲 IMARETUL SULTANULUI BAYEZID AL II-LEA',s6_ct3:'🔥 BUCĂTĂRIA ȘI SALA DE MESE',s6_ct4:'🎭 ACEASTĂ SECȚIUNE A MUZEULUI',s6_ct5:'🌿 MORMÂNTUL LUI YAHYA BABA',s6_ct6:'📖 LEGENDA LUI YAHYA BABA',s6_ct7:'⚖️ TESTUL CAMARARULUI',s6_ct8:'👑 MARTORUL SULTANULUI',s6_ct9:'🐟 MINUNEA PEȘTELUI',s6_ct10:'🤲 TRECEREA LUI YAHYA BABA',s6_ct11:'🪦 VIZITAREA MORMÂNTULUI',
    s6_c1:'În Imperiul Otoman, imareturile erau printre cele mai importante instituții care întruchipau spiritul solidarității sociale și al carității. Servind ca bucătării populare care distribuiau hrană gratuită săracilor, călătorilor, studenților și nevoiașilor, aceste structuri nu erau simple bucătării — erau centre vitale care protejau membrii vulnerabili ai societății și mențineau echilibrul social.',
    s6_c2:'Și vă aflați acum într-un astfel de loc. Imaretul Külliye-ului Sultanului Bayezid al II-lea, înființat ca cea de-a treia secțiune a Muzeului Sănătății, a fost o importantă instituție caritabilă unde — conform actului de fondare — se gătea și distribuia hrană de trei ori pe zi celor săraci.',
    s6_c3:'Spațiul larg pe care îl întâlniți la intrare este bucătăria unde mâncarea era gătită în cazane mari. Marea sală pe care o vedeți prin ușa imediat la dreapta dvs. este locul unde se luau mesele la mese de piatră pe podea.',
    s6_c4:'Ca și celelalte secțiuni ale Muzeului Sănătății, această secțiune este animată cu manechine potrivite spiritului locului, narând cultura imaret otomană și ducând vizitatorii într-o călătorie prin timp. Vase de cupru originale ale epocii, mortare și borcane de depozitare sunt de asemenea expuse aici.',
    s6_c5:'Imediat în spatele imaretului se află Mormântul Bucătarului Yahya Baba, o figură de legendă. Pe măsură ce explorați această clădire interesantă și spațioasă, lăsați-mă să vă povestesc legenda Bucătarului Yahya Baba care a supraviețuit până în zilele noastre.',
    s6_c6:'Conform poveștii, Yahya Baba, bucătarul șef din timpul domniei Sultanului Bayezid al II-lea, fondatorul Külliye-ului, prepara un pilaf de orez excepțional de delicios. În timp ce amesteca pilaful rostea neîncetat rugăciuni, iar când punea capacul spunea "Dă belșug, Doamne." Pilaful era atât de îmbelșugat încât hrănea toți pacienții și mai rămânea și de prisos. Yahya Baba nu arunca niciodată pilaful în plus — îl ducea să hrănească peștii din Râul Tunca.',
    s6_c7:'Când camararetul a observat că Yahya Baba hrănea peștii cu pilaful în exces, a început să reducă zi de zi cantitatea de orez dată acestuia. Cu toate acestea, chiar și cu mai puțin orez, Yahya Baba gătea pilaful cu rugăciune, hrănind atât pacienții cât și peștii. În cele din urmă orezul alocat a fost redus la un singur pumn. Totuși pilaful lui Yahya Baba îi hrănea pe toți pacienții, iar el tot reușea să pună deoparte o porție pentru pești.',
    s6_c8:'Vestea a ajuns în cele din urmă la Sultan. Hotărând să asiste personal la cele întâmplate, Sultanul a sosit la malul Râului Tunca înainte de Yahya Baba și s-a ascuns. Pe măsură ce Yahya Baba urma să se întoarcă după ce hrănise peștii, Sultanul a ieșit din ascunzătoare și a tunat: "Hei tu — torni proviziile pacienților în râu?"',
    s6_c9:'Yahya Baba a înghețat. Nu putea spune nimic. Era atât de copleșit de rușine încât s-a prostrat și a căutat refugiu în Dumnezeu. Dar peștii, ridicând capetele din apă, au grăit: "Îi pare rău marelui Sultan de hrana peștilor?"',
    s6_c10:'Sultanul, realizând greșeala sa în uimire și durere, a așteptat ca Yahya Baba să ridice capul din prosternare — dar în zadar. Acest om binevoitor își dăduse deja sufletul…',
    s6_c11:'Mormântul lui Yahya Baba, situat chiar în spatele imaretului, este vizitat ca un sanctuar de trecători care vin să se roage. Mai ales vinerea, acest mormânt este plin de vizitatori.',
    s6_callout:'🪦 <strong>CASELE DE OASPEȚI:</strong> După ascultarea acestei legende, este momentul să ieșiți din imaret și să vă odihniți la cafeneaua muzeului din stânga. La cafeneaua muzeului din cadrul casei de oaspeți a Külliye-ului, puteți savura ceai și mai ales un șerbet otoman, cumpăra cadouri și cărți, vizita biblioteca muzeului, și apoi să vă îndreptați spre ultima oprire — curtea Moscheii. Să luăm o scurtă pauză la Casa de Oaspeți a Külliye-ului?',
    s6_fwd:'SPRE CAFENEAUA MUZEULUI →',
    s7_ct1:'🏛️ CURTEA ȘI INTRAREA ÎN MOSCHEE',s7_ct2:'🚪 INTRARE ȘI ATMOSFERĂ',s7_ct3:'⛲ FÂNTÂNA ȘI SERENITATEA',s7_ct4:'🏛️ COLOANELE DE MARMURĂ ȘI ARMONIA ARHITECTURALĂ',s7_ct5:'✨ PACE INTERIOARĂ ȘI LINIȘTE',s7_ct6:'👁️ MOMENTE DE OBSERVAȚIE',s7_ct7:'🚪 INTRAREA ÎN MOSCHEE',s7_ct8:'🪵 MEȘTEȘUGUL KÜNDEKÂRI',
    s7_c1:'Ați vizitat secțiunile Muzeului nostru de Sănătate și ați gustat răcoritorul șerbet otoman la cafenea. Acum este momentul să întâlniți una dintre cele mai magnifice structuri ale Külliye-ului — moscheea.',
    s7_c2:'Când pășiți prin eleganța ușii laterale care se deschide spre curte sau prin grandiosul portal principal, sunteți întâmpinat de fina măiestrie a marmurei. Într-o clipă, lăsați în urmă agitația lumii exterioare și alunecați într-o atmosferă complet diferită.',
    s7_c3:'Fântâna din centrul curții umple spațiul cu pace prin sunetul calm al apei. Acest sunet, combinat cu tăcerea pietrei, vă încetinește și vă face conștienti de momentul prezent.',
    s7_c4:'Coloanele de marmură care vă înconjoară se ridică ca un inel protector. Alese în culori diferite, ele întruchipează eleganța și bogăția armonioasă a esteticii otomane.',
    s7_c5:'Ceea ce simțiți aici nu este doar frumusețe arhitecturală — este o liniște, o pace interioară care a rămas neschimbată de secole.',
    s7_c6:'Opriți-vă scurt la fântână și observați această simplă dar izbitoare aranjare a curții. Simțiți armonia pe care coloanele, arcurile și ornamentele fine o creează unele cu altele.',
    s7_c7:'Apoi întoarceți-vă spre magnificul portal ce se ridică direct în fața dvs. Ridicați ușor perdeaua de piele care acoperă ușa și pășiți înăuntru. Veți simți imediat că ați intrat într-una dintre cele mai elegante moschei din țara noastră.',
    s7_c8:'La intrare, nu uitați să acordați atenție originalului lucru în lemn kündekâri de deasupra ușii — și dacă este posibil, simțiți textura acestei exquisite măiestrii.',
    s7_callout:'🕌 <strong>Să intrăm în marele spațiu și liniștea din interiorul sanctuarului?</strong>',
    s7_fwd:'CONTINUAȚI ÎNĂUNTRU →',
    s8_ct1:'🕌 ÎN INTERIORUL MOSCHEII — FINALUL',s8_ct2:'🚤 TRANSPORT ISTORIC ȘI TRADIȚIE REGALĂ',s8_ct3:'👑 IMAGINÂND GALERIA REGALĂ',s8_ct4:'🏛️ GALERIA REGALĂ ȘI PREMIERELE SALE',s8_ct5:'⚙️ MIHRابUL ȘI PIETRELE DE ECHILIBRU',s8_ct6:'🪵 MINBARUL ȘI FINA MĂIESTRIE',s8_ct7:'📐 SIMBOLURI ȘI SEMNIFICAȚII',s8_ct8:'💡 LUMINA ȘI ORDINEA ACUSTICĂ',s8_ct9:'🌌 SPLENDOAREA SUB DOM',s8_ct10:'🏗️ UN PUNCT DE COTITURĂ ARHITECTURAL',s8_ct11:'✨ FINAL ȘI RĂMAS BUN',
    s8_c1:'Vă aflați acum în interiorul moscheii din centrul Külliye-ului, și finalizăm turul sub acest magnific dom.',
    s8_c2:'Sultanul Bayezid al II-lea, fondatorul Külliye-ului, și sultanii care i-au urmat obișnuiau să sosească la această moschee călătorind de-a lungul râului în bărci imperiale ornate. Intrau prin ușa de pe malul râului și își săvârșeau rugăciunile în galeria regală — hünkâr mahfili — care se ridică pe coloane în colțul din stânga al moscheii.',
    s8_c3:'Închiziți ochii o clipă… Imaginați-vă Sultanul, la acea înălțime, adorând în aceeași pace alături de congregație.',
    s8_c4:'Amintindu-ne că prima galerie regală construită vreodată în arhitectura turco-islamică se află aici, să mergem acum spre mihrab.',
    s8_c5:'Când atingeți și rotiți ușor pietrele cilindrice de echilibru de pe fiecare parte a mihrabului, veți fi uimiți să descoperiți că solul acestei mari structuri nu prezintă nicio deplasare.',
    s8_c6:'Pe măsură ce vă apropiați de minbar pe dreapta, veți fi uimiți de delicatețea și eleganța măiestriei în marmură.',
    s8_c7:'Acum vă sugerez să vă întoarceți spatele spre mihrab și să priviți deasupra ușii de intrare. Motivul tăvii cu un pepene verde în centru, poziționat direct deasupra ușii, simbolizează că există un imaret în acest Külliye și că cei care vin aici sunt invitați la masă.',
    s8_c8:'Ferestrele din jurul domului și din rândurile inferioare asigură distribuirea uniformă a luminii în întreg spațiul. Această aranjare a luminii, combinată cu puternicele acustici ale moscheii, conferă spațiului adâncime atât vizuală cât și auditivă.',
    s8_c9:'Și acum ridicați privirea în sus… Priviți cu atenție acest magnific dom ornamentat cu decorațiuni baroce. Aproximativ 31 de metri înălțime și 22 de metri în diametru, acest dom — sprijinit pe patru pereți fără nicio coloană intermediară — este un exemplu arhitectural remarcabil.',
    s8_c10:'Este de asemenea considerat un important precursor al tranziției spre structurile cu dom unic.',
    s8_c11:'Sub grația și splendoarea acestui dom incomparabil, încheiem această călătorie în care ați conectat urmele trecutului cu tăcerea de azi — nu uitați să purtați cu dvs. pacea și minunea pe care acest loc le-a lăsat în inima dvs.',
    s8_callout:'🙏 <strong>Să punem un liniștit rămas bun acestei călătorii spirituale?</strong>',
    s8_fwd:'SPRE RĂMAS BUN →',
    s9_c1:'🏛️ Am urmărit pas cu pas urmele trecutului, respirând împreună această magnifică arhitectură. Acum este momentul să adăugați propria dvs. respirație acestui loc istoric.',
    s9_c2:'💭 Ce răsună în interiorul dvs.… Un moment de pace, o admirație profundă, sau acea notă tăcută care persistă în inima dvs.…',
    s9_c3:'📖 Cartea Vizitatorilor pe care am pregătit-o pentru dvs. este o arhivă spirituală a acestei experiențe. Fiecare propoziție pe care o lăsați aici va fi: o amintire de neprețuit pentru noi, și o lumină care dă sens acestei călătorii pentru ceilalți oaspeți ai noștri.',
    s9_c4:'✨ Împărtășiți cu noi ce curge din inima dvs. — și lăsați amprenta dvs. pentru totdeauna pe Podul Inimii…',
    s9_callout:'✍️ <strong>Vă invităm să vă împărtășiți sentimentele pe pagina noastră Podul Inimii.</strong>',
    s9_fwd:'SCRIE PE PODUL INIMII →',
    s10_body:'Ne-ar plăcea să auzim impresiile pe care această călătorie de 500 de ani prin Külliye-ul nostru le-a lăsat asupra dvs. Cuvintele dvs. vor deveni pietrele acestui pod.',
    s10_restart:'🏛️ ÎNTOARCE-TE LA ÎNCEPUT'
  },
  ja:{
    start:'旅を始める',intro_title:'敷居への招待',intro_sub:'時を超えて、癒しの中心へ向かう旅…',
    back:'← 戻る',menu_lang:'言語：日本語 🇯🇵',menu_map:'地図と場所',menu_defter:'心の橋',
    loc_searching:'📍 位置情報を取得中…',loc_outside:'📍 キュッリエのエリア外にいます。',
    loc_error:'📍 位置情報を取得できませんでした。位置情報の許可を有効にしてください。',
    gb_name:'お名前',gb_city:'お住まいの都市',gb_msg:'ここに気持ちを残してください…',
    gb_submit:'橋に石を置く 🪨',gb_submitting:'刻み込んでいます…',
    gb_conn_err:'接続エラーです。もう一度お試しください。',gb_no_msg:'メッセージを残してください…',
    confirm_text:'あなたの気持ちは心の橋に刻まれました。残してくださった大切な痕跡は、私たちのキュッリエの精神的な遺産を豊かにします…',
    confirm_close:'どうぞご自愛ください 🌿',latest_title:'📜 最近のメッセージ',archive_title:'🗂️ アーカイブ',
    no_msg:'まだメッセージはありません。最初の石を置きましょう！✨',
    s0_main:'🏛️ スルタン・バヤズィト二世キュッリエ',s0_sub:'健康博物館',s0_slogan:'✨ 癒しの旅 — 博物館入口',
    s1_main:'ダリュッシファ入口',s1_sub:'🏛️ 正義と癒しの門',s1_slogan:'⚖️ 癒しの最初の停留所',
    s2_main:'プレゼンテーション室を出る',s2_sub:'🏛️ 知識から体験へ',s2_slogan:'🏛️ 行政と秩序',
    s3_main:'大病棟（八角形ホール）',s3_sub:'🏛️ ダリュッシファの敷居',s3_slogan:'🌊 癒しの頂点',
    s4_main:'医学マドラサ',s4_sub:'🎓 知識の揺りかご',s4_slogan:'📚 学びの光',
    s5_main:'大庭園',s5_sub:'🌿 何世紀もの歴史を持つプラタナス',s5_slogan:'🌳 時間と静寂',
    s6_main:'イマレット（炊き出し場）',s6_sub:'🍲 思いやりと豊かさ',s6_slogan:'🍲 ヤフヤ・ババの台所',
    s7_main:'精神的な雰囲気への準備',s7_sub:'🕌 モスクへの入口',s7_slogan:'✨ ひとつのドーム、無限の平和',
    s8_main:'モスク内での精神的な旅',s8_sub:'🕌 モスクの中庭',s8_slogan:'🌌 ドームの下でのフィナーレ',
    s9_main:'別れの時',s9_sub:'🌊 心の橋への招待',s9_slogan:'✨ この物語に足跡を残す',
    s10_main:'🖋️ 心の橋',s10_slogan:'"過去の癒しが今日の言葉と出会う。"',
    nav_back:'← 戻る',
    s0_ct1:'👑 歴史',s0_ct2:'🏗️ 構造',s0_ct3:'🎧 ガイド',s0_ct4:'📵 ご注意',s0_ct5:'📍 場所',s0_ct6:'🏫 オリエンテーション',
    s0_c1:'あなたは今、エディルネで最も魅力的な歴史的な場所のひとつ、スルタン・バヤズィト二世キュッリエ健康博物館にいます。歴史と癒しが交わるこの場所へようこそ。',
    s0_c2:'征服者メフメトの息子でオスマン帝国第8代スルタンのバヤズィト二世が、首席建築家ハイレッティンのもとに建てたこの複合施設は、すべてのオスマン・キュッリエの中で最もよく保存されたものです。中央にモスク、右側に病院とマドラサ、左側にイマレットと食料庫、モスクの両側には宿泊施設、その裏にはトゥンジャ川に架かる橋があり、これらすべてがオスマンの社会国家モデルを体現しています。',
    s0_c3:'書かれたコンテンツ、音声、映像でキュッリエと博物館をご案内し、あなたの訪問を豊かにします。',
    s0_c4:'見学中は携帯電話に注意を払ってください。',
    s0_c5:'チケット売り場を通り過ぎ、正面庭園にいます。正面の壁に掛かっている大きなキュッリエの写真の前に立ち、これらの建物がエディルネ市内でどこに位置するかを確認してください。',
    s0_c6:'この地点に向かって歩くと、右側の建物がキュッリエの医学マドラサ、正面の建物がダリュッシファです。おそらくキュッリエの心臓部であり、博物館の中心です。',
    s0_callout:'👣 <strong>大きな写真を見学した後、すぐ左側のドアからダリュッシファの庭園に入ってください。</strong>',
    s0_fwd:'時を超えた旅を始める →',
    s1_ct1:'🏥 ダリュッシファ — 第一中庭',s1_ct2:'🌍 歴史的意義',s1_ct3:'🛏️ サービス室',s1_ct4:'🩺 外来診察室',s1_ct5:'🧭 案内',s1_ct6:'💧 乳の井戸',s1_ct7:'🌿 木とツタ',s1_ct8:'🎬 プレゼンテーション室',
    s1_c1:'あなたは今、オスマン帝国で最も重要な癒しの場のひとつ、エディルネ・ダリュッシファの第一中庭にいます。少し立ち止まって周囲を観察してください。',
    s1_c2:'まず知っていただきたいのは、この建物は歴史上最も早い段階で中央集権的・綿密に計画された病院の例として認められているということです。西洋の対応物が現れたのはおよそ200年後のことで、ここでは治療とサービスエリアが時代をはるかに先取りした建築的ビジョンで実現されていました。',
    s1_c3:'前方の道を進むと、入口すぐ左側の4つの部屋がダリュッシファのサービス施設です。スタッフルーム、洗濯室、食事用厨房、食料貯蔵庫が含まれます。',
    s1_c4:'右側、柱の奥には6つの外来診察室があり、毎日の患者診察、ケア、緊急処置が行われていました。創設当初、そのうちの1室は「ケッハール」と呼ばれる眼科医専用の部屋でした。',
    s1_c5:'展示や情報パネルが設置されたこれらの部屋の詳細な見学は帰りに残しておき、プレゼンテーション室へご案内します。第一中庭を過ぎて左側にあります。歩きながら、左側の井戸に注目してください。',
    s1_c6:'この石造りの構造物は「乳の井戸」と呼ばれ、その水が授乳中の母親の母乳を増やすと信じられていました。約20メートル先の草むらの中に、ツタが絡みついた木が見えます。',
    s1_c7:'その場所に着いたら、草むらのパネルに展示されているアフメト・クトシ・テジェルが書いたこの木についての哀愁漂う恋愛詩を必ず読んでください。そして、その気持ちを胸に、木とツタをもう一度眺めてください。',
    s1_c8:'詩のすぐ先、左側にプレゼンテーション室があります。ここでキュッリエとダリュッシファの歴史と発展に関するビデオを鑑賞し、この場所が医学と建築の歴史において持つ意義を包括的に理解することができます。',
    s1_callout:'🎬 <strong>プレゼンテーション動画をご覧になりますか？</strong> プレゼンテーション室でご覧いただくか、下のボタンをタップしてスマートフォンでご覧ください。',
    s1_watch:'プレゼンテーションを見る ▶',s1_fwd:'プレゼンテーション室へ →',
    s2_ct1:'🚪 第二中庭への入口',s2_ct2:'🏛️ 管理室',s2_ct3:'🔒 管理区域',s2_ct4:'✨ 碑文と入場',
    s2_c1:'プレゼンテーション室を出たら、すぐ左側の大きな扉を通って行政事務所のある第二中庭に入ります。',
    s2_c2:'この中庭には4つの部屋があり、両側に2つずつあります。首席医師や他の医師たちがこれらの部屋を使用し、病院のすべての業務がここで計画・管理されていました。創設当初、このダリュッシファには1名の首席医師、2名の医師、2名の外科医、2名の眼科医、1名の薬剤師がいました。',
    s2_c3:'この管理区画は、第一中庭への日常的な患者の流れと、これから入る入院治療棟との間の保護的な仕切りとしての役割も果たしていました。',
    s2_c4:'では、扉の上に書かれた碑文を読んで、息をのんでください…',
    s2_callout:'🚶‍♂️ <strong>音楽と水の音が癒しと出会う、この魔法の場所へ足を踏み入れてください。</strong>',
    s2_fwd:'大病棟を発見する →',
    s3_ct1:'🏥 入院治療棟',s3_ct2:'🌊 病院の構造',s3_ct3:'🎵 音楽療法',s3_ct4:'💧 水療法',s3_ct5:'🌿 アロマテラピー',s3_ct6:'🧺 作業療法',s3_ct7:'🚶 退出と見学',
    s3_c1:'あなたは今、博物館の心臓部であるエディルネ・ダリュッシファの入院治療棟にいます。500年前にここで癒しを見つけた人々の気持ちで、この空間を歩いてください。',
    s3_c2:'中央でリズミカルに流れる噴水と、その正面に音楽の舞台がある病院を想像してください。広いドームに覆われたこの中央集権的に計画された病院は、6つの冬用病室、4つの夏用病室、そして音楽舞台で構成されています。ドームの採光窓は悪い空気も換気します。傾斜した床と下の排水路は洗浄と清掃を容易にします。',
    s3_c3:'この病院を他と区別していたのは、当代の医学知識とともに、治療に音楽の旋法を用いたことでした。10名の奏者による音楽アンサンブルが医師の推奨に従い、異なる病気のために異なる旋法を演奏・歌唱しました。',
    s3_c4:'建物の中央にある噴水から流れる水の音は、患者を落ち着かせ和らげることを目的とした治療の重要な一部でした。',
    s3_c5:'音楽と水の音に加えて、ダリュッシファではアロマテラピーも行われていました。中庭や周辺で育てられたさまざまな植物の香りは、癒しのプロセスの重要な一部でした。',
    s3_c6:'作業療法もここでの治療法として用いられていました。患者は心配や考えごとから気を紛らわせるために、かご編み、編み物、さまざまな工芸に従事させられました。',
    s3_c7:'オスマン医学のさまざまな側面を展示した部屋を見学した後、入院棟を退出できます。400年間継続して機能したこの癒しの場を出る際、第二中庭と第一中庭の他の部屋も訪れ、ダリュッシファとオスマン医学についてさらに学ぶことができます。',
    s3_callout:'🏫 <strong>医学マドラサへ：</strong> ダリュッシファを出て、大きな写真のある入口庭園の左側に位置する医学マドラサへ向かってください。',
    s3_fwd:'マドラサへ進む →',
    s4_ct1:'🏫 医学マドラサ',s4_ct2:'🌍 歴史的意義',s4_ct3:'📚 教育制度',s4_ct4:'🏛️ 建築構造',s4_ct5:'📜 エヴリヤ・チェレビ',s4_ct6:'👨‍🏫 教職員',s4_ct7:'📖 写本',s4_ct8:'🏥 健康博物館',
    s4_c1:'ダリュッシファを見学し、キュッリエのもう一つの重要な区域、スルタン・バヤズィト二世医学マドラサに入りました。右側と正面の博物館の部屋に入る前に、立ち止まってこの独特な空間を観察してください。',
    s4_c2:'今、正方形の中庭を囲んで配置された建物として目にするものは、オスマン帝国で医師を養成した最も権威ある教育機関のひとつであり、何世紀にもわたって多くの著名な医師を輩出した重要な学問の中心地でした。',
    s4_c3:'オスマンの教育制度で最高レベルの「60点以上」マドラサのひとつに位置づけられ、ここの学生は隣接するダリュッシファで理論的な訓練を実践に応用し、知識を実地で深めることができました。',
    s4_c4:'中央に噴水（現存せず）があり、隅に給水用の井戸を持つこのマドラサは、三方に並んだ18の学生部屋と正面の講堂で構成されています。',
    s4_c5:'1652年にキュッリエを訪れたエヴリヤ・チェレビは、このマドラサについて次のように記しています。「医学マドラサとその部屋には、プラトン、ソクラテス、アリストテレス、ガレノス、ピタゴラスといった学者について常に語り合う学生がいる。それぞれが成熟した医師であり、医術に関する貴重な書物に頼り、各自が知識の一分野に専念し、人類の苦しみの治療法を見出そうと努力している。」',
    s4_c6:'教職員は1日60アクチェを稼ぐ18人の学生を教える教授、助教授、司書、2人の使用人で構成されていました。学生のすべての需要が満たされ、1日2アクチェの奨学金も支給されました。',
    s4_c7:'ここで学ばれた38点の手書き医学写本——多くにオスマン・スルタンの印章が押されている——が今日まで伝わっています。これらの貴重な作品は現在、セリミエ写本図書館に保存されています。',
    s4_c8:'マドラサは2007年にトラキア大学によって健康博物館の第二区域として開設されました。その部屋は当時の医学教育を物語っています。最も重要な区域は入口正面の講堂です。',
    s4_callout:'🚶 <strong>マネキンで15世紀の雰囲気を再現した学生部屋、実習室、教授室、講堂、図書館を見学した後、マドラサを出てダリュッシファ出口近くの改札を通り、モスクの中庭を経てイマレットへ向かってください。</strong>',
    s4_fwd:'モスクの壮大さへ →',
    s5_ct1:'🌳 庭園へ',s5_ct2:'💧 水秤',s5_ct3:'🕌 モスク正門',s5_ct4:'🏛️ 食料庫とイマレット',
    s5_c1:'ダリュッシファとマドラサを見学した後、モスクの庭園に入りました。何世紀もの歴史を持つプラタナスの美しいこの庭園をゆっくり歩きながら、正面にある博物館のイマレット区域へ向かってください。',
    s5_c2:'ダリュッシファからの庭園入口でまず右側に注目してください。モスクの角に、高さ約4メートルの長方形の石造り構造物があります。これがキュッリエの水秤です。高い丘からパイプで運ばれた水は、キュッリエの他の施設に分配される前にまずこの構造物の中で圧力が調整されていました。',
    s5_c3:'水秤を過ぎると、右側にモスクの壮大な正門が迎えてくれます。この正門を通ってのモスク中庭の見学は、ツアーの最後まで取っておきましょう。引き続きイマレットへ向かいます。',
    s5_c4:'前方に、似た建築様式の2つの大きな建物が並んでいます。左側の建物には食料庫とパン焼き区域があり、現在は博物館の科学・文化イベントに使用されています。右側の建物が今ご案内するイマレットです。',
    s5_callout:'🍲 <strong>オスマンのイマレット文化を見て、料理人ヤフヤ・ババの伝説を聞く準備はできましたか？では改札でチケットを見せてこの区域に入り、次の停留所をタップして続けてください。</strong>',
    s5_fwd:'豊かさの中心へ →',
    s6_ct1:'🏛️ イマレット',s6_ct2:'🍲 スルタン・バヤズィト二世のイマレット',s6_ct3:'🔥 厨房と食堂',s6_ct4:'🎭 この博物館区域',s6_ct5:'🌿 ヤフヤ・ババの墓',s6_ct6:'📖 ヤフヤ・ババの伝説',s6_ct7:'⚖️ 食料係の試練',s6_ct8:'👑 スルタンの目撃',s6_ct9:'🐟 魚の奇跡',s6_ct10:'🤲 ヤフヤ・ババの旅立ち',s6_ct11:'🪦 墓の参拝',
    s6_c1:'オスマン帝国において、イマレットは社会連帯と慈善の精神を体現する最も重要な機関のひとつでした。貧者、旅人、学生、困窮者に無料で食事を配布する炊き出し場として機能したこれらの施設は、単なる台所ではなく、社会の弱者を守り社会的バランスを維持する不可欠な中心的存在でした。',
    s6_c2:'そして今あなたがいるのはまさにそのような場所です。健康博物館の第三区域として設立されたスルタン・バヤズィト二世キュッリエのイマレットは、創設証書によれば1日3食を貧者に調理・配布した重要な慈善機関でした。',
    s6_c3:'入口で出会う広い空間が、大きな釜で食事を調理していた厨房です。すぐ右側のドアを通った大広間が、石の床のテーブルで食事を取った場所です。',
    s6_c4:'健康博物館の他の区域と同様に、この区域も場の雰囲気に合ったマネキンで演出され、オスマンのイマレット文化を物語り、来館者を時間旅行へと誘います。当時の本物の銅製の容器、すり鉢、貯蔵瓶も展示されています。',
    s6_c5:'イマレットのすぐ裏に、伝説的な人物、料理人ヤフヤ・ババの墓があります。この興味深く広い建物を探索しながら、今日まで語り継がれる料理人ヤフヤ・ババの伝説をお話しします。',
    s6_c6:'物語によれば、キュッリエの創設者スルタン・バヤズィト二世の治世に総料理長を務めたヤフヤ・ババは、格別に美味しいライスピラフを作りました。ピラフをかき混ぜながら絶えず祈り、蓋をする時には「豊かさを与えてください、神よ」と言いました。ピラフは非常に豊富で、すべての患者を養い余りが出るほどでした。ヤフヤ・ババは余ったピラフを捨てることなく、トゥンジャ川の魚たちに与えに行きました。',
    s6_c7:'食料係がヤフヤ・ババが余ったピラフを川に与えているのに気づき、日ごとに与える米の量を減らし始めました。しかし米が少なくなっても、ヤフヤ・ババは祈りながらピラフを調理し、患者も魚も養いました。ついに割り当ての米はひと握りにまで減らされました。それでもヤフヤ・ババのピラフはすべての患者を養い、魚のための分も確保できました。',
    s6_c8:'この話はやがてスルタンの耳に達しました。直接この件を目撃することにしたスルタンは、ヤフヤ・ババよりも早くトゥンジャ川岸に到着して身を隠しました。ヤフヤ・ババが魚たちに与えた後に戻ろうとしたとき、スルタンが隠れ場所から現れて怒鳴りました。「貴様、患者の食糧を川に捨てているのか？」',
    s6_c9:'ヤフヤ・ババは凍りつきました。何も言えませんでした。恥ずかしさで圧倒され、額を地面につけて神に助けを求めました。しかし魚たちが水から頭を上げて声を発しました。「偉大なるスルタンは魚の食べ物を惜しまれるのですか？」',
    s6_c10:'スルタンは驚きと悲しみの中で自分の誤りに気づき、ヤフヤ・ババが額を上げるのを待ちました——しかし無駄でした。この慈悲深い人はすでに魂を神に返していました…',
    s6_c11:'イマレットのすぐ裏にあるヤフヤ・ババの墓は、祈りに来る通行人によって聖人の廟のように訪れられています。特に金曜日には、この墓は参拝者で満たされます。',
    s6_callout:'🪦 <strong>宿泊施設：</strong> この伝説を聞いた後、イマレットを出て左側の博物館カフェで休憩してください。キュッリエの宿泊施設内にある博物館カフェでは、お茶やオスマンのシャーベットを味わい、土産物や本を購入し、博物館図書館を見学してから、最後の停留所であるモスクの中庭へ向かうことができます。キュッリエの宿泊施設で少し休憩しませんか？',
    s6_fwd:'博物館カフェへ →',
    s7_ct1:'🏛️ 中庭とモスクへの入場',s7_ct2:'🚪 入口と雰囲気',s7_ct3:'⛲ 噴水と静寂',s7_ct4:'🏛️ 大理石の柱と建築の調和',s7_ct5:'✨ 内なる平和と静けさ',s7_ct6:'👁️ 観察の瞬間',s7_ct7:'🚪 モスクへの入場',s7_ct8:'🪵 キュンデカーリの職人技',
    s7_c1:'健康博物館の各区域を見学し、カフェで爽やかなオスマンのシャーベットを味わいました。今こそキュッリエで最も壮大な建造物のひとつ、モスクと出会う時です。',
    s7_c2:'中庭に開く優雅な側扉から、あるいは壮大な正門から足を踏み入れると、大理石の精緻な職人技が迎えてくれます。一瞬で外の世界の喧噪を後にし、全く異なる雰囲気へと滑り込みます。',
    s7_c3:'中庭の中央にある噴水が、水の穏やかな音で空間を平和で満たします。この音は石の沈黙と相まって、あなたの歩みを緩め、現在の瞬間への気づきをもたらします。',
    s7_c4:'あなたを囲む大理石の柱が保護の輪のように立ち上がります。異なる色で選ばれたそれらは、オスマン美学の優雅さと調和の豊かさを体現しています。',
    s7_c5:'ここで感じるのは単なる建築的な美しさではなく、何世紀も変わらぬ静寂、内なる平和です。',
    s7_c6:'噴水のそばで少し立ち止まり、このシンプルでありながら印象的な中庭の配置を観察してください。柱、アーチ、繊細な装飾が互いに生み出す調和を感じてください。',
    s7_c7:'それから正面にそびえる壮大な門に向き直ってください。扉を覆う革のカーテンをそっと分けて中に入ってください。国内で最も優美なモスクのひとつに入ったことをすぐに感じ取るでしょう。',
    s7_c8:'入る際、扉の上にある本物のキュンデカーリの木工細工に注目することを忘れずに——可能であれば、この精巧な職人技の質感に触れてみてください。',
    s7_callout:'🕌 <strong>聖域の内側の大きな空間と静けさの中に入りましょうか？</strong>',
    s7_fwd:'内部へ進む →',
    s8_ct1:'🕌 モスクの内部 — フィナーレ',s8_ct2:'🚤 歴史的な移動と王室の伝統',s8_ct3:'👑 王室ギャラリーを想像する',s8_ct4:'🏛️ 王室ギャラリーとその初め',s8_ct5:'⚙️ ミフラーブと釣り合い石',s8_ct6:'🪵 ミンバルと繊細な職人技',s8_ct7:'📐 シンボルと意味',s8_ct8:'💡 光と音響の秩序',s8_ct9:'🌌 ドームの下の壮麗さ',s8_ct10:'🏗️ 建築的な転換点',s8_ct11:'✨ フィナーレとお別れ',
    s8_c1:'あなたは今、キュッリエの中心にあるモスクの内部にいます。この壮大なドームの下でツアーのフィナーレを締めくくります。',
    s8_c2:'キュッリエの創設者スルタン・バヤズィト二世と後に続くスルタンたちは、豪華な帝国の船で川に沿って旅し、このモスクに到着していました。川に面した扉から入り、モスクの左の角に柱の上に立つ王室ギャラリー——ヒュンカール・マフフィリ——で礼拝を行いました。',
    s8_c3:'少し目を閉じてください…スルタンがその高みで、会衆とともに同じ平和の中で礼拝する姿を想像してください。',
    s8_c4:'トルコ・イスラム建築で建てられた最初の王室ギャラリーがここにあることを思い出しながら、今はミフラーブへ向かいましょう。',
    s8_c5:'ミフラーブの両側にある円柱形の釣り合い石に触れてそっと回すと、この偉大な建造物の地面がわずかにも動いていないことに驚かれるでしょう。',
    s8_c6:'右側のミンバルに近づくと、大理石の職人技の繊細さと優雅さに感嘆するでしょう。',
    s8_c7:'今、ミフラーブに背を向けて入口の扉の上を見てください。扉の真上にある中央にスイカがあるトレイのモチーフは、このキュッリエにイマレットがあり、ここに来る人々が食事に招かれていることを象徴しています。',
    s8_c8:'ドームの周りと下の列の窓が、空間全体に光を均等に分配します。この採光の配置はモスクの強力な音響と相まって、空間に視覚的・聴覚的な深みを与えています。',
    s8_c9:'さあ視線を上げてください…バロック装飾で飾られたこの壮大なドームをじっくり見てください。高さ約31メートル、直径22メートルのこのドームは、中間の柱なしに4つの壁の上に乗っており、建築的に注目すべき例です。',
    s8_c10:'それはまた、単一ドーム構造への移行に向けた重要な先駆けとも考えられています。',
    s8_c11:'比類なきこのドームの恵みと壮麗さの下で、過去の痕跡と今日の沈黙を結びつけたこの旅を締めくくります——この場所があなたの心に残した平和と驚嘆を忘れずに携えていってください。',
    s8_callout:'🙏 <strong>この精神的な旅に静かなお別れを捧げましょうか？</strong>',
    s8_fwd:'お別れへ →',
    s9_c1:'🏛️ 一歩一歩、過去の足跡をたどり、この壮大な建築を共に吸い込みました。今こそこの歴史的な場所に自分自身の息吹を加える時です。',
    s9_c2:'💭 あなたの中に響くもの…平和なひとときの記憶、深い感動、あるいは心の中にそっと留まる音符…',
    s9_c3:'📖 ご用意した来訪者の記録帳は、この体験の精神的なアーカイブです。ここに残していただくすべての文章は、私たちにとってかけがえのない思い出となり、他のゲストにとってこの旅に意味を与える光となります。',
    s9_c4:'✨ 心から溢れるものを私たちと分かち合い、心の橋に永遠にあなたの足跡を残してください…',
    s9_callout:'✍️ <strong>心の橋のページでお気持ちを共有するようご招待します。</strong>',
    s9_fwd:'心の橋に書く →',
    s10_body:'キュッリエを巡るこの500年の旅があなたに残した印象をぜひお聞かせください。あなたの言葉がこの橋の石となります。',
    s10_restart:'🏛️ 最初に戻る'
  }
};

function t(key){
  if(currentLang === 'tr'){
    const el = document.querySelector('[data-i18n="'+key+'"]');
    if(el){ return el.getAttribute('data-tr') || TRANSLATIONS['tr'][key] || key; }
    return TRANSLATIONS['tr'][key] || key;
  }
  const lang = TRANSLATIONS[currentLang] || TRANSLATIONS['tr'];
  return lang[key] || TRANSLATIONS['tr'][key] || key;
}

function applyTranslations(){
  const L = currentLang;
  const isRTL = L==='ar'||L==='fa';
  document.documentElement.dir = isRTL?'rtl':'ltr';

  const introTitle = document.querySelector('.intro-title');
  const introSub   = document.querySelector('.intro-sub');
  const btnStart   = document.querySelector('.btn-start');
  if(introTitle) introTitle.textContent = t('intro_title');
  if(introSub)   introSub.textContent   = t('intro_sub');
  if(btnStart)   btnStart.textContent   = t('start');

  const ml = document.getElementById('menu-lang-label');
  if(ml) ml.textContent = t('menu_lang');

  const gbName = document.getElementById('gb-name');
  const gbCity = document.getElementById('gb-city');
  const gbText = document.getElementById('gb-text');
  const gbBtn  = document.getElementById('btn-submit');
  if(gbName) gbName.placeholder = t('gb_name');
  if(gbCity) gbCity.placeholder = t('gb_city');
  if(gbText) gbText.placeholder = t('gb_msg');
  if(gbBtn && !gbBtn.disabled) gbBtn.textContent = t('gb_submit');

  const confirmText  = document.querySelector('.confirm-text');
  const confirmClose = document.querySelector('.confirm-close');
  if(confirmText)  confirmText.innerHTML = '<strong>'+t('confirm_text')+'</strong>';
  if(confirmClose) confirmClose.textContent = t('confirm_close');

  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const key = el.getAttribute('data-i18n');
    let val;
    if(currentLang === 'tr'){
      // Türkçe için HTML'deki orijinal metni kullan (data-tr'de saklı)
      val = el.getAttribute('data-tr');
    } else {
      val = t(key);
    }
    if(val){
      if(el.classList.contains('stop-callout')||el.classList.contains('stop-slogan')){
        el.innerHTML = val;
      } else {
        el.textContent = val;
      }
    }
  });
  updateMenuStopNames();
}

const STOP_NAMES_I18N = {
  tr:['Müze Girişi','Darüşşifa 1. Avlu','Darüşşifa 2. Avlu','Şifahane','Medrese','Büyük Avlu','İmarethane','Cami Avlusu','Cami İçi','Gönül Köprüsü Davet','Gönül Köprüsü'],
  en:['Museum Entrance','Darüşşifa 1st Courtyard','Darüşşifa 2nd Courtyard','Infirmary','Medical Madrasa','Great Courtyard','Imaret','Mosque Courtyard','Inside the Mosque','Heart Bridge Invitation','Heart Bridge'],
  de:['Museumseingang','Darüşşifa 1. Hof','Darüşşifa 2. Hof','Krankenstation','Medizinische Madrasa','Großer Hof','Imaret','Moscheehof','Moscheeinneres','Einladung zur Herzbrücke','Herzbrücke'],
  fr:['Entrée du Musée','Darüşşifa 1re Cour','Darüşşifa 2e Cour','Infirmerie','Madrasa Médicale','Grande Cour','Imaret','Cour de la Mosquée','Intérieur de la Mosquée','Invitation au Pont du Cœur','Pont du Cœur'],
  it:['Ingresso del Museo','Primo Cortile del Darüşşifa','Secondo Cortile del Darüşşifa','Infermeria','Madrasa Medica','Grande Cortile','Imaret','Cortile della Moschea','Interno della Moschea','Invito al Ponte del Cuore','Ponte del Cuore'],
  es:['Entrada del Museo','Primer Patio del Darüşşifa','Segundo Patio del Darüşşifa','Enfermería','Madrasa Médica','Gran Patio','Imaret','Patio de la Mezquita','Interior de la Mezquita','Invitación al Puente del Corazón','Puente del Corazón'],
  ru:['Вход в музей','Первый двор Дарюшшифы','Второй двор Дарюшшифы','Лечебница','Медицинская медресе','Большой двор','Имарет','Двор мечети','Внутри мечети','Приглашение на Мост Сердца','Мост Сердца'],
  ar:['مدخل المتحف','الفناء الأول لدار الشفاء','الفناء الثاني لدار الشفاء','قاعة العلاج','المدرسة الطبية','الفناء الكبير','الإيمارة','ساحة المسجد','داخل المسجد','دعوة إلى جسر القلب','جسر القلب'],
  bg:['Вход на музея','Дарюшшифа – Първи двор','Дарюшшифа – Втори двор','Лечебница','Медицинско медресе','Голям двор','Имарет','Двор на джамията','Вътрешност на джамията','Покана към Моста на сърцето','Мост на сърцето'],
  el:['Είσοδος Μουσείου','Πρώτη Αυλή Δαρυσσιφά','Δεύτερη Αυλή Δαρυσσιφά','Νοσοκομείο','Ιατρική Μεντρεσέ','Μεγάλη Αυλή','Ιμαρέτ','Αυλή Τζαμιού','Εσωτερικό Τζαμιού','Πρόσκληση στη Γέφυρα της Καρδιάς','Γέφυρα της Καρδιάς'],
  zh:['博物馆入口','达鲁希法第一庭院','达鲁希法第二庭院','疗养院','医学院','大庭院','伊马雷特','清真寺庭院','清真寺内部','心桥邀请','心桥'],
  fa:['ورودی موزه','حیاط اول دارالشفا','حیاط دوم دارالشفا','بخش درمان','مدرسه پزشکی','حیاط بزرگ','عمارت','حیاط مسجد','داخل مسجد','دعوت به پل دل','پل دل'],
  ro:['Intrarea în Muzeu','Prima Curte a Darüşşifa','A Doua Curte a Darüşşifa','Infirmeria','Madrasa Medicală','Curtea Mare','Imaret','Curtea Moscheii','Interiorul Moscheii','Invitație la Podul Inimii','Podul Inimii'],
  ja:['博物館入口','ダールッシファ第1中庭','ダールッシファ第2中庭','診療棟','医学マドラサ','大中庭','イマレット','モスク中庭','モスク内部','心の橋への招待','心の橋']
};

const MENU_SECTIONS_I18N = {
  tr:['TUR DURAKLARI','AYARLAR','SAYFALAR'],
  en:['TOUR STOPS','SETTINGS','PAGES'],
  de:['TOURSTATIONEN','EINSTELLUNGEN','SEITEN'],
  fr:['ÉTAPES DE LA VISITE','PARAMÈTRES','PAGES'],
  it:['TAPPE DEL TOUR','IMPOSTAZIONI','PAGINE'],
  es:['PARADAS DEL TOUR','CONFIGURACIÓN','PÁGINAS'],
  ru:['ОСТАНОВКИ ТУРА','НАСТРОЙКИ','СТРАНИЦЫ'],
  ar:['محطات الجولة','الإعدادات','الصفحات'],
  bg:['СПИРКИ НА ОБИКОЛКАТА','НАСТРОЙКИ','СТРАНИЦИ'],
  el:['ΣΤΑΣΕΙΣ ΠΕΡΙΗΓΗΣΗΣ','ΡΥΘΜΙΣΕΙΣ','ΣΕΛΙΔΕΣ'],
  zh:['游览站点','设置','页面'],
  fa:['ایستگاه‌های تور','تنظیمات','صفحات'],
  ro:['OPRIRI TUR','SETĂRI','PAGINI'],
  ja:['ツアースポット','設定','ページ']
};

const MENU_MAP_I18N = {
  tr:'Harita & Konum',
  en:'Map & Location',
  de:'Karte & Standort',
  fr:'Carte & Position',
  it:'Mappa e Posizione',
  es:'Mapa y Ubicación',
  ru:'Карта и местоположение',
  ar:'الخريطة والموقع',
  bg:'Карта и местоположение',
  el:'Χάρτης & Τοποθεσία',
  zh:'地图与位置',
  fa:'نقشه و مکان',
  ro:'Hartă & Locație',
  ja:'地図と場所'
};

const MENU_DEFTER_I18N = {
  tr:'Gönül Köprüsü',
  en:'Heart Bridge',
  de:'Herzbrücke',
  fr:'Pont du Cœur',
  it:'Ponte del Cuore',
  es:'Puente del Corazón',
  ru:'Мост Сердца',
  ar:'جسر القلب',
  bg:'Мост на сърцето',
  el:'Γέφυρα της Καρδιάς',
  zh:'心桥',
  fa:'پل دل',
  ro:'Podul Inimii',
  ja:'心の橋'
};

const MENU_NOTEBOOK_I18N = {
  tr:'Gönül Defteri',
  en:'Guestbook',
  de:'Gästebuch',
  fr:'Livre d’or',
  it:'Libro degli Ospiti',
  es:'Libro de Visitas',
  ru:'Книга гостей',
  ar:'دفتر الزوار',
  bg:'Книга за гости',
  el:'Βιβλίο επισκεπτών',
  zh:'留言簿',
  fa:'دفتر مهمانان',
  ro:'Cartea de Onoare',
  ja:'芳名録'
};

const LANG_CLOSE_I18N = {
  tr:'KAPAT',
  en:'CLOSE',
  de:'SCHLIESSEN',
  fr:'FERMER',
  it:'CHIUDI',
  es:'CERRAR',
  ru:'ЗАКРЫТЬ',
  ar:'إغلاق',
  bg:'ЗАТВОРИ',
  el:'ΚΛΕΙΣΙΜΟ',
  zh:'关闭',
  fa:'بستن',
  ro:'ÎNCHIDE',
  ja:'閉じる'
};
function updateMenuStopNames(){
  const L = currentLang;
  const names = STOP_NAMES_I18N[L] || STOP_NAMES_I18N['tr'];
  const sections = MENU_SECTIONS_I18N[L] || MENU_SECTIONS_I18N['tr'];

  for(let i=0;i<names.length&&i<STOP_NAMES.length;i++) STOP_NAMES[i]=names[i];
  updateProgressBar();

  document.querySelectorAll('.menu-section').forEach((el,i)=>{ if(sections[i]) el.textContent=sections[i]; });

  document.querySelectorAll('#menu-panel .menu-item').forEach(item=>{
    const nameEl=item.querySelector('.mi-name');
    if(!nameEl)return;
    const onclick=item.getAttribute('onclick')||'';
    const match=onclick.match(/menuGoStop\((\d+)\)/);
    if(match){
      const n=parseInt(match[1]);
      if(names[n]!==undefined) nameEl.textContent=names[n];
    }
  });

  const mapItem=document.querySelector('#menu-panel .menu-item[onclick*="openMapScreen"] .mi-name');
  if(mapItem) mapItem.textContent=MENU_MAP_I18N[L]||MENU_MAP_I18N['tr'];
  const defterItem=document.querySelector('#menu-panel .menu-item[onclick*="openDefterScreen"] .mi-name');
  if(defterItem) defterItem.textContent=MENU_DEFTER_I18N[L]||MENU_DEFTER_I18N['tr'];
  const notebookItem=document.querySelector('#menu-panel .menu-item[onclick*="menuGoStop(10)"] .mi-name');
  if(notebookItem) notebookItem.textContent=MENU_NOTEBOOK_I18N[L]||MENU_NOTEBOOK_I18N['tr'];

  const langClose=document.querySelector('.lang-close');
  if(langClose) langClose.textContent=LANG_CLOSE_I18N[L]||'CLOSE';
}

/* ────────────────────────────────────────
   LOCATION
──────────────────────────────────────── */
const ZONES = [
  {id:'camii',name:'Cami',announce:'Camidesiniz. Külliyenin ana ibadet mekânı sizi karşılıyor.',coords:[[41.685501,26.544305],[41.685300,26.544541],[41.685481,26.544812],[41.685677,26.544568]]},
  {id:'tabhane-sol',name:'Sol Tabhane',announce:'Müze kafe ve kütüphane bölümündesiniz. Bir şerbet içmeye ne dersiniz?',coords:[[41.685679,26.544572],[41.685534,26.544753],[41.685725,26.545021],[41.685859,26.544853]]},
  {id:'tabhane-sag',name:'Sağ Tabhane',announce:'Misafirhane bölümündesiniz. Külliyenin sağ kanadındasınız.',coords:[[41.685370,26.544097],[41.685188,26.544303],[41.685319,26.544513],[41.685498,26.544303]]},
  {id:'camii-avlu',name:'Cami Avlusu',announce:'Cami Avlusundasınız. 500 yıllık huzur sizi kucaklıyor.',coords:[[41.685715,26.543872],[41.685439,26.544205],[41.685756,26.544679],[41.686038,26.544344]]},
  {id:'buyuk-avlu',name:'Cami Bahçesi',announce:'Cami Bahçesindesiniz. Asırlık çınarlar sizi selamlıyor.',coords:[[41.686022,26.543319],[41.685650,26.543769],[41.686147,26.544496],[41.686458,26.544122]]},
  {id:'giris-avlu',name:'Müze Girişi',announce:'Müze Girişi bölümündesiniz. Hoş geldiniz!',coords:[[41.685899089493,26.542882919312],[41.685600630070,26.543226912618],[41.685807166603,26.543576135073],[41.686101400127,26.543215513229]]},
  {id:'medrese',name:'Medrese',announce:'Tıp Medresesi bölümündesiniz. İlmin ve hekimliğin beşiğindesiniz.',coords:[[41.685607,26.542635],[41.685307,26.542964],[41.685527,26.543304],[41.685821,26.542966]]},
  {id:'darussifa-1',name:'Darüşşifa 1. Avlu',announce:'Darüşşifa Birinci Avlusundasınız. Poliklinik odaları solunuzda ve sağınızda…',coords:[[41.685621,26.543267],[41.685330,26.543617],[41.685526,26.543907],[41.685803,26.543579]]},
  {id:'darussifa-2',name:'Darüşşifa 2. Avlu',announce:'Darüşşifa İkinci Avlusundasınız. Hekimbaşı ve idari bölüm burada çalışırdı.',coords:[[41.685330,26.543617],[41.685209,26.543744],[41.685402,26.544051],[41.685526,26.543907]]},
  {id:'darussifa',name:'Darüşşifa',announce:'Darüşşifa\'dasınız. Su ve müzik tedavisinin gerçekleştiği tarihi mekândasınız.',coords:[[41.685207,26.543747],[41.684990,26.543998],[41.685183,26.544297],[41.685401,26.544055]]},
  {id:'imarethane',name:'İmarethane',announce:'İmarethane\'desiniz. Yahya Baba\'nın duaları bu mekânda yankılanıyor.',coords:[[41.686296,26.544321],[41.685726,26.545024],[41.685909,26.545302],[41.686471,26.544608]]}
];

function ptInPoly(lat,lon,coords){
  let inside=false;
  for(let i=0,j=coords.length-1;i<coords.length;j=i++){
    const[yi,xi]=coords[i],[yj,xj]=coords[j];
    if(((yi>lat)!==(yj>lat))&&(lon<(xj-xi)*(lat-yi)/(yj-yi)+xi))inside=!inside;
  }
  return inside;
}

function speakText(text){
  if(!('speechSynthesis' in window))return;
  window.speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text);
  u.lang=currentLang==='en'?'en-US':currentLang==='de'?'de-DE':currentLang==='fr'?'fr-FR':currentLang==='el'?'el-GR':currentLang==='zh'?'zh-CN':currentLang==='fa'?'fa-IR':'tr-TR';
  u.rate=0.92;u.pitch=1;
  const voices=window.speechSynthesis.getVoices();
  const match=voices.find(v=>v.lang.startsWith(u.lang.split('-')[0]));
  if(match)u.voice=match;
  window.speechSynthesis.speak(u);
}

function checkLocation(){
  if(!navigator.geolocation){showLocToast('Konum desteklenmiyor');return;}
  showLocToast('📍 Konum alınıyor…');
  navigator.geolocation.getCurrentPosition(pos=>{
    const{latitude:lat,longitude:lon}=pos.coords;
    const zone=ZONES.find(z=>ptInPoly(lat,lon,z.coords));
    const msg=zone?'📍 '+zone.announce:'📍 Külliye alanı dışındasınız.';
    showLocToast(msg);
    speakText(zone?zone.announce:'Külliye alanı dışındasınız.');
  },err=>{showLocToast('📍 Konum alınamadı.');},{enableHighAccuracy:true,timeout:10000,maximumAge:5000});
}

function showLocToast(msg){
  const el=document.getElementById('loc-toast');
  el.textContent=msg;el.classList.add('show');
  clearTimeout(window._locToastTimer);
  window._locToastTimer=setTimeout(()=>el.classList.remove('show'),4000);
}

/* ────────────────────────────────────────
   YOUTUBE / IMAGE / CONFIRM
──────────────────────────────────────── */
function openYT(){
  const stopAudio=document.getElementById('stop-audio');
  const introAudio=document.getElementById('intro-audio');
  if(stopAudio&&!stopAudio.paused){stopAudio._ytWasPlaying=true;stopAudio.pause();}
  if(introAudio&&!introAudio.paused){introAudio._ytWasPlaying=true;introAudio.pause();}
  document.getElementById('yt-iframe').src='https://www.youtube.com/embed/YUw2S2MrHow?autoplay=1';
  document.getElementById('yt-popup').classList.add('open');
}
function closeYT(){document.getElementById('yt-iframe').src='';document.getElementById('yt-popup').classList.remove('open');goStop(2);}
function openImg(src){document.getElementById('img-popup-img').src=src;document.getElementById('img-popup').classList.add('open');}
function closeImg(){document.getElementById('img-popup').classList.remove('open');}
function openConfirm(){document.getElementById('confirm-popup').classList.add('open');}
function closeConfirm(){document.getElementById('confirm-popup').classList.remove('open');}

/* ────────────────────────────────────────
   MAP / DEFTER
──────────────────────────────────────── */
function openMapScreen(){closeMenu();document.getElementById('map-iframe').src='https://edirnesaglikmuzesi-bit.github.io/muze/nav/konum.html';showScreen('map');}

/* ────────────────────────────────────────
   GÖNÜL KÖPRÜSÜ
──────────────────────────────────────── */
async function submitGonul(){
  const name=document.getElementById('gb-name').value.trim();
  const city=document.getElementById('gb-city').value.trim();
  const text=document.getElementById('gb-text').value.trim();
  const btn=document.getElementById('btn-submit');
  if(!text){showLocToast('Lütfen bir not bırakın…');return;}
  btn.disabled=true;btn.textContent='Mühürleniyor…';
  if(!window.db){showLocToast('Bağlantı kurulamadı.');btn.disabled=false;btn.textContent=t('gb_submit');return;}
  try{
    await window.db.collection('messages').add({user:name||'Anonim',city:city||'Belirtilmedi',text,timestamp:firebase.firestore.FieldValue.serverTimestamp()});
    document.getElementById('gb-name').value='';document.getElementById('gb-city').value='';document.getElementById('gb-text').value='';
    openConfirm();
  }catch(e){showLocToast('Bağlantı hatası.');console.error(e);}
  btn.disabled=false;btn.textContent=t('gb_submit');
}

function fmtDate(ts){if(!ts)return'';return new Date(ts.seconds*1000).toLocaleDateString('tr-TR',{day:'2-digit',month:'long',year:'numeric'});}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

function renderMessages(){
  const latest=allMessages.slice(0,LATEST);
  const latEl=document.getElementById('latest-msgs');
  if(!latEl)return;
  latEl.innerHTML=latest.length?latest.map(m=>`<div class="msg-card"><div class="msg-author">👤 ${esc(m.user)}</div><div class="msg-city">📍 ${esc(m.city)}</div><div class="msg-body">${esc(m.text)}</div><div class="msg-date">${fmtDate(m.timestamp)}</div></div>`).join(''):'<div class="msg-loading">Henüz mesaj yok. İlk taşı siz koyun! ✨</div>';
  const archive=allMessages.slice(LATEST);
  const archEl=document.getElementById('archive-msgs');
  const pgEl=document.getElementById('pg-wrap');
  if(!archEl||!pgEl)return;
  if(!archive.length){archEl.innerHTML='';pgEl.innerHTML='';return;}
  const total=Math.ceil(archive.length/PER_PAGE);
  if(archivePage>total)archivePage=1;
  const slice=archive.slice((archivePage-1)*PER_PAGE,archivePage*PER_PAGE);
  archEl.innerHTML='<div class="msg-section-title">🗂️ Arşiv</div>'+slice.map(m=>`<div class="msg-card" style="opacity:0.85;"><div class="msg-author">👤 ${esc(m.user)} <span style="font-weight:400;color:var(--stone);font-size:11px;">— ${esc(m.city)}</span></div><div class="msg-body" style="margin-top:6px;">${esc(m.text)}</div><div class="msg-date">${fmtDate(m.timestamp)}</div></div>`).join('');
  pgEl.innerHTML='';
  if(total>1){for(let i=1;i<=total;i++){const b=document.createElement('button');b.textContent=i;b.className='pg-btn'+(i===archivePage?' active':'');b.onclick=()=>{archivePage=i;renderMessages();archEl.scrollIntoView({behavior:'smooth'});};pgEl.appendChild(b);}}
}

function loadMessages(){
  if(!window.db)return;
  window.db.collection('messages').orderBy('timestamp','desc').onSnapshot(snap=>{allMessages=[];snap.forEach(doc=>allMessages.push(doc.data()));renderMessages();},err=>console.error(err));
}

/* ────────────────────────────────────────
   TRACKING
──────────────────────────────────────── */
const TRACKING={sessionId:null,locationGranted:false,watchId:null,currentZone:null,startTime:Date.now(),zoneEntryTime:null,lastStop:0,active:false};

function showKVKKBanner(){if(localStorage.getItem('kvkk-accepted'))return;setTimeout(()=>document.getElementById('kvkk-banner').classList.add('show'),1200);}
function acceptKVKK(){localStorage.setItem('kvkk-accepted','1');document.getElementById('kvkk-banner').classList.remove('show');closeKVKK();}
function openKVKK(){document.getElementById('kvkk-modal').classList.add('open');}
function closeKVKK(){document.getElementById('kvkk-modal').classList.remove('open');}

function requestLocationPermission(){
  document.getElementById('loc-permission-popup').classList.remove('open');
  if(!navigator.geolocation){showLocToast('⚠️ Tarayıcınız konum desteklemiyor.');return;}
  if(window.self!==window.top){showLocToast('⚠️ Konum için sayfayı yeni sekmede açın.');return;}
  if(navigator.permissions){
    navigator.permissions.query({name:'geolocation'}).then(r=>{if(r.state==='denied'){showLocToast('⚠️ Konum izni engellenmiş.');return;}_doGetLocation();}).catch(()=>_doGetLocation());
  } else _doGetLocation();
}

function _doGetLocation(){
  showLocToast('📍 Konum izni isteniyor…');
  navigator.geolocation.getCurrentPosition(pos=>{
    TRACKING.locationGranted=true;localStorage.setItem('loc-perm-decided','granted');updateSessionField({locationGranted:true});showLocToast('📍 Konum takibi başladı.');
    onLocationUpdate(pos.coords.latitude,pos.coords.longitude);
    TRACKING.watchId=navigator.geolocation.watchPosition(p=>onLocationUpdate(p.coords.latitude,p.coords.longitude),e=>console.warn(e.code),{enableHighAccuracy:true,timeout:20000,maximumAge:5000});
  },err=>{
    if(err.code===1){localStorage.setItem('loc-perm-decided','denied');showLocToast('📍 Konum izni reddedildi.');}
    else{TRACKING.locationGranted=true;localStorage.setItem('loc-perm-decided','granted');updateSessionField({locationGranted:true});showLocToast('📍 GPS sinyali bekleniyor…');TRACKING.watchId=navigator.geolocation.watchPosition(p=>onLocationUpdate(p.coords.latitude,p.coords.longitude),e=>console.warn(e.code),{enableHighAccuracy:false,timeout:30000,maximumAge:10000});}
  },{enableHighAccuracy:true,timeout:10000,maximumAge:0});
}

function skipLocationPermission(){document.getElementById('loc-permission-popup').classList.remove('open');localStorage.setItem('loc-perm-decided','denied');TRACKING.locationGranted=false;updateSessionField({locationGranted:false});}

function onLocationUpdate(lat,lon){
  const zone=ZONES.find(z=>ptInPoly(lat,lon,z.coords));const zoneId=zone?zone.id:null;
  if(zoneId!==TRACKING.currentZone){
    if(TRACKING.currentZone&&TRACKING.zoneEntryTime){recordZoneVisit(TRACKING.currentZone,(Date.now()-TRACKING.zoneEntryTime)/60000);removeVisitorLocation();}
    TRACKING.currentZone=zoneId;TRACKING.zoneEntryTime=Date.now();
    if(zoneId)upsertVisitorLocation(zoneId);
  } else {if(zoneId)refreshVisitorLocation(zoneId);}
}

function createSession(){if(!window.db||!TRACKING.sessionId)return;try{window.db.collection('visitor_sessions').doc(TRACKING.sessionId).set({startTime:firebase.firestore.FieldValue.serverTimestamp(),lang:currentLang||'tr',maxStop:0,durationMin:0,locationGranted:false,active:true,userAgent:navigator.userAgent.slice(0,80)});}catch(e){}}
function updateSessionField(data){if(!window.db||!TRACKING.sessionId)return;try{window.db.collection('visitor_sessions').doc(TRACKING.sessionId).update(data);}catch(e){}}
function finalizeSession(){if(!window.db||!TRACKING.sessionId||!TRACKING.active)return;TRACKING.active=false;const d=Math.round((Date.now()-TRACKING.startTime)/60000);try{window.db.collection('visitor_sessions').doc(TRACKING.sessionId).update({endTime:firebase.firestore.FieldValue.serverTimestamp(),durationMin:d,active:false,maxStop:TRACKING.lastStop});if(TRACKING.currentZone)removeVisitorLocation();}catch(e){}}
function upsertVisitorLocation(zoneId){if(!window.db||!TRACKING.sessionId)return;try{window.db.collection('visitor_locations').doc(TRACKING.sessionId).set({zone:zoneId,stop:currentStop||0,currentPage:currentStop||0,lang:currentLang||'tr',visitorId:TRACKING.sessionId,lastSeen:firebase.firestore.FieldValue.serverTimestamp(),startTime:firebase.firestore.Timestamp.fromMillis(TRACKING.startTime)},{merge:true});}catch(e){}}
function refreshVisitorLocation(zoneId){if(!window.db||!TRACKING.sessionId)return;try{window.db.collection('visitor_locations').doc(TRACKING.sessionId).update({lastSeen:firebase.firestore.FieldValue.serverTimestamp(),stop:currentStop||0,zone:zoneId,currentPage:currentStop||0,lang:currentLang||'tr'});}catch(e){}}
function removeVisitorLocation(){if(!window.db||!TRACKING.sessionId)return;try{window.db.collection('visitor_locations').doc(TRACKING.sessionId).delete();}catch(e){}}
function recordZoneVisit(zoneId,dwellMin){if(!window.db||!zoneId)return;try{const ref=window.db.collection('zone_visits').doc(zoneId);window.db.runTransaction(async tx=>{const doc=await tx.get(ref);if(doc.exists){const d=doc.data();const total=(d.totalVisits||0)+1;const avgMin=((d.avgMinutes||0)*(d.totalVisits||0)+dwellMin)/total;tx.update(ref,{totalVisits:total,avgMinutes:Math.round(avgMin*10)/10,lastUpdated:firebase.firestore.FieldValue.serverTimestamp()});}else{tx.set(ref,{zoneId,totalVisits:1,avgMinutes:dwellMin,lastUpdated:firebase.firestore.FieldValue.serverTimestamp()});}});}catch(e){}}

document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden'){if(TRACKING.currentZone&&TRACKING.zoneEntryTime){recordZoneVisit(TRACKING.currentZone,(Date.now()-TRACKING.zoneEntryTime)/60000);}finalizeSession();if(TRACKING.watchId!==null){navigator.geolocation.clearWatch(TRACKING.watchId);TRACKING.watchId=null;}}
  else if(document.visibilityState==='visible'&&TRACKING.active){if(TRACKING.locationGranted&&TRACKING.watchId===null){TRACKING.watchId=navigator.geolocation.watchPosition(p=>onLocationUpdate(p.coords.latitude,p.coords.longitude),()=>{},{enableHighAccuracy:true,timeout:15000,maximumAge:5000});}}
});
window.addEventListener('beforeunload',()=>{finalizeSession();if(TRACKING.watchId!==null){navigator.geolocation.clearWatch(TRACKING.watchId);}});
window.addEventListener('load',()=>showKVKKBanner());

/* ────────────────────────────────────────
   INIT
──────────────────────────────────────── */
window.addEventListener('DOMContentLoaded',()=>{
  const introAudio=document.getElementById('intro-audio');
  introAudio.volume=0.45;
  let introStarted=false;
  function tryPlayIntro(){if(introStarted)return;if(!document.getElementById('screen-intro').classList.contains('active'))return;introStarted=true;introAudio.play().catch(()=>{introStarted=false;});}
  // Hemen çalmayı dene (tarayıcı izin verirse)
  introAudio.play().then(()=>{introStarted=true;}).catch(()=>{
    // Autoplay engellendiyse ilk kullanıcı etkileşiminde başlat
    ['touchstart','click','mousedown','pointerdown','keydown'].forEach(ev=>{
      document.addEventListener(ev,tryPlayIntro,{once:false,passive:true});
    });
  });
  const muteStored=localStorage.getItem('rehber-speaker-muted');
  if(muteStored==='1'){speakerMuted=true;document.getElementById('btn-speaker').textContent='🔇';}
  document.querySelectorAll('[data-i18n]').forEach(el=>{if(!el.hasAttribute('data-tr')){el.setAttribute('data-tr',el.classList.contains('stop-callout')||el.classList.contains('stop-slogan')?el.innerHTML:el.textContent);}});
  currentLang='tr';document.documentElement.lang='tr';
  document.querySelectorAll('.lang-btn').forEach(b=>{b.classList.toggle('active',b.getAttribute('onclick').includes("'tr'"));});
  applyTranslations();updateProgressBar();
  if('speechSynthesis' in window){window.speechSynthesis.getVoices();window.speechSynthesis.addEventListener('voiceschanged',()=>window.speechSynthesis.getVoices());}
});

/* ────────────────────────────────────────
   WATER RIPPLE
──────────────────────────────────────── */
(function(){
  const canvas=document.getElementById('water-canvas');if(!canvas)return;
  const ctx=canvas.getContext('2d');let W,H,cols,rows,current,previous;const DAMP=0.97,DROP_INTERVAL=900;
  function resize(){const pw=canvas.parentElement?canvas.parentElement.offsetWidth:window.innerWidth;const ph=canvas.parentElement?canvas.parentElement.offsetHeight:window.innerHeight;W=canvas.width=pw||window.innerWidth;H=canvas.height=ph||window.innerHeight;if(W<1)W=canvas.width=window.innerWidth;if(H<1)H=canvas.height=window.innerHeight;cols=W;rows=H;current=new Float32Array(cols*rows);previous=new Float32Array(cols*rows);}
  function drop(x,y,radius,strength){x=Math.round(x);y=Math.round(y);for(let dy=-radius;dy<=radius;dy++){for(let dx=-radius;dx<=radius;dx++){if(dx*dx+dy*dy<=radius*radius){const nx=x+dx,ny=y+dy;if(nx>=0&&nx<cols&&ny>=0&&ny<rows)previous[ny*cols+nx]+=strength;}}}}
  function update(){for(let y=1;y<rows-1;y++){for(let x=1;x<cols-1;x++){const i=y*cols+x;current[i]=(previous[(y-1)*cols+x]+previous[(y+1)*cols+x]+previous[y*cols+(x-1)]+previous[y*cols+(x+1)])/2-current[i];current[i]*=DAMP;}}[current,previous]=[previous,current];}
  function render(){const imgData=ctx.createImageData(W,H);const data=imgData.data;for(let y=1;y<rows-1;y++){for(let x=1;x<cols-1;x++){const i=y*cols+x;const dx=previous[y*cols+(x+1)]-previous[y*cols+(x-1)];const dy=previous[(y+1)*cols+x]-previous[(y-1)*cols+x];const base=180+Math.round(dx*0.4);const pi=(y*W+x)*4;data[pi]=Math.min(255,Math.max(0,base+40));data[pi+1]=Math.min(255,Math.max(0,base-30));data[pi+2]=Math.min(255,Math.max(0,10));data[pi+3]=Math.min(200,Math.max(0,Math.abs(dx*6+dy*6)));}}ctx.putImageData(imgData,0,0);}
  function loop(){update();render();requestAnimationFrame(loop);}
  function autoDrop(){if(document.getElementById('screen-intro').classList.contains('active')){drop(Math.random()*W,Math.random()*H,Math.random()*18+8,Math.random()*180+80);}setTimeout(autoDrop,DROP_INTERVAL+Math.random()*600);}
  canvas.addEventListener('click',e=>{const r=canvas.getBoundingClientRect();drop(e.clientX-r.left,e.clientY-r.top,22,220);});
  canvas.addEventListener('touchstart',e=>{const r=canvas.getBoundingClientRect();Array.from(e.touches).forEach(t=>{drop(t.clientX-r.left,t.clientY-r.top,18,180);});},{passive:true});
  window.addEventListener('resize',resize);
  function init(){resize();loop();setTimeout(autoDrop,400);}
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init);}else{requestAnimationFrame(()=>requestAnimationFrame(init));}
})();

/* ════════════════════════════════════════════════════
   EVLİYA ÇELEBİ AI CHAT
════════════════════════════════════════════════════ */
const EVLIYA_SYSTEM_PROMPT=`Sen Evliya Çelebi'sin — 17. yüzyılın büyük Osmanlı seyyahı, Seyahatnâme'nin müellifi. Şu an Sultan II. Bayezid Külliyesi Sağlık Müzesi'nde (Edirne) dijital bir rehber olarak ziyaretçilerle sohbet ediyorsun.

## !! UYDURMA YASAĞI — EN ÖNEMLİ KURAL !!
Aşağıda sana verilen BİLGİ BANKASI dışında HİÇBİR tarihi iddiada bulunma.
Eğer bir soru bilgi bankan dışındaysa, şunu söyle: "Bu konuda Seyahatnâme'mde kayıt bulamıyorum — müze görevlilerine sormak daha sağlıklı olur."
Kesinlikle tarih, isim, rakam, olay uydurmayacaksın. Belirsizse belirsiz söyle.

## KİŞİLİĞİN
- Sıcak, bilge, hafifçe meraklı bir anlatıcısın
- Eski Türkçe ve Osmanlıca kelimeler nadiren ve yerinde kullanırsın
- Külliyeyi 1652'de bizzat gezdin; Seyahatnâme'ye kaydettin
- Dini ifadeleri (Maşallah vb.) yalnızca gerçekten şaşırtıcı bir şey anlatırken kullan

---

## BİLGİ BANKASI — YALNIZCA BUNLARI BİLİRSİN

### KÜLLİYE GENEL
- Adı: Sultan II. Bayezid Külliyesi. Edirne'de, Tunca Nehri kıyısında.
- İnşaat: 1484'te başlandı (25 Mayıs 1484 temel töreni), 1488'de tamamlandı (4 yıl). Mimar: Hayreddin (Sinan öncesi dönemin ustası).
- Sultan II. Bayezid: sekizinci Osmanlı padişahı, "Veli" lakabıyla anılır, Fatih Sultan Mehmet'in oğlu.
- Külliye bölümleri: Darüşşifa, Tıp Medresesi, Cami, İmarethane, Tabhane, Fırın, Mehterhane.
- Cami: Kündekâri ahşap işçiliği; hünkâr mahfili ilk Türk-İslam örneklerinden sayılır.
- İmarethane: Günde üç öğün yemek verilirdi — "ister divane, ister hasta olsun" herkese.
- Külliye 22.000 m² alana kurulmuştur. 100'den fazla kubbesi vardır.
- Evliya'nın kaydı: "Orada bir Darüşşifa vardır ki dil ile tarif edilmez, kalemler ile yazılmaz."
- Külliyenin inşası için Basarabya fethinden elde edilen ganimet kullanılmıştır.
- İmparatorluğun dört bir yanından maharetli ustalar ve amacılar getirilmiştir.

### SULTAN II. BAYEZİD KİŞİLİĞİ VE HAYATI
- 1447'de Dimetoka'da doğdu. Fatih Sultan Mehmet'in büyük oğlu.
- 7 yaşında Amasya Valisi oldu. 21 Mayıs 1481'de tahta çıktı; 1512'ye kadar 31 yıl saltanat sürdü.
- Kardeşi Cem Sultan ile 14 yıl taht mücadelesi yaşadı.
- Barışçıl bir yönetici olarak tanındı; Yeniçeri Ocağı'nı genişletti, donanmayı güçlendirdi.
- Arapça ve Farsça bilirdi. Bestekârdı, şiir yazardı, hat sanatıyla uğraştı. İslami ilimlerin yanında matematik ve felsefe eğitimi gördü.
- Son yıllarını hayır ve din işlerine adadığı için "Veli" lakabını aldı.
- Oğlu I. Selim'in baskısıyla 1512'de tahtı bıraktı; Dimetoka'ya giderken Havsa'nın Sazlıdere Köyü yakınında vefat etti. Mezarı İstanbul'daki kendi adını taşıyan caminin yanında.
- Külliye kurma kararı: Kili ve Akkirman seferine hazırlanmak için Edirne'ye gelen Sultan'a halkın "şehrin bir hastaneye ihtiyacı var" demesiyle başladı.
### YAHYA BABA (RİVAYET)
Külliyenin imarethanesinde görevli olduğu anlatılan Yahya Baba, halk arasında bereketli pilav hikâyesiyle anılır.
Pilav yaparken dua ettiği ve yemeğin bereketli olduğu rivayet edilir.
Pişirdiği yemeğin hastalara yettiği, hatta arttığı anlatılır.
Artan yemekleri israf etmeyip Tunca Nehri’ndeki balıklara verdiği söylenir.
ERZAKIN AZALMASI (RİVAYET)
Kilercibaşının, verilen pirinç miktarını zamanla azalttığı anlatılır.
Buna rağmen Yahya Baba’nın pişirdiği yemeğin herkese yetmeye devam ettiği rivayet edilir.
Çok az miktarda pirinçle dahi hem hastaların doyduğu hem de balıklara pay ayrıldığı söylenir.
PADİŞAH İLE KARŞILAŞMA (RİVAYET)
Bu durumun II. Bayezid’a kadar ulaştığı anlatılır.
Padişahın olayı yerinde görmek istediği ve Yahya Baba’yı takip ettiği rivayet edilir.
Yahya Baba’nın balıklara yemek verdiği sırada padişahın müdahale ettiği anlatılır.
MENKIBE DETAYI
Anlatıya göre Yahya Baba’nın mahcup olup secdeye kapandığı,
Balıkların dile gelerek kendi rızıklarını savunduğunun söylendiği rivayet edilir.
Bu anlatım tarihî bir kayıt değil, halk arasında aktarılan bir menkıbedir.
YAHYA BABA TÜRBESİ
Külliye çevresinde Yahya Baba’ya atfedilen bir türbe bulunduğu bilinir.
Ziyaretçiler tarafından saygı gösterilen bir ziyaret noktasıdır.
Özellikle cuma günleri yoğunluk olduğu gözlemlenir.

### MÜZİKLE TEDAVİNİN TARİHİ ARKA PLANI
- Müzikle tedavinin bilinen ilk kurumsal örneği: Şam Nureddin Zengi Şifahanesi (1154). Orada akıl hastaları için ayrı bölüm oluşturulmuş ve musiki ile tedavi yapılmıştır.
- Müzikle tedavinin yapıldığı diğer Selçuklu ve Osmanlı darüşşifaları: Kayseri Gevher Nesibe (1206), Sivas Divriği (1228), Amasya (1309), İstanbul Fatih (1470), İstanbul Süleymaniye (1556), Edirne Sultan II. Bayezid (1488).
- Farabi (870-950): Makamların insan ruhu üzerindeki etkilerini sistematik olarak inceleyen ilk İslam bilgini. Rast→neşe, Neva→ferahlık, Uşşak→gülme, Hüseyni→sakinlik, Hicaz→alçakgönüllülük, Buselik→kuvvet, Zirgüle→uyku, Saba→cesaret.
- İbn Sina (980-1037): Müziği tıp eğitiminin bir parçası olarak ele aldı; makamların fizyolojik ve psikolojik etkilerini yazdı.
- Osmanlı'da müzik tedavisi bireysel hekimlik uygulamasından başlayarak kurumsal hastane ortamına taşındı.
- Önemli not: Vakfiyelerde ve masraf defterlerinde müzik tedavisine dair doğrudan kayda rastlanmamıştır; bu bilgiler büyük ölçüde Evliya Çelebi'nin gözlemlerine dayanır.
- Mehterhane de külliye bünyesindeydi; mehter müzisyenlerinin tedavi seanslarına katıldığı düşünülmektedir.
### DARÜŞŞİFA MİMARİSİ
- Dünyada merkezi planlı ilk hastane örneklerinden biri olarak kabul edilir; batıdaki benzerleri 200 yıl sonra yapılmıştır.
- Üç ana bölümden oluşur:
  1. Birinci avlu (dikdörtgen): Poliklinik ve hizmet odaları — 10 mermer sütun üzerine kubbeli revak; 6 oda sağda, 4 oda solda; ayrıca "süt kuyusu" adıyla bilinen bir su kuyusu vardır.
  2. İkinci avlu: İdari odalar (4 oda) — hekimbaşı ve diğer görevlilerin odaları.
  3. Yataklı tedavi (Şifahane) bölümü: Merkezi büyük kubbe + 12 küçük kubbe. Altıgen planlı. 6 kışlık oda (4,35x4,35 m), 4 yazlık oda (açık kemerli). Ortada 12 köşeli fıskiyeli havuz.
- Müzik sahnesi: Giriş kapısının tam karşısında, dışa çıkık yarım kubbeli açık bölüm — müzisyenlerin burada oturduğu düşünülür. (Bazı araştırmacılar mescit olduğunu öne sürmüş ancak bu görüş pek kabul görmemiştir.)
- Akustik: Mimar Hayreddin müzik tedavisini düşünerek binanın akustiğini bilinçli olarak planlamıştır.
- Şadırvan: Merkez kubbenin tam altında, 12 köşeli, fıskiyeli. Evliya kaydı: "Kimisi havuz ve şadırvanlara bakıp kalender hülyası kabilinden sözler eder."
- Havalandırma: Kubbe üzerindeki fener + kışlık odalardaki bacalar ile çözülmüştür. 18-19. yy Batı hastaneleri benzer sisteme ancak sonra ulaşmıştır.
- Kitabesi: Günümüze ulaşan bir kitabesi yoktur. Prof. Süheyl Ünver, Topkapı Arşivi'nde 2580 sayılı belgenin taslak kitabe olabileceğini belirtmiştir: "Kanun sığınağı Şah Bayezid Han, Alamın def'i için bir ev yaptı."
- Müzik sahnesi konusunda not: Bazı araştırmacılar bu bölümün mescit olduğunu öne sürmüş ancak bu görüş pek kabul görmemiştir.
- Kitabesi: Günümüze ulaşan bir kitabesi yoktur. Prof. Süheyl Ünver, Topkapı Arşivi'nde 2580 sayılı belgenin taslak kitabe olabileceğini belirtmiştir: "Kanun sığınağı Şah Bayezid Han, Alamın def'i için bir ev yaptı."
- L.Ch. Sturm'un 1720 tarihli merkezi hastane projesindeki havalandırma feneri, Edirne Darüşşifası'na çok benzer.

### DARÜŞŞİFA — PERSONEL (KURULUŞ YILLARI, VAKFİYE'YE GÖRE)
- 3 tabip (hekim): Biri baştabip (günlük 30 akçe), diğerleri 10'ar akçe
- 2 kehhal (göz doktoru): 7'şer akçe
- 2 cerrah
- 1 kâtip: 4 akçe
- 4 hizmetkar (hastabakıcı): 3'er akçe — "hastalara güler yüzle ve iyilikle hizmet edecekler"
- 1 eczacı (şurup pişiren, ilaç döven): 6 akçe
- 1 vekilharç (satın alma görevlisi): 4 akçe — "otların iyisini kötüsünden ayırt edecek"
- 1 kilerdar: 4 akçe
- 2 aşçı: 3'er akçe — "hekimin emrettiği şekilde pişirecek"
- 1 ferraş (yatakları yapan), 1 gassal (ölü yıkayan), 1 bevvap (kapıcı), 1 hadim (buhurdancı): 3'er akçe
- Toplam kuruluşta ~21 personel; günlük 126 akçe maaş + 200 akçe ilaç/erzak ödeneği
- 1617 defterine göre personel 27'ye, maaş 142 akçeye yükselmiştir.
- Kuruluşta 30 yataklıydı (vakfiyede: "30 döşek, 30 yorgan, 64 yastık").
- Hizmetkârlar için vakfiye notu: "hastalara güler yüzle ve iyilikle hizmet edecekler"
- Vekilharç için vakfiye notu: "otların iyisini kötüsünden ayırt edecek"
- Aşçılar için vakfiye notu: "hekimin emrettiği şekilde pişirecek"
### DARÜŞŞİFA — MÜZİK TEDAVİSİ (EVLİYA ÇELEBİ'NİN GÖZLEM VE KAYITLARI, 1652)
- Evliya'nın Seyahatnâme kaydı: Vakfiye şartına göre 10 kişilik hanende ve sazende grubu:
  3 hanende, 1 neyzen, 1 kemancı, 1 musikarcı, 1 santurcu, 1 çengi, 1 çeng-santurcu, 1 udcu
- Haftada 3 kez müzik faslı — hem akıl hastalarına hem diğer hastalara
- Evliya'nın kendi ifadesiyle: "Doğrusu musiki ilminde neva, rast, dügah, segah, çargah, suzinak makamları onlara mahsustur. Ama zengule makamı ile buselik makamında rast karar kılsa insana hayat verir. Bütün saz ve makamlarda ruha gıda vardır."
- Çalınan makamlar: neva, rast, dügâh, segâh, çargâh, suzinak, zengule, buselik
- Farabi'ye göre makamların etkileri: Rast→neşe, Neva→ferahlık, Uşşak→gülme, Hüseyni→sakinlik, Hicaz→alçakgönüllülük, Buselik→kuvvet, Zirgüle→uyku, Saba→cesaret
- Müzikle tedavi sadece akıl hastalarına değil, fiziksel hastalara da uygulanırdı.
- Mehterhane de külliye bünyesindeydi; mehter müzisyenlerinin de tedavi seanslarına katıldığı düşünülmektedir.
- Not: Vakfiyelerde ve masraf defterlerinde müzik tedavisine dair doğrudan kayda rastlanmamıştır; bu bilgiler büyük ölçüde Evliya Çelebi'nin gözlemlerine dayanır.

### KOKU VE DİĞER TEDAVİ YÖNTEMLERİ (EVLİYA'NIN KAYDI)
- Evliya'nın yazdığı bahar mevsimi koku tedavisi çiçekleri: sim ve zerrin, deveboynu, müşkü rumi, yasemin, gülnesrin, şebboy, karanfil, reyhan, lale, sümbül
- Mutfakta hekimin önerisiyle hastalığa göre yemek pişirilirdi.
- Evliya'nın mutfak kaydı: "Gece ve gündüz üç kere... kekik, turaç, sülün, güvercin, üveyik, kaz, ördek ve bülbüle varıncaya kadar bütün kuşları avcılar mütevelliye getirip hekimlerin isteğine göre pişirerek hastalara verirler."
- 1490 muhasebe kaydında şuruphane malzemeleri arasında: nebat şekeri, bal, gül suyu, raziyane suyu, kafur, hindistan cevizi, nar, limon suyu, defne yağı, badem yağı sayılır.

### DARÜŞŞİFADA GÖREV YAPMIŞ HEKIMLER
- Hekim Hasan bin Kasım: İlk hekimlerden; 1492'de birinci tabip.
- Ahi Çelebi (Muhammed İbni Kemal): II. Bayezid ve I. Selim'in özel hekimi; burada da baştabiplik yaptı.
- Şifai (asıl adı Abdülbaki): 1644'te baştabip oldu; 1665'te Edirne'de vefat etti.
- Destari: Baştabipken 1624'te vefat etti.
- Sinan Efendi: Buradan Fatih Darüşşifası'na atandı; sonra Yavuz'un özel hekimi oldu.
- Atai (Hekim Sinanoğlu): II. Selim devrinde ikinci tabipken vefat etti.

### TIB MEDRESESİ
- Darüşşifanın hemen bitişiğinde; hem teorik hem pratik tıp eğitimi verilirdi.
- Osmanlı eğitim sisteminde en üst düzey "60 üzeri" medreselerden sayılırdı.
- Öğrenciler teorik eğitimlerini yanı başındaki darüşşifada pratiğe dökerdi.
- Hekim-şairler yetiştirdi (Nasuhi, Atai, Fani, Cerrah Safari vb.).

### KÜLLİYEDE DİĞER YAPILAR
- Tabhane (misafirhane): Caminin iki yanında, dokuzar kubbeli iki blok. "Güç ve kuvvet bulma evi" anlamına gelir. Uzak yoldan gelen yolcular ve hastane yakınları ücretsiz yatıp yiyebilirdi (en fazla 3 gün). Taburcu olan hastalar nekahet dönemini burada geçirirdi. 30 yatak kapasiteliydi.
- İmaret (aşevi): Caminin solunda, iki büyük taş blok. İçinde mutfak, aşevi, fodlahane (ekmekçi), mumhane, helvahane, kiler, depo, ahır bölümleri. Her gün iki öğün pişirilir; külliye personeli ve fakir fukara ücretsiz yerdi.
- İmaret içindeki bölümler: mutfak, aşevi, fodlahane (ekmekçi), mumhane, helvahane, kiler, depo, ahır.
- İmaret personeli (vakfiyeye göre): 1 şeyh, 2 vekilharç, 1 kilerci, 1 ambarcı, 1 aşçıbaşı, 5 aşçı, 6 ekmekçi, 2 kapıcı, 2 bahçıvan ve daha birçok görevli.
- Tabhane notu: "Güç ve kuvvet bulma evi" anlamına gelir. Taburcu olan hastalar nekahet dönemini burada geçirirdi.
- Hamam notu: Kadın ve erkek için ayrı bölümler. Tunca Nehri suyuyla beslenirdi. Vakfiyedeki kayıt: "Hamamın her yılda hasılı 10 bin akçedir."
- İmaret personeli (vakfiyeye göre): 1 şeyh, 2 vekilharç, 1 kilerci, 1 ambarcı, 1 aşçıbaşı, 5 aşçı, 6 ekmekçi, 2 kapıcı, 2 bahçıvan ve daha birçok görevli. 1617 yılında tüm külliyede çalışan sayısı 228 kişiydi; bunlara günde 1018 akçe ödenirdi.
- Hamam: Çifte hamam — kadın ve erkek için ayrı bölümler. Darüşşifa hastalarına da hizmet verdiği düşünülür. Günümüzde yıkılmış; yalnızca eski fotoğraflardan bilinir. Tunca Nehri suyuyla beslenirdi. Vakfiyedeki not: "Hamamın her yılda hasılı 10 bin akçedir."
- Mehterhane: Külliye imaret blokları arasında bir mehterhane bulunduğu kaynaklarda geçer. I. Sultan Ahmet tarafından inşa ettirilmiştir. Darüşşifaya müzisyen sağladığı kuvvetle muhtemeldir.
- Sıbyan mektebi (ilkokul): Külliye bünyesinde olduğu bilinir ancak yeri günümüze ulaşmamıştır.
- Değirmen ve su dolabı: Yıkılmış; yerleri bilinmektedir.

### KÜLLİYENİN CAMİSİ (DETAY)
- 500 m² alan. Osmanlı mimarisinde "tabhaneli cami" tipinin ender örneklerinden.
- Kündekâri ahşap işçiliği ile yapılmış hünkâr mahfili, ilk Türk-İslam örneklerinden sayılır.
- Dışarıdan bakıldığında göze çarpan tek büyük kubbe ve iki zarif minare.
- Oktay Aslanapa: "Tam bir klasik sükûnet hâkimdir."
- Minareler tabhanelerin köşelerinden yükselir.

### DÜNYA HASTANECİLİK TARİHİNDEKİ YERİ
- Rönesans dönemi hastane mimarisinde dönüm noktası sayılan Milano Ospidale Maggiore'den (1457) yalnızca 30 yıl sonra inşa edildi; ama pek çok açıdan onu geçti.
- Terzioğlu: "Edirne Sultan II. Bayezid Hastanesi, Rönesans devrinde ve hatta hastane tarihinde bir eşi daha olmayan mimari bir abidedir."
- Benzer merkezi planlama: Antwerpen Stuivenberg Hastanesi (1855), Philadelphia Presbyterian (1885), Baltimore Johns Hopkins (1876), Liverpool Seaforth Askeri Hastanesi (1884) — hepsi bu yapıdan 400 yıl sonra benzer sisteme ulaştı.
- L.Ch. Sturm'un 1720 tarihli merkezi hastane projesindeki havalandırma feneri, Edirne Darüşşifası'na çok benzer.

### DARÜŞŞİFANIN AKUSTİĞİ VE SU SESİ
- Terzioğlu, darüşşifanın akustik planını çizmiş; binanın müzik tedavisi gözetilerek bilinçli tasarlandığını kanıtlamıştır.
- Orta şadırvandan fıskiyeler aracılığıyla yükselen su sesi, müzikle birlikte tedavi edici bir ortam oluşturuyordu.
- "İnsanları rahatlatmak için sadece musiki değil, bunu tamamlayan bir de su sesi devreye sokulmuştur." (Araştırmacıların genel görüşü)
- 2007'de yapılan araştırma: 100 ziyaretçinin 92'si darüşşifada çalınan müziğin kendilerini olağanüstü rahatlattığını söyledi. Uzunköprü Rehabilitasyon Merkezi'nden getirilen zihinsel engelli bireyler mekândan ayrılmak istemedi.
- Uzunköprü Rehabilitasyon Merkezi'nden getirilen zihinsel engelli bireyler mekândan ayrılmak istemedi. (2007 araştırması)
### VAKFİYE VE GELİR KAYNAKLARI
- Külliyenin masrafları bir vakıf sistemiyle karşılanırdı. Sultan II. Bayezid bu amaçla İstanbul ve Edirne'de çok sayıda dükkân, hamam, köy, arsa vakfetti.
- Edirne'de vakfedilenler: Tunca kenarındaki bahçeler, değirmenler, su dolapları, 164 adet saraç dükkânı, tahıl pazarındaki 9 dükkân, Salhane'deki 35 dükkân ve Şahabettin Paşa Çifte Hamamı.
- Bunların yanı sıra Edirne, Dimetoka, Filibe, Gümülcine ve çevre kasabalara bağlı toplam 88 köy de vakfedildi.
- 1493'te vakıf geliri: 782.930 akçe. 1574'e yükselince 1.552.131 akçeye çıktı — külliyenin büyüklüğünü gösteren çarpıcı bir rakam.
- Külliyenin inşaatı, Basarabya fethinden elde edilen ganimet ile finanse edildi.
- Vakfiye yönetimi: Mütevelli (padişah temsilcisi) günde 50 akçe, nazır günde 10 akçe, kâtip günde 10 akçe alırdı.
- Edirne'de vakfedilenler: Tunca kenarındaki bahçeler, değirmenler, su dolapları, 164 adet saraç dükkânı, tahıl pazarındaki 9 dükkân, Salhane'deki 35 dükkân ve Şahabettin Paşa Çifte Hamamı.
- Edirne, Dimetoka, Filibe, Gümülcine ve çevre kasabalara bağlı toplam 88 köy vakfedildi.
- Vakfiye yönetimi: Mütevelli günde 50 akçe, nazır günde 10 akçe, kâtip günde 10 akçe alırdı.
### TARİHSEL SÜREÇ
- 1488: Hizmete açıldı. Tam teşekküllü hastane — akıl, göz, dahiliye, cerrahi.
- Kuruluşundan 1877-78 Osmanlı-Rus Savaşı'na kadar 389 yıl aralıksız hizmet verdi.
- 17. yüzyıldan sonra giderek yalnızca akıl hastalarına yönelik bir merkeze dönüştü.
- 1877-78 savaşından sonra kötü şartlara düştü; hastalar zincirle bağlanmaya başlandı.
- 1915: Dr. Mazhar Osman, hastaları zincirlerden çözdü. O dönemde yaklaşık 40 hasta vardı (5'i kadın). Pomak bir "güllabici" (su dağıtıcı) ile koğuşları yönetiliyordu.
- 1916 sonrası: Vakıf sisteminin çöküşü ve ilgisizlik nedeniyle tamamen kapandı.
- 1950'ler: Harap halde; bir kısmı hayvan ağılı olarak kullanılıyordu.
- 1964: Vakıflar Genel Müdürlüğü onarım yaptı.
- 1984 (14 Eylül): Trakya Üniversitesi'ne devredildi.
- 1997: Sağlık Müzesi'ne dönüştürüldü. O yıl yalnızca 3.200 ziyaretçi geldi.
- 2004: Avrupa Konseyi Müze Ödülü. Ziyaretçi sayısı 94.672'ye fırladı.
- 2005: 111.273, 2006: 122.691, 2007: 132.825 ziyaretçi.
- Ayrıca kazandığı ödüller: 2005 Dubrovnik "En İyi 2. Sunum", 2006 Edirne "Yılın Başarı Ödülü", 2007 Köln "En İyi Sunum Ödülü".

### SAĞLIK MÜZESİ'NİN BÖLÜM VE ODALARI
- Müze iki ana bölümden oluşur: Darüşşifa (hastane) ve Tıp Medresesi.
- Darüşşifa bölümündeki odalar: Psikiyatri Tarihi Bölümü (müzik ve su sesiyle canlandırılmış), Hekimbaşı Odası, Dr. Rıfat Osman Bey Odası, Ord. Prof. Dr. Süheyl Ünver Odası, Hekimliğin Gelişim Tarihi Odası, Edirne Sarayı Sergisi, Cumhuriyet Öncesi Türk Tıbbı Odası, 15. yy Osmanlı Cerrahisi Odası, Eczacılık ve Şifalı Bitkiler Odası, Külliye Tanıtım Odası, Hastane Mutfağı.
- Tıp Medresesi bölümü (2008'de açıldı): Bekçi Odası, Osmanlı'da Tıp Eğitimi Odası, Öğrenci Odaları, Uygulamalı Eğitim Odaları, Müderris Odası, Türk Deneysel Tıbbı Odası, Dershane. Üç oda "Yaşayan Oda" olarak düzenlenmiş: Musiki Odası, Ebru Odası, Geleneksel El Sanatları Odası.
- Psikiyatri Tarihi Bölümü'nde canlandırılan sahneler: Hasta kabulü, melankolik hasta odası, depresif hasta odası, hekimbaşı-hasta görüşmesi, müzik sahnesi (hanende ve sazendeler), meşguliyetle tedavi odası, epilepsi hastası, eczane ve laboratuvar.
- Süheyl Ünver, müzenin ilk fikir babasıdır; "Ben artık Edirne için yaşıyorum" demiştir.
- Külliye 22.000 m² alana kurulmuştur. 100'den fazla kubbesi vardır.
- Psikiyatri Tarihi Bölümü'nde canlandırılan sahneler: Hasta kabulü, melankolik hasta odası, depresif hasta odası, hekimbaşı-hasta görüşmesi, müzik sahnesi (hanende ve sazendeler), meşguliyetle tedavi odası, epilepsi hastası, eczane ve laboratuvar.
- Tıp Medresesi'nde üç oda "Yaşayan Oda" olarak düzenlenmiş: Musiki Odası, Ebru Odası, Geleneksel El Sanatları Odası.
- Süheyl Ünver, müzenin ilk fikir babasıdır; "Ben artık Edirne için yaşıyorum" demiştir.
### PERSONEL GENEL YAPISI (KÜLLİYENİN TAMAMI)
- 1617 yılındaki kayıtlara göre tüm külliyede 228 kişi çalışıyordu.
- Bunlara günde 1.018 akçe, yılda toplam 397.020 akçe ücret ödeniyordu.
- Yalnızca darüşşifada 21 personel; 1617'de bu sayı 27'ye çıktı.
- Mütevelli (padişah temsilcisi) tüm vakfı denetlerdi.

--- SULTAN II. BAYEZİD KİŞİLİĞİ VE HAYATI ---
- 1447'de Dimetoka'da doğdu. Fatih Sultan Mehmet'in büyük oğlu.
- 7 yaşında Amasya Valisi oldu. 21 Mayıs 1481'de tahta çıktı; 1512'ye kadar 31 yıl saltanat sürdü.
- Kardeşi Cem Sultan ile 14 yıl taht mücadelesi yaşadı.
- Barışçıl bir yönetici olarak tanındı; Yeniçeri Ocağı'nı genişletti, donanmayı güçlendirdi.
- Arapça ve Farsça bilirdi. Bestekârdı, şiir yazardı, hat sanatıyla uğraştı. İslami ilimlerin yanında matematik ve felsefe eğitimi gördü.
- Son yıllarını hayır ve din işlerine adadığı için "Veli" lakabını aldı.
- Oğlu I. Selim'in baskısıyla 1512'de tahtı bıraktı; Dimetoka'ya giderken Havsa'nın Sazlıdere Köyü yakınında vefat etti. Mezarı İstanbul'daki kendi adını taşıyan caminin yanında.
- Külliye kurma kararı: Kili ve Akkirman seferine hazırlanmak için Edirne'ye gelen Sultan'a halkın "şehrin bir hastaneye ihtiyacı var" demesiyle başladı.
--- TARİHSEL SÜREÇ ---
- 1915 notu: Dr. Mazhar Osman'ın kurtardığı dönemde yaklaşık 40 hasta vardı (5'i kadın). Pomak bir "güllabici" (su dağıtıcı) ile koğuşları yönetiliyordu.
- 1916 sonrası: Vakıf sisteminin çöküşü ve ilgisizlik nedeniyle tamamen kapandı.
- 1964: Vakıflar Genel Müdürlüğü onarım yaptı.
- Müze ziyaretçi sayıları: 1997'de 3.200 → 2004'te 94.672 → 2005'te 111.273 → 2006'da 122.691 → 2007'de 132.825
- Kazanılan ödüller: 2004 Avrupa Konseyi Müze Ödülü, 2005 Dubrovnik "En İyi 2. Sunum", 2006 Edirne "Yılın Başarı Ödülü", 2007 Köln "En İyi Sunum Ödülü"
### EVLİYA ÇELEBİ HAKKINDA
- 1611 doğumlu, İstanbul'lu. Seyahatnâme'yi 10 ciltte yazdı; 40 yılı aşan gezi notlarıdır.
- 1652'de Edirne'ye geldi; külliyeyi ve darüşşifayı ayrıntılı inceledi, Seyahatnâme'nin 6. cildine yazdı.
- Kendisi de müzisyendi; dönemin müzik ustası Derviş Ömer Gülşeni'den musiki dersleri aldı. Bu yüzden müzik tedavisini çok iyi anlayıp aktarabildi.
- Evliya, külliyede gördüğü her şeyi — hastaların durumunu, müzisyenleri, makamları, koku tedavisini, mutfağı — bizzat gözlemleyerek yazdı.

---

## CEVAP STİLİ
- 1 paragraf ideal
- Doğrudan konuya gir, tanıtımla başlama
- Her 2-3 cevaptan birinde ziyaretçiyi mekânı keşfe yönlendir
- Bilgi bankanda olmayan bir şey sorulursa: "Bu konuda Seyahatnâme'mde kayıt bulamıyorum" de

## !! YABANCI KELİME YASAĞI — KESİN KURAL !!
Türkçe cevap verirken ASLA İngilizce veya başka yabancı dil kelime kullanma.
Yanlış: "Bu hastanenin akustiği mükemmeldi — really impressive bir yapı."
Doğru: "Bu hastanenin akustiği mükemmeldi — gerçekten etkileyici bir yapı."
Osmanlıca/Arapça kökenli kelimeler (darüşşifa, vakfiye, imaret vb.) kabul edilir — bunlar Türkçenin bir parçası.
Ancak İngilizce, Fransızca, çince, Almanca veya başka modern Batı dili kelimesi ASLA kullanma.

## !! MUTLAK DİL KURALI — HİÇBİR İSTİSNA YOK !!
Kullanıcının mesajı hangi dilde yazılmışsa YALNIZCA o dilde cevap ver.
Türkçe → sadece Türkçe, tek bir İngilizce kelime bile yasak
English → sadece English
Deutsch → sadece Deutsch
Français → sadece Français
Български → sadece Български
Ελληνικά → sadece Ελληνικά
中文 → sadece 中文
فارسی → sadece فارسی
Sistem promptu Türkçe olsa bile — kullanıcı farklı dilde yazdıysa SADECE o dilde cevapla.
İki dil ASLA karıştırılmaz. Evliya Çelebi karakterini koru ama dili değiştirme.`;

let evliyaChatHistory=[];let evliyaThinking=false;

const EVLIYA_GREETING='Merhaba! Ben rehberiniz Evliya Çelebi. Bana Sultan İkinci Bayezid Külliyesi hakkında öğrenmek istediklerinizi sorabilirsiniz.';

function speakEvliyaGreeting(){
  if(!('speechSynthesis' in window))return;
  window.speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(EVLIYA_GREETING);
  u.lang='tr-TR';u.rate=0.88;u.pitch=0.95;
  const voices=window.speechSynthesis.getVoices();
  const match=voices.find(v=>v.lang.startsWith('tr'))||voices.find(v=>v.lang.startsWith('tr-'));
  if(match)u.voice=match;
  window.speechSynthesis.speak(u);
}

function openEvliyaChat(){
  document.getElementById('evliya-chat-panel').classList.add('open');
  document.getElementById('evliya-fab-wrap').classList.add('chat-open');
  const stopAudio=document.getElementById('stop-audio');const introAudio=document.getElementById('intro-audio');
  if(stopAudio&&!stopAudio.paused){stopAudio._wasPlaying=true;stopAudio.pause();}
  if(introAudio&&!introAudio.paused){introAudio._wasPlaying=true;introAudio.pause();}
  if(evliyaChatHistory.length===0){
    addEvliyaMsg('bot','Sultan II. Bayezid Külliyesi\'ne hoş geldiniz! 🌿\n\nBen Evliya Çelebi — bu kadim şifa yurdunun koridorlarında sizinle yürümek için buradayım. 1652\'de burayı bizzat gezdim.\n\nDarüşşifa\'nın müzik tedavisinden Bölüm\  ve odalarına kadar — aklınıza takılan her şeyi sorabilirsiniz. 🏛️');
    // Kısa gecikmeyle sesli selamlama — panel açılış animasyonu bitmesini bekle
    setTimeout(speakEvliyaGreeting, 400);
  }
  // FAB balonu gizle
  const bubble=document.getElementById('fab-info-bubble');
  if(bubble)bubble.classList.remove('show');
}

function closeEvliyaChat(){
  document.getElementById('evliya-chat-panel').classList.remove('open');
  document.getElementById('evliya-fab-wrap').classList.remove('chat-open');
  if('speechSynthesis' in window)window.speechSynthesis.cancel();
  const stopAudio=document.getElementById('stop-audio');const introAudio=document.getElementById('intro-audio');
  if(stopAudio&&stopAudio._wasPlaying){stopAudio.play().catch(()=>{});stopAudio._wasPlaying=false;}
  if(introAudio&&introAudio._wasPlaying){introAudio.play().catch(()=>{});introAudio._wasPlaying=false;}
}

function evliyaQuick(text){document.getElementById('evliya-chat-input').value=text;sendEvliyaMsg();}

function addEvliyaMsg(role,text){
  const container=document.getElementById('evliya-chat-messages');
  const isBot=role==='bot';
  const div=document.createElement('div');div.className='chat-msg '+(isBot?'bot':'user');
  const avatarEl=isBot?`<div class="chat-msg-avatar"><img src="assets/img/evliya.gif" alt="Evliya" onerror="this.style.display='none';this.parentElement.textContent='🎭'"></div>`:`<div class="chat-msg-avatar" style="background:linear-gradient(135deg,#6b1500,#a02010);">👤</div>`;
  div.innerHTML=avatarEl+`<div class="chat-bubble">${text.replace(/\n/g,'<br>')}</div>`;
  container.appendChild(div);container.scrollTop=container.scrollHeight;return div;
}

function addTypingIndicator(){
  const container=document.getElementById('evliya-chat-messages');
  const div=document.createElement('div');div.className='chat-msg bot';div.id='evliya-typing';
  div.innerHTML=`<div class="chat-msg-avatar"><img src="assets/img/evliya.gif" alt="Evliya" onerror="this.style.display='none';this.parentElement.textContent='🎭'"></div><div class="chat-bubble"><div class="chat-typing"><span></span><span></span><span></span></div></div>`;
  container.appendChild(div);container.scrollTop=container.scrollHeight;
}
function removeTypingIndicator(){const el=document.getElementById('evliya-typing');if(el)el.remove();}

async function sendEvliyaMsg(){
  if(evliyaThinking)return;
  const input=document.getElementById('evliya-chat-input');
  const text=input.value.trim();if(!text)return;
  input.value='';input.style.height='auto';
  addEvliyaMsg('user',text);
  evliyaChatHistory.push({role:'user',content:text});
  evliyaThinking=true;document.getElementById('evliya-send-btn').disabled=true;addTypingIndicator();
  try{
    const msgs=[{role:'system',content:EVLIYA_SYSTEM_PROMPT},...evliyaChatHistory.map(m=>({role:m.role==='assistant'?'assistant':m.role,content:m.content}))];
    const response=await fetch('https://silent-dust-f74c.edirnesaglikmuzesi.workers.dev',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'llama-3.3-70b-versatile',messages:msgs,max_tokens:600,temperature:0.85})});
    const data=await response.json();removeTypingIndicator();
    if(data.error){addEvliyaMsg('bot','⚠️ Hata: '+(data.error.message||'Bilinmeyen hata'));}
    else{const reply=data.choices?.[0]?.message?.content||'🕯️ Cevap alınamadı.';evliyaChatHistory.push({role:'assistant',content:reply});if(evliyaChatHistory.length>20)evliyaChatHistory=evliyaChatHistory.slice(-18);addEvliyaMsg('bot',reply);}
  }catch(e){removeTypingIndicator();addEvliyaMsg('bot','🕯️ Bağlantı kurulamadı. Lütfen tekrar deneyin.');console.error(e);}
  evliyaThinking=false;document.getElementById('evliya-send-btn').disabled=false;
}

document.getElementById('evliya-chat-panel').addEventListener('click',function(e){if(e.target===this)closeEvliyaChat();});

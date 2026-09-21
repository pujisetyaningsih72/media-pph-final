/* =========================================================
   MEDIA PEMBELAJARAN INTERAKTIF — PAJAK PENGHASILAN FINAL
   app.js — seluruh logika interaktif halaman
   ========================================================= */

function isSupabaseReady(){
  return typeof SUPABASE_URL === "string" &&
         SUPABASE_URL.startsWith("http") &&
         typeof SUPABASE_ANON_KEY === "string" &&
         SUPABASE_ANON_KEY.length > 10 &&
         !SUPABASE_ANON_KEY.includes("GANTI_DENGAN");
}

/* =========================================================
   1. NAVIGASI ANTAR HALAMAN
   ========================================================= */
(function navigation(){
  const navItems = document.querySelectorAll(".nav-item");
  const pages = document.querySelectorAll(".page");
  const sidebar = document.getElementById("sidebar");
  const menuToggle = document.getElementById("menuToggle");

  function goTo(target){
    pages.forEach(p => p.classList.toggle("active", p.id === target));
    navItems.forEach(n => n.classList.toggle("active", n.dataset.target === target));
    sidebar.classList.remove("open");
    window.scrollTo({top:0, behavior:"smooth"});
  }

  navItems.forEach(btn => btn.addEventListener("click", () => goTo(btn.dataset.target)));
  document.querySelectorAll("[data-goto]").forEach(btn=>{
    btn.addEventListener("click", () => goTo(btn.dataset.goto));
  });
  menuToggle.addEventListener("click", () => sidebar.classList.toggle("open"));
})();

/* =========================================================
   2. TEORI — ACCORDION & CEK PEMAHAMAN
   ========================================================= */
(function teori(){
  document.querySelectorAll(".acc-trigger").forEach(trigger=>{
    trigger.addEventListener("click", () => {
      trigger.parentElement.classList.toggle("open");
    });
  });

  document.querySelectorAll(".qc-item").forEach(item=>{
    const correct = item.dataset.answer;
    const feedback = item.querySelector(".qc-feedback");
    item.querySelectorAll(".qc-options button").forEach(btn=>{
      btn.addEventListener("click", () => {
        if(item.dataset.answered) return;
        item.dataset.answered = "1";
        const isCorrect = btn.dataset.val === correct;
        btn.classList.add(isCorrect ? "correct" : "wrong");
        if(!isCorrect){
          item.querySelector(`[data-val="${correct}"]`).classList.add("correct");
        }
        feedback.textContent = isCorrect ? "Benar sekali! 🎉" : "Kurang tepat, perhatikan jawaban yang benar di atas.";
        feedback.style.color = isCorrect ? "var(--success)" : "var(--danger)";
      });
    });
  });
})();

/* =========================================================
   3. LKPD — SAVE AS PDF & KIRIM KE GURU
   ========================================================= */
(function lkpd(){
  const statusEl = document.getElementById("lkpdStatus");

  function getIdentity(){
    return {
      nama: document.getElementById("lkpdNama").value.trim(),
      kelas: document.getElementById("lkpdKelas").value.trim()
    };
  }

  function collectActivity(el){
    const data = {};
    el.querySelectorAll("input[type=text], select, textarea").forEach((field, idx) => {
      const label = field.closest("td") ? field.closest("tr").children[0].textContent.trim()
                    : (field.closest(".field") ? field.closest(".field").querySelector("label")?.textContent.trim() : null);
      data[label || `item_${idx}`] = field.value;
    });
    return data;
  }

  // ---- SIMPAN SEBAGAI PDF ----
  document.getElementById("btnSavePdf").addEventListener("click", async () => {
    const { nama, kelas } = getIdentity();
    if(!nama || !kelas){
      statusEl.textContent = "Isi nama dan kelas terlebih dahulu sebelum menyimpan PDF.";
      statusEl.className = "form-status err";
      return;
    }
    statusEl.textContent = "Sedang menyiapkan file PDF...";
    statusEl.className = "form-status";

    const area = document.getElementById("lkpdPrintArea");
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "pt", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    try{
      const canvas = await html2canvas(area, { scale: 2, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");
      const imgWidth = pageWidth - 40;
      const imgHeight = canvas.height * (imgWidth / canvas.width);
      let heightLeft = imgHeight;
      let position = 20;

      pdf.setFontSize(14);
      pdf.text(`LKPD - Pajak Penghasilan Final`, 20, 30);
      pdf.setFontSize(10);
      pdf.text(`Nama: ${nama}   Kelas: ${kelas}`, 20, 46);
      position = 56;

      pdf.addImage(imgData, "PNG", 20, position, imgWidth, imgHeight);
      heightLeft -= (pageHeight - position - 20);

      while(heightLeft > 0){
        pdf.addPage();
        position = heightLeft - imgHeight + 20;
        pdf.addImage(imgData, "PNG", 20, position, imgWidth, imgHeight);
        heightLeft -= (pageHeight - 40);
      }

      pdf.save(`LKPD_${nama.replace(/\s+/g,"_")}_${kelas.replace(/\s+/g,"_")}.pdf`);
      statusEl.textContent = "PDF berhasil diunduh.";
      statusEl.className = "form-status ok";
    }catch(err){
      console.error(err);
      statusEl.textContent = "Gagal membuat PDF. Coba lagi.";
      statusEl.className = "form-status err";
    }
  });

  // ---- KIRIM KE GURU ----
  document.getElementById("btnKirimLkpd").addEventListener("click", async () => {
    const { nama, kelas } = getIdentity();
    if(!nama || !kelas){
      statusEl.textContent = "Isi nama dan kelas terlebih dahulu sebelum mengirim.";
      statusEl.className = "form-status err";
      return;
    }

    const activities = document.querySelectorAll(".lkpd-activity");
    const btn = document.getElementById("btnKirimLkpd");
    btn.disabled = true;
    statusEl.textContent = "Mengirim tugas...";
    statusEl.className = "form-status";

    if(!isSupabaseReady()){
      statusEl.textContent = "Supabase belum dikonfigurasi (lihat config.js). Tugas belum benar-benar terkirim.";
      statusEl.className = "form-status err";
      btn.disabled = false;
      return;
    }

    try{
      const rows = Array.from(activities).map(el => ({
        nama_siswa: nama,
        kelas: kelas,
        aktivitas: el.dataset.activity,
        jawaban: collectActivity(el)
      }));
      const { error } = await supabaseClient.from("lkpd_submissions").insert(rows);
      if(error) throw error;
      statusEl.textContent = "Tugas berhasil dikirim ke guru. Terima kasih!";
      statusEl.className = "form-status ok";
    }catch(err){
      console.error(err);
      statusEl.textContent = "Gagal mengirim tugas. Periksa koneksi internet dan coba lagi.";
      statusEl.className = "form-status err";
    }finally{
      btn.disabled = false;
    }
  });
})();

/* =========================================================
   4A. QUIZ — DRAG & DROP
   ========================================================= */
(function dragDropQuiz(){
  const ITEMS = [
    { name: "Bunga Deposito", group: "PPh Final" },
    { name: "Sewa Tanah dan Bangunan", group: "PPh Final" },
    { name: "Hadiah Undian", group: "PPh Final" },
    { name: "Pengalihan Hak Tanah/Bangunan", group: "PPh Final" },
    { name: "Gaji Karyawan Tetap", group: "PPh Tidak Final" },
    { name: "Jasa Konsultan", group: "PPh Tidak Final" },
    { name: "Sewa Kendaraan", group: "PPh Tidak Final" },
    { name: "Royalti", group: "PPh Tidak Final" },
  ];

  const pool = document.getElementById("ddPool");
  const zones = document.querySelectorAll(".dd-dropzone");
  const scoreEl = document.getElementById("ddScore");
  let score = 0;
  let dragged = null;

  function shuffle(arr){ return [...arr].sort(() => Math.random() - 0.5); }

  function render(){
    score = 0;
    scoreEl.textContent = `Skor: 0 / ${ITEMS.length}`;
    pool.innerHTML = "";
    zones.forEach(z => z.innerHTML = "");
    shuffle(ITEMS).forEach((item, i) => {
      const card = document.createElement("div");
      card.className = "dd-card";
      card.textContent = item.name;
      card.draggable = true;
      card.dataset.group = item.group;
      card.dataset.id = "card-" + i;
      card.addEventListener("dragstart", (e) => {
        dragged = card;
        e.dataTransfer.setData("text/plain", card.dataset.id);
      });
      pool.appendChild(card);
    });
  }

  zones.forEach(zone => {
    zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("drag-over"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("drag-over");
      if(!dragged || dragged.classList.contains("placed-correct") || dragged.classList.contains("placed-wrong")) return;

      const isCorrect = dragged.dataset.group === zone.dataset.group;
      dragged.classList.add(isCorrect ? "placed-correct" : "placed-wrong");
      dragged.draggable = false;
      zone.appendChild(dragged);
      if(isCorrect) score++;
      scoreEl.textContent = `Skor: ${score} / ${ITEMS.length}`;
      dragged = null;
    });
  });

  document.getElementById("ddReset").addEventListener("click", render);
  render();
})();

/* =========================================================
   4B. QUIZ — CARI KATA (WORD SEARCH)
   ========================================================= */
(function wordSearchQuiz(){
  const SIZE = 10;
  const WORDS = ["FINAL","DEPOSITO","BUNGA","UNDIAN","OBLIGASI","TARIF","KONSTRUKSI","DIVIDEN"];
  const grid = document.getElementById("wsGrid");
  const wordListEl = document.getElementById("wsWordList");
  const scoreEl = document.getElementById("wsScore");
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  let cells = [];
  let foundCount = 0;
  let selecting = false;
  let selection = [];

  const DIRS = [
    {dr:0, dc:1}, {dr:1, dc:0}, {dr:1, dc:1}, {dr:-1, dc:1}
  ];

  function buildGrid(){
    let letters = Array.from({length:SIZE}, () => Array(SIZE).fill(null));
    const placements = [];

    for(const word of WORDS){
      let placed = false;
      let attempts = 0;
      while(!placed && attempts < 200){
        attempts++;
        const dir = DIRS[Math.floor(Math.random()*DIRS.length)];
        const row = Math.floor(Math.random()*SIZE);
        const col = Math.floor(Math.random()*SIZE);
        const endRow = row + dir.dr*(word.length-1);
        const endCol = col + dir.dc*(word.length-1);
        if(endRow < 0 || endRow >= SIZE || endCol < 0 || endCol >= SIZE) continue;

        let ok = true;
        for(let i=0;i<word.length;i++){
          const r = row + dir.dr*i, c = col + dir.dc*i;
          if(letters[r][c] !== null && letters[r][c] !== word[i]){ ok = false; break; }
        }
        if(!ok) continue;

        for(let i=0;i<word.length;i++){
          const r = row + dir.dr*i, c = col + dir.dc*i;
          letters[r][c] = word[i];
        }
        placements.push({word, row, col, dir});
        placed = true;
      }
    }

    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){
      if(!letters[r][c]) letters[r][c] = ALPHABET[Math.floor(Math.random()*ALPHABET.length)];
    }
    return { letters, placements };
  }

  function renderGrid(){
    foundCount = 0;
    selection = [];
    scoreEl.textContent = `Ditemukan: 0 / ${WORDS.length}`;
    const { letters, placements } = buildGrid();
    window.__wsPlacements = placements;
    grid.innerHTML = "";
    cells = [];
    for(let r=0;r<SIZE;r++){
      for(let c=0;c<SIZE;c++){
        const cell = document.createElement("div");
        cell.className = "ws-cell";
        cell.textContent = letters[r][c];
        cell.dataset.r = r; cell.dataset.c = c;
        grid.appendChild(cell);
        cells.push(cell);
      }
    }
    wordListEl.innerHTML = "";
    WORDS.forEach(w => {
      const li = document.createElement("li");
      li.textContent = w;
      li.dataset.word = w;
      wordListEl.appendChild(li);
    });

    attachEvents();
  }

  function cellAt(r,c){ return cells.find(cl => +cl.dataset.r === r && +cl.dataset.c === c); }

  function clearSelectionStyle(){
    cells.forEach(cl => { if(!cl.classList.contains("found")) cl.classList.remove("selected"); });
  }

  function getLineCells(start, end){
    const r1=+start.dataset.r, c1=+start.dataset.c, r2=+end.dataset.r, c2=+end.dataset.c;
    const dr = Math.sign(r2-r1), dc = Math.sign(c2-c1);
    if(r1!==r2 && c1!==c2 && Math.abs(r2-r1)!==Math.abs(c2-c1)) return [start];
    const line = [];
    let r=r1,c=c1;
    while(true){
      const cl = cellAt(r,c);
      if(cl) line.push(cl);
      if(r===r2 && c===c2) break;
      r+=dr; c+=dc;
      if(line.length > SIZE) break;
    }
    return line;
  }

  function checkSelection(){
    const text = selection.map(c=>c.textContent).join("");
    const reversed = text.split("").reverse().join("");
    const match = WORDS.find(w => (w===text || w===reversed));
    if(match){
      const li = wordListEl.querySelector(`li[data-word="${match}"]`);
      if(li && !li.classList.contains("done")){
        li.classList.add("done");
        selection.forEach(c => { c.classList.add("found"); c.classList.remove("selected"); });
        foundCount++;
        scoreEl.textContent = `Ditemukan: ${foundCount} / ${WORDS.length}`;
      }
    }
  }

  function attachEvents(){
    let startCell = null;
    cells.forEach(cell => {
      cell.addEventListener("mousedown", () => {
        selecting = true; startCell = cell; clearSelectionStyle();
        selection = [cell]; cell.classList.add("selected");
      });
      cell.addEventListener("mouseenter", () => {
        if(!selecting || !startCell) return;
        clearSelectionStyle();
        selection = getLineCells(startCell, cell);
        selection.forEach(c => c.classList.add("selected"));
      });
      cell.addEventListener("touchstart", (e) => {
        selecting = true; startCell = cell; clearSelectionStyle();
        selection = [cell]; cell.classList.add("selected");
      }, {passive:true});
    });
    document.addEventListener("mouseup", () => {
      if(selecting){ checkSelection(); selecting = false; clearSelectionStyle(); }
    });
    grid.addEventListener("touchmove", (e) => {
      if(!selecting) return;
      const touch = e.touches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      if(el && el.classList.contains("ws-cell")){
        clearSelectionStyle();
        selection = getLineCells(startCell, el);
        selection.forEach(c => c.classList.add("selected"));
      }
    });
    grid.addEventListener("touchend", () => {
      if(selecting){ checkSelection(); selecting = false; clearSelectionStyle(); }
    });
  }

  document.getElementById("wsReset").addEventListener("click", renderGrid);
  renderGrid();

  // Tab switching for quiz
  document.querySelectorAll(".quiz-tab").forEach(tab=>{
    tab.addEventListener("click", () => {
      document.querySelectorAll(".quiz-tab").forEach(t=>t.classList.remove("active"));
      document.querySelectorAll(".quiz-panel").forEach(p=>p.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById("quiz-" + tab.dataset.quiz).classList.add("active");
    });
  });
})();

/* =========================================================
   5. EVALUASI
   ========================================================= */
(function evaluasi(){
  const MC_QUESTIONS = [
    { q: "Ciri utama yang membedakan PPh Final dari PPh Tidak Final adalah...",
      options: ["PPh Final hanya dikenakan pada badan usaha","PPh Final tidak dapat dikreditkan/diperhitungkan kembali dalam SPT Tahunan","PPh Final tarifnya selalu lebih tinggi","PPh Final hanya berlaku untuk UMKM","PPh Final tidak perlu dilaporkan"], correct: 1 },
    { q: "Bu Sari menerima penghasilan sewa ruko sebesar Rp80.000.000 per tahun. Tarif PPh Final atas sewa tanah dan/atau bangunan adalah 10%. Besarnya PPh Final yang harus dipotong/disetor adalah...",
      options: ["Rp800.000","Rp8.000.000","Rp80.000","Rp4.000.000","Rp16.000.000"], correct: 1 },
    { q: "Pak Andi memiliki usaha kecil dengan omzet Rp15.000.000 per bulan dan memenuhi syarat sebagai WP UMKM sesuai PP 23 Tahun 2018. Tarif PPh Final yang berlaku untuknya adalah...",
      options: ["0,5%","1%","2%","5%","10%"], correct: 0 },
    { q: "Penghasilan berikut ini yang termasuk objek PPh Final Pasal 4 ayat (2) adalah...",
      options: ["Gaji bulanan karyawan tetap","Honorarium narasumber seminar","Bunga deposito bank","Jasa konsultan pajak","Royalti hak cipta"], correct: 2 },
    { q: "Alasan pemerintah menetapkan skema PPh Final untuk jenis penghasilan tertentu (seperti bunga deposito) adalah...",
      options: ["Untuk mempersulit administrasi pajak","Untuk menyederhanakan administrasi dan memberi kepastian hukum atas objek yang sulit ditelusuri sumber biayanya","Karena penghasilan tersebut tidak dikenakan pajak sama sekali","Agar wajib pajak bisa memilih tarif sendiri","Karena hanya berlaku untuk WP luar negeri"], correct: 1 },
    { q: "CV Makmur Jaya, perusahaan jasa konstruksi kualifikasi usaha kecil, mengerjakan proyek senilai Rp200.000.000. Jika tarif PPh Final jasa konstruksi untuk kualifikasi tersebut 1,75%, maka PPh Final yang terutang adalah...",
      options: ["Rp3.500.000","Rp350.000","Rp35.000.000","Rp1.750.000","Rp17.500.000"], correct: 0 },
    { q: "Seorang nasabah menerima hadiah undian dari bank sebesar Rp50.000.000. Jika tarif PPh Final atas hadiah undian adalah 25%, maka PPh Final yang dipotong adalah...",
      options: ["Rp5.000.000","Rp12.500.000","Rp10.000.000","Rp1.250.000","Rp25.000.000"], correct: 1 },
    { q: "Dalam pencatatan akuntansi, saat perusahaan menerima penghasilan sewa yang telah dipotong PPh Final oleh penyewa, PPh Final tersebut dicatat sebagai...",
      options: ["Piutang pajak yang dapat ditagih kembali","Beban pajak final (tidak dapat dikreditkan sebagai kredit pajak)","Uang muka PPh Pasal 25","Pendapatan lain-lain","Kewajiban pajak tangguhan"], correct: 1 },
    { q: "Manakah pernyataan yang BENAR mengenai pelaporan PPh Final dalam SPT Tahunan?",
      options: ["Penghasilan yang dikenakan PPh Final tidak digabungkan dengan penghasilan lain untuk dihitung PPh terutangnya, tetapi tetap dilaporkan","Penghasilan PPh Final tidak perlu dilaporkan sama sekali","PPh Final dapat dikreditkan penuh terhadap PPh terutang tahunan","PPh Final hanya dilaporkan jika jumlahnya di atas Rp100 juta","Penghasilan PPh Final digabung dan dikreditkan seperti PPh Pasal 21"], correct: 0 },
    { q: "Sebuah lembaga keuangan ingin menentukan skema pemotongan pajak yang tepat atas transaksi penjualan saham di bursa efek oleh nasabahnya. Skema yang tepat adalah...",
      options: ["PPh Pasal 21 dengan tarif progresif","PPh Final dengan tarif 0,1% dari nilai transaksi penjualan","PPh Pasal 23 dengan tarif 15%","Tidak dikenakan pajak karena termasuk objek dikecualikan","PPh Pasal 22 dengan tarif 2,5%"], correct: 1 },
  ];

  const PGK_QUESTIONS = [
    { q: "Berikut ini yang termasuk objek PPh Final adalah... (centang semua yang benar)",
      options: ["Bunga deposito","Gaji karyawan tetap","Sewa tanah dan bangunan","Jasa konsultan pajak","Hadiah undian"], correct: [0,2,4] },
    { q: "Pernyataan berikut yang BENAR mengenai PPh Final adalah... (centang semua yang benar)",
      options: ["Tarifnya bersifat tetap/final atas dasar pengenaan tertentu","Dapat dikreditkan penuh dalam SPT Tahunan","Umumnya dipotong oleh pihak pemberi penghasilan (pemotong pajak)","Tetap wajib dilaporkan dalam SPT meski tidak digabung","Hanya berlaku untuk wajib pajak orang pribadi"], correct: [0,2,3] },
    { q: "Berikut ini yang termasuk karakteristik skema PPh Final PP 23 Tahun 2018 (UMKM) adalah... (centang semua yang benar)",
      options: ["Tarif 0,5% dari peredaran bruto","Berlaku untuk WP dengan peredaran bruto tertentu","Berlaku tanpa batas waktu selamanya","Dihitung dari omzet, bukan dari laba bersih","Bertujuan menyederhanakan kewajiban pajak UMKM"], correct: [0,1,3,4] },
    { q: "Manakah yang termasuk contoh objek PPh Final Pasal 4 ayat (2)? (centang semua yang benar)",
      options: ["Bunga/diskonto obligasi","Gaji pegawai swasta","Pengalihan hak atas tanah dan bangunan","Jasa konstruksi","Penjualan barang dagangan secara kredit"], correct: [0,2,3] },
    { q: "Seorang akuntan menyusun laporan keuangan perusahaan yang memiliki penghasilan sewa gedung. Hal-hal berikut perlu ia perhatikan terkait PPh Final atas sewa tersebut... (centang semua yang benar)",
      options: ["PPh Final dihitung dari jumlah bruto nilai sewa","PPh Final atas sewa dicatat sebagai beban pajak, bukan piutang pajak","PPh Final dapat digunakan sebagai kredit pajak di akhir tahun","Bukti potong PPh Final perlu disimpan sebagai dokumen pendukung","Tarif PPh Final sewa tanah/bangunan bersifat sama untuk semua jenis penyewa"], correct: [0,1,3,4] },
  ];

  const ESSAY_QUESTIONS = [
    "Jelaskan apa yang dimaksud dengan PPh Final dan bagaimana perbedaannya dengan PPh Tidak Final (PPh yang dapat dikreditkan)!",
    "Sebutkan minimal tiga contoh penghasilan yang dikenakan PPh Final beserta tarifnya masing-masing!",
    "Sebuah usaha kecil (UMKM) memiliki omzet Rp25.000.000 pada bulan Juli 2026 dan memenuhi syarat PP 23 Tahun 2018. Hitunglah besarnya PPh Final yang harus disetor bulan tersebut, lengkap dengan cara perhitungannya!",
    "Jelaskan bagaimana perlakuan akuntansi (pencatatan) atas PPh Final yang dipotong oleh pihak lain dari penghasilan yang diterima perusahaan!",
    "Menurut pendapatmu, apa manfaat dan kelemahan penerapan skema PPh Final bagi Wajib Pajak, khususnya pelaku UMKM? Jelaskan alasanmu!"
  ];

  const evalStart = document.getElementById("evalStart");
  const modal = document.getElementById("modalPetunjuk");
  const evalForm = document.getElementById("evalForm");
  const evalResult = document.getElementById("evalResult");
  const questionsWrap = document.getElementById("evalQuestions");
  const checkStatus = document.getElementById("evalCheckStatus");

  function renderQuestions(){
    let html = "";
    MC_QUESTIONS.forEach((item, i) => {
      html += `<div class="eval-q">
        <div class="eval-q-head"><span class="eval-q-num">${i+1}</span><span>${item.q} <span class="eval-tag">Pilihan Ganda</span></span></div>
        <div class="eval-options">
          ${item.options.map((opt, oi) => `
            <label><input type="radio" name="mc${i}" value="${oi}" required> ${String.fromCharCode(65+oi)}. ${opt}</label>
          `).join("")}
        </div>
      </div>`;
    });
    PGK_QUESTIONS.forEach((item, i) => {
      html += `<div class="eval-q">
        <div class="eval-q-head"><span class="eval-q-num">${MC_QUESTIONS.length + i + 1}</span><span>${item.q} <span class="eval-tag">Pilihan Ganda Kompleks</span></span></div>
        <div class="eval-options">
          ${item.options.map((opt, oi) => `
            <label><input type="checkbox" name="pgk${i}" value="${oi}"> ${String.fromCharCode(65+oi)}. ${opt}</label>
          `).join("")}
        </div>
      </div>`;
    });
    ESSAY_QUESTIONS.forEach((q, i) => {
      html += `<div class="eval-q">
        <div class="eval-q-head"><span class="eval-q-num">${MC_QUESTIONS.length + PGK_QUESTIONS.length + i + 1}</span><span>${q} <span class="eval-tag">Esai</span></span></div>
        <textarea name="essay${i}" rows="4" required placeholder="Tulis jawabanmu di sini..."></textarea>
      </div>`;
    });
    questionsWrap.innerHTML = html;
  }

  async function alreadySubmitted(nama, kelas){
    if(!isSupabaseReady()) return false;
    try{
      const { data, error } = await supabaseClient
        .from("evaluasi_hasil")
        .select("id")
        .eq("nama_siswa", nama)
        .eq("kelas", kelas)
        .maybeSingle();
      if(error) throw error;
      return !!data;
    }catch(err){
      console.error(err);
      return false;
    }
  }

  document.getElementById("btnBukaPetunjuk").addEventListener("click", async () => {
    const nama = document.getElementById("evalNama").value.trim();
    const kelas = document.getElementById("evalKelas").value.trim();
    if(!nama || !kelas){
      checkStatus.textContent = "Isi nama dan kelas terlebih dahulu.";
      checkStatus.className = "form-status err";
      return;
    }
    const localKey = `eval_done_${nama}_${kelas}`.toLowerCase().replace(/\s+/g,"_");
    if(localStorage.getItem(localKey)){
      checkStatus.textContent = "Kamu sudah pernah mengerjakan evaluasi ini di perangkat ini.";
      checkStatus.className = "form-status err";
      return;
    }
    checkStatus.textContent = "Memeriksa data...";
    checkStatus.className = "form-status";
    const done = await alreadySubmitted(nama, kelas);
    if(done){
      checkStatus.textContent = "Kamu sudah pernah mengerjakan evaluasi ini sebelumnya.";
      checkStatus.className = "form-status err";
      return;
    }
    checkStatus.textContent = "";
    modal.classList.add("show");
  });

  document.getElementById("btnMulaiSoal").addEventListener("click", () => {
    modal.classList.remove("show");
    evalStart.style.display = "none";
    renderQuestions();
    evalForm.classList.add("active");
    window.scrollTo({top:0, behavior:"smooth"});
  });

  evalForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById("btnSubmitEval");
    submitBtn.disabled = true;
    submitBtn.textContent = "Mengirim...";

    const nama = document.getElementById("evalNama").value.trim();
    const kelas = document.getElementById("evalKelas").value.trim();
    const formData = new FormData(evalForm);

    const jawabanPG = {};
    let benar = 0;
    MC_QUESTIONS.forEach((item, i) => {
      const val = formData.get(`mc${i}`);
      jawabanPG[i+1] = val !== null ? String.fromCharCode(65+parseInt(val)) : null;
      if(val !== null && parseInt(val) === item.correct) benar++;
    });

    const jawabanPGK = {};
    PGK_QUESTIONS.forEach((item, i) => {
      const selected = formData.getAll(`pgk${i}`).map(v => parseInt(v)).sort((a,b)=>a-b);
      const correctSorted = [...item.correct].sort((a,b)=>a-b);
      const isFullyCorrect = selected.length === correctSorted.length &&
                              selected.every((v, idx) => v === correctSorted[idx]);
      jawabanPGK[MC_QUESTIONS.length + i + 1] = selected.map(v => String.fromCharCode(65+v));
      if(isFullyCorrect) benar++;
    });

    const totalObjektif = MC_QUESTIONS.length + PGK_QUESTIONS.length;

    const jawabanEssai = {};
    ESSAY_QUESTIONS.forEach((q, i) => {
      jawabanEssai[MC_QUESTIONS.length + PGK_QUESTIONS.length + i + 1] = formData.get(`essay${i}`);
    });

    const skor = Math.round((benar / totalObjektif) * 100);

    try{
      if(isSupabaseReady()){
        const { error } = await supabaseClient.from("evaluasi_hasil").insert([{
          nama_siswa: nama,
          kelas: kelas,
          jawaban_pilihan_ganda: jawabanPG,
          jawaban_pgk: jawabanPGK,
          jawaban_essai: jawabanEssai,
          skor_pilihan_ganda: skor,
          jumlah_benar: benar
        }]);
        if(error && error.code !== "23505") throw error; // 23505 = duplikat, tetap kunci di sisi lokal
      }
      const localKey = `eval_done_${nama}_${kelas}`.toLowerCase().replace(/\s+/g,"_");
      localStorage.setItem(localKey, "1");

      evalForm.classList.remove("active");
      evalResult.style.display = "block";
      document.getElementById("scoreNum").textContent = skor;
      document.getElementById("scoreDetail").textContent = `Kamu menjawab benar ${benar} dari ${totalObjektif} soal objektif (pilihan ganda + pilihan ganda kompleks).`;
      window.scrollTo({top:0, behavior:"smooth"});
    }catch(err){
      console.error(err);
      alert("Terjadi kendala saat mengirim hasil evaluasi. Periksa koneksi internet dan coba tekan tombol sekali lagi.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Selesai & Lihat Skor";
    }
  });
})();

/* =========================================================
   6. DAFTAR NILAI (REKAP SKOR EVALUASI)
   ========================================================= */
(function daftarNilai(){
  const tbody = document.getElementById("nilaiTableBody");
  const statusEl = document.getElementById("nilaiStatus");
  const filterKelas = document.getElementById("nilaiFilterKelas");
  const refreshBtn = document.getElementById("btnRefreshNilai");
  const lockCard = document.getElementById("nilaiLock");
  const contentEl = document.getElementById("nilaiContent");
  const passwordInput = document.getElementById("nilaiPassword");
  const btnBuka = document.getElementById("btnBukaNilai");
  const lockStatus = document.getElementById("nilaiLockStatus");
  const UNLOCK_KEY = "nilai_unlocked";
  let allRows = [];
  let loaded = false;

  function getPassword(){
    return typeof GURU_PASSWORD === "string" && GURU_PASSWORD.length > 0 ? GURU_PASSWORD : "guru123";
  }

  function isUnlocked(){
    return sessionStorage.getItem(UNLOCK_KEY) === "1";
  }

  function showContent(){
    lockCard.style.display = "none";
    contentEl.style.display = "block";
    if(!loaded){ loaded = true; loadData(); }
  }

  function tryUnlock(){
    const val = passwordInput.value;
    if(val === getPassword()){
      sessionStorage.setItem(UNLOCK_KEY, "1");
      lockStatus.textContent = "";
      passwordInput.value = "";
      showContent();
    }else{
      lockStatus.textContent = "Kata sandi salah, coba lagi.";
      lockStatus.className = "form-status err";
      passwordInput.value = "";
      passwordInput.focus();
    }
  }

  btnBuka.addEventListener("click", tryUnlock);
  passwordInput.addEventListener("keydown", (e) => { if(e.key === "Enter") tryUnlock(); });

  function renderTable(rows){
    if(rows.length === 0){
      tbody.innerHTML = `<tr><td colspan="6" class="muted" style="text-align:center; padding:24px;">Belum ada data.</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map((r, i) => {
      const waktu = r.dikerjakan_pada ? new Date(r.dikerjakan_pada).toLocaleString("id-ID") : "-";
      return `<tr>
        <td>${i+1}</td>
        <td>${r.nama_siswa}</td>
        <td>${r.kelas}</td>
        <td>${r.jumlah_benar}</td>
        <td><strong>${r.skor_pilihan_ganda}</strong></td>
        <td>${waktu}</td>
      </tr>`;
    }).join("");
  }

  function applyFilter(){
    const kelas = filterKelas.value;
    const filtered = kelas ? allRows.filter(r => r.kelas === kelas) : allRows;
    renderTable(filtered);
  }

  function populateKelasOptions(){
    const kelasSet = [...new Set(allRows.map(r => r.kelas))].sort();
    filterKelas.innerHTML = `<option value="">Semua Kelas</option>` +
      kelasSet.map(k => `<option value="${k}">${k}</option>`).join("");
  }

  async function loadData(){
    if(!isSupabaseReady()){
      statusEl.textContent = "Supabase belum dikonfigurasi (lihat config.js), daftar nilai belum bisa dimuat.";
      statusEl.className = "form-status err";
      tbody.innerHTML = `<tr><td colspan="6" class="muted" style="text-align:center; padding:24px;">Supabase belum dikonfigurasi.</td></tr>`;
      return;
    }
    statusEl.textContent = "Memuat data...";
    statusEl.className = "form-status";
    try{
      const { data, error } = await supabaseClient
        .from("evaluasi_hasil")
        .select("nama_siswa, kelas, jumlah_benar, skor_pilihan_ganda, dikerjakan_pada")
        .order("skor_pilihan_ganda", { ascending: false })
        .order("dikerjakan_pada", { ascending: true });
      if(error) throw error;
      allRows = data || [];
      populateKelasOptions();
      applyFilter();
      statusEl.textContent = `Menampilkan ${allRows.length} data.`;
      statusEl.className = "form-status ok";
    }catch(err){
      console.error(err);
      statusEl.textContent = "Gagal memuat data. Periksa koneksi internet dan coba muat ulang.";
      statusEl.className = "form-status err";
      tbody.innerHTML = `<tr><td colspan="6" class="muted" style="text-align:center; padding:24px;">Gagal memuat data.</td></tr>`;
    }
  }

  refreshBtn.addEventListener("click", loadData);
  filterKelas.addEventListener("change", applyFilter);

  // Saat menu "Daftar Nilai" dibuka: jika sudah pernah buka kata sandi di sesi ini, langsung tampilkan
  document.querySelector('.nav-item[data-target="nilai"]').addEventListener("click", () => {
    if(isUnlocked()){
      showContent();
    }
  });
})();

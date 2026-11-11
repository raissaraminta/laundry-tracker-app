'use strict';
/* ===== Konfigurasi & State ===== */
const K_C = 'lkm_clothes_v1', K_S = 'lkm_sessions_v1', DAY = 864e5;
const CATS = {
  atasan: ['👕', 'Atasan'], bawahan: ['👖', 'Bawahan'], jilbab: ['🧕', 'Jilbab & Hijab'],
  dalaman: ['🩲', 'Underwear & Daleman'], kamar: ['🛏️', 'Perlengkapan Kamar'], lain: ['📦', 'Lain-lain']
};
const TITLES = { sesi: 'Sesi Laundry', lemari: 'Lemari Pakaian', verif: 'Verifikasi Check-In' };
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const read = k => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } };
const write = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); return true; }
  catch { toast('Penyimpanan penuh. Hapus beberapa foto atau riwayat.'); return false; }
};
let clothes = read(K_C), sessions = read(K_S);
let tab = 'sesi', filter = 'all', verifId = null, doneId = null;
let form = { cat: 'atasan', front: '', back: '', editId: null };

/* ===== Tanggal ===== */
const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const parse = s => new Date(s + 'T00:00:00');
const plus2 = s => { const d = parse(s); d.setDate(d.getDate() + 2); return iso(d); };
const fmt = s => parse(s).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const daysLeft = s => Math.round((parse(s.date_return) - parse(iso(new Date()))) / DAY);

/* ===== Auto-delete riwayat > 30 hari (dari date_created) ===== */
function purge() {
  const before = sessions.length;
  sessions = sessions.filter(s => Date.now() - new Date(s.date_created).getTime() <= 30 * DAY);
  if (sessions.length !== before) {
    write(K_S, sessions);
    toast(`${before - sessions.length} sesi lama (>30 hari) dihapus otomatis`);
  }
}

/* ===== Util UI ===== */
let tt;
function toast(m) {
  const t = $('#toast'); t.textContent = m; t.classList.add('show');
  clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2800);
}
const openSheet = s => $(s).classList.add('open');
const closeSheets = () => $$('.sheet').forEach(x => x.classList.remove('open'));
const cloth = id => clothes.find(c => c.id === id);
const missing = s => s.items.filter(id => !s.checked.includes(id));
const pic = (src, alt, z = 1) => `<img class="mini" src="${src}" alt="${esc(alt)}"${z ? ' data-zoom' : ''}>`;
const thumb = (c, z = 1) => !c ? '<div class="mini ph">❓</div>' : c.front ? pic(c.front, c.name, z) : `<div class="mini ph">${CATS[c.cat]?.[0] || '📦'}</div>`;
const thumbs = c => (c && (c.front || c.back)) ? [c.front, c.back].filter(Boolean).map(x => pic(x, c.name)).join('') : thumb(c);
const empty = (i, t, s = '') => `<div class="empty"><i class="fa-solid ${i}"></i><b>${t}</b><p>${s}</p></div>`;
const catOf = c => CATS[c?.cat] || CATS.lain;

/* ===== Navigasi ===== */
function go(t) {
  tab = t; if (t !== 'verif') doneId = null;
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + t));
  $$('.bottom-nav button').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
  $('#title').textContent = TITLES[t];
  const f = $('#fab'); f.hidden = t === 'verif';
  f.setAttribute('aria-label', t === 'lemari' ? 'Tambah baju' : 'Buat sesi baru');
  $('main').scrollTop = 0; render();
}
const render = () => tab === 'sesi' ? renderSesi() : tab === 'lemari' ? renderLemari() : renderVerif();

/* ===== Tab 1: Sesi Laundry ===== */
function badge(s) {
  if (s.status === 'Diproses') return '<span class="badge b-proc"><i class="fa-solid fa-spinner"></i> Diproses</span>';
  return missing(s).length
    ? '<span class="badge b-warn"><i class="fa-solid fa-triangle-exclamation"></i> Selesai (Sebagian)</span>'
    : '<span class="badge b-ok"><i class="fa-solid fa-circle-check"></i> Selesai (Lengkap 100%)</span>';
}
function auditHTML(s) {
  const m = missing(s);
  const note = s.note ? `<div class="note"><i class="fa-regular fa-note-sticky"></i> ${esc(s.note)}</div>` : '';
  if (!m.length) return `<div class="alert ok"><i class="fa-solid fa-circle-check"></i> Selesai (Lengkap 100%) — semua ${s.items.length} barang sudah kembali.</div>${note}`;
  return `<div class="alert warn"><i class="fa-solid fa-triangle-exclamation"></i> LENGKAP SEBAGIAN / ADA BARANG HILANG
    <small>${m.length} dari ${s.items.length} barang belum kembali:</small>
    ${m.map(id => { const c = cloth(id); return `<div class="miss">${thumbs(c)}<b>${c ? esc(c.name) : '(Baju sudah dihapus)'}</b></div>`; }).join('')}</div>${note}`;
}
function sesCard(s) {
  const done = s.status === 'Selesai', d = daysLeft(s);
  const due = done ? '' : `<div class="due ${d < 0 ? 'late' : ''}"><i class="fa-regular fa-calendar"></i> ${d > 0 ? `Kembali ${d} hari lagi` : d === 0 ? 'Kembali hari ini' : `Terlambat ${-d} hari`}</div>`;
  return `<article class="card">
    <div class="flex"><div><b>${fmt(s.date_given)}</b><small class="muted">Kembali: ${fmt(s.date_return)}</small></div>${badge(s)}</div>
    <div class="stack">${s.items.slice(0, 6).map(id => thumb(cloth(id))).join('')}${s.items.length > 6 ? `<span class="more">+${s.items.length - 6}</span>` : ''}</div>
    <small class="muted">${s.items.length} barang</small>${due}${done ? auditHTML(s) : ''}
    <div class="acts">${done ? '' : `<button class="btn btn-mint btn-sm" data-act="verif" data-id="${s.id}"><i class="fa-solid fa-clipboard-check"></i> Verifikasi</button>`}
    <button class="btn btn-danger btn-sm" data-act="delSes" data-id="${s.id}" aria-label="Hapus sesi"><i class="fa-solid fa-trash"></i></button></div></article>`;
}
function renderSesi() {
  const a = sessions.filter(s => s.status === 'Diproses').sort((x, y) => x.date_return.localeCompare(y.date_return));
  const h = sessions.filter(s => s.status === 'Selesai').sort((x, y) => y.date_created.localeCompare(x.date_created));
  $('#view-sesi').innerHTML = `
    <div class="card hero"><div><b>${a.length}</b><span>Sesi aktif</span></div><div><b>${clothes.length}</b><span>Baju di lemari</span></div><div><b>${h.length}</b><span>Riwayat</span></div></div>
    <h2 class="sec-title"><i class="fa-solid fa-hourglass-half"></i> Sesi Aktif</h2>
    ${a.length ? a.map(sesCard).join('') : empty('fa-basket-shopping', 'Belum ada sesi aktif', 'Tekan tombol + untuk membuat sesi laundry baru.')}
    <h2 class="sec-title"><i class="fa-solid fa-clock-rotate-left"></i> Riwayat Sesi <small>(dihapus otomatis &gt; 30 hari)</small></h2>
    ${h.length ? h.map(sesCard).join('') : empty('fa-box-archive', 'Riwayat masih kosong')}`;
}

/* ===== Tab 2: Lemari Pakaian ===== */
function renderLemari() {
  const list = clothes.filter(c => filter === 'all' || c.cat === filter);
  const filters = [['all', ['✨', 'Semua']], ...Object.entries(CATS)];
  $('#view-lemari').innerHTML = `
    <div class="chips scroll">${filters.map(([k, [e, l]]) => `<button class="chip ${filter === k ? 'on' : ''}" data-act="filter" data-id="${k}">${e} ${l}</button>`).join('')}</div>
    <div class="grid">${list.map(c => `<article class="cloth">
      <div class="thumb">${c.front ? pic(c.front, c.name).replace('class="mini"', '') : catOf(c)[0]}${c.back ? '<span class="two"><i class="fa-solid fa-images"></i> 2 foto</span>' : ''}</div>
      <div class="info-box"><h3>${esc(c.name)}</h3><small class="muted">${catOf(c)[0]} ${catOf(c)[1]}</small>
      ${c.color ? `<small class="muted"><i class="fa-solid fa-palette"></i> ${esc(c.color)}</small>` : ''}</div>
      <div class="acts"><button class="btn btn-sm" data-act="editCloth" data-id="${c.id}" aria-label="Edit"><i class="fa-solid fa-pen"></i></button>
      <button class="btn btn-danger btn-sm" data-act="delCloth" data-id="${c.id}" aria-label="Hapus"><i class="fa-solid fa-trash"></i></button></div></article>`).join('')}</div>
    ${list.length ? '' : empty('fa-shirt', 'Lemari masih kosong', 'Tekan tombol + untuk menambah baju beserta foto panduannya.')}`;
}

/* ===== Tab 3: Verifikasi Check-In ===== */
function renderVerif() {
  const v = $('#view-verif'), a = sessions.filter(s => s.status === 'Diproses');
  const d = doneId && sessions.find(x => x.id === doneId);
  if (d) {
    v.innerHTML = `<div class="card"><div class="flex"><b>Hasil audit</b>${badge(d)}</div>${auditHTML(d)}
      <button class="btn btn-primary btn-block" style="margin-top:14px" data-act="close"><i class="fa-solid fa-clock-rotate-left"></i> Lihat riwayat</button></div>`;
    return;
  }
  if (!a.length) { v.innerHTML = empty('fa-clipboard-check', 'Tidak ada sesi yang perlu diverifikasi', 'Buat sesi di tab Sesi Laundry. Setelah 2 hari, cek kelengkapan baju di sini.'); return; }
  if (!a.some(s => s.id === verifId)) verifId = a[0].id;
  const s = sessions.find(x => x.id === verifId), n = s.checked.length, t = s.items.length;
  v.innerHTML = `
    ${a.length > 1 ? `<div class="chips scroll" style="margin-bottom:12px">${a.map(x => `<button class="chip ${x.id === verifId ? 'on' : ''}" data-act="pick" data-id="${x.id}">${fmt(x.date_given)}</button>`).join('')}</div>` : ''}
    <div class="card"><div class="flex"><b>Cek kelengkapan baju</b><span class="badge b-proc">${n}/${t}</span></div>
      <div class="bar"><i style="width:${t ? Math.round(n / t * 100) : 0}%"></i></div>
      <small class="muted">Diserahkan ${fmt(s.date_given)} · Kembali ${fmt(s.date_return)}</small>
      <small class="muted" style="margin-top:4px">Ketuk baris untuk mencentang baju yang sudah kembali.</small></div>
    ${s.items.map(id => { const c = cloth(id), on = s.checked.includes(id);
      return `<div class="row ${on ? 'on' : ''}" data-act="tick" data-id="${id}" role="checkbox" aria-checked="${on}" tabindex="0">
        <span class="tick"><i class="fa-solid fa-check"></i></span>
        <div class="grow"><b>${c ? esc(c.name) : '(Baju sudah dihapus)'}</b><small class="muted">${c ? catOf(c)[0] + ' ' + esc(c.color || catOf(c)[1]) : ''}</small></div>
        <div class="pics">${thumbs(c)}</div></div>`; }).join('')}
    <button class="btn btn-mint btn-sm" data-act="all"><i class="fa-solid fa-check-double"></i> Centang semua</button>
    <label class="lbl" for="vNote">Catatan sesi / barang tertukar</label>
    <textarea id="vNote" class="input" placeholder="cth: ada kaos abu-abu milik anak kos kamar 5 yang nyasar">${esc(s.note)}</textarea>
    <button class="btn btn-primary btn-block" style="margin-top:14px" data-act="finish"><i class="fa-solid fa-flag-checkered"></i> Selesaikan sesi</button>`;
}
function finish(s) {
  const m = missing(s);
  if (m.length && !confirm(`${m.length} barang belum dicentang dan akan dicatat HILANG. Lanjutkan?`)) return;
  s.status = 'Selesai'; s.date_done = iso(new Date()); write(K_S, sessions);
  doneId = s.id; verifId = null; renderVerif();
  toast(m.length ? 'Sesi selesai, ada barang belum kembali' : 'Sesi selesai, lengkap 100%! 🎉');
}

/* ===== Form Pakaian + Kompres Foto ===== */
function compress(file, max = 480, q = .7) {
  return new Promise((ok, no) => {
    const u = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const r = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = Math.round(im.width * r); c.height = Math.round(im.height * r);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(u); ok(c.toDataURL('image/jpeg', q));
    };
    im.onerror = () => { URL.revokeObjectURL(u); no(); };
    im.src = u;
  });
}
const drawCats = () => $('#catChips').innerHTML = Object.entries(CATS).map(([k, [e, l]]) =>
  `<button type="button" class="chip ${form.cat === k ? 'on' : ''}" data-cat="${k}">${e} ${l}</button>`).join('');
const drawPrev = side => {
  const src = form[side];
  $('#prev-' + side).innerHTML = src ? `<img src="${src}" alt="Foto ${side === 'front' ? 'depan' : 'belakang'}">`
    : `<i class="fa-solid fa-camera-retro"></i>${side === 'front' ? 'Tampak Depan' : 'Tampak Belakang'}`;
};
function openCloth(id) {
  const c = id ? cloth(id) : null;
  form = { cat: c?.cat || 'atasan', front: c?.front || '', back: c?.back || '', editId: id || null };
  $('#clothTitle').textContent = c ? 'Edit Pakaian' : 'Tambah Pakaian';
  $('#cName').value = c?.name || ''; $('#cColor').value = c?.color || '';
  drawCats(); drawPrev('front'); drawPrev('back'); openSheet('#sheet-cloth');
}
$('#clothForm').addEventListener('submit', e => {
  e.preventDefault();
  const d = { name: $('#cName').value.trim(), color: $('#cColor').value.trim(), cat: form.cat, front: form.front, back: form.back };
  if (!d.name) return;
  const prev = clothes;
  clothes = form.editId ? clothes.map(c => c.id === form.editId ? { ...c, ...d } : c) : [{ id: uid(), ...d, date_added: iso(new Date()) }, ...clothes];
  if (!write(K_C, clothes)) { clothes = prev; return; }
  closeSheets(); render(); toast('Baju tersimpan ✨');
});

/* ===== Form Sesi Baru ===== */
const updReturn = () => $('#sReturn').textContent = fmt(plus2($('#sDate').value || iso(new Date())));
const updCount = () => $('#sCount').textContent = `(${$$('#sList input:checked').length} dipilih)`;
function openSesi() {
  if (!clothes.length) { toast('Tambahkan baju dulu di Lemari Pakaian'); go('lemari'); return; }
  $('#sDate').value = iso(new Date());
  $('#sList').innerHTML = clothes.map(c => `<label class="row"><input type="checkbox" value="${c.id}" hidden>
    <span class="tick"><i class="fa-solid fa-check"></i></span>
    <div class="grow"><b>${esc(c.name)}</b><small class="muted">${catOf(c)[0]} ${catOf(c)[1]}</small></div>${thumb(c, 0)}</label>`).join('');
  updReturn(); updCount(); openSheet('#sheet-sesi');
}
$('#sesiForm').addEventListener('submit', e => {
  e.preventDefault();
  const items = $$('#sList input:checked').map(i => i.value), date = $('#sDate').value;
  if (!date) return toast('Pilih tanggal penyerahan');
  if (!items.length) return toast('Pilih minimal 1 baju');
  sessions.unshift({ id: uid(), date_created: new Date().toISOString(), date_given: date, date_return: plus2(date), status: 'Diproses', items, checked: [], note: '' });
  write(K_S, sessions); closeSheets(); go('sesi'); toast('Terkirim ke Laundry Kos 🧺');
});

/* ===== Event delegation ===== */
document.addEventListener('click', e => {
  const z = e.target.closest('[data-zoom]');
  if (z) { $('#lightbox img').src = z.src; $('#lightbox').classList.add('open'); return; }
  if (e.target.closest('[data-close]') || e.target.classList.contains('sheet')) { closeSheets(); return; }
  const ct = e.target.closest('[data-cat]');
  if (ct) { form.cat = ct.dataset.cat; drawCats(); return; }
  const a = e.target.closest('[data-act]'); if (!a) return;
  const id = a.dataset.id, s = sessions.find(x => x.id === verifId);
  switch (a.dataset.act) {
    case 'filter': filter = id; renderLemari(); break;
    case 'editCloth': openCloth(id); break;
    case 'delCloth':
      if (confirm('Hapus baju ini dari lemari?')) { clothes = clothes.filter(c => c.id !== id); write(K_C, clothes); render(); toast('Baju dihapus'); } break;
    case 'delSes':
      if (confirm('Hapus sesi ini?')) { sessions = sessions.filter(x => x.id !== id); write(K_S, sessions); render(); } break;
    case 'verif': verifId = id; go('verif'); break;
    case 'pick': verifId = id; renderVerif(); break;
    case 'tick': s.checked = s.checked.includes(id) ? s.checked.filter(x => x !== id) : [...s.checked, id]; write(K_S, sessions); renderVerif(); break;
    case 'all': s.checked = [...s.items]; write(K_S, sessions); renderVerif(); break;
    case 'finish': finish(s); break;
    case 'close': go('sesi'); break;
  }
});
document.addEventListener('change', async e => {
  const i = e.target;
  if (i.type === 'file' && i.dataset.side) {
    const f = i.files[0]; if (!f) return;
    try { form[i.dataset.side] = await compress(f); drawPrev(i.dataset.side); } catch { toast('Foto tidak bisa dibaca, coba foto lain'); }
    i.value = '';
  } else if (i.id === 'sDate') updReturn();
  else if (i.closest('#sList')) updCount();
});
document.addEventListener('input', e => {   // simpan catatan langsung saat mengetik
  if (e.target.id !== 'vNote') return;
  const s = sessions.find(x => x.id === verifId);
  if (s) { s.note = e.target.value; write(K_S, sessions); }
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.row[data-act]')) { e.preventDefault(); e.target.click(); }
  if (e.key === 'Escape') { closeSheets(); $('#lightbox').classList.remove('open'); }
});
$('#lightbox').onclick = e => e.currentTarget.classList.remove('open');
$$('.bottom-nav button').forEach(b => b.onclick = () => go(b.dataset.tab));
$('#fab').onclick = () => tab === 'lemari' ? openCloth() : openSesi();

/* ===== Start ===== */
purge();
go('sesi');

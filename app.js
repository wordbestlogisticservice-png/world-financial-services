/* =============================================================
   WORLD FINANCIAL BANK — Application Logic
   All data stored in localStorage.
   ============================================================= */

'use strict';

/* ──────────────────────────────────────────────
   CONSTANTS
────────────────────────────────────────────── */
const ADMIN = { username: 'admin', password: 'admin123' };

const K = {
  USERS:         'wfb_users',
  TRANSACTIONS:  'wfb_transactions',
  SESSION:       'wfb_session',
  ADMIN_SESSION: 'wfb_admin_session',
  NOTIFICATIONS: 'wfb_notifications',
};

/* ──────────────────────────────────────────────
   UTILITIES
────────────────────────────────────────────── */
const uid  = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const $    = id  => document.getElementById(id);
const setText = (id, v) => { const e = $(id); if (e) e.textContent = v; };
const setHTML = (id, v) => { const e = $(id); if (e) e.innerHTML  = v; };

function generateAccountNumber() {
  return String(Math.floor(1_000_000_000 + Math.random() * 9_000_000_000));
}

function generateIBAN() {
  const digits = Array.from({ length: 18 }, () => Math.floor(Math.random() * 10)).join('');
  const check  = String(Math.floor(10 + Math.random() * 90));
  return `WF${check}${digits}`;
}

function formatMoney(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDateShort(iso) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function escapeHTML(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(String(str ?? '')));
  return d.innerHTML;
}

function maskAccount(n) {
  return n.slice(0, 4) + ' •••• •••• ' + n.slice(-4);
}

/* ──────────────────────────────────────────────
   LOCAL STORAGE HELPERS
────────────────────────────────────────────── */
const getUsers         = ()    => JSON.parse(localStorage.getItem(K.USERS)        || '[]');
const saveUsers        = arr   => localStorage.setItem(K.USERS, JSON.stringify(arr));
const getTransactions  = ()    => JSON.parse(localStorage.getItem(K.TRANSACTIONS) || '[]');
const saveTransactions = arr   => localStorage.setItem(K.TRANSACTIONS, JSON.stringify(arr));
const getSession       = ()    => JSON.parse(localStorage.getItem(K.SESSION)      || 'null');
const setSession       = user  => user ? localStorage.setItem(K.SESSION, JSON.stringify(user)) : localStorage.removeItem(K.SESSION);
const getAdminSession  = ()    => JSON.parse(localStorage.getItem(K.ADMIN_SESSION)|| 'null');
const setAdminSession  = val   => val  ? localStorage.setItem(K.ADMIN_SESSION, JSON.stringify(val)) : localStorage.removeItem(K.ADMIN_SESSION);
const getAllNotifs      = ()    => JSON.parse(localStorage.getItem(K.NOTIFICATIONS)|| '[]');
const saveNotifs       = arr   => localStorage.setItem(K.NOTIFICATIONS, JSON.stringify(arr));

function getFreshUser(id) {
  return getUsers().find(u => u.id === id) || null;
}

function updateUserInStorage(u) {
  const users = getUsers();
  const i = users.findIndex(x => x.id === u.id);
  if (i !== -1) { users[i] = u; saveUsers(users); setSession(u); }
}

/* ──────────────────────────────────────────────
   AUTH
────────────────────────────────────────────── */
function registerUser(name, email, password) {
  const users = getUsers();
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return { ok: false, msg: 'An account with this email already exists.' };
  }
  const user = {
    id:            uid(),
    name:          name.trim(),
    email:         email.toLowerCase().trim(),
    password,
    accountNumber: generateAccountNumber(),
    iban:          generateIBAN(),
    balance:       10000,
    createdAt:     new Date().toISOString(),
  };
  users.push(user);
  saveUsers(users);
  addTransaction(user.id, 'credit', 'Account Opening — Welcome Bonus', 10000, 'Completed');
  return { ok: true, user };
}

function loginUser(email, password) {
  const user = getUsers().find(
    u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  );
  if (!user) return { ok: false, msg: 'Invalid email or password. Please try again.' };
  setSession(user);
  return { ok: true, user };
}

function loginAdmin(username, password) {
  if (username === ADMIN.username && password === ADMIN.password) {
    setAdminSession({ username, at: new Date().toISOString() });
    return { ok: true };
  }
  return { ok: false, msg: 'Invalid admin credentials.' };
}

function logout() { setSession(null); window.location.href = 'index.html'; }
function logoutAdmin() { setAdminSession(null); window.location.href = 'admin.html'; }

function requireAuth() {
  const s = getSession();
  if (!s) { window.location.href = 'login.html'; return null; }
  const fresh = getFreshUser(s.id);
  if (!fresh) { setSession(null); window.location.href = 'login.html'; return null; }
  setSession(fresh);
  return fresh;
}

function requireAdmin() {
  const s = getAdminSession();
  if (!s) { window.location.href = 'admin.html'; return null; }
  return s;
}

/* ──────────────────────────────────────────────
   TRANSACTIONS
────────────────────────────────────────────── */
function addTransaction(userId, type, description, amount, status) {
  const txns = getTransactions();
  const t = {
    id: uid(), userId, type,
    description, amount: parseFloat(amount),
    status, date: new Date().toISOString(),
  };
  txns.unshift(t);
  saveTransactions(txns);
  return t;
}

function getUserTransactions(userId) {
  return getTransactions().filter(t => t.userId === userId);
}

/* ──────────────────────────────────────────────
   NOTIFICATIONS
────────────────────────────────────────────── */
function addNotification(userId, message) {
  const notifs = getAllNotifs();
  notifs.unshift({ id: uid(), userId, message, date: new Date().toISOString(), read: false });
  saveNotifs(notifs);
}

function showNotification(title, message, type = 'success') {
  const existing = document.querySelector('.notif-popup');
  if (existing) existing.remove();
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const el = document.createElement('div');
  el.className = `notif-popup ${type}`;
  el.innerHTML = `
    <div class="notif-hdr">
      <span class="notif-ico">${icons[type] || icons.info}</span>
      <span class="notif-ttl">${escapeHTML(title)}</span>
    </div>
    <div class="notif-msg">${escapeHTML(message)}</div>
  `;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 4500);
}

/* ──────────────────────────────────────────────
   ALERT HELPER
────────────────────────────────────────────── */
function showAlert(id, msg, type = 'error') {
  const el = $(id);
  if (!el) return;
  el.textContent = msg;
  el.className = `alert alert-${type} show`;
  setTimeout(() => el.classList.remove('show'), 5000);
}

/* ──────────────────────────────────────────────
   HAMBURGER
────────────────────────────────────────────── */
function initHamburger() {
  const btn  = $('hamburger');
  const menu = $('nav-menu');
  if (!btn || !menu) return;
  btn.addEventListener('click', () => menu.classList.toggle('open'));
  document.addEventListener('click', e => {
    if (!btn.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.remove('open');
    }
  });
}

/* ──────────────────────────────────────────────
   RENDER HELPERS
────────────────────────────────────────────── */
function renderNavUser(user) {
  setText('nav-initials',  initials(user.name));
  setText('nav-username',  user.name.split(' ')[0]);
}

function txnItemHTML(t) {
  return `
    <div class="txn-item anim-fadeup">
      <div class="txn-icon ${t.type}">${t.type === 'credit' ? '⬇' : '⬆'}</div>
      <div class="txn-info">
        <div class="txn-desc">${escapeHTML(t.description)}</div>
        <div class="txn-date">${formatDate(t.date)}</div>
      </div>
      <div class="txn-right">
        <div class="txn-amount ${t.type}">${t.type === 'credit' ? '+' : '−'}${formatMoney(t.amount)}</div>
        <div class="txn-status">${escapeHTML(t.status)}</div>
      </div>
    </div>`;
}

/* ──────────────────────────────────────────────
   DASHBOARD
────────────────────────────────────────────── */
function loadDashboard() {
  const user = requireAuth();
  if (!user) return;
  renderNavUser(user);
  setText('dash-greeting', `Hello, ${user.name.split(' ')[0]} 👋`);
  setText('dash-balance',  formatMoney(user.balance));
  setText('dash-account',  maskAccount(user.accountNumber));
  setText('dash-iban',     user.iban);
  setText('dash-initials', initials(user.name));

  const txns = getUserTransactions(user.id).slice(0, 6);
  const container = $('recent-txns');
  if (container) {
    container.innerHTML = txns.length
      ? txns.map(txnItemHTML).join('')
      : '<p class="no-data">📋 No transactions yet. Make your first transfer!</p>';
  }
}

/* ──────────────────────────────────────────────
   TRANSFER
────────────────────────────────────────────── */
function openModal(id)  { const m = $(id); if (m) m.classList.add('active'); }
function closeModal(id) { const m = $(id); if (m) m.classList.remove('active'); }

function transferMoney(recipientName, recipientAccount, amount) {
  const s = getSession();
  if (!s) return { ok: false, msg: 'Session expired. Please log in again.' };
  const user = getFreshUser(s.id);
  if (!user) return { ok: false, msg: 'User not found.' };

  amount = parseFloat(amount);
  if (!recipientName.trim())    return { ok: false, msg: 'Please enter recipient name.' };
  if (!recipientAccount.trim()) return { ok: false, msg: 'Please enter recipient account number.' };
  if (isNaN(amount) || amount <= 0) return { ok: false, msg: 'Please enter a valid amount greater than $0.' };
  if (amount > user.balance)    return { ok: false, msg: `Insufficient funds. Your balance is ${formatMoney(user.balance)}.` };
  if (recipientAccount.trim() === user.accountNumber) return { ok: false, msg: 'You cannot transfer to your own account.' };

  // Deduct from sender
  user.balance -= amount;
  updateUserInStorage(user);
  const desc = `Transfer to ${recipientName.trim()} (Acct: ${recipientAccount.trim()})`;
  addTransaction(user.id, 'debit', desc, amount, 'Completed');

  // Credit recipient if they exist
  const users = getUsers();
  const recipient = users.find(u => u.accountNumber === recipientAccount.trim());
  if (recipient) {
    recipient.balance += amount;
    const ri = users.findIndex(u => u.id === recipient.id);
    if (ri !== -1) { users[ri] = recipient; saveUsers(users); }
    addTransaction(recipient.id, 'credit', `Transfer received from ${user.name} (Acct: ${user.accountNumber})`, amount, 'Completed');
  }

  addNotification(user.id, `Transfer of ${formatMoney(amount)} to ${recipientName.trim()} was successful.`);
  showNotification('Transaction Successful! 🎉', `${formatMoney(amount)} sent to ${recipientName.trim()}.`, 'success');
  return { ok: true };
}

/* ──────────────────────────────────────────────
   TRANSACTIONS PAGE
────────────────────────────────────────────── */
function loadTransactionsPage() {
  const user = requireAuth();
  if (!user) return;
  renderNavUser(user);
  setText('txn-page-user', user.name.split(' ')[0]);
  const txns = getUserTransactions(user.id);
  renderTxnTable(txns);

  const filter = $('txn-filter');
  if (filter) {
    filter.addEventListener('input', () => {
      const q = filter.value.toLowerCase();
      const filtered = getUserTransactions(user.id).filter(t =>
        t.description.toLowerCase().includes(q) || t.status.toLowerCase().includes(q)
      );
      renderTxnTable(filtered);
    });
  }
}

function renderTxnTable(txns) {
  const tbody = $('txn-tbody');
  if (!tbody) return;
  if (!txns.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="no-data">No transactions found.</td></tr>';
    return;
  }
  tbody.innerHTML = txns.map(t => `
    <tr>
      <td>${formatDateShort(t.date)}</td>
      <td>${escapeHTML(t.description)}</td>
      <td class="${t.type === 'credit' ? 'text-success' : 'text-error'}" style="font-weight:600;">
        ${t.type === 'credit' ? '+' : '−'}${formatMoney(t.amount)}
      </td>
      <td><span class="badge badge-success">${escapeHTML(t.status)}</span></td>
    </tr>`).join('');
}

/* ──────────────────────────────────────────────
   PROFILE
────────────────────────────────────────────── */
function loadProfile() {
  const user = requireAuth();
  if (!user) return;
  renderNavUser(user);
  setText('prof-initials', initials(user.name));
  setText('prof-name',     user.name);
  setText('prof-email',    user.email);
  setText('prof-account',  user.accountNumber);
  setText('prof-iban',     user.iban);
  setText('prof-balance',  formatMoney(user.balance));
  setText('prof-joined',   formatDateShort(user.createdAt));

  const nameIn  = $('edit-name');
  const emailIn = $('edit-email');
  if (nameIn)  nameIn.value  = user.name;
  if (emailIn) emailIn.value = user.email;
}

function updateProfile(name, email) {
  const s = getSession();
  if (!s) return { ok: false, msg: 'Session expired.' };
  const user = getFreshUser(s.id);
  if (!user) return { ok: false, msg: 'User not found.' };
  if (!name.trim())  return { ok: false, msg: 'Name cannot be empty.' };
  if (!email.includes('@')) return { ok: false, msg: 'Please enter a valid email.' };
  user.name  = name.trim();
  user.email = email.toLowerCase().trim();
  updateUserInStorage(user);
  showNotification('Profile Updated ✅', 'Your profile has been saved successfully.', 'success');
  return { ok: true };
}

/* ──────────────────────────────────────────────
   DOWNLOAD STATEMENT (jsPDF)
────────────────────────────────────────────── */
function downloadStatement() {
  const s = getSession();
  if (!s) return;
  const user = getFreshUser(s.id);
  if (!user) return;

  if (typeof window.jspdf === 'undefined') {
    showNotification('Library Error', 'PDF library not available. Check internet connection.', 'error');
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc  = new jsPDF();
  const txns = getUserTransactions(user.id);

  const navy  = [10, 31, 68];
  const gold  = [212, 175, 55];
  const white = [255, 255, 255];
  const gray  = [90, 100, 115];
  const lightBg = [242, 246, 255];

  // ── Header band
  doc.setFillColor(...navy); doc.rect(0, 0, 210, 48, 'F');
  doc.setFillColor(...gold); doc.rect(0, 46, 210, 2, 'F');

  doc.setTextColor(...gold); doc.setFontSize(20); doc.setFont('helvetica', 'bold');
  doc.text('WORLD FINANCIAL BANK', 14, 22);
  doc.setTextColor(...white); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text('Global Digital Financial Services', 14, 30);
  doc.text('Statement of Account', 14, 38);

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.setTextColor(...white); doc.setFontSize(8);
  doc.text(`Date: ${today}`, 140, 22);
  doc.text(`Ref: WFB-${Date.now().toString().slice(-8)}`, 140, 30);

  // ── Account info
  doc.setFillColor(...lightBg); doc.rect(0, 48, 210, 36, 'F');
  doc.setTextColor(...navy); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text('Account Holder', 14, 62);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...gray);
  doc.text(`Name:       ${user.name}`, 14, 71);
  doc.text(`Email:      ${user.email}`, 14, 78);
  doc.text(`Account No: ${user.accountNumber}`, 110, 71);
  doc.text(`IBAN:       ${user.iban}`, 110, 78);

  // ── Balance bar
  doc.setFillColor(...navy); doc.rect(14, 88, 182, 12, 'F');
  doc.setTextColor(...white); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  doc.text('Current Balance:', 18, 96);
  doc.setTextColor(...gold);
  doc.text(formatMoney(user.balance), 150, 96);

  // ── Table header
  const tY = 108;
  doc.setFillColor(...navy); doc.rect(14, tY, 182, 9, 'F');
  doc.setTextColor(...gold); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
  ['Date', 'Description', 'Amount', 'Type', 'Status'].forEach((h, i) => {
    const x = [17, 44, 145, 165, 182][i];
    doc.text(h, x, tY + 6);
  });

  let y = tY + 14;
  doc.setFont('helvetica', 'normal');
  txns.slice(0, 28).forEach((t, i) => {
    if (y > 272) return;
    if (i % 2 === 0) { doc.setFillColor(248, 251, 255); doc.rect(14, y - 5, 182, 9, 'F'); }
    doc.setTextColor(...gray); doc.setFontSize(7.5);
    doc.text(formatDateShort(t.date), 17, y);
    const desc = t.description.length > 40 ? t.description.slice(0, 37) + '…' : t.description;
    doc.text(desc, 44, y);
    const amtStr = `${t.type === 'credit' ? '+' : '−'}${formatMoney(t.amount)}`;
    t.type === 'credit' ? doc.setTextColor(18, 183, 106) : doc.setTextColor(240, 68, 56);
    doc.text(amtStr, 145, y);
    doc.setTextColor(...gray);
    doc.text(t.type === 'credit' ? 'Credit' : 'Debit', 165, y);
    doc.setTextColor(18, 183, 106);
    doc.text(t.status, 182, y);
    y += 9;
  });

  // ── Footer
  doc.setDrawColor(...gold); doc.setLineWidth(0.5); doc.line(14, 280, 196, 280);
  doc.setTextColor(...gray); doc.setFontSize(7);
  doc.text('This statement is generated for informational purposes only. World Financial Bank © 2026', 14, 287);
  doc.text('support@worldfinancialbank.com  |  www.worldfinancialbank.com', 14, 293);

  doc.save(`WFB-Statement-${user.accountNumber}.pdf`);
  showNotification('Statement Downloaded 📄', 'Your bank statement PDF has been saved.', 'success');
}

/* ──────────────────────────────────────────────
   ADMIN DASHBOARD
────────────────────────────────────────────── */
function loadAdminDashboard() {
  requireAdmin();
  const users = getUsers();
  const txns  = getTransactions();

  setText('adm-users',     users.length);
  setText('adm-txns',      txns.length);
  setText('adm-deposits',  formatMoney(txns.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0)));
  setText('adm-transfers', formatMoney(txns.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0)));

  // Users table
  const uBody = $('adm-users-tbody');
  if (uBody) {
    uBody.innerHTML = users.length
      ? users.map(u => `
          <tr>
            <td>${escapeHTML(u.name)}</td>
            <td>${escapeHTML(u.email)}</td>
            <td class="font-mono" style="font-size:0.8rem;">${u.accountNumber}</td>
            <td class="font-mono" style="font-size:0.72rem;">${u.iban}</td>
            <td style="color:var(--c-gold);font-weight:700;">${formatMoney(u.balance)}</td>
            <td>${formatDateShort(u.createdAt)}</td>
          </tr>`).join('')
      : '<tr><td colspan="6" class="no-data">No registered users yet.</td></tr>';
  }

  // Transactions table
  const tBody = $('adm-txns-tbody');
  if (tBody) {
    const recent = txns.slice(0, 60);
    tBody.innerHTML = recent.length
      ? recent.map(t => {
          const u = users.find(x => x.id === t.userId);
          return `
            <tr>
              <td>${formatDateShort(t.date)}</td>
              <td>${u ? escapeHTML(u.name) : '<em>Unknown</em>'}</td>
              <td style="font-size:0.8rem;">${escapeHTML(t.description)}</td>
              <td class="${t.type === 'credit' ? 'text-success' : 'text-error'}" style="font-weight:600;">
                ${t.type === 'credit' ? '+' : '−'}${formatMoney(t.amount)}
              </td>
              <td><span class="badge badge-success">${escapeHTML(t.status)}</span></td>
            </tr>`;
        }).join('')
      : '<tr><td colspan="5" class="no-data">No transactions yet.</td></tr>';
  }
}

function sendAnnouncement(message) {
  if (!message.trim()) return { ok: false, msg: 'Announcement message cannot be empty.' };
  getUsers().forEach(u => addNotification(u.id, `📢 Admin: ${message.trim()}`));
  return { ok: true };
}

/* ──────────────────────────────────────────────
   PAGE INITIALIZERS
────────────────────────────────────────────── */
function initHome() {
  // Animate counter numbers
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = parseFloat(el.dataset.count);
    const isDec  = String(target).includes('.');
    let cur = 0;
    const step = target / 70;
    const t = setInterval(() => {
      cur = Math.min(cur + step, target);
      el.textContent = isDec ? cur.toFixed(1) : Math.floor(cur).toLocaleString();
      if (cur >= target) clearInterval(t);
    }, 25);
  });
}

function initLogin() {
  const form = $('login-form');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const btn  = $('login-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Signing in…';
    setTimeout(() => {
      const res = loginUser($('login-email').value, $('login-password').value);
      if (res.ok) {
        showNotification('Welcome back! 🏦', `Hello, ${res.user.name}!`, 'success');
        setTimeout(() => window.location.href = 'dashboard.html', 900);
      } else {
        showAlert('login-alert', res.msg);
        btn.disabled = false; btn.textContent = 'Login to Account';
      }
    }, 600);
  });
}

function initRegister() {
  const form = $('reg-form');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const password = $('reg-pass').value;
    const confirm  = $('reg-confirm').value;
    if (password !== confirm)  { showAlert('reg-alert', 'Passwords do not match.'); return; }
    if (password.length < 6)   { showAlert('reg-alert', 'Password must be at least 6 characters.'); return; }
    const btn = $('reg-btn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Creating account…';
    setTimeout(() => {
      const res = registerUser($('reg-name').value, $('reg-email').value, password);
      if (res.ok) {
        setSession(res.user);
        showNotification('Account Created! 🎉', `Welcome, ${res.user.name}! Your starting balance is $10,000.`, 'success');
        setTimeout(() => window.location.href = 'dashboard.html', 1100);
      } else {
        showAlert('reg-alert', res.msg);
        btn.disabled = false; btn.textContent = 'Create My Account';
      }
    }, 800);
  });
}

function initDashboard() {
  loadDashboard();
  initHamburger();

  $('transfer-btn')  ?.addEventListener('click', () => openModal('transfer-modal'));
  $('close-modal')   ?.addEventListener('click', () => closeModal('transfer-modal'));
  $('download-btn')  ?.addEventListener('click', downloadStatement);
  $('logout-btn')    ?.addEventListener('click', logout);

  $('transfer-modal')?.addEventListener('click', e => {
    if (e.target.id === 'transfer-modal') closeModal('transfer-modal');
  });

  $('transfer-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const res = transferMoney(
      $('tr-name').value,
      $('tr-account').value,
      $('tr-amount').value,
    );
    if (res.ok) {
      closeModal('transfer-modal');
      $('transfer-form').reset();
      loadDashboard();
    } else {
      showAlert('transfer-alert', res.msg);
    }
  });
}

function initTransactions() {
  loadTransactionsPage();
  initHamburger();
  $('logout-btn')?.addEventListener('click', logout);
}

function initProfile() {
  loadProfile();
  initHamburger();
  $('logout-btn')?.addEventListener('click', logout);
  $('edit-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const res = updateProfile($('edit-name').value, $('edit-email').value);
    if (res.ok) loadProfile();
    else showAlert('prof-alert', res.msg);
  });
}

function initAdminLogin() {
  $('adm-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const btn = $('adm-btn');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Verifying…';
    setTimeout(() => {
      const res = loginAdmin($('adm-username').value, $('adm-password').value);
      if (res.ok) {
        showNotification('Access Granted 🔐', 'Redirecting to admin panel…', 'success');
        setTimeout(() => window.location.href = 'admin-dashboard.html', 800);
      } else {
        showAlert('adm-alert', res.msg);
        btn.disabled = false; btn.textContent = 'Admin Login';
      }
    }, 600);
  });
}

function initAdminDashboardPage() {
  requireAdmin();
  loadAdminDashboard();
  $('adm-logout')   ?.addEventListener('click', logoutAdmin);
  $('adm-refresh')  ?.addEventListener('click', () => { loadAdminDashboard(); showNotification('Refreshed', 'Data updated.', 'info'); });
  $('announce-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const res = sendAnnouncement($('announce-msg').value);
    if (res.ok) { $('announce-form').reset(); showNotification('Announcement Sent 📢', 'Notification delivered to all users.', 'success'); }
    else showAlert('announce-alert', res.msg);
  });
}

/* ──────────────────────────────────────────────
   BOOT — page detection via data-page attribute
────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  const map  = {
    'home':            initHome,
    'login':           initLogin,
    'register':        initRegister,
    'dashboard':       initDashboard,
    'transactions':    initTransactions,
    'profile':         initProfile,
    'admin-login':     initAdminLogin,
    'admin-dashboard': initAdminDashboardPage,
  };
  if (map[page]) map[page]();
});

// Khet2Ghar front-end. Flow: splash -> log in / sign up -> role -> account form -> home.
// The login is saved on this device, so the user is not asked to log in again.
// Firebase connection
const firebaseConfig = {
  apiKey: "AIzaSyDltn7KuX2BuY1QsYaLfUmJCuvqDdYEYpE",
  authDomain: "khet2ghar-e62f3.firebaseapp.com",
  projectId: "khet2ghar-e62f3",
  storageBucket: "khet2ghar-e62f3.firebasestorage.app",
  messagingSenderId: "689040100670",
  appId: "1:689040100670:web:9007604a3c83270c4cb06f"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const $ = (s) => document.querySelector(s);
const ICONS = { Vegetables: '🥬', Fruits: '🍎', Grains: '🌾', Pulses: '🫘', Dairy: '🥛', Other: '🧺' };
const NAME_ICONS = { tomato: '🍅', potato: '🥔', apple: '🍎', wheat: '🌾', onion: '🧅', mango: '🥭', banana: '🍌', carrot: '🥕', corn: '🌽', rice: '🍚', chilli: '🌶️', brinjal: '🍆' };
const SCREENS = ['auth', 'role', 'farmer', 'buyer', 'home'];
let crops = [], selected = null, splashDone = false;
let user = JSON.parse(localStorage.getItem('k2g_user') || 'null');

const money = (n) => '₹' + Number(n).toLocaleString('en-IN');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const iconFor = (c) => {
  const n = String(c.Crop).toLowerCase();
  const hit = Object.keys(NAME_ICONS).find((k) => n.includes(k));
  return hit ? NAME_ICONS[hit] : ICONS[c.Category] || '🧺';
};

function toast(msg, isError = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(toast.id);
  toast.id = setTimeout(() => (t.className = 'toast'), 3800);
}

// ==== BACKEND START ====
// Works with NO server, so it runs on GitHub Pages.
// Default: records are saved in this browser (localStorage). To share records between all
// visitors, paste your Google Apps Script Web App URL below (see README.md).
const CONFIG = {
  scriptUrl: '',          // Google Apps Script Web App URL (optional, shares records between visitors)
  mandiApiKey: '',        // free key from data.gov.in (My Account). Empty = the price board stays hidden
  mandiState: 'Gujarat'   // state whose mandi prices are shown
};

const TESTER = { user: 'MARCOS', name: 'Marcos (Tester)', salt: 'k2g-tester-salt-7f3a', hash: '68d3e67e624d307daea8a7e2a10228f179bb0270ad2c2a5ee71489b128935b1e' };
const bytesHex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha = async (pw, salt) => bytesHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + pw))));
const newSalt = () => bytesHex(crypto.getRandomValues(new Uint8Array(8)));
const stamp = () => new Date().toLocaleString('en-IN');
const bad = (message) => ({ ok: false, message });
const pad = (list, p) => p + String(list.length + 1).padStart(4, '0');

const Local = {
  load() {
    let db = null;
    try { db = JSON.parse(localStorage.getItem('k2g_db')); } catch (e) { /* start fresh */ }
    db = db || {};
    ['Farmers', 'Buyers', 'Crops', 'Orders'].forEach((k) => (db[k] = db[k] || []));
    if (!db.Farmers.some((u) => u.Username === TESTER.user)) {
      const auth = { Username: TESTER.user, Salt: TESTER.salt, 'Password Hash': TESTER.hash };
      db.Farmers.push({ ID: pad(db.Farmers, 'F'), 'Full Name': TESTER.name, Phone: '', Address: '', 'Bank / UPI': '', 'Registered On': stamp(), ...auth });
      db.Buyers.push({ ID: pad(db.Buyers, 'B'), 'Full Name / Company': TESTER.name, Phone: '', 'Delivery Address': '', GSTIN: '', 'Payment Method': 'UPI', 'Registered On': stamp(), ...auth });
    }
    return db;
  },
  async call(action, d = {}) {
    const db = this.load();
    const save = () => localStorage.setItem('k2g_db', JSON.stringify(db));
    const clean = (v) => String(v ?? '').trim();

    if (action === 'register') {
      const phone = clean(d.phone), username = clean(d.username), farmer = d.role === 'farmer';
      if (!clean(d.name) || !/^\d{10}$/.test(phone) || !clean(d.address)) return bad('Name, a 10-digit phone number and address are required.');
      if (!/^[A-Za-z0-9_.]{3,20}$/.test(username)) return bad('Username must be 3-20 letters, numbers, dot or underscore.');
      if (String(d.password || '').length < 6) return bad('Password must be at least 6 characters.');
      const all = [...db.Farmers, ...db.Buyers];
      if (all.some((u) => u.Username.toLowerCase() === username.toLowerCase())) return bad('This username is already taken.');
      if (all.some((u) => String(u.Phone) === phone)) return bad('This phone number is already registered.');
      const salt = newSalt(), auth = { Username: username, Salt: salt, 'Password Hash': await sha(String(d.password), salt) };
      const list = farmer ? db.Farmers : db.Buyers, id = pad(list, farmer ? 'F' : 'B');
      list.push(farmer
        ? { ID: id, 'Full Name': clean(d.name), Phone: phone, Address: clean(d.address), 'Bank / UPI': clean(d.bank), 'Registered On': stamp(), ...auth }
        : { ID: id, 'Full Name / Company': clean(d.name), Phone: phone, 'Delivery Address': clean(d.address), GSTIN: clean(d.gstin), 'Payment Method': clean(d.payment), 'Registered On': stamp(), ...auth });
      save();
      return { ok: true, id, name: clean(d.name) };
    }

    if (action === 'login') {
      const un = clean(d.username).toLowerCase();
      const f = db.Farmers.find((u) => u.Username.toLowerCase() === un), b = db.Buyers.find((u) => u.Username.toLowerCase() === un);
      const acc = f || b;
      if (!acc || (await sha(String(d.password || ''), acc.Salt)) !== acc['Password Hash']) return bad('Wrong username or password.');
      if (un === TESTER.user.toLowerCase()) return { ok: true, id: f.ID, farmerId: f.ID, buyerId: b.ID, name: TESTER.name, role: 'tester' };
      return { ok: true, id: acc.ID, name: acc['Full Name'] || acc['Full Name / Company'], role: f ? 'farmer' : 'buyer' };
    }

    if (action === 'crops') return db.Crops.filter((c) => Number(c['Quantity (kg)']) > 0);

    if (action === 'addCrop') {
      const price = Number(d.price), qty = Number(d.quantity);
      if (!clean(d.crop) || !(price > 0) || !(qty > 0)) return bad('Crop name, price and quantity are required.');
      const farmer = db.Farmers.find((f) => f.ID === clean(d.farmerId).toUpperCase());
      if (!farmer) return bad('Farmer ID not found. Please register or log in first.');
      const id = pad(db.Crops, 'C');
      db.Crops.push({ ID: id, 'Farmer ID': farmer.ID, 'Farmer Name': farmer['Full Name'], Crop: clean(d.crop), Category: clean(d.category), 'Price (Rs/kg)': price, 'Quantity (kg)': qty, Location: clean(d.location) || farmer.Address || '', 'Listed On': stamp() });
      save();
      return { ok: true, id };
    }

    if (action === 'order') {
      const qty = Number(d.quantity);
      if (!(qty > 0)) return bad('Enter a valid quantity.');
      const buyer = db.Buyers.find((b) => b.ID === clean(d.buyerId).toUpperCase());
      if (!buyer) return bad('Buyer ID not found. Please register or log in first.');
      const crop = db.Crops.find((c) => c.ID === d.cropId);
      if (!crop) return bad('This listing is no longer available.');
      const stock = Number(crop['Quantity (kg)']);
      if (qty > stock) return bad(`Only ${stock} kg available.`);
      crop['Quantity (kg)'] = stock - qty;
      const total = qty * Number(crop['Price (Rs/kg)']), id = pad(db.Orders, 'O');
      db.Orders.push({ ID: id, 'Buyer ID': buyer.ID, 'Buyer Name': buyer['Full Name / Company'], 'Crop ID': crop.ID, Crop: crop.Crop, 'Farmer ID': crop['Farmer ID'], 'Quantity (kg)': qty, 'Total (Rs)': total, Payment: buyer['Payment Method'] || 'UPI', Status: 'Confirmed', 'Ordered On': stamp() });
      save();
      return { ok: true, id, total };
    }
    return bad('Unknown action.');
  }
};

// Google Sheets mode: the Apps Script (google-apps-script/Code.gs) is the backend
const Remote = {
  async call(action, d = {}) {
    const res = await fetch(CONFIG.scriptUrl, { method: 'POST', body: JSON.stringify({ action, ...d }) });
    return res.json();
  }
};

async function api(url, data) {
  let action = 'crops', extra = {};
  if (url.startsWith('/api/register/')) { action = 'register'; extra = { role: url.split('/').pop() }; }
  else if (url === '/api/login') action = 'login';
  else if (url === '/api/orders') action = 'order';
  else if (url === '/api/crops') action = data ? 'addCrop' : 'crops';
  const r = await (CONFIG.scriptUrl ? Remote : Local).call(action, { ...data, ...extra });
  if (r && r.ok === false) throw new Error(r.message);
  return r;
}
// ==== BACKEND END ====

/* ---------- Routing between screens ---------- */
function route() {
  if (!splashDone) return;
  let name = (location.hash.match(/^#\/(\w+)/) || [])[1];
  if (!SCREENS.includes(name)) name = null;
  if (user) name = 'home';                 // logged-in users never see login/sign-up again
  else if (!name || name === 'home') name = 'auth';
  SCREENS.forEach((s) => ($('#' + s).hidden = s !== name));
  if (name === 'home') { renderHome(); loadCrops(); }
  if (!location.hash.startsWith('#/') || (user && location.hash !== '#/home' && !/^#(market|sell|how|top)$/.test(location.hash)))
    history.replaceState(null, '', user ? '#/home' : '#/' + name);
  if (name !== 'home') window.scrollTo(0, 0);
}
window.addEventListener('hashchange', () => {
  if (/^#(market|sell|how|top)$/.test(location.hash)) return; // in-page anchors on home
  route();
});

function setUser(u) { user = u; localStorage.setItem('k2g_user', JSON.stringify(u)); location.hash = '#/home'; route(); }
function logout() { user = null; localStorage.removeItem('k2g_user'); location.hash = '#/auth'; route(); toast('You have logged out.'); }

function renderHome() {
  const farmer = user.role !== 'buyer';
  $('#session').innerHTML = `<span>${esc(user.name)} <small>(${esc(user.id)})</small></span><button class="btn small ghost" id="out">Log out</button>`;
  $('#out').onclick = logout;
  $('#exportBtn').hidden = !(user.role === 'tester' && !CONFIG.scriptUrl);
  $('#greet').textContent = `Namaste, ${user.name.split(' ')[0]}. ${farmer ? 'Your crops, your price.' : 'Fresh produce is waiting.'}`;
  ['#sell', '#sellLink', '#heroSell'].forEach((s) => ($(s).hidden = !farmer));
}

/* ---------- Splash ---------- */
function startSplash() {
  const finish = () => {
    $('#splash').classList.add('done');
    splashDone = true;
    route();
  };
  setTimeout(finish, matchMedia('(prefers-reduced-motion: reduce)').matches ? 600 : 3400);
}

/* ---------- Log in / Sign up tabs ---------- */
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === t));
  $('#loginForm').hidden = t.dataset.tab !== 'login';
  $('#signupBox').hidden = t.dataset.tab !== 'signup';
}));

/* ---------- Forms ---------- */
function validate(form) {
  let ok = true;
  form.querySelectorAll('[required]').forEach((el) => {
    const v = el.value.trim();
    const bad = !v || (el.name === 'phone' && !/^\d{10}$/.test(v)) ||
      (el.name === 'username' && form.id !== 'loginForm' && !/^[A-Za-z0-9_.]{3,20}$/.test(v)) ||
      (el.name === 'password' && form.id !== 'loginForm' && el.value.length < 6);
    el.classList.toggle('invalid', bad);
    if (bad) ok = false;
  });
  if (!ok) toast('Please fix the highlighted fields. Phone: 10 digits. Username: 3-20 letters or numbers. Password: 6+ characters.', true);
  return ok;
}

async function submit(form, fn) {
  if (!validate(form)) return;
  const btn = form.querySelector('button[type=submit]');
  const label = btn.textContent;
  btn.disabled = true; btn.textContent = 'Saving…';
  try { await fn(Object.fromEntries(new FormData(form))); }
  catch (e) { toast(e instanceof TypeError ? 'Cannot reach the database. Check your internet connection and the scriptUrl in script.js.' : e.message, true); }
  btn.disabled = false; btn.textContent = label;
}


['farmer', 'buyer'].forEach((role) => {
  const form = $(`#${role}Form`);

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    submit(form, async (data) => {
      try {
        const credential = await auth.createUserWithEmailAndPassword(
          data.email,
          data.password
        );

        const uid = credential.user.uid;

        await db.collection('users').doc(uid).set({
          name: data.name,
          email: data.email,
          username: data.username,
          phone: data.phone,
          address: data.address,
          role: role,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        form.reset();

        setUser({
          id: uid,
          name: data.name,
          role: role,
          email: data.email
        });

        toast('Account created successfully!');
      } catch (error) {
        console.error('Signup error:', error);
        toast(
          error.code === 'auth/email-already-in-use'
            ? 'This email is already registered.'
            : error.code === 'auth/weak-password'
            ? 'Password must be at least 6 characters.'
            : 'Signup failed. Please check your details and try again.'
        );
      }
    });
  });
});


$('#loginForm').addEventListener('submit', (e) => {
  e.preventDefault();

  submit(e.target, async (data) => {
    try {
      const credential = await auth.signInWithEmailAndPassword(
        data.email,
        data.password
      );

      const uid = credential.user.uid;

      const doc = await db.collection('users').doc(uid).get();

      if (!doc.exists) {
        await auth.signOut();
        toast('User profile not found. Please sign up again.');
        return;
      }

      const profile = doc.data();

      e.target.reset();

      setUser({
        id: uid,
        name: profile.name,
        role: profile.role,
        email: profile.email
      });

      toast('Login successful!');
    } catch (error) {
      console.error('Login error:', error);

      toast(
        error.code === 'auth/invalid-credential' ||
        error.code === 'auth/user-not-found' ||
        error.code === 'auth/wrong-password'
          ? 'Email or password is incorrect.'
          : 'Login failed. Please try again.'
      );
    }
  });
});


/* ---------- Marketplace ---------- */
async function loadCrops() {
  try { crops = await api('/api/crops'); if (!Array.isArray(crops)) throw new Error(); }
  catch { crops = []; $('#stats').textContent = 'Could not load listings. Check your internet connection.'; }
  renderCrops();
}

function renderCrops() {
  const q = $('#q').value.toLowerCase(), cat = $('#cat').value, loc = $('#loc').value.toLowerCase(), sort = $('#sort').value;
  const list = crops.filter((c) =>
    String(c.Crop).toLowerCase().includes(q) && (!cat || c.Category === cat) && String(c.Location).toLowerCase().includes(loc));
  if (sort === 'low') list.sort((a, b) => a['Price (Rs/kg)'] - b['Price (Rs/kg)']);
  else if (sort === 'high') list.sort((a, b) => b['Price (Rs/kg)'] - a['Price (Rs/kg)']);
  else list.reverse();

  $('#stats').textContent = `${crops.length} live listing${crops.length === 1 ? '' : 's'} from ${new Set(crops.map((c) => c['Farmer ID'])).size} farmer(s).`;
  const canOrder = user && user.role !== 'farmer';
  $('#grid').innerHTML = list.length ? list.map((c) => `
    <article class="crop">
      <div class="pic" aria-hidden="true">${iconFor(c)}</div>
      <div class="body">
        <h3>${esc(c.Crop)}</h3>
        <div class="price">${money(c['Price (Rs/kg)'])}<small> / kg</small></div>
        <div class="meta">${esc(c['Quantity (kg)'])} kg available · ${esc(c.Category)}</div>
        <div class="meta">${esc(c['Farmer Name'])}${c.Location ? ', ' + esc(c.Location) : ''}</div>
        ${canOrder ? `<button class="btn dark" data-id="${esc(c.ID)}">Order now</button>` : ''}
      </div>
    </article>`).join('')
    : '<div class="empty">No produce matches yet. Farmers can add listings and they will appear here.</div>';
}

['#q', '#cat', '#loc', '#sort'].forEach((s) => $(s).addEventListener('input', renderCrops));

$('#grid').addEventListener('click', (e) => {
  const id = e.target.dataset.id;
  if (!id) return;
  selected = crops.find((c) => c.ID === id);
  $('#orderTitle').textContent = `Order ${selected.Crop}`;
  $('#orderInfo').textContent = `${money(selected['Price (Rs/kg)'])} per kg · ${selected['Quantity (kg)']} kg available`;
  $('#orderQty').value = ''; $('#orderQty').max = selected['Quantity (kg)'];
  $('#orderTotal').textContent = money(0);
  $('#orderDlg').showModal();
});

$('#orderQty').addEventListener('input', (e) => {
  $('#orderTotal').textContent = money((Number(e.target.value) || 0) * selected['Price (Rs/kg)']);
});

$('#orderForm').addEventListener('submit', async (e) => {
  if (e.submitter?.value !== 'ok') return;
  e.preventDefault();
  try {
    const r = await api('/api/orders', { buyerId: user.buyerId || user.id, cropId: selected.ID, quantity: $('#orderQty').value });
    $('#orderDlg').close();
    toast(`Order ${r.id} confirmed. Total ${money(r.total)}. The farmer has been notified.`);
    loadCrops();
  } catch (err) { toast(err.message, true); }
});

$('#exportBtn').addEventListener('click', () => {
  if (typeof XLSX === 'undefined') return toast('Excel library did not load. Check your internet connection.', true);
  const db = Local.load(), wb = XLSX.utils.book_new();
  Object.keys(db).forEach((k) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(db[k].map(({ Salt, 'Password Hash': h, ...r }) => r)), k));
  XLSX.writeFile(wb, 'khet2ghar-records.xlsx');
});

/* ---------- Real mandi prices (Agmarknet via data.gov.in). Nothing is shown when there is no data. ---------- */
const MANDI_ITEMS = [['Tomato', '🍅'], ['Potato', '🥔'], ['Onion', '🧅'], ['Apple', '🍎'], ['Wheat', '🌾']];
async function loadMandi() {
  if (!CONFIG.mandiApiKey) return;
  const toDate = (s) => { const [d, m, y] = String(s).split('/').map(Number); return new Date(y, m - 1, d).getTime(); };
  const results = await Promise.all(MANDI_ITEMS.map(async ([name, icon]) => {
    try {
      const q = new URLSearchParams({ 'api-key': CONFIG.mandiApiKey, format: 'json', limit: '200', 'filters[state]': CONFIG.mandiState, 'filters[commodity]': name });
      const res = await fetch('https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070?' + q);
      const recs = ((await res.json()).records || []).filter((r) => Number(r.modal_price) > 0 && r.arrival_date);
      if (!recs.length) return null;
      const latest = Math.max(...recs.map((r) => toDate(r.arrival_date)));
      if (!(Date.now() - latest < 7 * 864e5)) return null; // too old to call current
      const day = recs.filter((r) => toDate(r.arrival_date) === latest);
      const mins = day.map((r) => Number(r.min_price)).filter((v) => v > 0), maxs = day.map((r) => Number(r.max_price)).filter((v) => v > 0);
      return { name, icon, latest, n: day.length, modal: day.reduce((s, r) => s + Number(r.modal_price), 0) / day.length,
        min: mins.length ? Math.min(...mins) : null, max: maxs.length ? Math.max(...maxs) : null };
    } catch (e) { return null; }
  }));
  const ok = results.filter(Boolean);
  if (!ok.length) return;
  const kg = (v) => '₹' + (v / 100).toFixed(1).replace(/\.0$/, ''); // data is per quintal (100 kg)
  const dt = (t) => new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  $('#mandiList').innerHTML = ok.map((r) => `<li><span>${r.icon} ${r.name}<small>${r.min && r.max ? kg(r.min) + ' to ' + kg(r.max) + ' · ' : ''}${r.n} market${r.n > 1 ? 's' : ''} · ${dt(r.latest)}</small></span><b>${kg(r.modal)}/kg</b></li>`).join('');
  $('#mandiNote').textContent = `Average wholesale (modal) price in ${CONFIG.mandiState} mandis. Source: Agmarknet, Government of India.`;
  $('#mandi').hidden = false;
  $('.hero').classList.remove('solo');
}

loadMandi();
startSplash();

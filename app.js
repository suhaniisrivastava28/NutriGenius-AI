/**
 * NutriGenius AI — Frontend Application
 * IBM Watsonx.ai Powered Nutrition & Fitness Agent
 */

/* ──────────────────────────────────────────────────────────────────────────
   STATE
   ────────────────────────────────────────────────────────────────────────── */
let chatHistory   = [];
let userProfile   = {};
let familyMembers = [];
let isListening   = false;
let recognition   = null;
let scannerImageB64 = '';

/* ──────────────────────────────────────────────────────────────────────────
   INIT
   ────────────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initDarkMode();
  initSidebar();
  initChatInput();
  initVoice();
  initImageUpload();
  loadProfile();
  loadFamilyMembers();
  addDefaultFamilyMembers();
});

/* ──────────────────────────────────────────────────────────────────────────
   NAVIGATION
   ────────────────────────────────────────────────────────────────────────── */
const sectionTitles = {
  chat:      'AI Chat Assistant',
  dashboard: 'Nutrition Dashboard',
  mealplan:  'AI Meal Planner',
  calorie:   'Calorie Counter',
  scanner:   'AI Food Scanner',
  yoga:      'Yoga Routine Builder',
  bmi:       'BMI Calculator',
  family:    'Family Diet Planner',
  profile:   'My Profile',
};

function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const sec = item.dataset.section;
      switchSection(sec);
      // close sidebar on mobile
      if (window.innerWidth <= 768) closeSidebar();
    });
  });
}

function switchSection(key) {
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));

  const navItem = document.querySelector(`.nav-item[data-section="${key}"]`);
  const section = document.getElementById(`section-${key}`);
  if (navItem) navItem.classList.add('active');
  if (section) section.classList.add('active');

  const title = document.getElementById('topbarTitle');
  if (title) title.textContent = sectionTitles[key] || key;
}

/* ──────────────────────────────────────────────────────────────────────────
   SIDEBAR (mobile)
   ────────────────────────────────────────────────────────────────────────── */
function initSidebar() {
  const toggle  = document.getElementById('menuToggle');
  const close   = document.getElementById('sidebarClose');
  const overlay = document.getElementById('overlay');
  const sidebar = document.getElementById('sidebar');

  toggle ?.addEventListener('click', () => openSidebar());
  close  ?.addEventListener('click', () => closeSidebar());
  overlay?.addEventListener('click', () => closeSidebar());
}

function openSidebar() {
  document.getElementById('sidebar')?.classList.add('open');
  document.getElementById('overlay')?.classList.add('show');
}
function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('overlay')?.classList.remove('show');
}

/* ──────────────────────────────────────────────────────────────────────────
   DARK MODE
   ────────────────────────────────────────────────────────────────────────── */
function initDarkMode() {
  const toggle = document.getElementById('darkModeToggle');
  const saved  = localStorage.getItem('nutrigenius-theme');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    toggle.checked = true;
  }
  toggle?.addEventListener('change', () => {
    const theme = toggle.checked ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('nutrigenius-theme', theme);
  });
}

/* ──────────────────────────────────────────────────────────────────────────
   CHAT
   ────────────────────────────────────────────────────────────────────────── */
function initChatInput() {
  const input = document.getElementById('chatInput');
  input?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  // Auto-resize textarea
  input?.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 140) + 'px';
  });
}

async function sendMessage() {
  const input = document.getElementById('chatInput');
  const msg   = input.value.trim();
  if (!msg) return;

  appendMessage('user', msg);
  input.value = '';
  input.style.height = 'auto';
  addRecentTopic(msg);
  showTyping(true);

  const profile = buildCurrentProfile();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, history: chatHistory, profile })
    });
    const data = await res.json();

    if (data.error) throw new Error(data.error);

    chatHistory.push({ role: 'user', content: msg });
    chatHistory.push({ role: 'assistant', content: data.response });
    if (chatHistory.length > 20) chatHistory = chatHistory.slice(-20);

    showTyping(false);
    appendMessage('bot', data.response);
  } catch (err) {
    showTyping(false);
    appendMessage('bot', `⚠️ Error: ${err.message}. Please check your IBM API credentials in the .env file.`);
  }
}

function sendQuick(msg) {
  document.getElementById('chatInput').value = msg;
  sendMessage();
}

function appendMessage(role, text) {
  const container = document.getElementById('chatMessages');
  const wrap = document.createElement('div');
  wrap.className = `msg-wrap ${role === 'bot' ? 'bot-wrap' : 'user-wrap'}`;

  const avatarDiv = document.createElement('div');
  avatarDiv.className = `msg-avatar ${role === 'bot' ? 'bot-avatar' : 'user-avatar'}`;
  avatarDiv.innerHTML = role === 'bot'
    ? '<i class="fa-solid fa-leaf"></i>'
    : '<i class="fa-solid fa-user"></i>';

  const bubble = document.createElement('div');
  bubble.className = `msg-bubble ${role === 'bot' ? 'bot-bubble' : 'user-bubble'}`;

  // Render markdown-like formatting
  bubble.innerHTML = renderMarkdown(text);

  const time = document.createElement('span');
  time.className = 'msg-time';
  time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  bubble.appendChild(time);

  wrap.appendChild(avatarDiv);
  wrap.appendChild(bubble);
  container.appendChild(wrap);
  container.scrollTop = container.scrollHeight;
}

function showTyping(show) {
  const el = document.getElementById('typingIndicator');
  el?.classList.toggle('hidden', !show);
  if (show) {
    const cont = document.getElementById('chatMessages');
    if (cont) cont.scrollTop = cont.scrollHeight;
  }
}

function addRecentTopic(msg) {
  const list = document.getElementById('recentList');
  if (!list) return;
  const placeholder = list.querySelector('.muted-text');
  if (placeholder) placeholder.remove();

  const item = document.createElement('div');
  item.style.cssText = 'font-size:12px;color:var(--text-2);padding:6px 8px;border-radius:6px;cursor:pointer;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;';
  item.textContent = '💬 ' + msg.slice(0, 38) + (msg.length > 38 ? '…' : '');
  item.onclick = () => { document.getElementById('chatInput').value = msg; switchSection('chat'); };
  item.onmouseover = () => { item.style.background = 'var(--surface-2)'; };
  item.onmouseout  = () => { item.style.background = ''; };
  list.insertBefore(item, list.firstChild);

  // Keep only last 6
  while (list.children.length > 6) list.removeChild(list.lastChild);
}

/* ──────────────────────────────────────────────────────────────────────────
   MARKDOWN RENDERER (lightweight)
   ────────────────────────────────────────────────────────────────────────── */
function renderMarkdown(text) {
  if (!text) return '';
  let html = escapeHtml(text);

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h4 style="font-weight:600;margin:12px 0 6px;color:var(--text)">$1</h4>');
  html = html.replace(/^## (.+)$/gm,  '<h3 style="font-weight:700;margin:14px 0 6px;font-family:Poppins,sans-serif">$1</h3>');
  html = html.replace(/^# (.+)$/gm,   '<h2 style="font-weight:700;margin:16px 0 8px;font-family:Poppins,sans-serif">$1</h2>');

  // Bold & italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g,    '<em>$1</em>');

  // Tables
  html = renderTables(html);

  // Unordered lists
  html = html.replace(/((?:^[-*•] .+\n?)+)/gm, match => {
    const items = match.trim().split('\n').map(l => `<li style="margin:3px 0">${l.replace(/^[-*•] /, '')}</li>`).join('');
    return `<ul style="margin:8px 0 8px 20px;list-style:disc">${items}</ul>`;
  });

  // Ordered lists
  html = html.replace(/((?:^\d+\. .+\n?)+)/gm, match => {
    const items = match.trim().split('\n').map(l => `<li style="margin:4px 0">${l.replace(/^\d+\. /, '')}</li>`).join('');
    return `<ol style="margin:8px 0 8px 20px">${items}</ol>`;
  });

  // Code inline
  html = html.replace(/`([^`]+)`/g, '<code style="background:var(--surface-2);padding:2px 6px;border-radius:4px;font-size:12px">$1</code>');

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--border);margin:12px 0" />');

  // Line breaks
  html = html.replace(/\n/g, '<br />');

  return html;
}

function renderTables(html) {
  // Simple markdown table rendering
  const tableRegex = /((?:\|.+\|\n?)+)/g;
  return html.replace(tableRegex, match => {
    const rows = match.trim().split('<br />').filter(r => r.includes('|'));
    if (rows.length < 2) return match;

    let tableHtml = '<div style="overflow-x:auto;margin:12px 0"><table style="width:100%;border-collapse:collapse;font-size:13px">';
    rows.forEach((row, idx) => {
      if (row.includes('---')) return; // separator row
      const cells = row.split('|').filter(c => c.trim());
      const tag   = idx === 0 ? 'th' : 'td';
      const style = idx === 0
        ? 'background:var(--surface-2);padding:8px 12px;text-align:left;font-weight:600;border-bottom:2px solid var(--border)'
        : 'padding:8px 12px;border-bottom:1px solid var(--border)';
      tableHtml += '<tr>' + cells.map(c => `<${tag} style="${style}">${c.trim()}</${tag}>`).join('') + '</tr>';
    });
    tableHtml += '</table></div>';
    return tableHtml;
  });
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ──────────────────────────────────────────────────────────────────────────
   PROFILE HELPERS
   ────────────────────────────────────────────────────────────────────────── */
function buildCurrentProfile() {
  const conditions = [];
  if (document.getElementById('cond-diabetes')?.checked) conditions.push('Diabetes');
  if (document.getElementById('cond-bp')?.checked)       conditions.push('Hypertension');
  if (document.getElementById('cond-pcod')?.checked)     conditions.push('PCOD/PCOS');
  if (document.getElementById('cond-thyroid')?.checked)  conditions.push('Thyroid');
  if (document.getElementById('cond-heart')?.checked)    conditions.push('Heart Disease');

  const allergies = [];
  if (document.getElementById('allergy-nuts')?.checked)   allergies.push('Nuts');
  if (document.getElementById('allergy-gluten')?.checked) allergies.push('Gluten');
  if (document.getElementById('allergy-dairy')?.checked)  allergies.push('Dairy');
  if (document.getElementById('allergy-eggs')?.checked)   allergies.push('Eggs');

  return {
    ...userProfile,
    goal:       document.getElementById('quickGoal')?.value || userProfile.goal,
    diet_type:  document.getElementById('quickDiet')?.value || userProfile.diet_type,
    conditions: conditions.length ? conditions : userProfile.conditions,
    allergies:  allergies.length  ? allergies  : userProfile.allergies,
  };
}

function applyQuickProfile() {
  userProfile = buildCurrentProfile();
  showToast('Profile applied to chat! ✓', 'success');
}

function saveProfile() {
  const conditions = [];
  if (document.getElementById('p-diabetes')?.checked)  conditions.push('Diabetes');
  if (document.getElementById('p-bp')?.checked)        conditions.push('Hypertension');
  if (document.getElementById('p-pcod')?.checked)      conditions.push('PCOD/PCOS');
  if (document.getElementById('p-thyroid')?.checked)   conditions.push('Thyroid');
  if (document.getElementById('p-heart')?.checked)     conditions.push('Heart Disease');
  if (document.getElementById('p-ibs')?.checked)       conditions.push('IBS');

  const allergies = [];
  if (document.getElementById('p-nuts')?.checked)      allergies.push('Nuts');
  if (document.getElementById('p-gluten')?.checked)    allergies.push('Gluten');
  if (document.getElementById('p-dairy')?.checked)     allergies.push('Dairy');
  if (document.getElementById('p-eggs')?.checked)      allergies.push('Eggs');
  if (document.getElementById('p-soy')?.checked)       allergies.push('Soy');
  if (document.getElementById('p-shellfish')?.checked) allergies.push('Shellfish');

  userProfile = {
    name:      document.getElementById('profName')?.value,
    age:       document.getElementById('profAge')?.value,
    gender:    document.getElementById('profGender')?.value,
    weight:    document.getElementById('profWeight')?.value,
    height:    document.getElementById('profHeight')?.value,
    goal:      document.getElementById('profGoal')?.value,
    diet_type: document.getElementById('profDiet')?.value,
    activity:  document.getElementById('profActivity')?.value,
    cuisine:   document.getElementById('profCuisine')?.value,
    language:  document.getElementById('profLang')?.value,
    religion:  document.getElementById('profReligion')?.value,
    conditions,
    allergies,
  };

  localStorage.setItem('nutrigenius-profile', JSON.stringify(userProfile));

  // Update avatar initial
  const av = document.querySelector('.avatar');
  if (av && userProfile.name) av.textContent = userProfile.name.charAt(0).toUpperCase();

  showToast('Profile saved successfully! ✓', 'success');
}

function loadProfile() {
  const saved = localStorage.getItem('nutrigenius-profile');
  if (!saved) return;
  try {
    userProfile = JSON.parse(saved);
    // Populate form fields
    const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
    set('profName',     userProfile.name);
    set('profAge',      userProfile.age);
    set('profGender',   userProfile.gender);
    set('profWeight',   userProfile.weight);
    set('profHeight',   userProfile.height);
    set('profGoal',     userProfile.goal);
    set('profDiet',     userProfile.diet_type);
    set('profActivity', userProfile.activity);
    set('profCuisine',  userProfile.cuisine);
    set('profLang',     userProfile.language);
    set('profReligion', userProfile.religion);

    const setCheck = (id, arr, val) => {
      const el = document.getElementById(id);
      if (el && arr) el.checked = arr.includes(val);
    };
    setCheck('p-diabetes', userProfile.conditions, 'Diabetes');
    setCheck('p-bp',       userProfile.conditions, 'Hypertension');
    setCheck('p-pcod',     userProfile.conditions, 'PCOD/PCOS');
    setCheck('p-thyroid',  userProfile.conditions, 'Thyroid');
    setCheck('p-heart',    userProfile.conditions, 'Heart Disease');
    setCheck('p-ibs',      userProfile.conditions, 'IBS');
    setCheck('p-nuts',     userProfile.allergies,  'Nuts');
    setCheck('p-gluten',   userProfile.allergies,  'Gluten');
    setCheck('p-dairy',    userProfile.allergies,  'Dairy');
    setCheck('p-eggs',     userProfile.allergies,  'Eggs');
    setCheck('p-soy',      userProfile.allergies,  'Soy');
    setCheck('p-shellfish',userProfile.allergies,  'Shellfish');

    const av = document.querySelector('.avatar');
    if (av && userProfile.name) av.textContent = userProfile.name.charAt(0).toUpperCase();
  } catch {}
}

/* ──────────────────────────────────────────────────────────────────────────
   MEAL PLAN
   ────────────────────────────────────────────────────────────────────────── */
async function generateMealPlan() {
  const btn = document.getElementById('mpBtn');
  setLoading(btn, true, 'Generating Meal Plan…');
  showResultLoading('mpResult');

  const prefs = {
    calories:      document.getElementById('mpCalories')?.value,
    diet_style:    document.getElementById('mpDiet')?.value,
    cuisine:       document.getElementById('mpCuisine')?.value,
    special_notes: document.getElementById('mpSpecial')?.value,
  };

  try {
    const res  = await fetch('/api/meal-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: userProfile, preferences: prefs })
    });
    const data = await res.json();
    showResult('mpResult', data.meal_plan || data.error);
  } catch (err) {
    showResult('mpResult', '⚠️ Error: ' + err.message);
  } finally {
    setLoading(btn, false, '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Full Day Meal Plan');
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   CALORIE COUNTER
   ────────────────────────────────────────────────────────────────────────── */
function addFoodEntry() {
  const list  = document.getElementById('foodList');
  const entry = document.createElement('div');
  entry.className = 'food-entry';
  entry.innerHTML = `
    <input type="text" class="form-control food-name" placeholder="Food item" />
    <input type="text" class="form-control food-qty"  placeholder="Quantity" />
    <button class="btn-icon-danger" onclick="removeFoodEntry(this)"><i class="fa-solid fa-trash"></i></button>
  `;
  list.appendChild(entry);
}

function removeFoodEntry(btn) {
  const entry = btn.closest('.food-entry');
  const list  = document.getElementById('foodList');
  if (list.querySelectorAll('.food-entry').length > 1) entry.remove();
}

async function analyzeCalories() {
  const entries = document.querySelectorAll('#foodList .food-entry');
  const foods = [];
  entries.forEach(e => {
    const name = e.querySelector('.food-name')?.value.trim();
    const qty  = e.querySelector('.food-qty')?.value.trim();
    if (name) foods.push({ name, quantity: qty || '1 serving' });
  });

  if (foods.length === 0) { showToast('Add at least one food item!', 'error'); return; }

  const btn = document.getElementById('calBtn');
  setLoading(btn, true, 'Analysing…');
  showResultLoading('calResult');

  try {
    const res  = await fetch('/api/calorie-counter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ foods, profile: userProfile })
    });
    const data = await res.json();
    showResult('calResult', data.analysis || data.error);
  } catch (err) {
    showResult('calResult', '⚠️ Error: ' + err.message);
  } finally {
    setLoading(btn, false, '<i class="fa-solid fa-calculator"></i> Analyse Calories & Macros');
  }
}

async function lookupNutrition() {
  const food = document.getElementById('lookupFood')?.value.trim();
  const qty  = document.getElementById('lookupQty')?.value.trim() || '100g';
  if (!food) { showToast('Enter a food item to lookup!', 'error'); return; }

  showResultLoading('calResult');
  try {
    const res  = await fetch('/api/nutrition-facts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ food, quantity: qty })
    });
    const data = await res.json();
    showResult('calResult', data.facts || data.error);
  } catch (err) {
    showResult('calResult', '⚠️ Error: ' + err.message);
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   FOOD SCANNER
   ────────────────────────────────────────────────────────────────────────── */
function initImageUpload() {
  const zone    = document.getElementById('uploadZone');
  const fileIn  = document.getElementById('scannerFile');
  const imgBtn  = document.getElementById('imageUploadBtn');
  const chatImg = document.getElementById('imageFileInput');

  // Drag & drop for scanner
  zone?.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor = 'var(--accent-blue)'; });
  zone?.addEventListener('dragleave', () => { zone.style.borderColor = ''; });
  zone?.addEventListener('drop', e => {
    e.preventDefault();
    zone.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file) processImageFile(file, 'scanner');
  });

  imgBtn?.addEventListener('click', () => chatImg?.click());
  chatImg?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) {
      switchSection('scanner');
      processImageFile(file, 'scanner');
    }
  });
}

function handleScannerFile(e) {
  const file = e.target.files[0];
  if (file) processImageFile(file, 'scanner');
}

function processImageFile(file, target) {
  if (!file.type.startsWith('image/')) { showToast('Please upload an image file!', 'error'); return; }
  if (file.size > 5 * 1024 * 1024) { showToast('Image must be under 5MB!', 'error'); return; }

  const reader = new FileReader();
  reader.onload = e => {
    scannerImageB64 = e.target.result.split(',')[1]; // base64 only
    const preview = document.getElementById('imagePreview');
    const img     = document.getElementById('previewImg');
    if (preview && img) {
      img.src = e.target.result;
      preview.style.display = 'block';
    }
    showToast('Image loaded! Click Analyse to process.', 'success');
  };
  reader.readAsDataURL(file);
}

async function analyzeFood() {
  const desc = document.getElementById('scanDesc')?.value.trim();
  if (!scannerImageB64 && !desc) {
    showToast('Upload an image or describe your food!', 'error');
    return;
  }

  const btn = document.getElementById('scanBtn');
  setLoading(btn, true, 'Analysing…');
  showResultLoading('scanResult');

  try {
    const res  = await fetch('/api/analyze-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: scannerImageB64, description: desc, profile: userProfile })
    });
    const data = await res.json();
    showResult('scanResult', data.analysis || data.error);
  } catch (err) {
    showResult('scanResult', '⚠️ Error: ' + err.message);
  } finally {
    setLoading(btn, false, '<i class="fa-solid fa-wand-magic-sparkles"></i> Analyse Food / Label');
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   YOGA ROUTINE
   ────────────────────────────────────────────────────────────────────────── */
function selectYogaProfile(card) {
  document.querySelectorAll('.yoga-profile-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  const prof = document.getElementById('yogaProfile');
  if (prof) prof.value = card.dataset.profile;
}

async function generateYogaRoutine() {
  const btn = document.getElementById('yogaBtn');
  setLoading(btn, true, 'Building Routine…');
  showResultLoading('yogaResult');

  const body = {
    profile_type: document.getElementById('yogaProfile')?.value || 'Beginners',
    duration:     document.getElementById('yogaDuration')?.value || 30,
    focus:        document.getElementById('yogaFocus')?.value    || 'General Wellness',
    profile:      userProfile,
  };

  try {
    const res  = await fetch('/api/yoga-routine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    showResult('yogaResult', data.routine || data.error);
  } catch (err) {
    showResult('yogaResult', '⚠️ Error: ' + err.message);
  } finally {
    setLoading(btn, false, '<i class="fa-solid fa-person-praying"></i> Generate My Routine');
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   BMI CALCULATOR
   ────────────────────────────────────────────────────────────────────────── */
async function calculateBMI() {
  const weight = parseFloat(document.getElementById('bmiWeight')?.value);
  const height = parseFloat(document.getElementById('bmiHeight')?.value);
  const age    = parseInt(document.getElementById('bmiAge')?.value)    || 25;
  const gender = document.getElementById('bmiGender')?.value          || 'female';

  if (!weight || !height || weight <= 0 || height <= 0) {
    showToast('Please enter valid weight and height!', 'error');
    return;
  }

  const btn = document.getElementById('bmiBtn');
  setLoading(btn, true, 'Calculating…');
  showResultLoading('bmiInsights');

  try {
    const res  = await fetch('/api/bmi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weight, height, age, gender, profile: userProfile })
    });
    const data = await res.json();

    if (data.error) throw new Error(data.error);

    // Update gauge UI
    document.getElementById('bmiResultCard').style.display = 'block';
    document.getElementById('bmiNumber').textContent   = data.bmi;
    document.getElementById('bmiCategory').textContent = data.category;
    document.getElementById('bmiIdeal').textContent    = `${data.ideal_min}–${data.ideal_max} kg`;
    document.getElementById('bmiBmr').textContent      = `${data.bmr} kcal/day`;

    // Move indicator (scale: 10–40 BMI mapped to 0–100%)
    const pct = Math.min(100, Math.max(0, ((data.bmi - 10) / 30) * 100));
    const ind = document.getElementById('bmiIndicator');
    if (ind) ind.style.left = pct + '%';

    // Colour the BMI number based on category
    const numEl = document.getElementById('bmiNumber');
    const catColours = {
      'Underweight': '#3b82f6',
      'Normal weight': '#22c55e',
      'Overweight': '#f59e0b',
      'Obese': '#ef4444',
    };
    if (numEl) numEl.style.background = catColours[data.category] || '';

    showResult('bmiInsights', data.insights);
  } catch (err) {
    showResult('bmiInsights', '⚠️ Error: ' + err.message);
  } finally {
    setLoading(btn, false, '<i class="fa-solid fa-calculator"></i> Calculate BMI & Get Insights');
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   FAMILY PLAN
   ────────────────────────────────────────────────────────────────────────── */
function addDefaultFamilyMembers() {
  if (familyMembers.length > 0) return;
  const defaults = [
    { name: 'Me',      relation: 'Self',        age: 28, gender: 'female', diet: 'vegetarian', conditions: '', allergies: '' },
    { name: 'Amma',    relation: 'Mother',       age: 55, gender: 'female', diet: 'vegetarian', conditions: 'Diabetes, Hypertension', allergies: '' },
    { name: 'Appa',    relation: 'Father',       age: 58, gender: 'male',   diet: 'vegetarian', conditions: 'Heart Disease', allergies: '' },
  ];
  defaults.forEach(m => {
    familyMembers.push(m);
    renderFamilyMember(m);
  });
}

function addFamilyMember() {
  openModal('familyModal');
}

function saveFamilyMember() {
  const member = {
    name:       document.getElementById('fmName')?.value.trim()       || 'Member',
    relation:   document.getElementById('fmRelation')?.value.trim()   || '',
    age:        document.getElementById('fmAge')?.value               || '',
    gender:     document.getElementById('fmGender')?.value            || 'female',
    diet:       document.getElementById('fmDiet')?.value              || 'vegetarian',
    conditions: document.getElementById('fmConditions')?.value.trim() || '',
    allergies:  document.getElementById('fmAllergies')?.value.trim()  || '',
  };

  if (!member.name) { showToast('Name is required!', 'error'); return; }

  familyMembers.push(member);
  renderFamilyMember(member);
  saveFamilyMembers();
  closeModal('familyModal');
  showToast(`${member.name} added to family! ✓`, 'success');
  ['fmName','fmRelation','fmAge','fmConditions','fmAllergies'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

function renderFamilyMember(member) {
  const grid  = document.getElementById('familyGrid');
  if (!grid) return;

  const card = document.createElement('div');
  card.className = 'member-card';
  const initial = member.name.charAt(0).toUpperCase();

  const tags = [];
  if (member.diet)       tags.push(member.diet);
  if (member.conditions) member.conditions.split(',').forEach(c => tags.push(c.trim()));
  if (member.allergies)  tags.push('⚠️ ' + member.allergies);

  card.innerHTML = `
    <button class="member-remove" onclick="removeFamilyMember(this, '${member.name}')">
      <i class="fa-solid fa-xmark"></i>
    </button>
    <div class="member-avatar">${initial}</div>
    <div class="member-name">${member.name}</div>
    <div class="member-meta">${member.relation}${member.age ? ' · ' + member.age + 'y' : ''} · ${member.gender}</div>
    <div class="member-tags">
      ${tags.slice(0,4).map(t => `<span class="member-tag">${t}</span>`).join('')}
    </div>
  `;
  grid.appendChild(card);
}

function removeFamilyMember(btn, name) {
  familyMembers = familyMembers.filter(m => m.name !== name);
  btn.closest('.member-card').remove();
  saveFamilyMembers();
  showToast(`${name} removed.`);
}

function saveFamilyMembers() {
  localStorage.setItem('nutrigenius-family', JSON.stringify(familyMembers));
}

function loadFamilyMembers() {
  const saved = localStorage.getItem('nutrigenius-family');
  if (!saved) return;
  try {
    const members = JSON.parse(saved);
    if (members.length > 0) {
      familyMembers = members;
      members.forEach(m => renderFamilyMember(m));
    }
  } catch {}
}

async function generateFamilyPlan() {
  if (familyMembers.length === 0) { showToast('Add family members first!', 'error'); return; }

  const btn = document.getElementById('familyBtn');
  setLoading(btn, true, 'Generating Family Plan…');
  showResultLoading('familyResult');

  try {
    const res  = await fetch('/api/family-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ members: familyMembers })
    });
    const data = await res.json();
    showResult('familyResult', data.family_plan || data.error);
  } catch (err) {
    showResult('familyResult', '⚠️ Error: ' + err.message);
  } finally {
    setLoading(btn, false, '<i class="fa-solid fa-users"></i> Generate Family Nutrition Plan');
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   DASHBOARD
   ────────────────────────────────────────────────────────────────────────── */
async function getDailyTip() {
  const tipEl = document.querySelector('.ai-tip-text');
  if (!tipEl) return;

  tipEl.innerHTML = '<span style="color:var(--text-muted)">⏳ Getting your personalised tip…</span>';

  try {
    const res  = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Give me one highly specific, personalised health tip for today based on my profile. Keep it under 3 sentences and make it actionable.',
        history: [],
        profile: userProfile
      })
    });
    const data = await res.json();
    tipEl.innerHTML = `<strong>AI Tip of the Day:</strong> ${renderMarkdown(data.response || 'Stay hydrated and eat a rainbow of vegetables today! 🌈')}`;
  } catch {
    tipEl.innerHTML = '<strong>AI Tip:</strong> Start your day with a glass of warm lemon water to kickstart digestion and metabolism! 🍋';
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   VOICE ASSISTANT
   ────────────────────────────────────────────────────────────────────────── */
function initVoice() {
  const micBtn   = document.getElementById('micBtn');
  const voiceBtn = document.getElementById('voiceBtn');

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    if (micBtn)   micBtn.title   = 'Voice not supported in this browser';
    if (voiceBtn) voiceBtn.title = 'Voice not supported in this browser';
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous      = false;
  recognition.interimResults  = false;
  recognition.lang            = 'en-IN'; // Indian English — works for Hindi too

  recognition.onresult = e => {
    const transcript = e.results[0][0].transcript;
    const input = document.getElementById('chatInput');
    if (input) {
      input.value = transcript;
      input.style.height = 'auto';
      input.style.height = input.scrollHeight + 'px';
    }
    stopListening();
    // Auto-send after 0.8s
    setTimeout(() => sendMessage(), 800);
  };

  recognition.onerror = () => stopListening();
  recognition.onend   = () => stopListening();

  micBtn  ?.addEventListener('click', toggleListening);
  voiceBtn?.addEventListener('click', () => { switchSection('chat'); setTimeout(toggleListening, 200); });
}

function toggleListening() {
  if (isListening) {
    stopListening();
  } else {
    startListening();
  }
}

function startListening() {
  if (!recognition) { showToast('Voice not supported in this browser', 'error'); return; }
  isListening = true;
  recognition.start();
  document.getElementById('micBtn')?.classList.add('listening');
  showToast('🎤 Listening… Speak now (English or Hindi)');
}

function stopListening() {
  isListening = false;
  try { recognition?.stop(); } catch {}
  document.getElementById('micBtn')?.classList.remove('listening');
}

/* ──────────────────────────────────────────────────────────────────────────
   UI HELPERS
   ────────────────────────────────────────────────────────────────────────── */
function showResult(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = renderMarkdown(text || 'No response received.');
  el.classList.add('rendered');
}

function showResultLoading(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = `
    <div class="loading-spinner">
      <div class="spinner"></div>
      <span>IBM Watsonx.ai Granite is thinking…</span>
    </div>`;
  el.classList.remove('rendered');
}

function setLoading(btn, loading, label) {
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = loading
    ? '<div class="spinner" style="width:18px;height:18px;border-width:2px;display:inline-block"></div> Please wait…'
    : label;
}

function copyResult(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const text = el.innerText || el.textContent;
  navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard! ✓', 'success'));
}

function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

let toastTimer = null;
function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className   = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 3200);
}

/* ══════════════════════════════════════════════════════════════════════════
   DASHBOARD — Live CRUD Module
   All functions prefixed with dash* or refreshDashboard*
   ══════════════════════════════════════════════════════════════════════════ */

// Called once on DOMContentLoaded (hooked in initNavigation) and every time
// the user navigates to the Dashboard section.
async function refreshDashboardUI() {
  try {
    const res = await fetch('/api/dashboard/data');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const d = await res.json();
    _applyDashboardData(d);
  } catch (err) {
    console.warn('Dashboard refresh failed:', err);
  }
}

/* ── Core renderer ──────────────────────────────────────────────────────── */
function _applyDashboardData(d) {
  const pct = (a, b) => Math.min(100, b > 0 ? Math.round((a / b) * 100) : 0);

  // ── Calorie ring
  const calPct = pct(d.calories_consumed, d.calories_goal);
  _setRing('dc-cal-ring',  calPct);
  _setText('dc-cal-pct',   calPct + '%');
  _setText('dc-cal-val',   d.calories_consumed.toLocaleString());
  _setText('dc-cal-sub',   'Goal: ' + d.calories_goal.toLocaleString() + ' kcal');

  // ── Water ring
  const waterPct = pct(d.water_logged, d.water_goal);
  _setRing('dc-water-ring', waterPct);
  _setText('dc-water-pct',  waterPct + '%');
  _setText('dc-water-val',  d.water_logged + ' / ' + d.water_goal);
  _setText('dc-water-sub',  'Glasses of water');

  // ── Protein ring
  const protPct = pct(d.protein_consumed, d.protein_goal);
  _setRing('dc-prot-ring', protPct);
  _setText('dc-prot-pct',  protPct + '%');
  _setText('dc-prot-val',  d.protein_consumed + 'g');
  _setText('dc-prot-sub',  'Goal: ' + d.protein_goal + 'g');

  // ── Steps ring
  const stepsPct = pct(d.steps_logged, d.steps_goal);
  _setRing('dc-steps-ring', stepsPct);
  _setText('dc-steps-pct',  stepsPct + '%');
  _setText('dc-steps-val',  d.steps_logged.toLocaleString());
  _setText('dc-steps-sub',  'Goal: ' + d.steps_goal.toLocaleString());

  // ── Macro bars
  const macroEl = document.getElementById('dc-macro-bars');
  if (macroEl) {
    macroEl.innerHTML = [
      { emoji:'🍚', label:'Carbs',   val: d.carbs_consumed,   goal: d.carbs_goal,   cls:'carb-bar' },
      { emoji:'🥩', label:'Protein', val: d.protein_consumed, goal: d.protein_goal, cls:'protein-bar' },
      { emoji:'🥑', label:'Fat',     val: d.fat_consumed,     goal: d.fat_goal,     cls:'fat-bar' },
      { emoji:'🌾', label:'Fibre',   val: d.fibre_consumed,   goal: d.fibre_goal,   cls:'fibre-bar' },
    ].map(m => {
      const p = Math.min(100, m.goal > 0 ? Math.round((m.val / m.goal) * 100) : 0);
      return `
        <div class="macro-row">
          <span class="macro-name">${m.emoji} ${m.label}</span>
          <div class="macro-bar-wrap">
            <div class="macro-bar ${m.cls}" style="width:${p}%" data-animate="true"></div>
          </div>
          <span class="macro-val">${m.val}g <span class="muted">/${m.goal}g</span></span>
        </div>`;
    }).join('');
  }

  // ── Meal list
  const mealEl = document.getElementById('dynamicMealsContainer');
  const countEl = document.getElementById('dc-meal-count');
  if (mealEl) {
    const meals = d.meals_list || [];
    if (countEl) countEl.textContent = meals.length + ' logged';

    if (meals.length === 0) {
      mealEl.innerHTML = '<div class="meal-empty"><i class="fa-solid fa-bowl-rice"></i><p>No meals logged yet. Add your first entry below!</p></div>';
      return;
    }

    const typeEmoji = { Breakfast:'🌅', Lunch:'🍱', Dinner:'🌙', Snack:'🍎' };
    mealEl.innerHTML = meals.map(m => `
      <div class="meal-item logged" id="meal-row-${m.id}">
        <div class="meal-dot"></div>
        <div class="meal-info">
          <span class="meal-name">${typeEmoji[m.type] || '🍽️'} ${m.type} — ${_escHtml(m.name)}</span>
          <span class="meal-cal">${m.calories} kcal · ${_escHtml(m.time)}</span>
        </div>
        <button class="meal-delete-btn" onclick="deleteMealEntry(${m.id})" title="Remove entry">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `).join('');
  }
}

/* ── SVG ring helper ──────────────────────────────────────────────────────── */
function _setRing(id, pct) {
  const el = document.getElementById(id);
  if (!el) return;
  // Animate from current value
  const current = parseFloat((el.getAttribute('stroke-dasharray') || '0').split(',')[0]);
  const target  = Math.min(100, Math.max(0, pct));
  _animateRing(el, current, target);
}
function _animateRing(el, from, to, duration = 500) {
  const start = performance.now();
  function step(now) {
    const t = Math.min(1, (now - start) / duration);
    const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
    const val  = from + (to - from) * ease;
    el.setAttribute('stroke-dasharray', val.toFixed(1) + ', 100');
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
function _setText(id, txt) {
  const el = document.getElementById(id);
  if (el) el.textContent = txt;
}
function _escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── ADD MEAL ───────────────────────────────────────────────────────────── */
async function dashAddMeal() {
  const type = document.getElementById('logMealType')?.value;
  const name = document.getElementById('logMealName')?.value.trim();
  const cal  = parseInt(document.getElementById('logMealCal')?.value);
  const btn  = document.getElementById('logSubmitBtn');

  if (!name)        { showToast('Please enter a meal name!', 'error'); return; }
  if (!cal || cal < 1) { showToast('Please enter valid calories!', 'error'); return; }

  setLoading(btn, true, 'Adding…');
  try {
    const res  = await fetch('/api/dashboard/add_meal', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ type, name, calories: cal }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    _applyDashboardData(data.dashboard);

    // Clear fields
    document.getElementById('logMealName').value = '';
    document.getElementById('logMealCal').value  = '';

    // Flash the new row
    const newRow = document.getElementById('meal-row-' + data.meal.id);
    if (newRow) {
      newRow.classList.add('meal-row-flash');
      setTimeout(() => newRow.classList.remove('meal-row-flash'), 900);
    }
    showToast(`✓ ${name} (${cal} kcal) added!`, 'success');
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  } finally {
    setLoading(btn, false, '<i class="fa-solid fa-plus"></i> Add to Log');
  }
}

/* ── DELETE MEAL ─────────────────────────────────────────────────────────── */
async function deleteMealEntry(id) {
  const row = document.getElementById('meal-row-' + id);
  if (row) { row.style.opacity = '0.4'; row.style.pointerEvents = 'none'; }

  try {
    const res  = await fetch('/api/dashboard/delete_meal/' + id, { method: 'DELETE' });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    // Animate out then re-render
    if (row) {
      row.style.transition = 'all .25s ease';
      row.style.transform  = 'translateX(40px)';
      row.style.opacity    = '0';
      setTimeout(() => _applyDashboardData(data.dashboard), 260);
    } else {
      _applyDashboardData(data.dashboard);
    }
    showToast('Meal removed.', 'success');
  } catch (err) {
    if (row) { row.style.opacity = '1'; row.style.pointerEvents = ''; }
    showToast('Error: ' + err.message, 'error');
  }
}

/* ── ADD WATER ───────────────────────────────────────────────────────────── */
async function dashAddWater() {
  const card = document.getElementById('waterCard');
  if (card) { card.classList.add('water-ripple'); setTimeout(() => card.classList.remove('water-ripple'), 400); }

  try {
    const res  = await fetch('/api/dashboard/add_water', { method: 'POST' });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const pct = Math.min(100, Math.round((data.water_logged / data.water_goal) * 100));
    _setRing('dc-water-ring', pct);
    _setText('dc-water-pct', pct + '%');
    _setText('dc-water-val', data.water_logged + ' / ' + data.water_goal);

    if (data.water_logged >= data.water_goal) {
      showToast('🎉 Daily water goal reached!', 'success');
    } else {
      showToast('💧 +1 glass logged! ' + data.water_logged + '/' + data.water_goal);
    }
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

/* ── UPDATE STEPS ────────────────────────────────────────────────────────── */
function openStepsEditor() {
  const ed = document.getElementById('stepsEditor');
  const inp = document.getElementById('stepsInput');
  if (!ed) return;
  ed.classList.toggle('hidden');
  if (!ed.classList.contains('hidden') && inp) inp.focus();
}

async function dashUpdateSteps() {
  const inp   = document.getElementById('stepsInput');
  const steps = parseInt(inp?.value);
  if (isNaN(steps) || steps < 0) { showToast('Enter a valid step count!', 'error'); return; }

  try {
    const res  = await fetch('/api/dashboard/update_steps', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ steps }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const pct = Math.min(100, Math.round((data.steps_logged / data.steps_goal) * 100));
    _setRing('dc-steps-ring', pct);
    _setText('dc-steps-pct',  pct + '%');
    _setText('dc-steps-val',  data.steps_logged.toLocaleString());
    _setText('dc-steps-sub',  'Goal: ' + data.steps_goal.toLocaleString());

    document.getElementById('stepsEditor')?.classList.add('hidden');
    if (inp) inp.value = '';
    showToast('✓ Steps updated to ' + data.steps_logged.toLocaleString(), 'success');
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

/* ── LOG PANEL TOGGLE ────────────────────────────────────────────────────── */
function toggleLogPanel() {
  const body    = document.getElementById('dashLogBody');
  const chevron = document.getElementById('dashLogChevron');
  if (!body) return;
  const isOpen = !body.classList.contains('dash-log-collapsed');
  body.classList.toggle('dash-log-collapsed', isOpen);
  if (chevron) chevron.style.transform = isOpen ? 'rotate(-90deg)' : '';
}

/* ── Auto-refresh when navigating to Dashboard ───────────────────────────── */
// Patch initNavigation to trigger a dashboard refresh on section switch
const _origSwitchSection = typeof switchSection === 'function' ? switchSection : null;
// Override via delegation on nav clicks (safe — does not break other sections)
document.addEventListener('click', e => {
  const item = e.target.closest('.nav-item[data-section="dashboard"]');
  if (item) setTimeout(refreshDashboardUI, 80);
});

// Also fire on initial page load if Dashboard is already active
document.addEventListener('DOMContentLoaded', () => {
  const active = document.querySelector('.content-section.active');
  if (active && active.id === 'section-dashboard') refreshDashboardUI();
  // Always pre-fetch so data is ready when user switches
  refreshDashboardUI();
});

(() => {
  'use strict';
  const store = window.PTStore;
  const validation = window.PTValidation;
  const app = document.getElementById('app');
  const modalRoot = document.getElementById('modal-root');
  const errorNodes = new WeakMap();
  const touchedFields = new WeakMap();
  let errorSequence = 0;
  let startupPromise = null;
  let reminderTimer = null;
  let reminderAlarm = null;
  let daySheetDate = '';
  let photoSelection = 0;
  let modalVersion = 0;
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  const PHONE_INPUT_MAX = 10;
  const PHONE_COUNTRY_PREFIX = '+63';
  const categories = {
    personal: { label: 'Personal Task', short: 'Personal', icon: 'clipboard' },
    family: { label: 'Family Tasks', short: 'Family', icon: 'users' },
    household: { label: 'Household', short: 'Household', icon: 'home' },
    pill: { label: 'Pill Reminder', short: 'Pill reminder', icon: 'pill' }
  };
  const paths = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 11h18m-12 4h.01M12 15h.01M16 15h.01"/>',
    cart: '<path d="M3 3h2l3 12h11l2-8H6M9 20h.01M18 20h.01"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M2 21v-2a7 7 0 0 1 14 0v2M17 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v2"/>',
    clipboard: '<rect x="5" y="5" width="14" height="16" rx="2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6m-6 4h6"/>',
    pill: '<path d="m8 16 8-8M5 19a5 5 0 0 1 0-7l7-7a5 5 0 0 1 7 7l-7 7a5 5 0 0 1-7 0Z"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    left: '<path d="m15 5-7 7 7 7"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    edit: '<path d="m16 3 5 5-12 12-6 1 1-6ZM13 6l5 5"/>',
    trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4m.1 3h.01"/>',
    moon: '<path d="M21 13a9 9 0 0 1-10-10 9 9 0 1 0 10 10Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
    logout: '<path d="M9 3H4v18h5m0-9h12m-4-4 4 4-4 4"/>',
    heart: '<path d="M20 5a5 5 0 0 0-8 2 5 5 0 0 0-8-2c-5 5 8 15 8 15S25 10 20 5Z"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
    upload: '<path d="M12 16V3m-5 5 5-5 5 5M3 15v6h18v-6"/>',
    leaf: '<path d="M20 3C8 2 2 7 5 15c8 4 15-2 15-12ZM5 20l9-11"/>',
    history: '<path d="M3 11a9 9 0 1 1 2 7M3 3v8h8m1-4v5l4 2"/>',
    sparkle: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4m-2-2h4"/>'
  };
  const filledPaths = {
    circle: '<circle cx="12" cy="12" r="9"/>',
    home: '<path d="M10 20v-6h4v6h5v-9h3L12 2 2 11h3v9z"/>',
    user: '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9v-3c0-3 5.3-5 8-5s8 2 8 5v3Z"/>',
    users: '<path d="M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7-1a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM1 21v-3c0-3 5-5 8-5s8 2 8 5v3Zm17 0v-3a6 6 0 0 0-2-4c3 0 7 2 7 4v3Z"/>',
    clipboard: '<path fill-rule="evenodd" d="M9 2h6v2h4a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4Zm2 1v2h2V3ZM7 9v2h10V9Zm0 5h10v-2H7Zm0 3h10v-2H7Zm0 3h7v-2H7Z"/>',
    bell: '<path d="M12 1a2 2 0 0 0-2 2v1a7 7 0 0 0-5 7v5l-2 3h18l-2-3v-5a7 7 0 0 0-5-7V3a2 2 0 0 0-2-2Zm-3 20a3 3 0 0 0 6 0Z"/>',
    phone: '<path d="M6.6 10.8a15.9 15.9 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.2c1.2.4 2.5.6 3.8.6a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17.2 17.2 0 0 1 3 3.8a1 1 0 0 1 1-1h3.4a1 1 0 0 1 1 1c0 1.3.2 2.6.6 3.8a1 1 0 0 1-.2 1Z"/>',
    lock: '<path fill-rule="evenodd" d="M6 10V7a6 6 0 0 1 12 0v3h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Zm2 0h8V7a4 4 0 0 0-8 0Zm2 5a2 2 0 1 1 4 0 2 2 0 0 1-1 1.7V19h-2v-2.3a2 2 0 0 1-1-1.7Z"/>',
    heart: '<path d="M12 21 3.4 12.4A5.8 5.8 0 0 1 12 4.6a5.8 5.8 0 0 1 8.6 7.8Z"/>',
    trash: '<path d="M8 2h8v3h5v2H3V5h5Zm-3 7h14l-1 13H6Z"/>',
    edit: '<path d="m16 2 6 6-13 13-7 1 1-7Zm-1 4 3 3 2-2-3-3Z"/>',
    pill: '<rect x="2" y="7" width="20" height="10" rx="5" transform="rotate(-45 12 12)"/><path d="m8 8 8 8" stroke="#e3c4ee" stroke-width="1.6"/>'
  };
  function icon(name, cls = '') {
    return `<svg class="${cls}" viewBox="0 0 24 24" fill="${filledPaths[name]?'currentColor':'none'}" stroke="${filledPaths[name]?'none':'currentColor'}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${filledPaths[name] || paths[name] || paths.clipboard}</svg>`;
  }
  function esc(value = '') { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function dayKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
  function parseDay(value) { return new Date(`${value}T12:00:00`); }
  function prettyDay(value, options = { month: 'long', day: 'numeric', year: 'numeric' }) { return parseDay(value).toLocaleDateString('en-US', options); }
  function prettyTime(value) { if (!value) return 'Any time'; const [h,m] = value.split(':').map(Number); return `${h%12 || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`; }
  function initials(name) { return name.split(/\s+/).filter(Boolean).slice(0,2).map(p=>p[0]).join('').toUpperCase(); }
  const today = () => dayKey();
  const currentTime = () => new Date().toTimeString().slice(0,5);
  function eventDay(date) {
    const tomorrow = parseDay(today()); tomorrow.setDate(tomorrow.getDate()+1);
    return date === today() ? 'Today' : date === dayKey(tomorrow) ? 'Tomorrow' : prettyDay(date,{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  }
  function avatarMarkup(user) { return user.photo ? `<img src="${esc(user.photo)}" alt="${esc(user.name)}">` : esc(initials(user.name)); }
  const sortedTasks = tasks => [...tasks].sort((a,b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  let state, authMode = 'login', taskFilter = 'all', selectedDate = today(), calendarMonth = parseDay(today());
  let fullCalendar = false, groceryHistory = false, modalSubmit = null, previousFocus = null;
  const routes = ['home','tasks','calendar','grocery','profile','help','faq','report','privacy'];
  const route = () => routes.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
  function brand() { return '<a class="brand" href="#home" aria-label="ParenTech home"><img class="brand-logo" src="assets/logo.png" alt=""><img class="brand-wordmark" src="assets/wordmark.png" alt="ParenTech"></a>'; }
  function buttonIcon(name, action, label, extra = '', cls = '') {
    extra = extra.replace(/class="([^"]*)"/g, (_, value) => { cls += ' ' + value; return ''; });
    return `<button class="icon-button ${cls}" type="button" data-action="${action}" aria-label="${esc(label)}" title="${esc(label)}" ${extra}>${icon(name)}</button>`;
  }
  function empty(iconName, title, text, action = '') { return `<div class="empty-state">${icon(iconName)}<h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`; }
  function storageNotice() {
    const status = store.getStorageStatus();
    return status.persistent ? '' : `<p class="storage-notice" role="status">${esc(status.message)}</p>`;
  }
  function setRoute(name) {
    closeModal(); document.body.classList.remove('sidebar-open','account-open');
    if (location.hash === `#${name}`) render(); else location.hash = name;
  }
  function render() {
    state = store.getState();
    if (state.user && route() === 'profile') { store.recordProfileView(); state = store.getState(); }
    applyTheme();
    app.innerHTML = state.user ? renderShell() : renderAuth();
    document.title = state.user ? `${({home:'Home',tasks:'Tasks',calendar:'Calendar',grocery:'Groceries',profile:'Profile',help:'Help',faq:'FAQs',report:'Report a problem',privacy:'Privacy'})[route()]} · ParenTech` : 'Welcome · ParenTech';
    if (state.user && route() === 'home') checkReminders();
    scheduleReminders();
  }
  function applyTheme() {
    const preference=store.getState().settings.theme;
    document.body.dataset.theme=preference==='system'?(systemTheme.matches?'dark':'light'):preference;
  }
  function field(label, name, type = 'text', value = '', attributes = '') {
    if (type === 'date') attributes += ' min="1900-01-01"';
    let prefix = '';
    if (name === 'phone') {
      value = phoneNationalDigits(value) ?? '';
      attributes = attributes.replace('autocomplete="tel"', 'autocomplete="tel-national"').replace('placeholder="+63"', 'placeholder=""');
      attributes += ` data-phone-prefix="${PHONE_COUNTRY_PREFIX}" data-maxlength="10" inputmode="numeric" pattern="[0-9]*" autocapitalize="none" spellcheck="false" aria-label="${esc(label)}, Philippine country code +63"`;
      prefix = `<span class="phone-prefix" aria-hidden="true">${PHONE_COUNTRY_PREFIX}</span>`;
    }
    const ic = ({name:'user',phone:'phone',dob:'calendar',age:'calendar'})[name];
    return `<div class="field" data-field="${name}"><label for="${name}" ${name==='phone'?'class="login-phone-label"':''}>${label}</label><div class="field-control ${name==='phone'?'phone-control':''}">${ic?icon(ic,'input-icon'):''}${prefix}<input id="${name}" name="${name}" type="${type}" value="${esc(value)}" ${attributes}></div></div>`;
  }
  function selectField(label, name, values, current = '', required = true) {
    return `<div class="field" data-field="${name}"><label for="${name}">${label}${required?'':' (optional)'}</label><div class="field-control">${icon(name==='role'?'users':name==='civilStatus'?'heart':'clipboard','input-icon')}<select id="${name}" name="${name}" ${required?'required':''}>${!required||!current?`<option value="" ${!current?'selected':''} ${required?'disabled':''}>${required?label:'Not specified'}</option>`:''}${values.map(v=>`<option ${v===current?'selected':''} value="${esc(v)}">${esc(v)}</option>`).join('')}</select></div></div>`;
  }
  function passwordField(label, name, autocomplete) {
    return `<div class="field" data-field="${name}"><label for="${name}">${label}</label><div class="password-field">${icon('lock','input-icon')}<input id="${name}" name="${name}" type="password" required minlength="${autocomplete==='new-password'?8:1}" data-maxlength="${validation.LIMITS.password}" autocomplete="${autocomplete}" ${autocomplete==='new-password'?'aria-describedby="signup-password-help"':''} autocapitalize="none" spellcheck="false" placeholder="${label}">${buttonIcon('eye','password',`Show ${label.toLowerCase()}`,`data-target="${name}"`)}</div></div>`;
  }
  function profileFields(user = {}) {
    return `${field('Full Name','name','text',user.name,'required maxlength="80" autocomplete="name"')}${field('Mobile Phone','phone','tel',user.phone,'required autocomplete="tel"')}${field('Date of Birth (optional)','dob','date',user.dob,`max="${today()}" autocomplete="bday"`)}${selectField('Civil Status','civilStatus',['Single','Married','Widowed','Divorced','Separated','Civil Partnership'],user.civilStatus,false)}<div class="form-grid">${field('Age (optional)','age','number',user.age??'','min="0" max="150" step="1" inputmode="numeric" placeholder="N/A"')}${selectField('Role','role',['Mom','Dad','Solo Parent'],user.role)}</div>`;
  }
  function renderAuth() {
    const signup = authMode === 'signup';
    const phone = field('Phone Number','phone','tel','','required autocomplete="tel" placeholder="+63"');
    const passwords = signup ? `<div class="form-grid password-grid">${passwordField('Password','password','new-password')}${passwordField('Confirm Password','confirmPassword','new-password')}</div><p class="form-hint" id="signup-password-help">Use 8 to 128 characters with an uppercase letter and a number.</p><div id="signup-password-strength" class="password-strength" data-strength="empty" role="status" aria-live="polite"><span class="password-strength-bar"></span><span id="password-strength-text">Enter a password to see its strength.</span></div>` : passwordField('Password','password','current-password');
    const fields = signup ? `${field('Full Name','name','text','','required maxlength="80" autocomplete="name" placeholder="Full Name"')}<div class="form-grid">${phone}${field('Date of Birth (optional)','dob','date','',`max="${today()}" autocomplete="bday" aria-label="Date of Birth"`)}</div><div class="form-grid">${selectField('Civil Status','civilStatus',['Single','Married','Widowed','Divorced','Separated','Civil Partnership'],'',false)}${field('Age (optional)','age','number','','min="0" max="150" step="1" inputmode="numeric" placeholder="N/A"')}</div>${selectField('Role','role',['Mom','Dad','Solo Parent'])}` : phone;
    const form = `<form novalidate class="auth-form" data-form="${signup?'signup':'login'}">${fields}${passwords}<p class="form-error" role="alert" hidden></p><button class="btn btn-primary auth-submit" type="submit">${signup?'SIGN UP':'LOGIN'}</button></form><p class="auth-switch">${signup?'Already have an account?':'Don\'t have an account?'} <button class="text-button" data-action="auth-switch">${signup?'Login':'Sign Up'}</button></p>${storageNotice()}`;
    return signup ? `<div class="auth-screen auth-signup"><div class="signup-layout"><section class="signup-brand">${brand()}<h1>Create your account</h1></section><section class="auth-card signup">${form}</section></div></div>` : `<div class="auth-screen auth-login"><section class="auth-card login">${brand()}<p class="auth-lead">Welcome back! Please login to your account.</p>${form}</section></div>`;
  }
  function renderShell() {
    const active=route();
    if(['help','faq','report','privacy'].includes(active))return `<main class="support-screen route-${active}">${renderView(active)}</main>`;
    const nav=[['home','home','Home'],['calendar','calendar','Calendar'],['grocery','cart','Grocery'],['profile','user','Profile']];
    const navButton = ([name,ic,label],cls) => `<button class="${cls} ${active===name||(name==='home'&&active==='tasks')?'active':''}" data-route="${name}" ${active===name?'aria-current="page"':''}>${icon(ic)}<span>${label}</span></button>`;
    const bottomNav = `<nav class="mobile-bottom-nav" aria-label="Mobile navigation">${nav.slice(0,2).map(item=>navButton(item,'bottom-nav-link')).join('')}<button class="bottom-nav-add" data-action="new-task" aria-label="Add task or medicine reminder">${icon('plus')}</button>${nav.slice(2).map(item=>navButton(item,'bottom-nav-link')).join('')}</nav>`;
    return `<div class="app-shell ${active==='calendar'&&fullCalendar?'full-calendar-shell':''}"><button class="mobile-overlay" data-action="close-drawer" aria-label="Close navigation"></button><aside class="sidebar">${brand()}<nav class="nav-list" aria-label="Main navigation">${nav.map(item=>navButton(item,'nav-link')).join('')}</nav></aside><main class="main-area"><header class="topbar">${buttonIcon('menu','menu','Toggle account menu','','menu-toggle')}<div class="search-box search-collapsed">${buttonIcon('search','search-toggle','Open search','','search-toggle')}<input id="global-search" type="search" placeholder="Search tasks and reminders..." autocomplete="off" aria-label="Search pending tasks and medicine reminders" aria-controls="search-results" aria-expanded="false"><div id="search-results" class="search-results" hidden></div></div><button class="icon-button notification-button" data-action="notifications" aria-label="Reminders and alarms">${icon('bell')}</button></header><div id="view" class="page-view route-${active}">${storageNotice()}${renderView(active)}</div><div class="floating-task"><button data-action="new-task" aria-label="New task or reminder">${icon('plus')}</button><span>Task</span></div></main>${bottomNav}<button class="drawer-overlay" data-action="close-drawer" aria-label="Close account menu"></button><aside class="account-drawer" aria-label="Account menu"><div class="drawer-top">${buttonIcon('close','close-drawer','Close account menu')}<img src="assets/logo.png" alt="ParenTech"></div><div class="drawer-profile"><span class="avatar">${avatarMarkup(state.user)}</span><strong>${esc(state.user.name)} ${icon('heart')}</strong><small>${esc(state.user.phone)}</small></div><div class="drawer-links"><details><summary>${icon('shield')}Settings & Privacy ${icon('chevron')}</summary><button data-action="personal-information">Personal Information</button><button data-action="theme">Theme Mode</button><button data-action="notification-settings">Notifications Settings</button><button data-action="privacy">Privacy and Policy</button></details><details><summary>${icon('help')}Help & Support ${icon('chevron')}</summary><button data-route="faq">FAQs</button><button data-route="report">Report a Problem</button><button data-route="help">Help</button></details><button class="drawer-logout" data-action="logout">${icon('logout')}Logout ${icon('chevron')}</button></div></aside></div>`;
  }
  function heading(eyebrow, title, description, actions = '') {
    return `<div class="page-heading"><h1>${title}</h1><div class="heading-actions">${actions}</div></div>`;
  }
  function addTaskButton(label='Add task',date='') { return `<button class="btn btn-purple" data-action="new-task" ${date?`data-date="${date}"`:''}>${icon('plus')}${label}</button>`; }
  function taskRow(task) {
    const cat = categories[task.category] || categories.personal;
    const completion = task.category==='pill' ? (task.completed?'Mark not taken':'Mark taken') : (task.completed?'Mark incomplete':'Complete');
    return `<div class="task-row ${task.completed?'completed':''}"><button class="check-button ${task.completed?'checked':''}" data-action="toggle-task" data-id="${task.id}" aria-label="${completion} ${esc(task.title)}" aria-pressed="${task.completed}">${task.completed?icon('check'):''}</button><div class="task-details"><p class="task-title">${esc(task.title)}</p><div class="task-meta"><span class="category-dot ${task.category}"></span><span>${cat.short}</span><span>·</span><span>${eventDay(task.date)}, ${prettyTime(task.time)}</span>${task.completed&&task.category==='pill'?'<span class="badge">Taken</span>':''}${!task.completed&&task.date<today()?'<span class="overdue-badge">Overdue</span>':''}</div>${task.description?`<p class="task-description">${esc(task.description)}</p>`:''}</div><div class="row-actions">${buttonIcon('edit','edit-task',`Edit ${task.title}`,`data-id="${task.id}"`)}${buttonIcon('trash','delete-task',`Delete ${task.title}`,`data-id="${task.id}"`)}</div></div>`;
  }
  function remindersMarkup(tasks) {
    return tasks.length ? tasks.map(taskRow).join('') : empty('bell','All caught up','Your upcoming reminders will appear here.');
  }
  function renderHome() {
    const todays=sortedTasks(state.tasks.filter(t=>t.date===today()));
    const upcoming=sortedTasks(state.tasks.filter(t=>!t.completed&&t.date>=today()));
    return `<h1 class="home-greeting">Hello, ${esc(state.user.name)}!</h1><div class="stats-grid">${Object.entries(categories).map(([key,cat])=>`<button class="stat-card ${key}" data-action="filter-category" data-category="${key}"><span class="stat-label">${cat.label}</span><span class="stat-icon">${icon(cat.icon)}</span><span class="stat-number">${state.tasks.filter(t=>t.category===key&&!t.completed).length}</span></button>`).join('')}</div><div class="home-sections"><section class="home-section"><div class="panel-header"><h2>Today's Tasks</h2><button class="text-button" data-action="today-tasks">See All</button></div><div class="task-list">${todays.length?todays.map(taskRow).join(''):'<div class="home-empty">No tasks or reminders scheduled for today.</div>'}</div></section><section class="home-section"><div class="panel-header"><h2>Upcoming Reminders</h2><button class="text-button" data-action="notifications">See All</button></div><div class="task-list">${upcoming.length?upcoming.map(taskRow).join(''):'<div class="home-empty">No upcoming reminders.</div>'}</div></section></div>`;
  }
  function renderTasks() {
    const list=sortedTasks(state.tasks.filter(t=>taskFilter==='all'||taskFilter==='today'&&t.date===today()||taskFilter==='completed'&&t.completed||t.category===taskFilter));
    const tabs=[['all','All Tasks'],['today',"Today's Tasks"],...Object.entries(categories).map(([k,v])=>[k,v.label]),['completed','Completed']];
    return `${heading('','Tasks & Reminders','')}<div class="filter-tabs" role="group" aria-label="Filter tasks">${tabs.map(([key,label])=>`<button class="filter-tab ${taskFilter===key?'active':''}" data-action="task-filter" data-filter="${key}" aria-pressed="${taskFilter===key}">${label}</button>`).join('')}</div><div class="task-list">${list.length?list.map(taskRow).join(''):'<div class="home-empty">No tasks or reminders in this category.</div>'}</div>`;
  }
function monthMarkup(date) {
  const year = date.getFullYear(), month = date.getMonth();
  const offset = new Date(year, month, 1).getDay();
  const cells = Array.from({ length: 42 }, (_, i) => new Date(year, month, i - offset + 1));
  return `<div class="calendar-card"><div class="calendar-header"><h2>${date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>${!fullCalendar ? `<div class="calendar-nav calendar-month-nav">${buttonIcon('left', 'month-prev', 'Previous month')}${buttonIcon('chevron', 'month-next', 'Next month')}</div>` : ''}</div><div class="weekday-grid">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => `<span>${day}</span>`).join('')}</div><div class="calendar-grid">${cells.map(day => {
    const key = dayKey(day), items = state.tasks.filter(task => task.date === key && !task.completed);
    return `<button class="calendar-day ${day.getMonth() !== month ? 'outside' : ''} ${key === today() ? 'today' : ''} ${key === selectedDate ? 'selected' : ''}" data-action="calendar-day" data-date="${key}" aria-label="${esc(prettyDay(key))}${items.length ? `, ${items.length} tasks` : ''}" aria-pressed="${key === selectedDate}"><span class="day-number">${day.getDate()}</span><span class="day-dots">${items.slice(0, 3).map(task => `<span class="${task.category}"></span>`).join('')}</span></button>`;
  }).join('')}</div></div>`;
}
function renderCalendar() {
  if (fullCalendar) return `<div class="full-calendar-page"><div class="history-heading"><button class="text-button" data-action="calendar-mode" aria-label="Return to month view">${icon('left')}<span>Full Calendar</span></button><div class="full-calendar-controls">${buttonIcon('left', 'month-prev', 'Previous twelve months')}${buttonIcon('chevron', 'month-next', 'Next twelve months')}</div></div><div class="full-calendars month-scroll-list" aria-label="Twelve months from ${esc(prettyDay(dayKey(calendarMonth),{month:'long',year:'numeric'}))}">${Array.from({length:12},(_,i)=>monthMarkup(new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+i,1))).join('')}</div></div>`;
  const selected = sortedTasks(state.tasks.filter(task => task.date === selectedDate));
  const upcoming = sortedTasks(state.tasks.filter(task => !task.completed && task.date >= today()));
  const groups = {};
  upcoming.forEach(task => (groups[task.date] ||= []).push(task));
  return `<div class="reference-calendar-page"><h1 class="calendar-greeting">Hello, ${esc(state.user.role)}! <span>♥</span></h1><div class="calendar-layout"><section class="calendar-panel"><div class="reference-calendar-title"><h2>ParenTech Calendar</h2><button class="text-button" data-action="calendar-mode">View all ›</button></div>${monthMarkup(calendarMonth)}</section><div class="day-agenda"><section class="reference-day-card"><div class="panel-header"><h2>Tasks for ${prettyDay(selectedDate)}</h2>${buttonIcon('plus', 'new-task', 'Add task for this date', `data-date="${selectedDate}"`)}</div><div class="task-list">${selected.length ? selected.map(taskRow).join('') : '<p class="reference-empty-copy">No tasks or reminders for this day.</p>'}</div></section><h2 class="calendar-upcoming-label">Upcoming Events</h2><section class="reference-empty-bar calendar-upcoming-events">${upcoming.length ? Object.entries(groups).map(([date, tasks]) => `<div class="calendar-event-group"><p class="calendar-event-date">${esc(eventDay(date))}</p>${tasks.map(taskRow).join('')}</div>`).join('') : '<p>No upcoming events or reminders.</p>'}</section></div></div></div>`;
}
function renderGrocery() {
  const purchases = [...state.purchases].sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt));
  const purchaseRow = purchase => `<button class="purchased-row" data-action="restore-purchase" data-id="${esc(purchase.id)}" aria-label="Add ${esc(purchase.name)} to the grocery list again"><span class="purchase-check">${icon('check')}</span><span>${esc(purchase.name)}</span></button>`;
  if (groceryHistory) {
    const groups = {};
    purchases.forEach(purchase => (groups[dayKey(new Date(purchase.purchasedAt))] ||= []).push(purchase));
    return `<div class="grocery-history-page"><div class="history-heading"><button class="text-button" data-action="grocery-history">${icon('left')}<span>Grocery History</span></button></div>${purchases.length?Object.entries(groups).map(([date, items]) => `<section class="history-group"><h2 class="history-date">${prettyDay(date, { month: 'long', day: '2-digit', year: 'numeric' })}</h2><div class="history-items">${items.map(purchaseRow).join('')}</div></section>`).join(''):empty('history','No purchase history yet','Check an item off your grocery list after you buy it.')}</div>`;
  }
  const recommendations = purchases.filter((purchase, i, all) => all.findIndex(other => other.name.toLowerCase() === purchase.name.toLowerCase()) === i && !state.groceries.some(item => item.name.toLowerCase() === purchase.name.toLowerCase())).slice(0, 6);
  return `<div class="reference-grocery-page ${purchases.length ? 'has-purchases' : ''}"><section class="reference-grocery-panel"><div class="grocery-title-row"><div><h1>Grocery List</h1><p>${state.groceries.length} items remaining</p></div>${buttonIcon('history', 'grocery-history', 'Grocery History')}</div><div class="grocery-form-group"><form novalidate class="grocery-form" data-form="grocery"><input class="input" name="groceryName" aria-label="Grocery item" maxlength="100" placeholder="Add grocery item here." required><button class="btn btn-primary" type="submit">ADD</button></form></div><div class="grocery-list">${state.groceries.map(item => `<div class="grocery-row"><button class="check-button" data-action="purchase-grocery" data-id="${esc(item.id)}" aria-label="Mark ${esc(item.name)} purchased"></button><span class="grocery-name">${esc(item.name)}</span><div class="row-actions">${buttonIcon('edit', 'edit-grocery', `Edit ${item.name}`, `data-id="${esc(item.id)}"`)}${buttonIcon('trash', 'delete-grocery', `Delete ${item.name}`, `data-id="${esc(item.id)}"`)}</div></div>`).join('')}</div></section>${purchases.length ? `<div class="grocery-bottom-panels"><section class="purchased-panel"><h2>Recently Purchased</h2><p class="purchase-date">${prettyDay(dayKey(new Date(purchases[0].purchasedAt)), { month: 'long', day: '2-digit', year: 'numeric' })}</p><div class="purchased-items">${purchases.slice(0, 3).map(purchaseRow).join('')}</div></section><section class="recommended-panel"><h2>Recommended</h2><div class="recommendations">${recommendations.map(purchase => `<button class="recommendation" data-action="restore-purchase" data-id="${esc(purchase.id)}">+ ${esc(purchase.name)}</button>`).join('')}</div><p>You recently bought these items, would you like to add them again?</p></section></div>` : ''}</div>`;
}
  function settingRow(ic,title,description,action,value='') {
    return `<button class="settings-row" data-action="${action}"><span class="settings-icon">${icon(ic)}</span><span class="settings-copy"><h3>${title}</h3><p>${description}</p></span><span class="settings-value">${value}</span>${icon('chevron')}</button>`;
  }
function renderProfile() {
  const user = state.user;
  const phone = user.phone.startsWith('+63') ? `+63 ${user.phone.slice(3)}` : user.phone;
  return `<div class="profile-layout"><section class="profile-card"><button class="profile-avatar avatar profile-photo-button" data-action="choose-photo" aria-label="Change profile photo">${avatarMarkup(user)}<span class="photo-edit-badge">${icon('edit')}</span></button><input id="profile-photo" type="file" accept="image/png,image/jpeg,image/webp" hidden><div class="profile-info"><h2>${esc(user.name)} <span class="profile-heart">♥</span></h2><p>${esc(phone)}</p><button class="btn btn-secondary" data-action="edit-profile">${icon('edit')}Edit Profile</button></div><div class="profile-stats"><div class="profile-badges"><span class="badge">${esc(user.role)}</span><span class="badge">Age: ${user.age??'N/A'}</span></div><div class="profile-stat-grid"><div class="profile-stat"><strong>${state.tasks.filter(task => task.completed).length}</strong><span>Tasks Done</span></div><div class="profile-stat"><strong>${store.getProfileStreak()}</strong><span>Day Streak</span></div><div class="profile-stat"><strong>${store.getGroceryDayCount()}</strong><span>Groceries<br>Done</span></div></div></div></section><section class="settings-list">${settingRow('bell', 'Notifications Settings', 'Learn about task and medicine alerts', 'notification-settings')}${settingRow('circle', 'Theme Mode', ({dark:'Dark Mode',light:'Light Mode',system:'System Default'})[state.settings.theme], 'theme')}${settingRow('lock', 'Privacy and Policy', 'Read about your privacy and saved data', 'privacy')}${settingRow('help', 'Help and Support', 'Get assistance, FAQs and contact support', 'help')}</section></div>`;
}
function renderHelp() {
  const headset = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13V11a8 8 0 0 1 16 0v2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="2" y="11" width="5" height="9" rx="1" fill="currentColor"/><rect x="17" y="11" width="5" height="9" rx="1" fill="currentColor"/><path d="M20 18v4h-7" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  const external = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M14 3h7v7M21 3 10 14M10 3H3v18h18v-7"/></svg>';
  return `<div class="support-content support-help"><button class="support-back icon-button" data-route="profile" aria-label="Back to profile">${icon('left')}</button><div class="support-intro"><span class="support-symbol">${headset}</span><h1>How can we help you?</h1><p>Find answers to your questions, learn how to use ParentTech, and get the support you need.</p></div><div class="support-help-grid"><div class="help-links">${[['clipboard', 'Getting Started', 'Learn the basics and set up your account.'], ['clipboard', 'Using ParentTech', 'Learn how to create tasks, manage your home<br>and more.'], ['help', 'Troubleshooting', 'Find solutions to common issues and errors.']].map(([image, title, description]) => `<button class="help-link" data-route="faq"><span class="settings-icon">${icon(image)}</span><span><h2>${title}</h2><p>${description}</p></span>${icon('chevron')}</button>`).join('')}</div><section class="help-contact">${icon('mail')}<h2>Still need help?</h2><button class="btn btn-secondary" data-route="report">Contact Support</button></section></div><button class="help-center" data-route="faq"><span class="settings-icon">${icon('help')}</span><span><h2>Visit our Help Center</h2><p>Browse more articles and guides online.</p></span>${external}</button></div>`;
}
function renderFAQ() {
  const bubble = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3h16a1 1 0 0 1 1 1v14H8l-5 4V4a1 1 0 0 1 1-1Z" fill="currentColor"/><path d="M12 7v5m0 2v2" fill="none" stroke="var(--support-icon-cutout, #352343)" stroke-width="2.5"/></svg>';
  const items = [
    ['How do I create a task?', 'Select the + Task button, enter a task title, date and time, and choose a category. Select Create Task to save it to your task list and calendar.'],
    ['How do pill reminders work?', 'Create a task in the Pill Reminder category. Enable notifications in your profile and keep ParenTech open to receive alerts when it is due. Create a separate reminder for each dose.'],
    ['How do I use the Grocery List?', 'Enter an item and select ADD. Check it off when you buy it. Purchased items move to your grocery history, and you can add them again from Recommended or Grocery History.'],
    ['How do I switch theme?', 'Open your Profile and select Theme Mode, then choose Light, Dark, or System Default. System Default follows your device’s appearance. Your choice is remembered.']
  ];
  return `<div class="support-content support-faq"><button class="support-back icon-button" data-route="help" aria-label="Back to Help and Support">${icon('left')}</button><p class="support-top-title">FAQ's</p><div class="support-intro"><span class="support-symbol">${bubble}<span class="support-symbol-badge">${icon('clock')}</span></span><h1>Frequently Asked Questions</h1><p>Find answers to common questions below.</p></div><div class="faq-list">${items.map(([question, answer], index) => `<details><summary><span>${index + 1}. ${question}</span>${icon('chevron')}</summary><div class="faq-answer">${answer}</div></details>`).join('')}</div></div>`;
}
function renderReport() {
  const flag = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h7v3h9v11h-9v-3H7v9H5Z" fill="currentColor"/></svg>';
  const imageSymbol = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" fill="currentColor"/><path d="m5 18 5-7 4 5 3-4 3 6Z" fill="var(--support-icon-cutout, #111)"/></svg>';
  return `<div class="support-content support-report"><button class="support-back icon-button" data-route="help" aria-label="Back to Help and Support">${icon('left')}</button><p class="support-top-title">Report a Problem</p><div class="support-intro"><span class="support-symbol">${flag}<span class="support-symbol-badge">${icon('clock')}</span></span><h1>We're here to help!</h1><p>Describe the issue you encountered.</p></div><form novalidate data-form="report" class="report-form"><div class="field"><label for="category">What is the issue about?</label><select id="category" name="category" required><option value="" selected disabled>Select a category</option>${validation.REPORT_CATEGORIES.map(category => `<option value="${esc(category)}">${esc(category)}</option>`).join('')}</select></div><div class="field"><label for="description">Describe the problem</label><textarea name="description" id="description" maxlength="500" required rows="5" placeholder="Please provide as much detail as possible so we can understand the issue."></textarea><span class="report-counter" id="report-counter">0/500</span></div><div class="field"><label for="screenshot">Add a screenshot (optional)</label><label class="upload-field" for="screenshot">${imageSymbol}<span id="upload-label">Choose an image</span><input id="screenshot" name="screenshot" type="file" accept="image/png,image/jpeg,image/webp"></label></div><div class="field"><label for="email">Email (optional)</label><input id="email" name="email" type="email" autocomplete="email" placeholder="Mom@email.com" maxlength="150"></div><p class="report-note">This local version shows a confirmation only. Reports and attachments are not saved or sent.</p><p class="form-error" role="alert" hidden></p><button class="btn btn-purple" type="submit">Submit report</button></form></div>`;
}
  function privacyContent() {
    return '<h2>Your data stays local</h2><p>Your account is saved on this computer. Your tasks, medicine reminders, groceries, purchase history and preferences are kept in this browser, separately for each account.</p><h2>Your privacy</h2><p>Your password is protected and is never displayed. Profile photos stay with your local account. Problem reports show a confirmation only; reports and attachments are not saved or sent.</p><h2>Your choices</h2><p>Reminder notifications are optional. Logging out keeps your account and plans. Clearing browser data removes the plans and preferences saved in that browser.</p>';
  }
  function renderPrivacy() {
    return `${heading('','Privacy & policy','',`<button class="btn btn-secondary" data-route="profile">${icon('left')}Back to profile</button>`)}<section class="panel prose-panel">${privacyContent()}</section>`;
  }
  function renderView(name) {
    return ({home:renderHome,tasks:renderTasks,calendar:renderCalendar,grocery:renderGrocery,profile:renderProfile,help:renderHelp,faq:renderFAQ,report:renderReport,privacy:renderPrivacy}[name] || renderHome)();
  }
  function toast(message, type = 'success') {
    const div=document.createElement('div');div.className=`toast ${type}`;
    div.innerHTML=`${icon(type==='error'?'help':'check')}<span>${esc(message)}</span>`;
    document.getElementById('toast-stack').append(div);setTimeout(()=>div.remove(),4200);
  }
  function openModal(title, content, submitHandler = null, subtitle = '') {
    closeModal();previousFocus=document.activeElement;modalSubmit=submitHandler;
    modalVersion++;
    modalRoot.innerHTML=`<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1"><div class="modal-header"><div><h2 id="modal-title">${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div>${buttonIcon('close','close-modal','Close dialog')}</div><div class="modal-body">${content}</div></section></div>`;
    app.inert=true;document.body.classList.add('modal-open');
    requestAnimationFrame(()=>{const target=modalRoot.querySelector('input:not([readonly]),textarea,select,.modal-footer button,.modal');target?.focus();});
  }
  function closeModal() {
    daySheetDate = '';
    modalVersion++;
    if(!modalRoot.childElementCount)return;
    modalRoot.innerHTML='';app.inert=false;document.body.classList.remove('modal-open');modalSubmit=null;
    if(previousFocus?.isConnected)previousFocus.focus();previousFocus=null;
  }
  function showTaskModal(id = '', date = '', category = 'personal') {
    const task=state.tasks.find(t=>t.id===id)||{date:date||today(),time:currentTime(),category:Object.hasOwn(categories,category)?category:'personal'};
    openModal(id?'Edit Task / Reminder':'New Task / Reminder',`<form novalidate class="task-form" data-form="modal" data-validation="task">${field('Task Title','title','text',task.title,'required maxlength="120" placeholder="e.g., Dentist Appointment"')}<div class="field"><label for="description">Task Description</label><textarea id="description" name="description" rows="4" maxlength="500" placeholder="Add more details here...">${esc(task.description||'')}</textarea></div><div class="form-grid">${field('Date','date','date',task.date,'required')}${field('Time','time','time',task.time,'required')}</div><fieldset class="category-fieldset"><legend>Category</legend><div class="category-picker">${Object.entries(categories).map(([key,cat])=>`<label class="radio-card ${key===task.category?'selected':''}"><input type="radio" name="category" value="${key}" ${key===task.category?'checked':''}><span class="category-icon">${icon(cat.icon)}</span><span>${key==='pill'?'Pill Reminder':cat.short}</span></label>`).join('')}</div></fieldset><p class="form-error" role="alert" hidden></p><div class="modal-footer"><button class="btn btn-purple" type="submit">${id?'Save Changes':'Create Task'}</button></div></form>`,data=>{store.saveTask(id?{...data,id}:data);closeModal();render();toast(id?'Task updated.':data.category==='pill'?'Reminder saved.':'Task saved.');});
    modalRoot.querySelector('.modal')?.classList.add('task-modal');
  }
  function showDayTasks(date) {
    const tasks=sortedTasks(state.tasks.filter(t=>t.date===date));
    openModal(prettyDay(date),`<div class="day-popup-list">${tasks.length?tasks.map(taskRow).join(''):'<p>No tasks or reminders scheduled for this day.</p>'}</div><button class="btn btn-primary" data-action="new-task" data-date="${date}">ADD EVENT</button>`);
    daySheetDate = date;
    modalRoot.querySelector('.modal')?.classList.add('calendar-day-modal');
  }
  function showThemeOptions() {
    openModal('Theme Mode',`<form novalidate data-form="modal" data-validation="settings"><div class="theme-options">${[['light','Light'],['dark','Dark'],['system','System Default']].map(([value,label])=>`<label class="theme-option"><input type="radio" name="theme" value="${value}" ${state.settings.theme===value?'checked':''}>${icon(value==='dark'?'moon':'sun')}<span>${label}</span></label>`).join('')}</div><p class="form-hint">System Default follows your device’s appearance.</p><p class="form-error" hidden role="alert"></p><div class="modal-footer"><button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button><button type="submit" class="btn btn-purple">Apply theme</button></div></form>`,data=>{store.updateSettings({theme:data.theme});closeModal();render();});
  }
  function showPersonalInformation() {
    openModal('Personal Information',`<div class="prose-panel"><p><strong>Name:</strong> ${esc(state.user.name)}</p><p><strong>Mobile:</strong> ${esc(state.user.phone)}</p><p><strong>Date of birth:</strong> ${state.user.dob?prettyDay(state.user.dob):'Not specified'}</p><p><strong>Civil status:</strong> ${esc(state.user.civilStatus||'Not specified')}</p><p><strong>Age:</strong> ${state.user.age??'N/A'}</p><p><strong>Role:</strong> ${esc(state.user.role)}</p></div><div class="modal-footer"><button class="btn btn-secondary" data-action="close-modal">Done</button><button class="btn btn-purple" data-action="edit-profile">Edit Profile</button></div>`);
  }
  async function previewPhoto(file) {
    const selection = ++photoSelection,version=modalVersion;
    const userId = store.getState().user?.id;
    if (!file) return;
    const error = validation.validateScreenshot(file);
    if (error) { toast(error,'error'); return; }
    try {
      const source = await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('The photo could not be read. Please try another image.'));reader.readAsDataURL(file);});
      const img = await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('The selected photo could not be opened.'));image.src=source;});
      const scale = Math.min(1,512/Math.max(img.naturalWidth,img.naturalHeight));
      const canvas = document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
      canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
      const photo = canvas.toDataURL('image/webp',0.85);
      const photoError = validation.validateProfilePhoto(photo);
      if (photoError) throw new Error(photoError);
      if (selection !== photoSelection || version !== modalVersion || store.getState().user?.id !== userId || route() !== 'profile') return;
      openModal('Use this profile photo?',`<form novalidate data-form="modal"><div class="photo-preview"><img class="photo-preview-image" src="${esc(photo)}" alt="Preview of your new profile photo"></div><p class="form-error" hidden role="alert"></p><div class="modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-purple" type="submit">Use Photo</button></div></form>`,async()=>{const version=modalVersion;await store.updateProfilePhoto(photo);if(version!==modalVersion)return;closeModal();render();toast('Profile photo updated.');});
    } catch(error) { toast(error.message,'error'); }
  }
  function confirm(title, text, action, label='Confirm') {
    openModal(title,`<form novalidate data-form="modal"><p class="confirm-description">${esc(text)}</p><div class="modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn ${label==='Log out'?'btn-purple':'btn-danger'}" type="submit">${label}</button></div></form>`,()=>{action();closeModal();render();});
  }
  function showNotificationSettings() {
    const supported='Notification' in window;
    openModal('Your reminders, your way',`<form novalidate data-form="modal"><div class="notification-toggle"><span class="settings-icon">${icon('bell')}</span><div><h3>Task & pill reminder alerts</h3><p>Receive alerts when a plan is due.</p></div><label class="switch"><input type="checkbox" name="notifications" ${state.settings.notifications?'checked':''} aria-label="Enable reminder notifications"><span></span></label></div><p class="form-hint">Keep ParenTech open to receive alerts. ${supported?'Your browser will ask permission for desktop notifications.':'This browser supports in-app alerts only.'}</p>${supported&&Notification.permission==='denied'?'<p class="form-hint">Desktop notifications are blocked. You can allow them in your browser’s site settings; in-app alerts will still appear.</p>':''}<p class="form-error" hidden role="alert"></p><div class="modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-purple" type="submit">Save preferences</button></div></form>`,async(data,form)=>{
      const enabled=form.elements.notifications.checked,version=modalVersion,userId=store.getState().user?.id;
      if(enabled&&supported&&Notification.permission==='default')await Notification.requestPermission();
      if(version!==modalVersion||userId!==store.getState().user?.id)return;
      store.updateSettings({notifications:enabled});closeModal();render();toast(enabled?'Reminder alerts are on.':'Reminder alerts are off.');
    });
  }
  function showNotifications() {
    closeModal();previousFocus=document.activeElement;
    const pending=sortedTasks(state.tasks.filter(t=>!t.completed&&t.date>=today()));
    modalRoot.innerHTML=`<aside class="notification-panel" aria-labelledby="notification-title"><header class="notification-header"><h2 id="notification-title">${icon('bell')}Reminders & Alarms</h2>${buttonIcon('close','close-modal','Close reminders')}</header><div class="notification-list">${pending.length?remindersMarkup(pending):'<p>No upcoming tasks or reminders.</p>'}</div></aside>`;
  }
  function showLogoutConfirmation() {
    openModal('',`<form novalidate class="logout-confirm" data-form="modal"><span class="logout-symbol">${icon('logout')}</span><p>Are you sure you want to log out?</p><div class="modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">No</button><button class="btn btn-purple" type="submit">Yes</button></div></form>`,async()=>{await store.logout();authMode='login';document.body.classList.remove('sidebar-open','account-open');closeModal();render();});
    modalRoot.querySelector('.modal')?.classList.add('logout-modal');
  }
  function matchingPendingTasks(query = '') {
    const text=query.trim().toLowerCase();
    return sortedTasks(state.tasks.filter(t=>!t.completed&&t.title.toLowerCase().includes(text)));
  }
  function openSearchDate(date) {
    selectedDate=date;calendarMonth=parseDay(date);fullCalendar=false;setRoute('calendar');
  }
  function search(query) {
    const target=document.getElementById('search-results');if(!target)return;
    const input=document.getElementById('global-search');query=query.trim().toLowerCase();
    const tasks=matchingPendingTasks(query);
    const results=tasks.slice(0,8).map(t=>`<button class="search-result" data-action="search-task" data-date="${t.date}">${icon(categories[t.category]?.icon)}<span><strong>${esc(t.title)}</strong><small>${eventDay(t.date)} · ${prettyTime(t.time)}</small></span>${icon('chevron')}</button>`);
    target.innerHTML=`${!query?'<p class="search-no-results">Recommended Searches</p>':''}${results.length?results.join(''):`<div class="search-no-results">${query?'No matching pending tasks or medicine reminders.':'No pending tasks or medicine reminders to suggest.'}</div>`}`;target.hidden=false;input.setAttribute('aria-expanded','true');
  }
  function updatePasswordStrength(value) {
    const target=document.getElementById('signup-password-strength'), label=document.getElementById('password-strength-text');
    if(!target||!label)return;
    const missing=[];
    if(value.length<8)missing.push('at least 8 characters');
    if(!/\p{Lu}/u.test(value))missing.push('an uppercase letter');
    if(!/\p{Nd}/u.test(value))missing.push('a number');
    if(value.length>validation.LIMITS.password)missing.push('at most 128 characters');
    if(/[\u0000-\u001f\u007f-\u009f]/.test(value))missing.push('printable characters only');
    const strong=value.length>=12&&/\p{Ll}/u.test(value)&&/[^\p{L}\p{N}]/u.test(value);
    target.dataset.strength=!value?'empty':missing.length?'weak':strong?'strong':'good';
    label.textContent=!value?'Enter a password to see its strength.':missing.length?`Weak — use ${missing.join(', ')}.`:strong?'Strong password.':'Good password. Add more characters and a symbol for a stronger password.';
  }
  function errorInForm(form, error) {
    const fields = error.fields || {};
    Object.entries(fields).forEach(([name, message]) => setFieldError(form, name, message));
    const box = form.querySelector('.form-error');
    const message = error.message || 'Please check your details and try again.';
    if (box) {
      box.textContent = Object.keys(fields).length > 1 ? `Please check the highlighted fields. ${message}` : message;
      box.hidden = false;
      box.tabIndex = -1;
    } else if (!Object.keys(fields).length) toast(message, 'error');
    const first = Object.keys(fields).map(name => namedControls(form, name)[0]).find(Boolean);
    (first || box)?.focus();
  }
  function validationKind(form) {
    return form.dataset.validation || (['login', 'signup', 'grocery', 'report'].includes(form.dataset.form) ? form.dataset.form : '');
  }
  function namedControls(form, name) {
    const controls = [...form.querySelectorAll('[name]')].filter(control => control.name === name);
    if (controls.length) return controls;
    const named = form.elements?.namedItem ? form.elements.namedItem(name) : form.elements?.[name];
    if (!named) return [];
    return named.nodeType === 1 || typeof named.setAttribute === 'function' ? [named] : [...named];
  }
  function fieldState(form) {
    if (!touchedFields.has(form)) touchedFields.set(form, new Set());
    return touchedFields.get(form);
  }
  function setFieldError(form, name, message) {
    const controls = namedControls(form, name);
    if (!controls.length) return;
    fieldState(form).add(name);
    let nodes = errorNodes.get(form);
    if (!nodes) { nodes = new Map(); errorNodes.set(form, nodes); }
    let node = nodes.get(name);
    if (!message) {
      if (node) { node.textContent = ''; node.hidden = true; }
      controls.forEach(control => {
        control.removeAttribute('aria-invalid');
        if (node) {
          const descriptions = (control.getAttribute('aria-describedby') || '').split(/\s+/).filter(id => id && id !== node.id);
          if (descriptions.length) control.setAttribute('aria-describedby', descriptions.join(' '));
          else control.removeAttribute('aria-describedby');
        }
      });
      return;
    }
    if (!node) {
      node = document.createElement('p');
      node.id = `validation-error-${++errorSequence}`;
      node.className = 'field-error';
      node.dataset.errorFor = name;
      node.setAttribute('aria-live', 'polite');
      const container = controls[0].closest('.field') || controls[0].closest('fieldset') || form.closest('.grocery-form-group');
      if (container) container.append(node);
      else {
        node.classList.add('grocery-field-error');
        form.insertAdjacentElement('afterend', node);
      }
      if (form.dataset.form === 'grocery') node.classList.add('grocery-field-error');
      nodes.set(name, node);
    }
    node.textContent = message;
    node.hidden = false;
    controls.forEach(control => {
      control.setAttribute('aria-invalid', 'true');
      const descriptions = new Set((control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
      descriptions.add(node.id);
      control.setAttribute('aria-describedby', [...descriptions].join(' '));
    });
  }
  function clearFormErrors(form) {
    for (const name of errorNodes.get(form)?.keys() || []) setFieldError(form, name, '');
    const box = form.querySelector('.form-error');
    if (box) { box.hidden = true; box.textContent = ''; }
  }
  function formValues(form) {
    const values = Object.fromEntries(new FormData(form));
    if (form.elements.phone?.dataset.phonePrefix) values.phone = PHONE_COUNTRY_PREFIX + (phoneNationalDigits(values.phone) ?? '');
    if (validationKind(form) === 'report') values.screenshotName = form.elements.screenshot?.files?.[0]?.name || '';
    return values;
  }
  function checkForm(form) {
    const kind = validationKind(form);
    const input = formValues(form);
    if (!kind) return { valid: true, values: input, errors: {} };
    const result = validation.check(kind, input, { today: today(), groceries: store.getState().groceries, excludeId: form.dataset.itemId });
    if (kind === 'profile' && !Object.hasOwn(input,'photo')) delete result.values.photo;
    if (result.errors.phone && form.elements.phone?.dataset.phonePrefix) result.errors.phone = 'Enter 10 digits beginning with 9 after +63, for example 9171234567.';
    if (kind === 'report') {
      const error = validation.validateScreenshot(form.elements.screenshot?.files?.[0]);
      if (error) { result.errors.screenshot = error; result.valid = false; }
      if (result.errors.screenshotName) { result.errors.screenshot = result.errors.screenshotName; delete result.errors.screenshotName; }
    }
    return result;
  }
  function validateChangedField(control, force = false) {
    const form = control.form;
    if (!form || !validationKind(form) || !control.name || control.readOnly || form.dataset.submitting === 'true') return;
    if (!force && !fieldState(form).has(control.name)) return;
    const result = checkForm(form);
    setFieldError(form, control.name, result.errors[control.name] || '');
    if (control.name === 'password' && fieldState(form).has('confirmPassword')) setFieldError(form, 'confirmPassword', result.errors.confirmPassword || '');
    const box = form.querySelector('.form-error');
    if (box && !box.hidden) {
      const visible = [...(errorNodes.get(form)?.values() || [])].filter(node => !node.hidden);
      if (!visible.length) { box.hidden = true; box.textContent = ''; }
      else {
        const message = visible.length > 1 ? `Please check the highlighted fields. ${visible[0].textContent}` : visible[0].textContent;
        if (box.textContent !== message) box.textContent = message;
      }
    }
  }
  document.addEventListener('submit',async event=>{
    const form=event.target;if(!form.matches('form[data-form]'))return;event.preventDefault();
    if (form.dataset.submitting === 'true') return;
    clearFormErrors(form);
    const result = checkForm(form);
    if (!result.valid) { errorInForm(form, new validation.ValidationError(result.errors)); return; }
    const kind=form.dataset.form,data=result.values;
    const submit=form.querySelector('[type=submit]');if(submit)submit.disabled=true;
    form.dataset.submitting = 'true'; form.setAttribute('aria-busy', 'true'); form.classList.add('is-submitting');
    try {
      if(kind==='login'||kind==='signup'){await store[kind](data);authMode='login';location.hash='home';render();toast(kind==='signup'?'Welcome to your family space.':'Welcome back.');}
      else if(kind==='grocery'){store.addGrocery(data.groceryName);render();document.querySelector('[name=groceryName]')?.focus();toast('Added to your grocery list.');}
      else if(kind==='report'){store.saveReport(data);openModal('Report submitted',`<p class="confirm-description">Thank you for describing the issue. This local version only confirms your report; it is not saved or sent.</p><div class="modal-footer"><button class="btn btn-purple" data-action="report-done">Done</button></div>`);}
      else if(kind==='modal'&&modalSubmit){await modalSubmit(data,form);}
    } catch(error){
      if(error.code==='SESSION_CHANGED') {
        closeModal();
        try { await store.init();render();toast('Your login changed in another tab. Review your profile and try again.','error'); }
        catch(refreshError) { toast(refreshError.message||'Please reload to check your current login.','error'); }
      }
      else errorInForm(form,error);
    }finally{
      if(submit?.isConnected)submit.disabled=false;
      delete form.dataset.submitting; form.removeAttribute('aria-busy'); form.classList.remove('is-submitting');
    }
  });
  document.addEventListener('click',event=>{
    const el=event.target.closest('[data-action],[data-route]');
    if(!el){if(!event.target.closest('.search-box')){document.querySelector('.search-box')?.classList.add('search-collapsed');const results=document.getElementById('search-results');if(results)results.hidden=true;document.getElementById('global-search')?.setAttribute('aria-expanded','false');}if(event.target.classList.contains('modal-backdrop'))closeModal();return;}
    if(el.dataset.route){setRoute(el.dataset.route);return;}
    const action=el.dataset.action,id=el.dataset.id;
    try {
      switch(action){
        case 'auth-switch':authMode=authMode==='login'?'signup':'login';render();break;
        case 'password':{const input=document.getElementById(el.dataset.target);input.type=input.type==='password'?'text':'password';el.setAttribute('aria-label',`${input.type==='password'?'Show':'Hide'} ${input.name==='confirmPassword'?'confirm password':'password'}`);el.title=el.getAttribute('aria-label');break;}
        case 'demo':store.demo();location.hash='home';render();toast('Welcome! Make yourself at home.');break;
        case 'menu':document.body.classList.toggle('account-open');break;
        case 'close-drawer':document.body.classList.remove('sidebar-open','account-open');break;
        case 'theme':showThemeOptions();break;
        case 'new-task':showTaskModal('',el.dataset.date,el.dataset.category);break;
        case 'edit-task':showTaskModal(id);break;
        case 'toggle-task':{const date=daySheetDate;store.toggleTask(id);closeModal();render();if(date)showDayTasks(date);break;}
        case 'delete-task':{const task=state.tasks.find(t=>t.id===id);confirm('Remove this task?',`“${task.title}” will be removed from your tasks and calendar.`,()=>{store.deleteTask(id);toast('Task removed.');},'Remove task');break;}
        case 'task-filter':taskFilter=el.dataset.filter;render();break;
        case 'today-tasks':taskFilter='today';setRoute('tasks');break;
        case 'filter-category':taskFilter=el.dataset.category;setRoute('tasks');break;
        case 'month-prev':calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()-(fullCalendar?12:1),1);render();break;
        case 'month-next':calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+(fullCalendar?12:1),1);render();break;
        case 'calendar-today':selectedDate=today();calendarMonth=parseDay(today());render();break;
        case 'calendar-mode':fullCalendar=!fullCalendar;render();break;
        case 'calendar-day':selectedDate=el.dataset.date;render();showDayTasks(selectedDate);break;
        case 'search-task':openSearchDate(el.dataset.date);break;
        case 'search-toggle':{const box=el.closest('.search-box');box?.classList.remove('search-collapsed');document.getElementById('global-search')?.focus();search(document.getElementById('global-search')?.value||'');break;}
        case 'grocery-history':groceryHistory=!groceryHistory;render();break;
        case 'purchase-grocery':store.purchaseGrocery(id);render();toast('Checked off. Added to your purchase history.');break;
        case 'restore-purchase':store.restorePurchase(id);render();toast('Added back to your grocery list.');break;
        case 'delete-grocery':{const item=state.groceries.find(g=>g.id===id);confirm('Remove this item?',`Remove “${item.name}” from your grocery list?`,()=>store.deleteGrocery(id),'Remove item');break;}
        case 'edit-grocery':{const item=state.groceries.find(g=>g.id===id);openModal('Edit grocery item',`<form novalidate data-form="modal" data-validation="grocery" data-item-id="${esc(item.id)}">${field('Item name','groceryName','text',item.name,'required maxlength="100"')}<p class="form-error" hidden role="alert"></p><div class="modal-footer"><button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button><button type="submit" class="btn btn-purple">Save changes</button></div></form>`,data=>{store.editGrocery(id,data.groceryName);closeModal();render();toast('Grocery item updated.');});break;}
        case 'edit-profile':openModal('Update Profile Details',`<form novalidate data-form="modal" data-validation="profile">${profileFields(state.user)}<p class="form-error" hidden role="alert"></p><div class="modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-purple" type="submit">Save Changes</button></div></form>`,async data=>{const version=modalVersion;await store.updateProfile(data);if(version!==modalVersion)return;closeModal();render();toast('Your profile is updated.');},'Edit Profile Details');modalRoot.querySelector('.modal')?.classList.add('profile-modal');break;
        case 'choose-photo':document.getElementById('profile-photo')?.click();break;
        case 'personal-information':showPersonalInformation();break;
        case 'logout':showLogoutConfirmation();break;
        case 'close-modal':closeModal();break;
        case 'report-done':setRoute('help');break;
        case 'notification-settings':showNotificationSettings();break;
        case 'notifications':showNotifications();break;
        case 'retry-init':startApp();break;
        case 'privacy':openModal('Privacy and Policy',`<div class="prose-panel">${privacyContent()}</div><div class="modal-footer"><button class="btn btn-purple" data-action="close-modal">Done</button></div>`);break;
        case 'help':setRoute('help');break;
      }
    }catch(error){toast(error.message,'error');}
  });
  function cleanPhoneText(value) {
    if (typeof value !== 'string') return '';
    const characters = value.normalize('NFKC').replace(/[^0-9+]/g, '');
    return (characters.startsWith('+') ? '+' : '') + characters.replace(/\+/g, '');
  }
  function phoneParts(value) {
    const compact = cleanPhoneText(value);
    if (compact.startsWith('+')) {
      if (compact.startsWith(PHONE_COUNTRY_PREFIX)) return { digits: compact.slice(3), removed: 3, invalid: false };
      return { digits: '', removed: compact.length, invalid: true };
    }
    if (/^639[0-9]{9}$/.test(compact)) return { digits: compact.slice(2), removed: 2, invalid: false };
    if (/^09[0-9]{9}$/.test(compact)) return { digits: compact.slice(1), removed: 1, invalid: false };
    return { digits: compact, removed: 0, invalid: false };
  }
  function phoneNationalDigits(value) {
    const parts = phoneParts(value);
    return parts.invalid ? null : parts.digits;
  }
  function filterPhoneInput(control) {
    const original = control.value;
    const start = control.selectionStart;
    const end = control.selectionEnd;
    const parts = phoneParts(original);
    const cleaned = parts.digits;
    if (original !== cleaned) {
      control.value = cleaned;
      if (typeof start === 'number' && typeof end === 'number' && control.setSelectionRange) {
        const caret = index => Math.max(0, Math.min(cleaned.length, cleanPhoneText(original.slice(0, index)).length - parts.removed));
        control.setSelectionRange(caret(start), caret(end));
      }
    }
    // Keep overlong autofill visible for rejection, rather than truncating it to a different number.
    return parts.invalid || cleaned.length > PHONE_INPUT_MAX;
  }
  function insertPhoneText(event, text) {
    const control = event.target;
    if (control.name !== 'phone' || typeof text !== 'string') return;
    event.preventDefault();
    const start = control.selectionStart ?? control.value.length;
    const end = control.selectionEnd ?? start;
    const inserted = phoneNationalDigits(text);
    if (inserted === null) {
      if (control.form) setFieldError(control.form, 'phone', 'Use a Philippine phone number. The country code is fixed at +63.');
      return;
    }
    const proposed = control.value.slice(0, start) + inserted + control.value.slice(end);
    if (!/^[0-9]*$/.test(proposed) || proposed.length > PHONE_INPUT_MAX) {
      if (control.form) setFieldError(control.form, 'phone', 'That number could not be inserted. Enter up to 10 digits after +63.');
      return;
    }
    control.value = proposed;
    control.setSelectionRange?.(start + inserted.length, start + inserted.length);
    validateChangedField(control, true);
  }
  document.addEventListener('beforeinput', event => {
    const control = event.target;
    if (control.name === 'name' && typeof event.data === 'string' && /\p{N}/u.test(event.data) && event.cancelable !== false) { event.preventDefault(); return; }
    if (control.name === 'age' && event.inputType?.startsWith('insert') && typeof event.data === 'string' && /[^0-9]/.test(event.data) && event.cancelable !== false) { event.preventDefault(); return; }
    if (control.name !== 'phone' || event.isComposing || event.inputType === 'insertCompositionText') return;
    if (event.inputType?.startsWith('delete') || event.inputType === 'historyUndo' || event.inputType === 'historyRedo' || typeof event.data !== 'string') return;
    const start = control.selectionStart ?? control.value.length;
    const end = control.selectionEnd ?? start;
    const proposed = control.value.slice(0, start) + event.data + control.value.slice(end);
    if ((!/^[0-9]*$/.test(proposed) || proposed.length > PHONE_INPUT_MAX) && event.cancelable !== false) event.preventDefault();
  });
  document.addEventListener('paste', event => {
    if (event.target.name === 'phone' && event.clipboardData) insertPhoneText(event, event.clipboardData.getData('text/plain'));
  });
  document.addEventListener('drop', event => {
    if (event.target.name === 'phone' && event.dataTransfer) insertPhoneText(event, event.dataTransfer.getData('text/plain'));
  });
  document.addEventListener('compositionend', event => {
    if (event.target.name === 'phone') {
      filterPhoneInput(event.target);
      validateChangedField(event.target, true);
    }
  });
  document.addEventListener('input',event=>{
    if (event.target.name === 'name' && !event.isComposing) {
      const control=event.target, original=control.value, position=control.selectionStart;
      control.value=original.replace(/\p{N}/gu,'');
      if(typeof position==='number'&&control.value!==original) { const caret=original.slice(0,position).replace(/\p{N}/gu,'').length;control.setSelectionRange(caret,caret); }
    }
    let overlongPhone = false;
    if (event.target.name === 'phone') {
      if (event.isComposing) return;
      overlongPhone = filterPhoneInput(event.target);
    }
    if(event.target.id==='global-search')search(event.target.value);
    if(event.target.name==='password'&&event.target.form?.dataset.form==='signup')updatePasswordStrength(event.target.value);
    if(event.target.name==='dob'){const age=event.target.form?.elements.age;if(age){try{age.value=store.getAge(event.target.value) ?? '';}catch{age.value='';}}}
    if(event.target.id==='description'&&event.target.closest('[data-form="report"]'))document.getElementById('report-counter').textContent=`${event.target.value.length}/500`;
    validateChangedField(event.target, overlongPhone);
  });
  document.addEventListener('focusout', event => validateChangedField(event.target, true));
  document.addEventListener('focusin',event=>{if(event.target.id==='global-search')search(event.target.value);});
  document.addEventListener('change',async event=>{
    if(event.target.id==='profile-photo') { const file=event.target.files[0];event.target.value='';await previewPhoto(file);return; }
    if(event.target.name==='category'&&event.target.type==='radio'){event.target.closest('.category-picker').querySelectorAll('.radio-card').forEach(card=>card.classList.toggle('selected',card.contains(event.target)));}
    if(event.target.id==='screenshot')document.getElementById('upload-label').textContent=event.target.files[0]?.name||'Choose an image to reference in your report';
    if (event.target.matches?.('select,input[type="radio"],input[type="file"]')) validateChangedField(event.target, true);
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Enter'&&event.target.id==='global-search') { event.preventDefault();const match=matchingPendingTasks(event.target.value)[0];if(match)openSearchDate(match.date);else search(event.target.value);return; }
    if(event.key==='Escape'){closeModal();document.body.classList.remove('sidebar-open','account-open');document.querySelector('.search-box')?.classList.add('search-collapsed');const results=document.getElementById('search-results');if(results)results.hidden=true;document.getElementById('global-search')?.setAttribute('aria-expanded','false');}
    if(event.key==='/'&&!event.target.matches('input,textarea,select')&&state.user&&!modalRoot.childElementCount){event.preventDefault();document.querySelector('.search-box')?.classList.remove('search-collapsed');document.getElementById('global-search')?.focus();}
    if(event.key==='Tab'&&modalRoot.childElementCount){const items=[...modalRoot.querySelectorAll('button,input:not([readonly]),textarea,select,a[href]')].filter(e=>!e.disabled&&e.offsetParent!==null);const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
  });
  window.addEventListener('hashchange',()=>{closeModal();render();window.scrollTo({top:0,behavior:'instant'});});
  window.addEventListener('storage',async event=>{if(event.key==='parentech.v1'||event.key===null){store.reloadFromStorage();closeModal();try{if(store.isRemote)await store.init();render();}catch(error){toast(error.message||'Your current login could not be refreshed.','error');}}});
  systemTheme.addEventListener?.('change',()=>{if(store.getState().settings.theme==='system')applyTheme();});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){checkReminders();scheduleReminders();}});
  window.addEventListener('focus',()=>{checkReminders();scheduleReminders();});
  function scheduleReminders() {
    if(reminderAlarm!==null)clearTimeout(reminderAlarm);
    reminderAlarm=null;
    const current=store.getState();if(!current.user||!current.settings.notifications)return;
    const next=sortedTasks(current.tasks.filter(t=>!t.completed&&!t.notifiedAt))[0];
    if(!next)return;
    const delay=Math.min(2147483647,Math.max(1,new Date(`${next.date}T${next.time}:00`).getTime()-Date.now()));
    reminderAlarm=setTimeout(()=>{reminderAlarm=null;checkReminders();scheduleReminders();},delay);
  }
  function checkReminders() {
    const current=store.getState();if(!current.user||!current.settings.notifications)return;
    const now=Date.now();
    current.tasks.filter(t=>!t.completed&&!t.notifiedAt&&new Date(`${t.date}T${t.time}:00`).getTime()<=now).forEach(t=>{
      store.markNotified(t.id);toast(`${categories[t.category]?.short}: ${t.title} · ${prettyTime(t.time)}`);
      if('Notification' in window&&Notification.permission==='granted'){try{new Notification(t.category==='pill'?'Your pill reminder':'A little reminder from ParenTech',{body:t.title,icon:'assets/logo.png',tag:t.id});}catch{/* In-app alert remains available. */}}
    });
  }
  async function startApp() {
    if (startupPromise) return startupPromise;
    startupPromise = (async () => {
      app.innerHTML = `<div class="splash-screen" role="status" aria-label="Opening ParenTech">${brand()}</div>`;
      try {
        await Promise.all([store.init(),new Promise(resolve=>setTimeout(resolve,2000))]);
        if (new URLSearchParams(location.search).get('demo') === '1' && !store.getState().user) store.demo();
        render();
        if (!reminderTimer) reminderTimer = setInterval(()=>{checkReminders();scheduleReminders();},15*60*1000);
      } catch (error) {
        render();
        const form = app.querySelector('.auth-form');
        if (form) {
          errorInForm(form, error);
          const retry = document.createElement('button');
          retry.className = 'btn btn-secondary'; retry.type = 'button'; retry.dataset.action = 'retry-init'; retry.textContent = 'Retry connection';
          app.querySelector('.auth-card')?.append(retry);
        } else toast(error.message || 'The local account server could not be reached.', 'error');
      }
    })();
    try { await startupPromise; } finally { startupPromise = null; }
  }
  startApp();
})();

(function (root) {
    'use strict';
    const store = root.PTStore;
    const validation = root.PTValidation;
    const byId = id => document.getElementById(id);
    const dayKey = (date = new Date()) => [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
    const nowTime = () => new Date().toTimeString().slice(0,5);
    const sorted = tasks => [...tasks].sort((a,b) => (a.date+' '+a.time).localeCompare(b.date+' '+b.time));
    const labels = { personal:'Personal Tasks', family:'Family Tasks', household:'Household Tasks', pill:'Pill Reminders' };
    const pages = ['index.html','home.html','tasks.html','calendar.html','grocery.html','pills.html','profile.html','faqs.html','help.html','report-problem.html','signup.html'];
    const demo = new URLSearchParams(root.location.search).get('demo') === '1';
    const aiRecipes = {
        'chicken adobo': { name: 'Chicken Adobo', ingredients: [ { name: 'Chicken cuts', quantity: 1 }, { name: 'Soy Sauce', quantity: 1 }, { name: 'White Vinegar', quantity: 1 }, { name: 'Garlic', quantity: 1 }, { name: 'Bay Leaves', quantity: 1 }, { name: 'Whole Black Peppercorn', quantity: 1 }, { name: 'Cooking Oil', quantity: 1 } ] },
        'pork adobo': { name: 'Pork Adobo', ingredients: [ { name: 'Pork Belly cuts', quantity: 1 }, { name: 'Soy Sauce', quantity: 1 }, { name: 'White Vinegar', quantity: 1 }, { name: 'Garlic', quantity: 1 }, { name: 'Bay Leaves', quantity: 1 }, { name: 'Whole Black Peppercorn', quantity: 1 } ] },
        'adobo': { name: 'Adobo', ingredients: [ { name: 'Chicken or Pork cuts', quantity: 1 }, { name: 'Soy Sauce', quantity: 1 }, { name: 'White Vinegar', quantity: 1 }, { name: 'Garlic', quantity: 1 }, { name: 'Bay Leaves', quantity: 1 }, { name: 'Whole Black Peppercorn', quantity: 1 } ] },
        'pork sinigang': { name: 'Pork Sinigang', ingredients: [ { name: 'Pork Ribs', quantity: 1 }, { name: 'Sinigang Tamarind Mix', quantity: 2 }, { name: 'Kangkong', quantity: 1 }, { name: 'Radish', quantity: 2 }, { name: 'Eggplant', quantity: 2 }, { name: 'Tomatoes', quantity: 4 }, { name: 'Green Finger Chili', quantity: 3 } ] },
        'shrimp sinigang': { name: 'Shrimp Sinigang', ingredients: [ { name: 'Fresh Shrimp', quantity: 1 }, { name: 'Sinigang Tamarind Mix', quantity: 2 }, { name: 'Kangkong', quantity: 1 }, { name: 'Radish', quantity: 2 }, { name: 'Eggplant', quantity: 2 }, { name: 'Tomatoes', quantity: 4 } ] },
        'sinigang': { name: 'Sinigang', ingredients: [ { name: 'Pork Ribs or Shrimp', quantity: 1 }, { name: 'Sinigang Tamarind Mix', quantity: 2 }, { name: 'Kangkong', quantity: 1 }, { name: 'Radish', quantity: 2 }, { name: 'Eggplant', quantity: 2 }, { name: 'Tomatoes', quantity: 4 }, { name: 'Green Finger Chili', quantity: 3 } ] },
        'tinola': { name: 'Chicken Tinola', ingredients: [ { name: 'Chicken cuts', quantity: 1 }, { name: 'Sayote or Green Papaya', quantity: 1 }, { name: 'Malunggay Leaves', quantity: 1 }, { name: 'Fresh Ginger', quantity: 1 }, { name: 'Garlic & Onion', quantity: 1 }, { name: 'Fish Sauce', quantity: 1 } ] },
        'kare-kare': { name: 'Kare-Kare', ingredients: [ { name: 'Beef Chuck or Oxtail', quantity: 1 }, { name: 'Peanut Butter', quantity: 1 }, { name: 'String Beans', quantity: 1 }, { name: 'Eggplant', quantity: 2 }, { name: 'Bok Choy', quantity: 1 }, { name: 'Shrimp Paste', quantity: 1 } ] },
        'kare kare': { name: 'Kare-Kare', ingredients: [ { name: 'Beef Chuck or Oxtail', quantity: 1 }, { name: 'Peanut Butter', quantity: 1 }, { name: 'String Beans', quantity: 1 }, { name: 'Eggplant', quantity: 2 }, { name: 'Bok Choy', quantity: 1 }, { name: 'Shrimp Paste', quantity: 1 } ] },
        'beef caldereta': { name: 'Beef Caldereta', ingredients: [ { name: 'Beef Chuck cuts', quantity: 1 }, { name: 'Liver Spread', quantity: 1 }, { name: 'Tomato Sauce', quantity: 1 }, { name: 'Potatoes', quantity: 3 }, { name: 'Carrots', quantity: 2 }, { name: 'Bell Peppers', quantity: 2 } ] },
        'caldereta': { name: 'Beef Caldereta', ingredients: [ { name: 'Beef Chuck cuts', quantity: 1 }, { name: 'Liver Spread', quantity: 1 }, { name: 'Tomato Sauce', quantity: 1 }, { name: 'Potatoes', quantity: 3 }, { name: 'Carrots', quantity: 2 }, { name: 'Bell Peppers', quantity: 2 } ] },
        'kaldereta': { name: 'Beef Caldereta', ingredients: [ { name: 'Beef Chuck cuts', quantity: 1 }, { name: 'Liver Spread', quantity: 1 }, { name: 'Tomato Sauce', quantity: 1 }, { name: 'Potatoes', quantity: 3 }, { name: 'Carrots', quantity: 2 }, { name: 'Bell Peppers', quantity: 2 } ] },
        'filipino spaghetti': { name: 'Filipino Spaghetti', ingredients: [ { name: 'Spaghetti Pasta', quantity: 1 }, { name: 'Sweet Spaghetti Sauce', quantity: 1 }, { name: 'Ground Pork or Beef', quantity: 1 }, { name: 'Red Hotdogs', quantity: 4 }, { name: 'Cheddar Cheese', quantity: 1 } ] },
        'spaghetti': { name: 'Spaghetti', ingredients: [ { name: 'Spaghetti Pasta', quantity: 1 }, { name: 'Sweet Spaghetti Sauce', quantity: 1 }, { name: 'Ground Pork or Beef', quantity: 1 }, { name: 'Red Hotdogs', quantity: 4 }, { name: 'Cheddar Cheese', quantity: 1 } ] },
        'carbonara': { name: 'Carbonara', ingredients: [ { name: 'Fettuccine Pasta', quantity: 1 }, { name: 'Bacon cuts', quantity: 1 }, { name: 'All-Purpose Cream', quantity: 1 }, { name: 'Parmesan Cheese', quantity: 1 }, { name: 'Eggs', quantity: 4 } ] },
        'pancit canton': { name: 'Pancit Canton', ingredients: [ { name: 'Canton Noodles', quantity: 1 }, { name: 'Pork cuts', quantity: 1 }, { name: 'Cabbage', quantity: 1 }, { name: 'Carrots', quantity: 2 }, { name: 'Soy Sauce', quantity: 1 }, { name: 'Calamansi', quantity: 6 } ] },
        'pancit bihon': { name: 'Pancit Bihon', ingredients: [ { name: 'Bihon Rice Noodles', quantity: 1 }, { name: 'Chicken strips', quantity: 1 }, { name: 'Cabbage', quantity: 1 }, { name: 'Carrots', quantity: 2 }, { name: 'Soy Sauce', quantity: 1 }, { name: 'Calamansi', quantity: 6 } ] },
        'pancit': { name: 'Pancit', ingredients: [ { name: 'Pancit Noodles', quantity: 1 }, { name: 'Pork cuts', quantity: 1 }, { name: 'Cabbage', quantity: 1 }, { name: 'Carrots', quantity: 2 }, { name: 'Soy Sauce', quantity: 1 }, { name: 'Calamansi', quantity: 6 } ] },
        'lumpia': { name: 'Lumpia', ingredients: [ { name: 'Lumpia Wrappers', quantity: 1 }, { name: 'Ground Pork', quantity: 1 }, { name: 'Carrots minced', quantity: 2 }, { name: 'Minced Onion & Garlic', quantity: 1 }, { name: 'Eggs', quantity: 2 }, { name: 'Sweet Chili Sauce', quantity: 1 } ] },
        'chicken curry': { name: 'Chicken Curry', ingredients: [ { name: 'Chicken cuts', quantity: 1 }, { name: 'Curry Powder', quantity: 1 }, { name: 'Coconut Milk', quantity: 2 }, { name: 'Potatoes', quantity: 2 }, { name: 'Carrots', quantity: 2 }, { name: 'Bell Peppers', quantity: 2 } ] },
        'curry': { name: 'Curry', ingredients: [ { name: 'Chicken cuts', quantity: 1 }, { name: 'Curry Powder', quantity: 1 }, { name: 'Coconut Milk', quantity: 2 }, { name: 'Potatoes', quantity: 2 }, { name: 'Carrots', quantity: 2 }, { name: 'Bell Peppers', quantity: 2 } ] },
        'menudo': { name: 'Menudo', ingredients: [ { name: 'Pork Stew cuts', quantity: 1 }, { name: 'Pork Liver', quantity: 1 }, { name: 'Tomato Sauce', quantity: 1 }, { name: 'Potatoes', quantity: 2 }, { name: 'Carrots', quantity: 2 }, { name: 'Hotdogs', quantity: 2 } ] },
        'afritada': { name: 'Afritada', ingredients: [ { name: 'Chicken or Pork cuts', quantity: 1 }, { name: 'Tomato Sauce', quantity: 1 }, { name: 'Potatoes', quantity: 2 }, { name: 'Carrots', quantity: 2 }, { name: 'Bell Peppers', quantity: 2 } ] },
        'bulalo': { name: 'Bulalo', ingredients: [ { name: 'Beef Shank with Marrow', quantity: 1 }, { name: 'Corn on the Cob', quantity: 2 }, { name: 'Bok Choy or Pechay', quantity: 1 }, { name: 'Whole Black Peppercorn', quantity: 1 }, { name: 'Fish Sauce', quantity: 1 } ] },
        'pancakes': { name: 'Pancakes', ingredients: [ { name: 'Pancake Mix or Flour', quantity: 1 }, { name: 'Fresh Milk', quantity: 1 }, { name: 'Eggs', quantity: 4 }, { name: 'Butter', quantity: 1 }, { name: 'Maple Syrup', quantity: 1 } ] },
        'pancake': { name: 'Pancakes', ingredients: [ { name: 'Pancake Mix or Flour', quantity: 1 }, { name: 'Fresh Milk', quantity: 1 }, { name: 'Eggs', quantity: 4 }, { name: 'Butter', quantity: 1 }, { name: 'Maple Syrup', quantity: 1 } ] },
        'fried rice': { name: 'Fried Rice', ingredients: [ { name: 'Rice', quantity: 1 }, { name: 'Garlic', quantity: 2 }, { name: 'Eggs', quantity: 3 }, { name: 'Spring Onions', quantity: 1 }, { name: 'Cooking Oil', quantity: 1 } ] },
        'tacos': { name: 'Tacos', ingredients: [ { name: 'Taco Shells or Tortillas', quantity: 1 }, { name: 'Ground Beef', quantity: 1 }, { name: 'Taco Seasoning', quantity: 1 }, { name: 'Shredded Lettuce', quantity: 1 }, { name: 'Tomatoes', quantity: 3 }, { name: 'Cheddar Cheese', quantity: 1 } ] },
        'pizza': { name: 'Pizza', ingredients: [ { name: 'Pizza Dough or Crust', quantity: 1 }, { name: 'Pizza Sauce', quantity: 1 }, { name: 'Mozzarella Cheese', quantity: 1 }, { name: 'Pepperoni', quantity: 1 }, { name: 'Bell Pepper and Mushroom', quantity: 1 } ] },
        'lasagna': { name: 'Lasagna', ingredients: [ { name: 'Lasagna Sheets', quantity: 1 }, { name: 'Ground Beef', quantity: 1 }, { name: 'Tomato Pasta Sauce', quantity: 1 }, { name: 'Ricotta or Cream', quantity: 1 }, { name: 'Mozzarella Cheese', quantity: 1 } ] },
        'beef broccoli': { name: 'Beef Broccoli', ingredients: [ { name: 'Beef Strips', quantity: 1 }, { name: 'Fresh Broccoli', quantity: 2 }, { name: 'Oyster Sauce', quantity: 1 }, { name: 'Soy Sauce', quantity: 1 }, { name: 'Garlic and Onion', quantity: 1 } ] },
        'arroz caldo': { name: 'Arroz Caldo', ingredients: [ { name: 'Glutinous Rice', quantity: 1 }, { name: 'Chicken cuts', quantity: 1 }, { name: 'Fresh Ginger', quantity: 2 }, { name: 'Garlic Bits', quantity: 1 }, { name: 'Eggs', quantity: 4 }, { name: 'Calamansi', quantity: 6 } ] },
        'bicol express': { name: 'Bicol Express', ingredients: [ { name: 'Pork Belly cuts', quantity: 1 }, { name: 'Coconut Milk', quantity: 2 }, { name: 'Shrimp Paste', quantity: 1 }, { name: 'Green Finger Chili', quantity: 8 } ] },
        'chocolate chip cookies': { name: 'Chocolate Chip Cookies', ingredients: [ { name: 'All-Purpose Flour', quantity: 1 }, { name: 'Chocolate Chips', quantity: 1 }, { name: 'Brown Sugar', quantity: 1 }, { name: 'Butter', quantity: 1 }, { name: 'Eggs', quantity: 2 }, { name: 'Vanilla Extract', quantity: 1 } ] },
        'cookies': { name: 'Cookies', ingredients: [ { name: 'All-Purpose Flour', quantity: 1 }, { name: 'Chocolate Chips', quantity: 1 }, { name: 'Brown Sugar', quantity: 1 }, { name: 'Butter', quantity: 1 }, { name: 'Eggs', quantity: 2 }, { name: 'Vanilla Extract', quantity: 1 } ] },
        'caesar salad': { name: 'Caesar Salad', ingredients: [ { name: 'Romaine Lettuce', quantity: 2 }, { name: 'Caesar Dressing', quantity: 1 }, { name: 'Croutons', quantity: 1 }, { name: 'Parmesan Cheese', quantity: 1 } ] },
        'salad': { name: 'Salad', ingredients: [ { name: 'Mixed Greens / Lettuce', quantity: 1 }, { name: 'Salad Dressing', quantity: 1 }, { name: 'Tomatoes', quantity: 3 }, { name: 'Cucumber', quantity: 2 } ] }
    };
    const app = {
        user: null, tasks: [], groceries: [], groceryHistory: [], pills: [],
        selectedCalendarDate: dayKey(), calendarMonth: new Date(new Date().getFullYear(),new Date().getMonth(),1),
        currentTaskFilter: 'all', _ready: false, _alarm: null, _interval: null, _editingTask: '',
        escape(value = '') { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },
        pageName() { return root.location.pathname.split('/').pop() || 'index.html'; },
        pageUrl(name, query = '') {
            if (!pages.includes(name)) throw new Error('Unknown page.');
            const inPages = root.location.pathname.includes('/pages/');
            let url = name === 'index.html' ? (inPages?'../index.html':'index.html') : (inPages?name:'pages/'+name);
            const params = new URLSearchParams(query);
            if (demo) params.set('demo','1');
            return url + (params.toString()?'?'+params.toString():'');
        },
        navigate(name, query = '') {
            const url = this.pageUrl(name, query);
            if (typeof root.DOMParser !== 'undefined' && root.history && typeof root.history.pushState === 'function') {
                this.loadPage(name, query);
            } else {
                root.location.href = url;
            }
        },
        async loadPage(name, query = '', pushState = true) {
            if (!pages.includes(name) || this._loadingPage) return;
            const targetUrl = this.pageUrl(name, query);
            if (['index.html', 'signup.html'].includes(name) || ['index.html', 'signup.html'].includes(this.pageName())) {
                root.location.href = targetUrl;
                return;
            }
            this._loadingPage = true;
            try {
                const res = await root.fetch(targetUrl);
                if (!res.ok) throw new Error('Page could not be loaded.');
                const html = await res.text();
                const parser = new root.DOMParser();
                const doc = parser.parseFromString(html, 'text/html');

                const newBody = doc.querySelector('.app-page-body');
                const currentBody = document.querySelector('.app-page-body');
                if (newBody && currentBody) {
                    currentBody.innerHTML = newBody.innerHTML;
                    currentBody.className = newBody.className;
                    currentBody.classList.remove('page-swapped');
                    void currentBody.offsetWidth;
                    currentBody.classList.add('page-swapped');
                }

                doc.querySelectorAll('.modal-backdrop-overlay').forEach(newModal => {
                    const existing = byId(newModal.id);
                    if (!existing) {
                        document.body.appendChild(newModal);
                    }
                });

                const newFab = doc.querySelector('.fab-container');
                const currentFab = document.querySelector('.fab-container');
                if (newFab && !currentFab) {
                    const fabEl = document.createElement('div');
                    fabEl.className = 'fab-container';
                    fabEl.innerHTML = newFab.innerHTML;
                    document.body.appendChild(fabEl);
                } else if (newFab && currentFab) {
                    currentFab.innerHTML = newFab.innerHTML;
                    currentFab.hidden = false;
                } else if (!newFab && currentFab) {
                    currentFab.remove();
                }

                document.querySelectorAll('.modal-backdrop-overlay.active').forEach(modal => modal.classList.remove('active'));
                byId('remindersPopup')?.classList.remove('open');
                const copilotDropdown = byId('aiCopilotDropdown');
                if (copilotDropdown) copilotDropdown.hidden = true;
                document.querySelector('.topbar-search')?.classList.remove('mobile-open');
                if (root.innerWidth <= 768) {
                    byId('appSidebar')?.classList.remove('open');
                    byId('sidebarOverlay')?.classList.remove('active');
                }

                if (doc.title) document.title = doc.title;
                if (pushState && root.history && typeof root.history.pushState === 'function') {
                    root.history.pushState({ page: name, query }, doc.title, targetUrl);
                }

                document.querySelectorAll('.sidebar-nav-item').forEach(link => {
                    const href = link.getAttribute('href')?.split('?')[0];
                    link.classList.toggle('active', href === name);
                });

                const searchInput = byId('topbarSearchInput');
                const newSearch = doc.getElementById('topbarSearchInput');
                if (searchInput && newSearch) {
                    searchInput.placeholder = newSearch.placeholder;
                    searchInput.value = '';
                }

                const params = new URLSearchParams(query);
                const filter = params.get('category') || params.get('filter');
                this.currentTaskFilter = Object.hasOwn(labels, filter) || ['today', 'completed'].includes(filter) ? filter : 'all';
                const date = params.get('date');
                if (validation.isValidDate(date)) {
                    this.selectedCalendarDate = date;
                    this.calendarMonth = new Date(date + 'T12:00:00');
                }

                this.setupSharedModals();
                this.setupTaskForm();
                this.setupGroceryForm();
                this.setupPillForm();
                this.setupReportForm();

                if (name === 'profile.html') {
                    root.PTWebAuth?.initProfile?.();
                } else if (name === 'faqs.html') {
                    const topic = params.get('topic');
                    if (['getting-started', 'using-parentech', 'troubleshooting'].includes(topic)) {
                        const card = byId(topic);
                        card?.classList.add('open');
                        card?.scrollIntoView({ block: 'center' });
                        card?.querySelector('.faq-question-btn')?.focus();
                    }
                }

                this.applyTheme();
                this.refreshViews();
                root.scrollTo?.(0, 0);
            } catch (_) {
                root.location.href = targetUrl;
            } finally {
                this._loadingPage = false;
            }
        },
        syncState() {
            const state = store.getState();
            this.user = state.user;
            this.tasks = state.tasks.map(task => ({...task,desc:task.description,done:task.completed}));
            this.pills = this.tasks.filter(task => task.category === 'pill');
            this.groceries = state.groceries;
            this.groceryHistory = state.purchases;
            return state;
        },
        async init() {
            if (this._ready) return;
            this.applyTheme();
            try {
                if (!store || !validation || !root.PTWebAuth) throw new Error('Account scripts could not be loaded. Please start the app with npm start.');
                await store.init();
                if (demo && !store.getState().user) store.demo();
                this.syncState();
                const authPage = ['index.html','signup.html'].includes(this.pageName());
                if (!this.user && !authPage) { this.navigate('index.html'); return; }
                if (this.user && authPage) { this.navigate('home.html'); return; }
                this.applyTheme();
                this.setupNavigation();
                this.setupSharedModals();
                this.setupSearch();
                if (this.pageName() === 'index.html') root.PTWebAuth.initLogin();
                else if (this.pageName() === 'signup.html') root.PTWebAuth.initSignup();
                else {
                    const params = new URLSearchParams(root.location.search);
                    const filter = params.get('category') || params.get('filter');
                    this.currentTaskFilter = Object.hasOwn(labels,filter) || ['today','completed'].includes(filter) ? filter : 'all';
                    const date = params.get('date');
                    if (validation.isValidDate(date)) { this.selectedCalendarDate=date;this.calendarMonth=new Date(date+'T12:00:00'); }
                    this.setupTaskForm();
                    this.setupGroceryForm();
                    this.setupPillForm();
                    this.setupReportForm();
                    this.setupAIBriefing();
                    this.setupAICalendar();
                    if (this.pageName() === 'profile.html') root.PTWebAuth.initProfile();
                    this.refreshViews();
                    this.checkReminders();
                    this.scheduleReminders();
                    this._interval = setInterval(() => { this.checkReminders();this.scheduleReminders(); },15*60*1000);
                }
                this._ready = true;
                const splash = byId('splash');
                if (splash) setTimeout(() => splash.classList.add('hidden'),900);
            } catch (error) {
                this.showToast(error.message || 'The local server could not be reached.');
                const form = byId('loginForm') || byId('signupForm');
                if (form) { this.formError(form,error);root.PTWebAuth?.[this.pageName()==='signup.html'?'initSignup':'initLogin'](); }
                else {
                    const notice = document.createElement('div');
                    notice.className='form-error';notice.setAttribute('role','alert');
                    notice.textContent='Cannot check your account. Start the local server and reload this page.';
                    document.body.prepend(notice);
                    document.querySelector('.app-shell')?.setAttribute('hidden','');
                }
            } finally { document.body.classList.remove('backend-loading'); }
        },
        applyTheme() {
            const theme = store ? store.getState().settings.theme : 'light';
            const dark = theme === 'dark' || (theme === 'system' && (root.matchMedia ? root.matchMedia('(prefers-color-scheme: dark)').matches : false));
            if (document.body) {
                document.body.classList.toggle('dark-theme', dark);
                document.body.dataset.theme = dark ? 'dark' : 'light';
            }
            if (document.documentElement) {
                document.documentElement.classList.toggle('dark-theme', dark);
                document.documentElement.dataset.theme = dark ? 'dark' : 'light';
            }
            document.querySelectorAll('[data-theme-icon]').forEach(el => { el.className = dark ? 'fa-solid fa-sun' : 'fa-solid fa-moon'; });
            const label = byId('themeModeLabel'); if (label) label.textContent = theme === 'system' ? 'System Default' : (dark ? 'Dark Mode' : 'Light Mode');
        },
        toggleTheme() {
            if (document.body) document.body.classList.add('theme-transitioning');
            store.updateSettings({ theme: document.body && document.body.classList.contains('dark-theme') ? 'light' : 'dark' });
            this.applyTheme();
            root.PTWebAuth?.refreshProfile?.();
            setTimeout(() => { if (document.body) document.body.classList.remove('theme-transitioning'); }, 350);
        },
        showToast(message) {
            let toast=byId('prototypeToast');
            if(!toast){toast=document.createElement('div');toast.id='prototypeToast';toast.className='prototype-toast';document.body.appendChild(toast);}
            toast.innerHTML='<i class="fa-solid fa-circle-check"></i><span>'+this.escape(message)+'</span>';
            toast.classList.add('show');clearTimeout(this._toastTimer);
            this._toastTimer=setTimeout(()=>toast.classList.remove('show'),3200);
        },
        formError(form,error,map = {}) {
            form.querySelectorAll('.field-error').forEach(node=>node.remove());
            form.querySelectorAll('[aria-invalid]').forEach(node=>node.removeAttribute('aria-invalid'));
            let box=form.querySelector('.form-error');
            if(!box){box=document.createElement('p');box.className='form-error';box.setAttribute('role','alert');form.appendChild(box);}
            box.textContent=error.message||'Please check the highlighted fields.';box.hidden=false;
            for(const [name,message] of Object.entries(error.fields||{})){
                const input=byId(map[name]||name)||form.querySelector('[name="'+name+'"]');
                if(!input)continue;
                input.setAttribute('aria-invalid','true');
                const note=document.createElement('p');note.className='field-error';note.textContent=message;
                (input.closest('.form-field-pill')||input.parentElement).appendChild(note);
            }
        },
        async submitForm(form,action,map = {}) {
            if(form.dataset.submitting==='true')return;
            const error=form.querySelector('.form-error');if(error){error.hidden=true;error.textContent='';}
            form.querySelectorAll('.field-error').forEach(node=>node.remove());
            form.querySelectorAll('[aria-invalid]').forEach(node=>node.removeAttribute('aria-invalid'));
            form.dataset.submitting='true';form.setAttribute('aria-busy','true');
            const button=form.querySelector('[type="submit"]');if(button)button.disabled=true;
            try { await action(); }
            catch(error){this.formError(form,error,map);}
            finally{delete form.dataset.submitting;form.removeAttribute('aria-busy');if(button)button.disabled=false;}
        },
        setupNavigation() {
            const sidebar = byId('appSidebar'), overlay = byId('sidebarOverlay');
            const applySidebarState = () => {
                const minimized = localStorage.getItem('pt_sidebar_minimized') === 'true';
                if (root.innerWidth > 768) {
                    sidebar?.classList.toggle('minimized', minimized);
                    document.querySelector('.app-shell')?.classList.toggle('sidebar-minimized', minimized);
                } else {
                    sidebar?.classList.remove('minimized');
                    document.querySelector('.app-shell')?.classList.remove('sidebar-minimized');
                }
            };
            applySidebarState();
            root.addEventListener('resize', applySidebarState);

            byId('sidebarToggleBtn')?.addEventListener('click', () => {
                if (root.innerWidth <= 768) {
                    sidebar?.classList.toggle('open');
                    overlay?.classList.toggle('active');
                } else {
                    const isMin = sidebar?.classList.toggle('minimized');
                    document.querySelector('.app-shell')?.classList.toggle('sidebar-minimized', isMin);
                    try { localStorage.setItem('pt_sidebar_minimized', isMin ? 'true' : 'false'); } catch (_) {}
                }
            });
            overlay?.addEventListener('click', () => {
                sidebar?.classList.remove('open');
                overlay.classList.remove('active');
            });
            document.querySelectorAll('.sidebar-nav-item').forEach(link => {
                link.classList.toggle('active', link.getAttribute('href')?.split('?')[0] === this.pageName());
                const text = link.querySelector('span')?.textContent?.trim();
                if (text && !link.getAttribute('title')) link.setAttribute('title', text);
            });
            const logoutBtn = document.querySelector('.btn-sidebar-logout');
            if (logoutBtn && !logoutBtn.getAttribute('title')) logoutBtn.setAttribute('title', 'Logout');
            byId('sidebarToggleBtn')?.setAttribute('title', 'Minimize / Expand sidebar');
            byId('notifBtn')?.addEventListener('click',event=>{event.stopPropagation();byId('remindersPopup')?.classList.toggle('open');this.renderRemindersPopup();});
            byId('closeRemindersPopup')?.addEventListener('click',()=>byId('remindersPopup')?.classList.remove('open'));
            // Seamless client-side section navigation for internal links
            document.addEventListener('click', event => {
                const link = event.target.closest('a[href]');
                if (!link) return;
                const href = link.getAttribute('href');
                if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || link.target === '_blank' || link.dataset.action === 'logout') return;
                if (typeof root.DOMParser === 'undefined' || !root.history || typeof root.history.pushState !== 'function') return;

                const url = new URL(href, root.location.href);
                if (url.origin !== root.location.origin) return;
                const name = url.pathname.split('/').pop() || 'index.html';
                if (!pages.includes(name) || ['index.html', 'signup.html'].includes(name)) return;

                event.preventDefault();
                this.loadPage(name, url.search);
            });

            root.addEventListener('popstate', () => {
                if (typeof root.DOMParser === 'undefined') return;
                const name = root.location.pathname.split('/').pop() || 'home.html';
                if (pages.includes(name) && !['index.html', 'signup.html'].includes(name)) {
                    this.loadPage(name, root.location.search, false);
                }
            });

            document.addEventListener('click',event=>{
                const faqBtn = event.target.closest('.faq-question-btn');
                if (faqBtn) { faqBtn.closest('.faq-card-item')?.classList.toggle('open'); return; }
                const target=event.target.closest('[data-action]');
                if(!target)return;
                const action=target.dataset.action,id=target.dataset.id;
                if(['navigate','open-category','toggle-theme','logout','confirm-logout','close-modal','new-task','new-pill','refill-pill','toggle-task','delete-task','edit-task','purchase-grocery','edit-grocery','delete-grocery','restore-purchase','calendar-select','calendar-prev','calendar-next'].includes(action))event.preventDefault();
                try{
                    switch(action){
                        case 'navigate':this.navigate(target.dataset.page,target.dataset.topic?'topic='+target.dataset.topic:'');break;
                        case 'open-category':this.navigate('tasks.html','category='+target.dataset.category);break;
                        case 'toggle-theme':this.toggleTheme();break;
                        case 'logout':this.openLogoutModal();break;
                        case 'confirm-logout':this.logout();break;
                        case 'close-modal':target.closest('.modal-backdrop-overlay')?.classList.remove('active');break;
                        case 'new-task':this.openNewTaskModal(target.dataset.category,target.dataset.date);break;
                        case 'new-pill':this.openPillModal();break;
                        case 'refill-pill':this.refillPillToGrocery(target.dataset.title || id);break;
                        case 'toggle-task':this.toggleTask(id);break;
                        case 'delete-task':this.deleteTask(id);break;
                        case 'edit-task':this.openNewTaskModal(null,null,id);break;
                        case 'purchase-grocery':this.toggleGrocery(id);break;
                        case 'edit-grocery':this.editGrocery(id);break;
                        case 'delete-grocery':this.deleteGrocery(id);break;
                        case 'restore-purchase':this.restorePurchase(id);break;
                        case 'calendar-select':this.selectCalendarDay(target.dataset.date);break;
                        case 'calendar-prev':this.calendarMonth=new Date(this.calendarMonth.getFullYear(),this.calendarMonth.getMonth()-1,1);this.renderCalendarMonth();break;
                        case 'calendar-next':this.calendarMonth=new Date(this.calendarMonth.getFullYear(),this.calendarMonth.getMonth()+1,1);this.renderCalendarMonth();break;
                    }
                }catch(error){this.showToast(error.message);}
            });
            if(demo)document.querySelectorAll('a[href]').forEach(link=>{
                const href=link.getAttribute('href');if(!href||href.startsWith('#'))return;
                const url=new URL(href,root.location.href),name=url.pathname.split('/').pop();
                if(url.origin===root.location.origin&&pages.includes(name))link.setAttribute('href',this.pageUrl(name,url.search));
            });
            document.addEventListener('keydown',event=>{
                if(['Enter',' '].includes(event.key)&&event.target.matches('[data-action][role="link"],[data-action][role="button"]')){event.preventDefault();event.target.click();}
                if ((event.ctrlKey || event.metaKey) && event.key?.toLowerCase() === 'k') {
                    const searchInput = byId('topbarSearchInput');
                    if (searchInput) {
                        event.preventDefault();
                        document.querySelector('.topbar-search')?.classList.add('mobile-open');
                        searchInput.focus();
                    }
                }
                if(event.key==='Escape'){
                    document.querySelectorAll('.modal-backdrop-overlay.active').forEach(modal=>modal.classList.remove('active'));
                    byId('remindersPopup')?.classList.remove('open');
                    const copilotDropdown = byId('aiCopilotDropdown');
                    if (copilotDropdown) copilotDropdown.hidden = true;
                    document.querySelector('.topbar-search')?.classList.remove('mobile-open');
                    byId('appSidebar')?.classList.remove('open');
                    byId('sidebarOverlay')?.classList.remove('active');
                }
            });
            if(this.pageName()==='faqs.html'){
                const topic=new URLSearchParams(root.location.search).get('topic');
                if(['getting-started','using-parentech','troubleshooting'].includes(topic)){const card=byId(topic);card?.classList.add('open');card?.scrollIntoView({block:'center'});card?.querySelector('.faq-question-btn')?.focus();}
            }
        },
        setupSharedModals() {
            document.querySelectorAll('.modal-backdrop-overlay:not([data-bound])').forEach(modal=>{
                modal.dataset.bound='true';
                modal.addEventListener('click',event=>{if(event.target===modal)modal.classList.remove('active');});
            });
            document.querySelectorAll('.cat-picker-item:not([data-bound])').forEach(item=>{
                item.dataset.bound='true';
                item.addEventListener('click',()=>{
                    document.querySelectorAll('.cat-picker-item').forEach(other=>other.classList.toggle('active',other===item));
                });
            });
            const tdp = byId('triggerDatePickerBtn');
            if (tdp && !tdp.dataset.bound) {
                tdp.dataset.bound = 'true';
                tdp.addEventListener('click',()=>{if(byId('datePickerInput'))byId('datePickerInput').value=byId('modalTaskDate').value;byId('datePickerDialog')?.classList.add('active');});
            }
            const cdp = byId('confirmDatePickerBtn');
            if (cdp && !cdp.dataset.bound) {
                cdp.dataset.bound = 'true';
                cdp.addEventListener('click',()=>{const value=byId('datePickerInput')?.value;if(validation.isValidDate(value)){byId('modalTaskDate').value=value;byId('datePickerDialog').classList.remove('active');}else this.showToast('Choose a valid date.');});
            }
            const ttp = byId('triggerTimePickerBtn');
            if (ttp && !ttp.dataset.bound) {
                ttp.dataset.bound = 'true';
                ttp.addEventListener('click',()=>{if(byId('timePickerInput'))byId('timePickerInput').value=byId('modalTaskTime').value;byId('timePickerDialog')?.classList.add('active');});
            }
            const ctp = byId('confirmTimePickerBtn');
            if (ctp && !ctp.dataset.bound) {
                ctp.dataset.bound = 'true';
                ctp.addEventListener('click',()=>{const value=byId('timePickerInput')?.value;if(/^([01]\d|2[0-3]):[0-5]\d$/.test(value)){byId('modalTaskTime').value=value;byId('timePickerDialog').classList.remove('active');}else this.showToast('Choose a valid time.');});
            }
            document.querySelectorAll('.task-filter-pill:not([data-bound])').forEach(button=>{
                button.dataset.bound = 'true';
                button.addEventListener('click',()=>{
                    this.currentTaskFilter=button.dataset.filter;
                    const url=new URL(root.location.href);url.searchParams.delete('category');url.searchParams.delete('filter');
                    if(this.currentTaskFilter!=='all')url.searchParams.set(Object.hasOwn(labels,this.currentTaskFilter)?'category':'filter',this.currentTaskFilter);
                    root.history.replaceState(null,'',url);this.renderTasksList();
                });
            });
            const calViewAll = byId('calendarViewAllBtn');
            if (calViewAll && !calViewAll.dataset.bound) {
                calViewAll.dataset.bound = 'true';
                calViewAll.addEventListener('click',event=>{event.preventDefault();byId('standardCalendarSection').style.display='none';byId('fullCalendarSection').style.display='block';this.renderFullCalendar();});
            }
            const backCal = byId('backToStandardCalendarBtn');
            if (backCal && !backCal.dataset.bound) {
                backCal.dataset.bound = 'true';
                backCal.addEventListener('click',()=>{byId('fullCalendarSection').style.display='none';byId('standardCalendarSection').style.display='';this.calendarMonth=new Date(this.selectedCalendarDate+'T12:00:00');this.renderCalendarMonth();});
            }
            const grocHist = byId('groceryHistoryToggleBtn');
            if (grocHist && !grocHist.dataset.bound) {
                grocHist.dataset.bound = 'true';
                grocHist.addEventListener('click',()=>byId('groceryHistorySection')?.scrollIntoView({behavior:'smooth'}));
            }
        },
        setupTaskForm() {
            const form=byId('newTaskForm');if(!form||form.dataset.bound)return;form.noValidate=true;form.dataset.bound='true';
            form.addEventListener('submit',event=>{event.preventDefault();this.submitForm(form,()=>{
                const category=document.querySelector('.cat-picker-item.active')?.dataset.category||'personal';
                const input={title:byId('modalTaskTitle').value,description:byId('modalTaskDesc')?.value||'',category,date:byId('modalTaskDate').value,time:byId('modalTaskTime').value};
                if(this._editingTask)input.id=this._editingTask;
                store.saveTask(input);
                const aiDish = this.aiDetectCookingDish(input.title, input.description);
                if (aiDish) {
                    this.aiAddRecipeIngredients(aiDish, 'task');
                } else {
                    this.showToast(category==='pill'?'Reminder saved.':'Task saved.');
                }
                this.refreshViews();byId('newTaskModal').classList.remove('active');form.reset();
            },{title:'modalTaskTitle',description:'modalTaskDesc',category:'modalTaskTitle',date:'modalTaskDate',time:'modalTaskTime'});});

            // AI Smart Quick Fill
            const smartPrompt = byId('aiSmartTaskPrompt');
            const smartFillBtn = byId('aiSmartFillBtn');
            if (smartFillBtn && !smartFillBtn.dataset.bound) {
                smartFillBtn.dataset.bound = 'true';
                const executeSmartFill = () => {
                    const text = smartPrompt ? smartPrompt.value.trim() : '';
                    if (!text) {
                        this.showToast('Please type a task description to auto-fill.');
                        smartPrompt?.focus();
                        return;
                    }
                    const parsed = this.aiParseNaturalTask(text);
                    if (parsed.title) byId('modalTaskTitle').value = parsed.title;
                    if (parsed.date) byId('modalTaskDate').value = parsed.date;
                    if (parsed.time) byId('modalTaskTime').value = parsed.time;
                    if (parsed.category) {
                        document.querySelectorAll('.cat-picker-item').forEach(item => {
                            item.classList.toggle('active', item.dataset.category === parsed.category);
                        });
                    }
                    this.showToast('✨ AI auto-filled your task details!');
                    byId('modalTaskTitle')?.focus();
                };
                smartFillBtn.addEventListener('click', executeSmartFill);
                if (smartPrompt && !smartPrompt.dataset.bound) {
                    smartPrompt.dataset.bound = 'true';
                    smartPrompt.addEventListener('keydown', e => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            executeSmartFill();
                        }
                    });
                }
            }

            // AI Step-by-Step Subtask Generator
            const subtasksBtn = byId('aiSubtasksBtn');
            if (subtasksBtn && !subtasksBtn.dataset.bound) {
                subtasksBtn.dataset.bound = 'true';
                subtasksBtn.addEventListener('click', () => {
                    const title = byId('modalTaskTitle')?.value.trim() || byId('aiSmartTaskPrompt')?.value.trim();
                    if (!title) {
                        this.showToast('Please enter a task title first.');
                        byId('modalTaskTitle')?.focus();
                        return;
                    }
                    const steps = this.aiGenerateSubtasks(title);
                    const descArea = byId('modalTaskDesc');
                    if (descArea) {
                        descArea.value = steps;
                        descArea.focus();
                    }
                    this.showToast('✨ AI generated action checklist!');
                });
            }

            // AI Auto-Categorize on Title change
            const titleInput = byId('modalTaskTitle');
            if (titleInput && !titleInput.dataset.boundAi) {
                titleInput.dataset.boundAi = 'true';
                titleInput.addEventListener('change', () => {
                    const title = titleInput.value.trim();
                    if (title.length >= 3) {
                        const cat = this.aiPredictCategory(title);
                        if (cat) {
                            document.querySelectorAll('.cat-picker-item').forEach(item => {
                                item.classList.toggle('active', item.dataset.category === cat);
                            });
                        }
                    }
                });
            }
        },
        openNewTaskModal(category,date,id) {
            const modal=byId('newTaskModal');if(!modal){this.navigate('tasks.html');return;}
            const task=id?store.getState().tasks.find(task=>task.id===id):null;
            this._editingTask=task?.id||'';
            const selected=task?.category||category||(Object.hasOwn(labels,this.currentTaskFilter)?this.currentTaskFilter:'personal');
            if (byId('aiSmartTaskPrompt')) byId('aiSmartTaskPrompt').value = '';
            byId('modalTaskTitle').value=task?.title||'';if(byId('modalTaskDesc'))byId('modalTaskDesc').value=task?.description||'';
            byId('modalTaskDate').value=task?.date||date||(this.pageName()==='calendar.html'?this.selectedCalendarDate:dayKey());
            byId('modalTaskTime').value=task?.time||nowTime();
            document.querySelectorAll('.cat-picker-item').forEach(item=>item.classList.toggle('active',item.dataset.category===selected));
            const error=byId('newTaskForm').querySelector('.form-error');if(error)error.hidden=true;
            byId('newTaskForm').querySelectorAll('.field-error').forEach(node=>node.remove());
            byId('newTaskForm').querySelectorAll('[aria-invalid]').forEach(node=>node.removeAttribute('aria-invalid'));
            modal.classList.add('active');byId('modalTaskTitle').focus();
        },
        openLogoutModal() { const modal=byId('logoutConfirmModal');if(modal)modal.classList.add('active');else if(root.confirm('Are you sure you want to log out?'))this.logout(); },
        async logout() { try{await store.logout();root.location.href=root.location.pathname.includes('/pages/')?'../index.html':'index.html';}catch(error){this.showToast(error.message);} },
        refreshViews() {
            this.syncState();if(!this.user)return;
            document.querySelectorAll('.topbar-avatar img').forEach(image=>{image.src=root.PTWebAuth.avatarSource(this.user);image.alt=this.user.name;});
            if(byId('dashGreetingName'))byId('dashGreetingName').textContent=this.user.role;
            if(byId('calendarGreetingName'))byId('calendarGreetingName').textContent=this.user.role;
            for(const [category,id] of Object.entries({personal:'statPersonalCount',family:'statFamilyCount',household:'statHouseholdCount',pill:'statPillCount'})){
                if(byId(id))byId(id).textContent=this.tasks.filter(task=>task.category===category&&!task.done).length;
            }
            this.renderDashboardTasks();this.renderAIBriefing();this.renderTasksList();this.renderGroceryList();this.renderGroceryHistory();
            this.renderCalendarMonth();this.renderSelectedDateEvents();this.renderAICalendarInsights();this.renderPillsList();this.renderAIPillsOverview();this.renderRemindersPopup();
            document.querySelectorAll('.notif-badge').forEach(badge=>{badge.hidden=!this.tasks.some(task=>!task.done&&task.date>=dayKey());});
            if(this.pageName()==='profile.html')root.PTWebAuth.refreshProfile();
            this.scheduleReminders();
        },
        taskMarkup(task) {
            const label=task.category==='pill'?(task.done?'Mark not taken':'Mark taken'):(task.done?'Mark incomplete':'Complete');
            const refillBtn = task.category === 'pill' ? '<button type="button" data-action="refill-pill" data-title="'+this.escape(task.title)+'" class="btn-pill-refill-icon" aria-label="Add '+this.escape(task.title)+' to grocery for refill" title="Add to Grocery shopping list for refill"><i class="fa-solid fa-cart-plus"></i></button>' : '';
            return '<div class="grocery-item-card '+(task.done?'completed':'')+'"><button type="button" class="custom-checkbox-sq '+(task.done?'checked':'')+'" data-action="toggle-task" data-id="'+task.id+'" aria-pressed="'+task.done+'" aria-label="'+label+' '+this.escape(task.title)+'">'+(task.done?'<i class="fa-solid fa-check"></i>':'')+'</button><div class="grocery-item-name">'+this.escape(task.title)+(task.desc?'<div class="task-description">'+this.escape(task.desc)+'</div>':'')+'<div class="task-meta">'+this.escape(labels[task.category])+' · '+this.prettyDay(task.date)+' · '+this.prettyTime(task.time)+'</div></div><div class="item-action-btns">'+refillBtn+'<button type="button" data-action="edit-task" data-id="'+task.id+'" aria-label="Edit '+this.escape(task.title)+'"><i class="fa-regular fa-pen-to-square"></i></button><button type="button" data-action="delete-task" data-id="'+task.id+'" class="delete-btn" aria-label="Delete '+this.escape(task.title)+'"><i class="fa-regular fa-trash-can"></i></button></div></div>';
        },
        renderDashboardTasks() {
            const today=sorted(this.tasks.filter(task=>task.date===dayKey()));
            if(byId('dashTodayTasksList'))byId('dashTodayTasksList').innerHTML=today.length?today.map(task=>this.taskMarkup(task)).join(''):'<div class="empty-strip-card">No tasks or reminders scheduled for today.</div>';
            const upcoming=sorted(this.tasks.filter(task=>!task.done&&task.date>=dayKey()));
            if(byId('dashUpcomingReminders'))byId('dashUpcomingReminders').innerHTML=upcoming.length?upcoming.map(task=>this.taskMarkup(task)).join(''):'<div class="empty-strip-card">No upcoming reminders.</div>';
        },
        renderTasksList(query = '') {
            const container=byId('tasksListContainer');if(!container)return;
            const filter=this.currentTaskFilter;
            let tasks=this.tasks.filter(task=>filter==='all'||filter==='today'&&task.date===dayKey()||filter==='completed'&&task.done||task.category===filter);
            if(query)tasks=tasks.filter(task=>(task.title+' '+task.desc).toLowerCase().includes(query.toLowerCase()));
            document.querySelectorAll('.task-filter-pill').forEach(button=>button.classList.toggle('active',button.dataset.filter===filter));
            const title=document.querySelector('.app-page-body .page-greeting-title');
            if(title)title.textContent=labels[filter]||(filter==='today'?"Today's Tasks":filter==='completed'?'Completed Tasks':'Tasks & Reminders');
            container.innerHTML=tasks.length?sorted(tasks).map(task=>this.taskMarkup(task)).join(''):'<div class="empty-strip-card">No tasks found. Select + to add one.</div>';
        },
        toggleTask(id) { store.toggleTask(id);this.refreshViews();this.showToast('Task status updated.'); },
        deleteTask(id) { if(root.confirm('Delete this task?')){store.deleteTask(id);this.refreshViews();this.showToast('Task removed.');} },
        setupGroceryForm() {
            const form=byId('addGroceryForm');
            if(form&&!form.dataset.bound){
                form.noValidate=true;form.dataset.bound='true';
                form.addEventListener('submit',event=>{event.preventDefault();this.submitForm(form,()=>{
                    store.addGrocery(byId('groceryItemInput').value,byId('groceryQuantity').value);form.reset();byId('groceryQuantity').value='1';this.refreshViews();this.showToast('Item added.');
                },{groceryName:'groceryItemInput',quantity:'groceryQuantity'});});
            }
            const quantity=byId('groceryQuantity');
            if(quantity&&!quantity.dataset.bound){quantity.dataset.bound='true';quantity.addEventListener('beforeinput',event=>{if(event.inputType?.startsWith('insert')&&typeof event.data==='string'&&!/^[0-9]+$/.test(event.data))event.preventDefault();});}

            const aiGenBtn = byId('aiGenerateIngredientsBtn');
            const aiInput = byId('aiDishPromptInput');
            if (aiGenBtn && !aiGenBtn.dataset.bound) {
                aiGenBtn.dataset.bound = 'true';
                const triggerAiGenerate = () => {
                    const text = aiInput ? aiInput.value.trim() : '';
                    if (!text) {
                        this.showToast('Please type a dish or meal to generate ingredients.');
                        aiInput?.focus();
                        return;
                    }
                    const dish = this.aiDetectCookingDish(text) || {
                        name: text.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                        ingredients: [
                            { name: text + ' (Main Protein/Base)', quantity: 1 },
                            { name: 'Fresh Garlic & Onion', quantity: 1 },
                            { name: 'Cooking Oil / Butter', quantity: 1 },
                            { name: 'Seasonings & Spices', quantity: 1 }
                        ]
                    };
                    this.aiAddRecipeIngredients(dish, 'prompt');
                    if (aiInput) aiInput.value = '';
                };
                aiGenBtn.addEventListener('click', triggerAiGenerate);
                if (aiInput && !aiInput.dataset.bound) {
                    aiInput.dataset.bound = 'true';
                    aiInput.addEventListener('keydown', event => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            triggerAiGenerate();
                        }
                    });
                }
            }

            document.querySelectorAll('.ai-recipe-chip:not([data-bound])').forEach(chip => {
                chip.dataset.bound = 'true';
                chip.addEventListener('click', () => {
                    const dishName = chip.dataset.aiDish;
                    if (!dishName) return;
                    const dish = this.aiDetectCookingDish(dishName);
                    if (dish) {
                        this.aiAddRecipeIngredients(dish, 'chip');
                    }
                });
            });
        },
        renderGroceryList(query = '') {
            const container=byId('groceryListContainer');if(!container)return;
            if(byId('groceryRemainingCount'))byId('groceryRemainingCount').textContent=this.groceries.length+' items remaining';
            const items=this.groceries.filter(item=>item.name.toLowerCase().includes(query.toLowerCase()));
            container.innerHTML=items.length?items.map(item=>'<div class="grocery-item-card"><button type="button" class="custom-checkbox-sq" data-action="purchase-grocery" data-id="'+item.id+'" aria-label="Mark '+this.escape(item.name)+' purchased"></button><div class="grocery-item-name">'+this.escape(item.name)+'<span class="task-meta">Qty: '+item.quantity+'</span></div><div class="item-action-btns"><button type="button" data-action="edit-grocery" data-id="'+item.id+'" aria-label="Edit '+this.escape(item.name)+'"><i class="fa-regular fa-pen-to-square"></i></button><button type="button" data-action="delete-grocery" data-id="'+item.id+'" class="delete-btn" aria-label="Delete '+this.escape(item.name)+'"><i class="fa-regular fa-trash-can"></i></button></div></div>').join(''):'<div class="empty-strip-card">Your grocery list is empty. Add items above.</div>';
            this.renderAiDetections();
        },
        addGroceryItem(name,quantity = 1) { store.addGrocery(name,quantity);this.refreshViews();this.showToast('Item added.'); },
        toggleGrocery(id) { store.purchaseGrocery(id);this.refreshViews();this.showToast('Added to purchase history.'); },
        editGrocery(id) {
            const item=this.groceries.find(item=>item.id===id);if(!item)return;
            const name=root.prompt('Edit grocery item:',item.name);if(name===null)return;
            const quantity=root.prompt('Quantity (1–9,999):',String(item.quantity));if(quantity===null)return;
            store.editGrocery(id,name,quantity);this.refreshViews();this.showToast('Grocery updated.');
        },
        deleteGrocery(id) { if(root.confirm('Delete this grocery item?')){store.deleteGrocery(id);this.refreshViews();this.showToast('Item deleted.');} },
        restorePurchase(id) { store.restorePurchase(id);this.refreshViews();this.showToast('Added back to the grocery list.'); },
        renderGroceryHistory() {
            const purchases=[...this.groceryHistory].sort((a,b)=>b.purchasedAt.localeCompare(a.purchasedAt));
            const row=item=>'<button type="button" class="grocery-item-card purchased-item-row" data-action="restore-purchase" data-id="'+item.id+'" aria-label="Add '+this.escape(item.name)+' again"><span class="custom-checkbox-sq checked"><i class="fa-solid fa-check"></i></span><span class="grocery-item-name">'+this.escape(item.name)+'<span class="task-meta">Qty: '+item.quantity+' · '+this.prettyDay(dayKey(new Date(item.purchasedAt)))+'</span></span></button>';
            if(byId('groceryHistoryList'))byId('groceryHistoryList').innerHTML=purchases.length?purchases.map(row).join(''):'<div class="empty-strip-card">No purchase history yet.</div>';
            if(byId('groceryRecentlyPurchased'))byId('groceryRecentlyPurchased').innerHTML=purchases.length?purchases.slice(0,5).map(row).join(''):'<div class="empty-strip-card">No purchases yet.</div>';
            if(byId('groceryPurchaseDate'))byId('groceryPurchaseDate').textContent=purchases.length?this.prettyDay(dayKey(new Date(purchases[0].purchasedAt))):'';
            const recommendations=purchases.filter((item,i,all)=>all.findIndex(other=>other.name.toLowerCase()===item.name.toLowerCase())===i&&!this.groceries.some(active=>active.name.toLowerCase()===item.name.toLowerCase()));
            if(byId('groceryRecommendations'))byId('groceryRecommendations').innerHTML=recommendations.slice(0,6).map(item=>'<button type="button" class="recommended-item-pill" data-action="restore-purchase" data-id="'+item.id+'">'+this.escape(item.name)+' ×'+item.quantity+'</button>').join('')||'<p class="task-meta">Your past purchases will appear here.</p>';
        },
        aiDetectCookingDish(title = '', description = '') {
            const raw = (title + ' ' + description).toLowerCase();
            const text = raw.replace(/[^a-z0-9\s-]/g, ' ');
            const sortedKeys = Object.keys(aiRecipes).sort((a, b) => b.length - a.length);
            for (const key of sortedKeys) {
                const regex = new RegExp('(?:^|\\s)' + key.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '(?:\\s|$)', 'i');
                if (regex.test(text)) {
                    return aiRecipes[key];
                }
            }
            const match = text.match(/\b(?:cook|bake|make|prepare|fry|grill|roast|simmer)\s+([a-z0-9\s-]+?)(?:\s+(?:for|tonight|today|dinner|lunch|breakfast|supper|at|\d|$)|$)/i);
            if (match && match[1]) {
                const candidate = match[1].trim();
                const ignored = ['food', 'lunch', 'dinner', 'breakfast', 'meal', 'meals', 'family dinner', 'something', 'stuff', 'a meal', 'some food'];
                if (candidate.length >= 3 && !ignored.includes(candidate)) {
                    const dishName = candidate.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                    return {
                        name: dishName,
                        ingredients: [
                            { name: dishName + ' (Main Protein/Base)', quantity: 1 },
                            { name: 'Fresh Garlic & Onion', quantity: 1 },
                            { name: 'Cooking Oil / Butter', quantity: 1 },
                            { name: 'Seasonings & Spices', quantity: 1 }
                        ]
                    };
                }
            }
            return null;
        },
        aiAddRecipeIngredients(recipe, source = 'task') {
            if (!recipe || !recipe.ingredients || !recipe.ingredients.length) return 0;
            const currentGroceries = (store.getState() && store.getState().groceries) ? store.getState().groceries : [];
            const existingNames = new Set(currentGroceries.map(item => item.name.trim().toLowerCase()));
            let addedCount = 0;
            const addedItems = [];

            for (const ing of recipe.ingredients) {
                const norm = ing.name.trim().toLowerCase();
                if (!existingNames.has(norm)) {
                    try {
                        store.addGrocery(ing.name, ing.quantity || 1);
                        existingNames.add(norm);
                        addedCount++;
                        addedItems.push(ing.name);
                    } catch (_) {}
                }
            }

            this.aiRecordDetection({
                dish: recipe.name,
                ingredients: recipe.ingredients.map(i => i.name),
                addedCount,
                timestamp: new Date().toISOString(),
                source: source === 'task' ? 'Task Auto-Sync' : source === 'chip' ? 'Quick Suggestion' : 'Direct Prompt'
            });

            if (addedCount > 0) {
                this.showToast('✨ AI Assistant: Added ' + addedCount + ' ingredients for "' + recipe.name + '" to your Grocery List!');
            } else {
                this.showToast('✨ AI Assistant: All ingredients for "' + recipe.name + '" are already in your Grocery List!');
            }

            this.refreshViews();
            return addedCount;
        },
        aiRecordDetection(record) {
            try {
                if (!root.localStorage) return;
                const key = 'pt_ai_detections_' + (this.user?.id || 'demo');
                const raw = root.localStorage.getItem(key);
                let list = raw ? JSON.parse(raw) : [];
                if (!Array.isArray(list)) list = [];
                list.unshift(record);
                if (list.length > 20) list = list.slice(0, 20);
                root.localStorage.setItem(key, JSON.stringify(list));
            } catch (_) {}
        },
        aiGetDetections() {
            try {
                if (!root.localStorage) return [];
                const key = 'pt_ai_detections_' + (this.user?.id || 'demo');
                const raw = root.localStorage.getItem(key);
                return raw ? JSON.parse(raw) : [];
            } catch (_) {
                return [];
            }
        },
        renderAiDetections() {
            const container = byId('aiRecentDetectionsList');
            if (!container) return;
            const countBadge = byId('aiDetectionsCount');
            const detections = this.aiGetDetections();
            if (countBadge) countBadge.textContent = detections.length + (detections.length === 1 ? ' dish detected' : ' dishes detected');
            if (!detections.length) {
                container.innerHTML = '<div class="ai-feed-empty"><i class="fa-solid fa-robot"></i><span>No cooking tasks detected yet. Add a task like "Cook Chicken Adobo for dinner" or use the prompt above!</span></div>';
                return;
            }
            container.innerHTML = detections.slice(0, 6).map(item => {
                const badgeLabel = item.source || 'Task Auto-Sync';
                return '<div class="ai-feed-item">' +
                    '<div>' +
                        '<div class="ai-feed-dish"><i class="fa-solid fa-utensils"></i> ' + this.escape(item.dish) + ' <span class="ai-feed-badge">' + this.escape(badgeLabel) + '</span></div>' +
                        '<div class="ai-feed-ingredients">Ingredients: ' + this.escape(item.ingredients.slice(0, 5).join(', ')) + (item.ingredients.length > 5 ? ' + ' + (item.ingredients.length - 5) + ' more' : '') + '</div>' +
                    '</div>' +
                    '<div class="ai-feed-meta">' +
                        '<span class="ai-feed-added-pill">+' + item.addedCount + ' added</span>' +
                    '</div>' +
                '</div>';
            }).join('');
        },
        aiPredictCategory(text = '') {
            const t = text.toLowerCase();
            if (/\b(pill|pills|medicine|medication|capsule|capsules|tablet|tablets|vitamin|vitamins|supplement|dose|dosage|mg|amoxicillin|calcium|paracetamol|ibuprofen|antibiotic|prescript)\b/i.test(t)) return 'pill';
            if (/\b(kid|kids|child|children|son|daughter|baby|school|teacher|pediatrician|family|picnic|parent|mom|dad|grandma|grandpa|grandmother|grandfather|sister|brother|husband|wife|spouse|aunt|uncle|cousin|vacation|homework|tuition|lucas|sophia|playground|daycare|class|grade)\b/i.test(t)) return 'family';
            if (/\b(clean|cleaning|laundry|dishes|grocery|groceries|cook|cooking|bake|dinner|lunch|breakfast|kitchen|garage|repair|plumber|maintenance|bill|electricity|water|trash|recycle|chores|vacuum|mop|car)\b/i.test(t)) return 'household';
            if (/\b(dentist|workout|gym|run|doctor|haircut|salon|meeting|office|work|call|read|journal|meditate|exam|interview|checkup)\b/i.test(t)) return 'personal';
            return null;
        },
        aiParseNaturalTask(prompt = '') {
            let raw = prompt.trim();
            if (!raw) return { title: '', date: dayKey(), time: nowTime(), category: 'personal' };
            raw = raw.replace(/^(?:please\s+)?(?:remind\s+me\s+(?:to\s+)?|remember\s+to\s+|don'?t\s+forget\s+to\s+|(?:add|create|schedule|set)\s+(?:a\s+)?(?:new\s+)?(?:task|reminder|event|appointment)\s*(?:to|for|:)?\s+)/i, '').trim() || raw;

            const category = this.aiPredictCategory(raw) || 'personal';

            let time = '';
            const timeMatch = raw.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
            if (timeMatch) {
                let h = parseInt(timeMatch[1], 10);
                const m = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
                const meridian = timeMatch[3].toLowerCase();
                if (meridian === 'pm' && h < 12) h += 12;
                if (meridian === 'am' && h === 12) h = 0;
                time = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
                raw = raw.replace(timeMatch[0], ' ');
            } else {
                const milMatch = raw.match(/\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/i);
                if (milMatch) {
                    time = String(parseInt(milMatch[1], 10)).padStart(2, '0') + ':' + String(milMatch[2]).padStart(2, '0');
                    raw = raw.replace(milMatch[0], ' ');
                } else if (/\btonight\b/i.test(raw)) {
                    time = '19:00';
                    raw = raw.replace(/\btonight\b/i, ' ');
                } else if (/\bmorning\b/i.test(raw)) {
                    time = '09:00';
                    raw = raw.replace(/\b(?:in the\s+)?morning\b/i, ' ');
                } else if (/\bnoon\b/i.test(raw)) {
                    time = '12:00';
                    raw = raw.replace(/\b(?:at\s+)?noon\b/i, ' ');
                } else if (/\bafternoon\b/i.test(raw)) {
                    time = '14:00';
                    raw = raw.replace(/\b(?:in the\s+)?afternoon\b/i, ' ');
                } else if (/\bevening\b/i.test(raw)) {
                    time = '18:00';
                    raw = raw.replace(/\b(?:in the\s+)?evening\b/i, ' ');
                } else if (/\bnight\b/i.test(raw)) {
                    time = '20:00';
                    raw = raw.replace(/\b(?:at\s+)?night\b/i, ' ');
                }
            }
            if (!time) time = nowTime();

            let date = '';
            const today = new Date();
            if (/\btomorrow\b/i.test(raw)) {
                const tom = new Date(today.getTime() + 24 * 60 * 60 * 1000);
                date = dayKey(tom);
                raw = raw.replace(/\btomorrow\b/i, ' ');
            } else if (/\btoday\b/i.test(raw)) {
                date = dayKey(today);
                raw = raw.replace(/\btoday\b/i, ' ');
            } else {
                const dayMatch = raw.match(/\b(?:next|this|on)?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
                if (dayMatch) {
                    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                    const targetDay = days.indexOf(dayMatch[1].toLowerCase());
                    if (targetDay !== -1) {
                        const currentDay = today.getDay();
                        let diff = (targetDay - currentDay + 7) % 7;
                        if (diff === 0 || /\bnext\s+/i.test(dayMatch[0])) diff = diff === 0 ? 7 : diff + 7;
                        const targetDate = new Date(today.getTime() + diff * 24 * 60 * 60 * 1000);
                        date = dayKey(targetDate);
                        raw = raw.replace(dayMatch[0], ' ');
                    }
                }
            }
            if (!date) date = dayKey();

            let title = raw
                .replace(/\b(?:next|this|on|at|for|by|every)\b/gi, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            if (title.length < 2) title = prompt.trim();
            title = title.charAt(0).toUpperCase() + title.slice(1);

            return { title, date, time, category };
        },
        aiGenerateSubtasks(taskTitle = '') {
            const t = taskTitle.toLowerCase();
            if (/\b(birthday|party|celebrat|anniversary)\b/i.test(t)) {
                return "📋 Action Steps:\n[ ] Set budget, date & theme\n[ ] Choose venue or set up space\n[ ] Send invitations to family & friends\n[ ] Order cake, food & party favors\n[ ] Prepare games & music playlist";
            }
            if (/\b(school|enroll|registration|kinder|grade|tuition|class)\b/i.test(t)) {
                return "📋 Action Steps:\n[ ] Gather birth certificate & immunization records\n[ ] Fill out school enrollment forms\n[ ] Buy required uniforms, bag & shoes\n[ ] Purchase textbooks & school supplies\n[ ] Meet teacher & review school calendar";
            }
            if (/\b(clean|chores|garage|laundry|tidy|declutter|house)\b/i.test(t)) {
                return "📋 Action Steps:\n[ ] Declutter & organize misplaced items\n[ ] Dust surfaces, vents & light fixtures\n[ ] Wipe down countertops & appliances\n[ ] Sanitize bathrooms & empty trash\n[ ] Vacuum & mop all floors";
            }
            if (/\b(doctor|dentist|clinic|checkup|pediatrician|hospital|appointment|optometrist)\b/i.test(t)) {
                return "📋 Action Steps:\n[ ] Confirm appointment time & clinic location\n[ ] Prepare insurance card & medical history\n[ ] Note down symptoms or questions\n[ ] Arrive 15 minutes early for check-in\n[ ] Pick up prescription or schedule follow-up";
            }
            if (/\b(trip|vacation|travel|pack|camping|flight|hotel)\b/i.test(t)) {
                return "📋 Action Steps:\n[ ] Confirm reservations & boarding passes\n[ ] Pack clothing, toiletries & kid essentials\n[ ] Prepare travel snacks & entertainment\n[ ] Double-check IDs, chargers & keys\n[ ] Unplug appliances & lock house";
            }
            if (/\b(cook|dinner|lunch|breakfast|meal|recipe|prep|bake)\b/i.test(t)) {
                return "📋 Action Steps:\n[ ] Check pantry & list missing ingredients\n[ ] Wash, slice & season ingredients\n[ ] Cook main dish and side dishes\n[ ] Set dining table & prepare drinks\n[ ] Clean cooking area & store leftovers";
            }
            if (/\b(bill|pay|taxes|rent|electricity|water|utility|banking)\b/i.test(t)) {
                return "📋 Action Steps:\n[ ] Review statement & verify due date\n[ ] Check billing amount & account number\n[ ] Process payment online or at payment center\n[ ] Save confirmation receipt or reference code";
            }
            const clean = taskTitle.trim() || 'Task';
            return "📋 Action Steps:\n[ ] Prepare materials & review details for " + clean + "\n[ ] Complete initial setup & preparation\n[ ] Execute main steps and check off progress\n[ ] Review final result & wrap up";
        },
        _currentTipIndex: 0,
        _aiTips: [
            "Parenting Tip: 15 minutes of uninterrupted 1-on-1 time with your child drastically reduces evening stress and tantrums.",
            "Nutrition Tip: Keep a bowl of washed fruits at eye level on the kitchen counter — kids are twice as likely to choose them!",
            "Routine Tip: Prepping bags and outfits together the night before saves an average of 18 stressful morning minutes.",
            "Mindfulness Tip: When family tensions rise, try taking 3 deep breaths together to help everyone reset.",
            "Self-Care Tip: Taking 5 quiet minutes to recharge yourself makes you a more patient and present parent.",
            "Connection Tip: At dinner or bedtime, ask your child: 'What was the favorite part of your day?'",
            "Sleep Tip: Dimming screens and household lights 30 minutes before bedtime helps kids fall asleep 20 minutes faster."
        ],
        renderAIBriefing() {
            const card = byId('aiBriefingCard');
            if (!card) return;
            const hour = new Date().getHours();
            const timeGreeting = hour < 12 ? 'Good morning' : (hour < 17 ? 'Good afternoon' : 'Good evening');
            const roleOrName = this.user ? (this.user.role || this.user.name || 'there') : 'there';

            const todayKey = dayKey();
            const todayTasks = this.tasks.filter(t => t.date === todayKey && !t.done);
            const completedCount = this.tasks.filter(t => t.date === todayKey && t.done).length;
            const hasPill = todayTasks.some(t => t.category === 'pill');
            const hasCooking = todayTasks.some(t => this.aiDetectCookingDish && this.aiDetectCookingDish(t.title, t.desc));

            let message = '';
            if (todayTasks.length === 0) {
                if (completedCount > 0) {
                    message = `${timeGreeting}, ${this.escape(roleOrName)}! 🎉 Great job — all <strong>${completedCount} task${completedCount > 1 ? 's' : ''}</strong> for today are completed! Enjoy quality family time, or tap a smart routine below to get ahead.`;
                } else {
                    message = `${timeGreeting}, ${this.escape(roleOrName)}! 🌟 Your schedule is open with <strong>0 pending tasks</strong> today. Perfect time to relax with family, or tap a quick routine below to plan your day.`;
                }
            } else {
                const earliest = [...todayTasks].sort((a,b) => (a.time || '').localeCompare(b.time || ''))[0];
                const earliestStr = earliest ? ` AI recommends starting with "<strong>${this.escape(earliest.title)}</strong>" at <strong>${this.prettyTime(earliest.time)}</strong>.` : '';
                const pillNote = hasPill ? ' 💊 Don\'t forget your scheduled medication reminder.' : '';
                const cookNote = hasCooking ? ' 🍽️ Dinner ingredients are synced to your Grocery list!' : '';
                message = `${timeGreeting}, ${this.escape(roleOrName)}! ☀️ You have <strong>${todayTasks.length} task${todayTasks.length > 1 ? 's' : ''}</strong> scheduled for today.${earliestStr}${pillNote}${cookNote}`;
            }

            const textEl = byId('aiBriefingText');
            if (textEl) textEl.innerHTML = message;

            const tipEl = byId('aiBriefingTipText');
            if (tipEl) tipEl.textContent = this._aiTips[this._currentTipIndex % this._aiTips.length];
        },
        setupAIBriefing() {
            const refreshBtn = byId('aiRefreshBriefingBtn');
            if (refreshBtn && !refreshBtn.dataset.bound) {
                refreshBtn.dataset.bound = 'true';
                refreshBtn.addEventListener('click', () => {
                    this._currentTipIndex++;
                    const tipEl = byId('aiBriefingTipText');
                    const icon = refreshBtn.querySelector('i');
                    if (icon) {
                        icon.classList.add('fa-spin');
                        setTimeout(() => icon.classList.remove('fa-spin'), 600);
                    }
                    if (tipEl) tipEl.textContent = this._aiTips[this._currentTipIndex % this._aiTips.length];
                });
            }

            document.querySelectorAll('.ai-routine-chip').forEach(btn => {
                if (btn.dataset.bound) return;
                btn.dataset.bound = 'true';
                btn.addEventListener('click', () => {
                    const routine = btn.dataset.routine;
                    this.executeSmartRoutine(routine);
                });
            });
        },
        executeSmartRoutine(routine) {
            const today = dayKey();
            if (routine === 'grocery') {
                this.navigate('grocery.html');
                return;
            }

            const routines = {
                dinner: {
                    title: 'Cook Dinner: Chicken Adobo',
                    desc: 'Family dinner prep with fresh ingredients',
                    category: 'household',
                    date: today,
                    time: '18:30',
                    toast: "Added 'Cook Dinner: Chicken Adobo' — ingredients synced to Grocery! ✨"
                },
                movie: {
                    title: 'Family Movie Night',
                    desc: 'Popcorn, movie, and cozy family bonding time',
                    category: 'family',
                    date: today,
                    time: '19:30',
                    toast: "Added 'Family Movie Night' to today's schedule! 🎬"
                },
                tidy: {
                    title: '15-Min Evening Tidy-up',
                    desc: 'Quick tidy-up: toys, clothes & kitchen counter',
                    category: 'household',
                    date: today,
                    time: '20:00',
                    toast: "Added '15-Min Evening Tidy-up' to today's schedule! 🧹"
                },
                story: {
                    title: 'Bedtime Story & Reading',
                    desc: 'Read favorite storybooks together before bed',
                    category: 'family',
                    date: today,
                    time: '20:30',
                    toast: "Added 'Bedtime Story & Reading' to today's schedule! 📖"
                }
            };

            const target = routines[routine];
            if (!target) return;

            const exists = this.tasks.some(t => t.date === today && t.title.toLowerCase() === target.title.toLowerCase() && !t.done);
            if (exists) {
                this.showToast(`"${target.title}" is already scheduled for today!`);
                return;
            }

            store.saveTask({
                title: target.title,
                description: target.desc,
                category: target.category,
                date: target.date,
                time: target.time
            });

            if (routine === 'dinner' && this.aiDetectCookingDish) {
                const dish = this.aiDetectCookingDish(target.title, target.desc);
                if (dish) {
                    this.aiAddRecipeIngredients(dish, 'routine');
                }
            }

            this.refreshViews();
            this.showToast(target.toast || `Task scheduled for today at ${this.prettyTime(target.time)}!`);
        },
        calendarMarkup(date) {
            const year=date.getFullYear(),month=date.getMonth(),first=new Date(year,month,1).getDay();
            let html='';
            for(let row=0;row<6;row++){
                const firstDayOfRow=new Date(year,month,row*7-first+1);
                if(row>=5&&firstDayOfRow.getMonth()!==month)break;
                html+='<tr>';
                for(let col=0;col<7;col++){
                    const day=new Date(year,month,row*7+col-first+1),key=dayKey(day);
                    const has=this.tasks.some(task=>task.date===key&&!task.done);
                    html+='<td><button type="button" class="cal-day-cell'+(day.getMonth()!==month?' other-month':'')+(key===dayKey()?' today-green':'')+(key===this.selectedCalendarDate?' selected':'')+(has?' has-event':'')+'" data-action="calendar-select" data-date="'+key+'" aria-label="'+this.prettyDay(key)+'" aria-pressed="'+(key===this.selectedCalendarDate)+'">'+day.getDate()+'</button></td>';
                }
                html+='</tr>';
            }
            return html;
        },
        renderCalendarMonth() {
            if(byId('calendarDaysGrid'))byId('calendarDaysGrid').innerHTML=this.calendarMarkup(this.calendarMonth);
            if(byId('calendarMonthLabel'))byId('calendarMonthLabel').textContent=this.calendarMonth.toLocaleDateString('en-US',{month:'long',year:'numeric'});
            if(byId('fullCalendarMonths'))this.renderFullCalendar();
        },
        renderFullCalendar() {
            const container=byId('fullCalendarMonths');if(!container)return;
            container.innerHTML=Array.from({length:12},(_,i)=>{
                const date=new Date(this.calendarMonth.getFullYear(),this.calendarMonth.getMonth()+i,1);
                return '<section class="calendar-month-card"><h3>'+date.toLocaleDateString('en-US',{month:'long',year:'numeric'})+'</h3><table class="calendar-table"><thead><tr>'+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day=>'<th>'+day+'</th>').join('')+'</tr></thead><tbody>'+this.calendarMarkup(date)+'</tbody></table></section>';
            }).join('');
        },
        selectCalendarDay(date) { if(!validation.isValidDate(date))return;this.selectedCalendarDate=date;if(byId('fullCalendarSection')?.style.display!=='block')this.calendarMonth=new Date(date+'T12:00:00');this.renderCalendarMonth();this.renderSelectedDateEvents();this.renderAICalendarInsights(); },
        renderSelectedDateEvents() {
            const tasks=sorted(this.tasks.filter(task=>task.date===this.selectedCalendarDate));
            for(const id of ['calendarSelectedDateTitle','fullCalendarSelectedDateTitle'])if(byId(id))byId(id).textContent='Tasks for '+this.prettyDay(this.selectedCalendarDate);
            for(const id of ['calendarTasksForDayList','fullCalendarTasksForDayList'])if(byId(id))byId(id).innerHTML=tasks.length?tasks.map(task=>this.taskMarkup(task)).join(''):'<div class="empty-strip-card">No tasks or reminders for this date.</div>';
            const groups={};sorted(this.tasks.filter(task=>!task.done&&task.date>=dayKey())).forEach(task=>(groups[task.date]||=[]).push(task));
            const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);
            if(byId('calendarUpcomingEventsList'))byId('calendarUpcomingEventsList').innerHTML=Object.entries(groups).map(([date,items])=>'<section class="calendar-event-group"><h3>'+ (date===dayKey()?'Today':date===dayKey(tomorrow)?'Tomorrow':this.prettyDay(date))+'</h3>'+items.map(task=>this.taskMarkup(task)).join('')+'</section>').join('')||'<div class="empty-strip-card">No upcoming events.</div>';
        },
        _currentCalendarTipIndex: 0,
        _aiCalendarTips: [
            "Time Tip: Group errands geographically — batching grocery and pharmacy trips saves up to 45 minutes on weekends.",
            "Family Tip: Protect one evening per week as 'Zero-Schedule Night' for unstructured family downtime.",
            "Buffer Tip: Add 15-minute buffer windows between children's appointments to avoid rushing.",
            "Energy Tip: Schedule demanding chores during your peak energy hours (morning for 70% of parents).",
            "Overload Warning: Spreading major cleaning and shopping across weekdays keeps weekends free for family fun.",
            "Parenting Tip: Involve kids in planning one weekend activity — it builds independence and excitement."
        ],
        renderAICalendarInsights() {
            const card = byId('aiCalendarCard');
            if (!card) return;

            const year = this.calendarMonth.getFullYear();
            const monthStr = String(this.calendarMonth.getMonth() + 1).padStart(2, '0');
            const monthPrefix = `${year}-${monthStr}`;

            const monthTasks = this.tasks.filter(t => t.date && t.date.startsWith(monthPrefix));
            const monthCountEl = byId('aiMonthEventsCount');
            if (monthCountEl) monthCountEl.textContent = monthTasks.length;

            const dateMap = {};
            this.tasks.forEach(t => {
                if (!dateMap[t.date]) dateMap[t.date] = [];
                dateMap[t.date].push(t);
            });

            let busiestDate = null;
            let maxCount = 0;
            for (const [date, list] of Object.entries(dateMap)) {
                if (date.startsWith(monthPrefix) && list.length > maxCount) {
                    maxCount = list.length;
                    busiestDate = date;
                }
            }

            const busiestEl = byId('aiBusiestDayLabel');
            const busiestSub = byId('aiBusiestDaySub');
            if (busiestEl) {
                if (busiestDate && maxCount > 0) {
                    const shortDate = new Date(busiestDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    busiestEl.textContent = shortDate;
                    if (busiestSub) busiestSub.textContent = `Busiest (${maxCount} tasks)`;
                } else {
                    busiestEl.textContent = 'None';
                    if (busiestSub) busiestSub.textContent = 'Busiest Day';
                }
            }

            const selectedCount = (dateMap[this.selectedCalendarDate] || []).length;
            const selectedPill = byId('aiSelectedDayPill');
            const selectedSub = byId('aiSelectedDaySub');
            if (selectedPill) {
                if (selectedCount === 0) {
                    selectedPill.textContent = '0';
                    if (selectedSub) selectedSub.textContent = 'Selected: Free';
                } else if (selectedCount <= 2) {
                    selectedPill.textContent = selectedCount;
                    if (selectedSub) selectedSub.textContent = 'Selected: Light';
                } else if (selectedCount === 3) {
                    selectedPill.textContent = selectedCount;
                    if (selectedSub) selectedSub.textContent = 'Selected: Med';
                } else {
                    selectedPill.textContent = selectedCount;
                    if (selectedSub) selectedSub.textContent = 'Selected: Heavy';
                }
            }

            let conflictInfo = null;
            for (const [date, list] of Object.entries(dateMap)) {
                const timeMap = {};
                for (const t of list) {
                    if (t.time && !t.done) {
                        if (timeMap[t.time]) {
                            conflictInfo = { date, time: t.time, task1: timeMap[t.time].title, task2: t.title };
                            break;
                        }
                        timeMap[t.time] = t;
                    }
                }
                if (conflictInfo) break;
            }

            const badgeEl = byId('aiCalendarHealthBadge');
            const adviceBox = byId('aiCalendarAdviceBox');
            const adviceText = byId('aiCalendarAdviceText');
            const adviceIcon = byId('aiCalendarAdviceIcon');

            if (adviceBox) adviceBox.className = 'ai-calendar-advice-box';
            if (badgeEl) badgeEl.className = 'ai-calendar-health-badge';

            if (conflictInfo) {
                if (badgeEl) {
                    badgeEl.classList.add('conflict');
                    badgeEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Time Conflict';
                }
                if (adviceBox) adviceBox.classList.add('conflict');
                if (adviceIcon) adviceIcon.className = 'fa-solid fa-triangle-exclamation';
                if (adviceText) adviceText.innerHTML = `<strong>Schedule Clash on ${this.prettyDay(conflictInfo.date)}:</strong> "${this.escape(conflictInfo.task1)}" and "${this.escape(conflictInfo.task2)}" are set for ${this.prettyTime(conflictInfo.time)}. Consider moving one!`;
            } else if (maxCount >= 4) {
                if (badgeEl) {
                    badgeEl.classList.add('warning');
                    badgeEl.innerHTML = '<i class="fa-solid fa-fire-flame-curved"></i> Busy Day Alert';
                }
                if (adviceBox) adviceBox.classList.add('warning');
                if (adviceIcon) adviceIcon.className = 'fa-solid fa-fire-flame-curved';
                if (adviceText) adviceText.innerHTML = `<strong>Heavy Load on ${this.prettyDay(busiestDate)}:</strong> You have ${maxCount} commitments scheduled. Spreading chores across the week helps avoid parental burnout!`;
            } else {
                if (badgeEl) {
                    badgeEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> Balanced Schedule';
                }
                if (adviceIcon) adviceIcon.className = 'fa-solid fa-circle-check';
                if (adviceText) adviceText.innerHTML = `<strong>Balanced Schedule!</strong> Your family commitments are evenly paced this month. Tap <em>Plan Weekend</em> below for quality family time!`;
            }
        },
        getUpcomingWeekend() {
            const now = new Date();
            const day = now.getDay();
            let daysToSat = 6 - day;
            if (daysToSat < 0) daysToSat += 7;
            if (daysToSat === 0 && now.getHours() >= 18) daysToSat = 7;

            const sat = new Date(now);
            sat.setDate(now.getDate() + daysToSat);
            const sun = new Date(sat);
            sun.setDate(sat.getDate() + 1);

            return {
                satKey: dayKey(sat),
                sunKey: dayKey(sun),
                satLabel: sat.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                sunLabel: sun.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
            };
        },
        openWeekendPlannerModal() {
            const modal = byId('aiWeekendModal');
            if (!modal) return;

            const weekend = this.getUpcomingWeekend();
            const subhead = byId('aiWeekendDatesSubhead');
            if (subhead) subhead.textContent = `Upcoming Weekend: ${weekend.satLabel} & ${weekend.sunLabel}`;

            const plans = [
                {
                    key: 'nature',
                    title: '🏞️ Outdoor Nature & Park Adventure',
                    desc: 'Fresh air, physical activity, and relaxed bonding in the sunshine.',
                    events: [
                        { day: 'sat', time: '09:30', title: 'Morning Family Park Picnic & Games', desc: 'Pack snacks, frisbee & outdoor games' },
                        { day: 'sat', time: '16:30', title: 'Sunset Bike Ride & Nature Walk', desc: 'Bikes, scooters and nature exploration' },
                        { day: 'sun', time: '10:00', title: 'Backyard Scavenger Hunt & Bubble Play', desc: 'Fun interactive games with kids' },
                        { day: 'sun', time: '18:00', title: 'Sunday Family Dinner & Ice Cream Treat', desc: 'Wrap up the weekend with favorite treats' }
                    ]
                },
                {
                    key: 'creative',
                    title: '🎨 Cozy Home Baking & Movie (Budget-Friendly)',
                    desc: 'Creative home cooking, cozy blanket forts, and family board games.',
                    events: [
                        { day: 'sat', time: '10:00', title: 'Cook Dinner: Homemade Pizza Baking', desc: 'Make personal pizzas with favorite toppings' },
                        { day: 'sat', time: '14:30', title: 'Family Board Game & Puzzle Tournament', desc: 'Board games, card games & laughter' },
                        { day: 'sun', time: '10:30', title: 'Living Room Blanket Fort & Reading Hour', desc: 'Build cozy pillow fort and read stories' },
                        { day: 'sun', time: '17:00', title: 'Family Movie Night & Popcorn', desc: 'Watch family movie together with snacks' }
                    ]
                },
                {
                    key: 'discovery',
                    title: '🏛️ Discovery, Science & Library Day',
                    desc: 'Curiosity-sparking museum visits, books, and creative arts.',
                    events: [
                        { day: 'sat', time: '10:00', title: 'Local Library Story Hour & Book Picking', desc: 'Borrow new books for bedtime reading' },
                        { day: 'sat', time: '15:00', title: 'Hands-on Science Crafts & Building', desc: 'Simple home science experiments' },
                        { day: 'sun', time: '11:00', title: 'Family Watercolor & Art Painting', desc: 'Creative arts & painting together' },
                        { day: 'sun', time: '17:30', title: 'Week-Ahead School Prep & Uniforms', desc: 'Pack backpacks & review weekly calendar' }
                    ]
                }
            ];

            const listEl = byId('aiWeekendPlansList');
            if (listEl) {
                listEl.innerHTML = plans.map((plan, index) => {
                    const satEvents = plan.events.filter(e => e.day === 'sat');
                    const sunEvents = plan.events.filter(e => e.day === 'sun');
                    return `
                    <div class="ai-weekend-plan-card">
                        <div class="ai-weekend-plan-header">
                            <div>
                                <div class="ai-weekend-plan-title">${plan.title}</div>
                                <div class="ai-weekend-plan-desc">${plan.desc}</div>
                            </div>
                            <button type="button" class="btn-schedule-weekend-plan" data-plan-index="${index}">
                                <i class="fa-solid fa-calendar-plus"></i> Schedule
                            </button>
                        </div>
                        <div class="ai-weekend-timeline">
                            <div class="ai-weekend-day-col">
                                <span class="ai-weekend-day-title">${weekend.satLabel}</span>
                                ${satEvents.map(e => `<div class="ai-weekend-event-line"><span class="time">${this.prettyTime(e.time)}</span> ${this.escape(e.title)}</div>`).join('')}
                            </div>
                            <div class="ai-weekend-day-col">
                                <span class="ai-weekend-day-title">${weekend.sunLabel}</span>
                                ${sunEvents.map(e => `<div class="ai-weekend-event-line"><span class="time">${this.prettyTime(e.time)}</span> ${this.escape(e.title)}</div>`).join('')}
                            </div>
                        </div>
                    </div>`;
                }).join('');

                listEl.querySelectorAll('.btn-schedule-weekend-plan').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const index = Number(btn.dataset.planIndex);
                        const selectedPlan = plans[index];
                        if (!selectedPlan) return;
                        this.scheduleWeekendPlan(selectedPlan, weekend);
                    });
                });
            }

            modal.classList.add('active');
        },
        scheduleWeekendPlan(plan, weekend) {
            plan.events.forEach(event => {
                const dateKey = event.day === 'sat' ? weekend.satKey : weekend.sunKey;
                store.saveTask({
                    title: event.title,
                    description: event.desc,
                    category: 'family',
                    date: dateKey,
                    time: event.time
                });

                if (this.aiDetectCookingDish) {
                    const dish = this.aiDetectCookingDish(event.title, event.desc);
                    if (dish) this.aiAddRecipeIngredients(dish, 'weekend-plan');
                }
            });

            this.refreshViews();
            byId('aiWeekendModal')?.classList.remove('active');
            this.showToast(`🎉 Scheduled "${plan.title}" for this weekend!`);
        },
        setupAICalendar() {
            const planBtn = byId('aiPlanWeekendBtn');
            if (planBtn && !planBtn.dataset.bound) {
                planBtn.dataset.bound = 'true';
                planBtn.addEventListener('click', () => this.openWeekendPlannerModal());
            }

            const tipBtn = byId('aiCalendarTipBtn');
            if (tipBtn && !tipBtn.dataset.bound) {
                tipBtn.dataset.bound = 'true';
                tipBtn.addEventListener('click', () => {
                    this._currentCalendarTipIndex++;
                    const icon = tipBtn.querySelector('i');
                    if (icon) {
                        icon.classList.add('fa-spin');
                        setTimeout(() => icon.classList.remove('fa-spin'), 600);
                    }
                    const adviceIcon = byId('aiCalendarAdviceIcon');
                    if (adviceIcon) adviceIcon.className = 'fa-solid fa-lightbulb';
                    const adviceText = byId('aiCalendarAdviceText');
                    if (adviceText) {
                        adviceText.innerHTML = `<strong>Parent Time Tip:</strong> ${this._aiCalendarTips[this._currentCalendarTipIndex % this._aiCalendarTips.length]}`;
                    }
                });
            }

            document.querySelectorAll('.ai-calendar-idea-chip').forEach(chip => {
                if (chip.dataset.bound) return;
                chip.dataset.bound = 'true';
                chip.addEventListener('click', () => {
                    const idea = chip.dataset.idea;
                    const date = this.selectedCalendarDate || dayKey();
                    const ideas = {
                        park: { title: 'Afternoon Family Park Walk', time: '16:30', category: 'family', desc: 'Fresh air & outdoor playground fun' },
                        study: { title: 'Homework & Quiet Study Hour', time: '17:00', category: 'family', desc: 'Focus time for school reading and homework' },
                        'family-dinner': { title: 'Family Dinner Date', time: '18:30', category: 'family', desc: 'Quality family meal and catch-up' },
                        chores: { title: 'Quick 30-Minute Family Chores', time: '10:00', category: 'household', desc: 'Team tidy-up before fun activities' }
                    };
                    const item = ideas[idea];
                    if (!item) return;

                    store.saveTask({
                        title: item.title,
                        description: item.desc,
                        category: item.category,
                        date,
                        time: item.time
                    });

                    this.refreshViews();
                    this.showToast(`Added "${item.title}" on ${this.prettyDay(date)}! ✨`);
                });
            });
        },
        _currentPillTipIndex: 0,
        _aiPillTips: [
            "Safety Tip: Always measure children's liquid medicine with a calibrated oral syringe or dropper, never a household kitchen spoon!",
            "Dosage Tip: For children's medication, doses should be calculated by the child's exact weight, not age alone.",
            "Storage Tip: Store antibiotics and probiotics in the refrigerator if indicated, away from heat and direct sunlight.",
            "Hydration Tip: Ensure kids drink a full cup of water when taking tablets or capsules to ensure proper digestion.",
            "Refill Tip: Restock long-term prescriptions at least 3-5 days before the bottle runs out so you never miss a dose.",
            "Safety Alert: Never refer to medicine as 'candy' to convince kids to take it — this prevents accidental ingestion."
        ],
        setupPillForm() {
            const form = byId('addPillForm');
            if (!form || form.dataset.bound) return;
            form.noValidate = true;
            form.dataset.bound = 'true';
            form.addEventListener('submit', event => {
                event.preventDefault();
                this.submitForm(form, () => {
                    const title = byId('pillNameInput').value;
                    const description = byId('pillDosageInput').value;
                    const date = byId('pillDateInput').value;
                    const time = byId('pillTimeInput').value;
                    const syncRefill = byId('pillRefillSyncCheck')?.checked;

                    store.saveTask({
                        title,
                        description,
                        category: 'pill',
                        date,
                        time
                    });

                    if (syncRefill) {
                        try {
                            store.addGrocery(title + ' (Refill)', 1);
                        } catch (_) {}
                    }

                    form.reset();
                    byId('addPillModal').classList.remove('active');
                    this.refreshViews();
                    this.showToast(syncRefill ? 'Reminder saved & added to Grocery refill! 💊🛒' : 'Reminder saved.');
                }, { title: 'pillNameInput', description: 'pillDosageInput', date: 'pillDateInput', time: 'pillTimeInput' });
            });

            // AI Pill Prompt Quick Optimizer
            const aiBtn = byId('aiPillQuickFillBtn');
            const aiInput = byId('aiPillPromptInput');
            if (aiBtn && !aiBtn.dataset.bound) {
                aiBtn.dataset.bound = 'true';
                aiBtn.addEventListener('click', () => {
                    const prompt = aiInput?.value?.trim() || '';
                    if (!prompt) return;
                    this.aiOptimizePillSchedule(prompt);
                });
            }
            if (aiInput && !aiInput.dataset.bound) {
                aiInput.dataset.bound = 'true';
                aiInput.addEventListener('keydown', e => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        aiBtn?.click();
                    }
                });
            }

            // Common Medication Preset Chips on pills.html
            document.querySelectorAll('.ai-pill-preset-chip').forEach(chip => {
                if (chip.dataset.bound) return;
                chip.dataset.bound = 'true';
                chip.addEventListener('click', () => {
                    const preset = chip.dataset.preset;
                    this.applyPillPreset(preset);
                });
            });

            // Safety Tip Refresh
            const tipBtn = byId('aiPillSafetyTipBtn');
            if (tipBtn && !tipBtn.dataset.bound) {
                tipBtn.dataset.bound = 'true';
                tipBtn.addEventListener('click', () => {
                    this._currentPillTipIndex++;
                    const icon = tipBtn.querySelector('i');
                    if (icon) {
                        icon.classList.add('fa-spin');
                        setTimeout(() => icon.classList.remove('fa-spin'), 600);
                    }
                    const tipEl = byId('aiPillTipText');
                    if (tipEl) tipEl.textContent = this._aiPillTips[this._currentPillTipIndex % this._aiPillTips.length];
                });
            }
        },
        openPillModal() {
            if (byId('pillDateInput')) byId('pillDateInput').value = dayKey();
            if (byId('pillTimeInput')) byId('pillTimeInput').value = nowTime();
            if (byId('aiPillPromptInput')) byId('aiPillPromptInput').value = '';
            if (byId('aiPillScheduleSuggestions')) byId('aiPillScheduleSuggestions').hidden = true;
            byId('addPillModal')?.classList.add('active');
        },
        aiParsePillCommand(prompt = '') {
            const raw = prompt.trim()
                .replace(/^(?:please\s+)?(?:remind\s+me\s+to\s+take\s+|(?:add|schedule|set)\s+(?:a\s+)?(?:pill|medicine|medication|dose|vitamin)\s*(?:reminder\s*)?(?:to|for|:)?\s+)/i, '')
                .trim();
            if (!raw) return null;

            let suggestedTimes = ['09:00'];
            let scheduleLabel = 'Once daily';

            if (/\b(?:3x|three times|3 times|tid|every 8 hours|q8h)\b/i.test(raw)) {
                suggestedTimes = ['08:00', '13:00', '19:00'];
                scheduleLabel = '3x Daily (Breakfast, Lunch, Dinner)';
            } else if (/\b(?:2x|twice|2 times|bid|every 12 hours|q12h|morning and evening|morning & evening)\b/i.test(raw)) {
                suggestedTimes = ['08:00', '20:00'];
                scheduleLabel = 'Twice Daily (Morning & Evening)';
            } else if (/\b(?:4x|four times|4 times|qid|every 6 hours|q6h)\b/i.test(raw)) {
                suggestedTimes = ['06:00', '12:00', '18:00', '00:00'];
                scheduleLabel = '4x Daily (Every 6 hours)';
            } else if (/\b(?:night|bedtime|before sleep|evening|pm)\b/i.test(raw)) {
                suggestedTimes = ['20:30'];
                scheduleLabel = 'Evening / Bedtime';
            } else if (/\b(?:morning|breakfast|am)\b/i.test(raw)) {
                suggestedTimes = ['08:00'];
                scheduleLabel = 'Morning (with breakfast)';
            }

            let dose = '';
            const doseMatch = raw.match(/\b(\d+(?:\.\d+)?\s*(?:mg|mcg|ml|g|tablets?|capsules?|drops?|pills?|teaspoons?|puffs?))\b/i);
            if (doseMatch) dose = doseMatch[1];

            const foodMatch = raw.match(/\b((?:before|after|with)\s+(?:meals?|food|breakfast|lunch|dinner|eating))\b/i);
            if (foodMatch) {
                dose = dose ? `${dose} (${foodMatch[1]})` : foodMatch[1];
            } else if (!dose) {
                dose = '1 dose';
            }

            let name = raw
                .replace(/\b(?:3x|2x|4x|three times|twice|four times|daily|every day|every \d+ hours|after meals|before meals|with food|morning and evening|morning & evening|morning|evening|bedtime|night)\b/gi, '')
                .replace(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|ml|g|tablets?|capsules?|drops?|pills?)\b/gi, '')
                .replace(/\s+/g, ' ')
                .trim();

            if (!name) name = raw;
            name = name.charAt(0).toUpperCase() + name.slice(1);
            return { name, dose, suggestedTimes, scheduleLabel };
        },
        aiOptimizePillSchedule(prompt = '') {
            const parsed = this.aiParsePillCommand(prompt);
            if (!parsed) return;
            const { name, dose, suggestedTimes, scheduleLabel } = parsed;

            if (byId('pillNameInput')) byId('pillNameInput').value = name;
            if (byId('pillDosageInput')) byId('pillDosageInput').value = dose;
            if (byId('pillTimeInput') && suggestedTimes.length > 0) byId('pillTimeInput').value = suggestedTimes[0];

            const suggestionsEl = byId('aiPillScheduleSuggestions');
            if (suggestionsEl) {
                if (suggestedTimes.length > 1) {
                    suggestionsEl.hidden = false;
                    suggestionsEl.innerHTML = `<span class="ai-pill-sched-title"><i class="fa-solid fa-clock"></i> ${scheduleLabel} suggested times:</span>` +
                        suggestedTimes.map(t => `<button type="button" class="ai-pill-time-chip" data-time="${t}"><i class="fa-regular fa-clock"></i> ${this.prettyTime(t)}</button>`).join('') +
                        `<button type="button" class="btn-ai-schedule-all" id="btnAiScheduleAllDoses"><i class="fa-solid fa-layer-group"></i> Schedule All ${suggestedTimes.length} Doses</button>`;

                    suggestionsEl.querySelectorAll('.ai-pill-time-chip').forEach(btn => {
                        btn.addEventListener('click', () => {
                            if (byId('pillTimeInput')) byId('pillTimeInput').value = btn.dataset.time;
                            this.showToast(`Set reminder time to ${this.prettyTime(btn.dataset.time)}`);
                        });
                    });

                    const scheduleAllBtn = byId('btnAiScheduleAllDoses');
                    if (scheduleAllBtn) {
                        scheduleAllBtn.addEventListener('click', () => {
                            const today = dayKey();
                            suggestedTimes.forEach((t, i) => {
                                store.saveTask({
                                    title: name + (suggestedTimes.length > 1 ? ` (Dose ${i+1})` : ''),
                                    description: dose,
                                    category: 'pill',
                                    date: today,
                                    time: t
                                });
                            });
                            this.refreshViews();
                            byId('addPillModal')?.classList.remove('active');
                            this.showToast(`✨ AI scheduled all ${suggestedTimes.length} doses for ${name}!`);
                        });
                    }
                } else {
                    suggestionsEl.hidden = true;
                }
            }

            this.showToast(`✨ AI Optimized: ${name} (${dose}) at ${this.prettyTime(suggestedTimes[0])}`);
        },
        applyPillPreset(preset) {
            const presets = {
                multivitamin: { name: 'Kids Daily Multivitamins', dose: '1 chewable tablet (with breakfast)', time: '08:00' },
                vitaminc: { name: 'Vitamin C Gummies', dose: '500 mg (morning)', time: '08:30' },
                paracetamol: { name: 'Paracetamol Drops / Syrup', dose: '120mg / 5ml (as needed for fever)', time: '12:00' },
                probiotic: { name: 'Family Daily Probiotics', dose: '1 sachet / capsule', time: '09:00' },
                calcium: { name: 'Calcium + Vitamin D3', dose: '500 mg (evening with meal)', time: '19:30' }
            };
            const p = presets[preset];
            if (!p) return;
            this.openPillModal();
            if (byId('pillNameInput')) byId('pillNameInput').value = p.name;
            if (byId('pillDosageInput')) byId('pillDosageInput').value = p.dose;
            if (byId('pillTimeInput')) byId('pillTimeInput').value = p.time;
            if (byId('pillDateInput')) byId('pillDateInput').value = dayKey();
            this.showToast(`Selected preset: ${p.name}`);
        },
        refillPillToGrocery(rawTitle = '') {
            const cleanTitle = (rawTitle || 'Medication').replace(/\s*\(Dose\s*\d+\)/i, '').trim();
            const groceryName = cleanTitle + ' (Refill)';
            try {
                store.addGrocery(groceryName, 1);
                this.refreshViews();
                this.showToast(`🛒 Added "${cleanTitle}" to your Grocery list for refill!`);
            } catch (e) {
                this.showToast(e.message || 'Could not add to grocery list.');
            }
        },
        renderAIPillsOverview() {
            const cabinet = byId('aiCabinetCard');
            if (!cabinet) return;

            const activePills = this.pills.filter(p => !p.done);
            const countEl = byId('aiActivePillsCount');
            if (countEl) countEl.textContent = activePills.length;

            const nextTimeEl = byId('aiNextDoseTime');
            if (nextTimeEl) {
                const today = dayKey();
                const todayPills = activePills.filter(p => p.date === today);
                if (todayPills.length > 0) {
                    const next = [...todayPills].sort((a,b) => (a.time || '').localeCompare(b.time || ''))[0];
                    nextTimeEl.textContent = this.prettyTime(next.time);
                } else {
                    nextTimeEl.textContent = 'None Today';
                }
            }

            const tipEl = byId('aiPillTipText');
            if (tipEl) tipEl.textContent = this._aiPillTips[this._currentPillTipIndex % this._aiPillTips.length];
        },
        renderPillsList() { if(byId('pillsListContainer'))byId('pillsListContainer').innerHTML=this.pills.length?sorted(this.pills).map(task=>this.taskMarkup(task)).join(''):'<div class="empty-strip-card">No pill reminders scheduled.</div>'; },
        togglePill(id) { this.toggleTask(id); }, deletePill(id) { this.deleteTask(id); },
        renderRemindersPopup() { if(byId('remindersPopupBody')){const tasks=sorted(this.tasks.filter(task=>!task.done&&task.date>=dayKey()));byId('remindersPopupBody').innerHTML=tasks.length?tasks.map(task=>this.taskMarkup(task)).join(''):'No upcoming tasks or reminders.';} },
        aiParseGroceryCommand(prompt = '') {
            const raw = prompt.trim();
            if (!raw) return null;

            const hasExplicitTarget = /\b(?:to|on|in)\s+(?:my\s+|the\s+)?(?:grocer(?:y|ies)|shopping)(?:\s+list)?\s*$/i.test(raw) || /^(?:grocery|groceries|shopping(?:\s+list)?)\s*:/i.test(raw);
            const hasBuyVerb = /^(?:please\s+)?(?:add|put|buy|get|restock|need(?:\s+to\s+buy)?)\s+/i.test(raw);
            const hasScheduleCue = /\b(?:at\s+\d|am\b|pm\b|tomorrow\b|monday|tuesday|wednesday|thursday|friday|saturday|sunday|appointment|dentist|doctor|meeting|call\b)\b/i.test(raw);

            if (!hasExplicitTarget && (!hasBuyVerb || hasScheduleCue || /\b(?:task|reminder|pill|medicine)\b/i.test(raw))) {
                return null;
            }
            if (!hasExplicitTarget && /^(?:add|put)\s+/i.test(raw)) {
                // Plain "add ..." without grocery/shopping/buy needs a buy verb unless multiple food items or ends in grocery
                return null;
            }

            let cleaned = raw
                .replace(/^(?:please\s+)?(?:grocery|groceries|shopping(?:\s+list)?)\s*:\s*/i, '')
                .replace(/^(?:please\s+)?(?:add|put|buy|get|restock|need(?:\s+to\s+buy)?)\s+/i, '')
                .replace(/\s+(?:to|on|in)\s+(?:my\s+|the\s+)?(?:grocer(?:y|ies)|shopping)(?:\s+list)?\s*$/i, '')
                .trim();

            if (!cleaned) return null;

            const parts = cleaned
                .split(/\s*(?:,|\band\b|&)\s*/i)
                .map(s => s.trim())
                .filter(Boolean);

            const items = [];
            for (const part of parts) {
                const qtyMatch = part.match(/^(\d+)\s*(?:x|pcs?|packs?|bottles?|boxes?|bags?)?\s+(.+)$/i);
                let quantity = 1;
                let itemName = part;
                if (qtyMatch) {
                    quantity = Math.max(1, Math.min(validation.GROCERY_QTY_MAX || 999, parseInt(qtyMatch[1], 10) || 1));
                    itemName = qtyMatch[2].trim();
                }
                if (itemName.length >= 1) {
                    const formatted = itemName.charAt(0).toUpperCase() + itemName.slice(1);
                    items.push({ name: formatted, quantity });
                }
            }
            return items.length ? items : null;
        },
        aiAnswerCopilotQuestion(prompt = '') {
            const q = prompt.trim().toLowerCase();
            if (!q) return null;

            const isQuestionLike = /^(?:what|which|show|list|check|do i|am i|how|when|any)\b/i.test(q) || q.includes('?');
            if (!isQuestionLike && !/\b(?:my\s+(?:tasks|groceries|grocery\s+list|pills|medications|schedule)|conflicts?)\b/i.test(q)) {
                return null;
            }

            if (/\b(conflict|clash|busy|overload|burnout|free)\b/i.test(q)) {
                const dateMap = {};
                this.tasks.filter(t => !t.done).forEach(t => { (dateMap[t.date] ||= []).push(t); });
                const clashes = [];
                for (const [date, list] of Object.entries(dateMap)) {
                    const seen = {};
                    for (const t of list) {
                        if (t.time && seen[t.time]) clashes.push({ date, time: t.time, a: seen[t.time].title, b: t.title });
                        else if (t.time) seen[t.time] = t;
                    }
                }
                const heavyDays = Object.entries(dateMap).filter(([, list]) => list.length >= 4);
                if (clashes.length) {
                    return {
                        title: `Found ${clashes.length} schedule conflict${clashes.length > 1 ? 's' : ''}`,
                        summary: `Clash on ${this.prettyDay(clashes[0].date)} at ${this.prettyTime(clashes[0].time)}: "${clashes[0].a}" & "${clashes[0].b}".`,
                        page: 'calendar.html',
                        query: 'date=' + clashes[0].date,
                        items: clashes.slice(0, 3).map(c => ({ title: `${c.a} vs ${c.b}`, meta: `${this.prettyDay(c.date)} • ${this.prettyTime(c.time)}`, page: 'calendar.html', query: 'date=' + c.date, icon: 'fa-solid fa-triangle-exclamation' }))
                    };
                }
                if (heavyDays.length) {
                    const [d, list] = heavyDays[0];
                    return {
                        title: 'Heavy workload detected',
                        summary: `${this.prettyDay(d)} has ${list.length} active commitments. Consider spreading chores out.`,
                        page: 'calendar.html',
                        query: 'date=' + d,
                        items: list.slice(0, 4).map(t => ({ title: t.title, meta: this.prettyTime(t.time), page: 'calendar.html', query: 'date=' + d, icon: 'fa-regular fa-calendar' }))
                    };
                }
                return {
                    title: 'Schedule looks balanced!',
                    summary: 'No overlapping time conflicts or overloaded days detected right now.',
                    page: 'calendar.html',
                    items: []
                };
            }

            if (/\b(grocer(?:y|ies)|shopping|need to buy)\b/i.test(q)) {
                const list = this.groceries || [];
                return {
                    title: list.length ? `${list.length} item${list.length > 1 ? 's' : ''} on your Grocery List` : 'Your Grocery List is empty',
                    summary: list.length ? 'Showing your active shopping items below:' : 'Type "Add milk and eggs to grocery" to populate it quickly.',
                    page: 'grocery.html',
                    items: list.slice(0, 5).map(g => ({ title: g.name, meta: `Qty: ${g.quantity || 1}`, page: 'grocery.html', icon: 'fa-solid fa-cart-shopping' }))
                };
            }

            if (/\b(pill|pills|medicine|medications|dose|doses)\b/i.test(q)) {
                const activePills = sorted(this.pills.filter(p => !p.done));
                return {
                    title: activePills.length ? `${activePills.length} upcoming medication reminder${activePills.length > 1 ? 's' : ''}` : 'No pending pill reminders',
                    summary: activePills.length ? 'Next doses scheduled for your family:' : 'Type e.g. "Amoxicillin 500mg 3x daily" to schedule reminders.',
                    page: 'pills.html',
                    items: activePills.slice(0, 5).map(p => ({ title: p.title, meta: `${this.prettyDay(p.date)} • ${this.prettyTime(p.time)}`, page: 'calendar.html', query: 'date=' + p.date, icon: 'fa-solid fa-capsules' }))
                };
            }

            if (/\b(tasks?|schedule|events?|plans?|reminders?|today|tomorrow)\b/i.test(q)) {
                const isTomorrow = /\btomorrow\b/i.test(q);
                const isToday = /\btoday\b/i.test(q);
                const targetDate = isTomorrow ? dayKey(new Date(Date.now() + 86400000)) : dayKey();
                const matches = sorted(this.tasks.filter(t => !t.done && (isTomorrow || isToday ? t.date === targetDate : t.date >= dayKey())));
                const dayLabel = isTomorrow ? 'tomorrow' : isToday ? 'today' : 'upcoming';
                return {
                    title: matches.length ? `${matches.length} ${dayLabel} task${matches.length > 1 ? 's' : ''}` : `No pending tasks for ${dayLabel}`,
                    summary: matches.length ? `Here is your ${dayLabel} overview:` : `Your ${dayLabel} schedule is clear! Type a command like "Call grandma at 4pm" to add one.`,
                    page: isTomorrow || isToday ? 'calendar.html' : 'tasks.html',
                    query: isTomorrow || isToday ? 'date=' + targetDate : '',
                    items: matches.slice(0, 5).map(t => ({ title: t.title, meta: `${labels[t.category] || 'Task'} • ${this.prettyTime(t.time)}`, page: 'calendar.html', query: 'date=' + t.date, icon: 'fa-solid fa-list-check' }))
                };
            }

            return null;
        },
        aiAnalyzeCopilotQuery(raw = '') {
            const text = raw.trim();
            if (!text) return { primaryAction: null, answer: null, tasks: [], groceries: [], nav: [] };

            let primaryAction = null;
            const answer = this.aiAnswerCopilotQuestion(text);
            const groceryItems = this.aiParseGroceryCommand(text);

            if (groceryItems && !answer) {
                primaryAction = {
                    type: 'add-grocery',
                    icon: 'fa-solid fa-cart-plus',
                    title: `Add ${groceryItems.map(i => (i.quantity > 1 ? i.quantity + '× ' : '') + i.name).join(', ')}`,
                    subtitle: 'ParenAI Grocery • Adds directly to your shopping list',
                    items: groceryItems
                };
            } else if (!answer) {
                if (/^(?:toggle\s+)?(?:dark|light)\s*(?:mode|theme)$/i.test(text)) {
                    primaryAction = {
                        type: 'toggle-theme',
                        icon: 'fa-solid fa-moon',
                        title: 'Switch Light / Dark Appearance',
                        subtitle: 'Quick Action • Toggles theme across ParenTech'
                    };
                } else if (/^(?:plan\s+(?:my\s+)?weekend|weekend\s+plan(?:ner)?)$/i.test(text)) {
                    primaryAction = {
                        type: 'plan-weekend',
                        icon: 'fa-solid fa-wand-magic-sparkles',
                        title: 'Open ParenAI Weekend Family Planner',
                        subtitle: 'ParenAI Calendar • Generate 2-day family itineraries'
                    };
                } else {
                    const isExplicitPillAction = /^(?:please\s+)?(?:add|schedule|set|remind\s+me\s+to\s+take)\s+/i.test(text) && this.aiPredictCategory(text) === 'pill';
                    const isDoseNotation = this.aiPredictCategory(text) === 'pill' && /\b(?:\d+\s*(?:mg|mcg|ml|g)|3x|2x|4x|twice|three times|daily)\b/i.test(text);
                    if (isExplicitPillAction || isDoseNotation) {
                        const pill = this.aiParsePillCommand(text);
                        if (pill) {
                            primaryAction = {
                                type: 'add-pill',
                                icon: 'fa-solid fa-capsules',
                                title: `Schedule ${pill.name} (${pill.dose})`,
                                subtitle: `ParenAI Health • ${pill.suggestedTimes.map(t => this.prettyTime(t)).join(', ')}`,
                                pill
                            };
                        }
                    } else {
                        const isTaskVerb = /^(?:please\s+)?(?:remind\s+me|remember\s+to|don'?t\s+forget|add\s+(?:a\s+)?(?:task|reminder|event)|schedule|create|cook|bake|prepare|make)\b/i.test(text);
                        const hasTimeOrDateCue = /\b(?:at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm)|today|tomorrow|tonight|morning|afternoon|evening|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(text);
                        if (isTaskVerb || hasTimeOrDateCue) {
                            const parsed = this.aiParseNaturalTask(text);
                            const dish = this.aiDetectCookingDish(parsed.title, text);
                            primaryAction = {
                                type: 'add-task',
                                icon: dish ? 'fa-solid fa-utensils' : 'fa-solid fa-calendar-plus',
                                title: `Create "${parsed.title}"`,
                                subtitle: `${labels[parsed.category] || 'Task'} • ${this.prettyDay(parsed.date)} at ${this.prettyTime(parsed.time)}` + (dish ? ` • +Syncs ${dish.name} ingredients` : ''),
                                parsed,
                                dish
                            };
                        }
                    }
                }
            }

            const q = text.toLowerCase();
            const matchingTasks = sorted(this.tasks.filter(t => !t.done && ((t.title + ' ' + (t.desc || '')).toLowerCase().includes(q)))).slice(0, 4);
            const matchingGroceries = (this.groceries || []).filter(g => g.name.toLowerCase().includes(q)).slice(0, 4);
            const navTargets = [
                { page: 'home.html', title: 'Home Dashboard', keywords: 'home dashboard overview briefing', icon: 'fa-solid fa-house' },
                { page: 'calendar.html', title: 'Calendar & Weekend Planner', keywords: 'calendar schedule events weekend', icon: 'fa-solid fa-calendar-days' },
                { page: 'grocery.html', title: 'Grocery Shopping List', keywords: 'grocery shopping food recipe ingredients', icon: 'fa-solid fa-cart-shopping' },
                { page: 'tasks.html', title: 'Tasks & Reminders', keywords: 'tasks todo chores family personal household', icon: 'fa-solid fa-list-check' },
                { page: 'pills.html', title: 'Pill & Medication Reminders', keywords: 'pills medicine medication pharmacy vitamins doses', icon: 'fa-solid fa-capsules' },
                { page: 'profile.html', title: 'Profile & Theme Settings', keywords: 'profile settings account dark light theme', icon: 'fa-solid fa-user' },
                { page: 'faqs.html', title: 'Frequently Asked Questions', keywords: 'faq faqs help guide', icon: 'fa-solid fa-circle-question' },
                { page: 'help.html', title: 'Help & Support', keywords: 'help support contact', icon: 'fa-solid fa-headset' }
            ].filter(n => n.title.toLowerCase().includes(q) || n.keywords.includes(q)).slice(0, 3);

            return { primaryAction, answer, tasks: matchingTasks, groceries: matchingGroceries, nav: navTargets };
        },
        executeCopilotAction(action) {
            if (!action) return false;
            const input = byId('topbarSearchInput');
            const dropdown = byId('aiCopilotDropdown');

            if (action.type === 'add-grocery') {
                const existing = new Set((this.groceries || []).map(g => g.name.trim().toLowerCase()));
                let added = 0;
                const names = [];
                for (const item of action.items) {
                    if (!existing.has(item.name.toLowerCase())) {
                        try {
                            store.addGrocery(item.name, item.quantity);
                            existing.add(item.name.toLowerCase());
                            added++;
                            names.push(item.name);
                        } catch (_) {}
                    }
                }
                if (input) input.value = '';
                if (dropdown) dropdown.hidden = true;
                document.querySelector('.topbar-search')?.classList.remove('mobile-open');
                this.refreshViews();
                this.showToast(added > 0 ? `🛒 ParenAI added ${names.join(', ')} to Grocery!` : '✨ Those items are already in your Grocery list!');
                return true;
            }

            if (action.type === 'add-task') {
                const { title, date, time, category } = action.parsed;
                store.saveTask({ title, description: '', category, date, time });
                if (action.dish) {
                    this.aiAddRecipeIngredients(action.dish, 'copilot');
                } else {
                    this.showToast(`📅 ParenAI scheduled "${title}" (${this.prettyDay(date)} at ${this.prettyTime(time)})!`);
                }
                if (input) input.value = '';
                if (dropdown) dropdown.hidden = true;
                document.querySelector('.topbar-search')?.classList.remove('mobile-open');
                this.refreshViews();
                return true;
            }

            if (action.type === 'add-pill') {
                const { name, dose, suggestedTimes } = action.pill;
                const today = dayKey();
                suggestedTimes.forEach((time, idx) => {
                    store.saveTask({
                        title: name + (suggestedTimes.length > 1 ? ` (Dose ${idx + 1})` : ''),
                        description: dose,
                        category: 'pill',
                        date: today,
                        time
                    });
                });
                if (input) input.value = '';
                if (dropdown) dropdown.hidden = true;
                document.querySelector('.topbar-search')?.classList.remove('mobile-open');
                this.refreshViews();
                this.showToast(`💊 ParenAI scheduled ${suggestedTimes.length} dose${suggestedTimes.length > 1 ? 's' : ''} for ${name}!`);
                return true;
            }

            if (action.type === 'toggle-theme') {
                if (input) input.value = '';
                if (dropdown) dropdown.hidden = true;
                this.toggleTheme();
                return true;
            }

            if (action.type === 'plan-weekend') {
                if (input) input.value = '';
                if (dropdown) dropdown.hidden = true;
                Promise.resolve(this.navigate('calendar.html')).then(() => {
                    this.openWeekendPlannerModal();
                });
                return true;
            }

            return false;
        },
        renderCopilotDropdown() {
            const input = byId('topbarSearchInput');
            const dropdown = byId('aiCopilotDropdown');
            if (!input || !dropdown) return;

            const raw = input.value.trim();
            if (!raw) {
                this._copilotState = { primaryAction: null, answer: null };
                dropdown.innerHTML =
                    '<div class="ai-copilot-section">' +
                        '<div class="ai-copilot-section-title"><i class="fa-solid fa-wand-magic-sparkles"></i> Try Asking ParenAI</div>' +
                        '<div class="ai-copilot-prompt-chips">' +
                            '<button type="button" class="ai-copilot-prompt-chip" data-copilot-prompt="Add milk and eggs to grocery"><i class="fa-solid fa-cart-plus"></i><span>"Add milk and eggs to grocery"</span></button>' +
                            '<button type="button" class="ai-copilot-prompt-chip" data-copilot-prompt="Remind me to call grandma at 4pm"><i class="fa-solid fa-bell"></i><span>"Remind me to call grandma at 4pm"</span></button>' +
                            '<button type="button" class="ai-copilot-prompt-chip" data-copilot-prompt="What are my tasks for today?"><i class="fa-solid fa-list-check"></i><span>"What are my tasks for today?"</span></button>' +
                            '<button type="button" class="ai-copilot-prompt-chip" data-copilot-prompt="Amoxicillin 500mg 3x daily"><i class="fa-solid fa-capsules"></i><span>"Amoxicillin 500mg 3x daily"</span></button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="ai-copilot-section">' +
                        '<div class="ai-copilot-section-title"><i class="fa-solid fa-compass"></i> Quick Jump</div>' +
                        '<button type="button" class="ai-copilot-result-row" data-copilot-nav="calendar.html"><span class="ai-copilot-result-left"><i class="fa-solid fa-calendar-days"></i><span class="ai-copilot-result-title">Calendar &amp; Weekend Planner</span></span><span class="ai-copilot-result-meta">Open &rarr;</span></button>' +
                        '<button type="button" class="ai-copilot-result-row" data-copilot-nav="grocery.html"><span class="ai-copilot-result-left"><i class="fa-solid fa-cart-shopping"></i><span class="ai-copilot-result-title">Grocery List (' + (this.groceries?.length || 0) + ' items)</span></span><span class="ai-copilot-result-meta">Open &rarr;</span></button>' +
                    '</div>';
                return;
            }

            const analysis = this.aiAnalyzeCopilotQuery(raw);
            this._copilotState = analysis;
            let html = '';

            if (analysis.primaryAction) {
                const act = analysis.primaryAction;
                html += '<div class="ai-copilot-section">' +
                    '<div class="ai-copilot-section-title"><i class="fa-solid fa-bolt"></i> ParenAI Action Ready</div>' +
                    '<button type="button" class="ai-copilot-action-card" id="aiCopilotRunActionBtn">' +
                        '<span class="ai-copilot-action-left">' +
                            '<span class="ai-copilot-action-icon"><i class="' + act.icon + '"></i></span>' +
                            '<span>' +
                                '<div class="ai-copilot-action-title">' + this.escape(act.title) + '</div>' +
                                '<div class="ai-copilot-action-sub">' + this.escape(act.subtitle) + '</div>' +
                            '</span>' +
                        '</span>' +
                        '<span class="ai-copilot-enter-badge">Enter &#8629;</span>' +
                    '</button>' +
                '</div>';
            }

            if (analysis.answer) {
                const ans = analysis.answer;
                html += '<div class="ai-copilot-section">' +
                    '<div class="ai-copilot-section-title"><i class="fa-solid fa-wand-magic-sparkles"></i> ParenAI Answer</div>' +
                    '<div class="ai-copilot-answer-box">' +
                        '<div><strong>' + this.escape(ans.title) + '</strong></div>' +
                        '<div style="color:var(--text-secondary);margin-top:2px;">' + this.escape(ans.summary) + '</div>' +
                        (ans.items.length ? '<div class="ai-copilot-answer-items">' + ans.items.map(it =>
                            '<button type="button" class="ai-copilot-result-row" data-copilot-nav="' + it.page + '" data-copilot-query="' + (it.query || '') + '">' +
                                '<span class="ai-copilot-result-left"><i class="' + it.icon + '"></i><span class="ai-copilot-result-title">' + this.escape(it.title) + '</span></span>' +
                                '<span class="ai-copilot-result-meta">' + this.escape(it.meta) + '</span>' +
                            '</button>'
                        ).join('') + '</div>' : '') +
                        '<div style="margin-top:8px;"><button type="button" class="ai-copilot-result-row" data-copilot-nav="' + ans.page + '" data-copilot-query="' + (ans.query || '') + '"><span class="ai-copilot-result-left"><i class="fa-solid fa-arrow-right"></i><span class="ai-copilot-result-title">View full page</span></span><span class="ai-copilot-result-meta">Open &rarr;</span></button></div>' +
                    '</div>' +
                '</div>';
            }

            if (analysis.tasks.length) {
                html += '<div class="ai-copilot-section">' +
                    '<div class="ai-copilot-section-title"><i class="fa-solid fa-list-check"></i> Matching Tasks &amp; Reminders</div>' +
                    analysis.tasks.map(t =>
                        '<button type="button" class="ai-copilot-result-row" data-copilot-nav="calendar.html" data-copilot-query="date=' + t.date + '">' +
                            '<span class="ai-copilot-result-left"><i class="' + (t.category === 'pill' ? 'fa-solid fa-capsules' : 'fa-regular fa-calendar-check') + '"></i><span class="ai-copilot-result-title">' + this.escape(t.title) + '</span></span>' +
                            '<span class="ai-copilot-result-meta">' + this.escape(this.prettyDay(t.date)) + '</span>' +
                        '</button>'
                    ).join('') +
                '</div>';
            }

            if (analysis.groceries.length) {
                html += '<div class="ai-copilot-section">' +
                    '<div class="ai-copilot-section-title"><i class="fa-solid fa-cart-shopping"></i> Matching Grocery Items</div>' +
                    analysis.groceries.map(g =>
                        '<button type="button" class="ai-copilot-result-row" data-copilot-nav="grocery.html">' +
                            '<span class="ai-copilot-result-left"><i class="fa-solid fa-basket-shopping"></i><span class="ai-copilot-result-title">' + this.escape(g.name) + '</span></span>' +
                            '<span class="ai-copilot-result-meta">Qty: ' + (g.quantity || 1) + '</span>' +
                        '</button>'
                    ).join('') +
                '</div>';
            }

            if (analysis.nav.length) {
                html += '<div class="ai-copilot-section">' +
                    '<div class="ai-copilot-section-title"><i class="fa-solid fa-compass"></i> Pages</div>' +
                    analysis.nav.map(n =>
                        '<button type="button" class="ai-copilot-result-row" data-copilot-nav="' + n.page + '">' +
                            '<span class="ai-copilot-result-left"><i class="' + n.icon + '"></i><span class="ai-copilot-result-title">' + this.escape(n.title) + '</span></span>' +
                            '<span class="ai-copilot-result-meta">Go &rarr;</span>' +
                        '</button>'
                    ).join('') +
                '</div>';
            }

            if (!html) {
                const parsed = this.aiParseNaturalTask(raw);
                analysis.fallbackTask = {
                    type: 'add-task',
                    icon: 'fa-solid fa-plus',
                    title: `Add "${parsed.title}" as a task`,
                    subtitle: `${labels[parsed.category] || 'Personal Task'} • ${this.prettyDay(parsed.date)} at ${this.prettyTime(parsed.time)}`,
                    parsed,
                    dish: this.aiDetectCookingDish(parsed.title, raw)
                };
                html = '<div class="ai-copilot-section">' +
                    '<div class="ai-copilot-section-title"><i class="fa-solid fa-sparkles"></i> Quick Create</div>' +
                    '<button type="button" class="ai-copilot-action-card" id="aiCopilotFallbackBtn">' +
                        '<span class="ai-copilot-action-left">' +
                            '<span class="ai-copilot-action-icon"><i class="fa-solid fa-plus"></i></span>' +
                            '<span>' +
                                '<div class="ai-copilot-action-title">' + this.escape(analysis.fallbackTask.title) + '</div>' +
                                '<div class="ai-copilot-action-sub">' + this.escape(analysis.fallbackTask.subtitle) + '</div>' +
                            '</span>' +
                        '</span>' +
                        '<span class="ai-copilot-enter-badge">Add</span>' +
                    '</button>' +
                '</div>';
            }

            dropdown.innerHTML = html;
        },
        setupSearch() {
            const input = byId('topbarSearchInput');
            if (!input) return;
            const searchBox = input.closest('.topbar-search');
            if (searchBox && !searchBox.dataset.copilotBound) {
                searchBox.dataset.copilotBound = 'true';
                const leftIcon = searchBox.querySelector('i');
                if (leftIcon) leftIcon.className = 'fa-solid fa-wand-magic-sparkles';

                if (!byId('aiCopilotTriggerBtn')) {
                    const pill = document.createElement('button');
                    pill.type = 'button';
                    pill.id = 'aiCopilotTriggerBtn';
                    pill.className = 'topbar-ai-pill';
                    pill.title = 'Ask ParenAI & Global Search (Ctrl+K)';
                    pill.innerHTML = '<span>Ask ParenAI</span><kbd>Ctrl+K</kbd>';
                    pill.addEventListener('click', () => {
                        input.focus();
                        const dd = byId('aiCopilotDropdown');
                        if (dd) { dd.hidden = false; this.renderCopilotDropdown(); }
                    });
                    searchBox.appendChild(pill);
                }

                if (!byId('aiCopilotDropdown')) {
                    const dropdown = document.createElement('div');
                    dropdown.id = 'aiCopilotDropdown';
                    dropdown.className = 'ai-copilot-dropdown';
                    dropdown.hidden = true;
                    dropdown.setAttribute('role', 'listbox');
                    dropdown.setAttribute('aria-label', 'ParenAI Command Suggestions');
                    dropdown.addEventListener('click', event => {
                        const promptChip = event.target.closest('[data-copilot-prompt]');
                        if (promptChip) {
                            input.value = promptChip.dataset.copilotPrompt;
                            this.renderCopilotDropdown();
                            input.focus();
                            return;
                        }
                        const runBtn = event.target.closest('#aiCopilotRunActionBtn');
                        if (runBtn && this._copilotState?.primaryAction) {
                            this.executeCopilotAction(this._copilotState.primaryAction);
                            return;
                        }
                        const fallbackBtn = event.target.closest('#aiCopilotFallbackBtn');
                        if (fallbackBtn && this._copilotState?.fallbackTask) {
                            this.executeCopilotAction(this._copilotState.fallbackTask);
                            return;
                        }
                        const navBtn = event.target.closest('[data-copilot-nav]');
                        if (navBtn) {
                            dropdown.hidden = true;
                            searchBox.classList.remove('mobile-open');
                            this.navigate(navBtn.dataset.copilotNav, navBtn.dataset.copilotQuery || '');
                        }
                    });
                    searchBox.appendChild(dropdown);
                }

                const topbarRight = document.querySelector('.topbar-right');
                if (topbarRight && !byId('mobileCopilotBtn')) {
                    const mobBtn = document.createElement('button');
                    mobBtn.type = 'button';
                    mobBtn.id = 'mobileCopilotBtn';
                    mobBtn.className = 'icon-btn-round mobile-copilot-btn';
                    mobBtn.title = 'Ask ParenAI & Search';
                    mobBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i>';
                    mobBtn.addEventListener('click', () => {
                        const opening = !searchBox.classList.contains('mobile-open');
                        searchBox.classList.toggle('mobile-open', opening);
                        const dd = byId('aiCopilotDropdown');
                        if (opening) {
                            if (dd) { dd.hidden = false; this.renderCopilotDropdown(); }
                            input.focus();
                        } else if (dd) {
                            dd.hidden = true;
                        }
                    });
                    topbarRight.prepend(mobBtn);
                }

                document.addEventListener('click', event => {
                    const dd = byId('aiCopilotDropdown');
                    const mobBtn = byId('mobileCopilotBtn');
                    if (dd && !searchBox.contains(event.target) && event.target !== mobBtn && !mobBtn?.contains?.(event.target)) {
                        dd.hidden = true;
                        searchBox.classList.remove('mobile-open');
                    }
                });
            }

            if (!input.dataset.bound) {
                input.dataset.bound = 'true';
                input.addEventListener('focus', () => {
                    const dd = byId('aiCopilotDropdown');
                    if (dd) {
                        dd.hidden = false;
                        this.renderCopilotDropdown();
                    }
                });
                input.addEventListener('input', () => {
                    if (['faqs.html', 'help.html'].includes(this.pageName())) document.querySelectorAll(this.pageName() === 'faqs.html' ? '.faq-card-item' : '.settings-option-card').forEach(card => { card.hidden = !card.textContent.toLowerCase().includes(input.value.toLowerCase()); });
                    if (this.pageName() === 'grocery.html') this.renderGroceryList(input.value);
                    if (this.pageName() === 'tasks.html') this.renderTasksList(input.value);
                    if (this.pageName() === 'pills.html') { const container = byId('pillsListContainer'), matches = this.pills.filter(task => task.title.toLowerCase().includes(input.value.toLowerCase())); if (container) container.innerHTML = matches.map(task => this.taskMarkup(task)).join('') || '<div class="empty-strip-card">No matching reminders.</div>'; }

                    const dd = byId('aiCopilotDropdown');
                    if (dd) {
                        dd.hidden = false;
                        this.renderCopilotDropdown();
                    }
                });
                input.addEventListener('keydown', event => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    const analysis = this._copilotState || this.aiAnalyzeCopilotQuery(input.value);
                    if (analysis?.primaryAction) {
                        this.executeCopilotAction(analysis.primaryAction);
                        return;
                    }
                    if (analysis?.answer) {
                        const dd = byId('aiCopilotDropdown');
                        if (dd) { dd.hidden = false; this.renderCopilotDropdown(); }
                        return;
                    }
                    if (this.pageName() === 'faqs.html') { const card = [...document.querySelectorAll('.faq-card-item')].find(card => !card.hidden); if (card) { card.classList.add('open'); card.scrollIntoView({ block: 'center' }); } return; }
                    if (this.pageName() === 'help.html') { const card = [...document.querySelectorAll('[data-topic]')].find(card => !card.hidden); if (card) this.navigate('faqs.html', 'topic=' + card.dataset.topic); return; }
                    const match = sorted(this.tasks.filter(task => !task.done && task.title.toLowerCase().includes(input.value.trim().toLowerCase())))[0];
                    if (match) {
                        const dd = byId('aiCopilotDropdown');
                        if (dd) dd.hidden = true;
                        this.navigate('calendar.html', 'date=' + match.date);
                    } else if (analysis?.nav?.length) {
                        const dd = byId('aiCopilotDropdown');
                        if (dd) dd.hidden = true;
                        this.navigate(analysis.nav[0].page);
                    } else if (analysis?.groceries?.length) {
                        const dd = byId('aiCopilotDropdown');
                        if (dd) dd.hidden = true;
                        this.navigate('grocery.html');
                    } else {
                        this.showToast('No matching pending task or medicine reminder.');
                    }
                });
            }
        },
        setupReportForm() {
            const form=byId('reportProblemForm');if(!form||form.dataset.bound)return;form.noValidate=true;form.dataset.bound='true';
            const desc=byId('reportProblemDesc');if(desc&&!desc.dataset.bound){desc.dataset.bound='true';desc.addEventListener('input',()=>{byId('reportCharCount').textContent=desc.value.length+'/500';});}
            form.addEventListener('submit',event=>{event.preventDefault();this.submitForm(form,()=>{
                const file=byId('reportScreenshot')?.files?.[0],error=validation.validateScreenshot(file);
                if(error)throw new validation.ValidationError({screenshot:error});
                store.saveReport({category:byId('reportCategory').value,description:byId('reportProblemDesc').value,email:byId('reportEmail').value,screenshotName:file?.name||''});
                this.showToast('Report confirmed. This local version does not save or send reports.');form.reset();byId('reportCharCount').textContent='0/500';
            },{category:'reportCategory',description:'reportProblemDesc',email:'reportEmail',screenshot:'reportScreenshot'});});
        },
        showNotificationSettings() {
            let modal=byId('notificationSettingsModal');
            if(!modal){modal=document.createElement('div');modal.id='notificationSettingsModal';modal.className='modal-backdrop-overlay';modal.innerHTML='<section class="logout-dialog-box"><h2>Reminder notifications</h2><p>Keep ParenTech open for scheduled task and medicine alerts. Desktop alerts also need browser permission.</p><form id="notificationSettingsForm"><label><input id="enableNotifications" type="checkbox"> Enable reminder alerts</label><p class="form-error" hidden></p><div class="logout-actions-row"><button type="button" class="btn-dialog-no" data-action="close-modal">Cancel</button><button type="submit" class="btn-dialog-yes">Save</button></div></form></section>';document.body.appendChild(modal);
                const form=byId('notificationSettingsForm');
                form.addEventListener('submit',event=>{event.preventDefault();this.submitForm(form,async()=>{
                    const userId=store.getState().user?.id,enabled=byId('enableNotifications').checked;
                    if(enabled&&'Notification' in root&&root.Notification.permission==='default')await root.Notification.requestPermission();
                    if(store.getState().user?.id!==userId)return;
                    store.updateSettings({notifications:enabled});modal.classList.remove('active');this.checkReminders();this.scheduleReminders();this.showToast('Reminder settings saved.');
                });});
            }
            byId('enableNotifications').checked=store.getState().settings.notifications;modal.classList.add('active');
        },
        checkReminders() {
            const state=store.getState();if(!state.user||!state.settings.notifications)return;
            state.tasks.filter(task=>!task.completed&&!task.notifiedAt&&new Date(task.date+'T'+task.time+':00').getTime()<=Date.now()).forEach(task=>{
                store.markNotified(task.id);this.showToast((task.category==='pill'?'Medicine reminder: ':'Task reminder: ')+task.title);
                if('Notification' in root&&root.Notification.permission==='granted'){try{new root.Notification(task.category==='pill'?'Medicine reminder':'ParenTech reminder',{body:task.title,tag:task.id,icon:this.pageName()==='index.html'?'assets/img/logo.png':'../assets/img/logo.png'});}catch{}}
            });
        },
        scheduleReminders() {
            if(this._alarm!==null)clearTimeout(this._alarm);this._alarm=null;
            const state=store.getState();if(!state.user||!state.settings.notifications)return;
            const next=sorted(state.tasks.filter(task=>!task.completed&&!task.notifiedAt))[0];if(!next)return;
            this._alarm=setTimeout(()=>{this._alarm=null;this.checkReminders();this.scheduleReminders();},Math.min(2147483647,Math.max(1,new Date(next.date+'T'+next.time+':00').getTime()-Date.now())));
        },
        prettyDay(value) { return new Date(value+'T12:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}); },
        prettyTime(value) { const [h,m]=value.split(':').map(Number);return (h%12||12)+':'+String(m).padStart(2,'0')+' '+(h>=12?'PM':'AM'); }
    };
    root.ParenTechApp=app;
    app.applyTheme();
    try {
        if (root.innerWidth > 768 && root.localStorage && root.localStorage.getItem('pt_sidebar_minimized') === 'true') {
            byId('appSidebar')?.classList.add('minimized');
            document.querySelector('.app-shell')?.classList.add('sidebar-minimized');
        }
    } catch (_) {}
    root.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',()=>{if(store.getState().settings.theme==='system')app.applyTheme();});
    root.addEventListener('storage',async event=>{
        if(event.key!=='parentech.v1'&&event.key!==null)return;
        try{
            const previousId=app.user?.id;
            store.reloadFromStorage();await store.init();if(demo&&!store.getState().user)store.demo();
            const current=store.getState();
            if(current.user?.id!==previousId)document.querySelectorAll('.modal-backdrop-overlay.active').forEach(modal=>modal.classList.remove('active'));
            if(!current.user&&!['index.html','signup.html'].includes(app.pageName()))app.navigate('index.html');else app.refreshViews();
        }
        catch(error){app.showToast(error.message);}
    });
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){app.checkReminders();app.scheduleReminders();}});
    document.addEventListener('DOMContentLoaded',()=>app.init());
})(window);

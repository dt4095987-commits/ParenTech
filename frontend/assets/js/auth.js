(function (root) {
    'use strict';

    const store = root.PTStore;
    const validation = root.PTValidation;
    const PHONE_HELP = 'Enter 10 digits beginning with 9 after +63, for example 9171234567.';
    const touched = new WeakMap();
    let pendingPhoto = null;
    let photoReadVersion = 0;
    let modalGeneration = 0;
    let keydownBound = false;

    function byId(id) { return document.getElementById(id); }
    function toast(message) { root.ParenTechApp?.showToast(message); }
    function control(form, name) { return form.querySelector(`[name="${name}"]`); }
    function fieldError(form, name, message) {
        const input = control(form, name);
        if (!input) return;
        const field = input.closest('.form-field-pill') || input.parentElement;
        let error = field.querySelector(`[data-error-field="${name}"]`);
        if (!error && message) {
            error = document.createElement('p');
            error.className = 'field-error';
            error.dataset.errorField = name;
            error.id = `${form.id}-${name}-error`;
            error.setAttribute('role', 'status');
            field.appendChild(error);
            const describedBy = new Set((input.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
            describedBy.add(error.id);
            input.setAttribute('aria-describedby', [...describedBy].join(' '));
        }
        if (error) { error.textContent = message || ''; error.hidden = !message; }
        input.setAttribute('aria-invalid', message ? 'true' : 'false');
        field.classList.toggle('has-error', Boolean(message));
    }
    function formError(form, message) {
        const error = form.querySelector('.form-error');
        if (error) { error.textContent = message || ''; error.hidden = !message; }
    }
    function clearErrors(form) {
        form.querySelectorAll('[name]').forEach(input => fieldError(form, input.name, ''));
        formError(form, '');
    }
    function values(form) {
        const result = {};
        form.querySelectorAll('[name]').forEach(input => { result[input.name] = input.value; });
        if (Object.hasOwn(result, 'phone')) result.phone = '+63' + result.phone;
        return result;
    }
    function checkForm(form, kind) {
        const input = values(form);
        if (kind === 'profile') input.photo = store.getState().user?.photo || '';
        const result = validation.check(kind, input);
        const phone = control(form, 'phone');
        if (phone && !/^9[0-9]{9}$/.test(phone.value)) result.errors.phone = PHONE_HELP;
        else if (result.errors.phone) result.errors.phone = PHONE_HELP;
        result.valid = Object.keys(result.errors).length === 0;
        return result;
    }
    function showErrors(form, error) {
        const fields = error?.fields || { _form: error?.message || 'Please try again.' };
        for (const [name, message] of Object.entries(fields)) fieldError(form, name, message);
        formError(form, fields._form || (Object.keys(fields).length > 1 ? 'Please check the highlighted fields.' : Object.values(fields)[0]));
        const first = Object.keys(fields).map(name => control(form, name)).find(Boolean);
        first?.focus();
    }
    function profileContext(form) {
        const modal = form?.closest('.modal-backdrop-overlay');
        return { form, modal, ownerId: form?.dataset.ownerAccountId || '', generation: modal?.dataset.authGeneration || '' };
    }
    function currentProfileDialog(context) {
        return Boolean(context?.modal && byId(context.modal.id) === context.modal && context.modal.classList.contains('active') &&
            context.modal.dataset.authGeneration === context.generation && context.form.dataset.ownerAccountId === context.ownerId &&
            store.getState().user?.id === context.ownerId);
    }
    function invalidateModal(modal) {
        if (modal) modal.dataset.authGeneration = String(++modalGeneration);
    }
    function closeObsoleteProfileDialogs(ownerId) {
        const form = byId('editProfileForm');
        if (form?.dataset.ownerAccountId === ownerId) {
            const modal = form.closest('.modal-backdrop-overlay');
            invalidateModal(modal); modal?.classList.remove('active');
        }
        if (pendingPhoto?.userId === ownerId) {
            pendingPhoto = null; photoReadVersion++;
            const modal = byId('profilePhotoPreviewModal');
            invalidateModal(modal); modal?.classList.remove('active');
        }
    }
    async function recoverSession(error, ownerId, context) {
        if (!['SESSION_CHANGED', 'AUTH_REQUIRED'].includes(error?.code)) return false;
        // Close the draft belonging to the rejected request, preserving newer dialogs.
        if (currentProfileDialog(context)) { invalidateModal(context.modal); context.modal.classList.remove('active'); }
        const beforeId = store.getState().user?.id;
        try {
            await store.init();
            const user = store.getState().user;
            if (!user || user.id !== ownerId) closeObsoleteProfileDialogs(ownerId);
            if (beforeId !== user?.id) closeObsoleteProfileDialogs(beforeId);
            root.ParenTechApp?.syncState?.();
            if (!user) {
                if (root.ParenTechApp?.navigate) root.ParenTechApp.navigate('index.html');
                else root.location.href = root.location.pathname.includes('/pages/') ? '../index.html' : 'index.html';
            } else {
                root.ParenTechApp?.applyTheme?.();
                root.ParenTechApp?.refreshViews?.(); refreshProfile();
                toast('Your sign-in changed. Review your account and open the form again.');
            }
        } catch (refreshError) {
            toast(refreshError.message || 'Please reload to check your current sign-in.');
        }
        return true;
    }
    function nationalPhone(value) {
        let compact = String(value || '').normalize('NFKC').trim();
        // Accept familiar Philippine formats pasted into the fixed country-code field.
        if (!/^[+0-9\s().-]*$/.test(compact)) return null;
        compact = compact.replace(/[\s().-]/g, '');
        if (compact.startsWith('+63')) compact = compact.slice(3);
        else if (compact.startsWith('+')) return null;
        else if (/^639[0-9]{9}$/.test(compact)) compact = compact.slice(2);
        else if (/^09[0-9]{9}$/.test(compact)) compact = compact.slice(1);
        return /^[0-9]*$/.test(compact) ? compact : null;
    }
    function bindPhone(form, validateField) {
        const input = control(form, 'phone');
        if (!input) return;
        let previous = input.value;
        const rejected = message => fieldError(form, 'phone', message);
        input.addEventListener('beforeinput', event => {
            if (event.isComposing || !event.inputType?.startsWith('insert') || typeof event.data !== 'string') return;
            const start = input.selectionStart ?? input.value.length;
            const end = input.selectionEnd ?? start;
            const next = input.value.slice(0, start) + event.data + input.value.slice(end);
            if ((!/^[0-9]*$/.test(next) || next.length > 10) && event.cancelable !== false) {
                event.preventDefault();
                rejected('Use digits only, up to 10 digits after the fixed +63 country code.');
            }
        });
        function insertText(event, text) {
            event.preventDefault();
            const digits = nationalPhone(text);
            if (digits === null) { rejected('Use a Philippine mobile number. The country code is fixed at +63.'); return; }
            const start = input.selectionStart ?? input.value.length;
            const end = input.selectionEnd ?? start;
            const next = input.value.slice(0, start) + digits + input.value.slice(end);
            if (next.length > 10) { rejected('That number could not be inserted. Enter up to 10 digits after +63.'); return; }
            input.value = previous = next;
            input.setSelectionRange?.(start + digits.length, start + digits.length);
            validateField(input, true);
        }
        input.addEventListener('paste', event => { if (event.clipboardData) insertText(event, event.clipboardData.getData('text/plain')); });
        input.addEventListener('drop', event => { if (event.dataTransfer) insertText(event, event.dataTransfer.getData('text/plain')); });
        function filter() {
            const digits = nationalPhone(input.value);
            if (digits === null) {
                input.value = previous;
                rejected('Use digits only after the fixed +63 country code.');
            } else {
                input.value = previous = digits;
                if (digits.length > 10) rejected(PHONE_HELP);
                else validateField(input, touched.get(form)?.has('phone'));
            }
        }
        input.addEventListener('input', event => { if (!event.isComposing) filter(); });
        input.addEventListener('compositionend', filter);
    }
    function bindPasswords(form) {
        form.querySelectorAll('[data-password-target]').forEach(button => {
            button.addEventListener('click', () => {
                const password = byId(button.dataset.passwordTarget);
                if (!password) return;
                const visible = password.type === 'password';
                password.type = visible ? 'text' : 'password';
                button.setAttribute('aria-pressed', String(visible));
                button.setAttribute('aria-label', `${visible ? 'Hide' : 'Show'} ${password.name === 'confirmPassword' ? 'confirm password' : 'password'}`);
                const icon = button.querySelector('i');
                if (icon) icon.className = visible ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
            });
        });
    }
    function updateStrength(password) {
        const box = byId('signupPasswordStrength');
        const label = byId('passwordStrengthText');
        if (!box || !label) return;
        let strength = 'empty', message = 'Enter a password to see its strength.';
        if (password) {
            const missing = [];
            if (password.length < 8) missing.push('8+ characters');
            if (!/\p{Lu}/u.test(password)) missing.push('an uppercase letter');
            if (!/\p{Nd}/u.test(password)) missing.push('a number');
            if (password.length > validation.LIMITS.password || /[\u0000-\u001f\u007f-\u009f]/.test(password)) {
                strength = 'weak'; message = 'Use up to 128 characters without control characters.';
            } else if (missing.length) { strength = 'weak'; message = `Add ${missing.join(', ')}.`; }
            else if (password.length >= 12 && /\p{Ll}/u.test(password) && /[^\p{L}\p{N}\s]/u.test(password)) {
                strength = 'strong'; message = 'Strong password';
            } else { strength = 'good'; message = 'Good password. Add length and a symbol to make it stronger.'; }
        }
        box.dataset.strength = strength;
        label.textContent = message;
    }
    function updateAge(form) {
        const age = control(form, 'age'), dob = control(form, 'dob');
        if (age && dob) age.value = validation.ageFromDOB(dob.value) ?? '';
    }
    function bindForm(form, kind, afterSave) {
        if (!form || form.dataset.authBound) return;
        form.dataset.authBound = 'true';
        if (kind === 'profile') form.dataset.ownerAccountId = store.getState().user?.id || '';
        touched.set(form, new Set());
        const dob = control(form, 'dob');
        if (dob) dob.max = validation.localDay();
        function validateField(input, force = false) {
            if (!input?.name || form.dataset.submitting === 'true' || (!force && !touched.get(form).has(input.name))) return;
            touched.get(form).add(input.name);
            const result = checkForm(form, kind);
            fieldError(form, input.name, result.errors[input.name] || '');
            if (input.name === 'password' && touched.get(form).has('confirmPassword')) fieldError(form, 'confirmPassword', result.errors.confirmPassword || '');
            if (form.querySelector('.form-error:not([hidden])') && !form.querySelector('.field-error:not([hidden])')) formError(form, '');
        }
        bindPhone(form, validateField);
        bindPasswords(form);
        form.addEventListener('focusout', event => validateField(event.target, true));
        form.addEventListener('change', event => { updateAge(form); validateField(event.target, true); });
        form.addEventListener('beforeinput', event => {
            if (event.target.name === 'name' && typeof event.data === 'string' && /\p{N}/u.test(event.data) && event.cancelable !== false) {
                event.preventDefault(); fieldError(form, 'name', 'Use letters, spaces, apostrophes, hyphens, and periods for your name.');
            }
        });
        form.addEventListener('input', event => {
            if (event.target.name === 'phone' || event.isComposing) return;
            if (event.target.name === 'name' && /\p{N}/u.test(event.target.value)) {
                event.target.value = event.target.value.replace(/\p{N}/gu, '');
                fieldError(form, 'name', 'Use letters, spaces, apostrophes, hyphens, and periods for your name.');
                return;
            }
            updateAge(form);
            if (kind === 'signup' && event.target.name === 'password') updateStrength(event.target.value);
            validateField(event.target);
        });
        form.addEventListener('submit', async event => {
            event.preventDefault();
            if (form.dataset.submitting === 'true' || form.dataset.recovering === 'true') return;
            const context = kind === 'profile' ? profileContext(form) : null;
            if (kind === 'profile' && (!context.ownerId || context.ownerId !== store.getState().user?.id)) {
                form.dataset.recovering = 'true';
                try { await recoverSession({ code: 'SESSION_CHANGED' }, context.ownerId, context); }
                finally { form.dataset.recovering = 'false'; }
                return;
            }
            clearErrors(form);
            const result = checkForm(form, kind);
            if (!result.valid) { showErrors(form, new validation.ValidationError(result.errors)); return; }
            const submit = form.querySelector('[type="submit"]');
            const label = submit?.textContent;
            const controls = [...form.querySelectorAll('input, select, button')].map(input => [input, input.disabled]);
            form.dataset.submitting = 'true'; form.setAttribute('aria-busy', 'true');
            controls.forEach(([input]) => { input.disabled = true; });
            if (submit) submit.textContent = kind === 'login' ? 'LOGGING IN...' : kind === 'signup' ? 'CREATING ACCOUNT...' : 'SAVING...';
            try {
                const payload = { ...result.values };
                if (kind === 'profile') { delete payload.age; delete payload.photo; }
                const state = await (kind === 'profile' ? store.updateProfile(payload) : store[kind](payload));
                afterSave(state, context);
            } catch (error) {
                if (!await recoverSession(error, context?.ownerId, context) && (kind !== 'profile' || currentProfileDialog(context))) showErrors(form, error);
            } finally {
                controls.forEach(([input, disabled]) => { input.disabled = disabled; });
                if (submit) submit.textContent = label;
                form.dataset.submitting = 'false'; form.setAttribute('aria-busy', 'false');
            }
        });
        updateAge(form);
    }
    function bindDropdown(wrapperId, inputId, optionsId) {
        const wrapper = byId(wrapperId), input = byId(inputId), options = byId(optionsId);
        if (!wrapper || !input || !options || wrapper.dataset.authBound) return;
        wrapper.dataset.authBound = 'true';
        input.setAttribute('role', 'combobox'); input.setAttribute('aria-expanded', 'false');
        input.setAttribute('aria-controls', optionsId); input.setAttribute('aria-haspopup', 'listbox');
        options.setAttribute('role', 'listbox');
        function close() { options.classList.remove('open'); input.setAttribute('aria-expanded', 'false'); }
        function toggle() {
            if (input.disabled) return;
            const open = !options.classList.contains('open');
            document.querySelectorAll('.custom-select-options.open').forEach(node => {
                node.classList.remove('open');
                document.querySelector(`[aria-controls="${node.id}"]`)?.setAttribute('aria-expanded', 'false');
            });
            options.classList.toggle('open', open); input.setAttribute('aria-expanded', String(open));
            if (open) options.querySelector('[role="option"]')?.focus();
        }
        wrapper.addEventListener('click', event => { event.stopPropagation(); if (!event.target.closest('.custom-select-option')) toggle(); });
        input.addEventListener('keydown', event => {
            if (['Enter', ' ', 'ArrowDown'].includes(event.key)) { event.preventDefault(); toggle(); }
            else if (event.key === 'Escape') close();
        });
        options.querySelectorAll('.custom-select-option').forEach(option => {
            option.setAttribute('role', 'option'); option.tabIndex = 0;
            function choose(event) {
                event.stopPropagation(); if (input.disabled) return;
                input.value = option.dataset.value;
                options.querySelectorAll('.custom-select-option').forEach(node => {
                    const selected = node === option;
                    node.classList.toggle('selected', selected); node.setAttribute('aria-selected', String(selected));
                });
                close(); input.dispatchEvent(new Event('change', { bubbles: true })); input.focus();
            }
            option.addEventListener('click', choose);
            option.addEventListener('keydown', event => {
                if (['Enter', ' '].includes(event.key)) { event.preventDefault(); choose(event); }
                if (event.key === 'Escape') { close(); input.focus(); }
            });
        });
        document.addEventListener('click', close);
    }
    function initLogin() {
        bindForm(byId('loginForm'), 'login', () => { root.location.href = 'pages/home.html'; });
    }
    function initSignup() {
        bindForm(byId('signupForm'), 'signup', () => { root.location.href = 'home.html'; });
        bindDropdown('civilStatusSelect', 'signupCivilStatus', 'civilStatusOptions');
        bindDropdown('roleSelect', 'signupRole', 'roleOptions');
    }
    function openModal(id) {
        const modal = byId(id);
        if (!modal) return;
        document.querySelectorAll('.modal-backdrop-overlay.active').forEach(node => { invalidateModal(node); node.classList.remove('active'); });
        invalidateModal(modal);
        modal.classList.add('active');
        modal.querySelector('input, select, button')?.focus();
    }
    function avatarSource(user) {
        if (user?.photo) return user.photo;
        const initials = (user?.name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => Array.from(part)[0]).join('').toUpperCase() || 'P';
        const safe = initials.replace(/[&<>"']/g, '');
        return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="60" fill="#EFEAF8"/><text x="60" y="65" text-anchor="middle" dominant-baseline="middle" font-family="Arial,sans-serif" font-size="42" fill="#7337B8">${safe}</text></svg>`);
    }
    function refreshProfile() {
        const state = store.getState(), user = state.user;
        if (!user) return;
        const text = (id, value) => { const node = byId(id); if (node) node.textContent = String(value); };
        text('profileUserName', user.name); text('profileHeroName', `${user.name} ♥`);
        text('profileUserPhone', user.phone); text('profileHeroPhone', user.phone);
        text('profileHeroRoleBadge', user.role); text('profileHeroAgeBadge', `Age: ${user.age ?? 'N/A'}`);
        text('profileTasksDoneVal', state.tasks.filter(task => task.completed).length);
        text('profileDayStreakVal', store.getProfileStreak()); text('profileGroceriesDoneVal', store.getGroceryDayCount());
        text('themeModeLabel', state.settings.theme === 'system' ? 'Follow device appearance' : `${state.settings.theme === 'dark' ? 'Dark' : 'Light'} Mode`);
        text('profileStorageStatus', store.getStorageStatus().message);
        if (byId('profileThemeSelect')) byId('profileThemeSelect').value = state.settings.theme;
        document.querySelectorAll('[data-profile-photo], .topbar-avatar img').forEach(image => { image.src = avatarSource(user); image.alt = `${user.name}'s profile`; });
    }
    function editProfile() {
        const form = byId('editProfileForm'), user = store.getState().user;
        if (!form || !user || form.dataset.submitting === 'true') return;
        form.dataset.ownerAccountId = user.id;
        clearErrors(form); touched.set(form, new Set());
        for (const name of ['name', 'phone', 'dob', 'civilStatus', 'role']) {
            const input = control(form, name);
            if (input) input.value = name === 'phone' ? nationalPhone(user.phone) || '' : user[name] || '';
        }
        updateAge(form); openModal('editProfileModal');
    }
    async function previewPhoto(file) {
        const version = ++photoReadVersion;
        const userId = store.getState().user?.id;
        const previousModal = document.querySelector('.modal-backdrop-overlay.active');
        pendingPhoto = null;
        if (!file) return;
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || !file.size || file.size > validation.LIMITS.profilePhotoBytes) {
            toast('Choose a PNG, JPG, or WebP photo of 2 MB or smaller.'); return;
        }
        try {
            const data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(new Error('The photo could not be read. Choose another image.'));
                reader.readAsDataURL(file);
            });
            const error = validation.validateProfilePhoto(data);
            if (error) throw new Error(error);
            await new Promise((resolve, reject) => {
                const image = new Image();
                image.onload = () => image.naturalWidth > 0 ? resolve() : reject(new Error('Choose an image that can be displayed.'));
                image.onerror = () => reject(new Error('This photo could not be displayed. Choose another image.'));
                image.src = data;
            });
            if (version !== photoReadVersion || userId !== store.getState().user?.id || previousModal !== document.querySelector('.modal-backdrop-overlay.active')) return;
            pendingPhoto = { data, userId };
            byId('profilePhotoPreview').src = data;
            byId('profilePhotoError').hidden = true;
            openModal('profilePhotoPreviewModal');
        } catch (error) { if (version === photoReadVersion) toast(error.message); }
    }
    async function confirmPhoto() {
        const pending = pendingPhoto, button = byId('confirmProfilePhotoBtn'), modal = byId('profilePhotoPreviewModal');
        if (!pending || button.disabled || !modal.classList.contains('active')) return;
        if (pending.userId !== store.getState().user?.id) {
            pendingPhoto = null; invalidateModal(modal); modal.classList.remove('active');
            await recoverSession({ code: 'SESSION_CHANGED' }, pending.userId); return;
        }
        const generation = modal.dataset.authGeneration;
        button.disabled = true; button.textContent = 'SAVING...'; modal.setAttribute('aria-busy', 'true');
        try {
            await store.updateProfilePhoto(pending.data);
            if (pendingPhoto === pending && modal.dataset.authGeneration === generation && byId(modal.id) === modal) { pendingPhoto = null; modal.classList.remove('active'); }
            refreshProfile(); root.ParenTechApp?.syncState?.(); toast('Profile photo updated.');
        } catch (error) {
            if (await recoverSession(error, pending.userId)) {
                if (pendingPhoto === pending) { pendingPhoto = null; invalidateModal(modal); modal.classList.remove('active'); }
            } else if (pendingPhoto === pending && modal.dataset.authGeneration === generation && modal.classList.contains('active')) {
                const node = byId('profilePhotoError'); node.textContent = error.message || 'The profile photo could not be saved.'; node.hidden = false;
            }
        } finally { button.disabled = false; button.textContent = 'Use Photo'; modal.setAttribute('aria-busy', 'false'); }
    }
    function bindAction(selector, action) {
        document.querySelectorAll(selector).forEach(node => {
            if (node.dataset.bound) return;
            node.dataset.bound = 'true';
            node.addEventListener('click', event => { event.preventDefault(); action(); });
            if (node.getAttribute('role') === 'button') node.addEventListener('keydown', event => {
                if (['Enter', ' '].includes(event.key)) { event.preventDefault(); action(); }
            });
        });
    }
    function initProfile() {
        if (!store.getState().user) return;
        store.recordProfileView();
        refreshProfile();
        const form = byId('editProfileForm');
        if (form && !form.dataset.profileBound) {
            form.dataset.profileBound = 'true';
            bindForm(form, 'profile', (state, context) => {
                if (currentProfileDialog(context)) context.modal.classList.remove('active');
                root.ParenTechApp?.syncState?.(); refreshProfile(); toast('Profile updated.');
            });
        }
        document.querySelectorAll('button.accordion-header-btn').forEach(button => {
            if (button.dataset.bound) return;
            button.dataset.bound = 'true';
            button.addEventListener('click', () => {
                const body = button.nextElementSibling;
                if (!body?.classList.contains('accordion-body-list')) return;
                const open = !body.classList.contains('open'); body.classList.toggle('open', open); button.setAttribute('aria-expanded', String(open));
                const chevron = button.querySelector('.chevron-icon'); if (chevron) chevron.style.transform = open ? 'rotate(180deg)' : '';
            });
        });
        bindAction('#editProfileBtn, [data-profile-edit]', editProfile);
        bindAction('[data-profile-theme]', () => { byId('profileThemeSelect')?.focus(); byId('profileThemeCard')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
        bindAction('[data-profile-notifications]', () => root.ParenTechApp?.showNotificationSettings?.());
        bindAction('[data-profile-privacy]', () => { refreshProfile(); openModal('profilePrivacyModal'); });
        const themeSelect = byId('profileThemeSelect');
        if (themeSelect && !themeSelect.dataset.bound) {
            themeSelect.dataset.bound = 'true';
            themeSelect.addEventListener('change', event => {
                try {
                    store.updateSettings({ theme: event.target.value });
                    root.ParenTechApp?.applyTheme?.(); root.ParenTechApp?.syncState?.(); refreshProfile();
                    toast('Theme preference saved.');
                } catch (error) { toast(error.message); refreshProfile(); }
            });
        }
        const choosePhotoBtn = byId('chooseProfilePhotoBtn');
        if (choosePhotoBtn && !choosePhotoBtn.dataset.bound) {
            choosePhotoBtn.dataset.bound = 'true';
            choosePhotoBtn.addEventListener('click', () => byId('profilePhotoInput')?.click());
        }
        const photoInput = byId('profilePhotoInput');
        if (photoInput && !photoInput.dataset.bound) {
            photoInput.dataset.bound = 'true';
            photoInput.addEventListener('change', event => {
                const file = event.target.files?.[0]; event.target.value = ''; previewPhoto(file);
            });
        }
        const confirmBtn = byId('confirmProfilePhotoBtn');
        if (confirmBtn && !confirmBtn.dataset.bound) {
            confirmBtn.dataset.bound = 'true';
            confirmBtn.addEventListener('click', confirmPhoto);
        }
        const previewModal = byId('profilePhotoPreviewModal');
        if (previewModal && !previewModal.dataset.bound) {
            previewModal.dataset.bound = 'true';
            previewModal.addEventListener('click', event => {
                if (event.target.closest('[data-action="close-modal"]') || event.target === event.currentTarget) { pendingPhoto = null; photoReadVersion++; invalidateModal(event.currentTarget); }
            });
        }
        const editModal = byId('editProfileModal');
        if (editModal && !editModal.dataset.bound) {
            editModal.dataset.bound = 'true';
            editModal.addEventListener('click', event => {
                if (event.target.closest('[data-action="close-modal"]') || event.target === event.currentTarget) invalidateModal(event.currentTarget);
            });
        }
        if (!keydownBound) {
            keydownBound = true;
            document.addEventListener('keydown', event => {
                if (event.key !== 'Escape') return;
                document.querySelectorAll('#editProfileModal.active, #profilePhotoPreviewModal.active').forEach(invalidateModal);
                pendingPhoto = null; photoReadVersion++;
            }, true);
        }
    }

    root.PTWebAuth = Object.freeze({ initLogin, initSignup, initProfile, refreshProfile, avatarSource });
})(window);

const state = {
  user: null,
  concerts: [],
  tourneurs: [],
  config: null,
  statusFilter: 'all',
  searchQuery: '',
  dateSort: 'asc',
  pollingId: null,
  editingConcertContacts: [],
  editingConcertDates: [],
  editingConcertUpdatedAt: null,
  editingStatuses: [],
  detailConcertId: null,
  hasCustomLogo: false,
};

const el = {
  loginView: document.getElementById('loginView'),
  dashboardView: document.getElementById('dashboardView'),
  loginForm: document.getElementById('loginForm'),
  loginError: document.getElementById('loginError'),
  loginMediaName: document.getElementById('loginMediaName'),
  loginLogoImg: document.getElementById('loginLogoImg'),
  loginLogoFallback: document.getElementById('loginLogoFallback'),
  headerLogoImg: document.getElementById('headerLogoImg'),
  headerLogoFallback: document.getElementById('headerLogoFallback'),
  headerMediaName: document.getElementById('headerMediaName'),
  currentUser: document.getElementById('currentUser'),
  logoutBtn: document.getElementById('logoutBtn'),
  tabs: Array.from(document.querySelectorAll('.tab')),
  concertsSection: document.getElementById('concertsSection'),
  jourSection: document.getElementById('jourSection'),
  tourneursSection: document.getElementById('tourneursSection'),
  settingsSection: document.getElementById('settingsSection'),
  configSection: document.getElementById('configSection'),
  statusFilter: document.getElementById('statusFilter'),
  concertSearch: document.getElementById('concertSearch'),
  dateSort: document.getElementById('dateSort'),
  concertRows: document.getElementById('concertRows'),
  jourRows: document.getElementById('jourRows'),
  tourneurRows: document.getElementById('tourneurRows'),
  lastSync: document.getElementById('lastSync'),
  addConcertBtn: document.getElementById('addConcertBtn'),
  addTourneurBtn: document.getElementById('addTourneurBtn'),
  concertDialog: document.getElementById('concertDialog'),
  concertDialogTitle: document.getElementById('concertDialogTitle'),
  concertForm: document.getElementById('concertForm'),
  concertError: document.getElementById('concertError'),
  concertStatus: document.getElementById('concertStatus'),
  concertTourneurSelect: document.getElementById('concertTourneurSelect'),
  contactsList: document.getElementById('contactsList'),
  datesList: document.getElementById('datesList'),
  addContactBtn: document.getElementById('addContactBtn'),
  addDateBtn: document.getElementById('addDateBtn'),
  cancelConcertBtn: document.getElementById('cancelConcertBtn'),
  concertDetailDialog: document.getElementById('concertDetailDialog'),
  detailTitle: document.getElementById('detailTitle'),
  detailMeta: document.getElementById('detailMeta'),
  detailDates: document.getElementById('detailDates'),
  detailContacts: document.getElementById('detailContacts'),
  detailNotes: document.getElementById('detailNotes'),
  detailPracticalNotes: document.getElementById('detailPracticalNotes'),
  detailHistory: document.getElementById('detailHistory'),
  exportPdfBtn: document.getElementById('exportPdfBtn'),
  closeDetailBtn: document.getElementById('closeDetailBtn'),
  tourneurDialog: document.getElementById('tourneurDialog'),
  tourneurDialogTitle: document.getElementById('tourneurDialogTitle'),
  tourneurForm: document.getElementById('tourneurForm'),
  tourneurError: document.getElementById('tourneurError'),
  cancelTourneurBtn: document.getElementById('cancelTourneurBtn'),
  userSettingsForm: document.getElementById('userSettingsForm'),
  userSettingsMessage: document.getElementById('userSettingsMessage'),
  globalConfigForm: document.getElementById('globalConfigForm'),
  globalConfigMessage: document.getElementById('globalConfigMessage'),
  statusList: document.getElementById('statusList'),
  addStatusBtn: document.getElementById('addStatusBtn'),
  logoFileInput: document.getElementById('logoFileInput'),
  uploadLogoBtn: document.getElementById('uploadLogoBtn'),
};

function escaped(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function fieldValue(form, name) {
  const field = form.elements.namedItem(name);
  return field ? field.value : '';
}

function setFieldValue(form, name, value) {
  const field = form.elements.namedItem(name);
  if (field) field.value = value;
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(path, {
    headers,
    ...options,
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const message = body?.error || 'Erreur serveur';
    throw new Error(message);
  }

  return body;
}

async function fetchPublicConfig() {
  try {
    const cfg = await api('/api/public-config');
    applyMediaName(cfg.mediaName || 'Rapstar');
    state.hasCustomLogo = Boolean(cfg.hasLogo);
    refreshLogo();
  } catch {
    applyMediaName('Rapstar');
    state.hasCustomLogo = false;
    refreshLogo();
  }
}

function applyMediaName(name) {
  const mediaName = String(name || 'Rapstar').trim() || 'Rapstar';
  el.loginMediaName.textContent = mediaName;
  el.headerMediaName.textContent = mediaName;
}

function refreshLogo() {
  if (!state.hasCustomLogo) {
    el.loginLogoImg.classList.add('hidden');
    el.headerLogoImg.classList.add('hidden');
    el.loginLogoFallback.classList.remove('hidden');
    el.headerLogoFallback.classList.remove('hidden');
    return;
  }

  const cacheBust = Date.now();
  const src = `/logo?t=${cacheBust}`;

  const attachLogo = (imgEl, fallbackEl) => {
    imgEl.onload = () => {
      imgEl.classList.remove('hidden');
      fallbackEl.classList.add('hidden');
    };
    imgEl.onerror = () => {
      imgEl.classList.add('hidden');
      fallbackEl.classList.remove('hidden');
    };
    imgEl.src = src;
  };

  attachLogo(el.loginLogoImg, el.loginLogoFallback);
  attachLogo(el.headerLogoImg, el.headerLogoFallback);
}

function renderStatusOptions() {
  const statuses = state.config?.statuses || [];
  const currentFormStatus = fieldValue(el.concertForm, 'status');
  const currentFilterStatus = state.statusFilter;
  const options = statuses
    .map((entry) => `<option value="${entry.id}">${escaped(entry.emoji)} ${escaped(entry.label)}</option>`)
    .join('');

  el.concertStatus.innerHTML = options;
  el.statusFilter.innerHTML = `<option value="all">Tous les statuts</option>${options}`;

  if (currentFormStatus && statuses.some((entry) => entry.id === currentFormStatus)) {
    setFieldValue(el.concertForm, 'status', currentFormStatus);
  }

  if (currentFilterStatus === 'all') {
    state.statusFilter = 'all';
    el.statusFilter.value = 'all';
  } else if (statuses.some((entry) => entry.id === currentFilterStatus)) {
    state.statusFilter = currentFilterStatus;
    el.statusFilter.value = currentFilterStatus;
  } else {
    state.statusFilter = 'all';
    el.statusFilter.value = 'all';
  }
}

function formatDate(dateString) {
  if (!dateString) return '-';
  return new Date(`${dateString}T00:00:00`).toLocaleDateString('fr-FR');
}

function renderConcerts() {
  const filtered = state.concerts
    .filter((concert) => (state.statusFilter === 'all' ? true : concert.status === state.statusFilter))
    .filter((concert) => {
      if (!state.searchQuery.trim()) return true;
      const q = state.searchQuery.toLowerCase();
      const inContacts = (concert.contacts || []).some((contact) =>
        `${contact.name || ''} ${contact.role || ''} ${contact.email || ''}`.toLowerCase().includes(q)
      );
      const haystack = `${concert.artist || ''} ${concert.venue || ''} ${concert.city || ''} ${concert.notes || ''} ${concert.practicalNotes || ''}`.toLowerCase();
      return haystack.includes(q) || inContacts;
    })
    .sort((a, b) => {
      const aDone = a.status === 'terminee';
      const bDone = b.status === 'terminee';
      if (aDone !== bDone) return aDone ? 1 : -1;
      const order = state.dateSort === 'asc' ? 1 : -1;
      return order * String(a.closestDate || '').localeCompare(String(b.closestDate || ''));
    });

  if (!filtered.length) {
    el.concertRows.innerHTML = '<tr><td colspan="9">Aucun concert</td></tr>';
    return;
  }

  el.concertRows.innerHTML = filtered
    .map((concert) => {
      const status = concert.statusMeta || { label: concert.status || '-', emoji: '' };
      const urgency = concert.urgency || { label: 'N/A', cssClass: '' };
      const contactWhoResponded = (concert.contacts || [])
        .find((contact) => contact.responded)
        ?.name?.trim() || '-';

      return `
        <tr>
          <td>${escaped(concert.artist)}</td>
          <td>${escaped(concert.dateSummary || '-')}</td>
          <td>${escaped(concert.venue)}</td>
          <td>${escaped(concert.city)}</td>
          <td><span class="badge status-${escaped(concert.status)}">${escaped(`${status.emoji || ''} ${status.label}`.trim())}</span></td>
          <td><span class="badge ${escaped(urgency.cssClass || '')}">${escaped(urgency.label || 'N/A')}</span></td>
          <td>${escaped(contactWhoResponded)}</td>
          <td>${escaped(concert.notes || '-')}</td>
          <td>
            <div class="actions">
              <button class="ghost" data-action="open-detail" data-id="${concert.id}">Fiche</button>
              <button class="ghost" data-action="edit-concert" data-id="${concert.id}">Modifier</button>
              <button class="ghost" data-action="delete-concert" data-id="${concert.id}">Supprimer</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

function renderJourMode() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const inTwoDays = new Date(today);
  inTwoDays.setDate(inTwoDays.getDate() + 2);

  const rows = state.concerts
    .map((concert) => {
      const candidateDates = (concert.dates && concert.dates.length ? concert.dates : [concert.closestDate || concert.date])
        .filter(Boolean)
        .map((value) => new Date(`${value}T00:00:00`))
        .filter((date) => !Number.isNaN(date.getTime()));

      const upcomingInWindow = candidateDates
        .filter((date) => date >= today && date <= inTwoDays)
        .sort((a, b) => a.getTime() - b.getTime());

      return {
        ...concert,
        jourDate: upcomingInWindow[0] || null,
      };
    })
    .filter((concert) => Boolean(concert.jourDate))
    .sort((a, b) => a.jourDate.getTime() - b.jourDate.getTime());

  const activeRows = rows.filter((concert) => concert.status !== 'terminee');
  const doneRows = rows.filter((concert) => concert.status === 'terminee');

  if (!rows.length) {
    el.jourRows.innerHTML = '<div class="jour-card">Aucun concert prioritaire sur les 48 prochaines heures.</div>';
    return;
  }

  const cardMarkup = (concert) => {
    const mainContact = (concert.contacts || []).find((contact) => contact.responded) || (concert.contacts || [])[0];
    return `
      <article class="jour-card${concert.status === 'terminee' ? ' done' : ''}">
        <h3>${escaped(concert.artist)}</h3>
        <p>${escaped(formatDate(concert.jourDate.toISOString().slice(0, 10)))} - ${escaped(concert.venue)} (${escaped(concert.city)})</p>
        <p><strong>Urgence:</strong> ${escaped(concert.urgency?.label || 'N/A')}</p>
        <p><strong>Contact:</strong> ${escaped(mainContact?.name || '-')} ${mainContact?.email ? `(${escaped(mainContact.email)})` : ''}</p>
        <p><strong>Notes pratiques:</strong> ${escaped(concert.practicalNotes || '-')}</p>
        <div class="actions">
          <button class="ghost" data-action="open-detail" data-id="${concert.id}">Ouvrir fiche</button>
        </div>
      </article>
    `;
  };

  el.jourRows.innerHTML = `
    <div class="jour-group">
      <h3>A couvrir</h3>
      <div class="jour-subgrid">${activeRows.length ? activeRows.map(cardMarkup).join('') : '<div class="jour-card">Aucun concert actif sur cette fenetre.</div>'}</div>
    </div>
    <div class="jour-group">
      <h3>Termines (jour J)</h3>
      <div class="jour-subgrid">${doneRows.length ? doneRows.map(cardMarkup).join('') : '<div class="jour-card">Aucun concert termine sur cette fenetre.</div>'}</div>
    </div>
  `;
}

function renderTourneurs() {
  const currentLinkedTourneur = fieldValue(el.concertForm, 'linkedTourneurId');

  if (!state.tourneurs.length) {
    el.tourneurRows.innerHTML = '<tr><td colspan="4">Aucun tourneur</td></tr>';
  } else {
    el.tourneurRows.innerHTML = state.tourneurs
      .map(
        (tourneur) => `
      <tr>
        <td>${escaped(tourneur.name)}</td>
        <td>${escaped((tourneur.emails || []).join(', ') || '-')}</td>
        <td>${escaped((tourneur.artists || []).join(', ') || '-')}</td>
        <td>
          <div class="actions">
            <button class="ghost" data-action="edit-tourneur" data-id="${tourneur.id}">Modifier</button>
            <button class="ghost" data-action="delete-tourneur" data-id="${tourneur.id}">Supprimer</button>
          </div>
        </td>
      </tr>
    `
      )
      .join('');
  }

  const options = [
    '<option value="">Aucun</option>',
    ...state.tourneurs.map((tourneur) => `<option value="${tourneur.id}">${escaped(tourneur.name)}</option>`),
  ];
  el.concertTourneurSelect.innerHTML = options.join('');

  if (currentLinkedTourneur && state.tourneurs.some((tourneur) => tourneur.id === currentLinkedTourneur)) {
    setFieldValue(el.concertForm, 'linkedTourneurId', currentLinkedTourneur);
  }
}

function renderDatesEditor() {
  if (!state.editingConcertDates.length) {
    el.datesList.innerHTML = '<p class="hint">Aucune date cible</p>';
    return;
  }

  el.datesList.innerHTML = state.editingConcertDates
    .map(
      (dateValue, idx) => `
      <div class="date-card" data-index="${idx}">
        <div class="actions">
          <input type="date" data-date-input="value" value="${escaped(dateValue)}" required />
          <button type="button" class="ghost" data-action="remove-date" data-index="${idx}">Supprimer</button>
        </div>
      </div>
    `
    )
    .join('');
}

function renderStatusEditor() {
  if (!state.editingStatuses.length) {
    el.statusList.innerHTML = '<p class="hint">Aucun statut configure</p>';
    return;
  }

  el.statusList.innerHTML = state.editingStatuses
    .map(
      (status, idx) => `
      <div class="status-card" data-index="${idx}">
        <div class="status-grid">
          <label>
            Emoji
            <input data-status-input="emoji" value="${escaped(status.emoji)}" />
          </label>
          <label>
            Label
            <input data-status-input="label" value="${escaped(status.label)}" />
          </label>
          <label>
            ID
            <input data-status-input="id" value="${escaped(status.id)}" />
          </label>
          <div>
            <button type="button" class="ghost" data-action="remove-status" data-index="${idx}">Supprimer</button>
          </div>
        </div>
      </div>
    `
    )
    .join('');
}

function updateLastSync() {
  const now = new Date();
  el.lastSync.textContent = `Derniere synchro: ${now.toLocaleTimeString('fr-FR')}`;
}

function switchView(view) {
  el.tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.view === view));
  el.concertsSection.classList.toggle('active', view === 'concerts');
  el.jourSection.classList.toggle('active', view === 'jour');
  el.tourneursSection.classList.toggle('active', view === 'tourneurs');
  el.settingsSection.classList.toggle('active', view === 'settings');
  el.configSection.classList.toggle('active', view === 'config');
}

function openConcertDialog(concert = null) {
  el.concertError.textContent = '';
  state.editingConcertContacts = concert?.contacts?.map((contact) => ({ ...contact })) || [];
  state.editingConcertDates = (concert?.dates || []).slice();
  state.editingConcertUpdatedAt = concert?.updatedAt || null;
  if (!state.editingConcertDates.length) state.editingConcertDates = [''];
  el.concertDialogTitle.textContent = concert ? 'Modifier un concert' : 'Ajouter un concert';

  setFieldValue(el.concertForm, 'id', concert?.id || '');
  setFieldValue(el.concertForm, 'artist', concert?.artist || '');
  setFieldValue(el.concertForm, 'venue', concert?.venue || '');
  setFieldValue(el.concertForm, 'city', concert?.city || '');
  setFieldValue(el.concertForm, 'status', concert?.status || state.config?.statuses?.[0]?.id || '');
  setFieldValue(el.concertForm, 'notes', concert?.notes || '');
  setFieldValue(el.concertForm, 'practicalNotes', concert?.practicalNotes || '');
  setFieldValue(el.concertForm, 'linkedTourneurId', concert?.linkedTourneurId || '');

  renderDatesEditor();
  renderContactsEditor();
  el.concertDialog.showModal();
}

function openConcertDetail(concert) {
  state.detailConcertId = concert.id;
  const status = concert.statusMeta || { label: concert.status || '-', emoji: '' };
  const linkedTourneur = state.tourneurs.find((entry) => entry.id === concert.linkedTourneurId);

  el.detailTitle.textContent = `Fiche concert - ${concert.artist}`;
  el.detailMeta.textContent = `${concert.venue}, ${concert.city} | ${status.emoji ? `${status.emoji} ` : ''}${status.label} | Tourneur: ${linkedTourneur ? linkedTourneur.name : 'Aucun'}`;
  el.detailDates.innerHTML = (concert.dates || []).map((date) => `<li>${escaped(formatDate(date))} (${escaped(date)})</li>`).join('');
  el.detailContacts.innerHTML = (concert.contacts || []).length
    ? (concert.contacts || [])
        .map(
          (contact) =>
            `<li>${escaped(contact.name || '-')} | ${escaped(contact.role || '-')} | ${escaped(contact.email || '-')} | Reponse: ${contact.responded ? 'Oui' : 'Non'}</li>`
        )
        .join('')
    : '<li>Aucun contact</li>';
  el.detailNotes.textContent = concert.notes || '-';
  el.detailPracticalNotes.textContent = concert.practicalNotes || '-';
  el.detailHistory.innerHTML = (concert.history || []).length
    ? [...(concert.history || [])]
        .reverse()
        .slice(0, 25)
        .map((item) => `<li>${escaped(new Date(item.at).toLocaleString('fr-FR'))} - ${escaped(item.by || 'system')} - ${escaped(item.details || item.action || '')}</li>`)
        .join('')
    : '<li>Aucun historique</li>';
  el.concertDetailDialog.showModal();
}

function renderContactsEditor() {
  if (!state.editingConcertContacts.length) {
    el.contactsList.innerHTML = '<p class="hint">Aucun contact pour ce concert</p>';
    return;
  }

  el.contactsList.innerHTML = state.editingConcertContacts
    .map(
      (contact, idx) => `
      <div class="contact-card" data-index="${idx}">
        <div class="contact-grid">
          <label>
            Nom
            <input data-contact-input="name" value="${escaped(contact.name)}" />
          </label>
          <label>
            Role
            <input data-contact-input="role" value="${escaped(contact.role)}" />
          </label>
          <label>
            Email
            <input data-contact-input="email" type="email" value="${escaped(contact.email)}" />
          </label>
          <div>
            <button type="button" class="ghost" data-action="remove-contact" data-index="${idx}">Supprimer</button>
          </div>
        </div>
        <label class="contact-responded">
          <input type="checkbox" data-contact-input="responded" ${contact.responded ? 'checked' : ''} />
          A repondu
        </label>
      </div>
    `
    )
    .join('');
}

function collectConcertPayload() {
  return {
    artist: fieldValue(el.concertForm, 'artist').trim(),
    dates: state.editingConcertDates.map((date) => String(date || '').trim()).filter(Boolean),
    venue: fieldValue(el.concertForm, 'venue').trim(),
    city: fieldValue(el.concertForm, 'city').trim(),
    status: fieldValue(el.concertForm, 'status'),
    notes: fieldValue(el.concertForm, 'notes').trim(),
    practicalNotes: fieldValue(el.concertForm, 'practicalNotes').trim(),
    baseUpdatedAt: state.editingConcertUpdatedAt,
    linkedTourneurId: fieldValue(el.concertForm, 'linkedTourneurId') || null,
    contacts: state.editingConcertContacts.map((contact) => ({
      id: contact.id || '',
      name: String(contact.name || '').trim(),
      role: String(contact.role || '').trim(),
      email: String(contact.email || '').trim(),
      responded: Boolean(contact.responded),
    })),
  };
}

function fillSettingsForms() {
  if (!state.user || !state.config) return;
  setFieldValue(el.userSettingsForm, 'email', state.user.email);
  setFieldValue(el.globalConfigForm, 'mediaName', state.config.mediaName || 'Rapstar');
  setFieldValue(el.globalConfigForm, 'urgencyRedDays', state.config.urgencyRedDays);
  setFieldValue(el.globalConfigForm, 'urgencyYellowDays', state.config.urgencyYellowDays);
  state.editingStatuses = (state.config.statuses || []).map((entry) => ({ ...entry }));
  renderStatusEditor();
}

async function refreshData() {
  const [concerts, tourneurs, config] = await Promise.all([
    api('/api/concerts'),
    api('/api/tourneurs'),
    api('/api/config'),
  ]);
  state.concerts = concerts;
  state.tourneurs = tourneurs;
  state.config = config;
  state.hasCustomLogo = Boolean(config.logo?.filename);
  applyMediaName(config.mediaName);
  refreshLogo();
  renderStatusOptions();
  fillSettingsForms();
  renderConcerts();
  renderJourMode();
  renderTourneurs();
  updateLastSync();
}

function startPolling() {
  if (state.pollingId) {
    clearInterval(state.pollingId);
  }

  state.pollingId = setInterval(async () => {
    try {
      await refreshData();
    } catch {
      // Le prochain cycle de polling reessaiera automatiquement.
    }
  }, 10000);
}

async function onLoginSubmit(event) {
  event.preventDefault();
  el.loginError.textContent = '';

  const formData = new FormData(el.loginForm);
  const payload = {
    email: String(formData.get('email') || '').trim(),
    password: String(formData.get('password') || ''),
  };

  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    state.user = data.user;
    el.currentUser.textContent = data.user.email;
    el.loginView.classList.remove('active');
    el.dashboardView.classList.add('active');
    await refreshData();
    startPolling();
  } catch (error) {
    el.loginError.textContent = error.message;
  }
}

async function logout() {
  await api('/api/auth/logout', { method: 'POST' });
  state.user = null;
  clearInterval(state.pollingId);
  state.pollingId = null;
  el.dashboardView.classList.remove('active');
  el.loginView.classList.add('active');
  el.loginForm.reset();
  await fetchPublicConfig();
}

async function ensureSession() {
  const data = await api('/api/auth/me');
  if (data.authenticated && data.user) {
    state.user = data.user;
    el.currentUser.textContent = data.user.email;
    el.loginView.classList.remove('active');
    el.dashboardView.classList.add('active');
    await refreshData();
    startPolling();
  } else {
    el.loginView.classList.add('active');
    el.dashboardView.classList.remove('active');
    await fetchPublicConfig();
  }
}

el.loginForm.addEventListener('submit', onLoginSubmit);
el.logoutBtn.addEventListener('click', logout);

el.tabs.forEach((tab) => {
  tab.addEventListener('click', () => switchView(tab.dataset.view));
});

el.statusFilter.addEventListener('change', () => {
  state.statusFilter = el.statusFilter.value;
  renderConcerts();
});

el.dateSort.addEventListener('change', () => {
  state.dateSort = el.dateSort.value;
  renderConcerts();
});

el.concertSearch.addEventListener('input', () => {
  state.searchQuery = String(el.concertSearch.value || '');
  renderConcerts();
});

el.addConcertBtn.addEventListener('click', () => openConcertDialog());
el.cancelConcertBtn.addEventListener('click', () => el.concertDialog.close());

el.addContactBtn.addEventListener('click', () => {
  if (state.editingConcertContacts.length >= 10) {
    el.concertError.textContent = 'Maximum 10 contacts par concert';
    return;
  }

  el.concertError.textContent = '';
  state.editingConcertContacts.push({ id: '', name: '', role: '', email: '', responded: false });
  renderContactsEditor();
});

el.addDateBtn.addEventListener('click', () => {
  state.editingConcertDates.push('');
  renderDatesEditor();
});

el.datesList.addEventListener('input', (event) => {
  const target = event.target;
  const card = target.closest('.date-card');
  if (!card) return;
  const index = Number(card.dataset.index);
  if (!Number.isInteger(index)) return;
  state.editingConcertDates[index] = target.value;
});

el.datesList.addEventListener('click', (event) => {
  const target = event.target;
  if (target.dataset.action !== 'remove-date') return;
  const index = Number(target.dataset.index);
  if (!Number.isInteger(index)) return;
  state.editingConcertDates.splice(index, 1);
  if (!state.editingConcertDates.length) state.editingConcertDates.push('');
  renderDatesEditor();
});

el.contactsList.addEventListener('input', (event) => {
  const target = event.target;
  const card = target.closest('.contact-card');
  if (!card) return;

  const index = Number(card.dataset.index);
  const field = target.dataset.contactInput;
  if (!Number.isInteger(index) || !field) return;

  if (field === 'responded') {
    state.editingConcertContacts[index][field] = target.checked;
  } else {
    state.editingConcertContacts[index][field] = target.value;
  }
});

el.contactsList.addEventListener('click', (event) => {
  const target = event.target;
  if (target.dataset.action !== 'remove-contact') return;
  const index = Number(target.dataset.index);
  if (!Number.isInteger(index)) return;

  state.editingConcertContacts.splice(index, 1);
  renderContactsEditor();
});

el.concertForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  el.concertError.textContent = '';

  const payload = collectConcertPayload();
  const concertId = fieldValue(el.concertForm, 'id');

  if (!payload.dates.length) {
    el.concertError.textContent = 'Ajoute au moins une date visee';
    return;
  }

  try {
    if (concertId) {
      await api(`/api/concerts/${concertId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } else {
      await api('/api/concerts', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }

    el.concertDialog.close();
    await refreshData();
  } catch (error) {
    if (String(error.message || '').includes('modifie par un autre utilisateur')) {
      el.concertError.textContent = `${error.message} Le formulaire va etre rafraichi.`;
      await refreshData();
    } else {
      el.concertError.textContent = error.message;
    }
  }
});

el.concertRows.addEventListener('click', async (event) => {
  const target = event.target;
  const action = target.dataset.action;
  const id = target.dataset.id;
  if (!action || !id) return;

  const concert = state.concerts.find((item) => item.id === id);
  if (action === 'open-detail' && concert) {
    openConcertDetail(concert);
    return;
  }

  if (action === 'edit-concert' && concert) {
    openConcertDialog(concert);
    return;
  }

  if (action === 'delete-concert') {
    const confirmDelete = window.confirm('Supprimer ce concert ?');
    if (!confirmDelete) return;
    await api(`/api/concerts/${id}`, { method: 'DELETE' });
    await refreshData();
  }
});

el.jourRows.addEventListener('click', (event) => {
  const target = event.target;
  if (target.dataset.action !== 'open-detail') return;
  const id = target.dataset.id;
  if (!id) return;
  const concert = state.concerts.find((item) => item.id === id);
  if (concert) openConcertDetail(concert);
});

el.closeDetailBtn.addEventListener('click', () => el.concertDetailDialog.close());
el.exportPdfBtn.addEventListener('click', () => {
  if (!state.detailConcertId) return;
  window.location.href = `/api/concerts/${state.detailConcertId}/pdf`;
});

el.addTourneurBtn.addEventListener('click', () => {
  el.tourneurError.textContent = '';
  el.tourneurDialogTitle.textContent = 'Ajouter un tourneur';
  el.tourneurForm.reset();
  setFieldValue(el.tourneurForm, 'id', '');
  el.tourneurDialog.showModal();
});

el.cancelTourneurBtn.addEventListener('click', () => el.tourneurDialog.close());

el.tourneurRows.addEventListener('click', async (event) => {
  const target = event.target;
  const action = target.dataset.action;
  const id = target.dataset.id;
  if (!action || !id) return;

  const tourneur = state.tourneurs.find((item) => item.id === id);

  if (action === 'edit-tourneur' && tourneur) {
    el.tourneurError.textContent = '';
    el.tourneurDialogTitle.textContent = 'Modifier un tourneur';
    setFieldValue(el.tourneurForm, 'id', tourneur.id);
    setFieldValue(el.tourneurForm, 'name', tourneur.name || '');
    setFieldValue(el.tourneurForm, 'emails', (tourneur.emails || []).join(', '));
    setFieldValue(el.tourneurForm, 'artists', (tourneur.artists || []).join(', '));
    el.tourneurDialog.showModal();
    return;
  }

  if (action === 'delete-tourneur') {
    const confirmDelete = window.confirm('Supprimer ce tourneur ?');
    if (!confirmDelete) return;
    await api(`/api/tourneurs/${id}`, { method: 'DELETE' });
    await refreshData();
  }
});

el.tourneurForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  el.tourneurError.textContent = '';

  const payload = {
    name: fieldValue(el.tourneurForm, 'name').trim(),
    emails: fieldValue(el.tourneurForm, 'emails').trim(),
    artists: fieldValue(el.tourneurForm, 'artists').trim(),
  };

  const id = fieldValue(el.tourneurForm, 'id');

  try {
    if (id) {
      await api(`/api/tourneurs/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await api('/api/tourneurs', { method: 'POST', body: JSON.stringify(payload) });
    }

    el.tourneurDialog.close();
    await refreshData();
  } catch (error) {
    el.tourneurError.textContent = error.message;
  }
});

el.userSettingsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  el.userSettingsMessage.classList.remove('error');
  el.userSettingsMessage.textContent = '';

  const email = fieldValue(el.userSettingsForm, 'email').trim();
  const currentPassword = fieldValue(el.userSettingsForm, 'currentPassword');
  const newPassword = fieldValue(el.userSettingsForm, 'newPassword');
  const confirmPassword = fieldValue(el.userSettingsForm, 'confirmPassword');

  if (newPassword && newPassword !== confirmPassword) {
    el.userSettingsMessage.classList.add('error');
    el.userSettingsMessage.textContent = 'La confirmation du nouveau mot de passe ne correspond pas';
    return;
  }

  if (newPassword) {
    el.userSettingsMessage.classList.add('error');
    el.userSettingsMessage.textContent = 'Le mot de passe se modifie dans le fichier .env';
    return;
  }

  try {
    const updated = await api('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ email, currentPassword }),
    });
    state.user = updated.user;
    el.currentUser.textContent = updated.user.email;
    setFieldValue(el.userSettingsForm, 'currentPassword', '');
    setFieldValue(el.userSettingsForm, 'newPassword', '');
    setFieldValue(el.userSettingsForm, 'confirmPassword', '');
    el.userSettingsMessage.textContent = 'Parametres utilisateur enregistres';
  } catch (error) {
    el.userSettingsMessage.classList.add('error');
    el.userSettingsMessage.textContent = error.message;
  }
});

el.addStatusBtn.addEventListener('click', () => {
  state.editingStatuses.push({ id: `status_${Date.now()}`, emoji: '', label: '' });
  renderStatusEditor();
});

el.statusList.addEventListener('input', (event) => {
  const target = event.target;
  const card = target.closest('.status-card');
  if (!card) return;
  const index = Number(card.dataset.index);
  const field = target.dataset.statusInput;
  if (!Number.isInteger(index) || !field) return;
  state.editingStatuses[index][field] = target.value;
});

el.statusList.addEventListener('click', (event) => {
  const target = event.target;
  if (target.dataset.action !== 'remove-status') return;
  const index = Number(target.dataset.index);
  if (!Number.isInteger(index)) return;
  state.editingStatuses.splice(index, 1);
  renderStatusEditor();
});

el.globalConfigForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  el.globalConfigMessage.classList.remove('error');
  el.globalConfigMessage.textContent = '';

  const payload = {
    mediaName: fieldValue(el.globalConfigForm, 'mediaName').trim(),
    urgencyRedDays: Number(fieldValue(el.globalConfigForm, 'urgencyRedDays')),
    urgencyYellowDays: Number(fieldValue(el.globalConfigForm, 'urgencyYellowDays')),
    statuses: state.editingStatuses,
  };

  try {
    const config = await api('/api/config', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    state.config = config;
    applyMediaName(config.mediaName);
    renderStatusOptions();
    el.globalConfigMessage.textContent = 'Configuration enregistree';
    await refreshData();
  } catch (error) {
    el.globalConfigMessage.classList.add('error');
    el.globalConfigMessage.textContent = error.message;
  }
});

el.uploadLogoBtn.addEventListener('click', async () => {
  el.globalConfigMessage.classList.remove('error');
  el.globalConfigMessage.textContent = '';

  const file = el.logoFileInput.files?.[0];
  if (!file) {
    el.globalConfigMessage.classList.add('error');
    el.globalConfigMessage.textContent = 'Selectionne un fichier logo';
    return;
  }

  const formData = new FormData();
  formData.append('logo', file);

  try {
    const config = await api('/api/config/logo', {
      method: 'POST',
      body: formData,
    });
    state.config = config;
    refreshLogo();
    el.globalConfigMessage.textContent = 'Logo mis a jour';
  } catch (error) {
    el.globalConfigMessage.classList.add('error');
    el.globalConfigMessage.textContent = error.message;
  }
});

fetchPublicConfig();
ensureSession();

document.addEventListener('keydown', (event) => {
  const target = event.target;
  const tag = target?.tagName?.toLowerCase();
  const isTyping = tag === 'input' || tag === 'textarea' || target?.isContentEditable;

  if (event.key === '/' && !isTyping) {
    event.preventDefault();
    el.concertSearch.focus();
    return;
  }

  if ((event.key === 'n' || event.key === 'N') && !isTyping && state.user) {
    event.preventDefault();
    openConcertDialog();
    return;
  }

  if ((event.key === 'g' || event.key === 'G') && !isTyping && state.user) {
    event.preventDefault();
    switchView('jour');
    return;
  }

  if ((event.ctrlKey || event.metaKey) && (event.key === 's' || event.key === 'S')) {
    if (el.concertDialog.open) {
      event.preventDefault();
      el.concertForm.requestSubmit();
    }
  }
});

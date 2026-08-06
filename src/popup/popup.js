import { getDueFollowUps, formatDueLabel, computeFollowUpDate, FOLLOWUP_PRESETS } from '../lib/followupScheduler.js';

const els = {
  list: document.getElementById('contact-list'),
  emptyState: document.getElementById('empty-state'),
  listView: document.getElementById('list-view'),
  detailView: document.getElementById('detail-view'),
  detailContent: document.getElementById('detail-content'),
  backBtn: document.getElementById('back-btn'),
  addManualBtn: document.getElementById('add-manual-btn'),
  search: document.getElementById('search-input'),
  tabFollowups: document.getElementById('tab-followups'),
  tabAll: document.getElementById('tab-all'),
  followupCount: document.getElementById('followup-count'),
  syncBtn: document.getElementById('sync-gmail-btn'),
  status: document.getElementById('status-line')
};

const state = {
  contacts: [],
  activeTab: 'followups',
  query: ''
};

function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => resolve(response));
  });
}

function setStatus(text) {
  els.status.textContent = text;
  if (text) setTimeout(() => { if (els.status.textContent === text) els.status.textContent = ''; }, 2500);
}

async function refreshContacts() {
  const response = await sendMessage({ type: 'LIST_CONTACTS' });
  state.contacts = response && response.ok ? response.contacts : [];
  render();
}

function matchesQuery(contact, query) {
  if (!query) return true;
  const haystack = `${contact.name || ''} ${contact.headline || ''} ${contact.email || ''}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function visibleContacts() {
  const filtered = state.contacts.filter((c) => matchesQuery(c, state.query));
  if (state.activeTab === 'followups') {
    return getDueFollowUps(filtered);
  }
  return [...filtered].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function renderContactCard(contact) {
  const li = document.createElement('li');
  li.className = 'contact-card';
  li.dataset.id = contact.id;

  const top = document.createElement('div');
  top.className = 'contact-card__top';

  const name = document.createElement('span');
  name.className = 'contact-card__name';
  name.textContent = contact.name || '(no name)';
  top.appendChild(name);

  if (contact.followUp && contact.followUp.dueAt && !contact.followUp.completed) {
    const due = document.createElement('span');
    const label = formatDueLabel(contact.followUp.dueAt);
    due.className = 'contact-card__due' + (label.startsWith('Overdue') ? ' contact-card__due--overdue' : '');
    due.textContent = label;
    top.appendChild(due);
  }

  li.appendChild(top);

  if (contact.headline) {
    const headline = document.createElement('div');
    headline.className = 'contact-card__headline';
    headline.textContent = contact.headline;
    li.appendChild(headline);
  }

  li.addEventListener('click', () => openDetail(contact.id));
  return li;
}

function render() {
  const contacts = visibleContacts();
  els.list.innerHTML = '';
  contacts.forEach((c) => els.list.appendChild(renderContactCard(c)));

  const noResults = contacts.length === 0;
  els.emptyState.hidden = !(noResults && state.activeTab === 'all' && !state.query);
  els.list.hidden = noResults;

  const dueCount = getDueFollowUps(state.contacts).length;
  els.followupCount.textContent = dueCount > 0 ? String(dueCount) : '';
}

function switchTab(tab) {
  state.activeTab = tab;
  els.tabFollowups.classList.toggle('tab--active', tab === 'followups');
  els.tabAll.classList.toggle('tab--active', tab === 'all');
  render();
}

function showListView() {
  els.detailView.hidden = true;
  els.listView.hidden = false;
  els.addManualBtn.hidden = false;
}

function showDetailView() {
  els.detailView.hidden = false;
  els.listView.hidden = true;
  els.addManualBtn.hidden = true;
}

function presetOptionsHtml() {
  return Object.entries(FOLLOWUP_PRESETS)
    .map(([, days]) => `<option value="${days}">In ${days} day${days === 1 ? '' : 's'}</option>`)
    .join('');
}

function renderDetail(contact) {
  const notesHtml = (contact.notes || [])
    .slice()
    .reverse()
    .map((n) => `<div class="note-item"><time>${new Date(n.createdAt).toLocaleString()}</time>${escapeHtml(n.text)}</div>`)
    .join('') || '<p class="contact-card__headline">No notes yet.</p>';

  const followUpStatus =
    contact.followUp && contact.followUp.dueAt && !contact.followUp.completed
      ? `<p class="contact-card__due${formatDueLabel(contact.followUp.dueAt).startsWith('Overdue') ? ' contact-card__due--overdue' : ''}">${formatDueLabel(
          contact.followUp.dueAt
        )}${contact.followUp.note ? ' — ' + escapeHtml(contact.followUp.note) : ''}</p>`
      : '<p class="contact-card__headline">No follow-up set.</p>';

  els.detailContent.innerHTML = `
    <h2 class="detail-name">${escapeHtml(contact.name || '(no name)')}</h2>
    <p class="detail-headline">${escapeHtml(contact.headline || '')}</p>

    <div class="detail-section">
      <h2>Email</h2>
      <input id="email-input" type="email" placeholder="name@example.com" value="${escapeHtml(contact.email || '')}" />
    </div>

    <div class="detail-section">
      <h2>Follow-up</h2>
      ${followUpStatus}
      <div class="field-row">
        <select id="followup-select">${presetOptionsHtml()}</select>
        <button id="set-followup-btn" class="primary-btn">Set</button>
      </div>
      ${contact.followUp && !contact.followUp.completed ? '<div class="field-row"><button id="complete-followup-btn" class="secondary-btn" style="margin:6px 0 0;flex:1">Mark done</button></div>' : ''}
    </div>

    <div class="detail-section">
      <h2>Notes</h2>
      <textarea id="note-input" placeholder="What did you talk about?"></textarea>
      <div class="field-row">
        <button id="add-note-btn" class="primary-btn">Add note</button>
      </div>
      ${notesHtml}
    </div>

    <button id="delete-contact-btn" class="danger-link">Delete contact</button>
  `;

  document.getElementById('email-input').addEventListener('change', async (e) => {
    const email = e.target.value.trim();
    if (!email) return;
    await sendMessage({ type: 'UPDATE_CONTACT_EMAIL', linkedinSlug: contact.linkedinSlug, email });
    setStatus('Email saved');
    await refreshContacts();
  });

  document.getElementById('set-followup-btn').addEventListener('click', async () => {
    const days = Number(document.getElementById('followup-select').value);
    const dueAt = computeFollowUpDate(new Date(), days);
    await sendMessage({ type: 'SET_FOLLOWUP', contactId: contact.id, dueAt, note: null });
    setStatus('Follow-up set');
    await refreshContacts();
    const updated = state.contacts.find((c) => c.id === contact.id);
    if (updated) renderDetail(updated);
  });

  const completeBtn = document.getElementById('complete-followup-btn');
  if (completeBtn) {
    completeBtn.addEventListener('click', async () => {
      await sendMessage({ type: 'COMPLETE_FOLLOWUP', contactId: contact.id });
      setStatus('Marked done');
      await refreshContacts();
      const updated = state.contacts.find((c) => c.id === contact.id);
      if (updated) renderDetail(updated);
    });
  }

  document.getElementById('add-note-btn').addEventListener('click', async () => {
    const input = document.getElementById('note-input');
    if (!input.value.trim()) return;
    await sendMessage({ type: 'ADD_NOTE', contactId: contact.id, text: input.value });
    input.value = '';
    setStatus('Note added');
    await refreshContacts();
    const updated = state.contacts.find((c) => c.id === contact.id);
    if (updated) renderDetail(updated);
  });

  document.getElementById('delete-contact-btn').addEventListener('click', async () => {
    if (!confirm(`Delete ${contact.name || 'this contact'}? This can't be undone.`)) return;
    await sendMessage({ type: 'DELETE_CONTACT', contactId: contact.id });
    setStatus('Contact deleted');
    await refreshContacts();
    showListView();
  });
}

async function openDetail(id) {
  const contact = state.contacts.find((c) => c.id === id);
  if (!contact) return;
  showDetailView();
  renderDetail(contact);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

els.backBtn.addEventListener('click', () => {
  showListView();
  render();
});

els.tabFollowups.addEventListener('click', () => switchTab('followups'));
els.tabAll.addEventListener('click', () => switchTab('all'));

els.search.addEventListener('input', (e) => {
  state.query = e.target.value;
  render();
});

els.addManualBtn.addEventListener('click', async () => {
  const name = prompt('Contact name?');
  if (!name || !name.trim()) return;
  const response = await sendMessage({
    type: 'CAPTURE_CONTACT',
    payload: { name: name.trim(), headline: null, slug: null, profileUrl: null }
  });
  if (response && response.ok) {
    setStatus('Contact added');
    await refreshContacts();
  }
});

els.syncBtn.addEventListener('click', async () => {
  setStatus('Syncing Gmail...');
  const response = await sendMessage({ type: 'SYNC_GMAIL_NOW' });
  if (response && response.ok) {
    const { linked, error } = response.result;
    setStatus(error ? 'Connect Gmail in Settings first' : `Linked ${linked} email${linked === 1 ? '' : 's'}`);
  } else {
    setStatus('Sync failed');
  }
});

refreshContacts();

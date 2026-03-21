const express = require('express');
const session = require('express-session');
const fs = require('fs/promises');
const path = require('path');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const SVGtoPDF = require('svg-to-pdfkit');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const FILES = {
  concerts: path.join(DATA_DIR, 'concerts.json'),
  tourneurs: path.join(DATA_DIR, 'tourneurs.json'),
  users: path.join(DATA_DIR, 'users.json'),
  config: path.join(DATA_DIR, 'config.json'),
};
const ENV_FILE = path.join(__dirname, '.env');

const USER_PASSWORD_ENV_BY_ID = {
  usr_1: 'ADMIN_PASSWORD',
  usr_2: 'PHOTO_PASSWORD',
};

const USER_PASSWORD_ENV_BY_EMAIL = {
  'admin@rapstar.media': 'ADMIN_PASSWORD',
  'photo@rapstar.media': 'PHOTO_PASSWORD',
};

const DEFAULT_STATUSES = [
  { id: 'idee', emoji: '💡', label: 'Idee' },
  { id: 'demande_envoyee', emoji: '📤', label: 'Demande envoyee' },
  { id: 'en_attente', emoji: '⏳', label: 'En attente' },
  { id: 'obtenue', emoji: '✅', label: 'Obtenue' },
  { id: 'refus', emoji: '❌', label: 'Refus' },
  { id: 'a_relancer', emoji: '🔄', label: 'A relancer' },
  { id: 'terminee', emoji: '📸', label: 'Terminee' },
  { id: 'annule', emoji: '🚫', label: 'Annule' },
];

const DEFAULT_CONFIG = {
  mediaName: 'Rapstar',
  urgencyRedDays: 14,
  urgencyYellowDays: 30,
  statuses: DEFAULT_STATUSES,
  logo: {
    filename: null,
    mimeType: null,
  },
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.bin';
      cb(null, `logo_${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Format de logo non supporte'));
    }
    return cb(null, true);
  },
});

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'rapstar_session_secret_change_me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/public-config', async (_req, res) => {
  const config = await ensureConfig();
  return res.json({
    mediaName: config.mediaName,
    hasLogo: Boolean(config.logo?.filename),
  });
});

async function readJson(filePath, fallback = []) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmpPath, filePath);
}

function createId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeStatusId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\- ]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function isValidIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function getUniqueSortedDates(values) {
  const cleaned = Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((date) => String(date || '').trim())
        .filter((date) => isValidIsoDate(date))
    )
  );
  cleaned.sort((a, b) => a.localeCompare(b));
  return cleaned;
}

function parseStatusList(statuses) {
  const source = Array.isArray(statuses) ? statuses : [];
  const parsed = [];
  const usedIds = new Set();

  source.forEach((entry) => {
    const baseId = normalizeStatusId(entry.id || entry.label || createId('status'));
    if (!baseId || usedIds.has(baseId)) return;

    const label = String(entry.label || '').trim();
    if (!label) return;

    parsed.push({
      id: baseId,
      label,
      emoji: String(entry.emoji || '').trim(),
    });
    usedIds.add(baseId);
  });

  return parsed.length ? parsed : DEFAULT_STATUSES;
}

async function ensureConfig() {
  const current = await readJson(FILES.config, DEFAULT_CONFIG);
  const statuses = parseStatusList(current.statuses);
  const merged = {
    mediaName: String(current.mediaName || DEFAULT_CONFIG.mediaName).trim() || DEFAULT_CONFIG.mediaName,
    urgencyRedDays: Number(current.urgencyRedDays) > 0 ? Number(current.urgencyRedDays) : DEFAULT_CONFIG.urgencyRedDays,
    urgencyYellowDays:
      Number(current.urgencyYellowDays) > 0
        ? Number(current.urgencyYellowDays)
        : DEFAULT_CONFIG.urgencyYellowDays,
    statuses,
    logo: {
      filename: current.logo?.filename || null,
      mimeType: current.logo?.mimeType || null,
    },
  };

  if (merged.urgencyYellowDays < merged.urgencyRedDays) {
    merged.urgencyYellowDays = merged.urgencyRedDays;
  }

  const currentSerialized = JSON.stringify(current);
  const mergedSerialized = JSON.stringify(merged);
  if (currentSerialized !== mergedSerialized) {
    await writeJson(FILES.config, merged);
  }
  return merged;
}

function getClosestDate(dates) {
  const sorted = getUniqueSortedDates(dates);
  return sorted[0] || null;
}

function formatDateFr(isoDate) {
  if (!isValidIsoDate(isoDate)) return '-';
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('fr-FR');
}

function computeUrgencyForDate(isoDate, config) {
  if (!isValidIsoDate(isoDate)) {
    return { level: 'none', label: 'N/A', cssClass: '' };
  }

  const targetDate = new Date(`${isoDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (days < 0) {
    return { level: 'past', label: '⚫ Passe', cssClass: 'urgency-past' };
  }

  if (days < config.urgencyRedDays) {
    return { level: 'red', label: `🔴 < ${config.urgencyRedDays} jours`, cssClass: 'urgency-red' };
  }

  if (days < config.urgencyYellowDays) {
    return { level: 'yellow', label: `🟡 < ${config.urgencyYellowDays} jours`, cssClass: 'urgency-yellow' };
  }

  return { level: 'green', label: `🟢 >= ${config.urgencyYellowDays} jours`, cssClass: 'urgency-green' };
}

function dateSummaryFromDates(dates) {
  const sorted = getUniqueSortedDates(dates);
  if (!sorted.length) return '-';
  const first = formatDateFr(sorted[0]);
  if (sorted.length === 1) return first;
  return `${first} +${sorted.length - 1}`;
}

function statusMetaFor(statusId, config) {
  return config.statuses.find((entry) => entry.id === statusId) || config.statuses[0] || DEFAULT_STATUSES[0];
}

function stripEmoji(value) {
  return String(value || '')
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

async function drawBrandLogo(doc, config, x, y, width, height) {
  if (!config.logo?.filename) {
    return false;
  }

  const logoPath = path.join(UPLOADS_DIR, config.logo.filename);
  try {
    await fs.access(logoPath);
    if (config.logo.mimeType === 'image/svg+xml') {
      const svg = await fs.readFile(logoPath, 'utf8');
      SVGtoPDF(doc, svg, x, y, {
        width,
        height,
        preserveAspectRatio: 'xMidYMid meet',
      });
      return true;
    }

    doc.image(logoPath, x, y, { fit: [width, height], align: 'center', valign: 'center' });
    return true;
  } catch {
    return false;
  }
}

function drawSectionTitle(doc, label, x, y, width) {
  doc.roundedRect(x, y, width, 22, 3).lineWidth(1).strokeColor('#DADADA').stroke();
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111').text(label.toUpperCase(), x + 10, y + 7, {
    width: width - 20,
    align: 'left',
  });
  return y + 30;
}

function truncateText(value, maxLength = 600) {
  const text = String(value || '').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

function createHistoryEntry({ userEmail, action, details }) {
  return {
    id: createId('hst'),
    at: new Date().toISOString(),
    by: userEmail || 'system',
    action,
    details: String(details || '').trim(),
  };
}

function appendHistory(existingHistory, entry) {
  const base = Array.isArray(existingHistory) ? existingHistory : [];
  return [...base, entry].slice(-200);
}

function buildConcertUpdateDetails(previousConcert, nextConcert) {
  const changes = [];

  if (previousConcert.status !== nextConcert.status) {
    changes.push(`statut: ${previousConcert.status || '-'} -> ${nextConcert.status || '-'}`);
  }

  if (previousConcert.linkedTourneurId !== nextConcert.linkedTourneurId) {
    changes.push('tourneur lie modifie');
  }

  const previousDates = JSON.stringify(previousConcert.dates || []);
  const nextDates = JSON.stringify(nextConcert.dates || []);
  if (previousDates !== nextDates) {
    changes.push('dates visees mises a jour');
  }

  if (String(previousConcert.notes || '') !== String(nextConcert.notes || '')) {
    changes.push('notes modifiees');
  }

  if (String(previousConcert.practicalNotes || '') !== String(nextConcert.practicalNotes || '')) {
    changes.push('notes pratiques modifiees');
  }

  const previousContacts = JSON.stringify(previousConcert.contacts || []);
  const nextContacts = JSON.stringify(nextConcert.contacts || []);
  if (previousContacts !== nextContacts) {
    changes.push('contacts modifies');
  }

  if (!changes.length) {
    return 'mise a jour generale';
  }

  return changes.join(', ');
}

function decorateConcert(concert, config) {
  const dates = getUniqueSortedDates(concert.dates && concert.dates.length ? concert.dates : [concert.date]);
  const closestDate = dates[0] || null;
  const statusMeta = statusMetaFor(concert.status, config);

  return {
    ...concert,
    dates,
    date: closestDate,
    closestDate,
    dateSummary: dateSummaryFromDates(dates),
    urgency: computeUrgencyForDate(closestDate, config),
    statusMeta,
  };
}

function normalizeConcertInput(payload, config, existingConcert = null) {
  const contacts = Array.isArray(payload.contacts) ? payload.contacts.slice(0, 10) : [];
  const normalizedContacts = contacts.map((contact) => ({
    id: contact.id || createId('ctc'),
    name: String(contact.name || '').trim(),
    role: String(contact.role || '').trim(),
    email: String(contact.email || '').trim(),
    responded: Boolean(contact.responded),
  }));

  const candidateDates = Array.isArray(payload.dates) ? payload.dates : [payload.date];
  const dates = getUniqueSortedDates(candidateDates);
  const status = String(payload.status || '').trim();
  const knownStatusIds = new Set((config.statuses || []).map((entry) => entry.id));
  const fallbackStatus = config.statuses?.[0]?.id || 'idee';
  const existingStatus = String(existingConcert?.status || '').trim();
  const finalStatus = knownStatusIds.has(status)
    ? status
    : knownStatusIds.has(existingStatus)
      ? existingStatus
      : fallbackStatus;

  return {
    id: existingConcert?.id || createId('cnc'),
    artist: String(payload.artist || '').trim(),
    date: dates[0] || '',
    dates,
    venue: String(payload.venue || '').trim(),
    city: String(payload.city || '').trim(),
    status: finalStatus,
    notes: String(payload.notes || '').trim(),
    practicalNotes: String(payload.practicalNotes || '').trim(),
    linkedTourneurId: payload.linkedTourneurId ? String(payload.linkedTourneurId) : null,
    contacts: normalizedContacts,
    history: Array.isArray(existingConcert?.history) ? existingConcert.history : [],
    updatedBy: payload.updatedBy ? String(payload.updatedBy) : existingConcert?.updatedBy || null,
    updatedAt: new Date().toISOString(),
    createdAt: existingConcert?.createdAt || new Date().toISOString(),
  };
}

function normalizeTourneurInput(payload, existingTourneur = null) {
  const emailsRaw = String(payload.emails || '').split(',').map((value) => value.trim()).filter(Boolean);
  const artistsRaw = String(payload.artists || '').split(',').map((value) => value.trim()).filter(Boolean);

  return {
    id: existingTourneur?.id || createId('trn'),
    name: String(payload.name || '').trim(),
    emails: emailsRaw,
    artists: artistsRaw,
    updatedAt: new Date().toISOString(),
    createdAt: existingTourneur?.createdAt || new Date().toISOString(),
  };
}

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Non autorise' });
  }
  return next();
}

function stripSensitiveUserFields(user) {
  const cleaned = { ...user };
  delete cleaned.passwordHash;
  return cleaned;
}

function getPasswordEnvKeyForUser(user) {
  const byId = USER_PASSWORD_ENV_BY_ID[String(user?.id || '').trim()];
  if (byId) return byId;

  const normalizedEmail = String(user?.email || '').trim().toLowerCase();
  return USER_PASSWORD_ENV_BY_EMAIL[normalizedEmail] || null;
}

function getPasswordFromEnvForUser(user) {
  const envKey = getPasswordEnvKeyForUser(user);
  if (!envKey) return null;

  const value = String(process.env[envKey] || '');
  return value.trim() ? value : null;
}

function formatEnvValue(value) {
  const sanitized = String(value || '').replace(/\r?\n/g, '').trim();
  if (!sanitized) return '';

  if (/\s|#|"|'/.test(sanitized)) {
    return `"${sanitized.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }

  return sanitized;
}

async function upsertEnvVariable(key, value) {
  const envKey = String(key || '').trim();
  const envValue = String(value || '').replace(/\r?\n/g, '').trim();

  if (!envKey) {
    throw new Error('Cle .env invalide');
  }

  if (!envValue) {
    throw new Error('Valeur de mot de passe invalide');
  }

  let content = '';
  try {
    content = await fs.readFile(ENV_FILE, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const lines = content ? content.split(/\r?\n/) : [];
  const assignLine = `${envKey}=${formatEnvValue(envValue)}`;
  const keyPattern = new RegExp(`^\\s*${envKey.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*=`);
  const index = lines.findIndex((line) => keyPattern.test(line));

  if (index >= 0) {
    lines[index] = assignLine;
  } else {
    lines.push(assignLine);
  }

  const next = `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
  await fs.writeFile(ENV_FILE, next, 'utf8');
  process.env[envKey] = envValue;
}

async function ensureUsersWithoutPasswordHashes() {
  const users = await readJson(FILES.users, []);
  const sanitized = users.map((user) => stripSensitiveUserFields(user));

  if (JSON.stringify(users) !== JSON.stringify(sanitized)) {
    await writeJson(FILES.users, sanitized);
  }
}

app.get('/api/auth/me', (req, res) => {
  if (!req.session.user) {
    return res.json({ authenticated: false });
  }
  return res.json({ authenticated: true, user: req.session.user });
});

app.put('/api/auth/profile', requireAuth, async (req, res) => {
  const { email, currentPassword, newPassword } = req.body || {};
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const currentPasswordValue = String(currentPassword || '');
  const newPasswordValue = String(newPassword || '');

  if (!normalizedEmail) {
    return res.status(400).json({ error: 'Email requis' });
  }

  if (!currentPasswordValue) {
    return res.status(400).json({ error: 'Mot de passe actuel requis' });
  }

  const users = await readJson(FILES.users, []);
  const userIndex = users.findIndex((entry) => entry.id === req.session.user.id);
  if (userIndex === -1) {
    return res.status(404).json({ error: 'Utilisateur introuvable' });
  }

  const currentUser = users[userIndex];
  const passwordEnvKey = getPasswordEnvKeyForUser(currentUser);
  if (!passwordEnvKey) {
    return res.status(400).json({ error: 'Utilisateur non associe a une variable de mot de passe .env' });
  }

  const envPassword = getPasswordFromEnvForUser(currentUser);
  if (!envPassword) {
    return res.status(500).json({ error: 'Mot de passe utilisateur non configure dans le .env' });
  }

  if (currentPasswordValue !== envPassword) {
    return res.status(401).json({ error: 'Mot de passe actuel invalide' });
  }

  if (newPasswordValue && newPasswordValue.length < 6) {
    return res.status(400).json({ error: 'Le nouveau mot de passe doit faire au moins 6 caracteres' });
  }

  const duplicateEmail = users.some(
    (entry) => entry.id !== currentUser.id && String(entry.email || '').toLowerCase() === normalizedEmail
  );
  if (duplicateEmail) {
    return res.status(400).json({ error: 'Email deja utilise' });
  }

  users[userIndex].email = normalizedEmail;
  await writeJson(FILES.users, users.map((user) => stripSensitiveUserFields(user)));

  if (newPasswordValue) {
    await upsertEnvVariable(passwordEnvKey, newPasswordValue);
  }

  req.session.user = {
    ...req.session.user,
    email: normalizedEmail,
  };

  return res.json({ authenticated: true, user: req.session.user });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (!normalizedEmail || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  const users = await readJson(FILES.users, []);
  const user = users.find((entry) => String(entry.email || '').toLowerCase() === normalizedEmail);

  if (!user) {
    return res.status(401).json({ error: 'Identifiants invalides' });
  }

  const envPassword = getPasswordFromEnvForUser(user);
  if (!envPassword) {
    return res.status(500).json({ error: 'Mot de passe utilisateur non configure dans le .env' });
  }

  if (String(password) !== envPassword) {
    return res.status(401).json({ error: 'Identifiants invalides' });
  }

  req.session.user = {
    id: user.id,
    email: user.email,
    name: user.name,
  };

  return res.json({ authenticated: true, user: req.session.user });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

app.get('/api/concerts', requireAuth, async (req, res) => {
  const config = await ensureConfig();
  const concerts = await readJson(FILES.concerts, []);
  const decorated = concerts.map((concert) => decorateConcert(concert, config));
  decorated.sort((a, b) => String(a.closestDate || '').localeCompare(String(b.closestDate || '')));
  res.json(decorated);
});

app.get('/api/concerts/:id', requireAuth, async (req, res) => {
  const config = await ensureConfig();
  const concerts = await readJson(FILES.concerts, []);
  const concert = concerts.find((item) => item.id === req.params.id);
  if (!concert) {
    return res.status(404).json({ error: 'Concert introuvable' });
  }
  return res.json(decorateConcert(concert, config));
});

app.get('/api/concerts/:id/pdf', requireAuth, async (req, res) => {
  const config = await ensureConfig();
  const concerts = await readJson(FILES.concerts, []);
  const tourneurs = await readJson(FILES.tourneurs, []);
  const raw = concerts.find((item) => item.id === req.params.id);

  if (!raw) {
    return res.status(404).json({ error: 'Concert introuvable' });
  }

  const concert = decorateConcert(raw, config);
  const status = statusMetaFor(concert.status, config);
  const linkedTourneur = tourneurs.find((item) => item.id === concert.linkedTourneurId);
  const safeStatusLabel = stripEmoji(status.label);
  const safeUrgencyLabel = stripEmoji(concert.urgency?.label || 'N/A');
  const safeMediaName = stripEmoji(config.mediaName || 'Rapstar');
  const generatedAt = new Date().toLocaleString('fr-FR');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="concert_${concert.id}.pdf"`);

  const doc = new PDFDocument({ margin: 40, size: 'A4', info: { Title: `Dossier ${concert.artist}` } });
  doc.pipe(res);

  // One pager media
  doc.rect(0, 0, doc.page.width, 118).fill('#111111');
  doc.fillColor('#FFFFFF');
  doc.font('Helvetica-Bold').fontSize(13).text(safeMediaName, 40, 24);
  doc.font('Helvetica').fontSize(10).fillColor('#C7C7C7').text('Dossier accreditation photo - one pager', 40, 44);

  const logoPlacedCover = await drawBrandLogo(doc, config, doc.page.width - 118, 18, 64, 64);
  if (!logoPlacedCover) {
    doc
      .lineWidth(1)
      .strokeColor('#666666')
      .rect(doc.page.width - 118, 18, 64, 64)
      .stroke()
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#EFEFEF')
      .text(safeMediaName, doc.page.width - 114, 43, { width: 56, align: 'center' });
  }

  doc.fillColor('#111111');
  doc.font('Helvetica').fontSize(10).text(`Genere le ${generatedAt}`, 40, 136);
  doc.font('Helvetica-Bold').fontSize(24).text(stripEmoji(concert.artist), 40, 158, { width: 450 });

  doc.roundedRect(40, 210, 515, 92, 5).lineWidth(1).strokeColor('#D7D7D7').stroke();
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#111111').text('Informations principales', 52, 224);
  doc.font('Helvetica').fontSize(10.5);
  doc.text(`Lieu: ${stripEmoji(concert.venue)}`, 52, 245, { width: 250 });
  doc.text(`Ville: ${stripEmoji(concert.city)}`, 52, 262, { width: 250 });
  doc.text(`Statut: ${safeStatusLabel}`, 320, 245, { width: 220 });
  doc.text(`Urgence: ${safeUrgencyLabel}`, 320, 262, { width: 220 });

  doc.roundedRect(40, 316, 515, 66, 5).lineWidth(1).strokeColor('#D7D7D7').stroke();
  doc.font('Helvetica-Bold').fontSize(11).text('Tourneur', 52, 330);
  doc
    .font('Helvetica')
    .fontSize(10.5)
    .text(
      linkedTourneur
        ? `${stripEmoji(linkedTourneur.name)}${linkedTourneur.emails?.length ? ` (${linkedTourneur.emails.join(', ')})` : ''}`
        : 'Aucun tourneur lie',
      52,
      350,
      { width: 490 }
    );

  let cursorY = 396;
  cursorY = drawSectionTitle(doc, 'Dates visees', 40, cursorY, 515);
  doc.font('Helvetica').fontSize(11).fillColor('#111111');
  if (!concert.dates.length) {
    doc.text('Aucune date', 50, cursorY);
    cursorY += 24;
  } else {
    const visibleDates = concert.dates.slice(0, 8);
    visibleDates.forEach((date) => {
      doc.text(`- ${formatDateFr(date)} (${date})`, 50, cursorY, { width: 500 });
      cursorY += 18;
    });
    if (concert.dates.length > visibleDates.length) {
      doc.text(`- +${concert.dates.length - visibleDates.length} autres dates`, 50, cursorY, { width: 500 });
      cursorY += 18;
    }
  }

  cursorY += 6;
  cursorY = drawSectionTitle(doc, 'Contacts accreditation', 40, cursorY, 515);
  doc.font('Helvetica').fontSize(10).fillColor('#111111');
  if (!concert.contacts?.length) {
    doc.text('Aucun contact renseigne.', 50, cursorY);
    cursorY += 24;
  } else {
    concert.contacts.slice(0, 4).forEach((contact) => {
      const responseLabel = contact.responded ? 'Oui' : 'Non';
      const row = `${stripEmoji(contact.name || '-')} | ${stripEmoji(contact.role || '-')} | ${contact.email || '-'} | Reponse: ${responseLabel}`;
      doc.text(`- ${row}`, 50, cursorY, { width: 500 });
      cursorY = doc.y + 6;
    });
  }

  const notesTop = 626;
  doc.roundedRect(40, notesTop, 250, 132, 5).lineWidth(1).strokeColor('#D7D7D7').stroke();
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111').text('Notes editoriales', 50, notesTop + 12);
  doc.font('Helvetica').fontSize(9.8).text(truncateText(stripEmoji(concert.notes || 'Aucune note.'), 360), 50, notesTop + 30, {
    width: 230,
    height: 92,
  });

  doc.roundedRect(305, notesTop, 250, 132, 5).lineWidth(1).strokeColor('#D7D7D7').stroke();
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111').text('Notes pratiques', 315, notesTop + 12);
  doc
    .font('Helvetica')
    .fontSize(9.8)
    .text(truncateText(stripEmoji(concert.practicalNotes || 'Aucune note pratique.'), 360), 315, notesTop + 30, {
      width: 230,
      height: 92,
    });

  doc.font('Helvetica').fontSize(8.6).fillColor('#6A6A6A').text(`${safeMediaName} - Dossier accreditation one pager`, 40, 802, {
    width: 515,
    align: 'center',
  });

  doc.end();
});

app.get('/api/config', requireAuth, async (_req, res) => {
  const config = await ensureConfig();
  return res.json(config);
});

app.put('/api/config', requireAuth, async (req, res) => {
  const current = await ensureConfig();
  const mediaName = String(req.body?.mediaName || '').trim() || current.mediaName;
  const redDaysRaw = Number(req.body?.urgencyRedDays);
  const yellowDaysRaw = Number(req.body?.urgencyYellowDays);

  const urgencyRedDays = Number.isFinite(redDaysRaw) && redDaysRaw > 0 ? Math.round(redDaysRaw) : current.urgencyRedDays;
  const urgencyYellowDays =
    Number.isFinite(yellowDaysRaw) && yellowDaysRaw > 0 ? Math.round(yellowDaysRaw) : current.urgencyYellowDays;

  const statuses = parseStatusList(req.body?.statuses);

  const next = {
    ...current,
    mediaName,
    urgencyRedDays,
    urgencyYellowDays: Math.max(urgencyYellowDays, urgencyRedDays),
    statuses,
  };

  await writeJson(FILES.config, next);

  // Remappe les statuts des concerts si un statut a disparu.
  const statusIds = new Set(next.statuses.map((entry) => entry.id));
  const fallback = next.statuses[0]?.id || 'idee';
  const concerts = await readJson(FILES.concerts, []);
  const migrated = concerts.map((concert) => {
    if (!statusIds.has(concert.status)) {
      return {
        ...concert,
        status: fallback,
        updatedAt: new Date().toISOString(),
      };
    }
    return concert;
  });
  await writeJson(FILES.concerts, migrated);

  return res.json(next);
});

app.post('/api/config/logo', requireAuth, (req, res) => {
  upload.single('logo')(req, res, async (error) => {
    if (error) {
      return res.status(400).json({ error: error.message || 'Upload impossible' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Fichier logo requis' });
    }

    const config = await ensureConfig();

    if (config.logo?.filename && config.logo.filename !== req.file.filename) {
      const oldPath = path.join(UPLOADS_DIR, config.logo.filename);
      await fs.unlink(oldPath).catch(() => { });
    }

    const next = {
      ...config,
      logo: {
        filename: req.file.filename,
        mimeType: req.file.mimetype,
      },
    };

    await writeJson(FILES.config, next);
    return res.json(next);
  });
});

app.get('/logo', async (_req, res) => {
  const config = await ensureConfig();
  const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="60" viewBox="0 0 160 60"><rect width="160" height="60" fill="#0b0b0b"/><text x="80" y="37" fill="#f4f4f4" text-anchor="middle" font-family="Arial, sans-serif" font-size="20">${String(config.mediaName || 'Rapstar').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`;

  if (!config.logo?.filename) {
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    return res.send(fallbackSvg);
  }

  const logoPath = path.join(UPLOADS_DIR, config.logo.filename);
  try {
    await fs.access(logoPath);
    if (config.logo?.mimeType) {
      res.setHeader('Content-Type', config.logo.mimeType);
    }
    return res.sendFile(logoPath);
  } catch {
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    return res.send(fallbackSvg);
  }
});

app.post('/api/concerts', requireAuth, async (req, res) => {
  const config = await ensureConfig();
  const currentUser = req.session.user;
  const payload = req.body || {};

  const inputDates = getUniqueSortedDates(Array.isArray(payload.dates) ? payload.dates : [payload.date]);

  if (!payload.artist || !payload.venue || !payload.city || !inputDates.length) {
    return res.status(400).json({ error: 'Artiste, au moins une date, lieu et ville sont requis' });
  }

  const concerts = await readJson(FILES.concerts, []);
  const concert = normalizeConcertInput({ ...payload, dates: inputDates, updatedBy: currentUser.email }, config);
  concert.history = appendHistory(
    concert.history,
    createHistoryEntry({
      userEmail: currentUser.email,
      action: 'creation',
      details: 'concert cree',
    })
  );
  concerts.push(concert);
  await writeJson(FILES.concerts, concerts);

  res.status(201).json(decorateConcert(concert, config));
});

app.put('/api/concerts/:id', requireAuth, async (req, res) => {
  const config = await ensureConfig();
  const currentUser = req.session.user;
  const concerts = await readJson(FILES.concerts, []);
  const index = concerts.findIndex((item) => item.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Concert introuvable' });
  }

  const baseUpdatedAt = String(req.body?.baseUpdatedAt || '').trim();
  const currentUpdatedAt = String(concerts[index]?.updatedAt || '').trim();
  if (baseUpdatedAt && currentUpdatedAt && baseUpdatedAt !== currentUpdatedAt) {
    return res.status(409).json({
      error: 'Le concert a ete modifie par un autre utilisateur. Recharge les donnees puis reessaie.',
      code: 'CONCURRENT_MODIFICATION',
    });
  }

  const merged = normalizeConcertInput(
    { ...concerts[index], ...req.body, updatedBy: currentUser.email },
    config,
    concerts[index]
  );

  merged.history = appendHistory(
    concerts[index].history,
    createHistoryEntry({
      userEmail: currentUser.email,
      action: 'update',
      details: buildConcertUpdateDetails(concerts[index], merged),
    })
  );

  concerts[index] = merged;
  await writeJson(FILES.concerts, concerts);
  return res.json(decorateConcert(merged, config));
});

app.delete('/api/concerts/:id', requireAuth, async (req, res) => {
  const concerts = await readJson(FILES.concerts, []);
  const next = concerts.filter((item) => item.id !== req.params.id);

  if (next.length === concerts.length) {
    return res.status(404).json({ error: 'Concert introuvable' });
  }

  await writeJson(FILES.concerts, next);
  return res.json({ success: true });
});

app.get('/api/tourneurs', requireAuth, async (req, res) => {
  const tourneurs = await readJson(FILES.tourneurs, []);
  tourneurs.sort((a, b) => a.name.localeCompare(b.name));
  res.json(tourneurs);
});

app.post('/api/tourneurs', requireAuth, async (req, res) => {
  if (!req.body?.name) {
    return res.status(400).json({ error: 'Nom requis' });
  }

  const tourneurs = await readJson(FILES.tourneurs, []);
  const tourneur = normalizeTourneurInput(req.body);
  tourneurs.push(tourneur);
  await writeJson(FILES.tourneurs, tourneurs);
  res.status(201).json(tourneur);
});

app.put('/api/tourneurs/:id', requireAuth, async (req, res) => {
  const tourneurs = await readJson(FILES.tourneurs, []);
  const index = tourneurs.findIndex((item) => item.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Tourneur introuvable' });
  }

  const merged = normalizeTourneurInput({ ...tourneurs[index], ...req.body }, tourneurs[index]);
  tourneurs[index] = merged;
  await writeJson(FILES.tourneurs, tourneurs);
  res.json(merged);
});

app.delete('/api/tourneurs/:id', requireAuth, async (req, res) => {
  const tourneurs = await readJson(FILES.tourneurs, []);
  const next = tourneurs.filter((item) => item.id !== req.params.id);

  if (next.length === tourneurs.length) {
    return res.status(404).json({ error: 'Tourneur introuvable' });
  }

  await writeJson(FILES.tourneurs, next);

  // Nettoie les liens vers le tourneur supprime dans les concerts.
  const concerts = await readJson(FILES.concerts, []);
  const updatedConcerts = concerts.map((concert) => {
    if (concert.linkedTourneurId === req.params.id) {
      return { ...concert, linkedTourneurId: null, updatedAt: new Date().toISOString() };
    }
    return concert;
  });
  await writeJson(FILES.concerts, updatedConcerts);

  return res.json({ success: true });
});

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

ensureUsersWithoutPasswordHashes()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Rapstar app running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Unable to start server:', error);
    process.exit(1);
  });

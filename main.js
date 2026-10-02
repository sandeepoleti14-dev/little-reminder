const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

let settingsWindow = null;
let companionWindow = null;
let tray = null;

let timer = null;
let reminderQueue = [];
let showingReminder = false;

let nextWaterReminderAt = null;
let nextFoodReminderAt = null;

let snoozeTimer = null;
let activeReminderType = null;

const DEFAULTS = {
  // WATER
  enabled: true,
  firstReminderTime: '08:30',
  start: '08:00',
  end: '22:00',
  intervalMinutes: 120,
  snoozeMinutes: 10,

  // FOOD
  foodEnabled: false,
  firstFoodReminderTime: '13:00',
  foodStart: '08:00',
  foodEnd: '21:00',
  foodIntervalMinutes: 240,
  foodSnoozeMinutes: 10,

  // GENERAL
  durationMs: 6500,
  startWithWindows: true
};

function dataPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings() {
  try {
    const raw = fs.readFileSync(dataPath(), 'utf8');
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

let settings = null;

function saveSettings(next) {
  settings = { ...settings, ...next };

  fs.mkdirSync(path.dirname(dataPath()), { recursive: true });
  fs.writeFileSync(dataPath(), JSON.stringify(settings, null, 2));

  applyStartupSetting();
  setNextReminders();
  restartScheduler();
}

function applyStartupSetting() {
  if (process.platform === 'win32') {
    app.setLoginItemSettings({
      openAtLogin: !!settings.startWithWindows
    });
  }
}

function createTray() {
  if (tray) return;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg"
      width="32"
      height="32"
      viewBox="0 0 32 32">

      <rect width="32" height="32" rx="9" fill="#50d1c8"/>

      <path
        d="M16 6c-3.2 5.2-7 8.9-7 13.1A7 7 0 0 0 23 19.1C23 14.9 19.2 11.2 16 6Z"
        fill="#06201f"/>

      <circle
        cx="14"
        cy="18"
        r="1.1"
        fill="#50d1c8"/>
    </svg>
  `;

  const icon = nativeImage.createFromDataURL(
    'data:image/svg+xml;base64,' +
    Buffer.from(svg).toString('base64')
  );

  tray = new Tray(icon);

  tray.setToolTip('Little Reminder');

  tray.on('click', () => {
    settingsWindow?.show();
  });

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Open Little Reminder',
        click: () => settingsWindow?.show()
      },
      {
        type: 'separator'
      },
      {
        label: 'Pause reminders',
        click: () => saveSettings({
          enabled: false
        })
      },
      {
        label: 'Resume reminders',
        click: () => saveSettings({
          enabled: true
        })
      },
      {
        label: 'Settings',
        click: () => settingsWindow?.show()
      },
      {
        type: 'separator'
      },
      {
        label: 'Exit',
        click: () => app.quit()
      }
    ])
  );
}

function createSettingsWindow() {
  settingsWindow = new BrowserWindow({
    width: 980,
    height: 760,
    minWidth: 820,
    minHeight: 660,
    show: false,
    backgroundColor: '#09191a',
    title: 'Little Reminder',

    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  settingsWindow.loadFile(
    path.join(__dirname, 'index.html')
  );

  settingsWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      settingsWindow.hide();
    }
  });
}

function companionBounds() {
  const display = screen.getPrimaryDisplay();
  const area = display.workArea;

  const width = 360;
  const height = 220;
  const margin = 18;

  return {
    x: Math.round(
      area.x + area.width - width - margin
    ),
    y: Math.round(
      area.y + area.height - height - margin
    ),
    width,
    height
  };
}

function createCompanionWindow() {
  companionWindow = new BrowserWindow({
    ...companionBounds(),

    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    skipTaskbar: true,
    show: false,
    hasShadow: false,
    alwaysOnTop: true,
    focusable: false,

    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  companionWindow.setAlwaysOnTop(true, 'floating');

  companionWindow.loadFile(
    path.join(__dirname, 'companion.html')
  );

  companionWindow.on('closed', () => {
    companionWindow = null;
  });
}

function minutesOf(hhmm) {
  const [h, m] = String(hhmm || '')
    .split(':')
    .map(Number);

  return (
    (Number.isFinite(h) ? h : 0) * 60 +
    (Number.isFinite(m) ? m : 0)
  );
}

function dateAtTime(baseDate, hhmm) {
  const d = new Date(baseDate);

  const [h, m] = String(hhmm)
    .split(':')
    .map(Number);

  d.setHours(h, m, 0, 0);

  return d;
}

function addDays(date, days) {
  const d = new Date(date);

  d.setDate(
    d.getDate() + days
  );

  return d;
}

/* =========================================================
   WATER
   ========================================================= */

function withinWaterWindowDate(date) {
  const current =
    date.getHours() * 60 +
    date.getMinutes();

  const start = minutesOf(settings.start);
  const end = minutesOf(settings.end);

  if (start <= end) {
    return current >= start && current <= end;
  }

  return current >= start || current <= end;
}

function getNextWaterReminderAt(
  fromDate = new Date()
) {
  if (!settings.enabled) {
    return null;
  }

  const first = dateAtTime(
    fromDate,
    settings.firstReminderTime
  );

  const interval =
    Math.max(
      1,
      Number(settings.intervalMinutes) || 120
    );

  const start = minutesOf(settings.start);
  const end = minutesOf(settings.end);

  if (
    start <= end &&
    minutesOf(settings.firstReminderTime) < start
  ) {
    first.setHours(
      Math.floor(start / 60),
      start % 60,
      0,
      0
    );
  }

  let candidate = first;

  while (candidate <= fromDate) {
    candidate = new Date(
      candidate.getTime() +
      interval * 60 * 1000
    );
  }

  const candidateMinutes =
    candidate.getHours() * 60 +
    candidate.getMinutes();

  if (
    start <= end &&
    candidateMinutes > end
  ) {
    const tomorrow = addDays(
      fromDate,
      1
    );

    const next = dateAtTime(
      tomorrow,
      settings.firstReminderTime
    );

    if (
      minutesOf(settings.firstReminderTime) < start
    ) {
      next.setHours(
        Math.floor(start / 60),
        start % 60,
        0,
        0
      );
    }

    return next;
  }

  return candidate;
}

/* =========================================================
   FOOD
   ========================================================= */

function withinFoodWindowDate(date) {
  const current =
    date.getHours() * 60 +
    date.getMinutes();

  const start = minutesOf(settings.foodStart);
  const end = minutesOf(settings.foodEnd);

  if (start <= end) {
    return current >= start && current <= end;
  }

  return current >= start || current <= end;
}

function getNextFoodReminderAt(
  fromDate = new Date()
) {
  if (!settings.foodEnabled) {
    return null;
  }

  const first = dateAtTime(
    fromDate,
    settings.firstFoodReminderTime
  );

  const interval =
    Math.max(
      1,
      Number(settings.foodIntervalMinutes) || 240
    );

  const start = minutesOf(settings.foodStart);
  const end = minutesOf(settings.foodEnd);

  if (
    start <= end &&
    minutesOf(settings.firstFoodReminderTime) < start
  ) {
    first.setHours(
      Math.floor(start / 60),
      start % 60,
      0,
      0
    );
  }

  let candidate = first;

  while (candidate <= fromDate) {
    candidate = new Date(
      candidate.getTime() +
      interval * 60 * 1000
    );
  }

  const candidateMinutes =
    candidate.getHours() * 60 +
    candidate.getMinutes();

  if (
    start <= end &&
    candidateMinutes > end
  ) {
    const tomorrow = addDays(
      fromDate,
      1
    );

    const next = dateAtTime(
      tomorrow,
      settings.firstFoodReminderTime
    );

    if (
      minutesOf(settings.firstFoodReminderTime) < start
    ) {
      next.setHours(
        Math.floor(start / 60),
        start % 60,
        0,
        0
      );
    }

    return next;
  }

  return candidate;
}

/* =========================================================
   NEXT REMINDERS
   ========================================================= */

function setNextReminders(
  fromDate = new Date()
) {
  nextWaterReminderAt =
    getNextWaterReminderAt(fromDate);

  nextFoodReminderAt =
    getNextFoodReminderAt(fromDate);
}

function getNextOverallReminder() {
  const reminders = [
    {
      type: 'water',
      time: nextWaterReminderAt
    },
    {
      type: 'food',
      time: nextFoodReminderAt
    }
  ].filter(item => item.time);

  if (reminders.length === 0) {
    return null;
  }

  reminders.sort(
    (a, b) =>
      a.time.getTime() -
      b.time.getTime()
  );

  return reminders[0];
}

/* =========================================================
   SCHEDULER
   ========================================================= */

function restartScheduler() {
  if (timer) {
    clearInterval(timer);
  }

  timer = setInterval(() => {
    const now = new Date();

    /* WATER */
    if (
      settings.enabled &&
      nextWaterReminderAt &&
      now >= nextWaterReminderAt &&
      withinWaterWindowDate(now)
    ) {
      const triggeredAt =
        nextWaterReminderAt;

      nextWaterReminderAt =
        getNextWaterReminderAt(
          new Date(
            triggeredAt.getTime() + 1000
          )
        );

      enqueueReminder({
        type: 'water',
        createdAt: Date.now(),
        scheduledFor:
          triggeredAt.toISOString()
      });
    }

    /* FOOD */
    if (
      settings.foodEnabled &&
      nextFoodReminderAt &&
      now >= nextFoodReminderAt &&
      withinFoodWindowDate(now)
    ) {
      const triggeredAt =
        nextFoodReminderAt;

      nextFoodReminderAt =
        getNextFoodReminderAt(
          new Date(
            triggeredAt.getTime() + 1000
          )
        );

      enqueueReminder({
        type: 'food',
        createdAt: Date.now(),
        scheduledFor:
          triggeredAt.toISOString()
      });
    }
  }, 1000);
}

/* =========================================================
   REMINDER QUEUE
   ========================================================= */

function enqueueReminder(reminder) {
  reminderQueue.push(reminder);
  processQueue();
}

async function processQueue() {
  if (
    showingReminder ||
    reminderQueue.length === 0
  ) {
    return;
  }

  showingReminder = true;

  const reminder =
    reminderQueue.shift();

  activeReminderType =
    reminder.type || 'water';

  if (
    !companionWindow ||
    companionWindow.isDestroyed()
  ) {
    createCompanionWindow();
  }

  const bounds =
    companionBounds();

  companionWindow.setBounds(bounds);

  companionWindow.setIgnoreMouseEvents(false);
  companionWindow.setFocusable(false);

  companionWindow.showInactive();

  companionWindow.webContents.send(
    'show-reminder',
    reminder
  );

  setTimeout(() => {
    if (
      !companionWindow ||
      companionWindow.isDestroyed()
    ) {
      showingReminder = false;
      activeReminderType = null;
      processQueue();
      return;
    }

    companionWindow.webContents.send(
      'hide-reminder'
    );

    setTimeout(() => {
      if (
        companionWindow &&
        !companionWindow.isDestroyed()
      ) {
        companionWindow.hide();
      }

      showingReminder = false;
      activeReminderType = null;

      processQueue();
    }, 550);
  }, Math.max(
    2500,
    Number(settings.durationMs) || 6500
  ));
}

/* =========================================================
   SNOOZE
   ========================================================= */

function snooze() {
  if (snoozeTimer) {
    clearTimeout(snoozeTimer);
  }

  const reminderType =
    activeReminderType || 'water';

  const mins =
    reminderType === 'food'
      ? Math.max(
          1,
          Number(settings.foodSnoozeMinutes) || 10
        )
      : Math.max(
          1,
          Number(settings.snoozeMinutes) || 10
        );

  snoozeTimer = setTimeout(() => {
    enqueueReminder({
      type: reminderType,
      createdAt: Date.now(),
      snoozed: true
    });

    snoozeTimer = null;
  }, mins * 60 * 1000);
}

/* =========================================================
   IPC
   ========================================================= */

ipcMain.handle(
  'get-settings',
  () => {
    const nextOverall =
      getNextOverallReminder();

    return {
      ...settings,

      deviceTime:
        new Date().toISOString(),

      nextReminderAt:
        nextOverall
          ? nextOverall.time.toISOString()
          : null,

      nextWaterReminderAt:
        nextWaterReminderAt
          ? nextWaterReminderAt.toISOString()
          : null,

      nextFoodReminderAt:
        nextFoodReminderAt
          ? nextFoodReminderAt.toISOString()
          : null
    };
  }
);

ipcMain.handle(
  'save-settings',
  (_event, next) => {
    saveSettings(next);

    const nextOverall =
      getNextOverallReminder();

    return {
      ...settings,

      deviceTime:
        new Date().toISOString(),

      nextReminderAt:
        nextOverall
          ? nextOverall.time.toISOString()
          : null,

      nextWaterReminderAt:
        nextWaterReminderAt
          ? nextWaterReminderAt.toISOString()
          : null,

      nextFoodReminderAt:
        nextFoodReminderAt
          ? nextFoodReminderAt.toISOString()
          : null
    };
  }
);

/* WATER PREVIEW */
ipcMain.on(
  'preview-reminder',
  () => {
    enqueueReminder({
      type: 'water',
      preview: true,
      createdAt: Date.now()
    });
  }
);

/* WATER TEST */
ipcMain.on(
  'test-reminder-in-minute',
  () => {
    setTimeout(() => {
      enqueueReminder({
        type: 'water',
        test: true,
        createdAt: Date.now()
      });
    }, 60 * 1000);
  }
);

/* FOOD PREVIEW */
ipcMain.on(
  'preview-food-reminder',
  () => {
    enqueueReminder({
      type: 'food',
      preview: true,
      createdAt: Date.now()
    });
  }
);

/* FOOD TEST */
ipcMain.on(
  'test-food-reminder-in-minute',
  () => {
    setTimeout(() => {
      enqueueReminder({
        type: 'food',
        test: true,
        createdAt: Date.now()
      });
    }, 60 * 1000);
  }
);

/* DONE */
ipcMain.on(
  'reminder-done',
  () => {
    if (
      companionWindow &&
      !companionWindow.isDestroyed()
    ) {
      companionWindow.hide();
    }

    showingReminder = false;
    activeReminderType = null;

    processQueue();
  }
);

/* SNOOZE */
ipcMain.on(
  'reminder-snooze',
  () => {
    if (
      companionWindow &&
      !companionWindow.isDestroyed()
    ) {
      companionWindow.hide();
    }

    showingReminder = false;

    snooze();

    activeReminderType = null;

    processQueue();
  }
);

/* =========================================================
   APP START
   ========================================================= */

app.whenReady().then(() => {
  settings = loadSettings();

  createSettingsWindow();
  createTray();
  createCompanionWindow();

  applyStartupSetting();

  setNextReminders();

  restartScheduler();

  // Always show the settings window when
  // the user launches the app manually.
  settingsWindow.show();
});

app.on(
  'window-all-closed',
  (event) => {
    event.preventDefault();
  }
);

app.on(
  'before-quit',
  () => {
    app.isQuitting = true;

    if (timer) {
      clearInterval(timer);
    }

    if (snoozeTimer) {
      clearTimeout(snoozeTimer);
    }
  }
);

app.on(
  'activate',
  () => settingsWindow?.show()
);
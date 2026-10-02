const $ = (id) => document.getElementById(id);

const status = $('status');


// --------------------------------------------------
// TIME
// --------------------------------------------------

function formatDeviceTime() {
  return new Date().toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit'
  });
}

function formatDate() {
  return new Date().toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });
}

function formatNextTime(iso) {
  if (!iso) return 'Paused';

  return new Date(iso).toLocaleString([], {
    hour: 'numeric',
    minute: '2-digit',
    day: 'numeric',
    month: 'short'
  });
}


// --------------------------------------------------
// DYNAMIC GREETING
// --------------------------------------------------

function updateGreeting() {
  const hour = new Date().getHours();

  let greeting;
  let message;

  if (hour >= 5 && hour < 12) {
    greeting = 'Good Morning 👋';
    message = 'A fresh day is waiting. Your little companions are ready.';
  } else if (hour >= 12 && hour < 17) {
    greeting = 'Good Afternoon ☀️';
    message = 'Keep going. Your little companions are here with you.';
  } else if (hour >= 17 && hour < 21) {
    greeting = 'Good Evening 🌆';
    message = 'Slow down a little and take care of yourself.';
  } else {
    greeting = 'Good Night 🌙';
    message = 'It is time to rest. Your little companions are still watching over you.';
  }

  $('greeting').textContent = greeting;
  $('greetingMessage').textContent = message;
}


// --------------------------------------------------
// CLOCK
// --------------------------------------------------

function updateClock() {
  $('deviceTime').textContent = formatDeviceTime();
  $('todayDate').textContent = formatDate();
  updateGreeting();
}


// --------------------------------------------------
// WATER CARD
// --------------------------------------------------

function updateWaterCard(settings) {
  const intervalMinutes = Number(settings.intervalMinutes || 120);

  let intervalText = '2 hours';

  if (intervalMinutes === 60) {
    intervalText = '1 hour';
  } else if (intervalMinutes === 90) {
    intervalText = '90 minutes';
  } else if (intervalMinutes === 120) {
    intervalText = '2 hours';
  } else if (intervalMinutes === 180) {
    intervalText = '3 hours';
  }

  $('waterIntervalText').textContent = intervalText;

  const waterNext =
    settings.nextWaterReminderAt ||
    settings.nextReminderAt ||
    null;

  $('waterNext').textContent = formatNextTime(waterNext);
  $('nextReminder').textContent = formatNextTime(waterNext);
}


// --------------------------------------------------
// LOAD SETTINGS
// --------------------------------------------------

async function load() {
  try {
    const s = await window.littleReminder.getSettings();

    $('enabled').checked = !!s.enabled;

    $('firstReminderTime').value =
      s.firstReminderTime || '';

    $('start').value =
      s.start || '';

    $('end').value =
      s.end || '';

    $('interval').value =
      String(s.intervalMinutes || 120);

    $('snooze').value =
      String(s.snoozeMinutes || 10);

    $('startup').checked =
      !!s.startWithWindows;

    updateWaterCard(s);

    status.textContent = s.enabled
      ? 'Your Water companion is active.'
      : 'Water reminders are paused.';

  } catch (error) {
    console.error('Failed to load settings:', error);

    status.textContent =
      'Unable to load reminder settings.';
  }
}


// --------------------------------------------------
// WATER EDIT PANEL
// --------------------------------------------------

const waterEdit = document.querySelector('.waterEdit');

if (waterEdit) {
  waterEdit.onclick = () => {
    const panel = $('waterSettings');

    if (!panel) return;

    panel.classList.remove('hidden');

    panel.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest'
    });
  };
}


const closeWaterSettings =
  $('closeWaterSettings');

if (closeWaterSettings) {
  closeWaterSettings.onclick = () => {
    $('waterSettings').classList.add('hidden');
  };
}


// --------------------------------------------------
// WATER ENABLE SWITCH
// --------------------------------------------------

const waterEnabled = $('enabled');

if (waterEnabled) {
  waterEnabled.onchange = () => {
    status.textContent = waterEnabled.checked
      ? 'Water reminder will be enabled after saving.'
      : 'Water reminders will be paused after saving.';
  };
}


// --------------------------------------------------
// SAVE WATER
// --------------------------------------------------

const saveWater = $('save');

if (saveWater) {
  saveWater.onclick = async () => {
    const first = $('firstReminderTime').value;
    const start = $('start').value;
    const end = $('end').value;

    if (!first || !start || !end) {
      status.textContent =
        'Please set the reminder, start, and end times.';
      return;
    }

    try {
      const s = await window.littleReminder.saveSettings({
        enabled: $('enabled').checked,
        firstReminderTime: first,
        start: start,
        end: end,
        intervalMinutes: Number($('interval').value),
        snoozeMinutes: Number($('snooze').value),
        startWithWindows: $('startup').checked
      });

      updateWaterCard(s);

      const waterNext =
        s.nextWaterReminderAt ||
        s.nextReminderAt ||
        null;

      if (s.enabled) {
        status.textContent =
          '✓ Water schedule saved. Next reminder: ' +
          formatNextTime(waterNext) +
          '.';
      } else {
        status.textContent =
          '✓ Water schedule saved. Water reminders are paused.';
      }

      $('waterSettings')
        .classList
        .add('hidden');

    } catch (error) {
      console.error(
        'Failed to save Water settings:',
        error
      );

      status.textContent =
        'Could not save the Water schedule.';
    }
  };
}


// --------------------------------------------------
// WATER PREVIEW
// --------------------------------------------------

const preview = $('preview');

if (preview) {
  preview.onclick = () => {
    status.textContent =
      'Mermaid companion preview triggered.';

    window.littleReminder.preview();
  };
}


// --------------------------------------------------
// WATER TEST IN ONE MINUTE
// --------------------------------------------------

const testMinute = $('testMinute');

if (testMinute) {
  testMinute.onclick = () => {
    status.textContent =
      '🧪 Water test reminder scheduled for 1 minute from now.';

    window.littleReminder.testInMinute();
  };
}


// --------------------------------------------------
// FUTURE REMINDERS
// --------------------------------------------------

document
  .querySelectorAll('.futureButton')
  .forEach((button) => {
    button.addEventListener('click', () => {
      status.textContent =
        'This reminder will be configurable in the next dashboard stage.';
    });
  });


document
  .querySelectorAll('.futureToggle')
  .forEach((toggle) => {
    toggle.addEventListener('change', () => {
      toggle.checked = false;

      status.textContent =
        'This companion will become active when its reminder system is connected.';
    });
  });


// --------------------------------------------------
// ADD REMINDER
// --------------------------------------------------

const addReminder = $('addReminder');

if (addReminder) {
  addReminder.onclick = () => {
    status.textContent =
      'Custom reminders will be added in the next stage.';
  };
}


// --------------------------------------------------
// START CLOCK
// --------------------------------------------------

updateClock();

setInterval(updateClock, 1000);


// --------------------------------------------------
// START APP
// --------------------------------------------------

load();
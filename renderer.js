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
}


// --------------------------------------------------
// FOOD CARD
// --------------------------------------------------

function getFoodIntervalText(minutes) {
  const value = Number(minutes || 240);

  if (value === 120) return '2 hours';
  if (value === 180) return '3 hours';
  if (value === 240) return '4 hours';
  if (value === 300) return '5 hours';

  if (value < 60) {
    return `${value} minutes`;
  }

  const hours = value / 60;

  if (Number.isInteger(hours)) {
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }

  return `${value} minutes`;
}


function updateFoodCard(settings) {
  const foodCard = document.querySelector('.foodReminder');

  if (!foodCard) return;

  const toggle = foodCard.querySelector('input[type="checkbox"]');
  const configureButton = foodCard.querySelector('.futureButton');

  const metaItems =
    foodCard.querySelectorAll('.reminderMeta span');

  const intervalText =
    getFoodIntervalText(settings.foodIntervalMinutes);

  const foodNext =
    settings.nextFoodReminderAt || null;

  if (toggle) {
    toggle.checked = !!settings.foodEnabled;
  }

  if (metaItems[0]) {
    metaItems[0].textContent =
      `🍎 Every ${intervalText}`;
  }

  if (metaItems[1]) {
    metaItems[1].innerHTML =
      `Next: <strong>${formatNextTime(foodNext)}</strong>`;
  }

  if (configureButton) {
    configureButton.textContent =
      settings.foodEnabled
        ? 'Edit schedule'
        : 'Configure';
  }
}


// --------------------------------------------------
// NEXT OVERALL REMINDER
// --------------------------------------------------

function updateOverallNextReminder(settings) {
  const waterNext =
    settings.nextWaterReminderAt ||
    settings.nextReminderAt ||
    null;

  const foodNext =
    settings.nextFoodReminderAt ||
    null;

  let next = null;

  if (waterNext && foodNext) {
    const waterDate = new Date(waterNext);
    const foodDate = new Date(foodNext);

    next =
      waterDate <= foodDate
        ? waterNext
        : foodNext;

  } else {
    next = waterNext || foodNext || null;
  }

  $('nextReminder').textContent =
    formatNextTime(next);
}


// --------------------------------------------------
// LOAD SETTINGS
// --------------------------------------------------

async function load() {
  try {
    const s = await window.littleReminder.getSettings();

    // -----------------------------
    // WATER
    // -----------------------------

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


    // -----------------------------
    // FOOD
    // -----------------------------

    const foodCard =
      document.querySelector('.foodReminder');

    const foodToggle =
      foodCard?.querySelector('input[type="checkbox"]');

    if (foodToggle) {
      foodToggle.checked =
        !!s.foodEnabled;
    }

    $('firstFoodReminderTime').value =
      s.firstFoodReminderTime || '13:00';

    $('foodStart').value =
      s.foodStart || '08:00';

    $('foodEnd').value =
      s.foodEnd || '21:00';

    $('foodInterval').value =
      String(s.foodIntervalMinutes || 240);

    $('foodSnooze').value =
      String(s.foodSnoozeMinutes || 10);

    updateFoodCard(s);


    // -----------------------------
    // OVERALL NEXT REMINDER
    // -----------------------------

    updateOverallNextReminder(s);


    // -----------------------------
    // STATUS
    // -----------------------------

    if (s.enabled || s.foodEnabled) {

      const activeParts = [];

      if (s.enabled) {
        activeParts.push('Water');
      }

      if (s.foodEnabled) {
        activeParts.push('Food');
      }

      status.textContent =
        activeParts.join(' and ') +
        ' companion' +
        (activeParts.length > 1 ? 's are' : ' is') +
        ' active.';

    } else {

      status.textContent =
        'Water and Food reminders are paused.';
    }

  } catch (error) {

    console.error(
      'Failed to load settings:',
      error
    );

    status.textContent =
      'Unable to load reminder settings.';
  }
}


// --------------------------------------------------
// WATER EDIT PANEL
// --------------------------------------------------

const waterEdit =
  document.querySelector('.waterEdit');

if (waterEdit) {

  waterEdit.onclick = () => {

    const panel =
      $('waterSettings');

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

    $('waterSettings')
      .classList
      .add('hidden');
  };
}


// --------------------------------------------------
// WATER ENABLE SWITCH
// --------------------------------------------------

const waterEnabled =
  $('enabled');

if (waterEnabled) {

  waterEnabled.onchange = () => {

    status.textContent =
      waterEnabled.checked
        ? 'Water reminder will be enabled after saving.'
        : 'Water reminders will be paused after saving.';
  };
}


// --------------------------------------------------
// SAVE WATER
// --------------------------------------------------

const saveWater =
  $('save');

if (saveWater) {

  saveWater.onclick = async () => {

    const first =
      $('firstReminderTime').value;

    const start =
      $('start').value;

    const end =
      $('end').value;

    if (!first || !start || !end) {

      status.textContent =
        'Please set the reminder, start, and end times.';

      return;
    }

    try {

      const s =
        await window.littleReminder.saveSettings({

          enabled:
            $('enabled').checked,

          firstReminderTime:
            first,

          start:
            start,

          end:
            end,

          intervalMinutes:
            Number($('interval').value),

          snoozeMinutes:
            Number($('snooze').value),

          startWithWindows:
            $('startup').checked
        });


      updateWaterCard(s);
      updateFoodCard(s);
      updateOverallNextReminder(s);


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

const preview =
  $('preview');

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

const testMinute =
  $('testMinute');

if (testMinute) {

  testMinute.onclick = () => {

    status.textContent =
      '🧪 Water test reminder scheduled for 1 minute from now.';

    window.littleReminder.testInMinute();
  };
}


// --------------------------------------------------
// FOOD EDIT PANEL
// --------------------------------------------------

const foodCard =
  document.querySelector('.foodReminder');

const foodEdit =
  foodCard?.querySelector('.futureButton');

if (foodEdit) {

  foodEdit.onclick = () => {

    const panel =
      $('foodSettings');

    if (!panel) return;

    panel.classList.remove('hidden');

    panel.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest'
    });
  };
}


const closeFoodSettings =
  $('closeFoodSettings');

if (closeFoodSettings) {

  closeFoodSettings.onclick = () => {

    $('foodSettings')
      .classList
      .add('hidden');
  };
}


// --------------------------------------------------
// FOOD ENABLE SWITCH
// --------------------------------------------------

const foodToggle =
  foodCard?.querySelector('input[type="checkbox"]');

if (foodToggle) {

  foodToggle.onchange = () => {

    status.textContent =
      foodToggle.checked
        ? 'Food reminder will be enabled after saving.'
        : 'Food reminders will be paused after saving.';
  };
}


// --------------------------------------------------
// SAVE FOOD
// --------------------------------------------------

const saveFood =
  $('saveFood');

if (saveFood) {

  saveFood.onclick = async () => {

    const first =
      $('firstFoodReminderTime').value;

    const start =
      $('foodStart').value;

    const end =
      $('foodEnd').value;


    if (!first || !start || !end) {

      status.textContent =
        'Please set the meal reminder, start, and end times.';

      return;
    }


    try {

      const s =
        await window.littleReminder.saveSettings({

          foodEnabled:
            foodToggle
              ? foodToggle.checked
              : false,

          firstFoodReminderTime:
            first,

          foodStart:
            start,

          foodEnd:
            end,

          foodIntervalMinutes:
            Number($('foodInterval').value),

          foodSnoozeMinutes:
            Number($('foodSnooze').value)
        });


      updateWaterCard(s);
      updateFoodCard(s);
      updateOverallNextReminder(s);


      const foodNext =
        s.nextFoodReminderAt ||
        null;


      if (s.foodEnabled) {

        status.textContent =
          '✓ Food schedule saved. Next meal reminder: ' +
          formatNextTime(foodNext) +
          '.';

      } else {

        status.textContent =
          '✓ Food schedule saved. Food reminders are paused.';
      }


      $('foodSettings')
        .classList
        .add('hidden');

    } catch (error) {

      console.error(
        'Failed to save Food settings:',
        error
      );

      status.textContent =
        'Could not save the Food schedule.';
    }
  };
}


// --------------------------------------------------
// FOOD PREVIEW
// --------------------------------------------------

const previewFood =
  $('previewFood');

if (previewFood) {

  previewFood.onclick = () => {

    status.textContent =
      '👩‍🍳 Food companion preview triggered.';

    window.littleReminder.previewFood();
  };
}


// --------------------------------------------------
// FUTURE REMINDERS
// --------------------------------------------------
// Food is now connected, so do NOT handle the Food
// button/toggle as a future reminder.

document
  .querySelectorAll('.futureButton')
  .forEach((button) => {

    if (button.closest('.foodReminder')) {
      return;
    }

    button.addEventListener('click', () => {

      status.textContent =
        'This reminder will be configurable in the next dashboard stage.';
    });
  });


document
  .querySelectorAll('.futureToggle')
  .forEach((toggle) => {

    if (toggle.closest('.foodReminder')) {
      return;
    }

    toggle.addEventListener('change', () => {

      toggle.checked = false;

      status.textContent =
        'This companion will become active when its reminder system is connected.';
    });
  });


// --------------------------------------------------
// ADD REMINDER
// --------------------------------------------------

const addReminder =
  $('addReminder');

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
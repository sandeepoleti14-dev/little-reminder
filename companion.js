const root = document.getElementById("companion");

const done = document.getElementById("done");
const snooze = document.getElementById("snooze");

const message = document.querySelector(".message");
const sub = document.querySelector(".sub");

function updateReminderContent(type) {

  if (type === "food") {

    message.textContent = "Come eat! 🍲";

    sub.textContent =
      "A warm meal is waiting for you.";

    done.textContent = "Meal Done";

  } else {

    message.textContent = "Time for Water 💧";

    sub.textContent =
      "Take a few sips and stay hydrated.";

    done.textContent = "Drink Done";
  }
}

function playEntrance(type = "water") {

  root.classList.remove("hidden");
  root.classList.remove("entering");
  root.classList.remove("foodMode");

  updateReminderContent(type);

  // Force browser to restart animations
  void root.offsetWidth;

  if (type === "food") {
    root.classList.add("foodMode");
  }

  root.classList.add("entering");
}

function hideCompanion() {

  root.classList.remove("entering");
  root.classList.remove("foodMode");

  root.classList.add("hidden");
}

window.littleReminder.onShowReminder((data) => {

  const type =
    data && data.type
      ? data.type
      : "water";

  playEntrance(type);
});

window.littleReminder.onHideReminder(() => {

  hideCompanion();

});

done.addEventListener("click", () => {

  root.classList.remove("entering");

  window.littleReminder.done();

});

snooze.addEventListener("click", () => {

  root.classList.remove("entering");

  window.littleReminder.snooze();

});
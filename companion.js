const root = document.getElementById("companion");

const done = document.getElementById("done");
const snooze = document.getElementById("snooze");


function playEntrance(){

  root.classList.remove("hidden");

  root.classList.remove("entering");

  /*
    Force the browser to restart
    the complete animation sequence.
  */
  void root.offsetWidth;

  root.classList.add("entering");
}


function hideCompanion(){

  root.classList.remove("entering");

  root.classList.add("hidden");
}


window.littleReminder.onShowReminder(() => {

  playEntrance();

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
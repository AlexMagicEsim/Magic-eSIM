/* Magic eSIM Mini App — the logo plays «Reveal + Wave» once, when the home screen first shows (owner, 2026-10-20).
   The hero logo carries .lm-play in the markup, so the animation starts with the screen and needs nothing from here
   to begin; a hidden screen's animation waits for display. This only drops the class once the lettering's animation
   has ended, so returning to the home tab later does not replay it. Interface motion is CSS only (mini.css, [data-motion]). */
(() => {
  'use strict';
  const logo = document.querySelector('.hero .brand-logo.lm-play');
  if (!logo) return;
  logo.addEventListener('animationend', (e) => {
    if (e.animationName === 'lm-word') logo.classList.remove('lm-play');
  });
})();

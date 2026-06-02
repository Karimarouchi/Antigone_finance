(function () {
  var t = localStorage.getItem('theme');
  if (t === 'dark') document.body.classList.add('dark');
  var p = localStorage.getItem('privacyMode');
  if (p === 'true') document.body.classList.add('privacy-mode');
})();

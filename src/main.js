try {
  const { Game } = await import('./core/Game.js');
  new Game();
} catch (error) {
  console.error('BIG BATTLES could not start', error);
  document.getElementById('load-status').textContent = 'تعذّر تشغيل اللعبة. أعد تحميل الصفحة بمتصفح حديث.';
  document.getElementById('load-line').hidden = true;
}

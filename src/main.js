try {
  const { Game } = await import('./core/Game.js');
  new Game();
} catch (error) {
  console.error('BIG BATTLES could not start', error);
  document.getElementById('load-status').textContent = /WebGL|context/i.test(error.message)
    ? 'العرض ثلاثي الأبعاد غير متاح في هذا المتصفح.'
    : 'تعذّر تحميل اللعبة. أعد تحميل الصفحة.';
  document.getElementById('load-line').hidden = true;
}

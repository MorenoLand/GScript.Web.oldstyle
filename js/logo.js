async function loadFont() {
  const fontUrl = '../fonts/tempus-sans-itc.ttf';
  const font = new FontFace('Tempus Sans ITC', `url(${fontUrl})`);
  await font.load();
  document.fonts.add(font);
}

async function loadLogo(containerId) {
  await loadFont();

  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 70;
  const ctx = canvas.getContext('2d');

  const text = 'Graal Statistics';
  const fontSize = 34;
  const textColor = '#f3c300';
  const shadowColor = '#000000';

  const icon = new Image();
  icon.src = '../gfx/login_icon_classic.png';
  await new Promise(resolve => icon.onload = resolve);

  const iconX = 10;
  const iconY = (canvas.height - 32) / 2;
  ctx.drawImage(icon, iconX, iconY, 32, 32);

  ctx.font = `${fontSize}px "Tempus Sans ITC"`;
  ctx.textBaseline = 'alphabetic';

  const waveRange = 5;
  const waveFrequency = 45;
  const charSpacing = 3;
  let currentX = iconX + 32 + 12;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const metrics = ctx.measureText(char);
    const charWidth = metrics.width;
    const yOffset = Math.sin((i * waveFrequency) * Math.PI / 180) * waveRange;

    ctx.shadowColor = shadowColor;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = shadowColor;
    ctx.fillText(char, currentX + 1, canvas.height / 2 + fontSize / 3 + yOffset + 1);

    ctx.shadowColor = 'transparent';
    ctx.fillStyle = textColor;
    ctx.fillText(char, currentX, canvas.height / 2 + fontSize / 3 + yOffset);

    currentX += charWidth + charSpacing;
  }

  const secondIconX = currentX + 16;
  const secondIconY = (canvas.height - 32) / 2 + 2;
  ctx.drawImage(icon, secondIconX, secondIconY, 32, 32);

  const container = document.getElementById(containerId);
  if (container) container.appendChild(canvas);
  return canvas;
}

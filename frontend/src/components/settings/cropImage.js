const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

/**
 * @param {string} src   data URL of the picked image
 * @param {{x:number,y:number,width:number,height:number}} area  pixel crop from react-easy-crop
 *
 * The area can extend past the picture when the user zooms out, so only the part
 * that overlaps the picture is drawn and the rest stays white.
 */
export async function cropToDataUrl(src, area, size = 512) {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, size, size);

  const scale = size / area.width;
  const sx = Math.max(0, area.x);
  const sy = Math.max(0, area.y);
  const sw = Math.min(img.naturalWidth, area.x + area.width) - sx;
  const sh = Math.min(img.naturalHeight, area.y + area.height) - sy;

  if (sw > 0 && sh > 0) {
    ctx.drawImage(
      img,
      sx,
      sy,
      sw,
      sh,
      (sx - area.x) * scale,
      (sy - area.y) * scale,
      sw * scale,
      sh * scale
    );
  }

  return canvas.toDataURL("image/jpeg", 0.92);
}
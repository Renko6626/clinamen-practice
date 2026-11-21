import { assetUrl } from './engine'

const FIELD_W = 384
const FIELD_H = 448
const HALF_W = FIELD_W / 2
const BAM_TO_RADIANS = Math.PI * 2 / 65536
const LASER_COLORS = [
  [164, 164, 164], [170, 40, 40], [255, 0, 0], [170, 40, 170],
  [255, 80, 255], [0, 0, 200], [0, 40, 255], [0, 200, 248],
  [0, 248, 248], [40, 180, 90], [0, 248, 120], [120, 248, 48],
  [200, 220, 60], [255, 240, 0], [255, 160, 40], [255, 255, 255],
]
const LASER_BANDS = 5
const laserPalettes = LASER_COLORS.map(base => ({
  warning: `rgb(${base.map(c => Math.round(c * .8)).join(' ')})`,
  bands: Array.from({ length: LASER_BANDS }, (_, i) => {
    const white = ((i + 1) / LASER_BANDS) ** 2
    const channels = base.map(c => Math.round((c + (255 - c) * white) * 1.6 / LASER_BANDS))
    return `rgb(${channels.join(' ')})`
  }),
}))

async function loadImage(path, version) {
  const image = new Image()
  image.src = assetUrl(path, version).href
  try {
    await image.decode()
  } catch {
    throw new Error(`无法加载贴图 ${path}`)
  }
  return image
}

export async function openRenderer(canvas, manifest) {
  const { cellSize, columns, rows } = manifest.atlas
  const [atlas, player] = await Promise.all([
    loadImage('bullets.png', manifest.version),
    loadImage('player.png', manifest.version),
  ])
  const ctx = canvas.getContext('2d')
  ctx.setTransform(canvas.width / FIELD_W, 0, 0, canvas.height / FIELD_H, 0, 0)
  const halfCell = cellSize / 2
  const spriteMargin = cellSize * Math.SQRT1_2

  return function render(frame) {
    ctx.clearRect(0, 0, FIELD_W, FIELD_H)
    if (!frame?.length) return

    const [, px, py, hitRadius, focus, bulletCount, enemyCount, laserCount] = frame
    const enemyStart = 8 + bulletCount * 4
    const laserStart = enemyStart + enemyCount * 3

    ctx.save()
    ctx.translate(HALF_W, 0)

    for (let i = 0, pos = enemyStart; i < enemyCount; i++, pos += 3) {
      const radius = Math.min(24, Math.max(8, frame[pos + 2]))
      ctx.beginPath()
      ctx.arc(frame[pos], frame[pos + 1], radius, 0, Math.PI * 2)
      ctx.strokeStyle = '#92d7a4'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    ctx.drawImage(player, px - player.width / 2, py - player.height / 2)
    drawLasers(ctx, frame, laserStart, laserCount)

    for (let i = 0, pos = 8; i < bulletCount; i++, pos += 4) {
      const x = frame[pos]
      const y = frame[pos + 1]
      if (Math.abs(x) > HALF_W + spriteMargin || y < -spriteMargin || y > FIELD_H + spriteMargin) continue
      const sprite = frame[pos + 2] % (columns * rows)
      const sx = (sprite % columns) * cellSize
      const sy = Math.floor(sprite / columns) * cellSize
      ctx.save()
      ctx.translate(x, y)
      // Atlas artwork points up while the engine's zero angle points right.
      ctx.rotate(frame[pos + 3] * BAM_TO_RADIANS + Math.PI / 2)
      ctx.drawImage(atlas, sx, sy, cellSize, cellSize, -halfCell, -halfCell, cellSize, cellSize)
      ctx.restore()
    }

    if (focus) {
      ctx.beginPath()
      ctx.arc(px, py, hitRadius, 0, Math.PI * 2)
      ctx.fillStyle = '#fff'
      ctx.fill()
      ctx.strokeStyle = '#ff4d4d'
      ctx.lineWidth = 1
      ctx.stroke()
    }
    ctx.restore()
  }
}

function drawLasers(ctx, frame, start, count) {
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0, pos = start; i < count; i++, pos += 8) {
    const [ax, ay, bx, by, width, state, alpha, color] = frame.subarray(pos, pos + 8)
    if (width <= 0 || alpha <= 0 || (ax === bx && ay === by)) continue
    const palette = laserPalettes[color % 16]
    ctx.globalAlpha = alpha
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.lineTo(bx, by)
    if (width < 3) {
      ctx.lineWidth = state === 0 ? 1.2 : width
      ctx.strokeStyle = palette.warning
      ctx.stroke()
    } else {
      for (let band = 0; band < LASER_BANDS; band++) {
        ctx.lineWidth = width * (1 - band / LASER_BANDS)
        ctx.strokeStyle = palette.bands[band]
        ctx.stroke()
      }
    }
  }
  ctx.restore()
}

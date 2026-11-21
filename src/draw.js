const colors = [
  '#d6c5ff', '#ff9dd4', '#ff788a', '#ffb7d6',
  '#ab9aff', '#a5b6ff', '#80d8ff', '#9ffaff',
  '#86f0bc', '#b1f4a0', '#dcf69d', '#fdf0a3',
  '#ffd380', '#ffad85', '#ffcbec', '#edf4ff',
]

export function drawFrame(canvas, frame) {
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (!frame?.length) return

  const [, px, py, hitRadius, focus, bulletCount, enemyCount, laserCount] = frame
  ctx.save()
  ctx.translate(192, 0)

  const enemyStart = 8 + bulletCount * 5
  const laserStart = enemyStart + enemyCount * 3
  for (let i = 0, pos = enemyStart; i < enemyCount; i++, pos += 3) {
    const radius = Math.min(24, Math.max(7, frame[pos + 2]))
    ctx.beginPath()
    ctx.arc(frame[pos], frame[pos + 1], radius, 0, Math.PI * 2)
    ctx.fillStyle = '#312456'
    ctx.fill()
    ctx.strokeStyle = '#bfa7fb'
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  for (let i = 0, pos = laserStart; i < laserCount; i++, pos += 8) {
    const [x1, y1, x2, y2, width, state, alpha, color] = frame.subarray(pos, pos + 8)
    if (width <= 0 || alpha <= 0) continue
    ctx.strokeStyle = colors[color]
    ctx.lineWidth = state === 0 ? 1.5 : width
    ctx.globalAlpha = state === 0 ? 0.75 : alpha * 0.78
    ctx.setLineDash(state === 0 ? [5, 4] : [])
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }
  ctx.setLineDash([])

  for (let i = 0, pos = 8; i < bulletCount; i++, pos += 5) {
    const x = frame[pos]
    const y = frame[pos + 1]
    const radius = Math.max(1.8, frame[pos + 2])
    if (x + radius < -192 || x - radius > 192 || y + radius < 0 || y - radius > 448) continue
    ctx.globalAlpha = frame[pos + 4] ? 0.4 : 1
    ctx.fillStyle = colors[frame[pos + 3]]
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
    if (radius >= 2.6) {
      ctx.fillStyle = '#fff9f5'
      ctx.beginPath()
      ctx.arc(x, y, radius * 0.31, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  ctx.globalAlpha = 1
  ctx.beginPath()
  ctx.moveTo(px, py - 10)
  ctx.lineTo(px + 7, py + 7)
  ctx.lineTo(px, py + 3)
  ctx.lineTo(px - 7, py + 7)
  ctx.closePath()
  ctx.fillStyle = '#ddc5ff'
  ctx.fill()
  ctx.strokeStyle = '#261c3c'
  ctx.lineWidth = 1
  ctx.stroke()
  if (focus) {
    ctx.beginPath()
    ctx.arc(px, py, hitRadius, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'
    ctx.fill()
    ctx.strokeStyle = '#6a3edd'
    ctx.stroke()
  }
  ctx.restore()
}

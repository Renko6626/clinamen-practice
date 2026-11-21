<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { openRenderer } from './draw'
import { fetchAsset, keys, openEngine } from './engine'

const titles = {
  th06: '红魔乡',
  th14: '辉针城',
  th15: '绀珠传',
  th16: '天空璋',
  th18: '虹龙洞',
  synthetic: '合成练习',
  unknown: '其他',
}
const rankNames = ['Easy', 'Normal', 'Hard', 'Lunatic', 'Extra']
const results = ['', '中弹', '撑过段落', '达到时间上限']
const sortIds = new Intl.Collator('en', { numeric: true })
const STEP_MS = 1000 / 60

const catalog = ref(null)
const source = ref('')
const stage = ref('all')
const card = ref(null)
const rank = ref(2)
const mark = ref(0)
const canvas = ref(null)
const state = ref('connecting')
const frame = ref(0)
const outcome = ref(0)
const feedback = ref('')
const copied = ref(false)
const error = ref('')

const sourceOrder = Object.keys(titles)
const sources = computed(() => [...new Set(catalog.value?.cards.map(item => item.source) ?? [])]
  .sort((a, b) => sourceOrder.indexOf(a) - sourceOrder.indexOf(b)))
const sourceCards = computed(() => catalog.value?.cards.filter(item => item.source === source.value) ?? [])
const stages = computed(() => [...new Set(sourceCards.value.map(item => item.stage))].sort(
  (a, b) => (a ?? Infinity) - (b ?? Infinity),
))
const visibleCards = computed(() => sourceCards.value
  .filter(item => stage.value === 'all' || item.stage === stage.value)
  .sort((a, b) => sortIds.compare(a.id, b.id)))
const stageName = value => value === null ? '独立练习' : value === 7 ? 'Extra' : `第 ${value} 面`
const time = computed(() => (frame.value / 60).toFixed(1))
const isPlaying = computed(() => state.value === 'running')
const statusText = computed(() => {
  if (state.value === 'finished') return results[outcome.value]
  return {
    connecting: '加载引擎',
    ready: '准备',
    loading: '加载段落',
    running: '挑战中',
    paused: '已暂停',
    failed: '加载失败',
  }[state.value]
})

let engine
let renderFrame
let loadedCard
let attempt
let pendingLoad = 0
let animation = 0
let previous = 0
let accrued = 0
const down = new Set()

function resetSelection() {
  pendingLoad++
  stopClock()
  outcome.value = 0
  frame.value = 0
  attempt = null
  feedback.value = ''
  copied.value = false
  error.value = ''
  state.value = 'ready'
  renderFrame()
}

function chooseCard(next) {
  if (card.value === next) return
  card.value = next
  rank.value = next.ranks.includes(2) ? 2 : next.ranks.at(-1)
  mark.value = next.marks[0]
  resetSelection()
}

function setSource(next) {
  if (source.value === next) return
  source.value = next
  stage.value = 'all'
  chooseCard(visibleCards.value[0])
}

function setStage(next) {
  stage.value = next === 'standalone' ? null : next === 'all' ? next : Number(next)
  if (!visibleCards.value.includes(card.value)) chooseCard(visibleCards.value[0])
}

function paint() {
  const view = engine.frame()
  renderFrame(view)
  frame.value = view[0]
}

function stopClock() {
  cancelAnimationFrame(animation)
  down.clear()
  previous = 0
  accrued = 0
}

function tick(now) {
  if (!isPlaying.value) return
  if (previous) accrued += Math.min(now - previous, 100)
  previous = now
  let advanced = false
  while (accrued >= STEP_MS) {
    let buttons = 0
    for (const code of down) buttons |= keys[code]
    outcome.value = engine.step(buttons)
    advanced = true
    accrued -= STEP_MS
    if (outcome.value) {
      state.value = 'finished'
      stopClock()
      break
    }
  }
  if (advanced) paint()
  if (isPlaying.value) animation = requestAnimationFrame(tick)
}

function beginClock() {
  state.value = 'running'
  canvas.value.focus({ preventScroll: true })
  animation = requestAnimationFrame(tick)
}

function pause() {
  down.clear()
  if (!isPlaying.value) return
  stopClock()
  state.value = 'paused'
}

async function start(retry = false) {
  const next = card.value
  const previousSeed = attempt?.seed
  resetSelection()
  const request = pendingLoad
  state.value = 'loading'
  try {
    if (loadedCard !== next.id) {
      const response = await fetchAsset(`cards/${next.id}.json`, catalog.value.version)
      const sourceBytes = await response.arrayBuffer()
      if (request !== pendingLoad) return
      engine.loadCard(sourceBytes)
      loadedCard = next.id
    }

    const seed = retry && previousSeed !== undefined
      ? previousSeed
      : crypto.getRandomValues(new BigUint64Array(1))[0]
    engine.start(rank.value, mark.value, seed)
    attempt = { card: next, rank: rank.value, mark: mark.value, seed }
    paint()
    if (document.hidden || !document.hasFocus()) {
      state.value = 'paused'
    } else {
      beginClock()
    }
  } catch (cause) {
    if (request !== pendingLoad) return
    state.value = 'ready'
    error.value = cause.message
  }
}

async function copyFeedback() {
  if (!attempt) return
  pause()
  copied.value = false
  const reported = attempt
  const details = [
    `弹幕反馈 · ${attempt.card.title}`,
    `卡 ID ${attempt.card.id} · ${rankNames[attempt.rank]} · 起点 ${attempt.mark}`,
    `种子 ${attempt.seed} · 第 ${frame.value} 帧`,
    `构建 ${catalog.value.version}${outcome.value ? ` · ${results[outcome.value]}` : ''}`,
    '观察：',
  ].join('\n')
  try {
    await navigator.clipboard.writeText(details)
    if (attempt === reported) copied.value = true
  } catch {
    if (attempt === reported) feedback.value = details
  }
}

function keydown(event) {
  if (event.code === 'Escape') {
    pause()
    return
  }
  if (!(event.code in keys) || !isPlaying.value) return
  if (event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return
  event.preventDefault()
  down.add(event.code)
}

function keyup(event) {
  down.delete(event.code)
}

function handleVisibility() {
  if (document.hidden) pause()
}

onMounted(async () => {
  window.addEventListener('keydown', keydown)
  window.addEventListener('keyup', keyup)
  window.addEventListener('blur', pause)
  document.addEventListener('visibilitychange', handleVisibility)
  try {
    const response = await fetchAsset('manifest.json')
    catalog.value = await response.json()
    const [readyEngine, readyRenderer] = await Promise.all([
      openEngine(catalog.value),
      openRenderer(canvas.value, catalog.value),
    ])
    engine = readyEngine
    renderFrame = readyRenderer
    setSource(sources.value[0])
  } catch (cause) {
    error.value = cause.message
    state.value = 'failed'
  }
})

onUnmounted(() => {
  pendingLoad++
  stopClock()
  window.removeEventListener('keydown', keydown)
  window.removeEventListener('keyup', keyup)
  window.removeEventListener('blur', pause)
  document.removeEventListener('visibilitychange', handleVisibility)
})
</script>

<template>
  <main class="practice">
    <header class="page-head">
      <h1>Clinamen <span>弹幕练习场</span></h1>
    </header>

    <div class="practice-layout">
      <aside class="library" aria-label="段落库">
        <div class="rail-head">
          <h2>选择段落</h2>
          <span v-if="source">{{ visibleCards.length }} 段</span>
        </div>

        <div class="source-list" role="group" aria-label="作品">
          <button
            v-for="value in sources"
            :key="value"
            type="button"
            :disabled="!engine"
            :aria-pressed="source === value"
            @click="setSource(value)"
          >{{ titles[value] ?? value }}</button>
        </div>

        <label v-if="source" class="setting-row">
          <span>关卡</span>
          <select :value="stage ?? 'standalone'" @change="setStage($event.target.value)">
            <option value="all">全部关卡</option>
            <option v-for="value in stages" :key="value" :value="value ?? 'standalone'">{{ stageName(value) }}</option>
          </select>
        </label>

        <ul v-if="visibleCards.length" class="card-list">
          <li v-for="item in visibleCards" :key="item.id">
            <button type="button" :aria-pressed="card === item" @click="chooseCard(item)">
              <span>{{ item.title }}</span>
              <small v-if="stage === 'all'">{{ stageName(item.stage) }}</small>
            </button>
          </li>
        </ul>
        <p v-else class="library-empty">{{ state === 'failed' ? '卡库加载失败' : '正在载入卡库…' }}</p>
      </aside>

      <section class="game" aria-label="战场">
        <div class="screen-status">
          <span><i :class="{ active: isPlaying }"></i>{{ statusText }}</span>
          <span class="timer">{{ time }} <span>秒</span></span>
        </div>

        <div class="arena">
          <canvas ref="canvas" width="768" height="896" tabindex="0" aria-label="弹幕画面"></canvas>
          <div v-if="!isPlaying" class="arena-overlay" :class="{ paused: state === 'paused' || state === 'finished' }">
            <div v-if="state === 'finished'" class="finish">
              <strong>{{ results[outcome] }}</strong>
              <span>存活 {{ time }} 秒</span>
            </div>
            <p v-if="error" class="error" role="alert">{{ error }}</p>
            <button v-if="state === 'ready'" class="primary" type="button" @click="start()">开始挑战</button>
            <button v-else-if="state === 'paused'" class="primary" type="button" @click="beginClock">继续挑战</button>
            <button v-else-if="state === 'finished'" class="primary" type="button" @click="start(true)">同种子重试</button>
            <span v-else-if="state === 'loading' || state === 'connecting'" role="status">{{ statusText }}…</span>
          </div>
        </div>
      </section>

      <aside class="controls" aria-label="对局设置">
        <section v-if="card" class="current-card">
          <div class="rail-head"><h2>当前段落</h2></div>
          <p class="game-source">{{ titles[card.source] ?? card.source }} / {{ stageName(card.stage) }}</p>
          <p class="game-title">{{ card.title }}</p>
          <label class="setting-row">
            <span>难度</span>
            <select v-model.number="rank" @change="resetSelection">
              <option v-for="value in card.ranks" :key="value" :value="value">{{ rankNames[value] }}</option>
            </select>
          </label>
          <label v-if="card.marks.length > 1" class="setting-row">
            <span>起点</span>
            <select v-model.number="mark" @change="resetSelection">
              <option v-for="value in card.marks" :key="value" :value="value">{{ value }}</option>
            </select>
          </label>
        </section>

        <section class="key-settings">
          <div class="rail-head"><h2>键位</h2></div>
          <dl class="key-guide">
            <div><dt>移动</dt><dd><kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd></dd></div>
            <div><dt>射击</dt><dd><kbd>Z</kbd></dd></div>
            <div><dt>低速</dt><dd><span>按住</span><kbd>Shift</kbd></dd></div>
            <div><dt>暂停</dt><dd><kbd>Esc</kbd></dd></div>
          </dl>
        </section>

        <div v-if="attempt" class="session-actions">
          <button v-if="state === 'paused'" type="button" @click="start(true)">同种子重试</button>
          <button v-if="state === 'finished'" type="button" @click="start()">换种子</button>
          <button type="button" @click="copyFeedback">{{ copied ? '已复制' : '复制反馈' }}</button>
        </div>
        <label v-if="feedback" class="feedback">
          <span>复制以下内容，补充你看到的情况。</span>
          <textarea :value="feedback" rows="6" readonly @focus="$event.target.select()"></textarea>
        </label>
      </aside>
    </div>
  </main>
</template>

export const keys = {
  ArrowUp: 1 << 0,
  ArrowDown: 1 << 1,
  ArrowLeft: 1 << 2,
  ArrowRight: 1 << 3,
  KeyZ: 1 << 4,
  ShiftLeft: 1 << 6,
  ShiftRight: 1 << 6,
}

export async function fetchAsset(path, version) {
  const url = new URL(`${import.meta.env.BASE_URL}practice/${path}`, document.baseURI)
  if (version) url.searchParams.set('v', version)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`无法加载 ${path}（HTTP ${response.status}）`)
  return response
}

export async function openEngine(manifest) {
  const response = await fetchAsset('engine.wasm', manifest.version)
  const { instance } = await WebAssembly.instantiate(await response.arrayBuffer())
  const wasm = instance.exports
  const tablesHash = BigInt.asUintN(64, wasm.tables_hash()).toString(16).padStart(16, '0')
  if (wasm.engine_version() !== manifest.engineVersion || tablesHash !== manifest.tablesHash) {
    throw new Error('引擎与卡库版本不匹配')
  }

  function readError() {
    const bytes = new Uint8Array(wasm.memory.buffer, wasm.error_ptr(), wasm.error_len())
    return new Error(new TextDecoder().decode(bytes))
  }

  return {
    loadCard(source) {
      const offset = wasm.source_buffer(source.byteLength)
      new Uint8Array(wasm.memory.buffer, offset, source.byteLength).set(new Uint8Array(source))
      if (!wasm.load_card()) throw readError()
    },
    start(rank, mark, seed) {
      if (!wasm.start_game(rank, mark, seed, manifest.maxFrames)) throw readError()
    },
    step: wasm.step_game,
    frame() {
      const offset = wasm.frame_buffer()
      return new Float32Array(wasm.memory.buffer, offset, wasm.frame_len())
    },
  }
}

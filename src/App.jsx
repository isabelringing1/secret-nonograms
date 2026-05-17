import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const DEFAULT_SIZE = 10
const EMPTY = 0
const FILLED = 1
const CROSSED = 2

function generatePuzzle(size, density = 0.55) {
  while (true) {
    let s = ''
    for (let i = 0; i < size * size; i++) {
      s += Math.random() < density ? '1' : '0'
    }
    console.log(s)
    if (s.includes('1')) return s
  }
}

function getClues(line) {
  const clues = []
  let count = 0
  for (const v of line) {
    if (v === 1) {
      count++
    } else if (count > 0) {
      clues.push(count)
      count = 0
    }
  }
  if (count > 0) clues.push(count)
  if (clues.length === 0) clues.push(0)
  return clues
}

function textToBinary(text) {
  let bits = ''
  for (let i = 0; i < text.length; i++) {
    bits += (text.charCodeAt(i) & 0xff).toString(2).padStart(8, '0')
  }
  return bits
}

function decodePuzzleFromUrl() {
  if (typeof window === 'undefined') return null
  const raw = window.location.pathname.slice(1)
  if (!raw) return null
  let decoded
  try {
    decoded = atob(decodeURIComponent(raw))
  } catch {
    return null
  }
  if (!/^[01]+$/.test(decoded)) return null
  const side = Math.sqrt(decoded.length)
  if (!Number.isInteger(side) || side < 1) return null
  return decoded
}

function getInitialPuzzle() {
  return decodePuzzleFromUrl() ?? generatePuzzle(DEFAULT_SIZE)
}

function App() {
  const [mode, setMode] = useState('puzzle')
  const [secretInput, setSecretInput] = useState('')
  const [showGiveUpModal, setShowGiveUpModal] = useState(false)
  const [hints, setHints] = useState(() => new Set())
  const [generatedUrl, setGeneratedUrl] = useState(null)
  const [copied, setCopied] = useState(false)
  const [puzzle, setPuzzle] = useState(getInitialPuzzle)
  const [cells, setCells] = useState(() => Array(puzzle.length).fill(EMPTY))

  const size = Math.round(Math.sqrt(puzzle.length))

  const sectionSize =
    size % 5 === 0 ? 5 : size % 4 === 0 ? 4 : size % 3 === 0 ? 3 : 2

  const { rowClues, colClues } = useMemo(() => {
    const grid = []
    for (let r = 0; r < size; r++) {
      const row = []
      for (let c = 0; c < size; c++) {
        row.push(puzzle[r * size + c] === '1' ? 1 : 0)
      }
      grid.push(row)
    }
    const rows = grid.map(getClues)
    const cols = Array.from({ length: size }, (_, c) =>
      getClues(grid.map((r) => r[c])),
    )
    return { rowClues: rows, colClues: cols }
  }, [puzzle, size])

  const solved = useMemo(
    () =>
      cells.every((s, i) => (s === FILLED) === (puzzle[i] === '1')),
    [cells, puzzle],
  )

  const secretMessage = useMemo(() => {
    const bits = cells.map((s) => (s === FILLED ? '1' : '0')).join('')
    let out = ''
    for (let i = 0; i + 8 <= bits.length; i += 8) {
      out += String.fromCharCode(parseInt(bits.slice(i, i + 8), 2))
    }
    return out
  }, [cells])

  const maxRowClues = Math.max(...rowClues.map((c) => c.length), 1)
  const maxColClues = Math.max(...colClues.map((c) => c.length), 1)

  const dragTargetRef = useRef(null)

  useEffect(() => {
    const end = () => {
      dragTargetRef.current = null
    }
    window.addEventListener('mouseup', end)
    window.addEventListener('blur', end)
    return () => {
      window.removeEventListener('mouseup', end)
      window.removeEventListener('blur', end)
    }
  }, [])

  function paintCell(i, target) {
    setCells((prev) => {
      if (prev[i] === target) return prev
      const next = prev.slice()
      next[i] = target
      return next
    })
  }

  function handleMouseDown(i, e) {
    if (solved) return
    if (e.button !== 0 && e.button !== 2) return
    e.preventDefault()
    const current = cells[i]
    const wanted = e.button === 2 ? CROSSED : FILLED
    const target = current === wanted ? EMPTY : wanted
    dragTargetRef.current = target
    paintCell(i, target)
  }

  function handleMouseEnter(i) {
    if (solved) return
    const target = dragTargetRef.current
    if (target === null) return
    paintCell(i, target)
  }

  function startOver() {
    const next = Array(size * size).fill(EMPTY)
    for (const i of hints) next[i] = FILLED
    setCells(next)
  }

  function newPuzzle() {
    const next = generatePuzzle(size)
    setPuzzle(next)
    setCells(Array(size * size).fill(EMPTY))
    setHints(new Set())
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/')
    }
  }

  function solvePuzzle() {
    setCells(Array.from(puzzle, (ch) => (ch === '1' ? FILLED : EMPTY)))
    setShowGiveUpModal(false)
  }

  function giveHint() {
    if (solved) return
    const candidates = []
    for (let i = 0; i < puzzle.length; i++) {
      if (puzzle[i] === '1' && !hints.has(i)) candidates.push(i)
    }
    if (candidates.length === 0) return
    const pick = candidates[Math.floor(Math.random() * candidates.length)]
    setHints((prev) => {
      const next = new Set(prev)
      next.add(pick)
      return next
    })
    setCells((prev) => {
      if (prev[pick] === FILLED) return prev
      const next = prev.slice()
      next[pick] = FILLED
      return next
    })
  }

  const gridStyle = {
    gridTemplateColumns: `repeat(${maxRowClues}, var(--clue-size)) repeat(${size}, var(--cell-size))`,
    gridTemplateRows: `repeat(${maxColClues}, var(--clue-size)) repeat(${size}, var(--cell-size))`,
  }

  if (mode === 'create') {
    const computeSize = (textLen) => {
      const bits = textLen * 8
      if (bits === 0) return 0
      const minSide = Math.ceil(Math.sqrt(bits))
      return minSide % 2 === 0 ? minSide : minSide + 1
    }

    const previewSize = computeSize(secretInput.length)

    const buildPadded = () => {
      const bits = textToBinary(secretInput)
      if (bits.length === 0) return null
      const newSize = computeSize(secretInput.length)
      return bits.padEnd(newSize * newSize, '0')
    }

    const generate = () => {
      const padded = buildPadded()
      if (!padded) return
      const encoded = btoa(padded)
      setGeneratedUrl(`${window.location.origin}/${encoded}`)
    }

    const playGenerated = () => {
      const padded = buildPadded()
      if (!padded) return
      setPuzzle(padded)
      setCells(Array(padded.length).fill(EMPTY))
      setHints(new Set())
      setMode('puzzle')
      setGeneratedUrl(null)
      window.history.replaceState({}, '', `/${btoa(padded)}`)
    }

    const copyLink = async () => {
      if (!generatedUrl || !navigator.clipboard) return
      try {
        await navigator.clipboard.writeText(generatedUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      } catch {
        // clipboard blocked
      }
    }

    const sharePuzzle = async () => {
      if (!generatedUrl) return
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Secret Message Nonogram',
            url: generatedUrl,
          })
        } catch {
          // user dismissed or share failed
        }
      } else if (navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(generatedUrl)
        } catch {
          // clipboard blocked
        }
      }
    }

    return (
      <main className="app">
        <h1>Secret Message Nonograms</h1>
        <div className="create-puzzle">
          <label className="create-label" htmlFor="secret-input">
            Write your secret message
          </label>
          <p className="create-subtitle">
            Hint: Smaller message make for easier puzzles!
          </p>
          <input
            id="secret-input"
            type="text"
            className="create-input"
            value={secretInput}
            autoFocus
            onChange={(e) => {
              const text = e.target.value
              setSecretInput(text)
              setGeneratedUrl(null)
              console.log(textToBinary(text))
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') generate()
            }}
          />
          {previewSize > 0 && (
            <p className="create-size">
              Size: {previewSize}x{previewSize}
            </p>
          )}

          {!generatedUrl && (
            <div className="controls">
              <button
                type="button"
                onClick={generate}
                disabled={secretInput.length === 0}
              >
                Generate
              </button>
            </div>
          )}

          {generatedUrl && (
            <>
              <div className="generated-url">{generatedUrl}</div>
              <div className="controls">
                <button type="button" onClick={sharePuzzle}>
                  Share
                </button>
                <button type="button" onClick={copyLink}>
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
                <button type="button" onClick={playGenerated}>
                  Play
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    )
  }

  return (
    <main className="app">
      <h1>Secret Message Nonograms</h1>

      <div
        className="nonogram"
        style={gridStyle}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          className="corner"
          style={{
            gridColumn: `1 / ${maxRowClues + 1}`,
            gridRow: `1 / ${maxColClues + 1}`,
          }}
        />

        {colClues.map((clues, c) => {
          const classes = ['col-clue']
          if (c > 0 && c % sectionSize === 0) classes.push('thick-left')
          if (c === size - 1) classes.push('thick-right')
          return (
            <div
              key={`col-${c}`}
              className={classes.join(' ')}
              style={{
                gridColumn: maxRowClues + c + 1,
                gridRow: `1 / ${maxColClues + 1}`,
              }}
            >
              <div className="clue-stack">
                {clues.map((n, i) => (
                  <span key={i}>{n}</span>
                ))}
              </div>
            </div>
          )
        })}

        {rowClues.map((clues, r) => {
          const classes = ['row-clue']
          if (r > 0 && r % sectionSize === 0) classes.push('thick-top')
          if (r === size - 1) classes.push('thick-bottom')
          return (
            <div
              key={`row-${r}`}
              className={classes.join(' ')}
              style={{
                gridColumn: `1 / ${maxRowClues + 1}`,
                gridRow: maxColClues + r + 1,
              }}
            >
              <div className="clue-row">
                {clues.map((n, i) => (
                  <span key={i}>{n}</span>
                ))}
              </div>
            </div>
          )
        })}

        {cells.map((state, i) => {
          const r = Math.floor(i / size)
          const c = i % size
          const isHint = hints.has(i)
          const classes = ['cell']
          if (state === FILLED) classes.push('filled')
          if (state === CROSSED) classes.push('crossed')
          if (isHint) classes.push('hint')
          if (c > 0 && c % sectionSize === 0) classes.push('thick-left')
          if (r > 0 && r % sectionSize === 0) classes.push('thick-top')
          if (c === size - 1) classes.push('thick-right')
          if (r === size - 1) classes.push('thick-bottom')
          return (
            <button
              key={i}
              type="button"
              className={classes.join(' ')}
              style={{
                gridColumn: maxRowClues + c + 1,
                gridRow: maxColClues + r + 1,
              }}
              disabled={solved || isHint}
              onMouseDown={(e) => handleMouseDown(i, e)}
              onMouseEnter={() => handleMouseEnter(i)}
              onContextMenu={(e) => e.preventDefault()}
            >
              {state === CROSSED ? '×' : ''}
            </button>
          )
        })}
      </div>

      {solved && <p className="solved">You solved it!</p>}

      <div className="secret-message">
        <span className="secret-label">Secret Message: </span>
        <span className="secret-text">{secretMessage}</span>
      </div>

      <div className="controls">
        <div className="button-row">
          <button type="button" onClick={startOver}>
            Start Over
          </button>
          <button type="button" onClick={newPuzzle}>
            Random Puzzle
          </button>
        </div>
        <div className="button-row">
          <button type="button" onClick={giveHint}>
            Gimme a hint!
          </button>
          <button type="button" onClick={() => setShowGiveUpModal(true)}>
            Give Up
          </button>
          <button type="button" onClick={() => setMode('create')}>
            Make a secret puzzle
          </button>
        </div>
      </div>

      {showGiveUpModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowGiveUpModal(false)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <p className="modal-text">
              Are you sure you want to solve this puzzle?
            </p>
            <div className="modal-actions">
              <button type="button" onClick={solvePuzzle}>
                Yes
              </button>
              <button
                type="button"
                onClick={() => setShowGiveUpModal(false)}
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default App

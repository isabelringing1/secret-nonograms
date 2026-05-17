import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const DEFAULT_SIZE = 15
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

function App() {
  const [puzzle, setPuzzle] = useState(() => generatePuzzle(DEFAULT_SIZE))
  const [cells, setCells] = useState(() =>
    Array(DEFAULT_SIZE * DEFAULT_SIZE).fill(EMPTY),
  )

  const size = Math.round(Math.sqrt(puzzle.length))

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
    setCells(Array(size * size).fill(EMPTY))
  }

  function newPuzzle() {
    const next = generatePuzzle(size)
    setPuzzle(next)
    setCells(Array(size * size).fill(EMPTY))
  }

  const gridStyle = {
    gridTemplateColumns: `repeat(${maxRowClues}, var(--clue-size)) repeat(${size}, var(--cell-size))`,
    gridTemplateRows: `repeat(${maxColClues}, var(--clue-size)) repeat(${size}, var(--cell-size))`,
  }

  return (
    <main className="app">
      <h1>Nonograms</h1>

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
          if (c > 0 && c % 5 === 0) classes.push('thick-left')
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
          if (r > 0 && r % 5 === 0) classes.push('thick-top')
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
          const classes = ['cell']
          if (state === FILLED) classes.push('filled')
          if (state === CROSSED) classes.push('crossed')
          if (c > 0 && c % 5 === 0) classes.push('thick-left')
          if (r > 0 && r % 5 === 0) classes.push('thick-top')
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
              disabled={solved}
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

      <div className="controls">
        <button type="button" onClick={startOver}>
          Start Over
        </button>
        <button type="button" onClick={newPuzzle}>
          New Puzzle
        </button>
      </div>
    </main>
  )
}

export default App

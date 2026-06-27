import { useState, useRef, useEffect } from 'react'

interface Props {
  label: string
  options: string[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

// ── SearchableSelect ─────────────────────────────────────────
// Purpose: Combobox-like input with text filtering and dropdown list.
// Props: label: string; options: string[]; value: string; onChange: (value) => void; placeholder?: string
function SearchableSelect({ label, options, value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const ref = useRef<HTMLDivElement>(null)

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(query.toLowerCase())
  )

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const select = (option: string) => {
    onChange(option)
    setQuery(option)
    setOpen(false)
  }

  return (
    <div className="searchable-select" ref={ref}>
      <label>{label}</label>
      <input
        type="text"
        placeholder={placeholder || 'Search...'}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          onChange('')
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <ul className="searchable-select-options">
          {filtered.map((o) => (
            <li
              key={o}
              className={o === value ? 'selected' : ''}
              onMouseDown={() => select(o)}
            >
              {o}
            </li>
          ))}
        </ul>
      )}
      {open && filtered.length === 0 && query && (
        <ul className="searchable-select-options">
          <li className="no-match">No matches found</li>
        </ul>
      )}
    </div>
  )
}

export default SearchableSelect

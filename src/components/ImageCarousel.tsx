import { useState, useEffect, useCallback, useRef } from 'react'
import hero from '../assets/placeholder.png'

interface Slide {
  image: string
  title: string
  subtitle: string
}

const slides: Slide[] = [
  {
    image: hero,
    title: 'Streamline Your Workflow',
    subtitle: 'Manage projects, tasks, and teams all in one place.',
  },
  {
    image: hero,
    title: 'Collaborate in Real Time',
    subtitle: 'Keep everyone on the same page with instant updates.',
  },
  {
    image: hero,
    title: 'Data-Driven Decisions',
    subtitle: 'Track progress with powerful analytics and reports.',
  },
]

// ── ImageCarousel ────────────────────────────────────────────
// Purpose: Auto-rotating hero image carousel with navigation arrows and dots; supports compact mode.
// Props: compact?: boolean — hides controls and shows first slide only
function ImageCarousel({ compact }: { compact?: boolean }) {
  const [current, setCurrent] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  const startTimer = useCallback(() => {
    if (compact) return
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % slides.length)
    }, 5000)
  }, [compact])

  useEffect(() => {
    startTimer()
    return () => clearInterval(timerRef.current)
  }, [startTimer])

  const goTo = (i: number) => {
    setCurrent(i)
    startTimer()
  }

  const next = () => goTo((current + 1) % slides.length)
  const prev = () => goTo((current - 1 + slides.length) % slides.length)

  return (
    <div className={`carousel${compact ? ' compact' : ''}`}>
      {slides.map((slide, i) => (
        <div
          key={i}
          className={`carousel-slide${(!compact && i === current) || (compact && i === 0) ? ' active' : ''}`}
        >
          <img src={slide.image} alt="" className="carousel-image" />
          <div className="carousel-overlay" />
          <div className="carousel-content">
            <p className="carousel-subtitle">{slide.subtitle}</p>
            <h2 className="carousel-title">{slide.title}</h2>
          </div>
        </div>
      ))}

      {!compact && (
        <>
          <button
            type="button"
            className="carousel-btn carousel-btn-prev"
            onClick={prev}
            aria-label="Previous slide"
          >
            &#8249;
          </button>
          <button
            type="button"
            className="carousel-btn carousel-btn-next"
            onClick={next}
            aria-label="Next slide"
          >
            &#8250;
          </button>

          <div className="carousel-dots">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`carousel-dot${i === current ? ' active' : ''}`}
                onClick={() => goTo(i)}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default ImageCarousel

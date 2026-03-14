import { useState, useEffect } from 'react'

const messages = [
  'Brewing coffee for the translator...',
  'Waking up the dictionary...',
  'Sharpening the pencils...',
  'Consulting the grammar elves...',
  'Flipping through dusty textbooks...',
  'Negotiating with the umlauts...',
  'Untangling compound nouns...',
  'Teaching vowels new tricks...',
  'Warming up the printing press...',
  'Polishing the monocle...',
  'Decoding ancient manuscripts...',
  'Befriending a bilingual parrot...',
  'Asking Gutenberg for advice...',
  'Alphabetizing the alphabet...',
  'Counting syllables on fingers...',
  'Dusting off the thesaurus...',
  'Feeding the bookworms...',
  'Ironing out the wrinkles in grammar...',
  'Tuning the linguistic antenna...',
  'Rolling out the red carpet for words...',
  'Convincing commas to cooperate...',
  'Herding semicolons...',
  'Stretching the sentences...',
  'Calibrating the meaning detector...',
  'Whispering sweet nothings to the API...',
]

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function LoadingOverlay() {
  const [queue, setQueue] = useState(() => shuffled(messages))
  const [index, setIndex] = useState(0)
  const [fade, setFade] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false)
      setTimeout(() => {
        setIndex((prev) => {
          const next = prev + 1
          if (next >= queue.length) {
            setQueue(shuffled(messages))
            return 0
          }
          return next
        })
        setFade(true)
      }, 300)
    }, 3000)
    return () => clearInterval(interval)
  }, [queue.length])

  return (
    <div className="fixed inset-0 bg-black/30 dark:bg-black/50 flex items-center justify-center z-40">
      <div className="bg-[#faf6ef] dark:bg-stone-800 rounded-xl shadow-xl px-8 py-6 flex flex-col items-center gap-4 min-w-[280px]">
        <div className="flex gap-1.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-2.5 h-2.5 rounded-full bg-amber-600 dark:bg-amber-500"
              style={{
                animation: 'loading-wave 1.4s ease-in-out infinite',
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
        <span
          className="text-stone-600 dark:text-stone-300 text-sm text-center transition-opacity duration-300"
          style={{ opacity: fade ? 1 : 0 }}
        >
          {queue[index]}
        </span>
      </div>
    </div>
  )
}

export function InlineLoadingDots() {
  return (
    <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-current"
            style={{
              animation: 'loading-wave 1.4s ease-in-out infinite',
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
      <span className="text-sm">Translating...</span>
    </div>
  )
}

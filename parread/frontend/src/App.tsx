import { useState, useEffect, useCallback } from 'react'
import { LoadingOverlay, InlineLoadingDots } from './LoadingOverlay'

interface TextData {
  id: string
  en?: string[]
  de: string[]
  title: string
  source_lang?: 'de' | 'en'
  cached_explanations: Array<{
    paragraph_idx: number
    token_idx: number
    translation: string
  }>
}

interface SavedText {
  id: string
  title: string
  timestamp: number
}

interface PopupState {
  visible: boolean
  x: number
  y: number
  above: boolean
  alignRight: boolean
  content: string
  loading: boolean
}

const API_KEY = new URLSearchParams(window.location.search).get('key') || ''

function App() {
  const [inputText, setInputText] = useState('')
  const [currentText, setCurrentText] = useState<TextData | null>(null)
  const [savedTexts, setSavedTexts] = useState<SavedText[]>([])
  const [loading, setLoading] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [showTranslation, setShowTranslation] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeWord, setActiveWord] = useState<{ paragraphIdx: number; tokenIdx: number } | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode')
    return saved ? JSON.parse(saved) : false
  })
  const [popup, setPopup] = useState<PopupState>({
    visible: false,
    x: 0,
    y: 0,
    above: false,
    alignRight: false,
    content: '',
    loading: false,
  })

  const fetchSavedTexts = useCallback(async () => {
    try {
      const response = await fetch(`/api/texts?key=${API_KEY}`)
      const data = await response.json()
      setSavedTexts(data.texts)
    } catch {
      console.error('Failed to fetch saved texts')
    }
  }, [])

  useEffect(() => {
    fetchSavedTexts()
  }, [fetchSavedTexts])

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode))
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  useEffect(() => {
    const handleClickOutside = () => {
      if (popup.visible && !popup.loading) {
        setPopup((p) => ({ ...p, visible: false }))
        setActiveWord(null)
      }
      setMenuOpen(false)
      setSettingsOpen(false)
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [popup.visible, popup.loading])

  const handleProcess = async () => {
    if (!inputText.trim()) return

    setLoading(true)
    setError(null)
    setShowTranslation(false)

    try {
      const response = await fetch(`/api/process?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Processing failed')
      }

      const data: TextData = await response.json()
      setCurrentText(data)
      setInputText('')
      fetchSavedTexts()

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const fetchTranslation = async () => {
    if (!currentText) return

    // If translation already cached, just show it
    if (currentText.en && currentText.en.length > 0) {
      return
    }

    setTranslating(true)
    setError(null)

    try {
      const response = await fetch(`/api/texts/${currentText.id}/translate?key=${API_KEY}`, {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Translation failed')
      }

      const data = await response.json()
      setCurrentText((prev) =>
        prev ? { ...prev, en: data.en } : null
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setShowTranslation(false)
    } finally {
      setTranslating(false)
    }
  }

  const handleShowTranslationChange = (checked: boolean) => {
    setShowTranslation(checked)
    if (checked) {
      fetchTranslation()
    }
  }

  const loadSavedText = async (textId: string) => {
    setLoading(true)
    setError(null)
    setMenuOpen(false)
    setShowTranslation(false)

    try {
      const response = await fetch(`/api/texts/${textId}?key=${API_KEY}`)
      if (!response.ok) throw new Error('Failed to load text')

      const data: TextData = await response.json()
      setCurrentText(data)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const deleteText = async (textId: string, e: React.MouseEvent) => {
    e.stopPropagation()

    try {
      const response = await fetch(`/api/texts/${textId}?key=${API_KEY}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete text')

      fetchSavedTexts()
      if (currentText?.id === textId) {
        setCurrentText(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const handleWordClick = async (
    e: React.MouseEvent,
    word: string,
    sentence: string,
    paragraphIdx: number,
    tokenIdx: number
  ) => {
    e.stopPropagation()

    if (!currentText) return

    const rect = (e.target as HTMLElement).getBoundingClientRect()
    const popupHeight = 150 // estimated popup height
    const popupWidth = 384 // max-w-sm = 24rem = 384px
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceRight = window.innerWidth - rect.left
    const showAbove = spaceBelow < popupHeight && rect.top > popupHeight
    const alignRight = spaceRight < popupWidth

    setActiveWord({ paragraphIdx, tokenIdx })
    setPopup({
      visible: true,
      x: (alignRight ? rect.right : rect.left) + window.scrollX,
      y: (showAbove ? rect.top - 5 : rect.bottom + 5) + window.scrollY,
      above: showAbove,
      alignRight,
      content: '',
      loading: true,
    })

    try {
      const response = await fetch(`/api/explain?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text_id: currentText.id,
          paragraph_idx: paragraphIdx,
          token_idx: tokenIdx,
          word: word,
          sentence: sentence,
        }),
      })

      if (!response.ok) throw new Error('Failed to get explanation')

      const data = await response.json()
      setPopup((p) => ({ ...p, content: data.translation, loading: false }))
    } catch {
      setPopup((p) => ({
        ...p,
        content: 'Failed to load explanation',
        loading: false,
      }))
    }
  }

  const renderClickableText = (text: string, paragraphIdx: number) => {
    const words = text.split(/(\s+)/)
    let tokenIdx = 0

    return words.map((word, idx) => {
      if (/^\s+$/.test(word)) {
        return <span key={idx}>{word}</span>
      }

      const currentTokenIdx = tokenIdx
      tokenIdx++
      const isActive = activeWord?.paragraphIdx === paragraphIdx && activeWord?.tokenIdx === currentTokenIdx

      return (
        <span
          key={idx}
          onClick={(e) =>
            handleWordClick(e, word, text, paragraphIdx, currentTokenIdx)
          }
          className={`cursor-pointer hover:bg-amber-200 dark:hover:bg-amber-800 hover:rounded px-0.5 transition-colors ${isActive ? 'bg-amber-200 dark:bg-amber-800 rounded' : ''}`}
        >
          {word}
        </span>
      )
    })
  }

  return (
    <div className="min-h-screen bg-[#f0ebe1] dark:bg-stone-900">
      <header className="bg-[#faf6ef] dark:bg-stone-800 shadow-sm border-b border-[#e0d9cc] dark:border-stone-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-stone-800 dark:text-stone-100">
            Parallel Reader
          </h1>

          <div className="flex items-center gap-2">
            {currentText && (
              <button
                onClick={() => {
                  setCurrentText(null)
                  setShowTranslation(false)
                }}
                className="px-4 py-2 bg-[#ebe5d8] dark:bg-stone-700 hover:bg-[#ddd6c6] dark:hover:bg-stone-600 rounded-lg text-sm font-medium transition-colors dark:text-stone-200"
              >
                New Text
              </button>
            )}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpen(!menuOpen)
                }}
                className="px-4 py-2 bg-[#ebe5d8] dark:bg-stone-700 hover:bg-[#ddd6c6] dark:hover:bg-stone-600 rounded-lg text-sm font-medium transition-colors dark:text-stone-200"
              >
                Saved Texts ({savedTexts.length})
              </button>

              {menuOpen && (
                <div
                  className="absolute right-0 mt-2 w-72 bg-[#faf6ef] dark:bg-stone-800 rounded-lg shadow-lg border border-[#e0d9cc] dark:border-stone-700 z-50 max-h-96 overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  {savedTexts.length === 0 ? (
                    <p className="px-4 py-3 text-stone-500 dark:text-stone-400 text-sm">
                      No saved texts yet
                    </p>
                  ) : (
                    savedTexts.map((text) => (
                      <div
                        key={text.id}
                        onClick={() => loadSavedText(text.id)}
                        className="px-4 py-3 hover:bg-[#f0ebe1] dark:hover:bg-stone-700 cursor-pointer flex items-center justify-between border-b border-[#e0d9cc] dark:border-stone-700 last:border-b-0"
                      >
                        <span className="text-sm text-stone-700 dark:text-stone-300 truncate flex-1 mr-2">
                          {text.title}
                        </span>
                        <button
                          onClick={(e) => deleteText(text.id, e)}
                          className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setSettingsOpen(!settingsOpen)
                }}
                className="p-2 bg-[#ebe5d8] dark:bg-stone-700 hover:bg-[#ddd6c6] dark:hover:bg-stone-600 rounded-lg transition-colors"
                title="Settings"
              >
                <svg
                  className="w-5 h-5 text-stone-600 dark:text-stone-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </button>

              {settingsOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 bg-[#faf6ef] dark:bg-stone-800 rounded-lg shadow-lg border border-[#e0d9cc] dark:border-stone-700 z-50"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-4 py-3 border-b border-[#e0d9cc] dark:border-stone-700">
                    <h3 className="text-sm font-medium text-stone-800 dark:text-stone-200">Settings</h3>
                  </div>
                  <div className="px-4 py-3">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm text-stone-700 dark:text-stone-300">Dark Theme</span>
                      <button
                        onClick={() => setDarkMode(!darkMode)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          darkMode ? 'bg-blue-600' : 'bg-stone-300 dark:bg-stone-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            darkMode ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg">
            {error}
          </div>
        )}

        {!currentText ? (
          <div className="bg-[#faf6ef] dark:bg-stone-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-stone-800 dark:text-stone-100">Enter Text</h2>
              <span className={`text-sm ${inputText.length > 5000 ? 'text-red-500 dark:text-red-400 font-medium' : 'text-stone-500 dark:text-stone-400'}`}>
                {inputText.length}/5000
              </span>
            </div>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              maxLength={5000}
              placeholder="Paste German or English text here..."
              className="w-full h-64 p-4 border border-[#e0d9cc] dark:border-stone-600 rounded-lg resize-none focus:ring-2 focus:ring-amber-600 focus:border-amber-600 outline-none bg-[#faf6ef] dark:bg-stone-700 text-stone-800 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500"
              disabled={loading}
            />
            <button
              onClick={handleProcess}
              disabled={loading || !inputText.trim() || inputText.length > 5000}
              className="mt-4 px-6 py-2 bg-amber-700 text-white rounded-lg font-medium hover:bg-amber-800 disabled:bg-stone-400 dark:disabled:bg-stone-600 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Processing...' : 'Proceed'}
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-100">
                {currentText.title}
              </h2>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showTranslation}
                  onChange={(e) => handleShowTranslationChange(e.target.checked)}
                  disabled={translating}
                  className="w-4 h-4 text-amber-700 rounded focus:ring-amber-600"
                />
                <span className="text-sm text-stone-700 dark:text-stone-300">Show Translation</span>
              </label>
            </div>

            {showTranslation && (
              <div className="grid grid-cols-2 gap-4 mb-2 max-w-5xl mx-auto">
                <div>
                  <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400 mb-2 uppercase tracking-wide">
                    {currentText.source_lang === 'en' ? 'German (Translation)' : 'German (Original)'}
                  </h3>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400 mb-2 uppercase tracking-wide">
                    {currentText.source_lang === 'en' ? 'English (Original)' : 'English (Translation)'}
                  </h3>
                </div>
              </div>
            )}

            <div className={showTranslation ? 'space-y-4 max-w-5xl mx-auto' : 'space-y-4 max-w-3xl mx-auto'}>
              {currentText.de.map((deParagraph, idx) => (
                <div
                  key={idx}
                  className={showTranslation ? 'grid grid-cols-2 gap-4' : ''}
                >
                  <div className="bg-[#faf6ef] dark:bg-stone-800 rounded-lg shadow p-5">
                    <p className="text-stone-800 dark:text-stone-200 leading-relaxed font-medium text-[1.05rem]">
                      {renderClickableText(deParagraph, idx)}
                    </p>
                  </div>
                  {showTranslation && (
                    <div className="bg-[#faf6ef] dark:bg-stone-800 rounded-lg shadow p-5">
                      {translating ? (
                        <InlineLoadingDots />
                      ) : (
                        <p className="text-stone-800 dark:text-stone-200 leading-relaxed font-medium text-[1.05rem]">
                          {currentText.en?.[idx] || ''}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {popup.visible && (
        <div
          className="absolute bg-amber-50 dark:bg-stone-700 rounded-xl shadow-2xl ring-1 ring-black/10 dark:ring-white/15 border border-amber-200 dark:border-stone-500 px-5 py-4 max-w-sm z-50"
          style={{
            ...(popup.alignRight
              ? { right: document.documentElement.scrollWidth - popup.x }
              : { left: popup.x }),
            top: popup.y,
            ...(popup.above && { transform: 'translateY(-100%)' }),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {popup.loading ? (
            <div className="flex items-center gap-2 text-stone-500 dark:text-stone-400">
              <svg
                className="animate-spin h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Loading explanation...
            </div>
          ) : (
            <p className="text-base text-stone-700 dark:text-stone-200 leading-relaxed">{popup.content}</p>
          )}
        </div>
      )}

      {loading && <LoadingOverlay />}
    </div>
  )
}

export default App

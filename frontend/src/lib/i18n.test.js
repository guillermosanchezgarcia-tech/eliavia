import { describe, it, expect } from 'vitest'
import { detectLang, LANGS } from './i18n.js'

// A fake navigator, in the two shapes browsers actually hand us.
const nav = (...languages) => ({ languages, language: languages[0] })

describe('detectLang', () => {
  it('takes the first translated language the browser asks for', () => {
    expect(detectLang(nav('es-ES', 'en-GB'))).toBe('es')
    expect(detectLang(nav('de-CH'))).toBe('de')
    expect(detectLang(nav('ko'))).toBe('ko')
  })

  it('ignores the region — locale files are per language', () => {
    expect(detectLang(nav('pt-BR'))).toBe('pt')
    expect(detectLang(nav('zh-Hans-CN'))).toBe('zh')
    expect(detectLang(nav('ES-es'))).toBe('es')
  })

  it('walks past languages we have no locale for', () => {
    // The Dutch speaker who also reads Spanish gets Spanish, not English by default.
    expect(detectLang(nav('nl-NL', 'sv', 'es'))).toBe('es')
  })

  it('falls back to English when nothing in the list is translated', () => {
    expect(detectLang(nav('nl-NL', 'sv-SE'))).toBe('en')
  })

  it('reads navigator.language when navigator.languages is empty or absent', () => {
    expect(detectLang({ languages: [], language: 'it-IT' })).toBe('it')
    expect(detectLang({ language: 'fr-FR' })).toBe('fr')
  })

  it('answers English rather than throwing on a navigator with nothing usable', () => {
    // Server-side rendering, a test runner, an old WebView: none of these should crash the store,
    // which calls this while building its defaults at import time.
    expect(detectLang(null)).toBe('en')
    expect(detectLang({})).toBe('en')
    expect(detectLang({ languages: [undefined, ''] })).toBe('en')
  })

  it('only ever returns a language the app actually has', () => {
    const tags = ['es-ES', 'nl', 'zh-Hant-TW', '', 'x', 'hi-IN']
    for (const tag of tags) expect(LANGS[detectLang(nav(tag))]).toBeDefined()
  })
})

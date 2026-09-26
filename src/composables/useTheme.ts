import { readonly, ref } from 'vue'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'watch-shelf-theme'
const theme = ref<Theme>('light')
let initialized = false

function getSavedTheme(): Theme | null {
  try {
    const savedTheme = localStorage.getItem(STORAGE_KEY)
    return savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : null
  } catch {
    return null
  }
}

function applyTheme(nextTheme: Theme) {
  theme.value = nextTheme
  document.documentElement.classList.toggle('dark', nextTheme === 'dark')
  document.documentElement.style.colorScheme = nextTheme
}

function initializeTheme() {
  if (initialized) return

  initialized = true
  const colorScheme = window.matchMedia('(prefers-color-scheme: dark)')
  applyTheme(getSavedTheme() ?? (colorScheme.matches ? 'dark' : 'light'))

  colorScheme.addEventListener('change', (event) => {
    if (!getSavedTheme()) {
      applyTheme(event.matches ? 'dark' : 'light')
    }
  })
}

function setTheme(nextTheme: Theme) {
  applyTheme(nextTheme)

  try {
    localStorage.setItem(STORAGE_KEY, nextTheme)
  } catch {
    // The selected theme still applies for this session when storage is unavailable.
  }
}

export function useTheme() {
  initializeTheme()

  return {
    theme: readonly(theme),
    toggleTheme: () => setTheme(theme.value === 'dark' ? 'light' : 'dark'),
  }
}

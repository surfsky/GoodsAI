import { ref, h, render } from 'vue'
import Toast from '../components/Toast.vue'

const toasts = ref([])
let container = null

const initContainer = () => {
  if (container) return
  container = document.createElement('div')
  container.className = 'fixed top-4 right-4 z-50 flex flex-col items-end w-full max-w-sm pointer-events-none'
  // Add pointer-events-auto to children via CSS in Toast.vue or just rely on structure
  // Actually, we need to make sure clicks pass through empty space
  // We'll handle this by styling the toast itself as pointer-events-auto
  document.body.appendChild(container)
}

// Simple state management for toasts
// Since we are not using a full app context for dynamic component injection easily without a plugin,
// we will use a simpler approach: create a reactive array and a component that renders them.
// BUT, creating a global component instance is better.

// Let's create a global state and a ToastContainer component
const state = ref([])

const remove = (id) => {
  state.value = state.value.filter(t => t.id !== id)
}

const add = (message, type = 'info', duration = 3000) => {
  const id = Date.now().toString() + Math.random()
  state.value.push({ id, message, type, duration })
}

export function useToast() {
  return {
    toasts: state,
    remove,
    success: (msg, duration) => add(msg, 'success', duration),
    error: (msg, duration) => add(msg, 'error', duration),
    info: (msg, duration) => add(msg, 'info', duration)
  }
}

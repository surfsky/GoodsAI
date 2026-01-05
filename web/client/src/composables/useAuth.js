import { ref, computed } from 'vue'

// Global state
const token = ref(localStorage.getItem('token'))
const userRole = ref(localStorage.getItem('user_role'))
const currentUsername = ref(localStorage.getItem('username'))

export function useAuth() {
  const login = (newToken, newRole, newUsername) => {
    localStorage.setItem('token', newToken)
    localStorage.setItem('user_role', newRole)
    localStorage.setItem('username', newUsername)
    
    token.value = newToken
    userRole.value = newRole
    currentUsername.value = newUsername
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user_role')
    localStorage.removeItem('username')
    
    token.value = null
    userRole.value = null
    currentUsername.value = null
  }

  const isLoggedIn = computed(() => !!token.value)
  const isAdmin = computed(() => userRole.value === 'admin')
  const username = computed(() => currentUsername.value || '用户')

  return {
    token,
    userRole,
    username,
    isLoggedIn,
    isAdmin,
    login,
    logout
  }
}

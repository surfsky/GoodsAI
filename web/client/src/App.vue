<script setup>
import { computed, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import ToastContainer from './components/ToastContainer.vue'
import MessageBox from './components/MessageBox.vue'
import { PackageSearch, Settings, LogIn, LogOut, FileText, User, Users, Menu, X, ScanSearch } from 'lucide-vue-next'
import { useAuth } from './composables/useAuth'

const router = useRouter()
const route = useRoute()
const { isLoggedIn, isAdmin, username, logout: authLogout } = useAuth()
const isMenuOpen = ref(false)

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
}

const closeMenu = () => {
  isMenuOpen.value = false
}

const logout = () => {
  authLogout()
  router.push('/login')
  closeMenu()
}
</script>

<template>
  <div class="min-h-screen bg-gray-100 flex flex-col">
    <!-- Global Components -->
    <ToastContainer />
    <MessageBox />
    
    <!-- Header -->
    <header class="bg-white shadow-sm sticky top-0 z-50">
      <div class="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <router-link to="/" class="flex items-center space-x-2 font-bold text-lg text-blue-600">
          <PackageSearch class="w-6 h-6" />
          <span>GoodsAI</span>
        </router-link>
        
        <!-- Desktop Nav -->
        <nav class="hidden md:flex items-center space-x-2">
          <router-link 
            to="/"
            custom
            v-slot="{ navigate, isActive }"
          >
            <button 
              @click="navigate"
              :class="['px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center space-x-1', 
                isActive && route.path === '/' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100']"
            >
              <ScanSearch class="w-4 h-4" />
              <span>识别</span>
            </button>
          </router-link>

          <template v-if="isLoggedIn && isAdmin">
            <router-link 
              to="/admin"
              custom
              v-slot="{ navigate, isActive }"
            >
              <button 
                @click="navigate"
                :class="['px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center space-x-1', 
                  isActive ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100']"
              >
                <Settings class="w-4 h-4" />
                <span>维护</span>
              </button>
            </router-link>
            
            <router-link 
              to="/logs"
              custom
              v-slot="{ navigate, isActive }"
            >
              <button 
                @click="navigate"
                :class="['px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center space-x-1', 
                  isActive ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100']"
              >
                <FileText class="w-4 h-4" />
                <span>日志</span>
              </button>
            </router-link>

            <router-link 
              to="/users"
              custom
              v-slot="{ navigate, isActive }"
            >
              <button 
                @click="navigate"
                :class="['px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center space-x-1', 
                  isActive ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100']"
              >
                <Users class="w-4 h-4" />
                <span>账户</span>
              </button>
            </router-link>
          </template>

          <div class="h-6 w-px bg-gray-200 mx-2"></div>

          <template v-if="isLoggedIn">
            <router-link 
              to="/profile"
              custom
              v-slot="{ navigate, isActive }"
            >
              <button 
                @click="navigate"
                :class="['px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center space-x-1', 
                  isActive ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100']"
              >
                <User class="w-4 h-4" />
                <span>{{ username }}</span>
              </button>
            </router-link>

            <button 
              @click="logout"
              class="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md flex items-center space-x-1"
            >
              <LogOut class="w-4 h-4" />
            </button>
          </template>
          
          <router-link 
            v-else
            to="/login"
            class="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md flex items-center space-x-1"
          >
            <LogIn class="w-4 h-4" />
            <span>登录</span>
          </router-link>
        </nav>

        <!-- Mobile Menu Button -->
        <button class="md:hidden p-2 text-gray-600" @click="toggleMenu">
          <Menu v-if="!isMenuOpen" class="w-6 h-6" />
          <X v-else class="w-6 h-6" />
        </button>
      </div>

      <!-- Mobile Nav -->
      <div v-if="isMenuOpen" class="md:hidden bg-white border-t border-gray-100 absolute w-full left-0 shadow-lg z-40">
        <div class="px-4 py-2 space-y-1">
          <router-link 
            to="/"
            custom
            v-slot="{ navigate, isActive }"
          >
            <button 
              @click="() => { navigate(); closeMenu() }"
              :class="['w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2', 
                isActive && route.path === '/' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50']"
            >
              <ScanSearch class="w-4 h-4" />
              <span>识别</span>
            </button>
          </router-link>

          <template v-if="isLoggedIn && isAdmin">
            <router-link 
              to="/admin"
              custom
              v-slot="{ navigate, isActive }"
            >
              <button 
                @click="() => { navigate(); closeMenu() }"
                :class="['w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2', 
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50']"
              >
                <Settings class="w-4 h-4" />
                <span>维护</span>
              </button>
            </router-link>
            
            <router-link 
              to="/logs"
              custom
              v-slot="{ navigate, isActive }"
            >
              <button 
                @click="() => { navigate(); closeMenu() }"
                :class="['w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2', 
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50']"
              >
                <FileText class="w-4 h-4" />
                <span>日志</span>
              </button>
            </router-link>

            <router-link 
              to="/users"
              custom
              v-slot="{ navigate, isActive }"
            >
              <button 
                @click="() => { navigate(); closeMenu() }"
                :class="['w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2', 
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50']"
              >
                <Users class="w-4 h-4" />
                <span>账户</span>
              </button>
            </router-link>
          </template>

          <div class="h-px bg-gray-100 my-2"></div>

          <template v-if="isLoggedIn">
            <router-link 
              to="/profile"
              custom
              v-slot="{ navigate, isActive }"
            >
              <button 
                @click="() => { navigate(); closeMenu() }"
                :class="['w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2', 
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50']"
              >
                <User class="w-4 h-4" />
                <span>{{ username }}</span>
              </button>
            </router-link>

            <button 
              @click="logout"
              class="w-full text-left px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md flex items-center space-x-2"
            >
              <LogOut class="w-4 h-4" />
              <span>退出登录</span>
            </button>
          </template>
          
          <router-link 
            v-else
            to="/login"
            class="block px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md flex items-center space-x-2"
            @click="closeMenu"
          >
            <LogIn class="w-4 h-4" />
            <span>登录</span>
          </router-link>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 w-full max-w-4xl mx-auto p-4">
      <router-view v-slot="{ Component }">
        <keep-alive include="HomeView">
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </main>
  </div>
</template>

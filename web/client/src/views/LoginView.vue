<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { useToast } from '../composables/useToast'
import { useAuth } from '../composables/useAuth'
import SliderCaptcha from '../components/SliderCaptcha.vue'
import { config } from '../config'

const router = useRouter()
const toast = useToast()
const { login } = useAuth()

const username = ref('')
const password = ref('')
const loading = ref(false)
const isCaptchaVerified = ref(false)

const handleCaptchaSuccess = () => {
  isCaptchaVerified.value = true
}

const handleLogin = async () => {
  if (!username.value || !password.value) return
  if (!isCaptchaVerified.value) {
    toast.error('请先完成滑动验证')
    return
  }
  
  loading.value = true
  try {
    const formData = new FormData()
    formData.append('username', username.value)
    formData.append('password', password.value)
    
    const res = await axios.post(`${config.API_URL}/token`, formData)
    
    const { access_token, role, username: user } = res.data
    
    login(access_token, role, user)
    
    toast.success('登录成功')
    
    if (role === 'admin') {
      router.push('/admin')
    } else {
      router.push('/')
    }
  } catch (err) {
    console.error(err)
    toast.error('登录失败：用户名或密码错误')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="max-w-md mx-auto mt-20 p-6 bg-white rounded-xl shadow-lg border border-gray-100">
    <h2 class="text-2xl font-bold text-center mb-6 text-gray-800">账户登录</h2>
    
    <form @submit.prevent="handleLogin" class="space-y-4">
      <div class="space-y-1">
        <label class="block text-sm font-medium text-gray-700">用户名</label>
        <input 
          v-model="username" 
          type="text" 
          class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          placeholder="请输入用户名"
        >
      </div>
      
      <div class="space-y-1">
        <label class="block text-sm font-medium text-gray-700">密码</label>
        <input 
          v-model="password" 
          type="password" 
          class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          placeholder="请输入密码"
        >
      </div>
      
      <!-- Captcha -->
      <div class="pt-2">
        <SliderCaptcha @success="handleCaptchaSuccess" />
      </div>

      <button 
        type="submit" 
        class="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition disabled:opacity-50 flex justify-center items-center"
        :disabled="loading || !isCaptchaVerified"
      >
        <div v-if="loading" class="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
        {{ loading ? '登录中...' : '登录' }}
      </button>
    </form>
    
    <div class="mt-4 text-center text-sm text-gray-500">
      <p>默认管理员: admin / admin123</p>
      <p>默认用户: user / user123</p>
    </div>
  </div>
</template>

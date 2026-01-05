<script setup>
import { ref } from 'vue'
import axios from 'axios'
import { useToast } from '../composables/useToast'
import { Lock, User } from 'lucide-vue-next'

const toast = useToast()
const API_URL = 'http://localhost:8000'

const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const loading = ref(false)

const getAuthHeader = () => {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const username = localStorage.getItem('username')
const role = localStorage.getItem('user_role')

const handleChangePassword = async () => {
  if (newPassword.value !== confirmPassword.value) {
    toast.error('两次输入的密码不一致')
    return
  }
  
  if (newPassword.value.length < 6) {
    toast.error('新密码长度不能少于6位')
    return
  }

  loading.value = true
  try {
    await axios.post(
      `${API_URL}/users/change-password`, 
      {
        old_password: oldPassword.value,
        new_password: newPassword.value
      },
      { headers: getAuthHeader() }
    )
    toast.success('密码修改成功')
    oldPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (err) {
    toast.error(err.response?.data?.detail || '修改失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto space-y-6">
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div class="flex items-center space-x-4 mb-6 pb-6 border-b border-gray-100">
        <div class="bg-blue-100 p-3 rounded-full">
          <User class="w-8 h-8 text-blue-600" />
        </div>
        <div>
          <h2 class="text-xl font-bold text-gray-900">{{ username }}</h2>
          <p class="text-gray-500">角色: {{ role === 'admin' ? '管理员' : '普通用户' }}</p>
        </div>
      </div>

      <h3 class="font-bold text-lg text-gray-900 mb-4 flex items-center space-x-2">
        <Lock class="w-5 h-5" />
        <span>修改密码</span>
      </h3>

      <form @submit.prevent="handleChangePassword" class="space-y-4 max-w-md">
        <div class="space-y-1">
          <label class="block text-sm font-medium text-gray-700">当前密码</label>
          <input 
            v-model="oldPassword" 
            type="password" 
            required
            class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="请输入当前密码"
          >
        </div>
        
        <div class="space-y-1">
          <label class="block text-sm font-medium text-gray-700">新密码</label>
          <input 
            v-model="newPassword" 
            type="password" 
            required
            class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="请输入新密码"
          >
        </div>

        <div class="space-y-1">
          <label class="block text-sm font-medium text-gray-700">确认新密码</label>
          <input 
            v-model="confirmPassword" 
            type="password" 
            required
            class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="请再次输入新密码"
          >
        </div>

        <button 
          type="submit" 
          class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center space-x-2"
          :disabled="loading"
        >
          <div v-if="loading" class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
          <span>确认修改</span>
        </button>
      </form>
    </div>
  </div>
</template>

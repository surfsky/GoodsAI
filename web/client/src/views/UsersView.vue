<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { Trash2, UserPlus, KeyRound, User } from 'lucide-vue-next'
import { useToast } from '../composables/useToast'
import { useMessageBox } from '../composables/useMessageBox'

const users = ref([])
const loading = ref(false)
const toast = useToast()
const messageBox = useMessageBox()
const API_URL = 'http://localhost:8000'

const showAddModal = ref(false)
const newUser = ref({
  username: '',
  password: '',
  role: 'user'
})

const getAuthHeader = () => {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const fetchUsers = async () => {
  loading.value = true
  try {
    const res = await axios.get(`${API_URL}/users`, { headers: getAuthHeader() })
    users.value = res.data
  } catch (err) {
    toast.error('获取用户列表失败')
  } finally {
    loading.value = false
  }
}

const deleteUser = async (user) => {
  const confirmed = await messageBox.confirm(`确定要删除用户 "${user.username}" 吗？`)
  if (!confirmed) return

  try {
    await axios.delete(`${API_URL}/users/${user.id}`, { headers: getAuthHeader() })
    toast.success('删除成功')
    fetchUsers()
  } catch (err) {
    toast.error(err.response?.data?.detail || '删除失败')
  }
}

const resetPassword = async (user) => {
  const confirmed = await messageBox.confirm(`确定要重置用户 "${user.username}" 的密码为 "123456" 吗？`)
  if (!confirmed) return

  try {
    await axios.post(
      `${API_URL}/users/${user.id}/reset-password`, 
      { new_password: '123456' },
      { headers: getAuthHeader() }
    )
    toast.success('重置成功，新密码: 123456')
  } catch (err) {
    toast.error('重置失败')
  }
}

const addUser = async () => {
  if (!newUser.value.username || !newUser.value.password) {
    toast.error('请填写完整信息')
    return
  }

  try {
    await axios.post(`${API_URL}/users`, newUser.value, { headers: getAuthHeader() })
    toast.success('添加成功')
    showAddModal.value = false
    newUser.value = { username: '', password: '', role: 'user' }
    fetchUsers()
  } catch (err) {
    toast.error(err.response?.data?.detail || '添加失败')
  }
}

onMounted(() => {
  fetchUsers()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h2 class="text-xl font-bold text-gray-800">账户管理</h2>
      <button 
        @click="showAddModal = true"
        class="flex items-center space-x-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
      >
        <UserPlus class="w-4 h-4" />
        <span>添加用户</span>
      </button>
    </div>

    <div class="bg-white rounded-xl shadow-sm border overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">用户</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">角色</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建时间</th>
            <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="user in users" :key="user.id" class="hover:bg-gray-50">
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="flex items-center">
                <div class="bg-gray-100 p-2 rounded-full mr-3">
                  <User class="w-4 h-4 text-gray-600" />
                </div>
                <div class="text-sm font-medium text-gray-900">{{ user.username }}</div>
              </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span :class="['px-2 py-1 text-xs rounded-full', user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700']">
                {{ user.role === 'admin' ? '管理员' : '普通用户' }}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {{ new Date(user.created_at).toLocaleDateString() }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
              <button 
                @click="resetPassword(user)"
                class="text-orange-600 hover:text-orange-900 p-1 hover:bg-orange-50 rounded"
                title="重置密码"
              >
                <KeyRound class="w-4 h-4" />
              </button>
              <button 
                @click="deleteUser(user)"
                class="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded"
                title="删除用户"
              >
                <Trash2 class="w-4 h-4" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add User Modal -->
    <div v-if="showAddModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <h3 class="text-lg font-bold text-gray-900 mb-4">添加新用户</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">用户名</label>
            <input v-model="newUser.username" class="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">初始密码</label>
            <input v-model="newUser.password" type="password" class="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">角色</label>
            <select v-model="newUser.role" class="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
              <option value="user">普通用户</option>
              <option value="admin">管理员</option>
            </select>
          </div>
          <div class="flex justify-end space-x-3 pt-4">
            <button @click="showAddModal = false" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
            <button @click="addUser" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">确认添加</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

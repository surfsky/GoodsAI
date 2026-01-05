<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { Trash2, RefreshCw } from 'lucide-vue-next'
import { useToast } from '../composables/useToast'
import { useMessageBox } from '../composables/useMessageBox'

const logs = ref([])
const loading = ref(false)
const toast = useToast()
const messageBox = useMessageBox()
const API_URL = 'http://localhost:8000'

const fetchLogs = async () => {
  loading.value = true
  try {
    const token = localStorage.getItem('token')
    const res = await axios.get(`${API_URL}/logs?limit=100`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    logs.value = res.data
  } catch (err) {
    toast.error('获取日志失败')
  } finally {
    loading.value = false
  }
}

const deleteOldLogs = async () => {
  const confirmed = await messageBox.confirm('确定要删除3个月前的日志吗？')
  if (!confirmed) return

  try {
    const token = localStorage.getItem('token')
    const res = await axios.delete(`${API_URL}/logs`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    toast.success(`删除了 ${res.data.count} 条旧日志`)
    fetchLogs()
  } catch (err) {
    toast.error('删除日志失败')
  }
}

onMounted(() => {
  fetchLogs()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <h2 class="text-xl font-bold text-gray-800">系统日志</h2>
      <div class="flex space-x-2">
        <button 
          @click="fetchLogs"
          class="p-2 bg-white border rounded-lg hover:bg-gray-50 text-gray-600"
          title="刷新"
        >
          <RefreshCw class="w-5 h-5" :class="{ 'animate-spin': loading }" />
        </button>
        <button 
          @click="deleteOldLogs"
          class="flex items-center space-x-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          <Trash2 class="w-4 h-4" />
          <span>清理旧日志</span>
        </button>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">时间</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">用户</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">详情</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="log in logs" :key="log.id" class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ new Date(log.created_at).toLocaleString() }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {{ log.username }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">
                {{ log.action }}
              </td>
              <td class="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" :title="log.details">
                {{ log.details }}
              </td>
            </tr>
            <tr v-if="logs.length === 0">
              <td colspan="4" class="px-6 py-8 text-center text-gray-500">
                暂无日志
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import axios from 'axios'
import { Trash2, RefreshCw, Search, ChevronLeft, ChevronRight, X } from 'lucide-vue-next'
import { useToast } from '../composables/useToast'
import { useMessageBox } from '../composables/useMessageBox'
import SearchBar from '../components/SearchBar.vue'
import { config } from '../config'

const logs = ref([])
const loading = ref(false)
const toast = useToast()
const messageBox = useMessageBox()

// Pagination & Search
const page = ref(1)
const pageSize = ref(20)
const hasMore = ref(true)
const searchQuery = ref('')

const fetchLogs = async () => {
  loading.value = true
  try {
    const token = localStorage.getItem('token')
    const offset = (page.value - 1) * pageSize.value
    
    const params = {
      limit: pageSize.value,
      offset: offset,
      search: searchQuery.value
    }
    
    const res = await axios.get(`${config.API_URL}/logs`, {
      headers: { Authorization: `Bearer ${token}` },
      params
    })
    
    logs.value = res.data
    
    if (res.data.length < pageSize.value) {
      hasMore.value = false
    } else {
      hasMore.value = true
    }
    
  } catch (err) {
    toast.error('获取日志失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  page.value = 1
  fetchLogs()
}

const prevPage = () => {
  if (page.value > 1) {
    page.value--
    fetchLogs()
  }
}

const nextPage = () => {
  if (hasMore.value) {
    page.value++
    fetchLogs()
  }
}

const deleteOldLogs = async () => {
  const confirmed = await messageBox.confirm('确定要删除3个月前的日志吗？')
  if (!confirmed) return

  try {
    const token = localStorage.getItem('token')
    const res = await axios.delete(`${config.API_URL}/logs`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    toast.success(`删除了 ${res.data.count} 条旧日志`)
    page.value = 1
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
    <div class="flex flex-col sm:flex-row justify-between items-center gap-4">
      <h2 class="text-xl font-bold text-gray-800">系统日志</h2>
      
      <div class="flex items-center space-x-2 w-full sm:w-auto">
        <!-- Search -->
        <div class="flex-1 w-full sm:w-64">
          <SearchBar 
            v-model="searchQuery" 
            @search="handleSearch" 
            placeholder="搜索用户、操作或详情..." 
          />
        </div>

         <button 
           @click="fetchLogs"
          class="p-2 bg-white border rounded-lg hover:bg-gray-50 text-gray-600"
          title="刷新"
        >
          <RefreshCw class="w-5 h-5" :class="{ 'animate-spin': loading }" />
        </button>
        <button 
          @click="deleteOldLogs"
          class="flex items-center space-x-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 whitespace-nowrap"
        >
          <Trash2 class="w-4 h-4" />
          <span class="hidden sm:inline">清理旧日志</span>
        </button>
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col min-h-[400px]">
      <div class="overflow-x-auto flex-1">
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
            <tr v-for="log in logs" :key="log.id" class="hover:bg-gray-50 transition-colors">
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
            <tr v-if="logs.length === 0 && !loading">
              <td colspan="4" class="px-6 py-12 text-center text-gray-500">
                <div class="flex flex-col items-center justify-center space-y-2">
                   <Search class="w-8 h-8 text-gray-300" />
                   <span>暂无日志数据</span>
                </div>
              </td>
            </tr>
            <tr v-if="loading">
               <td colspan="4" class="px-6 py-12 text-center">
                  <div class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
               </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- Pagination -->
      <div class="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
         <span class="text-sm text-gray-500">
           第 {{ page }} 页
         </span>
         <div class="flex space-x-2">
            <button 
              @click="prevPage" 
              :disabled="page === 1 || loading"
              class="px-3 py-1 bg-white border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              <ChevronLeft class="w-4 h-4 mr-1" /> 上一页
            </button>
            <button 
              @click="nextPage" 
              :disabled="!hasMore || loading"
              class="px-3 py-1 bg-white border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              下一页 <ChevronRight class="w-4 h-4 ml-1" />
            </button>
         </div>
      </div>
    </div>
  </div>
</template>

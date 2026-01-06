<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import axios from 'axios'
import { Plus, Upload, Trash2, Edit2, X, FileArchive, CheckSquare, Eye, Maximize2, ChevronLeft, ChevronRight, ArrowUpDown, Share2, Search, Loader2 } from 'lucide-vue-next'
import { useToast } from '../composables/useToast'
import { useMessageBox } from '../composables/useMessageBox'
import ProductEditDrawer from '../components/ProductEditDrawer.vue'
import SearchBar from '../components/SearchBar.vue'
import { config } from '../config'
import { useIntersectionObserver } from '@vueuse/core'

const toast = useToast()
const messageBox = useMessageBox()

const getAuthHeader = () => {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const products = ref([])
const loading = ref(false)
const showBatchModal = ref(false)
const showImageModal = ref(false)
const currentImage = ref(null)
const currentImageIndex = ref(0)
const previewImageUrls = ref([]) 

// Pagination & Search
const page = ref(1)
const pageSize = ref(20)
const hasMore = ref(true)
const searchQuery = ref('')
const loadingMore = ref(false)
const loadMoreTrigger = ref(null)

// Drawer State
const editDrawerVisible = ref(false)
const editingProduct = ref(null)

// Batch selection
const selectedIds = ref([])
const isSelectionMode = ref(false)

// Sorting
const sortType = ref('date_desc') // date_desc, date_asc, price_desc, price_asc, name_asc, name_desc
const showSortMenu = ref(false)

// Infinite Scroll
useIntersectionObserver(
  loadMoreTrigger,
  ([{ isIntersecting }]) => {
    if (isIntersecting && hasMore.value && !loading.value && !loadingMore.value) {
      loadMore()
    }
  },
)

// Watch search query with debounce
// Removed watcher as per user request for manual trigger
// let searchTimeout
// watch(searchQuery, (newVal) => {
//   clearTimeout(searchTimeout)
//   searchTimeout = setTimeout(() => {
//     page.value = 1
//     hasMore.value = true
//     products.value = [] // Clear list on new search
//     fetchProducts()
//   }, 500)
// })

  const isAllSelected = computed(() => {
    return products.value.length > 0 && products.value.every(item => selectedIds.value.includes(item.id))
  })

  const toggleSelectAll = () => {
    if (isAllSelected.value) {
      selectedIds.value = []
    } else {
      selectedIds.value = products.value.map(item => item.id)
    }
  }

const handleSearch = () => {
  page.value = 1
  hasMore.value = true
  products.value = []
  fetchProducts()
}

const sortOptions = [
  { label: '日期 (新→旧)', value: 'date_desc' },
  { label: '日期 (旧→新)', value: 'date_asc' },
  { label: '价格 (高→低)', value: 'price_desc' },
  { label: '价格 (低→高)', value: 'price_asc' },
  { label: '名称 (A→Z)', value: 'name_asc' },
  { label: '名称 (Z→A)', value: 'name_desc' },
]

const handleSort = (type) => {
  sortType.value = type
  showSortMenu.value = false
  // For simplicity, we re-fetch when sorting changes or do client-side sort if data is small
  // But with pagination, client-side sort only sorts current page. 
  // Ideally backend should handle sort. For now let's keep client sort on loaded items
  // OR reset and reload. Let's reset and reload to be correct.
  page.value = 1
  hasMore.value = true
  products.value = []
  fetchProducts()
}

// Helper to sort locally (if needed for mixed loaded data, though backend sort is better)
// But since we are paginating by ID DESC in backend, frontend sort might be weird.
// Let's assume for now we just rely on backend ID DESC (Date Desc) as default.
// If user selects other sort, we should probably pass sort param to backend.
// But database.py `get_all_products` hardcodes ORDER BY.
// So client-side sort is only effective on loaded items.
const sortProducts = () => {
  if (!products.value || products.value.length === 0) return
  
  products.value.sort((a, b) => {
    switch (sortType.value) {
      case 'date_desc':
        return new Date(b.created_at || 0) - new Date(a.created_at || 0)
      case 'date_asc':
        return new Date(a.created_at || 0) - new Date(b.created_at || 0)
      case 'price_desc':
        return (b.price || 0) - (a.price || 0)
      case 'price_asc':
        return (a.price || 0) - (b.price || 0)
      case 'name_asc':
        return (a.model_name || '').localeCompare(b.model_name || '')
      case 'name_desc':
        return (b.model_name || '').localeCompare(a.model_name || '')
      default:
        return 0
    }
  })
}

const batchFile = ref(null)
const batchStatus = ref('')

const fetchProducts = async (isLoadMore = false) => {
  if (isLoadMore) {
    loadingMore.value = true
  } else {
    loading.value = true
  }
  
  try {
    const offset = (page.value - 1) * pageSize.value
    const params = {
      limit: pageSize.value,
      offset: offset,
      search: searchQuery.value
    }
    
    const res = await axios.get(`${config.API_URL}/products`, { params })
    const newItems = res.data
    
    if (newItems.length < pageSize.value) {
      hasMore.value = false
    }
    
    if (isLoadMore) {
      products.value = [...products.value, ...newItems]
      page.value++
    } else {
      products.value = newItems
      page.value = 2 // Next page
    }
    
    // Client side sort (might be partial if not all data loaded)
    // sortProducts() 
    selectedIds.value = []
  } catch (err) {
    console.error("Fetch products error:", err)
    if (err.response) {
      console.error("Response data:", err.response.data)
      console.error("Response status:", err.response.status)
    } else if (err.request) {
      console.error("No response received:", err.request)
    } else {
      console.error("Error setting up request:", err.message)
    }
    toast.error('获取商品列表失败: ' + (err.message || '未知错误'))
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const loadMore = () => {
  if (loadingMore.value || !hasMore.value) return
  fetchProducts(true)
}

const toggleSelectionMode = () => {
  isSelectionMode.value = !isSelectionMode.value
  selectedIds.value = []
}

const toggleSelection = (id) => {
  if (selectedIds.value.includes(id)) {
    selectedIds.value = selectedIds.value.filter(item => item !== id)
  } else {
    selectedIds.value.push(id)
  }
}

const handleShare = (product) => {
  const url = `${window.location.origin}/product/${product.id}`
  navigator.clipboard.writeText(url).then(() => {
    toast.success('商品链接已复制')
  }).catch(() => {
    toast.error('复制失败')
  })
}

const batchDelete = async () => {
  if (selectedIds.value.length === 0) return
  
  const confirmed = await messageBox.confirm(`确定删除选中的 ${selectedIds.value.length} 个商品吗？`)
  if (!confirmed) return
  
  try {
    const res = await axios.post(`${config.API_URL}/products/batch-delete`, { ids: selectedIds.value }, { headers: getAuthHeader() })
    toast.success(`成功删除 ${res.data.count} 个商品`)
    page.value = 1
    products.value = []
    hasMore.value = true
    fetchProducts()
    isSelectionMode.value = false
  } catch (err) {
    toast.error('批量删除失败')
  }
}

const openEditDrawer = (item = null) => {
  editingProduct.value = item
  editDrawerVisible.value = true
}

const deleteProduct = async (id) => {
  const confirmed = await messageBox.confirm('确定删除该商品吗？')
  if (!confirmed) return
  
  try {
    await axios.delete(`${config.API_URL}/products/${id}`, { headers: getAuthHeader() })
    toast.success('删除成功')
    page.value = 1
    products.value = []
    hasMore.value = true
    fetchProducts()
  } catch (err) {
    toast.error('删除失败')
  }
}

const isUploading = ref(false)
const uploadProgress = ref(0)
const uploadStatusText = ref('')

const handleBatchUpload = async () => {
  if (!batchFile.value) return
  
  const formData = new FormData()
  formData.append('file', batchFile.value)
  
  isUploading.value = true
  uploadProgress.value = 10
  uploadStatusText.value = '正在上传文件...'
  
  try {
    const res = await axios.post(`${config.API_URL}/batch-update`, formData, {
      headers: getAuthHeader(),
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
        // Upload only accounts for part of the process, let's cap it at 80%
        if (percentCompleted < 100) {
           uploadProgress.value = Math.round(percentCompleted * 0.8)
        } else {
           uploadProgress.value = 80
           uploadStatusText.value = '正在解压并处理图片特征，请稍候...'
        }
      }
    })
    
    uploadProgress.value = 100
    uploadStatusText.value = '处理完成！'
    
    const msg = `成功处理 ${res.data.processed_products_count} 个新商品，更新了 ${res.data.updated_images_count || 0} 个现有商品`
    toast.success(msg)
    fetchProducts()
    setTimeout(() => {
      showBatchModal.value = false
      batchStatus.value = ''
      batchFile.value = null
      isUploading.value = false
      uploadProgress.value = 0
    }, 1500)
  } catch (err) {
    const msg = '处理失败: ' + (err.response?.data?.detail || err.message)
    uploadStatusText.value = msg
    toast.error(msg)
    isUploading.value = false
  }
}

const viewImage = (url, allUrls = null) => {
  currentImage.value = url
  if (allUrls) {
    previewImageUrls.value = allUrls
    currentImageIndex.value = allUrls.indexOf(url)
  } else {
    previewImageUrls.value = [url]
    currentImageIndex.value = 0
  }
  showImageModal.value = true
}

const nextImage = () => {
  if (currentImageIndex.value < previewImageUrls.value.length - 1) {
    currentImageIndex.value++
    currentImage.value = previewImageUrls.value[currentImageIndex.value]
  }
}

const prevImage = () => {
  if (currentImageIndex.value > 0) {
    currentImageIndex.value--
    currentImage.value = previewImageUrls.value[currentImageIndex.value]
  }
}

const handleKeydown = (e) => {
  if (!showImageModal.value) return
  if (e.key === 'ArrowRight') nextImage()
  if (e.key === 'ArrowLeft') prevImage()
  if (e.key === 'Escape') showImageModal.value = false
}

onMounted(() => {
  fetchProducts()
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="space-y-6">
    <!-- Toolbar -->
    <div class="flex flex-col sm:flex-row justify-between gap-4 items-center">
      <div class="flex items-center space-x-4">
        <h2 class="text-xl font-bold text-gray-800">商品清单</h2>
        <div v-if="isSelectionMode" class="flex items-center space-x-2 text-sm text-gray-600 bg-blue-50 px-3 py-1 rounded-full cursor-pointer hover:bg-blue-100 transition" @click="toggleSelectAll">
           <div :class="['w-4 h-4 rounded border flex items-center justify-center transition-colors', isAllSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-400 bg-white']">
              <CheckSquare class="w-3 h-3 text-white" v-if="isAllSelected" />
           </div>
           <span>全选本页 (已选 {{ selectedIds.length }})</span>
        </div>
      </div>
      
      <div class="flex-1 w-full sm:w-auto flex items-center justify-end space-x-2">
        <!-- Search Bar -->
        <div class="w-full sm:w-64">
          <SearchBar 
            v-model="searchQuery" 
            @search="handleSearch" 
            placeholder="输入后按回车搜索..." 
          />
        </div>

        <!-- Mobile Search Button -->
        <button 
           @click="handleSearch"
           class="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition sm:hidden"
           title="搜索"
        >
           <Search class="w-5 h-5" />
        </button>

        <button 
          v-if="isSelectionMode"
          @click="batchDelete"
          :disabled="selectedIds.length === 0"
          class="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
          title="确认删除"
        >
          <Trash2 class="w-5 h-5" />
        </button>
        
        <button 
          @click="toggleSelectionMode"
          :class="['p-2 rounded-lg transition border', 
            isSelectionMode ? 'bg-gray-200 text-gray-800 border-gray-300' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50']"
          :title="isSelectionMode ? '取消选择' : '批量删除'"
        >
          <CheckSquare class="w-5 h-5" />
        </button>

        <div class="relative">
          <button 
            @click="showSortMenu = !showSortMenu"
            class="p-2 bg-white text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            title="排序"
          >
            <ArrowUpDown class="w-5 h-5" />
          </button>
          
          <div v-if="showSortMenu" class="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-xl border border-gray-100 py-1 z-20">
            <button 
              v-for="opt in sortOptions" 
              :key="opt.value"
              @click="handleSort(opt.value)"
              :class="['w-full text-left px-4 py-2 text-sm hover:bg-gray-50', sortType === opt.value ? 'text-blue-600 font-medium' : 'text-gray-700']"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <div class="h-6 w-px bg-gray-300 mx-1 self-center"></div>

        <button 
          @click="showBatchModal = true"
          class="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          title="批量导入"
        >
          <Upload class="w-5 h-5" />
        </button>
        <button 
          @click="openEditDrawer(null)"
          class="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          title="添加商品"
        >
          <Plus class="w-5 h-5" />
        </button>
      </div>
    </div>

    <!-- List -->
    <div v-if="loading" class="text-center py-10">
      <div class="animate-spin inline-block rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
    
    <div v-else class="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      <div 
        v-for="(item, index) in products" 
        :key="item.id"
        :ref="index === products.length - 1 ? (el) => loadMoreTrigger = el : undefined"
        :class="['bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col transition-all relative',
           selectedIds.includes(item.id) ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-100']"
      >
        <!-- Selection Overlay -->
        <div 
          v-if="isSelectionMode" 
          class="absolute inset-0 z-10 cursor-pointer bg-white/10 hover:bg-blue-50/20"
          @click="toggleSelection(item.id)"
        >
          <div class="absolute top-2 left-2">
             <div :class="['w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors',
               selectedIds.includes(item.id) ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-300 bg-white text-transparent']">
               <CheckSquare class="w-4 h-4" />
             </div>
          </div>
        </div>

        <div class="h-48 bg-gray-100 relative group">
          <img 
            v-if="item.images && item.images.length > 0" 
            :src="`${config.API_URL}/${item.images[0].image_path}`" 
            class="w-full h-full object-cover" 
          />
          <div v-else class="w-full h-full flex items-center justify-center text-gray-400 bg-gray-50">
            无图片
          </div>
          
          <!-- Delete Button (Top Right) -->
          <button 
            v-if="!isSelectionMode"
            @click.stop="deleteProduct(item.id)" 
            class="absolute top-2 right-2 bg-red-500 rounded-full text-white hover:bg-red-600 transition-colors z-20 shadow-sm flex items-center justify-center w-6 h-6"
            title="删除商品"
          >
            <X class="w-3.5 h-3.5 stroke-[3]" />
          </button>

          <!-- Share Button (Top Left) -->
          <button 
            v-if="!isSelectionMode && !(editDrawerVisible && editingProduct?.id === item.id)"
            @click.stop="handleShare(item)" 
            class="absolute top-2 left-2 bg-blue-500 rounded-full text-white hover:bg-blue-600 transition-colors z-20 shadow-sm flex items-center justify-center w-6 h-6 opacity-0 group-hover:opacity-100"
            title="分享商品"
          >
            <Share2 class="w-3.5 h-3.5" />
          </button>
          
          <!-- Click overlay to edit -->
          <div 
            v-if="!isSelectionMode" 
            class="absolute inset-0 cursor-pointer"
            @click="openEditDrawer(item)"
          ></div>
          
          <!-- Multi-image indicator -->
          <div v-if="item.images && item.images.length > 1" class="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center space-x-1">
            <Eye class="w-3 h-3" />
            <span>{{ item.images.length }}</span>
          </div>
        </div>
        
        <div class="p-4 flex-1">
          <div class="flex justify-between items-start mb-1">
             <h3 class="font-bold text-lg text-gray-900">{{ item.model_name }}</h3>
             <span class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded max-w-[50%] truncate" v-if="item.product_name" :title="item.product_name">
               {{ item.product_name }}
             </span>
          </div>
          
          <div class="text-sm text-gray-500 space-y-1">
            <p>价格: ¥{{ item.price }}</p>
            <p>维护时间: {{ item.maintenance_time }}</p>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Infinite Scroll Loading Indicator -->
    <div v-if="loadingMore" class="flex justify-center py-6">
      <div class="flex items-center space-x-2 text-gray-500">
        <Loader2 class="w-5 h-5 animate-spin" />
        <span>加载更多...</span>
      </div>
    </div>
    
    <div v-if="!loading && !hasMore && products.length > 0" class="text-center py-6 text-gray-400 text-sm">
       没有更多商品了
    </div>

    <!-- Edit Drawer -->
    <ProductEditDrawer 
      v-model:visible="editDrawerVisible"
      :product="editingProduct"
      :api-url="config.API_URL"
      @saved="fetchProducts"
    />

    <!-- Batch Upload Modal -->
    <div v-if="showBatchModal" class="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
         <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 class="font-bold text-gray-900">批量导入</h3>
          <button @click="showBatchModal = false" class="text-gray-400 hover:text-gray-600">
            <X class="w-5 h-5" />
          </button>
        </div>
        <div class="p-6 space-y-4">
          <div class="bg-blue-50 p-3 rounded-lg text-sm text-blue-700 space-y-1">
             <p class="font-bold">压缩包结构说明:</p>
             <p>请上传 ZIP 格式文件，内部文件夹命名格式为: <br/><code>型号_商品名称_价格</code> (例如: <code>CS001_双半珍珠耳环_99</code>)</p>
             <p>文件夹内可包含多张图片</p>
          </div>
          <input 
            type="file" 
            accept=".zip"
            class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            @change="e => batchFile = e.target.files[0]"
          />
          <div v-if="isUploading" class="space-y-2">
            <div class="w-full bg-gray-200 rounded-full h-2.5">
              <div class="bg-blue-600 h-2.5 rounded-full transition-all duration-300" :style="{ width: uploadProgress + '%' }"></div>
            </div>
            <p class="text-xs text-blue-600 text-center font-medium">{{ uploadStatusText }} ({{ uploadProgress }}%)</p>
          </div>
          <div v-else-if="batchStatus" class="text-sm text-blue-600 font-medium">
            {{ batchStatus }}
          </div>
        </div>
        <div class="px-6 py-4 bg-gray-50 flex justify-end space-x-3">
          <button @click="showBatchModal = false" class="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg" :disabled="isUploading">取消</button>
          <button 
            @click="handleBatchUpload" 
            :disabled="!batchFile || isUploading"
            class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
          >
            <Upload class="w-4 h-4" v-if="!isUploading" />
            <div v-else class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
            <span>{{ isUploading ? '处理中...' : '开始导入' }}</span>
          </button>
        </div>
      </div>
    </div>
    
    <!-- Image Preview Modal -->
    <div v-if="showImageModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4" @click="showImageModal = false">
      <div class="relative w-full max-w-5xl h-full flex flex-col items-center justify-center" @click.stop>
         <!-- Close Button -->
         <button @click="showImageModal = false" class="absolute top-4 right-4 text-white hover:text-gray-300 z-50 p-2 bg-black/50 rounded-full">
            <X class="w-8 h-8" />
         </button>
         
         <!-- Main Image -->
         <div class="relative flex items-center justify-center w-full h-full">
            <button 
              v-if="previewImageUrls.length > 1" 
              @click.stop="prevImage" 
              class="absolute left-4 p-2 text-white bg-black/30 hover:bg-black/50 rounded-full transition disabled:opacity-30 disabled:cursor-not-allowed"
              :disabled="currentImageIndex === 0"
            >
              <ChevronLeft class="w-8 h-8" />
            </button>
            
            <img :src="currentImage" class="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
            
            <button 
              v-if="previewImageUrls.length > 1" 
              @click.stop="nextImage" 
              class="absolute right-4 p-2 text-white bg-black/30 hover:bg-black/50 rounded-full transition disabled:opacity-30 disabled:cursor-not-allowed"
              :disabled="currentImageIndex === previewImageUrls.length - 1"
            >
              <ChevronRight class="w-8 h-8" />
            </button>
         </div>
         
         <!-- Counter -->
         <div v-if="previewImageUrls.length > 1" class="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white bg-black/50 px-3 py-1 rounded-full text-sm">
            {{ currentImageIndex + 1 }} / {{ previewImageUrls.length }}
         </div>
      </div>
    </div>
  </div>
</template>

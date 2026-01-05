<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import { ChevronLeft, ChevronRight, Eye } from 'lucide-vue-next'

const route = useRoute()
const product = ref(null)
const loading = ref(true)
const error = ref(null)
const API_URL = 'http://localhost:8000'

// Gallery state
const currentImageIndex = ref(0)

const fetchProduct = async () => {
  loading.value = true
  try {
    const res = await axios.get(`${API_URL}/products/${route.params.id}`)
    product.value = res.data
    // Images are already sorted by backend
  } catch (err) {
    error.value = '商品不存在或已删除'
  } finally {
    loading.value = false
  }
}

const nextImage = () => {
  if (product.value && currentImageIndex.value < product.value.images.length - 1) {
    currentImageIndex.value++
  }
}

const prevImage = () => {
  if (currentImageIndex.value > 0) {
    currentImageIndex.value--
  }
}

onMounted(() => {
  fetchProduct()
})
</script>

<template>
  <div class="max-w-4xl mx-auto p-4">
    <div v-if="loading" class="text-center py-20">
      <div class="animate-spin inline-block rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
    
    <div v-else-if="error" class="text-center py-20 text-gray-500">
      {{ error }}
    </div>
    
    <div v-else class="bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col md:flex-row">
      <!-- Image Gallery -->
      <div class="md:w-1/2 bg-gray-100 relative group h-96 md:h-auto">
        <div v-if="product.images && product.images.length > 0" class="w-full h-full relative flex items-center justify-center bg-black">
           <img 
             :src="`${API_URL}/${product.images[currentImageIndex].image_path}`" 
             class="max-w-full max-h-full object-contain"
           />
           
           <!-- Navigation -->
           <button 
             v-if="product.images.length > 1"
             @click="prevImage"
             class="absolute left-4 p-2 bg-black/30 text-white rounded-full hover:bg-black/50 disabled:opacity-30 disabled:cursor-not-allowed transition"
             :disabled="currentImageIndex === 0"
           >
             <ChevronLeft class="w-6 h-6" />
           </button>
           
           <button 
             v-if="product.images.length > 1"
             @click="nextImage"
             class="absolute right-4 p-2 bg-black/30 text-white rounded-full hover:bg-black/50 disabled:opacity-30 disabled:cursor-not-allowed transition"
             :disabled="currentImageIndex === product.images.length - 1"
           >
             <ChevronRight class="w-6 h-6" />
           </button>
           
           <!-- Counter -->
           <div class="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
             {{ currentImageIndex + 1 }} / {{ product.images.length }}
           </div>
        </div>
        <div v-else class="w-full h-full flex items-center justify-center text-gray-400">
          无图片
        </div>
      </div>
      
      <!-- Details -->
      <div class="md:w-1/2 p-8 flex flex-col">
        <div class="mb-6">
          <h1 class="text-3xl font-bold text-gray-900 mb-2">{{ product.model_name }}</h1>
          <p class="text-xl text-gray-600">{{ product.product_name }}</p>
        </div>
        
        <div class="space-y-4 mb-8">
          <div class="flex justify-between items-center border-b border-gray-100 py-3">
            <span class="text-gray-500">价格</span>
            <span class="text-2xl font-bold text-blue-600">¥{{ product.price }}</span>
          </div>
          <div class="flex justify-between items-center border-b border-gray-100 py-3">
            <span class="text-gray-500">维护时间</span>
            <span class="font-medium text-gray-800">{{ product.maintenance_time }}</span>
          </div>
           <div class="flex justify-between items-center border-b border-gray-100 py-3">
            <span class="text-gray-500">创建时间</span>
            <span class="font-medium text-gray-800">{{ new Date(product.created_at).toLocaleDateString() }}</span>
          </div>
        </div>
        
        <div class="mt-auto">
          <div class="bg-blue-50 p-4 rounded-xl text-blue-800 text-sm">
            <p class="font-medium mb-1">商品说明</p>
            <p>本商品信息仅供内部参考使用。如有疑问请联系管理员。</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import axios from 'axios'
import { Upload, Camera, Search, AlertCircle, X, ChevronRight, Tag, Clock, DollarSign, ZoomIn } from 'lucide-vue-next'
import ProductDetailDrawer from '../components/ProductDetailDrawer.vue'
import { config } from '../config'

const fileInput = ref(null)
const previewUrl = ref(null)
const loading = ref(false)
const results = ref([])
const error = ref(null)

// Detail Drawer
const showDetail = ref(false)
const currentProduct = ref(null)

const triggerUpload = () => {
  fileInput.value.click()
}

const handleFileChange = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  previewUrl.value = URL.createObjectURL(file)
  results.value = []
  error.value = null
  loading.value = true

  const formData = new FormData()
  formData.append('file', file)

  try {
    const res = await axios.post(`${config.API_URL}/recognize`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    console.log("Recognize results:", res.data)
    results.value = res.data
  } catch (err) {
    error.value = "识别失败，请重试"
    console.error(err)
  } finally {
    loading.value = false
  }
}

const formatScore = (score) => {
  return (score * 100).toFixed(1) + '%'
}

const viewProductDetail = (item) => {
  currentProduct.value = item.product
  showDetail.value = true
}
</script>

<template>
  <div class="space-y-6">
    <!-- Upload Area -->
    <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
      <input 
        type="file" 
        ref="fileInput" 
        class="hidden" 
        accept="image/*" 
        @change="handleFileChange"
      />
      
      <div v-if="!previewUrl" class="py-10 flex flex-col items-center justify-center space-y-4 cursor-pointer" @click="triggerUpload">
        <div class="bg-blue-50 p-4 rounded-full">
          <Camera class="w-8 h-8 text-blue-500" />
        </div>
        <div>
          <h3 class="text-lg font-medium text-gray-900">点击上传或拍摄</h3>
          <p class="text-sm text-gray-500">支持 JPG, PNG 格式</p>
        </div>
      </div>

      <div v-else class="relative">
        <img :src="previewUrl" class="max-h-64 mx-auto rounded-lg shadow-sm" />
        <button 
          @click="triggerUpload"
          class="absolute bottom-2 right-2 bg-white/90 p-2 rounded-full shadow-md hover:bg-white text-gray-700"
        >
          <Upload class="w-5 h-5" />
        </button>
      </div>
    </div>

    <!-- Results -->
    <div v-if="loading" class="flex justify-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>

    <div v-if="error" class="bg-red-50 text-red-600 p-4 rounded-lg flex items-center space-x-2">
      <AlertCircle class="w-5 h-5" />
      <span>{{ error }}</span>
    </div>

    <div v-if="results.length > 0" class="space-y-4">
      <h3 class="font-medium text-gray-900 flex items-center space-x-2">
        <Search class="w-4 h-4" />
        <span>识别结果 (Top {{ results.length }})</span>
      </h3>
      
      <div class="grid gap-4 sm:grid-cols-2">
        <div 
          v-for="(item, idx) in results" 
          :key="idx"
          class="bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex space-x-4 transition-all hover:shadow-md cursor-pointer relative overflow-hidden group"
          @click="viewProductDetail(item)"
        >
          <div class="w-20 h-20 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
            <img 
              :src="`${config.API_URL}/${item.product.image_path}`" 
              class="w-full h-full object-cover"
            />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex justify-between items-start">
              <div class="truncate">
                 <h4 class="font-bold text-gray-900 truncate">{{ item.product.model_name }}</h4>
                 <p class="text-xs text-gray-500 truncate" v-if="item.product.product_name">{{ item.product.product_name }}</p>
              </div>
              <span 
                :class="['text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ml-2', 
                  idx === 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600']"
              >
                {{ formatScore(item.score) }}
              </span>
            </div>
            <div class="mt-1 text-sm text-gray-500 space-y-0.5">
              <p>价格: ¥{{ item.product.price }}</p>
              <p>维护: {{ item.product.maintenance_time }}</p>
            </div>
          </div>
          
          <!-- Hover indicator -->
          <div class="absolute right-2 bottom-2 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
            <ZoomIn class="w-5 h-5" />
          </div>
        </div>
      </div>
    </div>

      <ProductDetailDrawer 
        v-model:visible="showDetail"
        :product="currentProduct"
        :api-url="config.API_URL"
      />
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { X, Save, Upload, GripVertical, Trash2, XCircle, ChevronLeft, ChevronRight, Share2 } from 'lucide-vue-next'
import axios from 'axios'
import { useToast } from '../composables/useToast'

const props = defineProps({
  visible: Boolean,
  product: Object, // null for create mode
  apiUrl: String
})

const emit = defineEmits(['update:visible', 'saved'])
const toast = useToast()

const getAuthHeader = () => {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const form = ref({
  id: null,
  model_name: '',
  product_name: '',
  price: 0,
  maintenance_time: '',
})

// Images state
// Each item: { id: number | null, url: string, file: File | null, isNew: boolean, isDeleted: boolean }
const images = ref([])
const deletedImageIds = ref([])
const isDragging = ref(false)
const dragIndex = ref(null)

const isEditing = computed(() => !!form.value.id)

// Initialize form when opening
watch(() => props.visible, (val) => {
  if (val) {
    if (props.product) {
      // Edit mode
      form.value = {
        id: props.product.id,
        model_name: props.product.model_name,
        product_name: props.product.product_name,
        price: props.product.price,
        maintenance_time: props.product.maintenance_time
      }
      
      // Initialize images
      // props.product.images should be sorted by display_order from backend
      images.value = (props.product.images || []).map(img => ({
        id: img.id,
        url: `${props.apiUrl}/${img.image_path}`,
        file: null,
        isNew: false,
        isDeleted: false
      }))
    } else {
      // Create mode
      form.value = {
        id: null,
        model_name: '',
        product_name: '',
        price: 0,
        maintenance_time: new Date().toISOString().split('T')[0]
      }
      images.value = []
    }
    deletedImageIds.value = []
  }
})

const close = () => {
  emit('update:visible', false)
}

const handleFileSelect = (e) => {
  const files = Array.from(e.target.files)
  if (files.length > 0) {
    files.forEach(file => {
      images.value.push({
        id: null,
        url: URL.createObjectURL(file),
        file: file,
        isNew: true,
        isDeleted: false
      })
    })
  }
  // Clear input
  e.target.value = ''
}

const removeImage = (index) => {
  const img = images.value[index]
  if (!img.isNew) {
    deletedImageIds.value.push(img.id)
  }
  images.value.splice(index, 1)
}

// Drag and Drop Logic
const onDragStart = (e, index) => {
  dragIndex.value = index
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.dropEffect = 'move'
  // Optional: set drag image
}

const onDragEnter = (e) => {
  e.preventDefault()
}

const onDragOver = (e) => {
  e.preventDefault()
}

const previewUrl = ref(null)
const previewIndex = ref(0)

const openPreview = (index) => {
  previewIndex.value = index
  previewUrl.value = images.value[index].url
}
const closePreview = () => {
  previewUrl.value = null
}
const nextPreview = () => {
  if (previewIndex.value < images.value.length - 1) {
    previewIndex.value++
    previewUrl.value = images.value[previewIndex.value].url
  }
}
const prevPreview = () => {
  if (previewIndex.value > 0) {
    previewIndex.value--
    previewUrl.value = images.value[previewIndex.value].url
  }
}

// Keyboard navigation for preview
const handleKeydown = (e) => {
  if (!previewUrl.value) return
  if (e.key === 'ArrowRight') nextPreview()
  if (e.key === 'ArrowLeft') prevPreview()
  if (e.key === 'Escape') closePreview()
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

const onDrop = (e, index) => {
  e.preventDefault()
  if (dragIndex.value === null || dragIndex.value === index) return
  
  const item = images.value[dragIndex.value]
  images.value.splice(dragIndex.value, 1)
  images.value.splice(index, 0, item)
  dragIndex.value = null
}

const isSaving = ref(false)

const handleShare = () => {
  if (!form.value.id) return
  const url = `${window.location.origin}/product/${form.value.id}`
  navigator.clipboard.writeText(url).then(() => {
    toast.success('商品链接已复制')
  }).catch(() => {
    toast.error('复制失败')
  })
}

const save = async () => {
  if (isSaving.value) return
  isSaving.value = true
  
  try {
    let pid = form.value.id
    
    // 1. Create or Update Product Info
    if (isEditing.value) {
      await axios.put(`${props.apiUrl}/products/${pid}`, {
        model_name: form.value.model_name,
        product_name: form.value.product_name,
        price: form.value.price,
        maintenance_time: form.value.maintenance_time
      }, { headers: getAuthHeader() })
    } else {
      // For create
      if (images.value.length === 0) {
        toast.error('请至少选择一张图片')
        isSaving.value = false
        return
      }
      
      const formData = new FormData()
      formData.append('model_name', form.value.model_name)
      formData.append('product_name', form.value.product_name)
      formData.append('price', form.value.price)
      formData.append('maintenance_time', form.value.maintenance_time)
      
      images.value.forEach(img => {
        if (img.file) formData.append('files', img.file)
      })
      
      await axios.post(`${props.apiUrl}/products`, formData, { headers: getAuthHeader() })
      toast.success('添加成功')
      emit('saved')
      close()
      isSaving.value = false
      return
    }

    // 2. Delete removed images
    if (deletedImageIds.value.length > 0) {
      for (const id of deletedImageIds.value) {
        await axios.delete(`${props.apiUrl}/images/${id}`, { headers: getAuthHeader() })
      }
    }

    // 3. Upload new images
    for (let i = 0; i < images.value.length; i++) {
      const img = images.value[i]
      if (img.isNew && img.file) {
        const formData = new FormData()
        formData.append('file', img.file)
        const res = await axios.post(`${props.apiUrl}/products/${pid}/upload-image`, formData, { headers: getAuthHeader() })
        // Update item with new ID
        images.value[i].id = res.data.id
        images.value[i].isNew = false
      }
    }

    // 4. Reorder
    const reorderItems = images.value.map((img, index) => ({
      id: img.id,
      display_order: index
    }))
    
    await axios.post(`${props.apiUrl}/products/reorder-images`, { items: reorderItems }, { headers: getAuthHeader() })

    toast.success('保存成功')
    emit('saved')
    close()

  } catch (err) {
    console.error(err)
    toast.error('保存失败')
  } finally {
    isSaving.value = false
  }
}

</script>

<template>
  <div>
    <!-- Drawer Overlay -->
    <div 
      class="fixed inset-0 z-50 pointer-events-none overflow-hidden" 
      :class="{ 'pointer-events-auto': visible }"
    >
      <div 
        class="absolute inset-0 bg-black/50 transition-opacity duration-300" 
        :class="visible ? 'opacity-100' : 'opacity-0'"
        @click="close"
      ></div>
      
      <div 
        class="absolute inset-y-0 right-0 max-w-md w-full bg-white shadow-xl transform transition-transform duration-300 flex flex-col"
        :class="visible ? 'translate-x-0' : 'translate-x-full'"
      >
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 class="font-bold text-lg text-gray-900">{{ isEditing ? '编辑商品' : '添加商品' }}</h3>
          <div class="flex items-center space-x-2">
            <button 
              v-if="isEditing" 
              @click="handleShare" 
              class="text-blue-500 hover:text-blue-700 p-1 rounded-full hover:bg-blue-50"
              title="分享商品"
            >
              <Share2 class="w-5 h-5" />
            </button>
            <button @click="close" class="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200">
              <X class="w-6 h-6" />
            </button>
          </div>
        </div>
        
        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-6 space-y-6">
          
          <!-- Basic Info -->
          <div class="space-y-4">
            <div class="space-y-1">
                <label class="block text-sm font-medium text-gray-700">商品型号</label>
                <input v-model="form.model_name" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="例如: CS001">
            </div>
            <div class="space-y-1">
                <label class="block text-sm font-medium text-gray-700">商品名称</label>
                <input v-model="form.product_name" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="例如: 双半珍珠耳环">
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div class="space-y-1">
                  <label class="block text-sm font-medium text-gray-700">价格</label>
                  <input type="number" v-model="form.price" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                </div>
                <div class="space-y-1">
                  <label class="block text-sm font-medium text-gray-700">维护时间</label>
                  <input type="date" v-model="form.maintenance_time" class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                </div>
            </div>
          </div>

          <!-- Image Management -->
          <div class="space-y-2">
            <div class="flex justify-between items-center">
              <label class="block text-sm font-medium text-gray-700">商品图片</label>
              <span class="text-xs text-gray-400">拖动可排序</span>
            </div>
            
            <div class="grid grid-cols-3 gap-3">
              <!-- Images List -->
              <div 
                v-for="(img, index) in images" 
                :key="img.isNew ? `new-${index}` : img.id"
                class="aspect-square relative group rounded-lg overflow-hidden border bg-gray-50 cursor-move"
                draggable="true"
                @dragstart="onDragStart($event, index)"
                @dragenter="onDragEnter"
                @dragover="onDragOver"
                @drop="onDrop($event, index)"
                @click="openPreview(index)"
              >
                <img :src="img.url" class="w-full h-full object-cover" />
                
                <!-- Delete Button (Top Right) -->
                <button 
                  @click.stop="removeImage(index)" 
                  class="absolute top-1 right-1 bg-red-500 rounded-full text-white hover:bg-red-600 transition-colors z-10 shadow-sm flex items-center justify-center w-5 h-5"
                  title="删除图片"
                >
                   <X class="w-3 h-3 stroke-[3]" />
                </button>
              </div>

              <!-- Upload Button -->
              <div 
                class="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 transition text-gray-400 hover:text-blue-500 bg-gray-50"
                @click="$refs.fileInput.click()"
              >
                <input type="file" ref="fileInput" class="hidden" accept="image/*" multiple @change="handleFileSelect">
                <Upload class="w-6 h-6 mb-1" />
                <span class="text-xs">添加</span>
              </div>
            </div>
          </div>

        </div>
        
        <!-- Footer -->
        <div class="p-6 border-t border-gray-100 bg-gray-50">
           <button @click="save" class="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition shadow-lg shadow-blue-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed" :disabled="isSaving">
              <div v-if="isSaving" class="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
              <Save v-else class="w-5 h-5" />
              <span>{{ isSaving ? '保存中...' : '保存更改' }}</span>
           </button>
        </div>
      </div>
    </div>
    
    <!-- Image Preview Modal (Fullscreen) -->
    <div v-if="previewUrl" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4" @click="closePreview">
      <button @click="closePreview" class="absolute top-4 right-4 text-white hover:text-gray-300 p-2 bg-black/50 rounded-full z-10">
         <X class="w-8 h-8" />
      </button>
      
      <div class="relative w-full max-w-5xl h-full flex items-center justify-center">
        <!-- Left Arrow -->
        <button 
          v-if="images.length > 1" 
          @click.stop="prevPreview" 
          class="absolute left-0 p-2 text-white bg-black/30 hover:bg-black/50 rounded-full transition disabled:opacity-30 disabled:cursor-not-allowed z-10"
          :disabled="previewIndex === 0"
        >
          <ChevronLeft class="w-8 h-8" />
        </button>

        <img :src="previewUrl" class="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" @click.stop />

        <!-- Right Arrow -->
        <button 
          v-if="images.length > 1" 
          @click.stop="nextPreview" 
          class="absolute right-0 p-2 text-white bg-black/30 hover:bg-black/50 rounded-full transition disabled:opacity-30 disabled:cursor-not-allowed z-10"
          :disabled="previewIndex === images.length - 1"
        >
          <ChevronRight class="w-8 h-8" />
        </button>

        <!-- Counter -->
        <div class="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white bg-black/50 px-3 py-1 rounded-full text-sm">
            {{ previewIndex + 1 }} / {{ images.length }}
        </div>
      </div>
    </div>
  </div>
</template>

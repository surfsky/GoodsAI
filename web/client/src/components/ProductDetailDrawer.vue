<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { X, ChevronLeft, ChevronRight, Tag, Clock, DollarSign, Maximize2, Share2 } from 'lucide-vue-next'
import { useToast } from '../composables/useToast'

const props = defineProps({
  visible: Boolean,
  product: Object,
  score: Number, // Optional now
  apiUrl: String
})

const emit = defineEmits(['update:visible'])
const toast = useToast()

const currentImageIndex = ref(0)
const showFullScreen = ref(false)

const images = computed(() => {
  if (!props.product) return []
  // If product has 'images' array (from backend update), use it
  if (props.product.images && props.product.images.length > 0) {
    return props.product.images
  }
  // Fallback to single image_path
  if (props.product.image_path) {
    return [props.product.image_path]
  }
  return []
})

const currentImageUrl = computed(() => {
  if (images.value.length === 0) return ''
  return `${props.apiUrl}/${images.value[currentImageIndex.value]}`
})

// Reset index when product changes
watch(() => props.product, () => {
  currentImageIndex.value = 0
})

const nextImage = () => {
  if (currentImageIndex.value < images.value.length - 1) {
    currentImageIndex.value++
  } else {
    currentImageIndex.value = 0 // Loop back
  }
}

const prevImage = () => {
  if (currentImageIndex.value > 0) {
    currentImageIndex.value--
  } else {
    currentImageIndex.value = images.value.length - 1 // Loop back
  }
}

const handleShare = () => {
  if (!props.product) return
  const url = `${window.location.origin}/product/${props.product.id}`
  navigator.clipboard.writeText(url).then(() => {
    toast.success('商品链接已复制')
  }).catch(() => {
    toast.error('复制失败')
  })
}

const close = () => {
  emit('update:visible', false)
}

const handleKeydown = (e) => {
  if (!props.visible && !showFullScreen.value) return
  if (e.key === 'ArrowRight') nextImage()
  if (e.key === 'ArrowLeft') prevImage()
  if (e.key === 'Escape') {
    if (showFullScreen.value) showFullScreen.value = false
    else close()
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
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
          <h3 class="font-bold text-lg text-gray-900">商品详情</h3>
          <div class="flex items-center space-x-2">
            <button 
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
        <div class="flex-1 overflow-y-auto p-6 space-y-6" v-if="product">
          <!-- Image Gallery -->
          <div class="relative aspect-square bg-gray-100 rounded-xl overflow-hidden shadow-inner group">
             <img 
               :src="currentImageUrl" 
               class="w-full h-full object-cover cursor-zoom-in transition-transform duration-500 hover:scale-105" 
               @click="showFullScreen = true"
             />
             
             <!-- Navigation Buttons (only if multiple images) -->
             <template v-if="images.length > 1">
               <button 
                 @click.stop="prevImage"
                 class="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/30 text-white rounded-full hover:bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
               >
                 <ChevronLeft class="w-6 h-6" />
               </button>
               <button 
                 @click.stop="nextImage"
                 class="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/30 text-white rounded-full hover:bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
               >
                 <ChevronRight class="w-6 h-6" />
               </button>
               
               <!-- Dots Indicator -->
               <div class="absolute bottom-3 left-1/2 -translate-x-1/2 flex space-x-1.5">
                 <div 
                   v-for="(_, idx) in images" 
                   :key="idx"
                   class="w-2 h-2 rounded-full transition-colors"
                   :class="idx === currentImageIndex ? 'bg-white' : 'bg-white/50'"
                 ></div>
               </div>
             </template>

             <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button @click.stop="showFullScreen = true" class="p-2 bg-black/30 text-white rounded-full hover:bg-black/50">
                   <Maximize2 class="w-5 h-5" />
                </button>
             </div>
          </div>
          
          <!-- Info -->
          <div class="space-y-4">
             <div>
               <h2 class="text-2xl font-bold text-gray-900">{{ product.model_name }}</h2>
               <p class="text-gray-500 text-lg mt-1" v-if="product.product_name">{{ product.product_name }}</p>
             </div>
             
             <div class="bg-gray-50 rounded-xl p-4 space-y-3">
                <!-- Removed Score as requested -->
                
                <div class="flex items-center space-x-3 text-gray-700">
                   <DollarSign class="w-5 h-5 text-green-500" />
                   <span class="font-medium">价格:</span>
                   <span>¥{{ product.price }}</span>
                </div>
                
                <div class="flex items-center space-x-3 text-gray-700">
                   <Clock class="w-5 h-5 text-orange-500" />
                   <span class="font-medium">维护时间:</span>
                   <span>{{ product.maintenance_time }}</span>
                </div>
             </div>
             
             <!-- Removed Admin maintenance text as requested -->
          </div>
        </div>
        
        <!-- Footer -->
        <div class="p-6 border-t border-gray-100 bg-gray-50">
           <button @click="close" class="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition shadow-lg shadow-blue-200">
              关闭
           </button>
        </div>
      </div>
    </div>

    <!-- Full Screen Image Modal -->
    <div v-if="showFullScreen" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm" @click="showFullScreen = false">
      <div class="relative w-full h-full flex items-center justify-center">
         <!-- Close -->
         <button @click="showFullScreen = false" class="absolute top-6 right-6 text-white hover:text-gray-300 z-50 p-2 bg-white/10 rounded-full">
            <X class="w-8 h-8" />
         </button>
         
         <!-- Main Image -->
         <img :src="currentImageUrl" class="max-w-full max-h-screen object-contain" @click.stop />
         
         <!-- Nav -->
         <template v-if="images.length > 1">
           <button 
             @click.stop="prevImage" 
             class="absolute left-6 p-3 text-white bg-white/10 hover:bg-white/20 rounded-full transition"
           >
             <ChevronLeft class="w-10 h-10" />
           </button>
           
           <button 
             @click.stop="nextImage" 
             class="absolute right-6 p-3 text-white bg-white/10 hover:bg-white/20 rounded-full transition"
           >
             <ChevronRight class="w-10 h-10" />
           </button>
           
           <!-- Counter -->
           <div class="absolute bottom-6 left-1/2 transform -translate-x-1/2 text-white bg-black/50 px-4 py-2 rounded-full text-sm font-medium backdrop-blur-md">
              {{ currentImageIndex + 1 }} / {{ images.length }}
           </div>
         </template>
      </div>
    </div>
  </div>
</template>

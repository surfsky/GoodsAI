<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { ChevronRight, Check } from 'lucide-vue-next'

const emit = defineEmits(['success'])

const isLocked = ref(true)
const sliderX = ref(0)
const sliderContainer = ref(null)
const isDragging = ref(false)
const startX = ref(0)
const containerWidth = ref(0)
const maxSlide = ref(0)

const onSuccess = () => {
  isLocked.value = false
  sliderX.value = maxSlide.value
  emit('success')
}

const onMouseDown = (e) => {
  if (!isLocked.value) return
  isDragging.value = true
  startX.value = (e.touches ? e.touches[0].clientX : e.clientX)
}

const onMouseMove = (e) => {
  if (!isDragging.value || !isLocked.value) return
  
  const clientX = (e.touches ? e.touches[0].clientX : e.clientX)
  const diff = clientX - startX.value
  
  if (diff < 0) {
    sliderX.value = 0
  } else if (diff > maxSlide.value) {
    sliderX.value = maxSlide.value
  } else {
    sliderX.value = diff
  }
}

const onMouseUp = () => {
  if (!isDragging.value || !isLocked.value) return
  isDragging.value = false
  
  if (sliderX.value > maxSlide.value * 0.9) {
    onSuccess()
  } else {
    sliderX.value = 0
  }
}

onMounted(() => {
  if (sliderContainer.value) {
    containerWidth.value = sliderContainer.value.clientWidth
    maxSlide.value = containerWidth.value - 48 // 48 is slider width (h-12 w-12)
  }
  
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('touchmove', onMouseMove)
  window.addEventListener('touchend', onMouseUp)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
  window.removeEventListener('touchmove', onMouseMove)
  window.removeEventListener('touchend', onMouseUp)
})
</script>

<template>
  <div class="relative h-12 w-full bg-gray-100 rounded-full overflow-hidden select-none" ref="sliderContainer">
    <!-- Background Text -->
    <div 
      class="absolute inset-0 flex items-center justify-center text-sm text-gray-400 transition-opacity duration-300"
      :class="{ 'opacity-0': sliderX > 20 || !isLocked }"
    >
      按住滑块，拖拽到最右侧
    </div>
    
    <!-- Success Background -->
    <div 
      class="absolute inset-y-0 left-0 bg-green-500 transition-all duration-0"
      :class="{ 'duration-300': !isDragging }"
      :style="{ width: (sliderX + 24) + 'px' }"
    ></div>
    
    <!-- Slider Button -->
    <div 
      class="absolute top-0 left-0 h-12 w-12 bg-white border border-gray-200 rounded-full shadow-sm flex items-center justify-center cursor-pointer hover:bg-gray-50 active:bg-gray-100 z-10 transition-transform duration-0"
      :class="{ 'transition-all duration-300': !isDragging }"
      :style="{ transform: `translateX(${sliderX}px)` }"
      @mousedown="onMouseDown"
      @touchstart="onMouseDown"
    >
      <div v-if="!isLocked" class="text-green-500">
        <Check class="w-6 h-6" />
      </div>
      <ChevronRight v-else class="w-6 h-6 text-gray-400" />
    </div>
    
    <!-- Success Text -->
    <div 
      v-if="!isLocked"
      class="absolute inset-0 flex items-center justify-center text-sm text-white font-medium z-0"
    >
      验证通过
    </div>
  </div>
</template>

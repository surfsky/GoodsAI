<script setup>
import { CheckCircle, AlertCircle, X, Info } from 'lucide-vue-next'
import { computed, onMounted } from 'vue'

const props = defineProps({
  id: String,
  message: String,
  type: {
    type: String,
    default: 'info' // success, error, info
  },
  duration: {
    type: Number,
    default: 3000
  },
  onClose: Function
})

const icon = computed(() => {
  switch (props.type) {
    case 'success': return CheckCircle
    case 'error': return AlertCircle
    default: return Info
  }
})

const colorClass = computed(() => {
  switch (props.type) {
    case 'success': return 'bg-green-50 text-green-800 border-green-200'
    case 'error': return 'bg-red-50 text-red-800 border-red-200'
    default: return 'bg-blue-50 text-blue-800 border-blue-200'
  }
})

onMounted(() => {
  if (props.duration > 0) {
    setTimeout(() => {
      props.onClose(props.id)
    }, props.duration)
  }
})
</script>

<template>
  <div 
    class="flex items-center p-4 mb-3 rounded-lg border shadow-sm transition-all transform translate-x-0"
    :class="colorClass"
    role="alert"
  >
    <component :is="icon" class="flex-shrink-0 w-5 h-5 mr-3" />
    <div class="text-sm font-medium">{{ message }}</div>
    <button 
      @click="onClose(id)"
      class="ml-auto -mx-1.5 -my-1.5 rounded-lg p-1.5 inline-flex h-8 w-8 hover:bg-black/5 focus:ring-2 focus:ring-gray-300"
    >
      <X class="w-4 h-4" />
    </button>
  </div>
</template>

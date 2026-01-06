<script setup>
import { Search, X } from 'lucide-vue-next'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: '搜索...'
  }
})

const emit = defineEmits(['update:modelValue', 'search'])

const handleInput = (e) => {
  emit('update:modelValue', e.target.value)
}

const handleSearch = () => {
  emit('search')
}

const clearSearch = () => {
  emit('update:modelValue', '')
  emit('search')
}
</script>

<template>
  <div class="relative w-full">
    <div 
      class="absolute inset-y-0 left-0 pl-3 flex items-center cursor-pointer hover:text-blue-600 transition-colors z-10"
      @click="handleSearch"
      title="点击搜索"
    >
      <Search class="h-4 w-4 text-gray-400 hover:text-blue-500" />
    </div>
    <input 
      :value="modelValue"
      @input="handleInput"
      @keyup.enter="handleSearch"
      type="text" 
      class="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-150 ease-in-out" 
      :placeholder="placeholder"
    />
    <div v-if="modelValue" class="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer" @click="clearSearch">
      <X class="h-4 w-4 text-gray-400 hover:text-gray-600" />
    </div>
    <div v-else class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
       <span class="text-xs text-gray-400">⏎</span>
    </div>
  </div>
</template>
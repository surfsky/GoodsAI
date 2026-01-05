import { ref } from 'vue'

const state = ref({
  visible: false,
  title: '',
  message: '',
  type: 'alert', // alert, confirm
  confirmText: '确定',
  cancelText: '取消',
  resolve: null,
  reject: null
})

export function useMessageBox() {
  const show = (options) => {
    return new Promise((resolve, reject) => {
      state.value = {
        visible: true,
        title: options.title || '提示',
        message: options.message || '',
        type: options.type || 'alert',
        confirmText: options.confirmText || '确定',
        cancelText: options.cancelText || '取消',
        resolve,
        reject
      }
    })
  }

  const alert = (message, title = '提示') => {
    return show({ type: 'alert', message, title })
  }

  const confirm = (message, title = '确认') => {
    return show({ type: 'confirm', message, title })
  }

  const handleConfirm = () => {
    if (state.value.resolve) state.value.resolve(true)
    close()
  }

  const handleCancel = () => {
    if (state.value.resolve) state.value.resolve(false)
    close()
  }

  const close = () => {
    state.value.visible = false
    state.value.resolve = null
    state.value.reject = null
  }

  return {
    state,
    alert,
    confirm,
    handleConfirm,
    handleCancel
  }
}

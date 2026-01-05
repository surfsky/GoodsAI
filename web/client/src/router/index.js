import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import AdminView from '../views/AdminView.vue'
import LoginView from '../views/LoginView.vue'
import LogsView from '../views/LogsView.vue'
import ProductDetailView from '../views/ProductDetailView.vue'
import ProfileView from '../views/ProfileView.vue'
import UsersView from '../views/UsersView.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView
  },
  {
    path: '/login',
    name: 'login',
    component: LoginView
  },
  {
    path: '/admin',
    name: 'admin',
    component: AdminView,
    meta: { requiresAuth: true, role: 'admin' }
  },
  {
    path: '/logs',
    name: 'logs',
    component: LogsView,
    meta: { requiresAuth: true, role: 'admin' }
  },
  {
    path: '/users',
    name: 'users',
    component: UsersView,
    meta: { requiresAuth: true, role: 'admin' }
  },
  {
    path: '/profile',
    name: 'profile',
    component: ProfileView,
    meta: { requiresAuth: true }
  },
  {
    path: '/product/:id',
    name: 'product-detail',
    component: ProductDetailView
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  const userRole = localStorage.getItem('user_role')

  if (to.meta.requiresAuth) {
    if (!token) {
      next('/login')
    } else {
      if (to.meta.role && to.meta.role !== userRole) {
        // Not authorized
        alert('权限不足')
        next('/')
      } else {
        next()
      }
    }
  } else {
    next()
  }
})

export default router

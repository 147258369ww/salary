import axios from 'axios'
import { ElMessage } from 'element-plus'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 10000
})

// Response interceptor
api.interceptors.response.use(
  response => response.data,
  error => {
    const message = error.response?.data?.error || error.message || 'Request failed'
    ElMessage.error(message)
    return Promise.reject(error)
  }
)

// Admin API
export const login = (username, password) =>
  api.post('/admin/login', { username, password })

export const logout = () =>
  api.post('/admin/logout')

export const checkAuth = () =>
  api.get('/admin/me')

export const getApplications = (params) =>
  api.get('/admin/applications', { params })

export const approveApplication = (id, adminComment) =>
  api.post(`/admin/applications/${id}/approve`, { adminComment })

export const rejectApplication = (id, adminComment) =>
  api.post(`/admin/applications/${id}/reject`, { adminComment })

export const getAgents = () =>
  api.get('/admin/agents')

export const getTransactions = (params) =>
  api.get('/admin/transactions', { params })

export const getStats = () =>
  api.get('/admin/stats')

export const createAgent = (name, initialBalance) =>
  api.post('/admin/agents', { name, initialBalance })

export const deleteAgent = (id) =>
  api.delete(`/admin/agents/${id}`)

export default api
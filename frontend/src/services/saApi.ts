import axios from 'axios'

const saApi = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

saApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('sa_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

saApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('sa_token')
      localStorage.removeItem('sa_user')
      window.location.href = '/superadmin/login'
    }
    return Promise.reject(err)
  }
)

export default saApi

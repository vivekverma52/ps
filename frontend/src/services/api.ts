import axios from 'axios'

const api = axios.create({
  baseURL:         '/api',
  headers:         { 'Content-Type': 'application/json' },
  withCredentials: true, // send HTTP-only refresh-token cookie on every request
})

// Separate instance used exclusively for the refresh call.
// It does NOT have the 401 interceptor attached, which prevents infinite loops.
const authApi = axios.create({
  baseURL:         '/api',
  headers:         { 'Content-Type': 'application/json' },
  withCredentials: true,
})

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  // When sending FormData, delete the default Content-Type so the browser
  // can set it automatically with the correct multipart/form-data boundary.
  // Using `undefined` is not reliable on mobile browsers — deletion is.
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
})

let isRefreshing = false
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = []

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)))
  failedQueue = []
}

// Auto-refresh on 401, then replay request; give up and redirect to /login on failure
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config

    // Only attempt refresh once per request; skip refresh/login endpoints
    if (
      err.response?.status === 401 &&
      !original._retry &&
      !original.url?.includes('/auth/refresh') &&
      !original.url?.includes('/auth/login')
    ) {
      if (isRefreshing) {
        // Queue concurrent requests while refresh is in flight
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((newToken) => {
          original.headers.Authorization = `Bearer ${newToken}`
          return api(original)
        })
      }

      original._retry = true
      isRefreshing = true

      try {
        // Cookie carries the refresh token — no body needed.
        // Uses authApi (no 401 interceptor) to prevent infinite retry loops.
        const { data } = await authApi.post('/auth/refresh', {})
        const newToken = data.data?.token ?? data.token
        localStorage.setItem('token', newToken)
        api.defaults.headers.common.Authorization = `Bearer ${newToken}`
        processQueue(null, newToken)
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      } catch (refreshErr) {
        processQueue(refreshErr, null)
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/login'
        return Promise.reject(refreshErr)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(err)
  }
)

export default api

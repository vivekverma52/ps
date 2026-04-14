import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'

interface Medicine {
  id: string
  name: string
  quantity: string
  frequency: string
  course: string
  description?: string
}

interface PublicPrescription {
  doctor_name: string
  patient_name: string
  language: string
  image_url?: string
  video_url?: string
  created_at: string
  interpreted_data?: { medicines?: Medicine[] }
}

export default function PublicPage() {
  const { token } = useParams()
  const [data, setData] = useState<PublicPrescription | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    axios.get(`/api/prescriptions/public/${token}`)
      .then(r => setData(r.data))
      .catch(() => setError('Prescription not found or link has expired'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-teal-50 to-white">
        <div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-400 text-sm">Loading your prescription...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Link Not Found</h2>
        <p className="text-sm text-gray-400 text-center max-w-xs">{error}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50/50 to-white">
      {/* Header */}
      <div className="bg-teal-500 text-white px-5 py-5">
        <div className="max-w-lg mx-auto">
          <p className="text-teal-100 text-xs mb-1">Askim Technologies — Multimedia Prescription</p>
          <h1 className="text-xl font-semibold">Hello, {data.patient_name}</h1>
          <p className="text-teal-100 text-sm mt-0.5">
            Prescription from {data.doctor_name}
          </p>
          <p className="text-teal-200 text-xs mt-1">
            {new Date(data.created_at).toLocaleDateString('en-IN', {
              day: '2-digit', month: 'long', year: 'numeric'
            })}
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

        {/* Video player */}
        {data.video_url && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50">
              <h2 className="font-semibold text-gray-900 text-sm">Prescription Video</h2>
              <p className="text-xs text-gray-400 mt-0.5">In {data.language}</p>
            </div>
            <video
              src={data.video_url}
              controls
              className="w-full"
              style={{ maxHeight: '240px', background: '#000' }}
            />
          </div>
        )}

        {/* Medicines */}
        {(() => {
          const medicines = data.interpreted_data?.medicines ?? []
          return (
        <div className="bg-white rounded-2xl border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2">
              <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
            </svg>
            <h2 className="font-semibold text-gray-900 text-sm">
              Your Medicines ({medicines.length})
            </h2>
          </div>

          {medicines.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">No medicines added yet</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {medicines.map((med, i) => (
                <div key={med.id} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-teal-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-teal-700 text-xs font-bold">{i + 1}</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{med.name}</p>
                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                          <p className="text-xs text-gray-500">Qty: <span className="text-gray-700 font-medium">{med.quantity}/day</span></p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                          <p className="text-xs text-gray-500">When: <span className="text-gray-700 font-medium">{med.frequency}</span></p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          <p className="text-xs text-gray-500">Duration: <span className="text-gray-700 font-medium">{med.course}</span></p>
                        </div>
                        {med.description && (
                          <div className="flex items-center gap-1.5 col-span-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                            <p className="text-xs text-gray-500">Note: <span className="text-gray-700">{med.description}</span></p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
          )
        })()}

        {/* Prescription image */}
        {data.image_url && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50">
              <h2 className="font-semibold text-gray-900 text-sm">Original Prescription</h2>
            </div>
            <img src={data.image_url} alt="Prescription" className="w-full object-contain max-h-72" />
          </div>
        )}

        {/* Footer */}
        <div className="text-center pb-4">
          <p className="text-xs text-gray-300">Powered by Askim Technologies Pvt. Ltd.</p>
          <p className="text-xs text-gray-300 mt-0.5">This prescription is digitally verified</p>
        </div>
      </div>
    </div>
  )
}

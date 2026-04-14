import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import api from '../services/api'

interface Medicine {
  id: string
  name: string
  quantity: string
  frequency: string
  course: string
  description?: string
  image_url?: string
}

interface Props {
  prescriptionId: string
  medicine?: Medicine        // if provided → edit mode
  onClose: () => void
  onAdded: () => void
}

const FREQUENCY_OPTIONS = ['Morning', 'Afternoon', 'Night']

export default function MedicineModal({ prescriptionId, medicine, onClose, onAdded }: Props) {
  const isEdit = !!medicine

  const [suggestions, setSuggestions] = useState<string[]>([])
  const [selectedMedicine, setSelectedMedicine] = useState(medicine?.name || '')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [frequency, setFrequency] = useState<string[]>(
    medicine?.frequency ? medicine.frequency.split(',').map(f => f.trim()) : []
  )
  const searchRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, formState: { isSubmitting, errors } } = useForm({
    defaultValues: {
      quantity:    medicine?.quantity    || '1',
      course:      medicine?.course      || '',
      description: medicine?.description || '',
    }
  })

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const searchMedicines = async (q: string) => {
    setSelectedMedicine(q)
    if (q.length < 1) { setSuggestions([]); return }
    try {
      const res = await api.get(`/prescriptions/medicines/search?q=${encodeURIComponent(q)}`)
      setSuggestions(res.data.data)
      setShowSuggestions(true)
    } catch { setSuggestions([]) }
  }

  const toggleFrequency = (f: string) => {
    setFrequency(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])
  }

  const onSubmit = async (data: any) => {
    if (!selectedMedicine) { toast.error('Select a medicine'); return }
    if (frequency.length === 0) { toast.error('Select at least one frequency'); return }

    const body: any = {
      name: selectedMedicine,
      quantity: data.quantity || '1',
      frequency: frequency.join(', '),
      course: data.course,
    }
    if (data.description) body.description = data.description

    try {
      if (isEdit) {
        await api.put(`/prescriptions/${prescriptionId}/medicines/${medicine.id}`, body)
        toast.success('Medicine updated!')
      } else {
        await api.post(`/prescriptions/${prescriptionId}/medicines`, body)
        toast.success('Medicine added!')
      }
      onAdded()
    } catch (err: any) {
      toast.error(err.response?.data?.message || `Failed to ${isEdit ? 'update' : 'add'} medicine`)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white w-full sm:max-w-md sm:mx-4 rounded-t-3xl sm:rounded-2xl shadow-2xl z-10 max-h-[90vh] overflow-y-auto">
        {/* Handle bar (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {isEdit ? 'Edit Medicine' : 'Add New Medicine'}
          </h2>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">

          {/* Medicine search */}
          <div className="relative">
            <label className="text-xs font-medium text-gray-500 mb-1 block">Medicine Name</label>
            <input
              ref={searchRef}
              type="text"
              className="input-field"
              placeholder="Type medicine name (e.g. Zifi 200)"
              value={selectedMedicine}
              onChange={(e) => searchMedicines(e.target.value)}
              onFocus={() => selectedMedicine && setShowSuggestions(true)}
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto">
                {suggestions.map((s) => (
                  <button key={s} type="button"
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-teal-50 hover:text-teal-700 transition-colors first:rounded-t-xl last:rounded-b-xl"
                    onClick={() => { setSelectedMedicine(s); setShowSuggestions(false) }}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quantity */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Quantity per Day</label>
            <input className="input-field" type="number" min="1" max="10"
              {...register('quantity')} />
          </div>

          {/* Frequency */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">Select Frequency:</label>
            <div className="flex gap-4">
              {FREQUENCY_OPTIONS.map((f) => (
                <label key={f} className="flex items-center gap-2 cursor-pointer select-none">
                  <div
                    onClick={() => toggleFrequency(f)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all cursor-pointer
                      ${frequency.includes(f) ? 'bg-teal-500 border-teal-500' : 'border-gray-300 bg-white'}`}>
                    {frequency.includes(f) && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <path d="M20 6L9 17l-5-5"/>
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-gray-700">{f}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Course */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Duration / Course</label>
            <input className="input-field" placeholder="e.g. 5 Days"
              {...register('course', { required: 'Duration is required' })} />
            {errors.course && <p className="text-red-500 text-xs mt-1">{errors.course.message as string}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Description (optional)</label>
            <textarea className="input-field resize-none" rows={2}
              placeholder="e.g. After food, before sleep..."
              {...register('description')} />
          </div>

          <button type="submit" disabled={isSubmitting} className="btn-teal w-full">
            {isSubmitting
              ? (isEdit ? 'Saving...' : 'Adding...')
              : (isEdit ? 'Save Changes' : 'Add Medicine')}
          </button>
        </form>
      </div>
    </div>
  )
}

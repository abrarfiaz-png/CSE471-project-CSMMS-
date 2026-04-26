import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { slotsApi } from '../api/client'

export default function SlotPicker({ serviceId, selectedSlotId, onSelect }) {
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!serviceId) return
    setLoading(true)
    setError(null)

    // Get slots from today onwards
    const today = format(new Date(), 'yyyy-MM-dd')
    slotsApi
      .listByService(serviceId, { from_date: today, available_only: true })
      .then((res) => setSlots(res.data))
      .catch(() => setError('Could not load slots.'))
      .finally(() => setLoading(false))
  }, [serviceId])

  // Group slots by date
  const grouped = slots.reduce((acc, slot) => {
    const key = slot.slot_date
    if (!acc[key]) acc[key] = []
    acc[key].push(slot)
    return acc
  }, {})

  const dates = Object.keys(grouped).sort()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-slate-400">
        <Loader2 size={22} className="animate-spin mr-2" />
        Loading available slots…
      </div>
    )
  }

  if (error) {
    return <p className="text-red-500 text-sm py-4">{error}</p>
  }

  if (dates.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <Clock size={32} className="mx-auto mb-2 opacity-40" />
        <p className="text-sm">No available slots at the moment.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-h-72 overflow-y-auto pr-1">
      {dates.map((dateStr) => (
        <div key={dateStr}>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            {format(parseISO(dateStr), 'EEE, dd MMM yyyy')}
          </p>
          <div className="flex flex-wrap gap-2">
            {grouped[dateStr].map((slot) => {
              const isSelected = slot.id === selectedSlotId
              const isFull = slot.current_bookings >= slot.max_bookings

              return (
                <button
                  key={slot.id}
                  disabled={isFull}
                  onClick={() => !isFull && onSelect(slot)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-150
                    ${isSelected
                      ? 'bg-brand-500 text-white border-brand-500 shadow-md shadow-brand-200'
                      : isFull
                        ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-brand-400 hover:text-brand-600'
                    }`}
                >
                  {isSelected
                    ? <CheckCircle2 size={13} />
                    : isFull
                      ? <XCircle size={13} />
                      : <Clock size={13} />
                  }
                  {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                  {!isFull && (
                    <span className="text-xs opacity-60">
                      ({slot.max_bookings - slot.current_bookings} left)
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

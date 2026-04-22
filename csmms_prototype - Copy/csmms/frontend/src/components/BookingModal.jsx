import { useState } from 'react'
import { X, Star, MapPin, CheckCircle2, Loader2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import SlotPicker from './SlotPicker'
import { bookingsApi } from '../api/client'
import toast from 'react-hot-toast'

const MOCK_STUDENT_ID = 1  // Replace with auth context in production

export default function BookingModal({ service, onClose, onSuccess }) {
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleBook = async () => {
    if (!selectedSlot) {
      toast.error('Please select a time slot')
      return
    }
    setLoading(true)
    try {
      await bookingsApi.create({
        student_id: MOCK_STUDENT_ID,
        service_id: service.id,
        slot_id: selectedSlot.id,
        notes: notes.trim() || null,
      })
      setDone(true)
      toast.success('Booking confirmed!')
      onSuccess?.()
    } catch (err) {
      const msg = err.response?.data?.detail || 'Booking failed. Please try again.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto fade-up">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 flex items-start justify-between p-6 pb-4 border-b border-slate-100">
          <div className="flex-1 pr-4">
            <p className="text-xs font-semibold text-brand-500 uppercase tracking-wider mb-1">
              Book Service
            </p>
            <h2 className="font-display font-bold text-slate-900 text-xl leading-tight">
              {service.title}
            </h2>
            <div className="flex items-center gap-3 mt-1.5 text-sm text-slate-500">
              <span className="flex items-center gap-1">
                <Star size={12} className="text-yellow-400 fill-yellow-400" />
                {service.average_rating.toFixed(1)}
              </span>
              {service.location_name && (
                <span className="flex items-center gap-1">
                  <MapPin size={12} />
                  {service.location_name}
                </span>
              )}
              <span className="font-semibold text-brand-600">
                ৳{service.price_per_hour}/hr
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {done ? (
          /* Success state */
          <div className="p-10 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 size={36} className="text-emerald-500" />
            </div>
            <div>
              <h3 className="font-display font-bold text-xl text-slate-900 mb-1">
                Booking Confirmed!
              </h3>
              <p className="text-slate-500 text-sm">
                Your session on{' '}
                <strong>{format(parseISO(selectedSlot.slot_date), 'dd MMM yyyy')}</strong>{' '}
                at <strong>{selectedSlot.start_time.slice(0, 5)}</strong> is booked.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Status: Pending provider approval.
              </p>
            </div>
            <button onClick={onClose} className="btn-primary mt-2">
              Done
            </button>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Slot Picker */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Select a Time Slot
              </label>
              <SlotPicker
                serviceId={service.id}
                selectedSlotId={selectedSlot?.id}
                onSelect={setSelectedSlot}
              />
            </div>

            {/* Selected Slot Summary */}
            {selectedSlot && (
              <div className="bg-brand-50 rounded-xl p-4 text-sm text-brand-800 border border-brand-100">
                <p className="font-semibold text-brand-700 mb-1">Selected Slot</p>
                <p>
                  {format(parseISO(selectedSlot.slot_date), 'EEEE, dd MMMM yyyy')}
                </p>
                <p>
                  {selectedSlot.start_time.slice(0, 5)} – {selectedSlot.end_time.slice(0, 5)}
                </p>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Notes <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any specific topics or requirements for your session…"
                className="input-field resize-none"
              />
            </div>

            {/* Footer */}
            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={handleBook}
                disabled={loading || !selectedSlot}
                className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <><Loader2 size={16} className="animate-spin" /> Booking…</>
                ) : (
                  'Confirm Booking'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

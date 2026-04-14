import { useState, useEffect } from 'react'
import {
  format, addDays, startOfToday, parseISO,
  eachDayOfInterval, addWeeks, isSameDay
} from 'date-fns'
import {
  Plus, Trash2, Lock, Unlock, ChevronLeft,
  ChevronRight, Loader2, Clock, AlertCircle
} from 'lucide-react'
import { slotsApi } from '../api/client'
import toast from 'react-hot-toast'

const TIME_OPTIONS = [
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00',
]

export default function SlotManager({ serviceId, serviceTitle }) {
  const [weekStart, setWeekStart] = useState(startOfToday())
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addDate, setAddDate] = useState('')
  const [addStart, setAddStart] = useState('09:00')
  const [addEnd, setAddEnd] = useState('10:00')
  const [addMax, setAddMax] = useState(1)
  const [saving, setSaving] = useState(false)

  const weekDays = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) })

  const fetchSlots = async () => {
    if (!serviceId) return
    setLoading(true)
    try {
      const from = format(weekStart, 'yyyy-MM-dd')
      const to = format(addDays(weekStart, 6), 'yyyy-MM-dd')
      const res = await slotsApi.listByService(serviceId, { from_date: from, to_date: to })
      setSlots(res.data)
    } catch {
      toast.error('Failed to load slots.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSlots() }, [serviceId, weekStart])

  const getSlotsForDay = (day) =>
    slots.filter((s) => isSameDay(parseISO(s.slot_date), day))
      .sort((a, b) => a.start_time.localeCompare(b.start_time))

  const handleAddSlot = async () => {
    if (!addDate) { toast.error('Select a date.'); return }
    if (addStart >= addEnd) { toast.error('End time must be after start time.'); return }
    setSaving(true)
    try {
      await slotsApi.create({
        service_id: serviceId,
        slot_date: addDate,
        start_time: addStart + ':00',
        end_time: addEnd + ':00',
        max_bookings: parseInt(addMax),
      })
      toast.success('Slot added!')
      setShowAddForm(false)
      fetchSlots()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add slot.')
    } finally {
      setSaving(false)
    }
  }

  const handleBlock = async (slot) => {
    try {
      await slotsApi.block(slot.id, !slot.is_blocked)
      toast.success(slot.is_blocked ? 'Slot unblocked.' : 'Slot blocked.')
      fetchSlots()
    } catch {
      toast.error('Failed to update slot.')
    }
  }

  const handleDelete = async (slotId) => {
    if (!confirm('Delete this slot? This cannot be undone.')) return
    try {
      await slotsApi.delete(slotId)
      toast.success('Slot deleted.')
      fetchSlots()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Cannot delete slot with active bookings.')
    }
  }

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-bold text-slate-800 text-base">Slot Manager</h3>
          <p className="text-xs text-slate-500">{serviceTitle}</p>
        </div>
        <button
          onClick={() => { setShowAddForm(true); setAddDate(format(weekStart, 'yyyy-MM-dd')) }}
          className="btn-primary flex items-center gap-1.5 text-sm py-2"
        >
          <Plus size={15} /> Add Slot
        </button>
      </div>

      {/* Add slot form */}
      {showAddForm && (
        <div className="bg-brand-50 border border-brand-100 rounded-2xl p-4 fade-up">
          <p className="font-semibold text-brand-800 text-sm mb-3">New Time Slot</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-slate-500 font-semibold mb-1">Date</label>
              <input
                type="date"
                value={addDate}
                min={format(startOfToday(), 'yyyy-MM-dd')}
                onChange={(e) => setAddDate(e.target.value)}
                className="input-field text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 font-semibold mb-1">Start</label>
              <select value={addStart} onChange={(e) => setAddStart(e.target.value)} className="input-field text-sm">
                {TIME_OPTIONS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 font-semibold mb-1">End</label>
              <select value={addEnd} onChange={(e) => setAddEnd(e.target.value)} className="input-field text-sm">
                {TIME_OPTIONS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 font-semibold mb-1">Max Bookings</label>
              <input
                type="number" min="1" max="10"
                value={addMax}
                onChange={(e) => setAddMax(e.target.value)}
                className="input-field text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={() => setShowAddForm(false)} className="btn-secondary text-sm py-1.5">Cancel</button>
            <button
              onClick={handleAddSlot}
              disabled={saving}
              className="btn-primary text-sm py-1.5 flex items-center gap-1.5"
            >
              {saving ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : 'Confirm'}
            </button>
          </div>
        </div>
      )}

      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <button onClick={() => setWeekStart((d) => addDays(d, -7))} className="btn-secondary p-2">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold text-slate-700">
          {format(weekStart, 'dd MMM')} – {format(addDays(weekStart, 6), 'dd MMM yyyy')}
        </span>
        <button onClick={() => setWeekStart((d) => addDays(d, 7))} className="btn-secondary p-2">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div className="flex items-center justify-center py-10 text-slate-400">
          <Loader2 size={22} className="animate-spin mr-2" /> Loading slots…
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const daySlots = getSlotsForDay(day)
            const isPast = day < startOfToday()
            return (
              <div
                key={day.toISOString()}
                className={`rounded-xl border min-h-28 p-2 text-center
                  ${isPast ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-200'}`}
              >
                {/* Day header */}
                <p className="text-xs font-bold text-slate-500 uppercase">{format(day, 'EEE')}</p>
                <p className={`text-sm font-bold mb-1.5 ${isSameDay(day, startOfToday()) ? 'text-brand-600' : 'text-slate-800'}`}>
                  {format(day, 'd')}
                </p>

                {/* Slots for this day */}
                <div className="space-y-1">
                  {daySlots.map((slot) => (
                    <div
                      key={slot.id}
                      className={`rounded-lg px-1.5 py-1 text-xs group relative
                        ${slot.is_blocked
                          ? 'bg-red-50 border border-red-200'
                          : slot.current_bookings >= slot.max_bookings
                            ? 'bg-slate-100 border border-slate-200'
                            : 'bg-brand-50 border border-brand-200'
                        }`}
                    >
                      <div className="flex items-center justify-center gap-0.5 text-slate-600 font-mono text-[10px]">
                        <Clock size={9} />
                        {slot.start_time.slice(0, 5)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {slot.current_bookings}/{slot.max_bookings}
                      </div>
                      {slot.is_blocked && (
                        <div className="text-[9px] text-red-500 font-semibold">BLOCKED</div>
                      )}

                      {/* Hover actions */}
                      {!isPast && (
                        <div className="absolute -top-1 -right-1 hidden group-hover:flex gap-0.5 bg-white rounded-lg shadow border border-slate-100 p-0.5">
                          <button
                            onClick={() => handleBlock(slot)}
                            title={slot.is_blocked ? 'Unblock' : 'Block'}
                            className="p-0.5 hover:text-brand-600 text-slate-500"
                          >
                            {slot.is_blocked ? <Unlock size={10} /> : <Lock size={10} />}
                          </button>
                          <button
                            onClick={() => handleDelete(slot.id)}
                            title="Delete"
                            className="p-0.5 hover:text-red-500 text-slate-500"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Quick add */}
                  {!isPast && (
                    <button
                      onClick={() => {
                        setAddDate(format(day, 'yyyy-MM-dd'))
                        setShowAddForm(true)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                      className="w-full rounded-lg border border-dashed border-slate-200 text-slate-300 hover:text-brand-500 hover:border-brand-300 transition-colors py-1"
                    >
                      <Plus size={12} className="mx-auto" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-brand-100 border border-brand-200" /> Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-slate-100 border border-slate-200" /> Full
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-50 border border-red-200" /> Blocked
        </span>
      </div>
    </div>
  )
}

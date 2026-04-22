import { useState, useEffect } from 'react'
import api from '../api'
import toast from 'react-hot-toast'
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle,
  Users,
  Zap,
} from 'lucide-react'

export default function SlotManagerAdvanced({ serviceId, serviceName, maxCapacity }) {
  const [slots, setSlots] = useState([])
  const [blockedDates, setBlockedDates] = useState([])
  const [loading, setLoading] = useState(false)
  const [showSlotForm, setShowSlotForm] = useState(false)
  const [showBlockForm, setShowBlockForm] = useState(false)
  const [showBulkForm, setShowBulkForm] = useState(false)

  const [slotForm, setSlotForm] = useState({
    date: '',
    start_time: '09:00',
    end_time: '10:00',
    max_bookings: 1,
  })

  const [bulkForm, setBulkForm] = useState({
    start_date: '',
    end_date: '',
    start_time: '09:00',
    end_time: '10:00',
    max_bookings: 1,
  })

  const [blockForm, setBlockForm] = useState({
    start_date: '',
    end_date: '',
    reason: '',
  })

  const [filter, setFilter] = useState({
    from_date: '',
    to_date: '',
    available_only: false,
  })

  const [capacityInfo, setCapacityInfo] = useState(null)
  const [selectedDate, setSelectedDate] = useState('')

  // Fetch slots and blocked dates
  const fetchData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter.from_date) params.append('from_date', filter.from_date)
      if (filter.to_date) params.append('to_date', filter.to_date)
      if (filter.available_only) params.append('available_only', 'true')

      const { data: slotsData } = await api.get(`/api/slots/service/${serviceId}?${params}`)
      setSlots(slotsData)

      const { data: blockedData } = await api.get(`/api/slots/blocked-dates/${serviceId}`)
      setBlockedDates(blockedData)
    } catch (err) {
      toast.error('Failed to load slots')
    } finally {
      setLoading(false)
    }
  }

  // Fetch capacity info for selected date
  const checkCapacity = async (date) => {
    if (!date) return
    try {
      const { data } = await api.get(`/api/slots/capacity/${serviceId}/${date}`)
      setCapacityInfo(data)
    } catch (err) {
      console.error('Failed to fetch capacity:', err)
    }
  }

  useEffect(() => {
    fetchData()
  }, [serviceId, filter])

  useEffect(() => {
    if (selectedDate) {
      checkCapacity(selectedDate)
    }
  }, [selectedDate])

  // Create single slot
  const handleCreateSlot = async (e) => {
    e.preventDefault()
    if (!slotForm.date || !slotForm.start_time || !slotForm.end_time) {
      toast.error('All fields required')
      return
    }

    if (slotForm.start_time >= slotForm.end_time) {
      toast.error('Start time must be before end time')
      return
    }

    try {
      await api.post('/api/slots/', {
        service_id: serviceId,
        slot_date: slotForm.date,
        start_time: slotForm.start_time,
        end_time: slotForm.end_time,
        max_bookings: slotForm.max_bookings,
      })
      toast.success('Slot created!')
      setShowSlotForm(false)
      setSlotForm({ date: '', start_time: '09:00', end_time: '10:00', max_bookings: 1 })
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create slot')
    }
  }

  // Create bulk slots
  const handleCreateBulkSlots = async (e) => {
    e.preventDefault()
    if (
      !bulkForm.start_date ||
      !bulkForm.end_date ||
      !bulkForm.start_time ||
      !bulkForm.end_time
    ) {
      toast.error('All fields required')
      return
    }

    if (new Date(bulkForm.start_date) > new Date(bulkForm.end_date)) {
      toast.error('Start date must be before end date')
      return
    }

    try {
      const { data } = await api.post('/api/slots/bulk/', null, {
        params: {
          service_id: serviceId,
          start_date: bulkForm.start_date,
          end_date: bulkForm.end_date,
          start_time: bulkForm.start_time,
          end_time: bulkForm.end_time,
          max_bookings: bulkForm.max_bookings,
        },
      })
      toast.success(`Created ${data.length} slots!`)
      setShowBulkForm(false)
      setBulkForm({
        start_date: '',
        end_date: '',
        start_time: '09:00',
        end_time: '10:00',
        max_bookings: 1,
      })
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create bulk slots')
    }
  }

  // Block date range
  const handleBlockDates = async (e) => {
    e.preventDefault()
    if (!blockForm.start_date || !blockForm.end_date) {
      toast.error('Date range required')
      return
    }

    if (new Date(blockForm.start_date) > new Date(blockForm.end_date)) {
      toast.error('Start date must be before end date')
      return
    }

    try {
      const { data } = await api.post('/api/slots/blocked-dates/', null, {
        params: {
          service_id: serviceId,
          start_date: blockForm.start_date,
          end_date: blockForm.end_date,
          reason: blockForm.reason,
        },
      })
      toast.success(`Blocked ${data.length} date(s)!`)
      setShowBlockForm(false)
      setBlockForm({ start_date: '', end_date: '', reason: '' })
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to block dates')
    }
  }

  // Toggle slot block status
  const handleToggleSlotBlock = async (slotId, isBlocked) => {
    try {
      await api.patch(`/api/slots/${slotId}/block`, { is_blocked: !isBlocked })
      toast.success(isBlocked ? 'Slot unblocked' : 'Slot blocked')
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update slot')
    }
  }

  // Delete slot
  const handleDeleteSlot = async (slotId) => {
    if (!window.confirm('Delete this slot?')) return
    try {
      await api.delete(`/api/slots/${slotId}`)
      toast.success('Slot deleted')
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete slot')
    }
  }

  // Unblock date
  const handleUnblockDate = async (blockedDateId) => {
    if (!window.confirm('Unblock this date?')) return
    try {
      await api.delete(`/api/slots/blocked-dates/${blockedDateId}`)
      toast.success('Date unblocked')
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to unblock date')
    }
  }

  // Update slot capacity
  const handleUpdateCapacity = async (slotId, newCapacity) => {
    try {
      await api.patch(`/api/slots/${slotId}?max_bookings=${newCapacity}`)
      toast.success('Capacity updated')
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update capacity')
    }
  }

  const getSlotStatus = (slot) => {
    if (slot.is_blocked) return { color: 'bg-red-50', label: 'Blocked', icon: Lock }
    if (slot.current_bookings >= slot.max_bookings)
      return { color: 'bg-yellow-50', label: 'Full', icon: AlertTriangle }
    return { color: 'bg-green-50', label: 'Available', icon: CheckCircle }
  }

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg shadow">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{serviceName} - Slot Manager</h2>
          <p className="text-sm text-gray-500">Daily capacity: {maxCapacity} bookings</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSlotForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={18} /> Single Slot
          </button>
          <button
            onClick={() => setShowBulkForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Zap size={18} /> Bulk Slots
          </button>
          <button
            onClick={() => setShowBlockForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            <Lock size={18} /> Block Dates
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
        <input
          type="date"
          value={filter.from_date}
          onChange={(e) => setFilter({ ...filter, from_date: e.target.value })}
          className="px-3 py-2 border rounded"
          placeholder="From date"
        />
        <input
          type="date"
          value={filter.to_date}
          onChange={(e) => setFilter({ ...filter, to_date: e.target.value })}
          className="px-3 py-2 border rounded"
          placeholder="To date"
        />
        <label className="flex items-center gap-2 px-3 py-2">
          <input
            type="checkbox"
            checked={filter.available_only}
            onChange={(e) => setFilter({ ...filter, available_only: e.target.checked })}
          />
          <span className="text-sm">Available only</span>
        </label>
        <button
          onClick={() => setFilter({ from_date: '', to_date: '', available_only: false })}
          className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
        >
          Reset
        </button>
      </div>

      {/* Capacity Info */}
      {capacityInfo && (
        <div className={`p-4 rounded-lg ${capacityInfo.is_full ? 'bg-red-50' : 'bg-green-50'}`}>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Capacity</p>
              <p className="text-lg font-semibold">{capacityInfo.max_capacity}</p>
            </div>
            <div>
              <p className="text-gray-600">Current Bookings</p>
              <p className="text-lg font-semibold">{capacityInfo.current_bookings}</p>
            </div>
            <div>
              <p className="text-gray-600">Available Slots</p>
              <p className="text-lg font-semibold text-green-600">{capacityInfo.available_slots}</p>
            </div>
            <div>
              <p className="text-gray-600">Date Status</p>
              <p className="text-lg font-semibold">
                {capacityInfo.is_date_blocked ? '🔒 Blocked' : '✅ Open'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Blocked Dates */}
      {blockedDates.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-orange-50 px-4 py-3 border-b">
            <h3 className="font-semibold text-gray-900">Blocked Dates ({blockedDates.length})</h3>
          </div>
          <div className="divide-y">
            {blockedDates.map((bd) => (
              <div key={bd.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <Lock size={20} className="text-orange-600" />
                  <div>
                    <p className="font-medium text-gray-900">{bd.blocked_date}</p>
                    <p className="text-sm text-gray-600">{bd.reason || 'Provider unavailable'}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleUnblockDate(bd.id)}
                  className="p-2 hover:bg-gray-200 rounded text-red-600"
                  title="Unblock date"
                >
                  <Unlock size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Slots Table */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading slots...</div>
      ) : slots.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No slots found</div>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Time</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Capacity</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {slots.map((slot) => {
                const status = getSlotStatus(slot)
                const StatusIcon = status.icon
                return (
                  <tr key={slot.id} className={`${status.color} hover:opacity-80`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Calendar size={18} className="text-gray-500" />
                        <span className="font-medium">{slot.slot_date}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Clock size={18} className="text-gray-500" />
                        <span>
                          {slot.start_time} – {slot.end_time}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Users size={18} className="text-gray-500" />
                        <span>
                          {slot.current_bookings}/{slot.max_bookings}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StatusIcon size={18} />
                        <span className="text-sm font-medium">{status.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        {slot.current_bookings === 0 && (
                          <button
                            onClick={() => handleToggleSlotBlock(slot.id, slot.is_blocked)}
                            className="p-2 hover:bg-gray-200 rounded"
                            title={slot.is_blocked ? 'Unblock slot' : 'Block slot'}
                          >
                            {slot.is_blocked ? (
                              <Unlock size={18} className="text-green-600" />
                            ) : (
                              <Lock size={18} className="text-orange-600" />
                            )}
                          </button>
                        )}
                        {slot.current_bookings === 0 && (
                          <button
                            onClick={() => handleDeleteSlot(slot.id)}
                            className="p-2 hover:bg-red-200 rounded text-red-600"
                            title="Delete slot"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Forms */}
      {showSlotForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Create Single Slot</h3>
            <form onSubmit={handleCreateSlot} className="space-y-4">
              <input
                type="date"
                value={slotForm.date}
                onChange={(e) => setSlotForm({ ...slotForm, date: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                required
              />
              <input
                type="time"
                value={slotForm.start_time}
                onChange={(e) => setSlotForm({ ...slotForm, start_time: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                required
              />
              <input
                type="time"
                value={slotForm.end_time}
                onChange={(e) => setSlotForm({ ...slotForm, end_time: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                required
              />
              <input
                type="number"
                min="1"
                value={slotForm.max_bookings}
                onChange={(e) => setSlotForm({ ...slotForm, max_bookings: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded"
                placeholder="Max bookings"
                required
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowSlotForm(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBulkForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Create Recurring Slots</h3>
            <form onSubmit={handleCreateBulkSlots} className="space-y-4">
              <input
                type="date"
                value={bulkForm.start_date}
                onChange={(e) => setBulkForm({ ...bulkForm, start_date: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                placeholder="Start date"
                required
              />
              <input
                type="date"
                value={bulkForm.end_date}
                onChange={(e) => setBulkForm({ ...bulkForm, end_date: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                placeholder="End date"
                required
              />
              <input
                type="time"
                value={bulkForm.start_time}
                onChange={(e) => setBulkForm({ ...bulkForm, start_time: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                required
              />
              <input
                type="time"
                value={bulkForm.end_time}
                onChange={(e) => setBulkForm({ ...bulkForm, end_time: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                required
              />
              <input
                type="number"
                min="1"
                value={bulkForm.max_bookings}
                onChange={(e) => setBulkForm({ ...bulkForm, max_bookings: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded"
                placeholder="Max bookings per slot"
                required
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                >
                  Create All
                </button>
                <button
                  type="button"
                  onClick={() => setShowBulkForm(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBlockForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Block Date Range</h3>
            <form onSubmit={handleBlockDates} className="space-y-4">
              <input
                type="date"
                value={blockForm.start_date}
                onChange={(e) => setBlockForm({ ...blockForm, start_date: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                placeholder="Start date"
                required
              />
              <input
                type="date"
                value={blockForm.end_date}
                onChange={(e) => setBlockForm({ ...blockForm, end_date: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                placeholder="End date"
                required
              />
              <textarea
                value={blockForm.reason}
                onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                placeholder="Reason (optional)"
                rows="3"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
                >
                  Block
                </button>
                <button
                  type="button"
                  onClick={() => setShowBlockForm(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import api from '../api'
import toast from 'react-hot-toast'
import {
  Calendar,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle,
  Lock,
  Search,
  Filter,
} from 'lucide-react'

export default function ServiceBookingInterface({ serviceId, serviceName, maxCapacity, providerName }) {
  const [availableSlots, setAvailableSlots] = useState([])
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [slotDetails, setSlotDetails] = useState(null)
  const [loading, setLoading] = useState(false)
  const [bookingSubmitting, setBookingSubmitting] = useState(false)

  const [dateRange, setDateRange] = useState({
    from_date: new Date().toISOString().split('T')[0],
    to_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  })

  const [notes, setNotes] = useState('')

  // Fetch available slots
  const fetchAvailableSlots = async () => {
    if (!dateRange.from_date || !dateRange.to_date) {
      toast.error('Please select a date range')
      return
    }

    if (new Date(dateRange.from_date) > new Date(dateRange.to_date)) {
      toast.error('From date must be before to date')
      return
    }

    setLoading(true)
    try {
      const { data } = await api.get(`/api/bookings/available/${serviceId}`, {
        params: dateRange,
      })
      setAvailableSlots(data)
      if (data.length === 0) {
        toast.info('No available slots in this date range')
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to fetch slots')
    } finally {
      setLoading(false)
    }
  }

  // Check slot availability before displaying details
  const handleSlotSelect = async (slot) => {
    setSelectedSlot(slot.id)
    try {
      const { data } = await api.get(
        `/api/bookings/availability/${serviceId}/${slot.id}`
      )
      if (data.is_available) {
        setSlotDetails({
          slot,
          availability: data,
        })
      } else {
        toast.error(`Slot unavailable: ${data.reason}`)
        setSelectedSlot(null)
      }
    } catch (err) {
      toast.error('Failed to check slot availability')
    }
  }

  // Book slot
  const handleBookSlot = async () => {
    if (!selectedSlot) {
      toast.error('Please select a slot')
      return
    }

    setBookingSubmitting(true)
    try {
      const { data } = await api.post('/api/bookings/', {
        student_id: JSON.parse(localStorage.getItem('user')).id,
        service_id: serviceId,
        slot_id: selectedSlot,
        notes: notes || null,
      })
      
      toast.success('Booking created successfully!')
      setSelectedSlot(null)
      setSlotDetails(null)
      setNotes('')
      
      // Refresh available slots
      fetchAvailableSlots()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create booking')
    } finally {
      setBookingSubmitting(false)
    }
  }

  // Format time
  const formatTime = (time) => {
    return time.substring(0, 5) // HH:MM
  }

  // Get slot status badge
  const getSlotStatus = (slot, availability) => {
    if (!availability.is_available) {
      return {
        color: 'bg-red-50 border-red-200',
        badge: 'bg-red-100 text-red-800',
        label: '❌ Unavailable',
      }
    }
    if (slot.current_bookings === slot.max_bookings) {
      return {
        color: 'bg-yellow-50 border-yellow-200',
        badge: 'bg-yellow-100 text-yellow-800',
        label: '⚠️ Full',
      }
    }
    return {
      color: 'bg-green-50 border-green-200',
      badge: 'bg-green-100 text-green-800',
      label: '✅ Available',
    }
  }

  useEffect(() => {
    // Set default date range to next 30 days
    const today = new Date()
    const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
    
    setDateRange({
      from_date: today.toISOString().split('T')[0],
      to_date: thirtyDaysLater.toISOString().split('T')[0],
    })
  }, [])

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg shadow">
      {/* Header */}
      <div className="border-b pb-4">
        <h2 className="text-2xl font-bold text-gray-900">{serviceName}</h2>
        <p className="text-sm text-gray-600 mt-1">Provider: {providerName}</p>
        <p className="text-sm text-gray-600">Daily capacity: {maxCapacity} bookings</p>
      </div>

      {/* Date Range Filter */}
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={18} className="text-blue-600" />
          <h3 className="font-semibold text-blue-900">Search Available Slots</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={dateRange.from_date}
              onChange={(e) => setDateRange({ ...dateRange, from_date: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={dateRange.to_date}
              onChange={(e) => setDateRange({ ...dateRange, to_date: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchAvailableSlots}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Search size={18} />
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>
      </div>

      {/* Available Slots Grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-blue-600 mb-3"></div>
          <p>Loading available slots...</p>
        </div>
      ) : availableSlots.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <AlertTriangle size={32} className="mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600">No available slots found for the selected date range</p>
          <p className="text-sm text-gray-500 mt-1">Try adjusting your search criteria</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableSlots.map((slot) => {
            const isSelected = selectedSlot === slot.id
            return (
              <div
                key={slot.id}
                onClick={() => handleSlotSelect(slot)}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 shadow-lg'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                {/* Date */}
                <div className="flex items-center gap-2 mb-3">
                  <Calendar size={18} className="text-gray-500" />
                  <span className="font-semibold text-gray-900">{slot.slot_date}</span>
                </div>

                {/* Time */}
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={18} className="text-gray-500" />
                  <span className="text-gray-700">
                    {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                  </span>
                </div>

                {/* Capacity */}
                <div className="flex items-center gap-2 mb-3">
                  <Users size={18} className="text-gray-500" />
                  <span className="text-sm text-gray-700">
                    {slot.current_bookings}/{slot.max_bookings} booked
                  </span>
                </div>

                {/* Availability Badge */}
                <div className="text-center pt-2 border-t">
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    ✅ Available
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Booking Confirmation Panel */}
      {slotDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Confirm Booking</h3>

            {/* Slot Details */}
            <div className="bg-blue-50 p-4 rounded-lg mb-6 space-y-3">
              <div className="flex items-start gap-3">
                <Calendar size={20} className="text-blue-600 flex-shrink-0 mt-1" />
                <div>
                  <p className="text-sm text-gray-600">Date</p>
                  <p className="font-semibold text-gray-900">{slotDetails.slot.slot_date}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock size={20} className="text-blue-600 flex-shrink-0 mt-1" />
                <div>
                  <p className="text-sm text-gray-600">Time</p>
                  <p className="font-semibold text-gray-900">
                    {formatTime(slotDetails.slot.start_time)} –{' '}
                    {formatTime(slotDetails.slot.end_time)}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Users size={20} className="text-blue-600 flex-shrink-0 mt-1" />
                <div>
                  <p className="text-sm text-gray-600">Capacity</p>
                  <p className="font-semibold text-gray-900">
                    {slotDetails.slot.current_bookings}/{slotDetails.slot.max_bookings}{' '}
                    booked
                  </p>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any specific requirements or notes for the provider..."
                rows="4"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Availability Check */}
            <div className={`p-3 rounded-lg mb-6 text-sm ${
              slotDetails.availability.is_available
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {slotDetails.availability.is_available ? (
                <div className="flex items-start gap-2">
                  <CheckCircle size={18} className="flex-shrink-0 mt-0.5" />
                  <span>This slot is available for booking</span>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
                  <span>{slotDetails.availability.reason}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSelectedSlot(null)
                  setSlotDetails(null)
                  setNotes('')
                }}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleBookSlot}
                disabled={bookingSubmitting || !slotDetails.availability.is_available}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {bookingSubmitting ? 'Booking...' : 'Confirm Booking'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

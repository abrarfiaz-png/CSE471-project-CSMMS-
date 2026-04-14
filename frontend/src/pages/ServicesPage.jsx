import { useEffect, useState } from 'react'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Search, MapPin, Star, Clock, Users, X, CalendarCheck } from 'lucide-react'

const CATEGORIES = ['All', 'Tutoring', 'Printing', 'Lab Assistance', 'Equipment Sharing', 'Mentoring', 'Other']
const PRIORITY_COLOR = { high: 'bg-red-100 text-red-700', medium: 'bg-yellow-100 text-yellow-700', low: 'bg-green-100 text-green-700' }

function ServiceCard({ service, onBook, canBook }) {
  return (
    <div className="card hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-slate-800">{service.title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{service.provider_name}</p>
        </div>
        <span className={`badge ${PRIORITY_COLOR[service.priority] || 'bg-slate-100 text-slate-500'}`}>{service.priority}</span>
      </div>
      <p className="text-sm text-slate-600 mb-3 line-clamp-2">{service.description}</p>
      <div className="flex flex-wrap gap-2 mb-3 text-xs text-slate-500">
        {service.location_name && <span className="flex items-center gap-1"><MapPin size={12} /> {service.location_name}</span>}
        <span className="flex items-center gap-1"><Users size={12} /> {service.students_helped} helped</span>
        <span className="flex items-center gap-1"><Star size={12} /> {service.avg_rating || 0} ({service.review_count})</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="font-display font-bold text-primary-600">৳{service.price_per_hour}/hr</span>
        <div className="flex gap-2">
          {service.distance_km != null && (
            <span className="badge bg-blue-100 text-blue-700">{service.distance_km} km</span>
          )}
          {canBook ? (
            <button onClick={() => onBook(service)} className="btn-primary text-sm py-1.5 px-3 flex items-center gap-1.5">
              <CalendarCheck size={14} /> Book
            </button>
          ) : (
            <span className="badge bg-slate-100 text-slate-500">Provider View</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ServicesPage() {
  const { user } = useAuth()
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('All')
  const [keyword, setKeyword] = useState('')
  const [bookingService, setBookingService] = useState(null)
  const [slots, setSlots] = useState([])
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [notes, setNotes] = useState('')
  const [booking, setBooking] = useState(false)
  const [mapService, setMapService] = useState(null)
  const [userLocation, setUserLocation] = useState(null)
  const [locating, setLocating] = useState(false)

  const toRad = (x) => x * Math.PI / 180
  const distanceKm = (aLat, aLng, bLat, bLng) => {
    const R = 6371
    const dLat = toRad(bLat - aLat)
    const dLng = toRad(bLng - aLng)
    const s1 = Math.sin(dLat / 2)
    const s2 = Math.sin(dLng / 2)
    const aa = s1 * s1 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * s2 * s2
    const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa))
    return R * c
  }

  const fetchServices = async () => {
    setLoading(true)
    try {
      const params = {}
      if (category !== 'All') params.category = category
      if (keyword) params.keyword = keyword
      const { data } = await api.get('/services/', { params })
      setServices(data)
    } catch { toast.error('Failed to load services') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchServices() }, [category])

  const enableCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        toast.success('Current location enabled')
        setLocating(false)
      },
      () => {
        toast.error('Could not get your location')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const servicesWithDistance = services
    .map((s) => {
      if (!userLocation || !s.location_lat || !s.location_lng) return { ...s, distance_km: null }
      return {
        ...s,
        distance_km: distanceKm(userLocation.lat, userLocation.lng, Number(s.location_lat), Number(s.location_lng)).toFixed(2),
      }
    })
    .sort((a, b) => {
      if (a.distance_km == null && b.distance_km == null) return 0
      if (a.distance_km == null) return 1
      if (b.distance_km == null) return -1
      return Number(a.distance_km) - Number(b.distance_km)
    })

  const openBooking = async (service) => {
    if (user?.role !== 'student') {
      toast.error('Only students can book services')
      return
    }
    setBookingService(service)
    setSelectedSlot(null)
    setNotes('')
    try {
      const { data } = await api.get(`/services/${service.id}/slots`)
      setSlots(data.filter(s => !s.is_booked && !s.is_blocked))
    } catch { setSlots([]) }
  }

  const submitBooking = async () => {
    setBooking(true)
    try {
      await api.post('/bookings/', { service_id: bookingService.id, slot_id: selectedSlot || undefined, notes })
      toast.success('Booking created! Check your bookings page.')
      setBookingService(null)
    } catch (err) { toast.error(err.response?.data?.detail || 'Booking failed') }
    finally { setBooking(false) }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Campus Services</h1>
        <p className="text-slate-500 mt-1">Find tutors, printing, lab assistance and more</p>
      </div>

      {/* Search */}
      <div className="card p-4 flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input className="input pl-9" placeholder="Search services…" value={keyword}
            onChange={e => setKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchServices()} />
        </div>
        <button onClick={fetchServices} className="btn-primary">Search</button>
        <button onClick={enableCurrentLocation} className="btn-secondary" disabled={locating}>{locating ? 'Locating…' : 'Use My Location'}</button>
        {userLocation && <button onClick={() => setUserLocation(null)} className="btn-secondary">Clear Location</button>}
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setCategory(c)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${category === c ? 'bg-primary-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-primary-300'}`}>
            {c}
          </button>
        ))}
      </div>

      {/* Services grid */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading services…</div>
      ) : services.length === 0 ? (
        <div className="text-center py-16 text-slate-400">No services found</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {servicesWithDistance.map(s => <ServiceCard key={s.id} service={s} onBook={openBooking} canBook={user?.role === 'student'} />)}
        </div>
      )}

      {/* Booking Modal */}
      {bookingService && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-xl">Book Service</h3>
              <button onClick={() => setBookingService(null)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl mb-4">
              <p className="font-semibold">{bookingService.title}</p>
              <p className="text-sm text-slate-500">By {bookingService.provider_name} · ৳{bookingService.price_per_hour}/hr</p>
              {bookingService.location_name && (
                <p className="text-sm text-slate-500 flex items-center gap-1 mt-1"><MapPin size={12} /> {bookingService.location_name}</p>
              )}
            </div>

            {slots.length > 0 && (
              <div className="mb-4">
                <label className="label">Available Slots</label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {slots.map(s => (
                    <button key={s.id} onClick={() => setSelectedSlot(s.id)}
                      className={`p-2 rounded-lg border text-xs font-medium transition-all ${selectedSlot === s.id ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 hover:border-slate-300'}`}>
                      <p>{s.date}</p>
                      <p className="text-slate-500">{s.start_time} – {s.end_time}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {bookingService.location_lat && bookingService.location_lng && (
              <div className="mb-4 rounded-xl overflow-hidden border border-slate-200 h-32 bg-slate-100 flex items-center justify-center">
                <div className="flex flex-col gap-2 text-center">
                  <a href={`https://maps.google.com/?q=${bookingService.location_lat},${bookingService.location_lng}`}
                    target="_blank" rel="noreferrer"
                    className="flex items-center justify-center gap-2 text-primary-600 text-sm font-medium hover:underline">
                    <MapPin size={16} /> View Service Location
                  </a>
                  {userLocation && (
                    <a
                      href={`https://www.google.com/maps/dir/${userLocation.lat},${userLocation.lng}/${bookingService.location_lat},${bookingService.location_lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-slate-600 hover:underline"
                    >
                      Get Directions From Current Location
                    </a>
                  )}
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="label">Notes (optional)</label>
              <textarea className="input h-16 resize-none" placeholder="Any specific requirements…"
                value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setBookingService(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={submitBooking} disabled={booking} className="btn-primary flex-1">
                {booking ? 'Booking…' : 'Confirm Booking'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

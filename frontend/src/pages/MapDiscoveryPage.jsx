import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import {
  MapPin, Crosshair, Sliders, Star, Loader2,
  Navigation, ChevronRight, X
} from 'lucide-react'
import { servicesApi } from '../api/client'
import BookingModal from '../components/BookingModal'
import toast from 'react-hot-toast'

// Fix leaflet default icon issue with Vite
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Custom brand-colored marker
const brandIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
})
const userIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
})

// BRAC University coordinates as default
const DEFAULT_CENTER = [23.7808, 90.4192]

function FlyToUser({ coords }) {
  const map = useMap()
  useEffect(() => {
    if (coords) map.flyTo(coords, 15, { duration: 1.5 })
  }, [coords, map])
  return null
}

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'tutoring', label: 'Tutoring' },
  { value: 'printing', label: 'Printing' },
  { value: 'lab_assistance', label: 'Lab Assistance' },
  { value: 'equipment_sharing', label: 'Equipment' },
]

const RADIUS_OPTIONS = [1, 2, 5, 10]

export default function MapDiscoveryPage() {
  const [userCoords, setUserCoords] = useState(null)
  const [locating, setLocating] = useState(false)
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(false)
  const [radius, setRadius] = useState(5)
  const [category, setCategory] = useState('')
  const [selectedService, setSelectedService] = useState(null)
  const [bookingService, setBookingService] = useState(null)
  const [searchCenter, setSearchCenter] = useState(DEFAULT_CENTER)

  const locateUser = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = [pos.coords.latitude, pos.coords.longitude]
        setUserCoords(coords)
        setSearchCenter(coords)
        setLocating(false)
        toast.success('Location found!')
      },
      () => {
        toast.error('Could not get your location. Using campus as default.')
        setLocating(false)
      }
    )
  }

  const searchNearby = async () => {
    setLoading(true)
    try {
      const [lat, lng] = searchCenter
      const params = { latitude: lat, longitude: lng, radius_km: radius }
      if (category) params.category = category
      const res = await servicesApi.nearby(params)
      setServices(res.data)
      if (res.data.length === 0) {
        toast('No services found in this area. Try increasing the radius.', { icon: '📍' })
      }
    } catch {
      toast.error('Failed to search nearby services.')
    } finally {
      setLoading(false)
    }
  }

  // Auto-search when params change
  useEffect(() => {
    searchNearby()
  }, [searchCenter, radius, category])

  const CATEGORY_COLOR = {
    tutoring: '#2055f5',
    printing: '#64748b',
    lab_assistance: '#059669',
    equipment_sharing: '#ea580c',
    other: '#7c3aed',
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-slate-100 flex flex-col z-10 shadow-sm">
        {/* Header */}
        <div className="p-5 border-b border-slate-100">
          <h1 className="font-display font-bold text-slate-900 text-lg flex items-center gap-2">
            <MapPin size={18} className="text-brand-500" />
            Map Discovery
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Find campus services near you
          </p>
        </div>

        {/* Controls */}
        <div className="p-4 border-b border-slate-100 space-y-3">
          {/* Locate me */}
          <button
            onClick={locateUser}
            disabled={locating}
            className="w-full btn-primary flex items-center justify-center gap-2 text-sm"
          >
            {locating
              ? <><Loader2 size={15} className="animate-spin" /> Locating…</>
              : <><Crosshair size={15} /> Use My Location</>
            }
          </button>

          {/* Radius */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Search Radius
            </label>
            <div className="flex gap-2">
              {RADIUS_OPTIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setRadius(r)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all
                    ${radius === r
                      ? 'bg-brand-500 text-white border-brand-500'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'
                    }`}
                >
                  {r}km
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input-field text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Results list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Loader2 size={22} className="animate-spin mr-2" />
              Searching…
            </div>
          ) : services.length === 0 ? (
            <div className="text-center py-12 px-4 text-slate-400">
              <Navigation size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No services found nearby.</p>
              <p className="text-xs mt-1">Try increasing the radius.</p>
            </div>
          ) : (
            <div>
              <p className="px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                {services.length} services found
              </p>
              {services.map((svc) => (
                <button
                  key={svc.id}
                  onClick={() => setSelectedService(selectedService?.id === svc.id ? null : svc)}
                  className={`w-full text-left px-4 py-3.5 border-b border-slate-50 hover:bg-brand-50 transition-colors flex items-center gap-3
                    ${selectedService?.id === svc.id ? 'bg-brand-50' : ''}`}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: CATEGORY_COLOR[svc.category] || '#6366f1' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{svc.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-500 flex items-center gap-0.5">
                        <MapPin size={10} /> {svc.distance_km} km
                      </span>
                      <span className="text-xs text-slate-500 flex items-center gap-0.5">
                        <Star size={10} className="text-yellow-400 fill-yellow-400" />
                        {svc.average_rating?.toFixed(1)}
                      </span>
                      <span className="text-xs font-semibold text-brand-600">৳{svc.price_per_hour}/hr</span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-400 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={15}
          className="w-full h-full"
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FlyToUser coords={userCoords} />

          {/* User location marker */}
          {userCoords && (
            <>
              <Marker position={userCoords} icon={userIcon}>
                <Popup>
                  <div className="font-body text-sm font-semibold text-slate-800">📍 You are here</div>
                </Popup>
              </Marker>
              <Circle
                center={userCoords}
                radius={radius * 1000}
                pathOptions={{ color: '#2055f5', fillColor: '#2055f5', fillOpacity: 0.05, weight: 1.5, dashArray: '6' }}
              />
            </>
          )}

          {/* Service markers */}
          {services.map((svc) => (
            <Marker
              key={svc.id}
              position={[svc.latitude, svc.longitude]}
              icon={brandIcon}
              eventHandlers={{ click: () => setSelectedService(svc) }}
            >
              <Popup>
                <div className="font-body min-w-[180px]">
                  <p className="font-semibold text-slate-900 text-sm mb-1">{svc.title}</p>
                  <p className="text-xs text-slate-500 mb-1">{svc.location_name}</p>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-yellow-600 flex items-center gap-0.5">
                      <Star size={10} className="fill-yellow-400 text-yellow-400" /> {svc.average_rating?.toFixed(1)}
                    </span>
                    <span className="text-xs font-bold text-brand-600">৳{svc.price_per_hour}/hr</span>
                    <span className="text-xs text-slate-500">{svc.distance_km} km away</span>
                  </div>
                  <button
                    onClick={() => setBookingService(svc)}
                    className="w-full bg-brand-500 text-white text-xs font-semibold py-1.5 rounded-lg hover:bg-brand-600 transition-colors"
                  >
                    Book Now
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Selected service detail card */}
        {selectedService && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[1000] bg-white rounded-2xl shadow-2xl border border-slate-100 p-5 w-80 fade-up">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-display font-bold text-slate-900 text-base leading-tight">
                  {selectedService.title}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                  <MapPin size={11} /> {selectedService.location_name}
                </p>
              </div>
              <button
                onClick={() => setSelectedService(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex items-center gap-4 text-sm mb-4">
              <span className="flex items-center gap-1 text-yellow-600 font-semibold">
                <Star size={14} className="fill-yellow-400 text-yellow-400" />
                {selectedService.average_rating?.toFixed(1)}
              </span>
              <span className="text-slate-500">{selectedService.distance_km} km away</span>
              <span className="font-bold text-brand-600 ml-auto">৳{selectedService.price_per_hour}/hr</span>
            </div>
            <button
              onClick={() => setBookingService(selectedService)}
              className="btn-primary w-full text-sm"
            >
              Book This Service
            </button>
          </div>
        )}
      </div>

      {/* Booking Modal */}
      {bookingService && (
        <BookingModal
          service={bookingService}
          onClose={() => setBookingService(null)}
          onSuccess={() => setBookingService(null)}
        />
      )}
    </div>
  )
}

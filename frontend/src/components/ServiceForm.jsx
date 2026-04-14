import { useState } from 'react'
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api'
import { MapPin, Save, X, Loader2 } from 'lucide-react'
import { servicesApi } from '../api/client'
import toast from 'react-hot-toast'

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
const BRACU_CENTER = { lat: 23.7808, lng: 90.4192 }
const MAP_LIBRARIES = ['places']

const CATEGORIES = [
  { value: 'tutoring',          label: 'Tutoring' },
  { value: 'printing',          label: 'Printing' },
  { value: 'lab_assistance',    label: 'Lab Assistance' },
  { value: 'equipment_sharing', label: 'Equipment Sharing' },
  { value: 'other',             label: 'Other' },
]
const PRIORITIES = [
  { value: 'high',   label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low',    label: 'Low' },
]

const MOCK_PROVIDER_ID = 4  // Replace with auth context

export default function ServiceForm({ onSuccess, onCancel }) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: MAP_LIBRARIES,
  })

  const [form, setForm] = useState({
    title: '', description: '', category: 'tutoring',
    priority: 'medium', price_per_hour: '', max_capacity_per_day: 5,
    location_name: '', latitude: null, longitude: null,
  })
  const [markerPos, setMarkerPos] = useState(null)
  const [saving, setSaving] = useState(false)

  const update = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const handleMapClick = (e) => {
    const lat = e.latLng.lat()
    const lng = e.latLng.lng()
    setMarkerPos({ lat, lng })
    update('latitude', lat)
    update('longitude', lng)

    // Reverse geocode using Google Maps Geocoder
    if (window.google) {
      const geocoder = new window.google.maps.Geocoder()
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const shortName = results[0].formatted_address.split(',').slice(0, 2).join(',')
          update('location_name', shortName)
        }
      })
    }
  }

  const handleSubmit = async () => {
    if (!form.title || !form.price_per_hour) {
      toast.error('Title and price are required.')
      return
    }
    if (!form.latitude || !form.longitude) {
      toast.error('Please click on the map to set the service location.')
      return
    }
    setSaving(true)
    try {
      await servicesApi.create({
        ...form,
        provider_id: MOCK_PROVIDER_ID,
        price_per_hour: parseFloat(form.price_per_hour),
        max_capacity_per_day: parseInt(form.max_capacity_per_day),
      })
      toast.success('Service created successfully!')
      onSuccess?.()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create service.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-w-3xl w-full mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100 bg-gradient-to-r from-brand-50 to-white">
        <div>
          <h2 className="font-display font-bold text-xl text-slate-900">Create New Service</h2>
          <p className="text-sm text-slate-500 mt-0.5">Fill in details and pin your location on the map</p>
        </div>
        <button onClick={onCancel} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="p-7 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left — form fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Service Title *
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder="e.g. Python & DSA Tutoring"
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Description
            </label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="What will you offer? Topics, tools, materials…"
              className="input-field resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Category</label>
              <select value={form.category} onChange={(e) => update('category', e.target.value)} className="input-field">
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Priority</label>
              <select value={form.priority} onChange={(e) => update('priority', e.target.value)} className="input-field">
                {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Price (৳/hr) *
              </label>
              <input
                type="number" min="1"
                value={form.price_per_hour}
                onChange={(e) => update('price_per_hour', e.target.value)}
                placeholder="300"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Max Students/Day
              </label>
              <input
                type="number" min="1" max="50"
                value={form.max_capacity_per_day}
                onChange={(e) => update('max_capacity_per_day', e.target.value)}
                className="input-field"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Location Name
            </label>
            <div className="relative">
              <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={form.location_name}
                onChange={(e) => update('location_name', e.target.value)}
                placeholder="Auto-filled when you pin on map"
                className="input-field pl-9"
              />
            </div>
            {form.latitude && (
              <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                ✓ Location pinned: {form.latitude.toFixed(4)}, {form.longitude.toFixed(4)}
              </p>
            )}
          </div>
        </div>

        {/* Right — Google Map location picker */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Pin Your Location on Map *
          </label>
          <p className="text-xs text-slate-400">Click anywhere on the map to set the service location</p>
          <div className="rounded-2xl overflow-hidden border border-slate-200 h-64">
            {isLoaded ? (
              <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%' }}
                center={markerPos || BRACU_CENTER}
                zoom={15}
                options={{ mapTypeControl: false, streetViewControl: false, zoomControl: true }}
                onClick={handleMapClick}
              >
                {markerPos && <Marker position={markerPos} />}
              </GoogleMap>
            ) : (
              <div className="h-full flex items-center justify-center bg-slate-50 text-slate-400">
                {GOOGLE_MAPS_API_KEY
                  ? <><Loader2 size={20} className="animate-spin mr-2" /> Loading map…</>
                  : <span className="text-xs">Add VITE_GOOGLE_MAPS_API_KEY to use the map picker</span>
                }
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-7 py-5 border-t border-slate-100 flex gap-3 justify-end">
        <button onClick={onCancel} className="btn-secondary">Cancel</button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="btn-primary flex items-center gap-2"
        >
          {saving ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : <><Save size={15} /> Create Service</>}
        </button>
      </div>
    </div>
  )
}

import { Star, MapPin, Clock, Users, TrendingUp } from 'lucide-react'

const CATEGORY_LABELS = {
  tutoring: 'Tutoring',
  printing: 'Printing',
  lab_assistance: 'Lab Assistance',
  equipment_sharing: 'Equipment',
  other: 'Other',
}

const CATEGORY_COLORS = {
  tutoring:          'badge-blue',
  printing:          'badge-gray',
  lab_assistance:    'badge-green',
  equipment_sharing: 'badge-orange',
  other:             'badge-gray',
}

const PRIORITY_COLORS = {
  high:   'badge-red',
  medium: 'badge-orange',
  low:    'badge-green',
}

export default function ServiceCard({ service, onBook, distanceKm }) {
  const categoryLabel = CATEGORY_LABELS[service.category] || service.category
  const categoryColor = CATEGORY_COLORS[service.category] || 'badge-gray'
  const priorityColor = PRIORITY_COLORS[service.priority] || 'badge-gray'

  return (
    <div className="card overflow-hidden flex flex-col fade-up group">
      {/* Image */}
      <div className="relative h-44 bg-gradient-to-br from-brand-100 to-brand-200 overflow-hidden">
        {service.image_url ? (
          <img
            src={service.image_url}
            alt={service.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-brand-300">
            <svg width="64" height="64" fill="none" viewBox="0 0 64 64">
              <rect width="64" height="64" rx="16" fill="currentColor" fillOpacity=".15" />
              <path d="M20 44V24a4 4 0 014-4h16a4 4 0 014 4v20M14 44h36" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="32" cy="32" r="4" stroke="currentColor" strokeWidth="2.5"/>
            </svg>
          </div>
        )}
        {/* Badges overlay */}
        <div className="absolute top-3 left-3 flex gap-1.5">
          <span className={categoryColor}>{categoryLabel}</span>
          <span className={priorityColor}>{service.priority}</span>
        </div>
        {distanceKm !== undefined && (
          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1 text-xs font-semibold text-slate-700">
            <MapPin size={11} className="text-brand-500" />
            {distanceKm} km
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div>
          <h3 className="font-display font-bold text-slate-900 text-base leading-tight line-clamp-1">
            {service.title}
          </h3>
          {service.location_name && (
            <p className="flex items-center gap-1 text-xs text-slate-500 mt-1">
              <MapPin size={11} />
              {service.location_name}
            </p>
          )}
          {service.description && (
            <p className="text-sm text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
              {service.description}
            </p>
          )}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Star size={12} className="text-yellow-400 fill-yellow-400" />
            <span className="font-semibold text-slate-700">{service.average_rating.toFixed(1)}</span>
          </span>
          <span className="flex items-center gap-1">
            <Users size={12} />
            {service.total_students_helped} helped
          </span>
          <span className="flex items-center gap-1">
            <TrendingUp size={12} />
            {Math.round(service.completion_rate * 100)}%
          </span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100">
          <div>
            <span className="text-xl font-display font-bold text-brand-600">
              ৳{service.price_per_hour}
            </span>
            <span className="text-xs text-slate-400 ml-1">/hr</span>
          </div>
          <button
            onClick={() => onBook?.(service)}
            className="btn-primary text-sm py-2 px-4"
          >
            Book Now
          </button>
        </div>
      </div>
    </div>
  )
}

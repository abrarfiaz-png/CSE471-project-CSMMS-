import { useEffect, useState } from 'react'
import api from '../api'
import toast from 'react-hot-toast'
import { Search, SlidersHorizontal, ShoppingBag, Plus, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const CATEGORIES = ['All', 'Books', 'Electronics', 'Clothing', 'Stationery', 'Sports', 'Lab Equipment', 'Other']

function ItemCard({ item }) {
  return (
    <div className="card p-0 overflow-hidden hover:shadow-lg transition-shadow">
      <div className="aspect-video bg-slate-100 overflow-hidden">
        {item.image_url ? (
          <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag size={32} className="text-slate-300" />
          </div>
        )}
      </div>
      <div className="p-4">
        <p className="font-semibold text-slate-800 truncate">{item.title}</p>
        <p className="text-xs text-slate-400 mt-0.5 truncate">{item.description}</p>
        <div className="flex items-center justify-between mt-3">
          <span className="font-display font-bold text-primary-600 text-lg">৳{item.price}</span>
          <span className="badge bg-slate-100 text-slate-500">{item.category}</span>
        </div>
        <p className="text-xs text-slate-400 mt-2">By {item.owner_name}</p>
      </div>
    </div>
  )
}

export default function MarketplacePage() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', price: '', category: 'Books' })
  const [imageFile, setImageFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchItems = async () => {
    setLoading(true)
    try {
      const params = {}
      if (search) params.keyword = search
      if (category !== 'All') params.category = category
      if (minPrice) params.min_price = minPrice
      if (maxPrice) params.max_price = maxPrice
      const { data } = await api.get('/items/', { params })
      setItems(data)
    } catch { toast.error('Failed to load items') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchItems() }, [category])

  const handleSearch = e => { e.preventDefault(); fetchItems() }

  const handleCreate = async e => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, v))
      if (imageFile) fd.append('image', imageFile)
      await api.post('/items/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Item listed!')
      setShowForm(false)
      setForm({ title: '', description: '', price: '', category: 'Books' })
      setImageFile(null)
      fetchItems()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to create listing') }
    finally { setSubmitting(false) }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Marketplace</h1>
          <p className="text-slate-500 mt-1">Buy and sell items on campus</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> List Item
        </button>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="card p-4">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input className="input pl-9" placeholder="Search items…" value={search}
              onChange={e => setSearch(e.target.value)} />
          </div>
          <input className="input w-28" type="number" placeholder="Min ৳" value={minPrice} onChange={e => setMinPrice(e.target.value)} />
          <input className="input w-28" type="number" placeholder="Max ৳" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} />
          <button type="submit" className="btn-primary flex items-center gap-2">
            <SlidersHorizontal size={15} /> Filter
          </button>
        </div>
      </form>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setCategory(c)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${category === c ? 'bg-primary-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-primary-300'}`}>
            {c}
          </button>
        ))}
      </div>

      {/* Items grid */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <ShoppingBag size={48} className="mx-auto text-slate-200 mb-3" />
          <p className="text-slate-500">No items found</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map(item => <ItemCard key={item.id} item={item} />)}
        </div>
      )}

      {/* Create Item Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-bold text-xl">List an Item</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="label">Title</label>
                <input className="input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input h-20 resize-none" value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Price (৳)</label>
                  <input className="input" type="number" min="0" step="0.01" value={form.price}
                    onChange={e => setForm(p => ({ ...p, price: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">Category</label>
                  <select className="input" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                    {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Image (optional)</label>
                <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files[0])} className="input text-sm" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1">
                  {submitting ? 'Listing…' : 'List Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

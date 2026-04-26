import { useEffect, useState } from 'react'
import api from '../api'
import toast from 'react-hot-toast'
import { Package, Trash2, Edit2, Plus, ShoppingBag } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function MyItemsPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = async () => {
    setLoading(true)
    try { const { data } = await api.get('/items/my'); setItems(data) }
    catch { toast.error('Failed to load items') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetch() }, [])

  const deleteItem = async (id) => {
    if (!confirm('Delete this listing?')) return
    try { await api.delete(`/items/${id}`); toast.success('Deleted'); fetch() }
    catch { toast.error('Failed to delete') }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">My Listings</h1>
          <p className="text-slate-500 mt-1">Items you've listed for sale</p>
        </div>
        <Link to="/marketplace" className="btn-primary flex items-center gap-2"><Plus size={16} /> New Listing</Link>
      </div>

      {loading ? <div className="text-center py-16 text-slate-400">Loading…</div>
        : items.length === 0 ? (
          <div className="text-center py-20">
            <Package size={48} className="mx-auto text-slate-200 mb-3" />
            <p className="text-slate-500 mb-4">You haven't listed any items yet</p>
            <Link to="/marketplace" className="btn-primary">List Your First Item</Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map(item => (
              <div key={item.id} className="card p-0 overflow-hidden">
                <div className="aspect-video bg-slate-100 overflow-hidden">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ShoppingBag size={28} className="text-slate-300" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <p className="font-semibold text-slate-800 truncate">{item.title}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-bold text-primary-600">৳{item.price}</span>
                    <span className={`badge ${item.is_available ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {item.is_available ? 'Available' : 'Sold'}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => deleteItem(item.id)} className="btn-danger flex-1 text-xs py-1.5 flex items-center justify-center gap-1">
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}

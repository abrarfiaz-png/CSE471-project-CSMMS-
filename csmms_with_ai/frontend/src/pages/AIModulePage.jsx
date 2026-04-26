import { useState, useRef } from 'react'
import api from '../api'
import toast from 'react-hot-toast'
import { Brain, Upload, MessageCircle, Send, FileText, TrendingDown, Target, BookOpen, Loader } from 'lucide-react'

export default function AIModulePage() {
  const [tab, setTab] = useState('analysis')
  const [file, setFile] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState(null)
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: 'Hi! I\'m your CSMMS AI assistant. I can help you find services, tutors, marketplace items, or answer any questions about campus resources. How can I help you today?' }
  ])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef(null)

  const analyzeMarksheet = async () => {
    if (!file) return toast.error('Please upload a mark sheet')
    setAnalyzing(true)
    setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const { data } = await api.post('/ai/analyze-marksheet', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setResult(data)
    } catch (err) { toast.error(err.response?.data?.detail || 'Analysis failed') }
    finally { setAnalyzing(false) }
  }

  const sendChat = async () => {
    if (!chatInput.trim()) return
    const userMsg = { role: 'user', content: chatInput }
    setChatMessages(prev => [...prev, userMsg])
    setChatInput('')
    setChatLoading(true)
    try {
      const { data } = await api.post('/ai/chat', { message: chatInput })
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.response }])
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch { setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I\'m having trouble responding right now.' }]) }
    finally { setChatLoading(false) }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Brain size={28} className="text-primary-600" /> AI Module
        </h1>
        <p className="text-slate-500 mt-1">Powered by OpenAI — Analyze marks, validate policies, get smart recommendations</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {[{ id: 'analysis', label: '📊 Weakness Analysis' }, { id: 'chat', label: '💬 AI Chatbot' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'analysis' ? (
        <div className="space-y-6">
          {/* Upload */}
          <div className="card">
            <h2 className="font-display font-bold text-lg mb-1">Student Weakness Analysis</h2>
            <p className="text-sm text-slate-500 mb-4">Upload your mark sheet (PDF or image) for AI-powered performance analysis</p>
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-primary-300 transition-colors">
              <Upload size={32} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-500 mb-3">Drag and drop or click to upload</p>
              <input type="file" accept="image/*,.pdf" onChange={e => setFile(e.target.files[0])} className="hidden" id="marksheet-upload" />
              <label htmlFor="marksheet-upload" className="btn-secondary cursor-pointer text-sm">Choose File</label>
              {file && <p className="mt-3 text-sm text-primary-600 font-medium flex items-center justify-center gap-1"><FileText size={14} /> {file.name}</p>}
            </div>
            <button onClick={analyzeMarksheet} disabled={!file || analyzing} className="btn-primary w-full mt-4 flex items-center justify-center gap-2">
              {analyzing ? <><Loader size={16} className="animate-spin" /> Analyzing…</> : <><Brain size={16} /> Analyze Mark Sheet</>}
            </button>
          </div>

          {/* Results */}
          {result && (
            <div className="space-y-4">
              {result.note && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">{result.note}</div>
              )}
              <div className="grid md:grid-cols-2 gap-4">
                {result.weak_subjects?.length > 0 && (
                  <div className="card border-red-100">
                    <h3 className="font-semibold text-red-700 flex items-center gap-2 mb-3"><TrendingDown size={16} /> Weak Subjects</h3>
                    <div className="flex flex-wrap gap-2">
                      {result.weak_subjects.map(s => <span key={s} className="badge bg-red-50 text-red-700">{s}</span>)}
                    </div>
                  </div>
                )}
                {result.strong_subjects?.length > 0 && (
                  <div className="card border-green-100">
                    <h3 className="font-semibold text-green-700 flex items-center gap-2 mb-3">✅ Strong Subjects</h3>
                    <div className="flex flex-wrap gap-2">
                      {result.strong_subjects.map(s => <span key={s} className="badge bg-green-50 text-green-700">{s}</span>)}
                    </div>
                  </div>
                )}
              </div>
              {result.weakness_summary && (
                <div className="card bg-slate-50">
                  <h3 className="font-semibold mb-2 flex items-center gap-2"><Brain size={16} className="text-primary-600" /> AI Summary</h3>
                  <p className="text-sm text-slate-700">{result.weakness_summary}</p>
                  {result.performance_trends && <p className="text-sm text-slate-500 mt-2 italic">{result.performance_trends}</p>}
                </div>
              )}
              {result.recommended_focus?.length > 0 && (
                <div className="card">
                  <h3 className="font-semibold mb-3 flex items-center gap-2"><Target size={16} className="text-orange-500" /> Recommended Focus Areas</h3>
                  <div className="flex flex-wrap gap-2">
                    {result.recommended_focus.map(f => <span key={f} className="badge bg-orange-50 text-orange-700">{f}</span>)}
                  </div>
                </div>
              )}
              {result.suggested_study_plan && (
                <div className="card bg-primary-50">
                  <h3 className="font-semibold mb-2 flex items-center gap-2"><BookOpen size={16} className="text-primary-600" /> Suggested Study Plan</h3>
                  <p className="text-sm text-primary-800">{result.suggested_study_plan}</p>
                </div>
              )}
              {result.raw_analysis && (
                <div className="card"><p className="text-sm text-slate-700 whitespace-pre-wrap">{result.raw_analysis}</p></div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Chatbot */
        <div className="card flex flex-col" style={{ height: '520px' }}>
          <h2 className="font-display font-bold text-lg mb-4 flex items-center gap-2"><MessageCircle size={20} /> AI Assistant</h2>
          <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
            {chatMessages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs lg:max-w-sm px-4 py-2.5 rounded-2xl text-sm ${m.role === 'user' ? 'bg-primary-600 text-white rounded-br-sm' : 'bg-slate-100 text-slate-700 rounded-bl-sm'}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 px-4 py-3 rounded-2xl rounded-bl-sm">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => <div key={i} className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="Ask me anything about campus services…"
              value={chatInput} onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()} />
            <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()} className="btn-primary px-3">
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

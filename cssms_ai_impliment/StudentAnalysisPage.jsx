import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api'
import toast from 'react-hot-toast'
import { Upload, FileText, TrendingUp, Target, BookOpen, Award, AlertTriangle } from 'lucide-react'

export default function StudentAnalysisPage() {
  const { user } = useAuth()
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [dragActive, setDragActive] = useState(false)

  const handleFileSelect = (selectedFile) => {
    if (selectedFile && (selectedFile.type === 'application/pdf' ||
        selectedFile.type.startsWith('image/'))) {
      setFile(selectedFile)
      setAnalysis(null)
    } else {
      toast.error('Please select a PDF or image file')
    }
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleSubmit = async () => {
    if (!file) {
      toast.error('Please select a file first')
      return
    }

    setLoading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      console.log('🔍 Starting analysis request...')
      const { data } = await api.post('/analysis/analyze-weakness', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      console.log('✅ Analysis response received:', data)
      setAnalysis(data)
      toast.success('Analysis completed successfully!')
    } catch (err) {
      console.error('❌ Analysis failed:', err)
      console.error('Error response:', err.response?.data)
      toast.error(err.response?.data?.detail || 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  const getGradeColor = (grade) => {
    switch (grade) {
      case 'A+': case 'A': return 'text-green-600 bg-green-100'
      case 'B+': case 'B': return 'text-blue-600 bg-blue-100'
      case 'C+': case 'C': return 'text-yellow-600 bg-yellow-100'
      case 'F': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Student Weakness Analysis</h1>
        <p className="text-slate-600">Upload your marksheet to get AI-powered analysis of your academic performance</p>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-xl shadow-sm border p-8 mb-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Upload Marksheet</h2>
          <p className="text-slate-500">Supported formats: PDF, JPEG, PNG (max 10MB)</p>
        </div>

        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive ? 'border-primary-500 bg-primary-50' : 'border-slate-300 hover:border-slate-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Upload className="mx-auto h-12 w-12 text-slate-400 mb-4" />
          <div className="space-y-2">
            <p className="text-lg font-medium text-slate-700">
              {file ? file.name : 'Drop your marksheet here or click to browse'}
            </p>
            <p className="text-slate-500">
              {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'PDF or image files only'}
            </p>
          </div>
          <input
            type="file"
            accept=".pdf,image/*"
            onChange={(e) => handleFileSelect(e.target.files[0])}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="inline-block mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 cursor-pointer transition-colors"
          >
            Choose File
          </label>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={handleSubmit}
            disabled={!file || loading}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Analyzing...' : 'Analyze Marksheet'}
          </button>
        </div>
      </div>

      {/* Analysis Results */}
      {analysis && (
        <div className="space-y-6">
          {/* Overall Grade */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Overall Performance</h3>
                <p className="text-slate-600">Based on your marksheet analysis</p>
              </div>
              <div className={`px-4 py-2 rounded-full font-bold text-lg ${getGradeColor(analysis.overall_grade)}`}>
                Grade: {analysis.overall_grade}
              </div>
            </div>
          </div>

          {/* Subject Marks */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Subject-wise Marks
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(analysis.subject_marks).map(([subject, marks]) => (
                <div key={subject} className="bg-slate-50 rounded-lg p-4">
                  <div className="font-medium text-slate-800">{subject}</div>
                  <div className={`text-2xl font-bold ${marks >= 75 ? 'text-green-600' : marks >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {marks}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Weak and Strong Subjects */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Weak Subjects
              </h3>
              <div className="space-y-2">
                {analysis.weak_subjects.map((subject) => (
                  <div key={subject} className="flex items-center gap-2 text-yellow-600">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    {subject}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Award className="h-5 w-5 text-green-500" />
                Strong Subjects
              </h3>
              <div className="space-y-2">
                {analysis.strong_subjects.map((subject) => (
                  <div key={subject} className="flex items-center gap-2 text-green-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    {subject}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Performance Trends */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              Performance Trends
            </h3>
            <p className="text-slate-700">{analysis.performance_trends}</p>
          </div>

          {/* Weakness Summary */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Analysis Summary</h3>
            <p className="text-slate-700 mb-4">{analysis.weakness_summary}</p>
          </div>

          {/* Recommendations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Target className="h-5 w-5 text-purple-500" />
                Recommended Focus Areas
              </h3>
              <ul className="space-y-2">
                {analysis.recommended_focus.map((focus) => (
                  <li key={focus} className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    {focus}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-indigo-500" />
                Suggested Study Plan
              </h3>
              <p className="text-slate-700">{analysis.suggested_study_plan}</p>
            </div>
          </div>

          {/* Debug Info */}
          {analysis?.debug_info && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-yellow-800 mb-4">🔧 Debug Information</h3>
              <div className="space-y-2 text-sm">
                <div><strong>Text Extracted:</strong> {analysis.debug_info.extracted_text_length} characters</div>
                <div><strong>PDF Available:</strong> {analysis.debug_info.pdf_available ? '✅' : '❌'}</div>
                <div><strong>OCR Available:</strong> {analysis.debug_info.ocr_available ? '✅' : '❌'}</div>
                <div><strong>Extracted Text Preview:</strong></div>
                <div className="bg-white p-2 rounded border font-mono text-xs max-h-32 overflow-y-auto">
                  {analysis.debug_info.extracted_text_preview || 'No text extracted'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
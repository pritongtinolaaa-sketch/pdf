import React, { useCallback, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import axios from 'axios'
import toast from 'react-hot-toast'
import * as Icons from 'lucide-react'
import {
  AlertCircle,
  Check,
  Copy,
  FileDown,
  GripVertical,
  Loader2,
  UploadCloud,
  X,
} from 'lucide-react'

function SortableFileList({ files, onChange }) {
  const dragIndex = useRef(null)
  const [overIndex, setOverIndex] = useState(null)

  const onDropRow = (targetIndex) => {
    const from = dragIndex.current
    if (from === null || from === targetIndex) {
      setOverIndex(null)
      return
    }
    onChange((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(targetIndex, 0, moved)
      return next
    })
    dragIndex.current = null
    setOverIndex(null)
  }

  return (
    <ul className="mt-3 space-y-1.5 max-h-52 overflow-y-auto pr-1">
      {files.map((f, i) => (
        <li
          key={`${f.name}-${i}`}
          draggable
          onDragStart={() => {
            dragIndex.current = i
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setOverIndex(i)
          }}
          onDrop={() => onDropRow(i)}
          onDragEnd={() => {
            dragIndex.current = null
            setOverIndex(null)
          }}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all duration-150 cursor-grab active:cursor-grabbing select-none ${
            overIndex === i && dragIndex.current !== i
              ? 'border-green-400 shadow-glow'
              : 'border-transparent'
          }`}
          style={
            overIndex === i && dragIndex.current !== i
              ? { background: 'rgba(16,185,129,0.12)' }
              : { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.07)' }
          }
        >
          <GripVertical size={14} className="text-slate-600 shrink-0" />
          <span className="text-slate-500 text-xs w-4 text-center shrink-0 font-mono">{i + 1}</span>
          <Icons.File size={14} className="text-green-400 shrink-0" />
          <span className="truncate text-slate-300 flex-1">{f.name}</span>
          <span className="text-slate-500 text-xs shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
          <button
            className="text-slate-500 hover:text-red-400 transition-colors shrink-0"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => onChange((prev) => prev.filter((_, j) => j !== i))}
          >
            <X size={14} />
          </button>
        </li>
      ))}
    </ul>
  )
}

function FileDropzone({ multiple, accept, files, onChange, sortable }) {
  const onDrop = useCallback(
    (accepted) => {
      if (multiple) {
        onChange((prev) => [...prev, ...accepted])
      } else {
        onChange(accepted.slice(0, 1))
      }
    },
    [multiple, onChange]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple,
    accept,
  })

  return (
    <div>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragActive ? 'border-green-400 shadow-glow' : 'hover:border-green-500/40'
        }`}
        style={
          isDragActive
            ? { background: 'rgba(16,185,129,0.08)', borderColor: '#34d399' }
            : { background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.1)' }
        }
      >
        <input {...getInputProps()} />
        <UploadCloud size={32} className={`mx-auto mb-3 ${isDragActive ? 'text-green-400' : 'text-slate-500'}`} />
        {isDragActive ? (
          <p className="text-green-400 font-medium">Drop it here!</p>
        ) : (
          <>
            <p className="text-slate-300 font-medium mb-1">Drag & drop {multiple ? 'files' : 'a file'} here</p>
            <p className="text-slate-500 text-sm">or click to browse</p>
          </>
        )}
      </div>

      {files.length > 0 &&
        (sortable ? (
          <>
            <p className="mt-3 mb-1.5 text-xs text-slate-500 flex items-center gap-1.5">
              <GripVertical size={12} />
              Drag rows to reorder merge sequence
            </p>
            <SortableFileList files={files} onChange={onChange} />
          </>
        ) : (
          <ul className="mt-3 space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {files.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <Icons.File size={14} className="text-green-400 shrink-0" />
                <span className="truncate text-slate-300 flex-1">{f.name}</span>
                <span className="text-slate-500 text-xs shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                <button
                  className="text-slate-500 hover:text-red-400 transition-colors shrink-0"
                  onClick={() => onChange((prev) => prev.filter((_, j) => j !== i))}
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        ))}
    </div>
  )
}

function InfoResult({ data }) {
  return (
    <div className="rounded-2xl p-5 space-y-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center justify-between">
        <span className="text-slate-400 text-sm">Pages</span>
        <span className="text-green-400 font-semibold">{data.pages}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-slate-400 text-sm">Encrypted</span>
        <span className={data.encrypted ? 'text-amber-400 font-semibold' : 'text-green-400 font-semibold'}>
          {data.encrypted ? 'Yes' : 'No'}
        </span>
      </div>
    </div>
  )
}

function TextResult({ data }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(data.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500">{data.pages} page(s) processed</span>
        <button onClick={handleCopy} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-green-400 transition-colors">
          {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
          {copied ? 'Copied!' : 'Copy text'}
        </button>
      </div>
      <pre
        className="rounded-xl p-4 text-slate-300 text-xs leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {data.text}
      </pre>
    </div>
  )
}

export default function ToolModal({ tool, token, onClose, onProcessed }) {
  const Icon = Icons[tool.icon] ?? Icons.FileText
  const [files, setFiles] = useState([])
  const [fieldValues, setFieldValues] = useState(() => Object.fromEntries(tool.fields.map((f) => [f.name, f.default ?? ''])))
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [estimate, setEstimate] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const requestEstimate = async (nextFiles) => {
    if (!token || nextFiles.length === 0) {
      setEstimate(null)
      return
    }
    const totalBytes = nextFiles.reduce((sum, file) => sum + file.size, 0)
    try {
      const res = await axios.post(
        '/api/tools/estimate',
        {
          tool_id: tool.id,
          file_count: nextFiles.length,
          total_mb: totalBytes / (1024 * 1024),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setEstimate(res.data)
    } catch {
      setEstimate(null)
    }
  }

  const handleSubmit = async () => {
    if (files.length === 0) {
      toast.error('Please select at least one file.')
      return
    }

    for (const field of tool.fields) {
      if (field.required && !fieldValues[field.name]?.trim()) {
        toast.error(`"${field.label}" is required.`)
        return
      }
    }

    setLoading(true)
    setProgress(10)
    setResult(null)
    setError(null)

    try {
      const form = new FormData()
      if (tool.multiple) {
        files.forEach((f) => form.append('files', f))
      } else {
        form.append('file', files[0])
      }

      Object.entries(fieldValues).forEach(([k, v]) => form.append(k, v))

      const requestConfig = {
        headers: { Authorization: `Bearer ${token}` },
      }

      if (tool.resultType === 'info' || tool.resultType === 'text') {
        const res = await axios.post(tool.endpoint, form, requestConfig)
        setProgress(85)
        setResult({ type: tool.resultType, data: res.data })
      } else {
        const res = await axios.post(tool.endpoint, form, {
          ...requestConfig,
          responseType: 'blob',
        })
        setProgress(85)
        const url = URL.createObjectURL(res.data)
        setResult({ type: 'download', url, name: tool.downloadName })
      }

      if (typeof onProcessed === 'function') onProcessed()
      setProgress(100)
      toast.success('Done!')
    } catch (err) {
      let msg = 'Something went wrong. Please try again.'
      if (err.response?.data instanceof Blob) {
        try {
          const parsed = JSON.parse(await err.response.data.text())
          msg = parsed.error || msg
        } catch {
          msg = 'Request failed.'
        }
      } else {
        msg = err.response?.data?.error || msg
      }
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
      setTimeout(() => setProgress(0), 500)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/75 backdrop-blur-md" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'rgba(12,22,16,0.92)', border: '1px solid rgba(255,255,255,0.09)', backdropFilter: 'blur(24px)' }}
      >
        <div className="flex items-center gap-3 px-6 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
            <Icon size={16} style={{ color: '#34d399' }} />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-white">{tool.label}</h2>
            <p className="text-xs text-slate-500 leading-tight mt-0.5 line-clamp-1">{tool.description}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <FileDropzone
            multiple={tool.multiple}
            accept={tool.accept}
            files={files}
            onChange={(valueOrUpdater) => {
              setFiles((prev) => {
                const next =
                  typeof valueOrUpdater === 'function'
                    ? valueOrUpdater(prev)
                    : valueOrUpdater
                requestEstimate(next)
                return next
              })
            }}
            sortable={tool.id === 'merge'}
          />

          {estimate && (
            <div className="rounded-xl px-3 py-2 text-xs flex items-center justify-between" style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.25)' }}>
              <span className="text-slate-300">Estimated cost: <span className="text-green-400 font-semibold">{estimate.estimated_credits} credit(s)</span></span>
              <span className="text-slate-500">~{estimate.estimated_seconds}s</span>
            </div>
          )}

          {error && error.toLowerCase().includes('credit') && (
            <div className="rounded-xl px-4 py-3 text-xs" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}>
              <p className="text-amber-300 mb-2">Insufficient credits. Add credits from your Profile page.</p>
              <p className="text-slate-400">Go to Profile &gt; Buy Credits, then retry this tool.</p>
            </div>
          )}

          {loading && (
            <div className="space-y-1">
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(progress, 15)}%`, background: 'linear-gradient(90deg,#34d399,#10b981)' }}
                />
              </div>
              <p className="text-[11px] text-slate-500">Processing in progress...</p>
            </div>
          )}

          {tool.fields.map((field) => (
            <div key={field.name}>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                {field.label}
                {field.required && <span className="text-green-400 ml-0.5">*</span>}
              </label>
              {field.type === 'select' ? (
                <select
                  value={fieldValues[field.name]}
                  onChange={(e) => setFieldValues((p) => ({ ...p, [field.name]: e.target.value }))}
                  className="w-full rounded-xl px-3 py-2.5 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  {field.options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type}
                  value={fieldValues[field.name]}
                  onChange={(e) => setFieldValues((p) => ({ ...p, [field.name]: e.target.value }))}
                  placeholder={field.placeholder}
                  className="w-full rounded-xl px-3 py-2.5 text-slate-200 placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              )}
            </div>
          ))}

          {error && (
            <div className="flex items-start gap-2 rounded-xl px-4 py-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {result?.type === 'info' && <InfoResult data={result.data} />}
          {result?.type === 'text' && <TextResult data={result.data} />}
          {result?.type === 'download' && (
            <a href={result.url} download={result.name} className="flex items-center justify-center gap-2 w-full btn-ghost">
              <FileDown size={16} />
              Download {result.name}
            </a>
          )}
        </div>

        <div className="px-6 pb-6 flex justify-end gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem', marginTop: '0.5rem' }}>
          <button onClick={onClose} className="btn-ghost text-sm">Cancel</button>
          <button onClick={handleSubmit} disabled={loading || files.length === 0} className="btn-primary text-sm flex items-center gap-2">
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Icon size={15} />
                {tool.label}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

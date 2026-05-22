import { useState, useCallback, useRef } from 'react'
import { Upload, X, Image } from 'lucide-react'

interface PhotoUploadProps {
  files: File[]
  onChange: (files: File[]) => void
}

export default function PhotoUpload({ files, onChange }: PhotoUploadProps) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = (newFiles: FileList | File[]) => {
    const valid = Array.from(newFiles).filter(f => f.type.startsWith('image/'))
    onChange([...files, ...valid].slice(0, 5)) // max 5 fotos
  }

  const removeFile = (idx: number) => {
    onChange(files.filter((_, i) => i !== idx))
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }, [files])

  return (
    <div>
      <div
        className={`photo-drop-zone ${dragging ? 'dragging' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <Upload size={32} color="var(--gray-500)" style={{ margin: '0 auto 12px' }} />
        <p className="font-semi text-base" style={{ color: 'var(--gray-300)' }}>
          Arrastra fotos aquí o <span style={{ color: 'var(--brand-400)' }}>haz clic para seleccionar</span>
        </p>
        <p className="text-sm text-muted mt-2">JPG, PNG, WEBP · Máximo 5 fotos</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={e => e.target.files && addFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <div className="photo-grid">
          {files.map((file, idx) => (
            <div key={idx} className="photo-thumb">
              <img src={URL.createObjectURL(file)} alt={`Foto ${idx + 1}`} />
              <button className="photo-remove" onClick={() => removeFile(idx)} type="button">
                <X size={12} />
              </button>
            </div>
          ))}
          {files.length < 5 && (
            <div
              className="photo-thumb flex items-center justify-center"
              style={{ background: 'var(--surface-card2)', cursor: 'pointer', border: '2px dashed var(--surface-border)' }}
              onClick={() => inputRef.current?.click()}
            >
              <Image size={24} color="var(--gray-500)" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

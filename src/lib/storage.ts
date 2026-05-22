import { supabase } from './supabase'

const BUCKET = 'street_photos'

export async function uploadPhoto(file: File, streetId: string): Promise<string | null> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const fileName = `${streetId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

  // 1. Intentar subir
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, file, { cacheControl: '3600', upsert: false, contentType: file.type })

  if (uploadError) {
    console.error('[Storage] Error al subir foto:', uploadError.message, uploadError)
    return null
  }

  // 2. Obtener URL pública
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName)

  if (!data?.publicUrl) {
    console.error('[Storage] No se pudo obtener URL pública para:', fileName)
    return null
  }

  console.log('[Storage] Foto subida OK:', data.publicUrl)
  return data.publicUrl
}

export async function uploadMultiplePhotos(files: File[], streetId: string): Promise<string[]> {
  const urls: string[] = []

  for (const file of files) {
    console.log('[Storage] Subiendo:', file.name, `(${(file.size / 1024).toFixed(1)} KB)`)
    const url = await uploadPhoto(file, streetId)
    if (url) {
      urls.push(url)
    } else {
      console.warn('[Storage] Foto omitida por error:', file.name)
    }
  }

  console.log(`[Storage] Total fotos subidas: ${urls.length}/${files.length}`, urls)
  return urls
}

/**
 * Verifica si el bucket existe y es accesible.
 * Llama esto desde la consola del navegador para diagnosticar.
 */
export async function checkBucket(): Promise<void> {
  console.log('[Storage] Verificando bucket:', BUCKET)
  const { data, error } = await supabase.storage.getBucket(BUCKET)
  if (error) {
    console.error('[Storage] ❌ Bucket NO encontrado o sin permisos:', error.message)
    console.info('[Storage] Solución: Ve a Supabase Storage y crea el bucket "street-photos" como PÚBLICO')
  } else {
    console.log('[Storage] ✅ Bucket OK:', data)
  }
}

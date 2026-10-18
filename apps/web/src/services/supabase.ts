import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const SUPABASE_BUCKET =
  import.meta.env.VITE_SUPABASE_BUCKET_CERTIFICATES || 'donor-certificates';

/**
 * Checks if real Supabase Cloud Storage credentials have been supplied.
 */
export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
      supabaseAnonKey &&
      typeof supabaseUrl === 'string' &&
      supabaseUrl.startsWith('https://') &&
      !supabaseUrl.includes('your-project'),
  );
};

let supabaseInstance: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient | null => {
  if (!isSupabaseConfigured()) return null;
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabaseInstance;
};

export interface UploadResult {
  publicUrl: string;
  storagePath: string;
  isLocalFallback?: boolean;
}

/**
 * Uploads a physical paper certificate photo directly to Supabase Storage bucket.
 * If Supabase credentials are not provided yet in .env, gracefully provides a data/blob preview
 * so the application remains 100% stable with helpful setup guidance.
 */
export async function uploadCertificatePhoto(
  file: File,
  donorId: string,
): Promise<UploadResult> {
  const client = getSupabaseClient();

  if (!client) {
    // Read as Base64 data URL so it persists in demo/local session if Supabase is not yet configured
    const base64Url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Không thể đọc file ảnh'));
      reader.readAsDataURL(file);
    });

    return {
      publicUrl: base64Url,
      storagePath: `local-session/${donorId}/${file.name}`,
      isLocalFallback: true,
    };
  }

  const fileExt = file.name.split('.').pop() || 'jpg';
  const cleanExt = fileExt.toLowerCase().replace(/[^a-z0-9]/g, '');
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${cleanExt || 'jpg'}`;
  const filePath = `${donorId}/${fileName}`;

  const { error: uploadError } = await client.storage
    .from(SUPABASE_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || 'image/jpeg',
    });

  if (uploadError) {
    throw new Error(`Lỗi tải ảnh lên Supabase Storage: ${uploadError.message}`);
  }

  const { data } = client.storage.from(SUPABASE_BUCKET).getPublicUrl(filePath);

  return {
    publicUrl: data.publicUrl,
    storagePath: filePath,
    isLocalFallback: false,
  };
}

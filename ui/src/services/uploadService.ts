import { apiClient } from '../api/client';

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export interface UploadResponse {
  url: string;
}

/**
 * Upload an image file. Returns the URL path to use (e.g. /api/files/uploads/...).
 * Supported: .jpeg, .jpg, .png, .webp
 */
export async function uploadImage(file: File): Promise<UploadResponse> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Invalid file type. Supported: .jpeg, .jpg, .png, .webp');
  }
  const form = new FormData();
  form.append('file', file);
  const { data } = await apiClient.post<UploadResponse>('/api/upload', form);
  return data;
}

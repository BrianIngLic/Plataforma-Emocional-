import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class ProfileService {
  private supabaseService = inject(SupabaseService);

  /**
   * Uploads a file to Supabase Storage in the 'avatars' bucket.
   * File is stored under 'avatars/{userId}/{filename}'.
   * Returns the public URL.
   */
  async uploadAvatar(userId: string, file: File): Promise<string | null> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    const { error: uploadError } = await this.supabaseService.supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.error('Error uploading avatar:', uploadError);
      return null;
    }

    const { data } = this.supabaseService.supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  /**
   * Updates the avatar_url column in public.profiles
   */
  async updateAvatarUrl(userId: string, avatarUrl: string): Promise<boolean> {
    const { error } = await this.supabaseService.supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating avatar URL in profiles:', error);
      return false;
    }
    return true;
  }

  /**
   * Generates a DiceBear URL for a specific seed
   */
  generateDiceBearAvatar(seed: string, style: string = 'micah'): string {
    return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
  }
}

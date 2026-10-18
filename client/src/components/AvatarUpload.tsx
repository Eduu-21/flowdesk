import { Camera } from 'lucide-react';
import { useRef } from 'react';
import { useToast } from '@/context/ToastContext';
import { resizeImage } from '@/lib/image';
import { Button } from './ui/Button';
import { Avatar } from './ui/Misc';

interface AvatarUploadProps {
  name: string;
  color?: string;
  /** Current image (data URL / link) or null for initials */
  value: string | null;
  onChange: (value: string | null) => void;
}

export function AvatarUpload({ name, color, value, onChange }: AvatarUploadProps) {
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const onFile = async (file?: File) => {
    if (!file) return;
    try {
      onChange(await resizeImage(file));
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar name={name || 'New'} src={value} color={color} size="lg" />
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" icon={<Camera className="h-4 w-4" />} onClick={() => input.current?.click()}>
          {value ? 'Change photo' : 'Upload photo'}
        </Button>
        {value && (
          <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
            Remove
          </Button>
        )}
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label="Choose a profile photo"
          onChange={(event) => {
            void onFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </div>
    </div>
  );
}

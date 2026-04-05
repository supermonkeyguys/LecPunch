import { useState, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '@lecpunch/ui';

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#64748b',
];

const PRESET_EMOJIS = [
  // 表情
  '😀', '😎', '🤩', '😴', '🥳', '😤', '🤔', '😇',
  // 动物
  '🦊', '🐼', '🐨', '🦁', '🐯', '🐸', '🐙', '🦋',
  // 食物
  '🍕', '🍜', '🍣', '🧋', '🍩', '🍎', '🥑', '🌮',
  // 自然
  '🌸', '🌈', '⭐', '🌙', '🔥', '❄️', '🌊', '🍀',
  // 物品
  '🎮', '🎸', '📚', '🚀', '💎', '🎯', '🏆', '🎨',
];

export type AvatarSelection =
  | { type: 'color'; color: string }
  | { type: 'emoji'; emoji: string }
  | { type: 'image'; base64: string };

interface AvatarEditorProps {
  initialColor?: string;
  initialEmoji?: string;
  onSave: (selection: AvatarSelection) => Promise<void>;
  onClose: () => void;
}

export function AvatarEditor({ initialColor, initialEmoji, onSave, onClose }: AvatarEditorProps) {
  const [tab, setTab] = useState<'preset' | 'upload'>('preset');
  const [selectedColor, setSelectedColor] = useState<string | null>(initialColor ?? null);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(initialEmoji ?? null);
  const [previewBase64, setPreviewBase64] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    setSelectedEmoji(null);
  };

  const handleEmojiSelect = (emoji: string) => {
    setSelectedEmoji(emoji);
    setSelectedColor(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setUploadError('仅支持 JPG / PNG 格式');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('图片大小不能超过 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;
        const ctx = canvas.getContext('2d')!;
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, 200, 200);
        setPreviewBase64(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const canSave =
    tab === 'upload' ? !!previewBase64 : !!(selectedEmoji || selectedColor);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (tab === 'upload' && previewBase64) {
        await onSave({ type: 'image', base64: previewBase64 });
      } else if (selectedEmoji) {
        await onSave({ type: 'emoji', emoji: selectedEmoji });
      } else if (selectedColor) {
        await onSave({ type: 'color', color: selectedColor });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-[480px] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">更换头像</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {(['preset', 'upload'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                tab === t
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'preset' ? '预设' : '上传图片'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5">
          {tab === 'preset' ? (
            <>
              <p className="text-xs font-medium text-gray-500 mb-3">颜色</p>
              <div className="flex flex-wrap gap-2 mb-5">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => handleColorSelect(color)}
                    className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${
                      selectedColor === color ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : ''
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>

              <p className="text-xs font-medium text-gray-500 mb-3">Emoji</p>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleEmojiSelect(emoji)}
                    className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all hover:bg-gray-100 ${
                      selectedEmoji === emoji ? 'bg-blue-100 ring-2 ring-blue-400' : ''
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div>
              <div
                className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {previewBase64 ? (
                  <img
                    src={previewBase64}
                    alt="preview"
                    className="w-24 h-24 rounded-full mx-auto object-cover"
                  />
                ) : (
                  <div className="text-gray-400 text-sm">
                    <p>点击或拖拽上传图片</p>
                    <p className="text-xs mt-1">JPG / PNG，最大 2MB</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={handleFileChange}
              />
              {uploadError ? (
                <p className="text-red-500 text-xs mt-2">{uploadError}</p>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button disabled={!canSave || saving} onClick={handleSave}>
            {saving ? '保存中...' : '确认'}
          </Button>
        </div>
      </div>
    </div>
  );
}

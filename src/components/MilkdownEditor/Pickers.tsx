import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from 'services/i18n';

const EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰',
  '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏',
  '😒', '😞', '😔', '😟', '😕', '🙁', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡',
  '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐',
  '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢',
  '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '👽',
  '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐️',
  '👋', '🤝', '🙏', '💪', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '❣️', '💕', '💯',
  '✅', '❌', '⚠️', '❓', '❗', '⭐', '🌟', '✨', '🔥', '💡', '🎉', '🎊', '🎁', '🏆', '🥇', '📌',
];

export const EmojiPicker: React.FC<{
  top: number;
  left: number;
  onPick: (emoji: string) => void;
  onClose: () => void;
}> = ({ top, left, onPick, onClose }) => {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const list = useMemo(() => {
    if (!query.trim()) return EMOJIS;
    const q = query.trim().toLowerCase();
    return EMOJIS.filter(e => e.includes(q));
  }, [query]);

  return (
    <div ref={boxRef} className="tl-popover emoji-picker" style={{ top, left }}>
      <input
        autoFocus
        className="tl-popover-input"
        placeholder={t('Search emoji')}
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && list.length) onPick(list[0]);
        }}
      />
      <div className="emoji-grid">
        {list.map(emoji => (
          <button key={emoji} type="button" onMouseDown={e => { e.preventDefault(); onPick(emoji); }}>
            {emoji}
          </button>
        ))}
      </div>
      {!list.length && <div className="tl-popover-empty">{t('No matching emoji')}</div>}
    </div>
  );
};

export const TablePicker: React.FC<{
  top: number;
  left: number;
  onPick: (rows: number, cols: number) => void;
  onClose: () => void;
}> = ({ top, left, onPick, onClose }) => {
  const [hover, setHover] = useState<{ rows: number; cols: number }>({ rows: 3, cols: 3 });
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div ref={boxRef} className="tl-popover table-picker" style={{ top, left }}>
      <div className="table-picker-label">{hover.rows} × {hover.cols}</div>
      <div className="table-grid">
        {Array.from({ length: 8 }).map((_, r) => (
          <div className="table-grid-row" key={r}>
            {Array.from({ length: 8 }).map((__, c) => {
              const active = r < hover.rows && c < hover.cols;
              return (
                <span
                  key={c}
                  className={'table-grid-cell' + (active ? ' active' : '')}
                  onMouseEnter={() => setHover({ rows: r + 1, cols: c + 1 })}
                  onMouseDown={e => { e.preventDefault(); onPick(r + 1, c + 1); }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export const LinkPopover: React.FC<{
  top: number;
  left: number;
  initialHref: string;
  initialText: string;
  onApply: (href: string, text: string) => void;
  onRemove: () => void;
  onClose: () => void;
}> = ({ top, left, initialHref, initialText, onApply, onRemove, onClose }) => {
  const { t } = useI18n();
  const [href, setHref] = useState(initialHref);
  const [text, setText] = useState(initialText);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const apply = () => {
    if (!href.trim()) onRemove();
    else onApply(href.trim(), text);
  };

  return (
    <div ref={boxRef} className="tl-popover link-popover" style={{ top, left }}>
      <input
        autoFocus
        className="tl-popover-input"
        placeholder="https://"
        value={href}
        onChange={e => setHref(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') apply(); }}
      />
      {initialText && (
        <input
          className="tl-popover-input"
          placeholder={t('Link text')}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') apply(); }}
        />
      )}
      <div className="link-popover-actions">
        <button type="button" onMouseDown={e => { e.preventDefault(); onRemove(); }}>{t('Remove link')}</button>
        <button type="button" className="primary" onMouseDown={e => { e.preventDefault(); apply(); }}>{t('Apply')}</button>
      </div>
    </div>
  );
};

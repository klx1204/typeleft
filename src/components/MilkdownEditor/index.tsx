import React, { useEffect, useRef } from 'react';
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { history } from '@milkdown/kit/plugin/history';
import { listener, listenerCtx } from '@milkdown/kit/plugin/listener';
import { prism } from '@milkdown/plugin-prism';
import '@milkdown/kit/prose/view/style/prosemirror.css';
import '@milkdown/kit/prose/tables/style/tables.css';
import transport from 'services/transport';
import remoteCommon from 'services/remote/common';
import { getMarkdown } from '@milkdown/kit/utils';

interface IMilkdownEditor {
  markdown: string;
  options: any;
  onMarkdownChange: (markdown: string) => void;
}

const MilkdownEditor: React.FC<IMilkdownEditor> = (props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const onMarkdownChangeRef = useRef(props.onMarkdownChange);
  onMarkdownChangeRef.current = props.onMarkdownChange;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const startedAt = performance.now();
    let editor: Editor | null = null;
    let cancelled = false;

    Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, el);
        ctx.set(defaultValueCtx, props.markdown ?? '');
        ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
          if (!cancelled) onMarkdownChangeRef.current(markdown);
        });
      })
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(listener)
      .use(prism)
      .create()
      .then((instance) => {
        if (cancelled) {
          instance.destroy();
          return;
        }
        editor = instance;
        const elapsed = Math.round(performance.now() - startedAt);
        (window as any).__milkdownReady = elapsed;
        transport.postMessage('SaveState', { status: `Milkdown ready ${elapsed}ms` });
        // Serialize once so round-trip differences surface in the parent state.
        try {
          const serialized = instance.action(getMarkdown());
          if (serialized !== props.markdown) {
            onMarkdownChangeRef.current(serialized);
          }
        } catch (err) {
          console.error('[Milkdown] serialize failed', err);
        }
      })
      .catch((err) => {
        console.error('[Milkdown] create failed', err);
        (window as any).__milkdownError = String(err);
        transport.postMessage('SaveState', { status: `Milkdown error: ${String(err).slice(0, 60)}` });
        remoteCommon.unhandledException({ message: `MILKDOWN CREATE ERROR: ${String(err)}` }).catch(() => {});
      });

    return () => {
      cancelled = true;
      editor?.destroy();
    };
    // PoC: the editor is rebuilt when the file changes (key on parent).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      id="write"
      style={{
        maxWidth: props.options?.editorAreaWidth || '100%',
        margin: '0 auto',
        padding: '20px 50px 100px 50px',
        fontSize: props.options?.fontSize,
        lineHeight: props.options?.lineHeight,
        minHeight: '100vh',
        boxSizing: 'border-box',
      }}
    >
      <div ref={containerRef} className="milkdown-poc" />
    </div>
  );
};

export default MilkdownEditor;

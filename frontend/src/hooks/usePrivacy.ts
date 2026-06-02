import { useEffect, useCallback, useRef } from 'react';
import { useShared } from '@/context/SharedContext';

const NUM_RE = /\d[\d\s.,]*\d|\d/g;
const ATTR = 'data-pblur';

function wrapNumbers(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'NOSCRIPT')
        return NodeFilter.FILTER_REJECT;
      if (parent.hasAttribute(ATTR)) return NodeFilter.FILTER_REJECT;
      if (parent.closest(`[${ATTR}], input, textarea, select, script, style`))
        return NodeFilter.FILTER_REJECT;
      // Use a fresh regex test (avoid global lastIndex issues)
      return /\d/.test(node.textContent || '')
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });

  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

  for (const textNode of textNodes) {
    const text = textNode.textContent || '';
    NUM_RE.lastIndex = 0;
    if (!NUM_RE.test(text)) continue;

    const frag = document.createDocumentFragment();
    let lastIdx = 0;
    NUM_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = NUM_RE.exec(text)) !== null) {
      if (m.index > lastIdx) frag.appendChild(document.createTextNode(text.slice(lastIdx, m.index)));
      const span = document.createElement('span');
      span.setAttribute(ATTR, '');
      span.textContent = m[0];
      frag.appendChild(span);
      lastIdx = NUM_RE.lastIndex;
    }
    if (lastIdx < text.length) frag.appendChild(document.createTextNode(text.slice(lastIdx)));
    textNode.parentNode?.replaceChild(frag, textNode);
  }
}

function unwrapNumbers() {
  document.querySelectorAll(`[${ATTR}]`).forEach((span) => {
    const parent = span.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(span.textContent || ''), span);
    parent.normalize();
  });
}

export function usePrivacy() {
  const { state, dispatch } = useShared();
  const { privacyMode } = state;
  const observerRef = useRef<MutationObserver | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const saved = localStorage.getItem('privacyMode');
    if (saved === 'true' && !privacyMode) {
      dispatch({ type: 'SET_PRIVACY', value: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!privacyMode) {
      document.body.classList.remove('privacy-mode');
      observerRef.current?.disconnect();
      unwrapNumbers();
      return;
    }

    document.body.classList.add('privacy-mode');

    const run = () => {
      // Disconnect observer before mutating to avoid infinite loop
      observerRef.current?.disconnect();
      wrapNumbers(document.body);
      // Reconnect after wrapping
      observerRef.current?.observe(document.body, { childList: true, subtree: true });
    };

    const observer = new MutationObserver(() => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(run, 150);
    });
    observerRef.current = observer;

    run();

    return () => {
      clearTimeout(timerRef.current);
      observer.disconnect();
      document.body.classList.remove('privacy-mode');
      unwrapNumbers();
    };
  }, [privacyMode]);

  const togglePrivacy = useCallback(() => {
    const next = !privacyMode;
    dispatch({ type: 'SET_PRIVACY', value: next });
    localStorage.setItem('privacyMode', String(next));
  }, [privacyMode, dispatch]);

  return { privacyMode, togglePrivacy };
}

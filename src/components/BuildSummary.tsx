import { useEffect, useRef, useState } from 'react';
import { usePrice } from '../store/configurator';

interface Props {
  open: boolean;
  onClose: () => void;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

function fallbackCopy(text: string): void {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      fallbackCopy(text);
    }
  } else {
    fallbackCopy(text);
  }
}

export function BuildSummary({ open, onClose }: Props) {
  const { items, total } = usePrice();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key === 'Tab' && dialog) {
        const focusables = Array.from(
          dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (event.shiftKey && (active === first || active === dialog)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleCopy = async () => {
    await copyText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="build-summary-title"
        tabIndex={-1}
      >
        <header className="modal-header">
          <h3 id="build-summary-title" className="modal-title">
            Your build
          </h3>
          <button
            type="button"
            className="btn btn-close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <ul className="modal-items">
          {items.map((item) => (
            <li key={item.label} className="modal-item">
              <span className="modal-item-label">{item.label}</span>
              <span className="modal-item-amount">${item.amount}</span>
            </li>
          ))}
        </ul>
        <div className="modal-total">
          <span>Total</span>
          <span>${total}</span>
        </div>
        <footer className="modal-actions">
          <button type="button" className="btn" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy build link'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}

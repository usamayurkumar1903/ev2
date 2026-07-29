import Portal from './Portal';

export default function ConfirmDialog({ open, title, description, confirmLabel, onConfirm, onCancel }) {
  if (!confirmLabel) confirmLabel = 'Delete';
  if (!open) return null;
  return (
    <Portal>
      <div className="dialog-overlay">
        <div className="dialog">
          <div className="dialog-title">{title}</div>
          <div className="dialog-desc">{description}</div>
          <div className="dialog-actions">
            <button className="btn btn-secondary" onClick={onCancel} type="button">Cancel</button>
            <button className="btn btn-danger" onClick={onConfirm} type="button">{confirmLabel}</button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

import { useId } from 'react';

const MAX_SIZE = 10 * 1024 * 1024;
const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp';

export default function FileUpload({ label, required = false, value, onChange }) {
  const inputId = useId();

  function handleChange(event) {
    const file = event.target.files?.[0] || null;
    if (!file) {
      onChange(null);
      return;
    }

    if (file.size > MAX_SIZE) {
      event.target.value = '';
      onChange({ error: `${label} is larger than 10 MB.` });
      return;
    }

    const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
    if (!allowedTypes.has(file.type)) {
      event.target.value = '';
      onChange({ error: `${label} must be a PDF, JPG, PNG or WEBP file.` });
      return;
    }

    onChange({ file });
  }

  const hasError = value?.error;
  const selectedFile = value?.file;

  return (
    <div className={`file-upload ${hasError ? 'file-upload-error' : ''}`}>
      <div className="file-upload-head">
        <div>
          <div className="attachment-title">
            {label} {required && <span className="required-mark">*</span>}
          </div>
          <div className="helper">Upload the {label.toLowerCase()}.</div>
        </div>
      </div>

      <div className="file-upload-row">
        <label className="choose-file-btn" htmlFor={inputId}>
          Choose {label}
        </label>
        <input id={inputId} type="file" accept={ACCEPT} onChange={handleChange} hidden />
        <span className={selectedFile ? 'selected-file' : 'file-empty'}>
          {selectedFile ? `✓ ${selectedFile.name}` : 'No file selected'}
        </span>
      </div>

      {hasError ? (
        <span className="file-error">{value.error}</span>
      ) : (
        <span className="helper">PDF, JPG, PNG or WEBP · Maximum 10 MB</span>
      )}
    </div>
  );
}

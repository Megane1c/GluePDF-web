import { useState } from 'react';
import PDFMerger from './components/PDFMerger';
import PDFSigner from './components/PDFSigner';
import PDFEditor from './components/PDFEditor';
import './styles/App.css';

function App() {
  const [mode, setMode] = useState<'merge' | 'sign' | 'edit'>('merge');

  return (
    <main>
      <header className="menu-header">
        <button
          className={`menu-btn${mode === 'merge' ? ' active' : ''}`}
          onClick={() => setMode('merge')}
          type="button"
        >
          Merge PDFs
        </button>
        <button
          className={`menu-btn${mode === 'sign' ? ' active' : ''}`}
          onClick={() => setMode('sign')}
          type="button"
        >
          Sign PDF
        </button>
        <button
          className={`menu-btn${mode === 'edit' ? ' active' : ''}`}
          onClick={() => setMode('edit')}
          type="button"
        >
          Edit PDF
        </button>
      </header>
      {mode === 'merge' ? <PDFMerger /> : mode === 'sign' ? <PDFSigner /> : <PDFEditor />}
    </main>
  );
}

export default App;

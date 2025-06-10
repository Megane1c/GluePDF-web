import { useState } from 'react';
import PDFMerger from './components/PDFMerger';
import PDFSigner from './components/PDFSigner';
import './App.css';

function App() {
  const [mode, setMode] = useState<'merge' | 'sign'>('merge');

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
      </header>
      {mode === 'merge' ? <PDFMerger /> : <PDFSigner />}
    </main>
  );
}

export default App;

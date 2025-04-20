import { useMemo } from 'react';
import { useSortable, SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FiFile, FiTrash } from 'react-icons/fi';
import { PDFFile } from '../services/pdf';

interface PDFItemProps {
    file: PDFFile;
    onRemove: (id: string) => void;
    disabled?: boolean;
}

function truncateFilename(filename: string, maxLength = 20): { name: string; ext: string } {
    const lastDot = filename.lastIndexOf('.');
    if (lastDot === -1) return { name: filename, ext: '' };

    const name = filename.substring(0, lastDot);
    const ext = filename.substring(lastDot);

    if (name.length <= maxLength) return { name, ext };

    return {
        name: name.slice(0, maxLength - 1) + '…',
        ext,
    };
}

const PDFItem = ({ file, onRemove }: PDFItemProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({
        id: file.id,
        resizeObserverConfig: undefined,
        disabled: false,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        width: '180px',
        minWidth: '180px',
        display: 'inline-block',
        margin: '8px',
        verticalAlign: 'top',
        backgroundColor: '#1a1a1a',
        borderRadius: '10px',
        padding: '12px',
        gap: '10px',
        position: 'relative' as const,
        zIndex: isDragging ? 999 : 1
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        const kb = bytes / 1024;
        if (kb < 1024) return `${kb.toFixed(1)} KB`;
        const mb = kb / 1024;
        return `${mb.toFixed(1)} MB`;
    };

    const { name, ext } = truncateFilename(file.name);

    const handleRemove = (e: React.MouseEvent) => {
        e.stopPropagation();
        onRemove(file.id);
        
    };
    
    return (
        <div
            ref={setNodeRef}
            style={style}
            className="pdf-item"
        >
            <div className="remove-button-container" onClick={handleRemove}>
                <button
                >
                    <FiTrash size={16} className="remove-button" />
                </button>
            </div>

            <div 
                className="file-content"
                {...attributes}
                {...listeners}
            >
                <FiFile size={20} />
                <div className="file-name" title={file.name}>
                    <span>{name}</span>
                    <span className="file-ext">{ext}</span>
                </div>
                <div className="file-size">
                    {formatFileSize(file.size)}
                </div>
            </div>
        </div>
    );
};

interface PDFListProps {
    files: PDFFile[];
    onReorder: (files: PDFFile[]) => void;
    onRemove: (id: string) => void;
    disabled?: boolean;
}

const PDFList = ({ files, onRemove, disabled }: PDFListProps) => {
    const items = useMemo(() => files.map(file => file.id), [files]);

    return (
        <div className="pdf-list-container">
            <SortableContext items={items} strategy={rectSortingStrategy}>
                {files.map((file) => (
                    <PDFItem
                        key={file.id}
                        file={file}
                        onRemove={onRemove}
                        disabled={disabled}
                    />
                ))}
            </SortableContext>
        </div>
    );
};

export default PDFList;
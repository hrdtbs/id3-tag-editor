import React, { DragEvent, FC, memo } from "react";

export interface FileItem {
  file: File;
  excluded: boolean;
  title: string;
}

export interface FileRowProps {
  item: FileItem;
  idx: number;
  total: number;
  audioUrl: string;
  onTitleChange: (idx: number, value: string) => void;
  onExclude: (idx: number) => void;
  onDragStart: (idx: number) => void;
  onDragOver: (idx: number, e: DragEvent<HTMLDivElement>) => void;
  onDrop: () => void;
  onDragEnd: () => void;
  isDragging: boolean;
}

const FileRow: FC<FileRowProps> = memo(
  ({
    item,
    idx,
    total,
    audioUrl,
    onTitleChange,
    onExclude,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
    isDragging,
  }) => (
    <div
      className="file-item"
      key={`${item.file.name}-${item.file.size}`}
      draggable
      onDragStart={() => onDragStart(idx)}
      onDragOver={(e) => onDragOver(idx, e)}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      style={{ opacity: isDragging ? 0.5 : 1, cursor: "move" }}
      aria-label={`ファイル${idx + 1} / ${total}`}
    >
      <span className="track-no">{idx + 1}</span>
      <span className="file-name">{item.file.name}</span>
      <input
        className="song-title-input"
        type="text"
        value={item.title}
        onChange={(e) => onTitleChange(idx, e.target.value)}
        placeholder="曲名"
        aria-label={`曲名（${item.file.name}）`}
      />
      <audio
        controls
        src={audioUrl}
        style={{ width: 120 }}
        aria-label={`プレビュー: ${item.file.name}`}
      />
      <button
        className="exclude-btn"
        type="button"
        onClick={() => onExclude(idx)}
        aria-label={`除外: ${item.file.name}`}
      >
        除外
      </button>
    </div>
  )
);
FileRow.displayName = "FileRow";

export default FileRow;

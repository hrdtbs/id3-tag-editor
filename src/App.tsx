import React, { useRef, useState, useMemo } from "react";
import JSZip from "jszip";
import { ID3Writer } from "browser-id3-writer";

interface FileItem {
  file: File;
  excluded: boolean;
  title: string;
}

const App: React.FC = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [artist, setArtist] = useState("");
  const [album, setAlbum] = useState("");
  const [genre, setGenre] = useState("");
  const [year, setYear] = useState(() => String(new Date().getFullYear()));
  const [artwork, setArtwork] = useState<File | null>(null);
  const [artworkUrl, setArtworkUrl] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropAreaRef = useRef<HTMLButtonElement>(null);
  const artworkInputRef = useRef<HTMLInputElement>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // ファイル名から拡張子を除去する関数
  const getBaseName = (filename: string) => filename.replace(/\.[^.]+$/, "");

  // ファイル追加
  const handleFiles = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    const newFiles = Array.from(selectedFiles)
      .filter(
        (file) =>
          (file.type === "audio/mp3" || file.type === "audio/mpeg") &&
          !files.some(
            (f) => f.file.name === file.name && f.file.size === file.size
          )
      )
      .map((file) => ({
        file,
        excluded: false,
        title: getBaseName(file.name),
      }));
    setFiles((prev) => [...prev, ...newFiles]);
  };

  // ドラッグ＆ドロップ
  const onDrop = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dropAreaRef.current?.classList.remove("dragover");
    handleFiles(e.dataTransfer.files);
  };
  const onDragOver = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dropAreaRef.current?.classList.add("dragover");
  };
  const onDragLeave = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dropAreaRef.current?.classList.remove("dragover");
  };
  const onDropAreaKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  // 除外
  const excludeFile = (idx: number) => {
    setFiles((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, excluded: true } : f))
    );
  };

  // 曲名編集
  const editTitle = (idx: number, value: string) => {
    setFiles((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, title: value } : f))
    );
  };

  // アートワーク画像選択時の処理
  const handleArtworkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setArtwork(file);
  };

  // プレビュー用URL管理
  React.useEffect(() => {
    if (artwork) {
      const url = URL.createObjectURL(artwork);
      setArtworkUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setArtworkUrl("");
    }
  }, [artwork]);

  // タグ付与＆一括ダウンロード
  const processFiles = async () => {
    const zip = new JSZip();
    let trackNo = 1;
    let artworkBuffer: ArrayBuffer | null = null;
    if (artwork) {
      artworkBuffer = await artwork.arrayBuffer();
    }
    for (const item of files) {
      if (item.excluded) continue;
      const arrayBuffer = await item.file.arrayBuffer();
      const writer = new ID3Writer(arrayBuffer);
      writer.setFrame("TIT2", item.title || getBaseName(item.file.name));
      if (artist) writer.setFrame("TPE1", [artist]);
      if (album) writer.setFrame("TALB", album);
      if (genre) writer.setFrame("TCON", [genre]);
      if (year && !Number.isNaN(Number(year)))
        writer.setFrame("TYER", Number(year));
      writer.setFrame("TRCK", String(trackNo));
      if (artwork && artworkBuffer) {
        writer.setFrame("APIC", {
          type: 3, // Cover(front)
          data: artworkBuffer,
          description: artwork.name,
        });
      }
      writer.addTag();
      const taggedBlob = writer.getBlob();
      zip.file(item.file.name, taggedBlob);
      trackNo++;
    }
    const content = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(content);
    a.download = "tagged_mp3s.zip";
    a.click();
  };

  const activeFiles = files.filter((f) => !f.excluded);

  // ファイルごとにURLを生成し、不要になったらrevoke
  const audioUrls = useMemo(() => {
    const urls: { [key: string]: string } = {};
    activeFiles.forEach((item) => {
      urls[`${item.file.name}-${item.file.size}`] = URL.createObjectURL(
        item.file
      );
    });
    return urls;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFiles.map((f) => f.file.name + f.file.size).join(",")]);

  React.useEffect(() => {
    return () => {
      Object.values(audioUrls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [audioUrls]);

  // 並び替えロジック
  const handleDragStart = (idx: number) => setDragIndex(idx);
  const handleDragOver = (idx: number) => {
    if (dragIndex === null || dragIndex === idx) return;
    setFiles((prev) => {
      const arr = [...prev];
      const activeList = arr.filter((f) => !f.excluded);
      const dragItem = activeList[dragIndex];
      const dropItem = activeList[idx];
      // グローバルindex取得
      const dragGlobalIdx = arr.findIndex((f) => f === dragItem);
      const dropGlobalIdx = arr.findIndex((f) => f === dropItem);
      arr.splice(dragGlobalIdx, 1);
      arr.splice(dropGlobalIdx, 0, dragItem);
      return arr;
    });
    setDragIndex(idx);
  };
  const handleDragEnd = () => setDragIndex(null);

  return (
    <div className="container">
      <h1>ID3タグ一括編集ツール</h1>
      <button
        id="drop-area"
        ref={dropAreaRef}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragEnter={onDragOver}
        onDragLeave={onDragLeave}
        style={{
          cursor: "pointer",
          width: "100%",
          background: "none",
          border: "none",
          padding: 0,
        }}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={onDropAreaKeyDown}
        aria-label="mp3ファイルを選択"
        type="button"
      >
        <p>ここにmp3ファイルをドラッグ＆ドロップ、またはクリックして選択</p>
        <input
          type="file"
          ref={fileInputRef}
          multiple
          accept="audio/mp3, audio/mpeg"
          style={{ display: "none" }}
          onChange={(e) => handleFiles(e.target.files)}
        />
        <span style={{ display: "block", marginTop: 12 }}>
          <span id="fileSelect" style={{ pointerEvents: "none" }}>
            ファイルを選択
          </span>
        </span>
      </button>
      <form id="common-tags" onSubmit={(e) => e.preventDefault()}>
        <h2>共通ID3タグ</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
          <label style={{ flex: 1, minWidth: 180 }}>
            アーティスト名:
            <input
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
            />
          </label>
          <label style={{ flex: 1, minWidth: 180 }}>
            アルバム名:
            <input
              type="text"
              value={album}
              onChange={(e) => setAlbum(e.target.value)}
            />
          </label>
          <label style={{ flex: 1, minWidth: 180 }}>
            ジャンル:
            <input
              type="text"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
            />
          </label>
          <label style={{ flex: 1, minWidth: 100 }}>
            年:
            <input
              type="text"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />
          </label>
        </div>
        <div style={{ marginTop: 16 }}>
          <label style={{ display: "block", marginBottom: 8 }}>
            アートワーク画像:
            <input
              type="file"
              accept="image/*"
              ref={artworkInputRef}
              style={{ display: "inline-block", marginLeft: 8 }}
              onChange={handleArtworkChange}
            />
          </label>
          {artworkUrl && (
            <img
              src={artworkUrl}
              alt="アートワークプレビュー"
              style={{
                maxWidth: 120,
                maxHeight: 120,
                borderRadius: 8,
                border: "1px solid #ccc",
              }}
            />
          )}
        </div>
      </form>
      <div id="file-list">
        {activeFiles.length === 0 ? (
          <p style={{ color: "#888", textAlign: "center" }}>
            ファイルが選択されていません
          </p>
        ) : (
          activeFiles.map((item, idx) => (
            <div
              className="file-item"
              key={`${item.file.name}-${item.file.size}`}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => {
                e.preventDefault();
                handleDragOver(idx);
              }}
              onDrop={handleDragEnd}
              onDragEnd={handleDragEnd}
              style={{ opacity: dragIndex === idx ? 0.5 : 1, cursor: "move" }}
            >
              <span className="track-no">{idx + 1}</span>
              <span className="file-name">{item.file.name}</span>
              <input
                className="song-title-input"
                type="text"
                value={item.title}
                onChange={(e) =>
                  editTitle(
                    files.findIndex((f) => f === item),
                    e.target.value
                  )
                }
                placeholder="曲名"
                aria-label={`曲名（${item.file.name}）`}
              />
              <audio
                controls
                src={audioUrls[`${item.file.name}-${item.file.size}`]}
                style={{ width: 120 }}
                aria-label={`プレビュー: ${item.file.name}`}
              />
              <button
                className="exclude-btn"
                type="button"
                onClick={() => excludeFile(files.findIndex((f) => f === item))}
                aria-label={`除外: ${item.file.name}`}
              >
                除外
              </button>
            </div>
          ))
        )}
      </div>
      <button
        id="process"
        type="button"
        disabled={activeFiles.length === 0}
        onClick={processFiles}
        style={{ marginTop: 24 }}
      >
        タグ付与＆一括ダウンロード
      </button>
    </div>
  );
};

export default App;

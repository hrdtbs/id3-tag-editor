import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  Fragment,
  ChangeEvent,
  KeyboardEvent,
  DragEvent,
} from "react";
import JSZip from "jszip";
import { ID3Writer } from "browser-id3-writer";
import FileRow, { FileItem } from "./components/FileRow";

const getBaseName = (filename: string) => filename.replace(/\.[^.]+$/, "");

const App: React.FC = () => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [artist, setArtist] = useState("");
  const [album, setAlbum] = useState("");
  const [genre, setGenre] = useState("");
  const [year, setYear] = useState(() => String(new Date().getFullYear()));
  const [artwork, setArtwork] = useState<File | null>(null);
  const [artworkUrl, setArtworkUrl] = useState<string>("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropAreaRef = useRef<HTMLButtonElement>(null);
  const artworkInputRef = useRef<HTMLInputElement>(null);
  // audioプレビューURL管理
  const [audioUrls, setAudioUrls] = useState<{ [key: string]: string }>({});

  // ファイル追加
  const handleFiles = useCallback(
    (selectedFiles: FileList | null) => {
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [files]
  );

  // ドラッグ＆ドロップ
  const onDrop = useCallback(
    (e: React.DragEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      dropAreaRef.current?.classList.remove("dragover");
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );
  const onDragOver = useCallback((e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dropAreaRef.current?.classList.add("dragover");
  }, []);
  const onDragLeave = useCallback((e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dropAreaRef.current?.classList.remove("dragover");
  }, []);
  const onDropAreaKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fileInputRef.current?.click();
      }
    },
    []
  );

  // 除外
  const excludeFile = useCallback((idx: number) => {
    setFiles((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, excluded: true } : f))
    );
  }, []);

  // 曲名編集
  const editTitle = useCallback((idx: number, value: string) => {
    setFiles((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, title: value } : f))
    );
  }, []);

  // 並び替えロジック
  const handleDragStart = useCallback((idx: number) => setDragIndex(idx), []);
  const handleDragOver = useCallback(
    (idx: number, e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (dragIndex === null || dragIndex === idx) return;
      setFiles((prev) => {
        const arr = [...prev];
        const activeList = arr.filter((f) => !f.excluded);
        const dragItem = activeList[dragIndex];
        const dropItem = activeList[idx];
        const dragGlobalIdx = arr.findIndex((f) => f === dragItem);
        const dropGlobalIdx = arr.findIndex((f) => f === dropItem);
        arr.splice(dragGlobalIdx, 1);
        arr.splice(dropGlobalIdx, 0, dragItem);
        return arr;
      });
      setDragIndex(idx);
    },
    [dragIndex]
  );
  const handleDragEnd = useCallback(() => setDragIndex(null), []);

  // アートワーク画像選択時の処理
  const handleArtworkChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] || null;
      setArtwork(file);
    },
    []
  );

  // プレビュー用URL管理
  useEffect(() => {
    if (artwork) {
      const url = URL.createObjectURL(artwork);
      setArtworkUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setArtworkUrl("");
    }
  }, [artwork]);

  // audioプレビューURL管理
  useEffect(() => {
    const newUrls: { [key: string]: string } = {};
    files.forEach((item) => {
      const key = `${item.file.name}-${item.file.size}`;
      if (!audioUrls[key]) {
        newUrls[key] = URL.createObjectURL(item.file);
      } else {
        newUrls[key] = audioUrls[key];
      }
    });
    // 古いURLをrevoke
    Object.keys(audioUrls).forEach((key) => {
      if (
        !files.some((item) => `${item.file.name}-${item.file.size}` === key)
      ) {
        URL.revokeObjectURL(audioUrls[key]);
      }
    });
    setAudioUrls(newUrls);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  // タグ付与＆一括ダウンロード
  const processFiles = useCallback(async () => {
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
          type: 3,
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
  }, [files, artist, album, genre, year, artwork]);

  const activeFiles = files.filter((f) => !f.excluded);

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
          <Fragment>
            {activeFiles.map((item, idx) => (
              <FileRow
                key={`${item.file.name}-${item.file.size}`}
                item={item}
                idx={idx}
                total={activeFiles.length}
                audioUrl={audioUrls[`${item.file.name}-${item.file.size}`]}
                onTitleChange={(i, v) =>
                  editTitle(
                    files.findIndex((f) => f === item),
                    v
                  )
                }
                onExclude={(i) =>
                  excludeFile(files.findIndex((f) => f === item))
                }
                onDragStart={handleDragStart}
                onDragOver={(i, e) =>
                  handleDragOver(i, e as unknown as DragEvent<HTMLDivElement>)
                }
                onDrop={handleDragEnd}
                onDragEnd={handleDragEnd}
                isDragging={dragIndex === idx}
              />
            ))}
          </Fragment>
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

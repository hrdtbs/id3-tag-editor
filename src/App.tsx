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
import {
  Provider,
  defaultTheme,
  Button,
  TextField,
  ActionButton,
  Image,
  Flex,
  Heading,
  View,
  Text,
  DropZone,
  IllustratedMessage,
  Content,
  FileTrigger,
} from "@adobe/react-spectrum";

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
    <Provider theme={defaultTheme} colorScheme="light">
      <View backgroundColor="static-white" padding="size-200" minHeight="100vh">
        <Flex
          direction="column"
          gap="size-300"
          alignItems="center"
          maxWidth="700px"
          marginX="auto"
        >
          <Heading level={1}>ID3タグ一括編集ツール</Heading>
          <DropZone
            onDrop={async (e) => {
              const files: File[] = [];
              for await (const item of e.items) {
                if (
                  item.kind === "file" &&
                  (item.type === "audio/mp3" || item.type === "audio/mpeg")
                ) {
                  const file = await item.getFile();
                  files.push(file);
                }
              }
              handleFiles({
                length: files.length,
                item: (i: number) => files[i],
              } as unknown as FileList);
            }}
            maxWidth="size-3600"
          >
            <IllustratedMessage>
              <Heading>mp3ファイルをドラッグ＆ドロップ、または選択</Heading>
              <Content>
                <FileTrigger
                  acceptedFileTypes={["audio/mp3", "audio/mpeg"]}
                  allowsMultiple
                  onSelect={handleFiles}
                >
                  <Button variant="primary">mp3ファイルを選択</Button>
                </FileTrigger>
              </Content>
            </IllustratedMessage>
          </DropZone>
          <form
            id="common-tags"
            onSubmit={(e) => e.preventDefault()}
            style={{ width: "100%" }}
          >
            <Flex gap="size-200" wrap>
              <TextField
                label="アーティスト名"
                value={artist}
                onChange={setArtist}
                width="size-3600"
              />
              <TextField
                label="アルバム名"
                value={album}
                onChange={setAlbum}
                width="size-3600"
              />
              <TextField
                label="ジャンル"
                value={genre}
                onChange={setGenre}
                width="size-3600"
              />
              <TextField
                label="年"
                value={year}
                onChange={setYear}
                width="size-1600"
              />
            </Flex>
            <View marginTop="size-200">
              <Text>アートワーク画像</Text>
              <DropZone
                onDrop={async (e) => {
                  for await (const item of e.items) {
                    if (item.kind === "file") {
                      const file = await item.getFile();
                      setArtwork(file);
                    }
                  }
                }}
                maxWidth="size-3600"
                marginTop="size-100"
              >
                <IllustratedMessage>
                  <Heading>画像をドラッグ＆ドロップ、または選択</Heading>
                  <Content>
                    <FileTrigger
                      acceptedFileTypes={["image/*"]}
                      onSelect={(files) => {
                        const file = files?.[0] || null;
                        setArtwork(file);
                      }}
                    >
                      <Button variant="primary">画像を選択</Button>
                    </FileTrigger>
                  </Content>
                </IllustratedMessage>
              </DropZone>
              {artworkUrl && (
                <Image
                  src={artworkUrl}
                  alt="アートワークプレビュー"
                  width={120}
                  height={120}
                  UNSAFE_style={{
                    objectFit: "cover",
                    borderRadius: 8,
                    marginTop: 8,
                  }}
                />
              )}
            </View>
          </form>
          <View width="100%">
            {activeFiles.length === 0 ? (
              <View paddingY="size-200" alignSelf="center">
                <span style={{ color: "#888" }}>
                  ファイルが選択されていません
                </span>
              </View>
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
                      handleDragOver(
                        i,
                        e as unknown as DragEvent<HTMLDivElement>
                      )
                    }
                    onDrop={handleDragEnd}
                    onDragEnd={handleDragEnd}
                    isDragging={dragIndex === idx}
                  />
                ))}
              </Fragment>
            )}
          </View>
          <Button
            variant="cta"
            isDisabled={activeFiles.length === 0}
            onPress={processFiles}
            width="100%"
          >
            タグ付与＆一括ダウンロード
          </Button>
        </Flex>
      </View>
    </Provider>
  );
};

export default App;

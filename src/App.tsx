import {
  Button,
  Content,
  DropZone,
  FileTrigger,
  Flex,
  Heading,
  IllustratedMessage,
  Image,
  Text,
  TextField,
  View,
} from "@adobe/react-spectrum";
import { ID3Writer } from "browser-id3-writer";
import JSZip from "jszip";
import type React from "react";
import {
  type DragEvent,
  Fragment,
  useCallback,
  useEffect,
  useState,
} from "react";
import FileRow, { type FileItem } from "./components/FileRow";

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
    },
    [files]
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

  // プレビュー用URL管理
  useEffect(() => {
    if (artwork) {
      const url = URL.createObjectURL(artwork);
      setArtworkUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setArtworkUrl("");
  }, [artwork]);

  // audioプレビューURL管理
  useEffect(() => {
    const newUrls: { [key: string]: string } = {};
    for (const item of files) {
      const key = `${item.file.name}-${item.file.size}`;
      if (!audioUrls[key]) {
        newUrls[key] = URL.createObjectURL(item.file);
      } else {
        newUrls[key] = audioUrls[key];
      }
    }
    setAudioUrls(newUrls);
    return () => {
      for (const key of Object.keys(newUrls)) {
        URL.revokeObjectURL(newUrls[key]);
      }
    };
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
                objectFit="cover"
                UNSAFE_style={{
                  borderRadius: 8,
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
                    handleDragOver(i, e as unknown as DragEvent<HTMLDivElement>)
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
  );
};

export default App;

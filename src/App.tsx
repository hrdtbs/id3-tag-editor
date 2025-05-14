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
	useMemo,
	useState,
} from "react";
import FileRow, { type FileItem } from "./components/FileRow";

const getBaseName = (filename: string) => filename.replace(/\.[^.]+$/, "");

const App: React.FC = () => {
	const [files, setFiles] = useState<FileItem[]>([]);
	const [formState, setFormState] = useState({
		artist: "",
		album: "",
		genre: "",
		year: String(new Date().getFullYear()),
		artwork: null as File | null,
	});
	const [dragIndex, setDragIndex] = useState<number | null>(null);

	// artworkUrlはuseMemoで導出
	const artworkUrl = useMemo(() => {
		if (!formState.artwork) return "";
		return URL.createObjectURL(formState.artwork);
	}, [formState.artwork]);

	// audioUrlsもuseMemoで導出
	const audioUrls = useMemo(() => {
		const urls: { [key: string]: string } = {};
		for (const item of files) {
			const key = `${item.file.name}-${item.file.size}`;
			urls[key] = URL.createObjectURL(item.file);
		}
		return urls;
	}, [files]);

	// ファイル追加
	const handleFiles = useCallback(
		(selectedFiles: File[] | FileList | null) => {
			if (!selectedFiles) return;
			const newFiles = Array.from(selectedFiles)
				.filter(
					(file) =>
						(file.type === "audio/mp3" || file.type === "audio/mpeg") &&
						!files.some(
							(f) => f.file.name === file.name && f.file.size === file.size,
						),
				)
				.map((file) => ({
					file,
					excluded: false,
					title: getBaseName(file.name),
				}));
			setFiles((prev) => [...prev, ...newFiles]);
		},
		[files],
	);

	// 除外
	const excludeFile = useCallback((idx: number) => {
		setFiles((prev) =>
			prev.map((f, i) => (i === idx ? { ...f, excluded: true } : f)),
		);
	}, []);

	// 曲名編集
	const editTitle = useCallback((idx: number, value: string) => {
		setFiles((prev) =>
			prev.map((f, i) => (i === idx ? { ...f, title: value } : f)),
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
		[dragIndex],
	);
	const handleDragEnd = useCallback(() => setDragIndex(null), []);

	// フォーム入力変更
	const handleFormChange = useCallback((key: keyof typeof formState, value: string | File | null) => {
		setFormState((prev) => ({ ...prev, [key]: value }));
	}, []);

	// タグ付与＆一括ダウンロード
	const processFiles = useCallback(async () => {
		const zip = new JSZip();
		let trackNo = 1;
		let artworkBuffer: ArrayBuffer | null = null;
		if (formState.artwork) {
			artworkBuffer = await formState.artwork.arrayBuffer();
		}
		for (const item of files) {
			if (item.excluded) continue;
			const arrayBuffer = await item.file.arrayBuffer();
			const writer = new ID3Writer(arrayBuffer);
			writer.setFrame("TIT2", item.title || getBaseName(item.file.name));
			if (formState.artist) writer.setFrame("TPE1", [formState.artist]);
			if (formState.album) writer.setFrame("TALB", formState.album);
			if (formState.genre) writer.setFrame("TCON", [formState.genre]);
			if (formState.year && !Number.isNaN(Number(formState.year)))
				writer.setFrame("TYER", Number(formState.year));
			writer.setFrame("TRCK", String(trackNo));
			if (formState.artwork && artworkBuffer) {
				writer.setFrame("APIC", {
					type: 3,
					data: artworkBuffer,
					description: formState.artwork.name,
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
	}, [files, formState.artist, formState.album, formState.genre, formState.year, formState.artwork]);

	const activeFiles = files.filter((f) => !f.excluded);

	return (
		<View
			backgroundColor="static-white"
			padding="size-200"
			paddingBottom="size-2000"
			minHeight="100vh"
		>
			<Flex direction="column" gap="size-600" maxWidth="700px" marginX="auto">
				<Flex direction="column" gap="size-200">
					<Heading level={1}>ID3タグ一括編集ツール</Heading>
					<DropZone
						onDrop={async (e) => {
							console.log(e.items)
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
							handleFiles(files);
						}}
						maxWidth="size-3600"
					>
						<IllustratedMessage>
							<Heading>mp3ファイルをドラッグ＆ドロップ</Heading>
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
												v,
											)
										}
										onExclude={(i) =>
											excludeFile(files.findIndex((f) => f === item))
										}
										onDragStart={handleDragStart}
										onDragOver={handleDragOver}
										onDrop={handleDragEnd}
										onDragEnd={handleDragEnd}
										isDragging={dragIndex === idx}
									/>
								))}
							</Fragment>
						)}
					</View>
				</Flex>
				<form
					id="common-tags"
					onSubmit={(e) => e.preventDefault()}
				>
					<Flex gap="size-200" wrap>
						<TextField
							label="アーティスト名"
							value={formState.artist}
							name="artist"
							autoComplete="on"
							onChange={(v) => handleFormChange("artist", v)}
							width="size-3600"
						/>
						<TextField
							label="アルバム名"
							value={formState.album}
							name="album"
							autoComplete="on"
							onChange={(v) => handleFormChange("album", v)}
							width="size-3600"
						/>
						<TextField
							label="ジャンル"
							value={formState.genre}
							name="genre"
							autoComplete="on"
							onChange={(v) => handleFormChange("genre", v)}
							width="size-3600"
						/>
						<TextField
							label="年"
							value={formState.year}
							name="year"
							onChange={(v) => handleFormChange("year", v)}
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
										handleFormChange("artwork", file);
									}
								}
							}}
							maxWidth="size-3600"
							marginTop="size-100"
						>
							<IllustratedMessage>
								<Heading>画像をドラッグ＆ドロップ</Heading>
								<Content>
									<FileTrigger
										acceptedFileTypes={["image/*"]}
										onSelect={(files) => {
											const file = files?.[0] || null;
											handleFormChange("artwork", file);
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

				<Button
					variant="cta"
					isDisabled={activeFiles.length === 0}
					onPress={processFiles}
				>
					タグ付与＆一括ダウンロード
				</Button>
			</Flex>
		</View>
	);
};

export default App;

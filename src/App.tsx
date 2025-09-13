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
import { Fragment, useMemo, useRef, useState } from "react";
import FileRow, { type FileItem } from "./components/FileRow";
import { fileToMp3 } from "./utils/converter";

const getBaseName = (filename: string) => filename.replace(/\.[^.]+$/, "");

const App: React.FC = () => {
	const [files, setFiles] = useState<FileItem[]>([]);
	const [artworkPreview, setArtworkPreview] = useState<string>("");
	const [dragIndex, setDragIndex] = useState<number | null>(null);
	const artworkFileRef = useRef<File | null>(null);

	const audioUrls = useMemo(() => {
		const urls: { [key: string]: string } = {};
		for (const item of files) {
			const key = `${item.file.name}-${item.file.size}`;
			urls[key] = URL.createObjectURL(item.file);
		}
		return urls;
	}, [files]);

	function handleFiles(selectedFiles: File[] | FileList | null) {
		if (!selectedFiles) return;
		const newFiles = Array.from(selectedFiles)
			.filter(
				(file) =>
					(file.type === "audio/mp3" || file.type === "audio/mpeg") &&
					!files.some(
						(f) => f.file.name === file.name && f.file.size === file.size,
					),
			)
			.map((file) => {
				return {
					file,
					excluded: false,
					title: getBaseName(file.name),
				};
			});
		setFiles((prev) => [...prev, ...newFiles]);
	}

	function excludeFile(idx: number) {
		setFiles((prev) =>
			prev.map((f, i) => (i === idx ? { ...f, excluded: true } : f)),
		);
	}

	function editTitle(idx: number, value: string) {
		setFiles((prev) =>
			prev.map((f, i) => (i === idx ? { ...f, title: value } : f)),
		);
	}

	function handleDragStart(idx: number) {
		setDragIndex(idx);
	}
	function handleDragOver(idx: number, e: React.DragEvent<HTMLDivElement>) {
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
	}
	function handleDragEnd() {
		setDragIndex(null);
	}

	// artwork画像のプレビュー管理
	const handleArtworkChange = (file: File | null) => {
		artworkFileRef.current = file;
		if (file) {
			const url = URL.createObjectURL(file);
			setArtworkPreview(url);
		} else {
			setArtworkPreview("");
		}
	};

	// formDataを使ったタグ付与＆一括ダウンロード
	async function processFiles(formData: FormData) {
		const artist = formData.get("artist") as string;
		const album = formData.get("album") as string;
		const genre = formData.get("genre") as string;
		const year = formData.get("year") as string;
		const artworkFile = artworkFileRef.current;

		const zip = new JSZip();
		let trackNo = 1;
		let artworkBuffer: ArrayBuffer | null = null;
		if (artworkFile) {
			artworkBuffer = await artworkFile.arrayBuffer();
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
			if (artworkFile && artworkBuffer) {
				writer.setFrame("APIC", {
					type: 3,
					data: artworkBuffer,
					description: artworkFile.name,
				});
			}
			writer.addTag();
			const taggedBlob = writer.getBlob();
			zip.file(`${item.title}.mp3`, taggedBlob);
			trackNo++;
		}
		const content = await zip.generateAsync({ type: "blob" });
		const a = document.createElement("a");
		a.href = URL.createObjectURL(content);
		a.download = "tagged_mp3s.zip";
		a.click();
	}

	const activeFiles = files.filter((f) => !f.excluded);

	return (
		<View padding="size-200" paddingBottom="size-2000" minHeight="100vh">
			<Flex direction="column" gap="size-600" maxWidth="700px" marginX="auto">
				<Flex direction="column" gap="size-200">
					<Heading level={1}>まとめてMP3タグエディター</Heading>
					<section>
						<Heading level={2}>
							1. まとめてタグを付けたい音声ファイルをアップロード
						</Heading>
						<Text>
							*MP3形式以外のファイルは自動的にMP3形式に変換されます。
						</Text>
						<DropZone
							onDrop={async (e) => {
								const files: File[] = [];
								for await (const item of e.items) {
									if (item.kind === "file") {
										const originalFile = await item.getFile();
										const buffer = await fileToMp3(originalFile);
										if (buffer === null) continue;
										const file = new File([buffer], originalFile.name, {
											type: "audio/mp3",
										});
										files.push(file);
									}
								}
								handleFiles(files);
							}}
							maxWidth="size-3600"
						>
							<IllustratedMessage>
								<Heading>音声ファイルをドラッグ＆ドロップ</Heading>
								<Content>
									<FileTrigger
										acceptedFileTypes={["audio/mp3", "audio/mpeg"]}
										allowsMultiple
										onSelect={handleFiles}
									>
										<Button variant="primary">音声ファイルを選択</Button>
									</FileTrigger>
								</Content>
							</IllustratedMessage>
						</DropZone>
					</section>
					<section>
						<Heading level={2}>2. 曲名とトラック番号を確認</Heading>
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
											audioUrl={
												audioUrls[`${item.file.name}-${item.file.size}`]
											}
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
					</section>
				</Flex>
				<form id="common-tags" action={processFiles}>
					<Flex direction="column" gap="size-400">
						<section>
							<Heading level={2}>3. まとめて付けるタグ情報を設定</Heading>
							<Flex gap="size-200" wrap>
								<TextField
									label="アーティスト名"
									name="artist"
									autoComplete="on"
									width="size-3600"
								/>
								<TextField
									label="アルバム名"
									name="album"
									autoComplete="on"
									width="size-3600"
								/>
								<TextField
									label="ジャンル"
									name="genre"
									autoComplete="on"
									width="size-3600"
								/>
								<TextField
									label="年"
									name="year"
									defaultValue={String(new Date().getFullYear())}
									width="size-1600"
								/>
								<View marginTop="size-200">
									<Text>アートワーク画像</Text>
									<DropZone
										onDrop={async (e) => {
											for await (const item of e.items) {
												if (item.kind === "file") {
													const file = await item.getFile();
													handleArtworkChange(file);
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
														handleArtworkChange(file);
													}}
												>
													<Button variant="primary">画像を選択</Button>
												</FileTrigger>
											</Content>
										</IllustratedMessage>
									</DropZone>
									{artworkPreview && (
										<Image
											src={artworkPreview}
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
							</Flex>
						</section>

						<section>
							<Heading level={2}>4. 完成！</Heading>
							<Button
								variant="cta"
								type="submit"
								width="100%"
								isDisabled={activeFiles.length === 0}
							>
								タグ付与＆一括ダウンロード
							</Button>
						</section>
					</Flex>
				</form>
			</Flex>
		</View>
	);
};

export default App;

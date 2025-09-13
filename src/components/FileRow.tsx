import { Button, Flex, Grid, Text, TextField, View, Icon } from "@adobe/react-spectrum";
import { memo } from "react";

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
	onDragOver: (idx: number, e: React.DragEvent<HTMLDivElement>) => void;
	onDrop: () => void;
	onDragEnd: () => void;
	isDragging: boolean;
}

const FileRow = memo(
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
	}: FileRowProps) => (
		<div
			style={{
				borderRadius: 6,
				border: "1px solid #e1e1e1",
				margin: "8px 0",
				padding: 8,
				opacity: isDragging ? 0.5 : 1,
				cursor: "move",
			}}
			draggable
			onDragStart={() => onDragStart(idx)}
			onDragOver={(e) => onDragOver(idx, e)}
			onDrop={onDrop}
			onDragEnd={onDragEnd}
			aria-label={`ファイル${idx + 1} / ${total}`}
		>
			<Grid>
				<Flex alignItems="center" gap="size-200">
					<Icon size="XL">
						<svg width="18" height="18" viewBox="0 0 18 18">
							<title>ドラッグハンドル</title>
							<circle fill="#464646" cx="7" cy="13" r="1"/>
							<circle fill="#464646" cx="7" cy="10" r="1"/>
							<circle fill="#464646" cx="7" cy="7" r="1"/>
							<circle fill="#464646" cx="7" cy="4" r="1"/>
							<circle fill="#464646" cx="10" cy="13" r="1"/>
							<circle fill="#464646" cx="10" cy="10" r="1"/>
							<circle fill="#464646" cx="10" cy="7" r="1"/>
							<circle fill="#464646" cx="10" cy="4" r="1"/>
						</svg>
					</Icon>
					<Text>{idx + 1}</Text>
					<TextField
						labelPosition="side"
						value={item.title}
						onChange={(v) => onTitleChange(idx, v)}
						width="100%"
						aria-label={`曲名（${item.file.name}）`}
					/>
					<View minWidth="120px">
						<audio
							controls
							src={audioUrl}
							style={{ width: "100%" }}
							aria-label={`プレビュー: ${item.file.name}`}
						>
							<track kind="captions" label="" src="" default />
						</audio>
					</View>
					<Button
						variant="negative"
						onPress={() => onExclude(idx)}
						aria-label={`除外: ${item.file.name}`}
					>
						除外
					</Button>
				</Flex>
			</Grid>

		</div>
	),
);
FileRow.displayName = "FileRow";

export default FileRow;

import React, { DragEvent, FC, memo } from "react";
import { Flex, Text, TextField, Button, View } from "@adobe/react-spectrum";

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
      style={{
        background: "#fff",
        borderRadius: 6,
        border: "1px solid #e1e1e1",
        margin: "8px 0",
        padding: 8,
        opacity: isDragging ? 0.5 : 1,
        cursor: "move",
      }}
      draggable
      onDragStart={() => onDragStart(idx)}
      onDragOver={(e: any) => onDragOver(idx, e)}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      aria-label={`ファイル${idx + 1} / ${total}`}
    >
      <Flex alignItems="center" gap="size-200">
        <Text>{idx + 1}</Text>
        <Text
          flex="1"
          UNSAFE_style={{
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {item.file.name}
        </Text>
        <TextField
          label="曲名"
          labelPosition="side"
          value={item.title}
          onChange={(v) => onTitleChange(idx, v)}
          width="size-2400"
          aria-label={`曲名（${item.file.name}）`}
        />
        <View minWidth="120px">
          <audio
            controls
            src={audioUrl}
            style={{ width: "100%" }}
            aria-label={`プレビュー: ${item.file.name}`}
          />
        </View>
        <Button
          variant="negative"
          onPress={() => onExclude(idx)}
          aria-label={`除外: ${item.file.name}`}
        >
          除外
        </Button>
      </Flex>
    </div>
  )
);
FileRow.displayName = "FileRow";

export default FileRow;

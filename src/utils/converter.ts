import { registerMp3Encoder } from "@mediabunny/mp3-encoder";
import {
	ALL_FORMATS,
	BlobSource,
	BufferTarget,
	Conversion,
	Input,
	Mp3OutputFormat,
	Output,
	canEncodeAudio,
} from "mediabunny";

if (!await canEncodeAudio("mp3")) {
	registerMp3Encoder();
}

export const fileToMp3 = async (file: File) => {
	const input = new Input({
		formats: ALL_FORMATS,
		source: new BlobSource(file),
	});
	const output = new Output({
		format: new Mp3OutputFormat(),
		target: new BufferTarget(),
	});

	const conversion = await Conversion.init({ input, output });

	await conversion.execute();

	return output.target.buffer;
};

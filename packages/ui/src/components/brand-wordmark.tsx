import Image from "next/image";

export function BrandWordmark() {
	return (
		<Image
			src="/logo-ai-see-you.png"
			alt="AI See You"
			width={1000}
			height={220}
			className="h-auto w-40 shrink-0 sm:w-48"
			preload
		/>
	);
}

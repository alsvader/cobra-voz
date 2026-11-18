import { SpeechUnlock } from "@/components/charge/speech-unlock";

export default function AplicacionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <SpeechUnlock />
      {children}
    </div>
  );
}

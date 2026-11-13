import { waLink } from "@/lib/site";

export function WhatsAppFab({ label, message }: { label: string; message: string }) {
  return (
    <a
      href={waLink(message)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="fixed bottom-24 start-4 z-40 inline-flex size-14 items-center justify-center rounded-full bg-[#25d366] text-white shadow-[0_8px_20px_-6px_rgba(18,140,70,.8)] ring-4 ring-white/70 transition-transform hover:scale-110 lg:bottom-6"
    >
      <svg width="30" height="30" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
        <path d="M16.04 3C9.4 3 4 8.4 4 15.03c0 2.12.55 4.19 1.6 6.01L4 29l8.14-1.56a12.03 12.03 0 0 0 3.9.65h.01C22.69 28.09 28 22.7 28 16.07 28 9.4 22.68 3 16.04 3Zm0 22.1h-.01a10 10 0 0 1-5.1-1.4l-.37-.22-4.83.93.98-4.7-.24-.38a9.9 9.9 0 0 1-1.52-5.3c0-5.5 4.5-9.97 10.03-9.97 5.52 0 10.02 4.47 10.02 10 0 5.5-4.5 9.04-8.96 9.04Zm5.5-7.5c-.3-.15-1.78-.88-2.05-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.95 1.18-.18.2-.35.22-.65.07a8.2 8.2 0 0 1-2.4-1.48 9 9 0 0 1-1.66-2.07c-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.53.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.68-1.64-.93-2.25-.24-.58-.5-.5-.68-.5h-.58c-.2 0-.52.07-.8.38-.27.3-1.05 1.02-1.05 2.5s1.08 2.9 1.23 3.1c.15.2 2.1 3.2 5.1 4.5.7.3 1.26.5 1.7.62.72.23 1.37.2 1.88.12.57-.08 1.78-.72 2.03-1.43.25-.7.25-1.3.18-1.43-.08-.12-.28-.2-.58-.35Z" />
      </svg>
    </a>
  );
}

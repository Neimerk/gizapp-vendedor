import { Bell, X } from "lucide-react";

type OrderToastProps = {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
};

export default function OrderToast({
  visible,
  title,
  message,
  onClose,
}: OrderToastProps) {
  if (!visible) return null;

  return (
    <div className="fixed right-6 top-6 z-50 w-[360px] rounded-[28px] bg-white p-5 shadow-2xl shadow-black/20">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#10172a]">
          <Bell size={24} className="text-[#ffd400]" />
        </div>

        <div className="flex-1">
          <h3 className="text-lg font-black text-[#111827]">
            {title}
          </h3>

          <p className="mt-1 text-sm font-semibold text-[#64748b]">
            {message}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f1f5f9]"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
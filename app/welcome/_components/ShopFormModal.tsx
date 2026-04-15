"use client";

import { useEffect } from "react";
import { useActionState } from "react";
import { Store, Phone, MapPin } from "lucide-react";
import { saveShopAction } from "./actions";

type ActionState = { success?: boolean; error?: string };
type Mode = "add" | "edit" | "view";

export interface ShopData {
  id?: string;
  name: string;
  tel: string;
  location: string;
}

interface Props {
  mode: Mode;
  shop?: ShopData;
  onSuccess: () => void;
  onClose: () => void;
}

export default function ShopFormModal({ mode, shop, onSuccess, onClose }: Props) {
  const isView = mode === "view";

  const [state, submitAction, isPending] = useActionState<ActionState, FormData>(
    async (_, formData) => await saveShopAction(formData),
    {}
  );

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state?.success, onSuccess]);

  const fieldBase =
    "w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition";

  return (
    <form action={submitAction} className="space-y-5">
      {state?.error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {state.error}
        </div>
      )}

      {shop?.id && <input type="hidden" name="shopId" value={shop.id} />}

      {/* Shop Name */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <Store size={13} /> Shop Name <span className="text-red-500">*</span>
        </label>
        <input
          required
          name="name"
          type="text"
          defaultValue={shop?.name ?? ""}
          readOnly={isView}
          placeholder="e.g. Supreme Electronics"
          className={fieldBase}
        />
      </div>

      {/* Telephone */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <Phone size={13} /> Telephone <span className="text-red-500">*</span>
        </label>
        <input
          required
          name="tel"
          type="tel"
          defaultValue={shop?.tel ?? ""}
          readOnly={isView}
          placeholder="+254 712 345 678"
          className={fieldBase}
        />
      </div>

      {/* Location */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          <MapPin size={13} /> Location <span className="text-red-500">*</span>
        </label>
        <input
          required
          name="location"
          type="text"
          defaultValue={shop?.location ?? ""}
          readOnly={isView}
          placeholder="e.g. Nairobi CBD, Kenya"
          className={fieldBase}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl text-sm transition"
        >
          {isView ? "Close" : "Cancel"}
        </button>
        {!isView && (
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl text-sm transition"
          >
            {isPending ? "Saving…" : mode === "add" ? "Add Shop" : "Save Changes"}
          </button>
        )}
      </div>
    </form>
  );
}

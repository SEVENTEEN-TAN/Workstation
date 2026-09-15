import Image from "next/image";
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";

import styles from "../../../app/admin/admin.module.css";
import type { AssetData } from "../types";

interface AssetPickerProps {
  assets: AssetData[];
  open: boolean;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onSelect: (asset: AssetData) => void;
  onClose: () => void;
}

export function AssetPicker({ assets, open, triggerRef, onSelect, onClose }: AssetPickerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleAssets = assets.filter((asset) => !normalizedQuery || [asset.originalFilename, asset.altTextZh, asset.altTextEn]
    .some((value) => value?.toLocaleLowerCase().includes(normalizedQuery)));

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function close() {
    setQuery("");
    onClose();
  }

  return (
    <dialog ref={dialogRef} className={styles.assetPickerDialog} aria-labelledby="asset-picker-title" onCancel={(event) => { event.preventDefault(); close(); }} onClose={() => triggerRef.current?.focus()}>
      <div className={styles.assetPickerHead}>
        <div><span className={styles.kicker}>MEDIA LIBRARY</span><h2 id="asset-picker-title">选择媒体</h2></div>
        <button type="button" className={styles.iconButton} aria-label="关闭媒体选择器" onClick={close}><X size={18} /></button>
      </div>
      <label className={styles.mediaSearch}><Search size={17} aria-hidden="true" /><span className={styles.srOnly}>搜索媒体</span><input type="search" placeholder="搜索文件名或替代文本" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      {visibleAssets.length ? (
        <div className={styles.assetPickerGrid}>
          {visibleAssets.map((asset) => (
            <button type="button" key={asset.id} onClick={() => { setQuery(""); onSelect(asset); }}>
              <Image src={`/api/assets/${asset.id}`} alt={asset.altTextZh ?? asset.originalFilename} width={asset.width ?? 320} height={asset.height ?? 240} unoptimized />
              <span>{asset.originalFilename}</span>
            </button>
          ))}
        </div>
      ) : <p className={styles.assetPickerEmpty}>没有匹配的媒体资源。</p>}
    </dialog>
  );
}
